#!/usr/bin/env node
// Real WebGL check of the lens finish at the frame's border: with colour
// fringing off (`fringe` 0, the default of a film grade), a vignette or grain
// must not shift red and blue against green in the outermost pixels. A grey
// scene with a dark edge crossing the border must stay grey there.
// Desktop GPU evidence only; not WebGPU or mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.LENS_FINISH_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-lens-finish'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 640,
  H = 360;
const scene = (grade) => ({
  schemaVersion: 1,
  id: 'lens-finish-border',
  camera: { eye: [0, 3, 14], target: [0, 3, 0], focalLengthMm: 35 },
  look: {
    sky: [0.8, 0.8, 0.8],
    ambient: [0.9, 0.9, 0.9],
    sun: { azimuthDeg: 180, elevationDeg: 50, intensity: 1, color: [1, 1, 1] },
    grade: { bloom: 0, ao: 0, ...grade },
  },
  materials: { dark: { color: [0.02, 0.02, 0.02], roughness: 1 } },
  // Slabs turned so that their dark edges cross the left and right borders at a slant.
  nodes: [
    {
      id: 'left',
      type: 'box',
      size: [6, 9, 0.5],
      position: [-8.2, -1, 0],
      yawDeg: 14,
      material: 'dark',
    },
    {
      id: 'right',
      type: 'box',
      size: [6, 9, 0.5],
      position: [8.2, -1, 0],
      yawDeg: -14,
      material: 'dark',
    },
    { id: 'top', type: 'box', size: [30, 3, 0.5], position: [0, 6.2, 0], material: 'dark' },
  ],
});

/** Pixels within `band` of the frame's border whose channels differ by more than `limit`. */
const coloured = (frame, band = 3, limit = 24) => {
  let count = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x >= band && x < W - band && y >= band && y < H - band) continue;
      const i = (y * W + x) * 4;
      const r = frame.data[i],
        g = frame.data[i + 1],
        b = frame.data[i + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > limit) count++;
    }
  return count;
};

const host = new ZhudaFilmHost({});
const report = {};
try {
  await host.ready();
  for (const [name, grade] of Object.entries({
    plain: {},
    vignette: { vignette: 0.3 },
    grain: { grain: 0.25 },
    both: { vignette: 0.3, grain: 0.25 },
  })) {
    const { png } = await host.preview(scene(grade), { width: W, height: H });
    fs.writeFileSync(path.join(out, name + '.png'), png);
    report[name] = coloured(PNG.sync.read(png));
  }
  report.gpu = host.info?.gpu;
  report.glErrors = host.takeGlErrors();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  assert.equal(report.plain, 0, 'the grey scene is grey at the border without a lens finish');
  for (const name of ['vignette', 'grain', 'both'])
    assert.equal(
      report[name],
      0,
      `${name}: ${report[name]} coloured pixels at the border; red and blue must be read where green is when fringe is 0`,
    );
  assert.deepEqual(report.glErrors, []);
  console.log(JSON.stringify({ ok: true, out, ...report }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, out, ...report }, null, 2));
  throw error;
} finally {
  await host.close();
}
