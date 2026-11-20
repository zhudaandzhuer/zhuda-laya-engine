#!/usr/bin/env node
// Real WebGL check of what a film scene's model node says about distance and
// shadow: `cullMeters` (a copy beyond it is not drawn, from wherever the
// camera stands), `castShadow: false` (the model throws no shadow and is
// still drawn), and `cellMeters` beside `instanced` (the picture is the same
// whatever the size of the squares the copies are grouped by). Red posts
// stand on a pale floor at 15, 40 and 90 m; the model is generated here.
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu); not
// mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { projectPixel } from './lib/film-fixtures.mjs';

const out = path.resolve(
  process.env.FILM_MODEL_DISTANCE_EVIDENCE_DIR ||
    path.join(os.tmpdir(), 'zhuda-film-model-distance'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });

/** A red post, 1 m square and 4 m tall, standing on y = 0. */
function postGlb() {
  const w = 0.5,
    h = 4;
  const faces = [
    [
      [1, 0, 0],
      [w, 0, -w],
      [w, 0, w],
      [w, h, w],
      [w, h, -w],
    ],
    [
      [-1, 0, 0],
      [-w, 0, w],
      [-w, 0, -w],
      [-w, h, -w],
      [-w, h, w],
    ],
    [
      [0, 0, 1],
      [w, 0, w],
      [-w, 0, w],
      [-w, h, w],
      [w, h, w],
    ],
    [
      [0, 0, -1],
      [-w, 0, -w],
      [w, 0, -w],
      [w, h, -w],
      [-w, h, -w],
    ],
    [
      [0, 1, 0],
      [-w, h, -w],
      [w, h, -w],
      [w, h, w],
      [-w, h, w],
    ],
  ];
  const positions = [],
    normals = [],
    indices = [];
  faces.forEach(([normal, ...corners], f) => {
    for (const corner of corners) {
      positions.push(...corner);
      normals.push(...normal);
    }
    // Counter-clockwise seen from outside, as glTF has it.
    indices.push(f * 4, f * 4 + 2, f * 4 + 1, f * 4, f * 4 + 3, f * 4 + 2);
  });
  const parts = [new Float32Array(positions), new Float32Array(normals), new Uint16Array(indices)];
  const views = [];
  let offset = 0;
  for (const part of parts) {
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.byteLength });
    offset += part.byteLength;
  }
  const bin = Buffer.concat(parts.map((part) => Buffer.from(part.buffer)));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0, 0, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 20,
        type: 'VEC3',
        min: [-w, 0, -w],
        max: [w, h, w],
      },
      { bufferView: 1, componentType: 5126, count: 20, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 30, type: 'SCALAR' },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
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
fs.writeFileSync(path.join(assets, 'post.glb'), postGlb());

const W = 960,
  H = 540,
  LENS = 35;
/** The posts: left to right, nearer to further from the first camera. */
const POSTS = [
  [-4, 0, -15],
  [0, 0, -40],
  [9, 0, -90],
];
const FAR_EYE = [0, 3, 0],
  NEAR_EYE = [9, 3, -60];
const target = (eye) => [eye[0], 2, eye[2] - 100];
const scene = (eye, model) => ({
  schemaVersion: 1,
  id: 'model-distance',
  camera: { eye, target: target(eye), focalLengthMm: LENS },
  look: {
    preset: 'day',
    sun: { azimuthDeg: 90, elevationDeg: 40, intensity: 1.5 },
    shadows: { distance: 120, resolution: 2048, cascades: 2 },
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  },
  materials: { pale: { color: [0.8, 0.8, 0.78], roughness: 1 } },
  nodes: [
    { id: 'ground', type: 'ground', size: [600, 600], material: 'pale' },
    {
      id: 'posts',
      type: 'model',
      asset: 'post.glb',
      position: [0, 0, 0],
      placements: POSTS.map((p) => [...p, 0, 1]),
      ...model,
    },
  ],
});
const host = new ZhudaFilmHost({ assets });
const render = async (name, eye, model = {}) => {
  const { png } = await host.preview(scene(eye, model), { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
/** Clearly red pixels in a box round a post's middle, seen from `eye`. */
const redAt = (img, eye, post) => {
  const [cx, cy] = projectPixel([post[0], 2, post[2]], eye, target(eye), W, H, LENS);
  let n = 0;
  for (let y = Math.max(0, cy - 30); y < Math.min(H, cy + 30); y++)
    for (let x = Math.max(0, cx - 30); x < Math.min(W, cx + 30); x++) {
      const i = (y * W + x) * 4;
      if (img.data[i] > 80 && img.data[i] > 2.5 * Math.max(img.data[i + 1], img.data[i + 2])) n++;
    }
  return n;
};
/** Mean brightness of the floor where the first post's shadow falls (the sun is in the east: toward -x). */
const shadowAt = (img, eye) => {
  const [cx, cy] = projectPixel([POSTS[0][0] - 2.4, 0, POSTS[0][2]], eye, target(eye), W, H, LENS);
  let sum = 0,
    n = 0;
  for (let y = cy - 3; y <= cy + 3; y++)
    for (let x = cx - 3; x <= cx + 3; x++, n++) {
      const i = (y * W + x) * 4;
      sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    }
  return Math.round(sum / n);
};
const differing = (a, b, over = 8) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) > over ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > over ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > over
    )
      n++;
  return n;
};

