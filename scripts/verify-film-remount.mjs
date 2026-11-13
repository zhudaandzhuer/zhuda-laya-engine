#!/usr/bin/env node
// Real WebGL check that a film scene draws the same after it has been mounted
// again, and that mounting and drawing raise no WebGL error. An agent's loop
// remounts on every change, so whatever one scene leaves behind shows in the
// next preview. Two defects are pinned here: the ambient-occlusion pass read
// an occlusion colour nobody had written (creases glowed in a stale colour
// from the second mount on), and the light fog allocated its light table
// again on every change. Desktop GPU evidence only; not WebGPU or mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_REMOUNT_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-remount'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
// Barriers and containers on the ground: plenty of creases for ambient occlusion.
const yard = (id) => ({
  schemaVersion: 1,
  id,
  camera: { eye: [9, 2.2, 14], target: [-1, 1.2, 0], focalLengthMm: 28 },
  look: {
    preset: 'night',
    grade: { exposure: 1.9, bloom: 0.4, ao: 1, aoRadius: 0.6 },
    lightFog: { density: 0.02, falloffMeters: 7 },
  },
  nodes: [
    { id: 'ground', type: 'ground', size: [60, 60], material: 'asphalt' },
    { id: 'c1', type: 'prop', prop: 'container20', position: [-3, 0, -4], seed: 1 },
    { id: 'c2', type: 'prop', prop: 'container20', position: [4, 0, -5], yawDeg: 180, seed: 2 },
    ...[0, 1, 2, 3].map((i) => ({
      id: 'b' + i,
      type: 'prop',
      prop: 'jersey-barrier',
      position: [-6 + i * 3.4, 0, 3],
    })),
    {
      id: 'lamp',
      type: 'light',
      kind: 'point',
      position: [0, 4, 4],
      color: [0.4, 0.75, 1],
      intensity: 4.5,
      range: 14,
    },
  ],
});
// Something else to mount in between: its materials are released and their
// uniform blocks are what a later scene is handed.
const other = {
  schemaVersion: 1,
  id: 'other',
  camera: { eye: [0, 3, 8], target: [0, 1, 0] },
  look: { preset: 'day' },
  materials: { paint: { recipe: 'painted-steel', tint: [0.2, 0.6, 0.3, 1] } },
  nodes: [
    { id: 'ground', type: 'ground', size: [20, 20], material: 'concrete' },
    { id: 'c', type: 'prop', prop: 'container20', position: [0, 0, 0], params: { paint: 'paint' } },
  ],
};
// Pixels a neutral night scene cannot hold: clearly green, well above red and blue.
const strayGreen = (img) => {
  let count = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i],
      g = img.data[i + 1],
      b = img.data[i + 2];
    if (g > 90 && g > 1.6 * Math.max(r, b)) count++;
  }
  return count;
};

const host = new ZhudaFilmHost({});
const render = async (name, scene) => {
  const { png } = await host.preview(scene, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = { strayGreen: [] };
try {
  await host.ready();
  const first = await render('mount-1', yard('yard'));
  report.strayGreen.push(strayGreen(first));
  for (let i = 2; i <= 5; i++) {
    await host.mountReport(other);
    const again = await render('mount-' + i, yard('yard'));
    report.strayGreen.push(strayGreen(again));
    assert.ok(again.data.equals(first.data), `mount ${i} draws the frame of mount 1`);
  }
  assert.deepEqual(report.strayGreen, [0, 0, 0, 0, 0], 'no stray colour in the creases');
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'mounting and drawing raise no WebGL error');

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
