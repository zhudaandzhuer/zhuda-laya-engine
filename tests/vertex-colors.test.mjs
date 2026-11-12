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

test('colour accessors become RGBA floats whatever their storage', async () => {
  const { zhudaGltfColors } = await import('../packages/core/runtime3d/Laya342GltfAdapter.ts');
  assert.deepEqual(
    [
      ...zhudaGltfColors(new Uint16Array([65535, 0, 13107, 65535]), {
        type: 'VEC4',
        componentType: 5123,
      }),
    ].map((v) => +v.toFixed(3)),
    [1, 0, 0.2, 1],
  );
  assert.deepEqual(
    [...zhudaGltfColors(new Uint8Array([255, 51, 0]), { type: 'VEC3', componentType: 5121 })].map(
      (v) => +v.toFixed(3),
    ),
    [1, 0.2, 0, 1],
  );
  assert.deepEqual(
    [
      ...zhudaGltfColors(new Float32Array([0.5, 0.25, 1, 0.5, 0.5, 0.5]), {
        type: 'VEC3',
        componentType: 5126,
      }),
    ],
    [0.5, 0.25, 1, 1, 0.5, 0.5, 0.5, 1],
  );
  assert.deepEqual(
    [
      ...zhudaGltfColors(new Float32Array([0.5, 0.25, 1, 0.75]), {
        type: 'VEC4',
        componentType: 5126,
      }),
    ],
    [0.5, 0.25, 1, 0.75],
  );
});
