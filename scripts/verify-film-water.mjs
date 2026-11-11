#!/usr/bin/env node
// Real-GPU check of the film `water` node and of model `placements`: the bed
// must show through shallow water and fade in deep water, the surface must
// mirror what stands above it at the mirrored position and nothing from
// below, shallow edges must foam, and every copy of a model must be drawn at
// its place. Desktop GPU evidence only (WebGL, or WebGPU through
// verify:film-webgpu); not mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { floorGlb, projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_WATER_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-water'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(path.join(assets, 'set'), { recursive: true });
fs.writeFileSync(path.join(assets, 'set', 'floor.glb'), floorGlb({ uv1: false }));
const W = 480,
  H = 270;
const EYE = [0, 5, 12],
  TARGET = [0, 0.5, 0];
const LEVEL = 1;
const look = {
  sky: [0, 0, 0],
  ambient: [0.6, 0.6, 0.6],
  sun: { azimuthDeg: 30, elevationDeg: 70, intensity: 1.5, color: [1, 1, 1] },
  shadows: false,
  grade: { exposure: 1, contrast: 1, saturation: 1, bloom: 0, ao: 0 },
};
const materials = {
  sand: { color: [0.75, 0.6, 0.3], roughness: 1 },
  lamp: { color: [0, 0, 0], emission: [6, 0.3, 0.1] },
  under: { color: [0, 0, 0], emission: [0.1, 6, 0.1] },
};
// A sand bed at y = 0, a sand shelf 10 cm under the surface on the left, a
// red lamp above the water at the back and a green one below the surface.
const scenery = [
  { id: 'bed', type: 'ground', size: [60, 60], material: 'sand' },
  { id: 'shelf', type: 'box', size: [5, LEVEL - 0.1, 8], position: [-4.5, 0, 0], material: 'sand' },
  { id: 'lamp', type: 'box', size: [1.2, 1.2, 1.2], position: [2.5, 3, -7], material: 'lamp' },
  { id: 'sunk', type: 'box', size: [1.2, 0.5, 1.2], position: [2.5, 0.2, -7], material: 'under' },
];
const water = (extra = {}) => ({
  id: 'river',
  type: 'water',
  position: [0, LEVEL, 0],
  size: [40, 40],
  flow: [0, 0],
  color: [0.02, 0.2, 0.25],
  clarity: 0.5,
  waves: 0,
  refraction: 0,
  foamDepth: 0,
  ...extra,
});
const scene = (nodes) => ({
  schemaVersion: 1,
  id: 'water-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look,
  materials,
  nodes,
});
const host = new ZhudaFilmHost({ assets });
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const patch = (img, [x, y]) => {
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => +(value / 25).toFixed(1));
};
const at = (point) => projectPixel(point, EYE, TARGET, W, H);
const SHELF = at([-4.5, LEVEL, 1]),
  DEEP = at([4, LEVEL, 3]),
  // Where the surface shows the lamp: under it, as far below the surface as the lamp is above.
  MIRRORED = at([2.5, 2 * LEVEL - 3.6, -7]);
const report = { pixels: { SHELF, DEEP, MIRRORED } };
try {
  await host.ready();
  // 1. Depth: without water the shelf and the bed are the same sand.
  const dry = await render('dry', scene(scenery));
  const wet = await render('water', scene([...scenery, water()]));
  report.dry = { shelf: patch(dry, SHELF), deep: patch(dry, DEEP) };
  report.water = { shelf: patch(wet, SHELF), deep: patch(wet, DEEP) };
  assert.ok(
    Math.abs(report.dry.shelf[0] - report.dry.deep[0]) < 25,
    `dry sand is even: ${report.dry.shelf} / ${report.dry.deep}`,
  );
  assert.ok(
    report.water.shelf[0] > report.dry.shelf[0] * 0.6,
    `the bed shows through 10 cm of water: ${report.water.shelf}`,
  );
  assert.ok(
    report.water.deep[0] < report.water.shelf[0] * 0.6,
    `a metre of water hides most of the bed: ${report.water.deep}`,
  );
  assert.ok(
    report.water.deep[1] > report.water.deep[0] * 1.3,
    `deep water takes the water colour (sand is redder than green): ${report.water.deep}`,
  );

  // 2. Mirror: the lamp above appears at the mirrored place; the green lamp
  // below the surface must not be mirrored.
  report.mirror = { with: patch(wet, MIRRORED) };
  const dull = await render('no-reflection', scene([...scenery, water({ reflection: 0 })]));
  report.mirror.without = patch(dull, MIRRORED);
  assert.ok(
    report.mirror.with[0] > report.mirror.without[0] + 25,
    `the surface mirrors the lamp: ${report.mirror.with} against ${report.mirror.without}`,
  );
  assert.ok(
    report.mirror.with[1] < report.mirror.with[0],
    `nothing from below the surface is mirrored: ${report.mirror.with}`,
  );

  // 3. Foam along the shallow shelf.
  const foamy = await render('foam', scene([...scenery, water({ foamDepth: 0.4, waves: 0.3 })]));
  const calm = await render('no-foam', scene([...scenery, water({ waves: 0.3 })]));
  let brighter = 0;
  for (let i = 0; i < foamy.data.length; i += 4)
    if (
      foamy.data[i] + foamy.data[i + 1] + foamy.data[i + 2] >
      calm.data[i] + calm.data[i + 1] + calm.data[i + 2] + 90
    )
      brighter++;
  report.foamPixels = brighter;
  assert.ok(brighter > 150, `foam brightens the shallows: ${brighter} pixels`);
  assert.ok(patch(foamy, DEEP)[0] < report.water.shelf[0], 'no foam over deep water');

  // 4. Flow: the waves move with shot time.
  const later = await host.preview(scene([...scenery, water({ waves: 0.4, flow: [0, 1] })]), {
    width: W,
    height: H,
    time: 2,
  });
  const sooner = await host.preview(scene([...scenery, water({ waves: 0.4, flow: [0, 1] })]), {
    width: W,
    height: H,
    time: 0,
  });
  assert.ok(!later.png.equals(sooner.png), 'the surface changes with time');

  // 5. Placements: three copies of one model, each at its own place.
  const places = [
    [-6, 0, -2, 0, 0.2],
    [0, 0, 2, 45, 0.3],
    [6, 0, -4, 0, 0.2],
  ];
  const copies = await render(
    'placements',
    scene([
      {
        id: 'tiles',
        type: 'model',
        asset: 'set/floor.glb',
        position: [0, 0.5, 0],
        placements: places,
      },
    ]),
  );
  report.placements = places.map(([x, , z]) => patch(copies, at([x, 0.5, z])));
  report.placementsBetween = patch(copies, at([3, 0.5, 0]));
  for (const colour of report.placements)
    assert.ok(Math.max(...colour) > 60, `a copy is drawn at its place: ${colour}`);
  assert.ok(Math.max(...report.placementsBetween) < 5, 'nothing between the copies');

  // 6. Thirty mounts with and without water, then the first frame again.
  for (let i = 0; i < 30; i++)
    await host.mountReport(scene(i % 2 ? [...scenery, water()] : scenery));
  assert.ok(
    (await render('water-again', scene([...scenery, water()]))).data.equals(wet.data),
    'identical after 30 mounts',
  );
  assert.ok(
    (await render('dry-again', scene(scenery))).data.equals(dry.data),
    'dry frame unchanged',
  );

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
