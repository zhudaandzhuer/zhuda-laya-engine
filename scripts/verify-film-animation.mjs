#!/usr/bin/env node
// Real WebGL check of animated film scenes: a skinned GLB generated here plays
// a clip by shot time, a model moves along keys, and a light follows it.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { skinnedStripGlb, projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_ANIMATION_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-animation'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'strip.glb'), skinnedStripGlb());

const W = 480,
  H = 270;
const EYE = [2, 1.5, 10],
  TARGET = [2, 1.2, 0];
const at = (point) => projectPixel(point, EYE, TARGET, W, H);
const look = { sky: [0, 0, 0], ambient: [0.6, 0.6, 0.6], sun: { intensity: 0 }, shadows: false };
const scene = (model, nodes = [], extraLook = {}) => ({
  schemaVersion: 1,
  id: 'animation-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look: { ...look, ...extraLook },
  nodes: [
    { id: 'strip', type: 'model', asset: 'strip.glb', position: [0, 0, 0], ...model },
    ...nodes,
  ],
});
const host = new ZhudaFilmHost({ assets });
const render = async (name, s, time) => {
  const { png } = await host.preview(s, { width: W, height: H, time });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const patch = (img, [x, y]) => {
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => +(value / 25).toFixed(1));
};
const green = (rgb) => rgb[1] > 60 && rgb[1] > rgb[0] * 2;
const report = {};
try {
  await host.ready();
  const TOP = at([0, 1.85, 0]),
    BENT = at([-0.8, 1, 0]),
    BASE = at([0, 0.4, 0]);
  // 1. The clip follows shot time: straight at 0 s, bent toward -X at 1 s.
  const bend = { animation: { clip: 'Bend', loop: false } };
  const t0 = await render('bend-0', scene(bend), 0);
  const t1 = await render('bend-1', scene(bend), 1);
  report.bend = {
    t0: { top: patch(t0, TOP), bent: patch(t0, BENT) },
    t1: { top: patch(t1, TOP), bent: patch(t1, BENT) },
  };
  assert.ok(green(patch(t0, BASE)) && green(patch(t1, BASE)), 'the lower half stays put');
  assert.ok(green(report.bend.t0.top) && !green(report.bend.t0.bent), 'straight at 0 s');
  assert.ok(!green(report.bend.t1.top) && green(report.bend.t1.bent), 'bent at 1 s');
  // Half way: neither end position.
  const half = await render('bend-half', scene(bend), 0.5);
  assert.ok(!green(patch(half, TOP)) && !green(patch(half, BENT)), 'in between at 0.5 s');
  // The same time gives the same frame; speed and offset shift the clip.
  assert.ok(
    (await render('bend-1-again', scene(bend), 1)).data.equals(t1.data),
    'same time, same frame',
  );
  const fast = await render(
    'bend-fast',
    scene({ animation: { clip: 'Bend', loop: false, speed: 2 } }),
    0.5,
  );
  assert.ok(fast.data.equals(t1.data), 'speed 2 at 0.5 s equals speed 1 at 1 s');
  const offset = await render(
    'bend-offset',
    scene({ animation: { clip: 'Bend', loop: false, offsetSec: 1 } }),
    0,
  );
  assert.ok(offset.data.equals(t1.data), 'offset 1 s at time 0 equals time 1');
  // Without an animation the model keeps its rest pose at any time.
  const rest = await render('rest', scene({}), 1);
  assert.ok(green(patch(rest, TOP)), 'no animation: rest pose');

  // 2. An unknown clip is refused and names the clips the model has.
  await assert.rejects(
    host.preview(scene({ animation: { clip: 'Wave' } }), { width: W, height: H }),
    /has no clip Wave; it has: Bend/,
  );

  // 3. Motion: from x = 0 to x = 4 in two seconds, turning 90 degrees.
  const motion = [
    { time: 0, position: [0, 0, 0], yawDeg: 0 },
    { time: 2, position: [4, 0, 0], yawDeg: 0 },
  ];
  const moved = await render('motion-1', scene({ motion }), 1);
  report.motion = { atStart: patch(moved, at([0, 1, 0])), atMiddle: patch(moved, at([2, 1, 0])) };
  assert.ok(!green(report.motion.atStart) && green(report.motion.atMiddle), 'half way at 1 s');
  const ended = await render('motion-end', scene({ motion }), 5);
  assert.ok(green(patch(ended, at([4, 1, 0]))), 'holds the last key afterwards');

  // 4. A light follows the model: offset 1.5 m in front (+Z of the model),
  // and the model has turned 90 degrees, so the light is at +X of it.
  const ground = { id: 'ground', type: 'ground', size: [40, 40], material: 'concrete' };
  const lamp = {
    id: 'lamp',
    type: 'light',
    kind: 'point',
    position: [0, 0, 0],
    color: [1, 1, 1],
    intensity: 6,
    range: 4,
    follows: { node: 'strip', offset: [0, 1, 1.5] },
  };
  const turning = [
    { time: 0, position: [0, 0, 0], yawDeg: 0 },
    { time: 2, position: [1, 0, 0], yawDeg: 90 },
  ];
  const dark = { ambient: [0, 0, 0] };
  const lit0 = await render('follow-0', scene({ motion: turning }, [ground, lamp], dark), 0);
  const lit2 = await render('follow-2', scene({ motion: turning }, [ground, lamp], dark), 2);
  const FRONT0 = at([0, 0, 1.5]),
    SIDE2 = at([2.5, 0, 0]);
  report.follow = {
    t0: { front: patch(lit0, FRONT0), side: patch(lit0, SIDE2) },
    t2: { front: patch(lit2, FRONT0), side: patch(lit2, SIDE2) },
  };
  assert.ok(
    report.follow.t0.front[0] > report.follow.t0.side[0] + 20,
    'at 0 s the ground in front of the model is lit',
  );
  assert.ok(
    report.follow.t2.side[0] > report.follow.t2.front[0] + 20,
    'at 2 s the light has moved and turned with it',
  );

  // 5. 30 mounts with and without the animation, then the first frame again.
  for (let i = 0; i < 30; i++) await host.mountReport(scene(i % 2 ? bend : {}));
  assert.ok(
    (await render('bend-1-after-cycles', scene(bend), 1)).data.equals(t1.data),
    'identical after 30 mounts',
  );

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
