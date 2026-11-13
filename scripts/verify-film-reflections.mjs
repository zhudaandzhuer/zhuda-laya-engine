#!/usr/bin/env node
// Real WebGL check of `look.screenReflections`: a lamp beside a wall must show
// in the wall at the mirrored position, and only with the reflections on.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_REFLECTIONS_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-reflections'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
const EYE = [0, 1.5, 4],
  TARGET = [-1.2, 1.5, -10];
// The wall's face toward the lamp is the plane x = -1.85.
const WALL_X = -1.85;
const scene = (screenReflections) => ({
  schemaVersion: 1,
  id: 'reflections-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look: {
    sky: [0, 0, 0],
    ambient: [0.02, 0.02, 0.02],
    sun: { intensity: 0 },
    shadows: false,
    grade: { exposure: 1, bloom: 0, ao: 0 },
    ...(screenReflections ? { screenReflections } : {}),
  },
  materials: {
    lamp: { color: [1, 0.9, 0.8], emission: [6, 5, 4] },
    wall: { color: [0.05, 0.05, 0.05], roughness: 0.5 },
  },
  nodes: [
    { id: 'wall', type: 'box', size: [0.3, 4, 24], position: [-2, 0, -6], material: 'wall' },
    // A lamp from y = 1.2 to 1.8, beside the wall.
    { id: 'lamp', type: 'box', size: [0.6, 0.6, 0.6], position: [1.5, 1.2, -8], material: 'lamp' },
  ],
});

/** Pinhole projection of a world point for the scene camera (35 mm on a 24 mm tall sensor). */
function project(point) {
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (a) => a.map((v) => v / Math.hypot(...a));
  const forward = unit(sub(TARGET, EYE)),
    right = unit(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const d = sub(point, EYE),
    depth = dot(d, forward),
    f = 35 / 12;
  return [
    Math.round((0.5 + (dot(d, right) / depth) * f * (H / W) * 0.5) * W),
    Math.round((0.5 - (dot(d, up) / depth) * f * 0.5) * H),
  ];
}
const patch = (img, [x, y]) => {
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => +(value / 25).toFixed(1));
};

const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const LAMP = project([1.5, 1.5, -8]),
  // The lamp's mirror image behind the wall; it shows where that line of sight meets the wall.
  MIRRORED = project([2 * WALL_X - 1.5, 1.5, -8]),
  // On the wall, nearer the camera and lower: no lamp is mirrored there.
  ASIDE = project([WALL_X, 0.4, -1]);
const report = { pixels: { LAMP, MIRRORED, ASIDE } };
try {
  await host.ready();
  const plain = await render('plain', scene());
  const wet = await render('reflections', scene({ strength: 2, wetness: 1, steps: 64 }));
  report.plain = { lamp: patch(plain, LAMP), mirrored: patch(plain, MIRRORED) };
  report.reflections = {
    lamp: patch(wet, LAMP),
    mirrored: patch(wet, MIRRORED),
    aside: patch(wet, ASIDE),
  };
  assert.ok(report.plain.lamp[0] > 200, 'the lamp is where the projection says');
  assert.ok(report.plain.mirrored[0] < 12, 'the wall is dark there without reflections');
  assert.ok(
    report.reflections.mirrored[0] > report.plain.mirrored[0] + 40,
    'the lamp shows in the wall at the mirrored position',
  );
  assert.ok(report.reflections.aside[0] < 12, 'and nowhere it is not mirrored');
  assert.deepEqual(report.reflections.lamp, report.plain.lamp, 'the lamp itself is unchanged');

  const off = await render('strength-0', scene({ strength: 0 }));
  report.off = patch(off, MIRRORED);
  assert.ok(report.off[0] < 12, 'strength 0 reflects nothing');

  // Other scenes in between, then the first frame again.
  for (let i = 0; i < 6; i++) await host.mountReport(scene(i % 2 ? { strength: 1 } : undefined));
  const again = await render('reflections-again', scene({ strength: 2, wetness: 1, steps: 64 }));
  assert.ok(again.data.equals(wet.data), 'identical frame after other scenes were mounted');

  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
