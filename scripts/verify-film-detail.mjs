#!/usr/bin/env node
// Real WebGL check of a film material's close-range detail (`detail` on a
// recipe material): a floor whose own recipe tiles at 40 m is smooth from a
// metre away and has grain with a detail recipe that repeats every 1.5 m;
// from 80 m up the two floors look the same, and from either distance the
// floor keeps its overall colour. Desktop GPU evidence only (WebGL, or WebGPU
// through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_DETAIL_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-detail'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 640,
  H = 400;
const cliff = {
  schemaVersion: 1,
  id: 'check-cliff',
  tileMeters: [40, 40],
  base: { color: [0.32, 0.3, 0.27], roughness: 0.9, metallic: 0 },
  layers: [
    { mask: { type: 'fbm', frequency: 3, octaves: 3 }, color: [0.22, 0.2, 0.18], heightMm: 200 },
  ],
};
const grain = {
  schemaVersion: 1,
  id: 'check-grain',
  tileMeters: [1.5, 1.5],
  base: { color: [0.5, 0.5, 0.5], roughness: 0.9, metallic: 0 },
  layers: [
    { mask: { type: 'fbm', frequency: 12, octaves: 4 }, color: [0.2, 0.2, 0.2], heightMm: 12 },
    {
      mask: { type: 'cells', frequency: 20, mode: 'edge', range: [0, 0.2] },
      color: [0.75, 0.75, 0.75],
      heightMm: -6,
    },
  ],
};
const scene = (id, camera, detail) => ({
  schemaVersion: 1,
  id,
  camera: { ...camera, focalLengthMm: 35 },
  look: {
    preset: 'day',
    sun: { azimuthDeg: 40, elevationDeg: 35, intensity: 1.5 },
    shadows: false,
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: { rock: { recipe: cliff, size: 512, ...(detail ? { detail } : {}) } },
  nodes: [{ id: 'ground', type: 'ground', size: [400, 400], material: 'rock' }],
});
const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
/** Mean luminance, and how much neighbouring pixels differ, over the middle of the frame. */
const measure = (img) => {
  const lum = (x, y) => {
    const i = (y * W + x) * 4;
    return 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
  };
  let sum = 0,
    steps = 0,
    n = 0;
  for (let y = H * 0.3; y < H * 0.7; y++)
    for (let x = W * 0.3; x < W * 0.7; x++, n++) {
      sum += lum(x, y);
      steps += Math.abs(lum(x + 1, y) - lum(x, y)) + Math.abs(lum(x, y + 1) - lum(x, y));
    }
  return { mean: +(sum / n).toFixed(1), grain: +(steps / n / 2).toFixed(2) };
};
const NEAR = { eye: [3, 1.2, 3], target: [3, 0, 2.2] },
  FAR = { eye: [3, 80, 3], target: [3, 0, 2.2] };
const DETAIL = { recipe: grain, meters: 1.5, albedo: 0.6, normal: 1 };
const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;
  report.near = {
    plain: measure(await render('near-plain', scene('near-plain', NEAR))),
    detailed: measure(await render('near-detail', scene('near-detail', NEAR, DETAIL))),
    colourOnly: measure(
      await render('near-colour', scene('near-colour', NEAR, { ...DETAIL, normal: 0 })),
    ),
    reliefOnly: measure(
      await render('near-relief', scene('near-relief', NEAR, { ...DETAIL, albedo: 0 })),
    ),
  };
  report.far = {
    plain: measure(await render('far-plain', scene('far-plain', FAR))),
    detailed: measure(await render('far-detail', scene('far-detail', FAR, DETAIL))),
  };
  const n = report.near,
    f = report.far;
  assert.ok(
    n.detailed.grain > n.plain.grain * 2 && n.detailed.grain > 1,
    `from a metre away the detail gives the floor grain (${n.detailed.grain} against ${n.plain.grain})`,
  );
  assert.ok(
    n.colourOnly.grain > n.plain.grain * 1.3,
    `its colour alone shows (${n.colourOnly.grain})`,
  );
  assert.ok(
    n.reliefOnly.grain > n.plain.grain * 1.3,
    `its relief alone shows (${n.reliefOnly.grain})`,
  );
  assert.ok(
    Math.abs(n.detailed.mean - n.plain.mean) < n.plain.mean * 0.12,
    `the floor keeps its overall brightness near (${n.detailed.mean} against ${n.plain.mean})`,
  );
  // Measured on an Apple M4: 0.61 on WebGL and 1.01 on WebGPU, against 4.41 near.
  // Why WebGPU keeps more of it at this distance was not looked into.
  assert.ok(
    f.detailed.grain < 1.5 && f.detailed.grain < n.detailed.grain * 0.25,
    `from 80 m up little of the detail is left (${f.detailed.grain}, ${n.detailed.grain} near; ${f.plain.grain} without it)`,
  );
  assert.ok(
    Math.abs(f.detailed.mean - f.plain.mean) < f.plain.mean * 0.08,
    `and the floor is as bright as without it (${f.detailed.mean} against ${f.plain.mean})`,
  );
  report.ok = true;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, ...report }, null, 2));
} catch (error) {
  report.ok = false;
  report.error = String(error?.message || error);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify({ out, ...report }, null, 2));
  process.exitCode = 1;
} finally {
  await host.close();
}
