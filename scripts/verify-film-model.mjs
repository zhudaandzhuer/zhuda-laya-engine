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

const out = path.resolve(
  process.env.FILM_MODEL_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-model'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(path.join(assets, 'set'), { recursive: true });

/** A 10 m square floor at y = 0, white and rough; optional second UV set. */
function floorGlb({ uv1 }) {
  const positions = [-5, 0, -5, -5, 0, 5, 5, 0, 5, 5, 0, -5];
  const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  // glTF UVs: (0,0) is the top-left texel. u follows +X, v follows +Z.
  const uv = [0, 0, 0, 1, 1, 1, 1, 0];
  const parts = [
    new Float32Array(positions),
    new Float32Array(normals),
    new Float32Array(uv),
    ...(uv1 ? [new Float32Array(uv)] : []),
    new Uint16Array([0, 1, 2, 0, 2, 3]),
  ];
  const views = [];
  let offset = 0;
  for (const part of parts) {
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.byteLength });
    offset += part.byteLength;
  }
  const bin = Buffer.concat(parts.map((part) => Buffer.from(part.buffer)));
  const accessor = (bufferView, type, extra = {}) => ({
    bufferView,
    componentType: 5126,
    count: 4,
    type,
    ...extra,
  });
  const attributes = { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 };
  if (uv1) attributes.TEXCOORD_1 = 3;
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'floor' }],
    meshes: [{ primitives: [{ attributes, indices: uv1 ? 4 : 3, material: 0 }] }],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors: [
      accessor(0, 'VEC3', { min: [-5, 0, -5], max: [5, 0, 5] }),
      accessor(1, 'VEC3'),
      accessor(2, 'VEC2'),
      ...(uv1 ? [accessor(3, 'VEC2')] : []),
      { bufferView: uv1 ? 4 : 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, data]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]);
}

/** Flat (not run-length encoded) Radiance HDR; `pixel(x, y)` returns linear RGB, top row first. */
function radianceHdr(size, pixel) {
  const body = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgb = pixel(x, y),
        max = Math.max(...rgb),
        o = (y * size + x) * 4;
      if (max < 1e-32) continue;
      const e = Math.ceil(Math.log2(max) + 1e-9),
        scale = 256 / Math.pow(2, e);
      for (let c = 0; c < 3; c++) body[o + c] = Math.min(255, Math.floor(rgb[c] * scale));
      body[o + 3] = e + 128;
    }
  return Buffer.concat([
    Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${size} +X ${size}\n`, 'latin1'),
    body,
  ]);
}
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
