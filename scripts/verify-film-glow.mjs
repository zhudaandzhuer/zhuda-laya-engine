#!/usr/bin/env node
// Real draw check that a glowing surface lights what is round it when the
// look has `bounceLight`: at night a wall behind a pool of lava is dark with
// the glow alone, is lit in the lava's colour with bounce light, and stays
// dark with bounce light when the pool does not glow; a block 16 m away
// takes far less of it. Desktop GPU evidence only (WebGL, or WebGPU through
// verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_GLOW_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-glow'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 720,
  H = 405,
  LENS = 28;
const CAMERA = { eye: [6, 5, 16], target: [4, 1.5, 0] };
const scene = (id, emission, bounce) => ({
  schemaVersion: 1,
  id,
  camera: { ...CAMERA, focalLengthMm: LENS },
  look: {
    preset: 'night',
    sun: { azimuthDeg: 0, elevationDeg: 60, intensity: 0.02 },
    ambient: [0.01, 0.01, 0.012],
    ambientGround: [0.005, 0.005, 0.005],
    shadows: false,
    fog: false,
    grade: { exposure: 1.5, bloom: 0, ao: 0, antialias: 'none' },
    ...(bounce ? { bounceLight: { spacing: 2, strength: 1 } } : {}),
  },
  materials: {
    stone: { color: [0.6, 0.6, 0.6], roughness: 1 },
    lava: { color: [0.05, 0.02, 0.01], roughness: 1, emission },
  },
  nodes: [
    { id: 'ground', type: 'ground', size: [80, 80], material: 'stone' },
    { id: 'pool', type: 'box', size: [6, 0.1, 6], position: [0, 0, 0], material: 'lava' },
    { id: 'wall', type: 'box', size: [8, 4, 0.5], position: [0, 0, -4], material: 'stone' },
    { id: 'far', type: 'box', size: [3, 4, 0.5], position: [16, 0, -4], material: 'stone' },
  ],
});
const host = new ZhudaFilmHost({});
const GLOW = [2.2, 0.9, 0.25];
/** Mean colour of a patch round a point of the scene. */
const patch = (img, point, half = 6) => {
  const [cx, cy] = projectPixel(point, CAMERA.eye, CAMERA.target, W, H, LENS);
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = cy - half; y <= cy + half; y++)
    for (let x = cx - half; x <= cx + half; x++, n++)
      for (let k = 0; k < 3; k++) sum[k] += img.data[(y * W + x) * 4 + k];
  return sum.map((v) => Math.round(v / n));
};
const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;
  const WALL = [0, 1.5, -3.74],
    FAR = [16, 1.5, -3.74];
  for (const [name, emission, bounce] of [
    ['glow-alone', GLOW, false],
    ['bounce-no-glow', [0, 0, 0], true],
    ['glow-and-bounce', GLOW, true],
  ]) {
    const { png } = await host.preview(scene('glow-' + name, emission, bounce), {
      width: W,
      height: H,
    });
    fs.writeFileSync(path.join(out, name + '.png'), png);
    const img = PNG.sync.read(png);
    report[name] = { wall: patch(img, WALL), far: patch(img, FAR) };
  }
  const lit = report['glow-and-bounce'],
    alone = report['glow-alone'],
    unlit = report['bounce-no-glow'];
  assert.ok(alone.wall[0] < 12, `the glow alone leaves the wall dark (${alone.wall})`);
  assert.ok(unlit.wall[0] < 12, `bounce light without a glow leaves it dark (${unlit.wall})`);
  assert.ok(
    lit.wall[0] > 60 && lit.wall[0] > lit.wall[2] * 3,
    `with both the wall is lit in the lava's colour (${lit.wall})`,
  );
  assert.ok(
    lit.far[0] < lit.wall[0] / 4,
    `a block 16 m off takes far less (${lit.far} against ${lit.wall})`,
  );
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await host.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
