import test from 'node:test';
import assert from 'node:assert/strict';
import { enableLaya342VertexColors } from '../packages/core/runtime3d/Laya342Adapters.ts';

const material = () => ({
  defines: [],
  addDefine(d) {
    this.defines.push(d);
  },
});
const node = (mesh, materials, children = []) => ({
  meshRenderer: mesh ? { sharedMesh: mesh, sharedMaterials: materials } : undefined,
  numChildren: children.length,
  getChildAt: (i) => children[i],
});
const mesh = (coloured) => ({
  getVertexDeclaration: () => ({
    getVertexElementByUsage: (usage) => (coloured && usage === 1 ? {} : null),
  }),
});
const laya = {
  Shader3D: { getDefineByName: (name) => ({ name }) },
  VertexMesh: { MESH_COLOR0: 1 },
};

test('materials of meshes with a colour channel get the vertex colour define, once', () => {
  const shared = material(),
    plain = material();
  const tree = node(
    null,
    [],
    [node(mesh(true), [shared]), node(mesh(true), [shared]), node(mesh(false), [plain])],
  );
  assert.equal(enableLaya342VertexColors(tree, laya), 1);
  assert.deepEqual(
    shared.defines.map((d) => d.name),
    ['ENABLEVERTEXCOLOR'],
  );
  assert.deepEqual(plain.defines, []);
});

test('a runtime without the define or the colour usage changes nothing', () => {
  const m = material();
  assert.equal(
    enableLaya342VertexColors(node(mesh(true), [m]), { Shader3D: { getDefineByName: () => null } }),
    0,
  );
  assert.deepEqual(m.defines, []);
});

test('colour accessors become RGBA floats whatever their storage, raised to 1/2.2 for LayaAir', async () => {
  const { zhudaGltfColors } = await import('../packages/core/runtime3d/Laya342GltfAdapter.ts');
  // glTF's colour is linear; LayaAir's shader raises what it is given to the power 2.2.
  const display = (v) => +(v ** (1 / 2.2)).toFixed(3);
  assert.deepEqual(
    [
      ...zhudaGltfColors(new Uint16Array([65535, 0, 13107, 65535]), {
        type: 'VEC4',
        componentType: 5123,
      }),
    ].map((v) => +v.toFixed(3)),
    [1, 0, display(0.2), 1],
  );
  assert.deepEqual(
    [...zhudaGltfColors(new Uint8Array([255, 51, 0]), { type: 'VEC3', componentType: 5121 })].map(
      (v) => +v.toFixed(3),
    ),
    [1, display(0.2), 0, 1],
  );
  assert.deepEqual(
    [
      ...zhudaGltfColors(new Float32Array([0.5, 0.25, 1, 0.5, 0.5, 0.5]), {
        type: 'VEC3',
        componentType: 5126,
      }),
    ].map((v) => +v.toFixed(3)),
    [display(0.5), display(0.25), 1, 1, display(0.5), display(0.5), display(0.5), 1],
  );
  // Alpha is passed as it is.
  assert.deepEqual(
    [
      ...zhudaGltfColors(new Float32Array([0.5, 0.25, 1, 0.75]), {
        type: 'VEC4',
        componentType: 5126,
      }),
    ].map((v) => +v.toFixed(3)),
    [display(0.5), display(0.25), 1, 0.75],
  );
  // What LayaAir draws, value ** 2.2, is the glTF value again.
  const [r] = zhudaGltfColors(new Float32Array([0.2, 0.2, 0.2, 1]), {
    type: 'VEC4',
    componentType: 5126,
  });
  assert.ok(Math.abs(r ** 2.2 - 0.2) < 1e-6);
});

