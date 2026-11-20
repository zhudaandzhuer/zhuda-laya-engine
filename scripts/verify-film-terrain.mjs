#!/usr/bin/env node
// Real draw check of a film scene's `terrain` node (createZhudaTerrainMesh)
// and of grass standing on it: the heights the scene query gives are the
// ones written, a hill of noise is the same for the same seed and level
// where it is flattened, the hill is in the picture where the query says it
// is, a box on it throws its shadow on the slope, and grass with `on` is
// green on the slope at the slope's height. Desktop GPU evidence only
// (WebGL, or WebGPU through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_TERRAIN_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-terrain'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 720,
  H = 405,
  LENS = 28;
const CAMERA = { eye: [0, 9, 34], target: [0, 3, 0] };
const base = (id, nodes, shadows = false) => ({
  schemaVersion: 1,
  id,
  camera: { ...CAMERA, focalLengthMm: LENS },
  look: {
    preset: 'day',
    sun: { azimuthDeg: 90, elevationDeg: 35, intensity: 1.3 },
    shadows: shadows ? { distance: 120, resolution: 2048, cascades: 2 } : false,
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: {
    earth: { color: [0.45, 0.3, 0.18], roughness: 1 },
    stone: { color: [0.6, 0.6, 0.62], roughness: 1 },
  },
  nodes,
});
// 4 by 2 cells over 40 by 20 m: a ramp rising along X to 8 m, level along Z.
const RAMP = {
  id: 'ramp',
  type: 'terrain',
  position: [0, 1, 0],
  size: [40, 20],
  cells: [4, 2],
  heights: [0, 2, 4, 6, 8, 0, 2, 4, 6, 8, 0, 2, 4, 6, 8],
  material: 'earth',
};
const HILLS = {
  id: 'hills',
  type: 'terrain',
  position: [0, 0, 0],
  size: [80, 80],
  cells: [96, 96],
  noise: {
    seed: 5,
    heightM: 14,
    scaleM: 30,
    flatten: [{ minX: -6, maxX: 6, minZ: -6, maxZ: 6, y: 3, marginM: 6 }],
  },
  material: 'earth',
};
const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const heights = async (s, places) =>
  (
    await host.raycast(
      s,
      places.map(([x, z]) => ({ origin: [x, 10000, z], direction: [0, -1, 0] })),
    )
  ).map((hit) => hit && +hit.position[1].toFixed(3));
const pixel = (img, point) => {
  const [x, y] = projectPixel(point, CAMERA.eye, CAMERA.target, W, H, LENS);
  const i = (y * W + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const earthy = ([r, g, b]) => r > b * 1.5 && r > g;
const green = ([r, g, b]) => g > r * 1.03 && g > b * 1.3;
const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;

  // Heights as written: corners, the middle of a cell, and nothing beyond the edge.
  const ramp = base('terrain-ramp', [RAMP]);
  report.ramp = await heights(ramp, [
    [-20 + 0.001, 0],
    [0, 0],
    [5, 3],
    [20 - 0.001, -9],
    [25, 0],
  ]);
  assert.deepEqual(
    report.ramp.map((y) => (y === null ? null : +y.toFixed(2))),
    [1, 5, 6, 9, null],
    'the ramp is where its heights put it',
  );

  // Noise: the same for the same seed, another for another, level where flattened.
  const hills = base('terrain-hills', [HILLS]);
  const places = [
    [-30, -30],
    [22, -14],
    [-15, 25],
    [0, 0],
    [5, -5],
    [35, 35],
    [-36, 10],
    [12, 30],
    [30, -34],
  ];
  const first = await heights(hills, places),
    again = await heights(base('terrain-hills-again', [HILLS]), places),
    other = await heights(
      base('terrain-hills-other', [{ ...HILLS, noise: { ...HILLS.noise, seed: 6 } }]),
      places,
    );
  report.hills = { first, other };
  assert.deepEqual(again, first, 'the same seed gives the same ground');
  assert.notDeepEqual(other.slice(0, 3), first.slice(0, 3), 'another seed gives other ground');
  assert.deepEqual([first[3], first[4]], [3, 3], 'the flattened plot is level at its height');
  const open = [...first.slice(0, 3), ...first.slice(5)];
  const spread = Math.max(...open) - Math.min(...open);
  assert.ok(spread > 2, `and the hills are hills (${spread.toFixed(2)} m between seven places)`);

  // The picture: the ramp's high end is drawn where the query says, against the sky.
  const picture = await render('ramp', ramp);
  report.drawn = {
    highEnd: pixel(picture, [19, 8.8, 0]),
    aboveIt: pixel(picture, [19, 12, 0]),
  };
  assert.ok(earthy(report.drawn.highEnd), 'the high end of the ramp is earth');
  assert.ok(!earthy(report.drawn.aboveIt), 'and above it is sky');

  // A box on the slope throws its shadow on it (the sun is in the east: the shadow falls west, downhill).
  const BOX = { id: 'post', type: 'box', size: [2, 6, 2], position: [10, 6, 0], material: 'stone' };
  const lit = await render('ramp-shadow-off', base('terrain-noshadow', [RAMP], true)),
    shaded = await render('ramp-shadow', base('terrain-shadow', [RAMP, BOX], true));
  const lum = (p) => p[0] + p[1] + p[2];
  const west = [5, 6.02, 0]; // the ramp there is at 6 m
  report.shadow = { without: lum(pixel(lit, west)), with: lum(pixel(shaded, west)) };
  assert.ok(
    report.shadow.with < report.shadow.without * 0.75,
    `the slope west of the box is in its shadow (${JSON.stringify(report.shadow)})`,
  );

  // Grass on the slope, at the slope's height.
  const meadow = {
    id: 'meadow',
    type: 'grass',
    on: 'ramp',
    area: { minX: -20, maxX: 20, minZ: -10, maxZ: 10 },
    density: 400,
  };
  const grown = await render('ramp-grass', base('terrain-grass', [RAMP, meadow]));
  const onSlope = [10, 7.15, 6]; // the ramp there is at 7 m
  report.grass = {
    bare: green(pixel(picture, onSlope)),
    grown: green(pixel(grown, onSlope)),
    low: green(pixel(grown, [-12, 2.75, 6])),
    offTheRamp: green(pixel(grown, [-26, 0.2, 6])),
  };
  assert.ok(!report.grass.bare, 'bare earth is not green');
  assert.ok(report.grass.grown && report.grass.low, 'grass stands on the slope, high and low');
  assert.ok(!report.grass.offTheRamp, 'and not beyond the terrain');
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await host.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
