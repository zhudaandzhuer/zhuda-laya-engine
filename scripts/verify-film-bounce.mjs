#!/usr/bin/env node
// Real WebGL check of `look.bounceLight`: a white cube beside a sunlit red
// wall. Its face toward the wall is in shadow; with flat ambient light it is
// grey, with light bounced off the wall it turns red. The face toward the sun
// keeps its light, and the same scene draws the same frame after others.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_BOUNCE_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-bounce'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
const EYE = [-1.6, 1.1, 3.2],
  TARGET = [-0.4, 0.5, 0];
const scene = (bounceLight) => ({
  schemaVersion: 1,
  id: 'bounce-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 24 },
  look: {
    sky: [0.5, 0.6, 0.75],
    ambient: [0.5, 0.5, 0.5],
    // The light travels toward -X: it falls on the wall's face toward the cube.
    sun: { azimuthDeg: 90, elevationDeg: 30, intensity: 1.6 },
    shadows: { distance: 20, resolution: 2048 },
    grade: { exposure: 1, bloom: 0, ao: 0 },
    ...(bounceLight ? { bounceLight } : {}),
  },
  materials: {
    red: { color: [0.9, 0.1, 0.08], roughness: 1 },
    white: { color: [0.85, 0.85, 0.85], roughness: 1 },
    floor: { color: [0.4, 0.4, 0.4], roughness: 1 },
  },
  nodes: [
    { id: 'floor', type: 'box', size: [30, 0.2, 30], position: [0, -0.2, 0], material: 'floor' },
    { id: 'wall', type: 'box', size: [0.3, 3, 6], position: [-2, 0, 0], material: 'red' },
    { id: 'cube', type: 'box', size: [1, 1, 1], position: [0, 0, 0], material: 'white' },
  ],
});

/** Pinhole projection of a world point for the scene camera (24 mm on a 24 mm tall sensor). */
function project(point) {
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const unit = (a) => a.map((v) => v / Math.hypot(...a));
  const forward = unit(sub(TARGET, EYE));
  // forward × +Y
  const right = unit([-forward[2], 0, forward[0]]);
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  const d = sub(point, EYE),
    depth = dot(d, forward);
  return [
    Math.round((0.5 + (dot(d, right) / depth) * 2 * (H / W) * 0.5) * W),
    Math.round((0.5 - (dot(d, up) / depth) * 2 * 0.5) * H),
  ];
}
const patch = (img, point) => {
  const [x, y] = project(point);
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((v) => Math.round(v / 25));
};
const FACING_WALL = [-0.5, 0.5, 0.15],
  TOP = [-0.2, 1, 0.2];

const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = {};
try {
  await host.ready();
  const flat = await render('flat', scene());
  const bounced = await render('bounced', scene({ spacing: 1.5 }));
  report.flat = { facingWall: patch(flat, FACING_WALL), top: patch(flat, TOP) };
  report.bounced = { facingWall: patch(bounced, FACING_WALL), top: patch(bounced, TOP) };
  const [r0, g0] = report.flat.facingWall,
    [r1, g1] = report.bounced.facingWall;
  assert.ok(Math.abs(r0 - g0) < 10, 'with flat ambient light the shaded face is grey');
  assert.ok(r1 > r0 + 40 && r1 > g1 * 2, 'light bounced off the red wall turns it red');
  assert.ok(
    report.bounced.top.every((v) => v > 120),
    'the face toward the sun keeps its light',
  );

  const weak = await render('bounced-weak', scene({ spacing: 1.5, strength: 0.5 }));
  report.weak = { facingWall: patch(weak, FACING_WALL) };
  assert.ok(report.weak.facingWall[0] < r1 - 20, 'strength scales the bounced light');

  // Other scenes in between, then the first frame again.
  for (let i = 0; i < 3; i++) await host.mountReport(scene(i % 2 ? undefined : { spacing: 3 }));
  const again = await render('bounced-again', scene({ spacing: 1.5 }));
  assert.ok(again.data.equals(bounced.data), 'identical frame after other scenes were mounted');
  const flatAgain = await render('flat-again', scene());
  assert.ok(flatAgain.data.equals(flat.data), 'and a scene without it is untouched by it');

  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
