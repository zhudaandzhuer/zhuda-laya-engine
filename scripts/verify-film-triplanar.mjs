#!/usr/bin/env node
// Real draw check of a recipe material's `projection: 'triplanar'` and `top`
// (createZhudaTriplanarMaterial). On a cone, whose own texture coordinates
// squeeze the recipe toward the tip, triplanar keeps the stripes' width; on
// a wall and on level ground it gives the same picture as the default; a `top`
// recipe colours the top of a block and leaves its sides. Desktop GPU
// evidence only (WebGL, or WebGPU through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_TRIPLANAR_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-triplanar'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const W = 720,
  H = 405,
  LENS = 35;
// Black and white stripes, four to the metre; and a plain green.
const STRIPES = {
  schemaVersion: 1,
  id: 'tri-stripes',
  tileMeters: [1, 1],
  seed: 1,
  base: { color: [0.9, 0.9, 0.9], roughness: 0.9, metallic: 0 },
  layers: [
    {
      mask: { type: 'stripes', axis: 'u', count: 2, profile: 'square', duty: 0.5 },
      color: [0.05, 0.05, 0.05],
    },
  ],
};
const MOSS = {
  schemaVersion: 1,
  id: 'tri-moss',
  tileMeters: [1, 1],
  seed: 2,
  base: { color: [0.1, 0.7, 0.1], roughness: 1, metallic: 0 },
  layers: [],
};
const look = {
  preset: 'day',
  sun: { azimuthDeg: 20, elevationDeg: 50, intensity: 1.2 },
  shadows: false,
  fog: false,
  grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
};
const scene = (id, camera, material, nodes) => ({
  schemaVersion: 1,
  id,
  camera: { ...camera, focalLengthMm: LENS },
  look,
  materials: { subject: material, earth: { color: [0.3, 0.3, 0.3], roughness: 1 } },
  nodes,
});
const host = new ZhudaFilmHost({});
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const luma = (img, x, y) => {
  const i = (y * W + x) * 4;
  return (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
};
/** Changes between light and dark along a row of the picture. */
const edges = (img, y, x0, x1) => {
  let n = 0,
    last = luma(img, x0, y) > 110;
  for (let x = x0 + 1; x <= x1; x++) {
    const now = luma(img, x, y) > 110;
    if (now !== last) n++;
    last = now;
  }
  return n;
};
const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;
  // A box's own coordinates are in metres already: on a wall the two agree.
  const WALL_CAM = { eye: [0, 1.5, 9], target: [0, 1.5, 0] };
  const wall = (material) =>
    scene('tri-wall', WALL_CAM, material, [
      { id: 'ground', type: 'ground', size: [60, 60], material: 'earth' },
      { id: 'wall', type: 'box', size: [8, 3, 0.4], position: [0, 0, 0], material: 'subject' },
    ]);
  const [l] = projectPixel([-3.9, 1.5, 0.2], WALL_CAM.eye, WALL_CAM.target, W, H, LENS),
    [r, row] = projectPixel([3.9, 1.5, 0.2], WALL_CAM.eye, WALL_CAM.target, W, H, LENS);
  const plain = await render('wall-uv', wall({ recipe: STRIPES }));
  const tri = await render('wall-triplanar', wall({ recipe: STRIPES, projection: 'triplanar' }));
  report.wall = { uv: edges(plain, row, l, r), triplanar: edges(tri, row, l, r) };
  // 7.8 m of wall at two stripes a metre: about 31 changes.
  assert.ok(
    report.wall.triplanar >= 28 && report.wall.triplanar <= 34,
    `triplanar shows the recipe at its true size (${report.wall.triplanar} changes in 7.8 m)`,
  );

  // A cone: its own coordinates run round it, so the stripes are as many near
  // the tip as at the foot and get narrower (the recipe is squeezed). By
  // place in the world they keep their width, so half the width shows half as many.
  const CONE_CAM = { eye: [0, 1.5, 12], target: [0, 1.5, 0] };
  const cone = (material) =>
    scene('tri-cone', CONE_CAM, material, [
      { id: 'ground', type: 'ground', size: [60, 60], material: 'earth' },
      {
        id: 'cone',
        type: 'lathe',
        profile: [
          [3, 0],
          [1, 3],
        ],
        segments: 64,
        position: [0, 0, 0],
        material: 'subject',
      },
    ]);
  const across = (img, y, radius) => {
    // The middle half of the silhouette, where the surface faces the camera.
    const [x0, py] = projectPixel(
        [-radius * 0.5, y, radius * 0.85],
        CONE_CAM.eye,
        CONE_CAM.target,
        W,
        H,
        LENS,
      ),
      [x1] = projectPixel(
        [radius * 0.5, y, radius * 0.85],
        CONE_CAM.eye,
        CONE_CAM.target,
        W,
        H,
        LENS,
      );
    return edges(img, py, x0, x1);
  };
  const coneUv = await render('cone-uv', cone({ recipe: STRIPES })),
    coneTri = await render('cone-triplanar', cone({ recipe: STRIPES, projection: 'triplanar' }));
  const low = [0.5, 3 - (2 * 0.5) / 3],
    high = [2.5, 3 - (2 * 2.5) / 3];
  report.cone = {
    uv: { foot: across(coneUv, ...low), nearTip: across(coneUv, ...high) },
    triplanar: { foot: across(coneTri, ...low), nearTip: across(coneTri, ...high) },
  };
  const c = report.cone;
  assert.ok(
    c.triplanar.foot >= c.triplanar.nearTip * 1.6,
    `triplanar: half the width shows about half the stripes (${JSON.stringify(c.triplanar)})`,
  );
  assert.ok(
    c.uv.foot < c.uv.nearTip * 1.3,
    `the cone's own coordinates squeeze as many stripes into the narrow part (${JSON.stringify(c.uv)})`,
  );

  // Level ground from above: the two projections agree.
  const TOP_CAM = { eye: [0.01, 12, 0], target: [0, 0, 0] };
  const floor = (material) =>
    scene('tri-floor', TOP_CAM, material, [
      { id: 'ground', type: 'ground', size: [60, 60], material: 'subject' },
    ]);
  const a = await render('floor-uv', floor({ recipe: STRIPES })),
    b = await render('floor-triplanar', floor({ recipe: STRIPES, projection: 'triplanar' }));
  let differ = 0,
    sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.abs(a.data[i] - b.data[i]);
    sum += d;
    if (d > 40) differ++;
  }
  report.floor = {
    differingShare: +(differ / (W * H)).toFixed(4),
    meanDifference: +(sum / (W * H)).toFixed(2),
  };
  assert.ok(
    report.floor.differingShare < 0.06,
    `on level ground triplanar matches the default (${report.floor.differingShare} of pixels differ)`,
  );

  // A top recipe: green on the block's top, the stripes on its side.
  const BLOCK_CAM = { eye: [5, 5, 7], target: [0, 1, 0] };
  const block = await render(
    'block-top',
    scene(
      'tri-top',
      BLOCK_CAM,
      { recipe: STRIPES, projection: 'triplanar', top: { recipe: MOSS } },
      [
        { id: 'ground', type: 'ground', size: [60, 60], material: 'earth' },
        { id: 'block', type: 'box', size: [3, 2, 3], position: [0, 0, 0], material: 'subject' },
      ],
    ),
  );
  const green = (point) => {
    const [x, y] = projectPixel(point, BLOCK_CAM.eye, BLOCK_CAM.target, W, H, LENS);
    const i = (y * W + x) * 4;
    return block.data[i + 1] > block.data[i] * 1.5 && block.data[i + 1] > block.data[i + 2] * 1.5;
  };
  report.top = {
    onTop: green([0, 2, 0]),
    onSide: green([0.4, 1, 1.5]),
    onOtherSide: green([1.5, 1, 0.4]),
  };
  assert.ok(report.top.onTop, 'the top recipe covers the top');
  assert.ok(!report.top.onSide && !report.top.onOtherSide, 'and leaves the sides');
  report.glErrors = await host.glErrors?.();
  assert.deepEqual(report.glErrors ?? [], [], 'no graphics errors');
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
