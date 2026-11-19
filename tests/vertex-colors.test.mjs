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
