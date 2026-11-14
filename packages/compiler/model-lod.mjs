#!/usr/bin/env node
// Makes lighter versions of a .glb model for the engine's `lod` levels: the
// same model with a share of its triangles. Solid surfaces are simplified
// (meshoptimizer); foliage made of separate cards, which cannot be simplified
// without tearing, loses a share of its cards and the rest grow to cover the
// same crown. Vertex data is rewritten without the vertices no triangle uses
// any more. Textures, materials, nodes, skins and animations are kept as they
// are. Build-time only: nothing here runs in a game.
//
// usage: zhuda-laya-lod <model.glb> --ratio 0.5,0.2 [--textures 1024,512] [--out <dir>] [--error 0.02]
// writes <name>.lod1.glb, <name>.lod2.glb ... beside the model (or in --out).
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
import { cliMain } from './cli.mjs';

const COMPONENTS = {
  5120: [Int8Array, 1],
  5121: [Uint8Array, 1],
  5122: [Int16Array, 2],
  5123: [Uint16Array, 2],
  5125: [Uint32Array, 4],
  5126: [Float32Array, 4],
};
const COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

/** The JSON and the binary chunk of a .glb file. */
export function readGlb(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) throw Error('not a .glb file');
  if (buffer.readUInt32LE(4) !== 2) throw Error('glTF 2.0 required');
  let offset = 12,
    json,
    bin = Buffer.alloc(0);
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset),
      type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    offset += 8 + length;
  }
  if (!json) throw Error('.glb has no JSON chunk');
  return { json, bin };
}

/** A .glb file of a glTF document and its binary data. */
export function writeGlb(json, bin) {
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const body = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + body.length, 8);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, data]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, text), chunk(0x004e4942, body)]);
}

/** One accessor's elements as tightly packed bytes. */
function elementBytes(json, bin, index) {
  const accessor = json.accessors[index];
  if (accessor.sparse) throw Error('sparse accessors are not supported');
  const view = json.bufferViews[accessor.bufferView];
  const [, size] = COMPONENTS[accessor.componentType] ?? [];
  if (!size || !COUNTS[accessor.type]) throw Error('unknown accessor type');
  const element = size * COUNTS[accessor.type],
    stride = view.byteStride || element,
    start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  if (stride === element)
    return { bytes: bin.subarray(start, start + element * accessor.count), element };
  const packed = Buffer.alloc(element * accessor.count);
  for (let i = 0; i < accessor.count; i++)
    bin.copy(packed, i * element, start + i * stride, start + i * stride + element);
  return { bytes: packed, element };
}
const typed = (json, bin, index) => {
  const { bytes } = elementBytes(json, bin, index);
  const [Type, size] = COMPONENTS[json.accessors[index].componentType];
  const copy = new Uint8Array(bytes);
  return new Type(copy.buffer, 0, copy.byteLength / size);
};

/**
 * Leaf cards: the triangles sorted into pieces that share no vertex, a share
 * of the pieces kept (the same ones every run) and each kept piece grown
 * about its middle so that the crown stays as full. Returns the indices kept
 * and moves `positions` in place.
 */
export function thinCards(indices, positions, ratio) {
  const count = positions.length / 3;
  const parent = new Uint32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(indices[t]);
    parent[find(indices[t + 1])] = a;
    parent[find(indices[t + 2])] = a;
  }
  // Pieces numbered in the order their first triangle comes.
  const order = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const root = find(indices[t]);
    if (!order.has(root)) order.set(root, order.size);
  }
  // The golden ratio spreads the kept pieces evenly through the crown.
  const keeps = (root) => (order.get(root) * 0.6180339887498949) % 1 < ratio;
  const kept = [];
  for (let t = 0; t < indices.length; t += 3)
    if (keeps(find(indices[t]))) kept.push(indices[t], indices[t + 1], indices[t + 2]);
  // Grow each kept piece: area by 1 / ratio, capped so that cards do not turn into sheets.
  const grow = Math.min(1.8, 1 / Math.sqrt(Math.max(ratio, 1e-6)));
  const sums = new Map();
  const used = new Set(kept);
  for (const v of used) {
    const root = find(v);
    const sum = sums.get(root) ?? sums.set(root, [0, 0, 0, 0]).get(root);
    sum[0] += positions[v * 3];
    sum[1] += positions[v * 3 + 1];
    sum[2] += positions[v * 3 + 2];
    sum[3]++;
  }
  for (const v of used) {
    const sum = sums.get(find(v));
    for (let k = 0; k < 3; k++) {
      const middle = sum[k] / sum[3];
      positions[v * 3 + k] = middle + (positions[v * 3 + k] - middle) * grow;
    }
  }
  return { indices: new Uint32Array(kept), pieces: order.size, grow };
}

