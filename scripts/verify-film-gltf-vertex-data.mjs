#!/usr/bin/env node
// Real WebGL check of glTF vertex data as model nodes draw it:
// - COLOR_0 is linear (glTF 2.0): a square coloured by COLOR_0 = linear(0.6) must look like one
//   whose material colour is linear(0.6). LayaAir's shader raises vertex colours to 2.2 (it takes
//   them as display values), so the loader hands them over raised to 1/2.2.
// - The primitives of one mesh are packed into one vertex buffer laid out as the first one's. A
//   second primitive without the first one's COLOR_0 must still draw, skinned (its weights must
//   not land in the colour slot) and not (its colour slot must not be left black).
// Desktop GPU evidence only (WebGL, or WebGPU through verify:film-webgpu); not mobile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_GLTF_VERTEX_EVIDENCE_DIR ||
    path.join(os.tmpdir(), 'zhuda-film-gltf-vertex-data'),
);
fs.rmSync(out, { recursive: true, force: true });
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });

/** A .glb of quads, one primitive each: { positions, colour? (COLOR_0 value), material: [r, g, b] }. */
function glb(parts, { skinned = false } = {}) {
  const chunks = [],
    views = [],
    accessors = [];
  let offset = 0;
  const add = (typed, type, componentType, bounds) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = Buffer.alloc((4 - (bytes.length % 4)) % 4);
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes, pad);
    offset += bytes.length + pad.length;
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const accessor = { bufferView: views.length - 1, componentType, count: typed.length / n, type };
    if (bounds) {
      accessor.min = [0, 1, 2].map((k) => Math.min(...[...typed].filter((_, i) => i % 3 === k)));
      accessor.max = [0, 1, 2].map((k) => Math.max(...[...typed].filter((_, i) => i % 3 === k)));
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };
  const primitives = parts.map((part, i) => {
    const attributes = {
      POSITION: add(new Float32Array(part.positions), 'VEC3', 5126, true),
      NORMAL: add(
        new Float32Array(12).fill(0).map((_, k) => (k % 3 === 2 ? 1 : 0)),
        'VEC3',
        5126,
      ),
    };
    if (part.colour !== undefined)
      attributes.COLOR_0 = add(
        new Float32Array(16).map((_, k) => (k % 4 === 3 ? 1 : part.colour)),
        'VEC4',
        5126,
      );
    if (skinned) {
      attributes.JOINTS_0 = add(new Uint8Array(16), 'VEC4', 5121);
      attributes.WEIGHTS_0 = add(
        new Float32Array(16).map((_, k) => (k % 4 === 0 ? 1 : 0)),
        'VEC4',
        5126,
      );
    }
    return {
      attributes,
      indices: add(new Uint16Array([0, 1, 2, 0, 2, 3]), 'SCALAR', 5123),
      material: i,
    };
  });
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: skinned ? [0, 1] : [0] }],
    nodes: [{ mesh: 0, ...(skinned ? { skin: 0 } : {}) }, ...(skinned ? [{ name: 'root' }] : [])],
    meshes: [{ primitives }],
    ...(skinned
      ? {
          skins: [
            {
              joints: [1],
              inverseBindMatrices: add(
                new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
                'MAT4',
                5126,
              ),
            },
          ],
        }
      : {}),
    materials: parts.map((part) => ({
      pbrMetallicRoughness: {
        baseColorFactor: [...part.material, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      doubleSided: true,
    })),
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors,
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(data.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, data]);
  };
  return Buffer.concat([head, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]);
}
const quad = (x, y, w, h) => [x, y, 0, x + w, y, 0, x + w, y + h, 0, x, y + h, 0];
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// 1. Colour: A by material, B by COLOR_0, the same linear grey.
fs.writeFileSync(
  path.join(assets, 'factor.glb'),
  glb([{ positions: quad(-0.5, 0, 1, 1), material: [linear(0.6), linear(0.6), linear(0.6)] }]),
);
fs.writeFileSync(
  path.join(assets, 'vertex.glb'),
  glb([{ positions: quad(-0.5, 0, 1, 1), colour: linear(0.6), material: [1, 1, 1] }]),
);
// 2. Two primitives, the first with COLOR_0 (white: it changes nothing), the second without.
const pair = [
  { positions: quad(-1.3, 0, 0.6, 1), colour: 1, material: [1, 0, 0] },
  { positions: quad(0.7, 0, 0.6, 1), material: [0, 1, 0] },
];
fs.writeFileSync(path.join(assets, 'pair-static.glb'), glb(pair));
fs.writeFileSync(path.join(assets, 'pair-skinned.glb'), glb(pair, { skinned: true }));

const W = 480,
  H = 200;
const host = new ZhudaFilmHost({ assets });
const report = {};
const flat = (nodes) => ({
  schemaVersion: 1,
  id: 'gltf-vertex-data',
  camera: { eye: [0, 0.5, 4], target: [0, 0.5, 0], focalLengthMm: 35 },
  look: {
    sky: [0, 0, 0],
    ambient: [1, 1, 1],
    sun: { intensity: 0 },
    shadows: false,
    fog: false,
    grade: { toneMapping: 'none', bloom: 0, ao: 0, antialias: 'none' },
  },
  nodes,
});
const render = async (name, scene) => {
  const { png } = await host.preview(scene, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const middle = (img) => {
  const i = (Math.round(H * 0.45) * W + W / 2) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const count = (img, test) => {
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4)
    if (test(img.data[i], img.data[i + 1], img.data[i + 2])) n++;
  return n;
};
try {
  await host.ready();
  report.factor = middle(
    await render(
      'factor',
      flat([{ id: 'a', type: 'model', asset: 'factor.glb', position: [0, 0, 0] }]),
    ),
  );
  report.vertex = middle(
    await render(
      'vertex',
      flat([{ id: 'b', type: 'model', asset: 'vertex.glb', position: [0, 0, 0] }]),
    ),
  );
  for (const kind of ['static', 'skinned']) {
    const img = await render(
      `pair-${kind}`,
      flat([{ id: 'p', type: 'model', asset: `pair-${kind}.glb`, position: [0, 0, 0] }]),
    );
    report[kind] = {
      red: count(img, (r, g, b) => r > 100 && g < 40 && b < 40),
      green: count(img, (r, g, b) => g > 100 && r < 40 && b < 40),
    };
  }
  console.log(JSON.stringify(report));
  assert.ok(
    Math.abs(report.factor[0] - report.vertex[0]) <= 6,
    `COLOR_0 is linear: a vertex colour of linear(0.6) draws ${report.vertex} where the same material colour draws ${report.factor}`,
  );
  for (const kind of ['static', 'skinned']) {
    assert.ok(
      report[kind].red > 1000,
      `control: the first primitive of the ${kind} pair draws (${report[kind].red} red pixels)`,
    );
    assert.ok(
      report[kind].green > report[kind].red * 0.8,
      `the second primitive of the ${kind} pair, without the first one's COLOR_0, draws: ${report[kind].green} green pixels against ${report[kind].red} red`,
    );
  }
  report.glErrors = host.takeGlErrors();
  assert.deepEqual(report.glErrors, [], 'glTF vertex data raises no WebGL error');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: false, gpu: host.info?.gpu, out, ...report }, null, 2));
  throw error;
} finally {
  await host.close();
}
