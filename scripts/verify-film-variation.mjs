#!/usr/bin/env node
// Real WebGL check of a recipe material's `variation`: seen from above, a
// ground whose tiles are all the same must stop being the same. Two places
// three tiles apart are compared. Desktop GPU evidence only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_VARIATION_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-variation'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270,
  HEIGHT = 30;
// Straight down from 30 m with a 35 mm lens on a 24 mm tall sensor.
const PX_PER_M = H / (2 * HEIGHT * (12 / 35));
// The starter asphalt repeats every 2 m; three tiles is the nearest whole number of pixels.
const SHIFT = Math.round(6 * PX_PER_M);
const scene = (variation) => ({
  schemaVersion: 1,
  id: 'variation-check',
  camera: { eye: [0, HEIGHT, 0.01], target: [0, 0, 0], focalLengthMm: 35 },
  look: {
    sky: [0.5, 0.5, 0.5],
    ambient: [1, 1, 1],
    sun: { intensity: 0 },
    shadows: false,
    grade: { exposure: 1, bloom: 0, ao: 0 },
  },
  materials: { road: { recipe: 'asphalt', ...(variation ? { variation } : {}) } },
  nodes: [{ id: 'ground', type: 'ground', size: [120, 120], material: 'road' }],
});
/** Mean luminance of the blocks of a grid over the frame, and of the same grid shifted. */
const difference = (img) => {
  const block = 24;
  const mean = (x0, y0) => {
    let sum = 0;
    for (let y = y0; y < y0 + block; y++)
      for (let x = x0; x < x0 + block; x++) sum += img.data[(y * W + x) * 4 + 1];
    return sum / (block * block);
  };
  let worst = 0;
  for (let y = 20; y + block < H - 20; y += block)
    for (let x = 20; x + SHIFT + block < W - 20; x += block)
      worst = Math.max(worst, Math.abs(mean(x, y) - mean(x + SHIFT, y)));
  return +worst.toFixed(2);
};

const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = { shiftPixels: SHIFT };
try {
  await host.ready();
  report.plain = difference(await render('plain', scene()));
  report.varied = difference(await render('varied', scene(0.5)));
  report.strong = difference(await render('strong', scene(1)));
  assert.ok(report.plain < 2, 'without variation, places three tiles apart are alike');
  assert.ok(report.varied > report.plain + 3, 'with it they differ');
  assert.ok(report.strong > report.varied, 'and more so with more of it');
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
