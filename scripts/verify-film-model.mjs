#!/usr/bin/env node
// Real WebGL check of film model nodes and baked lightmaps (Laya's native
// lightmap path). The GLB models and the Radiance HDR lightmap are generated
// here; nothing is read from the repository. Desktop GPU evidence only; not
// WebGPU, mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { floorGlb, radianceHdr } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_MODEL_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-model'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(path.join(assets, 'set'), { recursive: true });

// Quadrants: top-left red, top-right green, bottom-left blue, bottom-right grey.
const QUADRANTS = [
  [0.5, 0, 0],
  [0, 0.5, 0],
  [0, 0, 0.5],
  [0.2, 0.2, 0.2],
];
const quadrant = (order) => (x, y) => order[(y < 32 ? 0 : 2) + (x < 32 ? 0 : 1)];
fs.writeFileSync(path.join(assets, 'set/floor.glb'), floorGlb({ uv1: true }));
fs.writeFileSync(path.join(assets, 'set/floor-no-uv1.glb'), floorGlb({ uv1: false }));
fs.writeFileSync(path.join(assets, 'set/floor.hdr'), radianceHdr(64, quadrant(QUADRANTS)));

const W = 320,
  H = 200;
// No sun and no ambient: without a lightmap the floor is black.
const dark = { sky: [0, 0, 0], ambient: [0, 0, 0], sun: { intensity: 0 }, shadows: false };
const scene = (model, look = dark) => ({
  schemaVersion: 1,
  id: 'model-check',
  camera: { eye: [0, 10, 6], target: [0, 0, 0], focalLengthMm: 35 },
  look,
  nodes: model ? [{ id: 'floor', type: 'model', position: [0, 0, 0], ...model }] : [],
});
const host = new ZhudaFilmHost({ assets });
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
/** Mean colour of a 9 x 9 patch at relative screen coordinates. */
const patch = (img, u, v) => {
  const sum = [0, 0, 0];
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const i = ((Math.round(v * H) + dy) * W + Math.round(u * W) + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => value / 81);
};
const SPOTS = [
  [0.3, 0.3],
  [0.7, 0.3],
  [0.3, 0.75],
  [0.7, 0.75],
];
const display = (linear) => 255 * Math.pow(linear, 1 / 2.2);
const report = {};
const expectQuadrants = (img, order, scale, label) => {
  report[label] = SPOTS.map(([u, v], i) => {
    const got = patch(img, u, v),
      want = order[i].map((value) => display(value * scale));
    for (let c = 0; c < 3; c++)
      assert.ok(
        Math.abs(got[c] - want[c]) <= 14,
        `${label} quadrant ${i} channel ${c}: got ${got[c].toFixed(1)}, want ${want[c].toFixed(1)}`,
      );
    return got.map((value) => +value.toFixed(1));
  });
};
try {
  await host.ready();
  assert.deepEqual(host.assetList().ids, [
    'set/floor-no-uv1.glb',
    'set/floor.glb',
    'set/floor.hdr',
  ]);

  // 1. The model is drawn: with ambient light the floor differs from an empty scene.
  const lit = { sky: [0, 0, 0], ambient: [0.5, 0.5, 0.5], sun: { intensity: 0 }, shadows: false };
  const empty = await render('empty', scene(null, lit));
  const drawn = await render('model-ambient', scene({ asset: 'set/floor.glb' }, lit));
  assert.ok(patch(empty, 0.5, 0.5)[0] < 2, 'empty scene is black');
  report.modelAmbient = patch(drawn, 0.5, 0.5).map((value) => +value.toFixed(1));
  assert.ok(report.modelAmbient[0] > 60, 'model drawn under ambient light');

  // 2. Without a lightmap and without lights the floor is black.
  const unlit = await render('model-dark', scene({ asset: 'set/floor.glb' }));
  assert.ok(patch(unlit, 0.5, 0.5)[0] < 2, 'no light, no lightmap: black');

  // 3. The lightmap lights the floor by its second UV set, at the encoded level.
  const mapped = { asset: 'set/floor.glb', lightmap: 'set/floor.hdr' };
  expectQuadrants(await render('lightmap', scene(mapped)), QUADRANTS, 1, 'lightmap');
  expectQuadrants(
    await render('lightmap-half', scene({ ...mapped, lightmapIntensity: 0.5 })),
    QUADRANTS,
    0.5,
    'lightmapHalf',
  );

  // 4. Position, yaw and scale: half scale leaves the frame edge unlit.
  const small = await render('lightmap-small', scene({ ...mapped, scale: 0.25 }));
  assert.ok(patch(small, 0.08, 0.5)[0] + patch(small, 0.08, 0.5)[2] < 4, 'scaled model is smaller');
  const turned = await render('lightmap-turned', scene({ ...mapped, yawDeg: 180 }));
  expectQuadrants(turned, [QUADRANTS[3], QUADRANTS[2], QUADRANTS[1], QUADRANTS[0]], 1, 'turned');

  // 4b. A direction picture scales the light by 0.5 * max(0, n . d) + 0.5:
  // the floor's normal is +Y, so +Y keeps the light, +X and -Y halve it.
  const DIRECTIONS = [
    [0, 1, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0.6, 0.8, 0],
  ];
  fs.writeFileSync(
    path.join(assets, 'set/floor-direction.hdr'),
    radianceHdr(64, (x, y) =>
      DIRECTIONS[(y < 32 ? 0 : 2) + (x < 32 ? 0 : 1)].map((v) => v * 0.5 + 0.5),
    ),
  );
  const directed = await render(
    'lightmap-direction',
    scene({ ...mapped, lightmapDirection: 'set/floor-direction.hdr' }),
  );
  report.direction = SPOTS.map(([u, v], i) => {
    const factor = 0.5 * Math.max(0, DIRECTIONS[i][1]) + 0.5;
    const got = patch(directed, u, v),
      want = QUADRANTS[i].map((value) => display(value * factor));
    for (let c = 0; c < 3; c++)
      assert.ok(
        Math.abs(got[c] - want[c]) <= 14,
        `direction quadrant ${i} channel ${c}: got ${got[c].toFixed(1)}, want ${want[c].toFixed(1)}`,
      );
    return got.map((value) => +value.toFixed(1));
  });

  // 5. Failures are reported, and the host keeps working afterwards.
  await assert.rejects(
    host.preview(scene({ asset: 'set/missing.glb' }), { width: W, height: H }),
    /model floor: cannot load set\/missing\.glb/,
  );
  await assert.rejects(
    host.preview(scene({ asset: 'set/floor-no-uv1.glb', lightmap: 'set/floor.hdr' }), {
      width: W,
      height: H,
    }),
    /TEXCOORD_1/,
  );
  await assert.rejects(
    host.preview(scene({ asset: 'set/floor.glb', lightmap: 'set/floor.glb' }), {
      width: W,
      height: H,
    }),
    /lightmap/,
  );

  // 6. 30 mount cycles: no instance is left behind and the cache does not grow.
  let last;
  for (let i = 0; i < 30; i++) {
    last = await host.mountReport(
      scene(i % 2 ? mapped : { asset: 'set/floor.glb' }, i % 3 ? dark : lit),
    );
    assert.equal(last.assetCache.instances, 1, `cycle ${i}: one live instance`);
  }
  report.cycles = last.assetCache;
  const after = await host.mountReport(scene(null, lit));
  assert.equal(after.assetCache.instances, 0, 'no instance after the model is removed');
  expectQuadrants(
    await render('lightmap-after-cycles', scene(mapped)),
    QUADRANTS,
    1,
    'afterCycles',
  );

  // 7. A lightmap rewritten on disk is picked up by the next mount.
  const swapped = [QUADRANTS[1], QUADRANTS[0], QUADRANTS[3], QUADRANTS[2]];
  fs.writeFileSync(path.join(assets, 'set/floor.hdr'), radianceHdr(64, quadrant(swapped)));
  expectQuadrants(await render('lightmap-rewritten', scene(mapped)), swapped, 1, 'rewritten');

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
