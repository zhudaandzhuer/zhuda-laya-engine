#!/usr/bin/env node
// Shades the inside of a tree's crown: the leaves deep in a crown and under it
// see little of the sky and are darker than the leaves on its outside, but a
// leaf card is lit alone, so a model's crown is as bright inside as out and
// reads as flat. This writes a vertex colour (glTF COLOR_0, which LayaAir's
// glTF material multiplies into the base colour) on the cut-out (MASK)
// primitives of a model: an ellipsoid is fitted round all its leaves, and a
// leaf is darker the nearer it is to the middle of the ellipsoid and the lower
// it hangs in it. Nothing else of the file changes. Positions are read as the
// meshes store them (node transforms are not applied): one tree, shrub or
// bush to a file. Build-time only.
//
// usage: zhuda-laya-crown <model.glb> [--floor 0.45] [--under 0.75] [--out <file>]
import fs from 'node:fs';
import path from 'node:path';
import { readGlb, writeGlb } from './model-lod.mjs';
import { cliMain } from './cli.mjs';

const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const READ = {
  5126: ['getFloat32', 4],
  5125: ['getUint32', 4],
  5123: ['getUint16', 2],
  5121: ['getUint8', 1],
};

function positionsOf(json, bin, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const [get, size] = READ[accessor.componentType] ?? [];
  if (accessor.type !== 'VEC3' || get !== 'getFloat32')
    throw Error('positions: float VEC3 expected');
  const stride = view.byteStride || 12,
    start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float32Array(accessor.count * 3);
  for (let i = 0; i < accessor.count; i++)
    for (let c = 0; c < 3; c++) out[i * 3 + c] = data[get](start + i * stride + c * size, true);
  return out;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The 98th percentile of a list (robust to a stray leaf). */
function high(values) {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
}

/**
 * How much sky light a leaf at `p` gets in a crown `crown`: `floor` deep in
 * the middle up to 1 on the outside, times `under` (at the bottom of the crown)
 * up to 1 (at the top). Pure.
 */
export function zhudaCrownLight(p, crown, { floor = 0.45, under = 0.75 } = {}) {
  const [cx, cy, cz] = crown.centre,
    [rx, ry, rz] = crown.radii;
  const r = Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry, (p[2] - cz) / rz);
  const outside = smooth(0.25, 1, r);
  const up = Math.min(1, Math.max(0, (p[1] - (cy - ry)) / (2 * ry)));
  return (floor + (1 - floor) * outside) * (under + (1 - under) * up);
}

/** The ellipsoid round a set of points: the middle of their box, the 98th percentile of their reach. */
export function zhudaFitCrown(positions) {
  const n = positions.length / 3;
  if (!n) throw Error('no leaves to fit a crown to');
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++) {
      lo[c] = Math.min(lo[c], positions[i * 3 + c]);
      hi[c] = Math.max(hi[c], positions[i * 3 + c]);
    }
  const centre = lo.map((v, c) => (v + hi[c]) / 2);
  const radii = [0, 1, 2].map((c) => {
    const reach = new Float32Array(n);
    for (let i = 0; i < n; i++) reach[i] = Math.abs(positions[i * 3 + c] - centre[c]);
    return Math.max(1e-3, high(reach));
  });
  return { centre, radii };
}

/**
 * Adds a crown's shade to a model's cut-out primitives as COLOR_0 (unsigned
 * bytes, normalised; grey, opaque). Primitives that already have a vertex
 * colour are left alone. Returns the new file and what was shaded.
 */
export function shadeCrownGlb(bytes, options = {}) {
  const { json, bin } = readGlb(bytes);
  const leaves = [];
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives)
      if (
        json.materials?.[primitive.material]?.alphaMode === 'MASK' &&
        primitive.attributes.COLOR_0 === undefined
      )
        leaves.push(primitive);
  if (!leaves.length) return { glb: Buffer.from(bytes), report: { primitives: 0, vertices: 0 } };
  const all = leaves.map((primitive) => positionsOf(json, bin, primitive.attributes.POSITION));
  const joined = new Float32Array(all.reduce((sum, p) => sum + p.length, 0));
  all.reduce((at, p) => (joined.set(p, at), at + p.length), 0);
  const crown = zhudaFitCrown(joined);
  const extra = [];
  let length = bin.length,
    vertices = 0,
    darkest = 1;
  for (const [k, primitive] of leaves.entries()) {
    const p = all[k];
    const count = p.length / 3;
    const colour = Buffer.alloc(count * 4);
    for (let i = 0; i < count; i++) {
      const light = zhudaCrownLight([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], crown, options);
      darkest = Math.min(darkest, light);
      const v = Math.round(light * 255);
      colour.writeUInt8(v, i * 4);
      colour.writeUInt8(v, i * 4 + 1);
      colour.writeUInt8(v, i * 4 + 2);
      colour.writeUInt8(255, i * 4 + 3);
    }
    const pad = (4 - (length % 4)) % 4;
    extra.push(Buffer.alloc(pad), colour);
    json.bufferViews.push({
      buffer: 0,
      byteOffset: length + pad,
      byteLength: colour.length,
      byteStride: 4,
      target: 34962,
    });
    json.accessors.push({
      bufferView: json.bufferViews.length - 1,
      componentType: 5121,
      normalized: true,
      count,
      type: 'VEC4',
    });
    primitive.attributes.COLOR_0 = json.accessors.length - 1;
    length += pad + colour.length;
    vertices += count;
  }
  json.buffers[0].byteLength = length;
  return {
    glb: writeGlb(json, Buffer.concat([bin, ...extra])),
    report: { primitives: leaves.length, vertices, crown, darkest: +darkest.toFixed(3) },
  };
}

async function main(argv) {
  const file = argv.find((a) => a.endsWith('.glb'));
  if (!file)
    throw Error('usage: zhuda-laya-crown MODEL.glb [--floor 0.45] [--under 0.75] [--out FILE]');
  const value = (name, fallback) =>
    argv.includes(name) ? Number(argv[argv.indexOf(name) + 1]) : fallback;
  const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : file;
  const { glb, report } = shadeCrownGlb(fs.readFileSync(file), {
    floor: value('--floor', 0.45),
    under: value('--under', 0.75),
  });
  fs.writeFileSync(out, glb);
  console.log(JSON.stringify({ file: path.basename(out), ...report }));
}
if (
  cliMain(
    import.meta.url,
    'Usage: zhuda-laya-crown MODEL.glb [--floor 0.45] [--under 0.75] [--out FILE]',
  )
)
  main(process.argv.slice(2)).catch((error) => {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  });
