#!/usr/bin/env node
// Real WebGL check of a point light's `castsShadow`: a lamp over a floor with
// a wall and three boxes. Its light must stop at them (the floor behind each
// goes dark, in the direction away from the lamp) and stay everywhere else.
// Desktop GPU evidence only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_POINT_SHADOW_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-point-shadow'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 640,
  H = 360;
const EYE = [0, 14, 10],
  TARGET = [0, 0, 0],
  LAMP = [0, 3, 0];
const scene = (castsShadow) => ({
  schemaVersion: 1,
  id: 'point-shadow-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 24 },
  look: {
    sky: [0, 0, 0],
    ambient: [0.02, 0.02, 0.02],
    sun: { intensity: 0 },
    shadows: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: { grey: { color: [0.8, 0.8, 0.8], roughness: 1 } },
  nodes: [
    { id: 'floor', type: 'box', size: [30, 0.2, 30], position: [0, -0.2, 0], material: 'grey' },
    // A wall 5 m to -X, a box to +X, a box to -Z and a box that floats before the wall.
    { id: 'wall', type: 'box', size: [0.3, 4, 10], position: [-5, 0, 0], material: 'grey' },
    { id: 'east', type: 'box', size: [1, 1, 1], position: [2, 0, 0], material: 'grey' },
    { id: 'north', type: 'box', size: [1, 1, 1], position: [0, 0, -3], material: 'grey' },
    { id: 'floating', type: 'box', size: [1, 1, 1], position: [-2.5, 2, 1.5], material: 'grey' },
    {
      id: 'lamp',
      type: 'light',
      kind: 'point',
      position: LAMP,
      intensity: 6,
      range: 20,
      ...(castsShadow ? { castsShadow: true } : {}),
    },
  ],
});

/** Pinhole projection of a world point for the scene camera (24 mm on a 24 mm tall sensor). */
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
    f = 24 / 12;
  return [
    Math.round((0.5 + (dot(d, right) / depth) * f * (H / W) * 0.5) * W),
    Math.round((0.5 - (dot(d, up) / depth) * f * 0.5) * H),
  ];
}
// Where each caster's shadow must fall, worked out from the lamp through the caster.
const SHADOWED = {
  'floor beyond the east box': [3.2, 0, 0],
  'floor beyond the north box': [0, 0, -5],
  'wall behind the floating box': [-4.85, 2.03, 2.91],
  'floor behind the wall': [-7.5, 0, 0],
};
const LIT = {
  'floor to the south': [0, 0, 4.5],
  'floor to the north-west': [-3.2, 0, -2.5],
  'wall, the mirror of the shadowed place': [-4.85, 2.03, -2.91],
};
const read = (img, points) =>
  Object.fromEntries(
    Object.entries(points).map(([name, point]) => {
      const [x, y] = project(point);
      return [name, img.data[(y * W + x) * 4 + 1]];
    }),
  );

const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const report = {};
try {
  await host.ready();
  const plain = await render('plain', scene(false));
  const shadowed = await render('shadowed', scene(true));
  report.plain = { ...read(plain, SHADOWED), ...read(plain, LIT) };
  report.shadowed = { ...read(shadowed, SHADOWED), ...read(shadowed, LIT) };
  for (const name of Object.keys(SHADOWED)) {
    assert.ok(report.plain[name] > 60, `without shadows the lamp lights the ${name}`);
    assert.ok(report.shadowed[name] < 25, `with them the ${name} is dark`);
  }
  for (const name of Object.keys(LIT))
    assert.ok(
      Math.abs(report.shadowed[name] - report.plain[name]) <= 12,
      `the ${name} stays as it was`,
    );

  // Far from the lamp the floor is lit at a grazing angle: it must not shade
  // itself (stripes), and the edges of the cube's faces must not show.
  for (const [name, point] of [
    ['far floor, light grazing', [7, 0, -8]],
    ['floor across a seam of the pictures', [5, 0, 5]],
  ]) {
    const [cx, cy] = project(point);
    let worst = 0,
      sum = 0,
      count = 0;
    for (let y = cy - 12; y <= cy + 12; y++)
      for (let x = cx - 12; x <= cx + 12; x++) {
        const i = (y * W + x) * 4 + 1,
          d = Math.abs(shadowed.data[i] - plain.data[i]);
        worst = Math.max(worst, d);
        sum += d;
        count++;
      }
    report[name] = { mean: +(sum / count).toFixed(2), worst };
    assert.ok(sum / count <= 2 && worst <= 12, `the ${name} stays as it was`);
  }

  // Two lamps, each with a box beside it and out of the other's reach.
  const pair = (casting) => ({
    ...scene(false),
    id: 'point-shadow-pair',
    camera: { eye: [0, 16, 8], target: [0, 0, 0], focalLengthMm: 18 },
    nodes: [
      { id: 'floor', type: 'box', size: [40, 0.2, 40], position: [0, -0.2, 0], material: 'grey' },
      { id: 'west', type: 'box', size: [1, 1, 1], position: [-4, 0, 0], material: 'grey' },
      { id: 'east', type: 'box', size: [1, 1, 1], position: [4, 0, 0], material: 'grey' },
      ...[
        ['lamp-west', -6],
        ['lamp-east', 6],
      ].map(([id, x], i) => ({
        id,
        type: 'light',
        kind: 'point',
        position: [x, 3, 0],
        intensity: 6,
        range: 7,
        ...(casting[i] ? { castsShadow: true } : {}),
      })),
    ],
  });
  const both = await render('pair-both', pair([true, true]));
  const westOnly = await render('pair-west', pair([true, false]));
  const camera = { eye: [0, 16, 8], target: [0, 0, 0], f: 18 / 12 };
  const seen = (img, point) => {
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const dot = (a, b) => a.reduce((t, v, i) => t + v * b[i], 0);
    const unit = (a) => a.map((v) => v / Math.hypot(...a));
    const forward = unit(sub(camera.target, camera.eye));
    // forward × +Y
    const right = unit([-forward[2], 0, forward[0]]);
    const up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];
    const d = sub(point, camera.eye),
      depth = dot(d, forward);
    const x = Math.round((0.5 + (dot(d, right) / depth) * camera.f * (H / W) * 0.5) * W),
      y = Math.round((0.5 - (dot(d, up) / depth) * camera.f * 0.5) * H);
    return img.data[(y * W + x) * 4 + 1];
  };
  report.pair = {
    bothWest: seen(both, [-2.9, 0, 0]),
    bothEast: seen(both, [2.9, 0, 0]),
    westOnlyEast: seen(westOnly, [2.9, 0, 0]),
  };
  assert.ok(report.pair.bothWest < 25, 'with two lamps the first one shades the floor beyond its box');
  assert.ok(report.pair.bothEast < 25, 'and so does the second');
  assert.ok(report.pair.westOnlyEast > 60, 'the second lamp lights through its box when it does not cast');

  // Other scenes in between, then the first frame again.
  for (let i = 0; i < 4; i++) await host.mountReport(scene(i % 2 === 0));
  const again = await render('shadowed-again', scene(true));
  assert.ok(again.data.equals(shadowed.data), 'identical frame after other scenes were mounted');
  const back = await render('plain-again', scene(false));
  assert.ok(back.data.equals(plain.data), 'and a scene without the shadow is untouched by it');

  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
