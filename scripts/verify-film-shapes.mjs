#!/usr/bin/env node
// Real WebGL check of `lathe` and `extrude` nodes: a cylinder must be shaded
// as a round thing (its brightness changes steadily across it, where a box
// would be flat) and a raised outline must show a top and a side that differ.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_SHAPES_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-shapes'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 480,
  H = 270;
const EYE = [0, 1.6, 6],
  TARGET = [0.8, 0.6, 0];
const shapes = [
  {
    id: 'cylinder',
    type: 'lathe',
    profile: [
      [0.5, 0],
      [0.5, 1.6],
    ],
    segments: 32,
    position: [0, 0, 0],
    material: 'grey',
  },
  {
    id: 'block',
    type: 'extrude',
    outline: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    height: 0.6,
    position: [1.6, 0, 0],
    material: 'grey',
  },
];
const scene = (nodes) => ({
  schemaVersion: 1,
  id: 'shapes-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look: {
    sky: [0.2, 0.2, 0.2],
    ambient: [0.5, 0.5, 0.5],
    // From the camera's left and a little in front: the light falls off across the cylinder.
    sun: { azimuthDeg: 315, elevationDeg: 40, intensity: 1.2 },
    shadows: false,
    grade: { exposure: 1, bloom: 0, ao: 0 },
  },
  materials: { grey: { color: [0.8, 0.8, 0.8], roughness: 1 }, floor: { color: [0.2, 0.2, 0.2] } },
  nodes: [
    { id: 'floor', type: 'box', size: [30, 0.2, 30], position: [0, -0.2, 0], material: 'floor' },
    ...nodes,
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
const at = (img, point) => {
  const [x, y] = project(point);
  return img.data[(y * W + x) * 4 + 1];
};

const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = {};
try {
  await host.ready();
  const empty = await render('empty', scene([]));
  const frame = await render('shapes', scene(shapes));
  // Five places across the cylinder's front, at half its height.
  const across = [-0.4, -0.2, 0, 0.2, 0.4].map((x) => [x, 0.8, Math.sqrt(0.25 - x * x)]);
  report.cylinder = across.map((point) => at(frame, point));
  report.cylinderWithout = across.map((point) => at(empty, point));
  assert.ok(
    report.cylinder.every((value, i) => Math.abs(value - report.cylinderWithout[i]) > 15),
    'the cylinder is drawn where it stands',
  );
  const steps = report.cylinder.slice(1).map((value, i) => value - report.cylinder[i]);
  assert.ok(
    steps.every((step) => step > 2) || steps.every((step) => step < -2),
    'its brightness changes steadily from one side to the other: it is shaded as a round thing',
  );
  assert.ok(Math.abs(report.cylinder[4] - report.cylinder[0]) > 30, 'by a clear amount');

  report.block = {
    top: at(frame, [2.1, 0.6, 0.5]),
    front: at(frame, [2.1, 0.3, 1]),
    left: at(frame, [1.6, 0.3, 0.5]),
    topWithout: at(empty, [2.1, 0.6, 0.5]),
  };
  assert.ok(Math.abs(report.block.top - report.block.topWithout) > 15, 'the block is drawn');
  const { top, front, left } = report.block;
  // The sun stands at 45 degrees to both sides, so they match each other; the top does not.
  assert.ok(
    Math.abs(top - front) >= 4 && Math.abs(top - left) >= 4,
    'its top is lit differently from its sides: they face different ways',
  );
  assert.ok(
    Math.abs(front - at(empty, [2.1, 0.3, 1])) > 15 && Math.abs(left - at(empty, [1.6, 0.3, 0.5])) > 15,
    'and both sides are drawn',
  );

  const again = await render('shapes-again', scene(shapes));
  assert.ok(again.data.equals(frame.data), 'the same scene draws the same frame');
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
