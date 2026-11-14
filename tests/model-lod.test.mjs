// Lighter versions of a model (zhuda-laya-lod): triangle counts, vertex data
// left without unused vertices, leaf cards thinned and grown, what is not
// geometry kept as it was. Pure: no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readGlb, simplifyGlb, thinCards, writeGlb } from '../packages/compiler/model-lod.mjs';
import { skinnedStripGlb } from '../scripts/lib/film-fixtures.mjs';

/** A .glb of meshes given as { positions, normals?, uvs?, indices?, material }. */
function glb(parts, materials, extra = []) {
  const chunks = [],
    bufferViews = [],
    accessors = [];
  let offset = 0;
  const add = (array, props) => {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) chunks.push(Buffer.alloc(pad));
    offset += pad;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes);
    offset += bytes.length;
    accessors.push({ bufferView: bufferViews.length - 1, ...props });
    return accessors.length - 1;
  };
  const meshes = parts.map((part, i) => {
    const count = part.positions.length / 3;
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    part.positions.forEach((v, k) => {
      min[k % 3] = Math.min(min[k % 3], v);
      max[k % 3] = Math.max(max[k % 3], v);
    });
    const attributes = {
      POSITION: add(new Float32Array(part.positions), {
        componentType: 5126,
        count,
        type: 'VEC3',
        min,
        max,
      }),
    };
    if (part.normals)
      attributes.NORMAL = add(new Float32Array(part.normals), {
        componentType: 5126,
        count,
        type: 'VEC3',
      });
    if (part.uvs)
      attributes.TEXCOORD_0 = add(new Float32Array(part.uvs), {
        componentType: 5126,
        count,
        type: 'VEC2',
      });
    const primitive = { attributes, material: part.material };
    if (part.indices)
      primitive.indices = add(new Uint16Array(part.indices), {
        componentType: 5123,
        count: part.indices.length,
        type: 'SCALAR',
      });
    return { name: 'mesh' + i, primitives: [primitive] };
  });
  const images = extra.map((bytes) => {
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes);
    offset += bytes.length;
    return { bufferView: bufferViews.length - 1, mimeType: 'image/png' };
  });
  return writeGlb(
    {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: meshes.map((_, i) => i) }],
      nodes: meshes.map((_, i) => ({ mesh: i, name: 'node' + i })),
      meshes,
      materials,
      ...(images.length ? { images } : {}),
      buffers: [{ byteLength: offset }],
      bufferViews,
      accessors,
    },
    Buffer.concat(chunks),
  );
}
/** A square sheet of n × n squares with a gentle swell, vertices shared. */
function sheet(n) {
  const positions = [],
    normals = [],
    uvs = [],
    indices = [];
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      positions.push(i / n, 0.02 * Math.sin(i * 0.7) * Math.cos(j * 0.5), j / n);
      normals.push(0, 1, 0);
      uvs.push(i / n, j / n);
    }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  return { positions, normals, uvs, indices };
}
/** `count` separate squares scattered in a ball: leaf cards. */
function cards(count) {
  const positions = [],
    normals = [],
    uvs = [],
    indices = [];
  for (let c = 0; c < count; c++) {
    const x = Math.sin(c * 12.9898) * 3,
      y = Math.sin(c * 78.233) * 3,
      z = Math.sin(c * 37.719) * 3,
      first = c * 4;
    positions.push(x, y, z, x + 0.4, y, z, x + 0.4, y + 0.4, z, x, y + 0.4, z);
    for (let k = 0; k < 4; k++) normals.push(0, 0, 1);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  return { positions, normals, uvs, indices };
}
/** The same sheet with every triangle on vertices of its own: all seams. */
function faceted(n) {
  const shared = sheet(n);
  const positions = [],
    normals = [];
  for (const i of shared.indices) {
    positions.push(...shared.positions.slice(i * 3, i * 3 + 3));
    normals.push(0, 1, 0);
  }
  return { positions, normals, indices: shared.indices.map((_, i) => i) };
}
const SOLID = { name: 'bark', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } };
const LEAF = { name: 'leaves', alphaMode: 'MASK', doubleSided: true };
const triangles = (json) =>
  json.meshes.map((mesh) => json.accessors[mesh.primitives[0].indices].count / 3);