/**
 * The model with about `ratio` of its triangles. `error` is how far a
 * simplified surface may stand from the original, as a share of the mesh's
 * size (default 0.02). `textureSize` makes the pictures inside the file no
 * larger than that many pixels a side (JPEG stays JPEG, PNG stays PNG).
 * Returns the new file, for each part of each mesh what was done to it, and
 * for each picture its size before and after.
 */
export async function simplifyGlb(bytes, options = {}) {
  const ratio = options.ratio,
    error = options.error ?? 0.02;
  if (!(ratio > 0 && ratio < 1))
    throw Error('ratio: a share of the triangles, above 0 and below 1');
  if (!(error > 0 && error <= 1)) throw Error('error: above 0, at most 1');
  if (
    options.textureSize !== undefined &&
    !(
      Number.isInteger(options.textureSize) &&
      options.textureSize >= 16 &&
      options.textureSize <= 8192
    )
  )
    throw Error('textureSize: a whole number of pixels, 16..8192');
  await MeshoptSimplifier.ready;
  const { json, bin } = readGlb(bytes);
  const out = structuredClone(json);
  const added = []; // { bytes, target? } new buffer views, numbered after the old ones
  const view = (data, target) => {
    added.push({ bytes: Buffer.from(data.buffer, data.byteOffset, data.byteLength), target });
    return json.bufferViews.length + added.length - 1;
  };
  const report = [];
  for (const [m, mesh] of (out.meshes ?? []).entries())
    for (const [p, primitive] of mesh.primitives.entries()) {
      const material = out.materials?.[primitive.material] ?? {};
      const entry = {
        mesh: mesh.name ?? String(m),
        part: p,
        material: material.name ?? null,
        method: 'kept',
      };
      report.push(entry);
      const position = primitive.attributes?.POSITION;
      if ((primitive.mode ?? 4) !== 4 || position === undefined) continue;
      if (json.accessors[position].componentType !== 5126) continue;
      const positions = Float32Array.from(typed(json, bin, position));
      const vertices = positions.length / 3;
      const indices =
        primitive.indices === undefined
          ? Uint32Array.from({ length: vertices }, (_, i) => i)
          : Uint32Array.from(typed(json, bin, primitive.indices));
      entry.before = indices.length / 3;
      const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
      let [next] = MeshoptSimplifier.simplify(indices, positions, 3, target, error, []);
      entry.method = 'simplified';
      // A surface whose every vertex lies on a seam (faceted, or with a UV
      // island a triangle) does not give way: let vertices be joined across seams.
      if (next.length > target * 1.3) {
        const [across] = MeshoptSimplifier.simplify(indices, positions, 3, target, error, [
          'Permissive',
        ]);
        if (across.length < next.length) {
          next = across;
          entry.method = 'simplified across seams';
        }
      }
      // Separate cards do not simplify: nothing joins one to the next.
      if (next.length > target * 1.3 && (material.alphaMode === 'MASK' || options.cards)) {
        const thinned = thinCards(indices, positions, ratio);
        next = thinned.indices;
        entry.method = 'cards';
        entry.pieces = thinned.pieces;
        entry.grow = +thinned.grow.toFixed(3);
      }
      entry.after = next.length / 3;
      if (!next.length) throw Error(`${entry.mesh}: nothing left at ratio ${ratio}`);
      // The vertices still used, in their old order.
      const remap = new Int32Array(vertices).fill(-1);
      const keep = [];
      for (const v of [...new Set(next)].sort((a, b) => a - b)) {
        remap[v] = keep.length;
        keep.push(v);
      }
      entry.vertices = keep.length;
      const compact = (index, replace) => {
        const accessor = json.accessors[index];
        const { bytes: source, element } = replace
          ? { bytes: Buffer.from(replace.buffer), element: 12 }
          : elementBytes(json, bin, index);
        const packed = Buffer.alloc(keep.length * element);
        keep.forEach((v, i) => source.copy(packed, i * element, v * element, (v + 1) * element));
        const made = { ...accessor, bufferView: view(packed, 34962), count: keep.length };
        delete made.byteOffset;
        if (accessor.min && accessor.type === 'VEC3' && accessor.componentType === 5126) {
          const values = new Float32Array(packed.buffer, packed.byteOffset, keep.length * 3);
          made.min = [Infinity, Infinity, Infinity];
          made.max = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < values.length; i++) {
            made.min[i % 3] = Math.min(made.min[i % 3], values[i]);
            made.max[i % 3] = Math.max(made.max[i % 3], values[i]);
          }
        }
        out.accessors.push(made);
        return out.accessors.length - 1;
      };
      for (const [name, index] of Object.entries(primitive.attributes))
        primitive.attributes[name] = compact(index, name === 'POSITION' ? positions : undefined);
      for (const morph of primitive.targets ?? [])
        for (const [name, index] of Object.entries(morph)) morph[name] = compact(index);
      const wide = keep.length > 65535;
      const packed = wide ? new Uint32Array(next.length) : new Uint16Array(next.length);
      for (let i = 0; i < next.length; i++) packed[i] = remap[next[i]];
      out.accessors.push({
        bufferView: view(packed, 34963),
        componentType: wide ? 5125 : 5123,
        count: packed.length,
        type: 'SCALAR',
      });
      primitive.indices = out.accessors.length - 1;
    }

  // Pictures: a model seen from far off does not need them at full size.
  const pictures = [];
  if (options.textureSize !== undefined) {
    const { default: sharp } = await import('sharp');
    for (const [i, image] of (out.images ?? []).entries()) {
      if (image.bufferView === undefined) continue;
      const old = json.bufferViews[image.bufferView];
      const source = bin.subarray(old.byteOffset || 0, (old.byteOffset || 0) + old.byteLength);
      const { width, height } = await sharp(source).metadata();
      const entry = { image: image.name ?? String(i), from: [width, height], to: [width, height] };
      pictures.push(entry);
      if (Math.max(width, height) <= options.textureSize) continue;
      const resized = sharp(source).resize({
        width: options.textureSize,
        height: options.textureSize,
        fit: 'inside',
      });
      const made =
        image.mimeType === 'image/png'
          ? await resized.png().toBuffer({ resolveWithObject: true })
          : await resized.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
      entry.to = [made.info.width, made.info.height];
      image.bufferView = view(made.data);
    }
  }

  // Keep only the accessors something still points at, and only their data.
  const usedAccessors = new Set();
  const visit = (index) => index !== undefined && usedAccessors.add(index);
  for (const mesh of out.meshes ?? [])
    for (const primitive of mesh.primitives) {
      Object.values(primitive.attributes ?? {}).forEach(visit);
      visit(primitive.indices);
      for (const morph of primitive.targets ?? []) Object.values(morph).forEach(visit);
    }
  for (const skin of out.skins ?? []) visit(skin.inverseBindMatrices);
  for (const animation of out.animations ?? [])
    for (const sampler of animation.samplers ?? []) {
      visit(sampler.input);
      visit(sampler.output);
    }
  const accessorMap = new Map();
  out.accessors = out.accessors.filter((_, index) => {
    if (!usedAccessors.has(index)) return false;
    accessorMap.set(index, accessorMap.size);
    return true;
  });
  const moved = (index) => (index === undefined ? undefined : accessorMap.get(index));
  for (const mesh of out.meshes ?? [])
    for (const primitive of mesh.primitives) {
      for (const name of Object.keys(primitive.attributes ?? {}))
        primitive.attributes[name] = moved(primitive.attributes[name]);
      if (primitive.indices !== undefined) primitive.indices = moved(primitive.indices);
      for (const morph of primitive.targets ?? [])
        for (const name of Object.keys(morph)) morph[name] = moved(morph[name]);
    }
  for (const skin of out.skins ?? [])
    if (skin.inverseBindMatrices !== undefined)
      skin.inverseBindMatrices = moved(skin.inverseBindMatrices);
  for (const animation of out.animations ?? [])
    for (const sampler of animation.samplers ?? []) {
      sampler.input = moved(sampler.input);
      sampler.output = moved(sampler.output);
    }
  const usedViews = new Set();
  for (const accessor of out.accessors)
    if (accessor.bufferView !== undefined) usedViews.add(accessor.bufferView);
  for (const image of out.images ?? [])
    if (image.bufferView !== undefined) usedViews.add(image.bufferView);
  const parts = [],
    views = [],
    viewMap = new Map();
  let length = 0;
  const total = json.bufferViews.length + added.length;
  for (let index = 0; index < total; index++) {
    if (!usedViews.has(index)) continue;
    const old = json.bufferViews[index];
    const data = old
      ? bin.subarray(old.byteOffset || 0, (old.byteOffset || 0) + old.byteLength)
      : added[index - json.bufferViews.length].bytes;
    const pad = (4 - (length % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    length += pad;
    const made = old
      ? { ...old, buffer: 0, byteOffset: length }
      : {
          buffer: 0,
          byteOffset: length,
          byteLength: data.length,
          target: added[index - json.bufferViews.length].target,
        };
    viewMap.set(index, views.length);
    views.push(made);
    parts.push(data);
    length += data.length;
  }
  out.bufferViews = views;
  for (const accessor of out.accessors)
    if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
  for (const image of out.images ?? [])
    if (image.bufferView !== undefined) image.bufferView = viewMap.get(image.bufferView);
  out.buffers = [{ byteLength: length }];
  return { glb: writeGlb(out, Buffer.concat(parts)), report, pictures };
}

async function main(argv) {
  // What is neither a flag nor a flag's value is the model.
  const files = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] ?? '').startsWith('--'));
  const flag = (name) => {
    const at = argv.indexOf('--' + name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  if (files.length !== 1 || !flag('ratio')) {
    console.error(
      'usage: zhuda-laya-lod <model.glb> --ratio 0.5,0.2 [--textures 1024,512] [--out <dir>] [--error 0.02]\n' +
        'writes <name>.lod1.glb, <name>.lod2.glb ... with that share of the triangles',
    );
    process.exitCode = 2;
    return;
  }
  const source = path.resolve(files[0]);
  const bytes = fs.readFileSync(source);
  const dir = path.resolve(flag('out') ?? path.dirname(source));
  fs.mkdirSync(dir, { recursive: true });
  const ratios = flag('ratio').split(',').map(Number);
  for (const [i, ratio] of ratios.entries()) {
    // One picture size for every level, or one for each.
    const sizes = (flag('textures') ?? '').split(',').filter(Boolean).map(Number);
    const { glb, report } = await simplifyGlb(bytes, {
      ratio,
      textureSize: sizes.length ? sizes[Math.min(i, sizes.length - 1)] : undefined,
      error: flag('error') ? Number(flag('error')) : undefined,
    });
    const file = path.join(dir, `${path.basename(source, '.glb')}.lod${i + 1}.glb`);
    fs.writeFileSync(file, glb);
    const before = report.reduce((n, r) => n + (r.before ?? 0), 0),
      after = report.reduce((n, r) => n + (r.after ?? 0), 0);
    console.log(
      `${path.basename(file)}: ${after} of ${before} triangles (asked ${ratio}), ${(glb.length / 1024).toFixed(0)} KB of ${(bytes.length / 1024).toFixed(0)} KB`,
    );
    for (const r of report)
      console.log(
        `  ${r.material ?? r.mesh}: ${r.method}` +
          (r.before ? ` ${r.before} -> ${r.after}` : '') +
          (r.pieces ? ` (${r.pieces} cards, kept ones grown ${r.grow}x)` : ''),
      );
  }
}
if (
  cliMain(
    import.meta.url,
    'Usage: zhuda-laya-lod MODEL.glb --ratio 0.5,0.2 [--textures 1024,512] [--out DIRECTORY] [--error 0.02]',
  )
)
  main(process.argv.slice(2)).catch((error) => {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  });
