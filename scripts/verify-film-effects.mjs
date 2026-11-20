#!/usr/bin/env node
// Real draw check of the built-in 3D effect presets (ZHUDA_EFFECT_PRESETS_3D)
// through a film scene's `effect` node (ZhudaEffect3D). For every preset:
// it changes the picture; the same shot time gives the same picture after
// other times were drawn in between; a loop still shows later and differs
// from itself a moment on; a burst is over after its time; and before its
// `startSec` nothing is drawn. Desktop GPU evidence only (WebGL, or WebGPU
// through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { ZHUDA_EFFECT_PRESETS_3D } from '../packages/core/effects/EffectPresets.ts';

const out = path.resolve(
  process.env.FILM_EFFECTS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-effects'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 320,
  H = 240;
const ids = Object.keys(ZHUDA_EFFECT_PRESETS_3D);
/** Where a preset is put so that the camera sees it: falling things start overhead. */
const placed = (id) => {
  const [, h] = ZHUDA_EFFECT_PRESETS_3D[id].sizeMeters;
  if (['rain', 'snow'].includes(id)) return [0, h, 0];
  if (['falling-leaves', 'petals'].includes(id)) return [0, 5, 0];
  if (['explosion', 'hit', 'portal'].includes(id)) return [0, 1.3, 0];
  return [0, 0.05, 0];
};
const scene = (id, effect) => {
  const [w, h] = ZHUDA_EFFECT_PRESETS_3D[id].sizeMeters;
  const camera =
    w > 6
      ? { eye: [0, 1.6, w * 0.45], target: [0, 1.8, 0], focalLengthMm: 24 }
      : {
          eye: [0, h * 0.5 + 0.3, Math.max(w, h) * 1.25 + 1.5],
          target: [0, h * 0.45, 0],
          focalLengthMm: 35,
        };
  return {
    schemaVersion: 1,
    id: 'effects-' + id,
    camera,
    // No grain, no bloom: a pixel that changes is the effect's.
    look: {
      preset: 'dusk',
      fog: false,
      grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
    },
    materials: {
      ground: { color: [0.22, 0.22, 0.24], roughness: 1 },
      wall: { color: [0.16, 0.17, 0.2], roughness: 1 },
    },
    nodes: [
      { id: 'ground', type: 'ground', size: [80, 80], material: 'ground' },
      { id: 'wall', type: 'box', size: [40, 14, 0.5], position: [0, 0, -9], material: 'wall' },
      ...(effect
        ? [{ id: 'fx', type: 'effect', preset: id, position: placed(id), ...effect }]
        : []),
    ],
  };
};
const host = new ZhudaFilmHost({ renderer: process.env.ZHUDA_FILM_RENDERER });
const sheet = new PNG({ width: W * 6, height: H * 3 });
const render = async (s, time) =>
  PNG.sync.read((await host.preview(s, { width: W, height: H, time })).png);
/** Pixels that differ by more than 6 of 255 in a channel. */
const changed = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) > 6 ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > 6 ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > 6
    )
      n++;
  return n;
};
const same = (a, b) => Buffer.compare(a.data, b.data) === 0;
const largest = (a, b) => {
  let most = 0;
  for (let i = 0; i < a.data.length; i++) most = Math.max(most, Math.abs(a.data[i] - b.data[i]));
  return most;
};
const report = { presets: {} };
try {
  await host.ready();
  report.gpu = host.info?.gpu;
  for (const [k, id] of ids.entries()) {
    const preset = ZHUDA_EFFECT_PRESETS_3D[id];
    const burst = preset.kind === 'burst';
    // A burst is looked at soon after it begins; a loop once it has settled.
    const at = burst ? Math.min(0.3, preset.seconds * 0.25) : preset.seconds + 1;
    const empty = await render(scene(id), at);
    const withEffect = scene(id, {});
    const first = await render(withEffect, at);
    const later = await render(withEffect, burst ? preset.seconds + 0.5 : at + 0.25);
    const again = await render(withEffect, at);
    await render(withEffect, burst ? preset.seconds + 0.5 : at + 0.25);
    const third = await render(withEffect, at);
    const row = {
      kind: preset.kind,
      atSeconds: at,
      drawnPixels: changed(first, empty),
      // The first drawing after the mount and two later ones of the same shot
      // time, with another time drawn between them: the same bytes.
      sameAgain: same(first, again) && same(again, third),
      firstLargestDifference: largest(first, again),
      laterPixels: changed(later, burst ? empty : first),
    };
    // Put off by ten seconds, nothing of it is drawn yet.
    row.beforeStartPixels = changed(await render(scene(id, { startSec: at + 10 }), at), empty);
    report.presets[id] = row;
    PNG.bitblt(first, sheet, 0, 0, W, H, (k % 6) * W, Math.floor(k / 6) * H);
    assert.ok(row.drawnPixels >= 20, `${id} is drawn (${row.drawnPixels} pixels)`);
    assert.ok(row.sameAgain, `${id}: the same shot time is the same picture`);
    if (burst)
      assert.ok(
        row.laterPixels < 20,
        `${id} is over after ${preset.seconds} s (${row.laterPixels} pixels left)`,
      );
    else
      assert.ok(
        row.laterPixels >= 10,
        `${id} moves (${row.laterPixels} pixels differ a quarter second on)`,
      );
    assert.equal(row.beforeStartPixels, 0, `${id}: nothing before its start`);
  }
  fs.writeFileSync(path.join(out, 'presets.png'), PNG.sync.write(sheet));

  // A scale doubles its reach; a seed changes where the particles are.
  const fire = (effect) => render(scene('campfire', effect), 4);
  const base = await fire({}),
    emptyFire = await render(scene('campfire'), 4);
  report.scale = {
    one: changed(base, emptyFire),
    two: changed(await fire({ scale: 2 }), emptyFire),
  };
  assert.ok(
    report.scale.two > report.scale.one * 2,
    `twice the scale covers more (${JSON.stringify(report.scale)})`,
  );
  report.seed = changed(await fire({ seed: 3 }), base);
  assert.ok(report.seed >= 20, `another seed is another fire (${report.seed} pixels differ)`);
  report.glErrors = host.takeGlErrors?.() ?? [];
  assert.deepEqual(report.glErrors, [], 'no graphics errors');
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await host.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log('Pictures: ' + out);
}