test('a solid surface is simplified to about the share asked for', async () => {
  const source = glb([{ ...sheet(40), material: 0 }], [SOLID]);
  const { glb: made, report } = await simplifyGlb(source, { ratio: 0.25 });
  const { json, bin } = readGlb(made);
  assert.equal(report[0].method, 'simplified');
  assert.equal(report[0].before, 3200);
  assert.ok(
    report[0].after <= 3200 * 0.25 * 1.05 && report[0].after > 3200 * 0.1,
    'triangles: ' + report[0].after,
  );
  assert.deepEqual(triangles(json), [report[0].after]);
  // Vertex data holds only what is used, every attribute alike, and the box is the sheet's.
  const { attributes, indices } = json.meshes[0].primitives[0];
  const count = json.accessors[attributes.POSITION].count;
  assert.equal(count, report[0].vertices);
  assert.ok(count < 1681 * 0.5, 'vertices: ' + count);
  for (const name of ['NORMAL', 'TEXCOORD_0'])
    assert.equal(json.accessors[attributes[name]].count, count);
  const view = json.bufferViews[json.accessors[indices].bufferView];
  const index = new Uint16Array(
    bin.buffer.slice(
      bin.byteOffset + view.byteOffset,
      bin.byteOffset + view.byteOffset + view.byteLength,
    ),
  );
  assert.ok(index.every((i) => i < count));
  assert.equal(new Set(index).size, count, 'no vertex is left unused');
  const { min, max } = json.accessors[attributes.POSITION];
  assert.ok(Math.abs(min[0]) < 1e-6 && Math.abs(max[0] - 1) < 1e-6 && Math.abs(max[2] - 1) < 1e-6);
  // Smaller file; the same model again gives the same bytes.
  assert.ok(made.length < source.length * 0.5);
  assert.deepEqual((await simplifyGlb(source, { ratio: 0.25 })).glb, made);
});

test('a surface that is all seams is simplified across them', async () => {
  const { report } = await simplifyGlb(glb([{ ...faceted(24), material: 0 }], [SOLID]), {
    ratio: 0.2,
  });
  assert.equal(report[0].method, 'simplified across seams');
  assert.ok(report[0].after <= report[0].before * 0.3, `${report[0].before} -> ${report[0].after}`);
});

test('leaf cards lose a share of the cards and the rest grow', async () => {
  const leaves = cards(400);
  const source = glb([{ ...leaves, material: 0 }], [LEAF]);
  const { glb: made, report } = await simplifyGlb(source, { ratio: 0.25 });
  assert.equal(report[0].method, 'cards');
  assert.equal(report[0].pieces, 400);
  assert.equal(report[0].grow, 1.8, 'capped: a quarter of the cards would need twice the size');
  // Whole cards: two triangles and four vertices each.
  assert.equal(report[0].after % 2, 0);
  assert.equal(report[0].vertices, report[0].after * 2);
  assert.ok(Math.abs(report[0].after / 2 - 100) <= 8, 'cards kept: ' + report[0].after / 2);
  const { json, bin } = readGlb(made);
  const accessor = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  const view = json.bufferViews[accessor.bufferView];
  const positions = new Float32Array(
    bin.buffer.slice(
      bin.byteOffset + view.byteOffset,
      bin.byteOffset + view.byteOffset + view.byteLength,
    ),
  );
  // The first card kept is 0.4 × 1.8 wide.
  assert.ok(Math.abs(positions[3] - positions[0] - 0.72) < 1e-5);
  // The same solid mesh is not treated as cards, and a flag asks for it.
  const solid = await simplifyGlb(glb([{ ...leaves, material: 0 }], [SOLID]), { ratio: 0.25 });
  assert.notEqual(solid.report[0].method, 'cards');
  const asked = await simplifyGlb(glb([{ ...leaves, material: 0 }], [SOLID]), {
    ratio: 0.25,
    cards: true,
  });
  assert.equal(asked.report[0].method, 'cards');
});