const report = {};
try {
  await host.ready();
  report.gpu = host.info?.gpu;

  // 1. As it was: three posts, each with its shadow.
  const plain = await render('plain', FAR_EYE);
  report.plain = POSTS.map((post) => redAt(plain, FAR_EYE, post));
  report.plainShadow = shadowAt(plain, FAR_EYE);
  assert.ok(
    report.plain.every((n) => n > 20),
    `all three posts are drawn without a cull distance (${report.plain})`,
  );

  // 2. A cull distance of 60 m: the post at 90 m is gone from here and the others stay;
  //    from 30 m off it is drawn, and the two now behind and far are not.
  const culledFar = await render('cull-from-far', FAR_EYE, { cullMeters: 60 });
  report.culledFar = POSTS.map((post) => redAt(culledFar, FAR_EYE, post));
  assert.ok(report.culledFar[0] > 20 && report.culledFar[1] > 20, 'posts within 60 m stay');
  assert.equal(report.culledFar[2], 0, 'the post at 90 m is not drawn');
  const culledNear = await render('cull-from-near', NEAR_EYE, { cullMeters: 60 });
  report.culledNear = redAt(culledNear, NEAR_EYE, POSTS[2]);
  assert.ok(report.culledNear > 20, `the same post is drawn from 30 m (${report.culledNear})`);

  // 3. No shadow: the post is there, the floor beside it is as bright as open floor.
  const noShadow = await render('no-shadow', FAR_EYE, { castShadow: false });
  report.noShadow = {
    post: redAt(noShadow, FAR_EYE, POSTS[0]),
    floor: shadowAt(noShadow, FAR_EYE),
  };
  assert.ok(report.noShadow.post > 20, 'the post is still drawn');
  assert.ok(
    report.plainShadow < report.noShadow.floor - 25,
    `the shadow is on the floor by default (${report.plainShadow}) and gone with castShadow false (${report.noShadow.floor})`,
  );

  // 4. Instanced copies: the size of the squares changes no pixel worth naming, with a cull distance or without.
  const small = await render('cells-4', FAR_EYE, { instanced: true, cellMeters: 4 });
  const large = await render('cells-4000', FAR_EYE, { instanced: true, cellMeters: 4000 });
  report.cells = {
    againstNodes: differing(plain, small),
    smallAgainstLarge: differing(small, large),
  };
  assert.ok(
    report.cells.againstNodes < 40,
    `instanced copies draw the picture the nodes draw (${report.cells.againstNodes} pixels differ)`,
  );
  assert.ok(
    report.cells.smallAgainstLarge < 40,
    `squares of 4 m and of 4 km draw the same picture (${report.cells.smallAgainstLarge} pixels differ)`,
  );
  const cellsCulled = await render('cells-4-cull', FAR_EYE, {
    instanced: true,
    cellMeters: 4,
    cullMeters: 60,
  });
  report.cellsCulled = POSTS.map((post) => redAt(cellsCulled, FAR_EYE, post));
  assert.ok(report.cellsCulled[0] > 20 && report.cellsCulled[1] > 20, 'near groups stay');
  assert.equal(report.cellsCulled[2], 0, 'the group at 90 m is not drawn');

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