test("a mesh's primitives get the same vertex attributes before LayaAir packs them", async () => {
  const { unifyLaya342SubMeshAttributes } = await import(
    '../packages/core/runtime3d/Laya342GltfAdapter.ts'
  );
  const sub = (names, n) => ({
    vertexCount: n,
    vertexDecler: names.join(','),
    attributeMap: new Map(names.map((name) => [name, new Float32Array(n * 4).fill(9)])),
  });
  // A coloured, skinned body and eyes without colour.
  const body = sub(['POSITION', 'NORMAL', 'COLOR', 'BLENDWEIGHT', 'BLENDINDICES'], 3),
    eyes = sub(['POSITION', 'NORMAL', 'BLENDWEIGHT', 'BLENDINDICES'], 2);
  assert.equal(unifyLaya342SubMeshAttributes([body, eyes]), 1);
  assert.equal(eyes.vertexDecler, 'POSITION,NORMAL,COLOR,BLENDWEIGHT,BLENDINDICES');
  assert.deepEqual([...eyes.attributeMap.get('COLOR')], [1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(body.vertexDecler, 'POSITION,NORMAL,COLOR,BLENDWEIGHT,BLENDINDICES');
  // The first may be the one lacking: it gets what the later ones have, in LayaAir's order.
  const plain = sub(['POSITION', 'NORMAL'], 2),
    textured = sub(['POSITION', 'NORMAL', 'UV', 'TANGENT'], 2);
  assert.equal(unifyLaya342SubMeshAttributes([plain, textured]), 2);
  assert.equal(plain.vertexDecler, 'POSITION,NORMAL,UV,TANGENT');
  assert.deepEqual([...plain.attributeMap.get('UV')], [0, 0, 0, 0]);
  assert.deepEqual([...plain.attributeMap.get('TANGENT')], [1, 0, 0, 1, 1, 0, 0, 1]);
  // Already the same, a single primitive, or a name it does not know: nothing changes.
  const a = sub(['POSITION', 'NORMAL'], 1),
    b = sub(['POSITION', 'NORMAL'], 1);
  assert.equal(unifyLaya342SubMeshAttributes([a, b]), 0);
  assert.equal(unifyLaya342SubMeshAttributes([sub(['POSITION'], 1)]), 0);
  const odd = sub(['POSITION', 'NORMAL', 'MYSTERY'], 1),
    other = sub(['POSITION', 'NORMAL', 'COLOR'], 1);
  assert.equal(unifyLaya342SubMeshAttributes([odd, other]), 0);
  assert.equal(odd.vertexDecler, 'POSITION,NORMAL,MYSTERY');
});

test('a skin of more than 24 joints is ordered into few pieces, and nothing else changes', async () => {
  const { orderLaya342SkinTriangles, countLaya342SkinPieces } = await import(
    '../packages/core/runtime3d/Laya342GltfAdapter.ts'
  );
  // Two limbs of 16 joints each. A vertex is weighted to one joint and names
  // joint 0 three times more with no weight, as exporters pad them.
  const LIMB = 16,
    PER = 40;
  const joints = [],
    weights = [],
    limbTriangles = [[], []];
  for (let limb = 0; limb < 2; limb++)
    for (let t = 0; t < PER; t++) {
      const first = joints.length / 4;
      for (let k = 0; k < 3; k++) {
        joints.push(limb * LIMB + ((t + k) % LIMB), 0, 0, 0);
        weights.push(1, 0, 0, 0);
      }
      limbTriangles[limb].push([first, first + 1, first + 2]);
    }
  // The file's order takes a triangle of each limb in turn.
  const interleaved = [];
  for (let t = 0; t < PER; t++) interleaved.push(...limbTriangles[0][t], ...limbTriangles[1][t]);
  const indices = Uint16Array.from(interleaved),
    j = Float32Array.from(joints),
    w = Float32Array.from(weights);
  const asInTheFile = countLaya342SkinPieces(indices, j);
  assert.ok(asInTheFile > 4, `the file's order is cut into many pieces (${asInTheFile})`);
  const result = orderLaya342SkinTriangles(indices, j, w);
  assert.equal(result.after, 2, '32 joints fit in two draws of 24');
  assert.equal(countLaya342SkinPieces(indices, j), 2);
  assert.ok(result.before <= asInTheFile);
  // The same triangles, each with its corners in their order.
  const key = (list) => {
    const out = [];
    for (let i = 0; i < list.length; i += 3) out.push(`${list[i]},${list[i + 1]},${list[i + 2]}`);
    return out.sort();
  };
  assert.deepEqual(key(indices), key(interleaved));
  // A joint named with no weight is the vertex's weighted joint now: nothing is drawn differently.
  for (let v = 0; v < j.length / 4; v++)
    for (let k = 1; k < 4; k++) assert.equal(j[v * 4 + k], j[v * 4], `vertex ${v}`);
  assert.deepEqual([...w], weights, 'weights are not touched');

  // 24 joints or fewer: one piece, the order is kept.
  const small = Uint16Array.from([0, 1, 2, 3, 4, 5]),
    smallJoints = Float32Array.from([
      0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0,
    ]),
    smallWeights = new Float32Array(24).map((_, i) => (i % 4 === 0 ? 1 : 0));
  assert.deepEqual(orderLaya342SkinTriangles(small, smallJoints, smallWeights), {
    before: 1,
    after: 1,
  });
  assert.deepEqual([...small], [0, 1, 2, 3, 4, 5]);

  // An order that is already cut as little is left alone.
  const grouped = Uint16Array.from([...limbTriangles[0].flat(), ...limbTriangles[1].flat()]);
  const before = [...grouped];
  assert.deepEqual(orderLaya342SkinTriangles(grouped, Float32Array.from(joints), w), {
    before: 2,
    after: 2,
  });
  assert.deepEqual([...grouped], before);
});

test('the glTF resource orders a skin before LayaAir cuts it', async () => {
  const { prepareLaya342GltfResource } = await import(
    '../packages/core/runtime3d/Laya342GltfAdapter.ts'
  );
  const seen = [];
  const resource = {
    splitSubMeshByBonesCount(attributes, morph, indices) {
      seen.push([...indices]);
      return 'cut';
    },
  };
  prepareLaya342GltfResource(resource);
  // 26 joints: two triangles on joints 0..11, one on 12..23 between them, then one on 24, 25.
  const joints = [],
    weights = [];
  const vertex = (joint) => {
    joints.push(joint, joint, joint, joint);
    weights.push(1, 0, 0, 0);
    return joints.length / 4 - 1;
  };
  const triangle = (a, b, c) => [vertex(a), vertex(b), vertex(c)];
  const indices = Uint16Array.from([
    ...triangle(0, 1, 2),
    ...triangle(24, 25, 24),
    ...triangle(3, 4, 5),
  ]);
  for (let joint = 6; joint < 24; joint += 3) triangle(joint, joint + 1, joint + 2);
  const attributes = new Map([
    ['BLENDINDICES', Float32Array.from(joints)],
    ['BLENDWEIGHT', Float32Array.from(weights)],
  ]);
  assert.equal(resource.splitSubMeshByBonesCount(attributes, {}, indices, [], [], []), 'cut');
  assert.equal(seen.length, 1, 'LayaAir still cuts it, once');
  // Without the attributes it is passed on as it is.
  const untouched = Uint16Array.from([2, 1, 0]);
  resource.splitSubMeshByBonesCount(new Map(), {}, untouched, [], [], []);
  assert.deepEqual(seen[1], [2, 1, 0]);
});