test('thinning keeps the same cards every time and whole cards only', () => {
  const { positions, indices } = cards(50);
  const a = thinCards(Uint32Array.from(indices), Float32Array.from(positions), 0.5);
  const b = thinCards(Uint32Array.from(indices), Float32Array.from(positions), 0.5);
  assert.deepEqual(a.indices, b.indices);
  assert.equal(a.pieces, 50);
  assert.ok(Math.abs(a.indices.length / 6 - 25) <= 3);
  assert.ok(Math.abs(a.grow - Math.SQRT2) < 1e-9);
  // Fewer cards at a smaller share are among those of a larger one.
  const few = new Set(
    thinCards(Uint32Array.from(indices), Float32Array.from(positions), 0.2).indices,
  );
  const more = new Set(a.indices);
  for (const v of few) assert.ok(more.has(v));
});

test('what is not geometry is kept, and several meshes each get their own data', async () => {
  const picture = Buffer.from('not a real picture, only bytes');
  const source = glb(
    [
      { ...sheet(20), material: 0 },
      { ...cards(100), material: 1 },
    ],
    [SOLID, LEAF],
    [picture],
  );
  const { glb: made, report } = await simplifyGlb(source, { ratio: 0.5 });
  const { json, bin } = readGlb(made);
  assert.deepEqual(
    report.map((r) => r.method),
    ['simplified', 'cards'],
  );
  assert.deepEqual(json.materials, [SOLID, LEAF]);
  assert.deepEqual(json.nodes, readGlb(source).json.nodes);
  const image = json.bufferViews[json.images[0].bufferView];
  assert.deepEqual(bin.subarray(image.byteOffset, image.byteOffset + image.byteLength), picture);
  // Every accessor is used and every view lies inside the buffer.
  const used = new Set();
  for (const mesh of json.meshes) {
    Object.values(mesh.primitives[0].attributes).forEach((i) => used.add(i));
    used.add(mesh.primitives[0].indices);
  }
  assert.equal(used.size, json.accessors.length);
  for (const view of json.bufferViews) {
    assert.equal(view.byteOffset % 4, 0);
    assert.ok(view.byteOffset + view.byteLength <= json.buffers[0].byteLength);
  }
  assert.ok(bin.length >= json.buffers[0].byteLength);
});

test('a skinned model keeps its skin, joints and animation', async () => {
  const source = skinnedStripGlb();
  const before = readGlb(source).json;
  const { glb: made } = await simplifyGlb(source, { ratio: 0.9 });
  const { json } = readGlb(made);
  const { attributes } = json.meshes[0].primitives[0];
  const count = json.accessors[attributes.POSITION].count;
  for (const name of Object.keys(before.meshes[0].primitives[0].attributes))
    assert.equal(json.accessors[attributes[name]].count, count, name);
  assert.equal(json.skins.length, before.skins.length);
  assert.equal(json.accessors[json.skins[0].inverseBindMatrices].type, 'MAT4');
  assert.equal(json.animations.length, before.animations.length);
  for (const sampler of json.animations[0].samplers) {
    assert.ok(json.accessors[sampler.input].count > 0);
    assert.ok(json.accessors[sampler.output].count > 0);
  }
});

test('what cannot be done is refused', async () => {
  const source = glb([{ ...sheet(4), material: 0 }], [SOLID]);
  await assert.rejects(simplifyGlb(source, { ratio: 1 }), /ratio/);
  await assert.rejects(simplifyGlb(source, { ratio: 0 }), /ratio/);
  await assert.rejects(simplifyGlb(source, { ratio: 0.5, error: 0 }), /error/);
  await assert.rejects(
    simplifyGlb(Buffer.from('nothing like a model'), { ratio: 0.5 }),
    /not a \.glb/,
  );
  assert.throws(() => readGlb(Buffer.alloc(4)), /not a \.glb/);
});
