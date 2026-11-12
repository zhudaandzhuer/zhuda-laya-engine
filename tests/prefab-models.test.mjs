import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePrefabModels } from '../packages/core/prefabs/PrefabLibrary.ts';
import { zhudaPrefabFromFilmScene } from '../packages/core/film/FilmPrefab.ts';
import { validateZhudaModelPlacements } from '../packages/core/runtime3d/ModelPlacements.ts';

const definition = (nodes, states = { default: {} }) => ({
  id: 'wild',
  kind: 'models',
  nodes,
  states,
});
const fern = { name: 'ferns', asset: 'nature/fern.glb' };

test('model prefab definitions are validated with the name of the node', () => {
  validatePrefabModels(definition([fern]));
  validatePrefabModels(
    definition(
      [
        {
          ...fern,
          position: [1, 0, 2],
          yawDeg: 30,
          scale: 0.5,
          translucent: true,
          emission: 0,
          placements: [
            [0, 0, 0, 0, 1],
            [2, 0.1, -3, 90, 0.8],
          ],
        },
        { name: 'rock', asset: 'nature/rock.glb' },
      ],
      { default: {}, bare: { ferns: { active: false } } },
    ),
  );
  const fails = (nodes, pattern, states) =>
    assert.throws(() => validatePrefabModels(definition(nodes, states)), pattern);
  fails([], /1\.\.256 nodes/);
  fails([{ ...fern, name: 'a/b' }], /name without/);
  fails([fern, fern], /Duplicate model prefab node: ferns/);
  fails([{ ...fern, asset: '../fern.glb' }], /ferns: asset ID must be normalized/);
  fails([{ ...fern, asset: 'nature/fern.gltf' }], /ferns: asset must be a \.glb/);
  fails([{ ...fern, position: [0, 0] }], /ferns: position/);
  fails([{ ...fern, scale: 0 }], /ferns: scale/);
  fails([{ ...fern, emission: 9 }], /ferns: emission/);
  fails([{ ...fern, translucent: 1 }], /ferns: translucent/);
  fails([{ ...fern, placements: [[0, 0, 0, 0]] }], /ferns: placements \[0\]/);
  fails([fern], /unknown node: trees/, { default: { trees: { active: false } } });
  fails([fern], /only active/, { default: { ferns: { scale: 2 } } });
  const many = Array.from({ length: 20000 }, (_, i) => [i, 0, 0, 0, 1]);
  validatePrefabModels(
    definition(Array.from({ length: 3 }, (_, i) => ({ ...fern, name: 'f' + i, placements: many }))),
  );
  fails(
    Array.from({ length: 4 }, (_, i) => ({ ...fern, name: 'f' + i, placements: many })),
    /holds 80000 copies; at most 60000/,
  );
});

test('placement lists are checked for shape and scale', () => {
  assert.deepEqual(validateZhudaModelPlacements([[0, 0, 0, 0, 1]]), []);
  assert.equal(validateZhudaModelPlacements([]).length, 1);
  assert.equal(validateZhudaModelPlacements([[0, 0, 0, 0, 0]]).length, 1);
  assert.equal(validateZhudaModelPlacements([[0, 0, 0, 0, 1]], 0).length, 1);
  assert.match(validateZhudaModelPlacements([[0, 0, 0, 0, 1], 'x'])[0], /^\[1\]/);
});

test('a film scene becomes a model prefab and says what it leaves to the Scene', () => {
  const scene = {
    schemaVersion: 1,
    id: 'river',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    look: { preset: 'day', grade: {} },
    materials: { soil: { color: [0.3, 0.3, 0.3] } },
    nodes: [
      { id: 'land', type: 'model', asset: 'wild/land.glb', position: [0, 0, 0] },
      {
        id: 'ferns',
        type: 'model',
        asset: 'nature/fern.glb',
        position: [0, 0, 5],
        translucent: true,
        placements: [
          [1, 0, 2, 30, 1],
          [3, 0, 4, 60, 0.7],
        ],
      },
      {
        id: 'gate',
        type: 'model',
        asset: 'city/gate.glb',
        position: [0, 0, 152],
        emission: 0,
        lightmap: 'city/gate.hdr',
      },
      { id: 'river', type: 'water', position: [0, 0, 0], size: [40, 80] },
      { id: 'lamp', type: 'light', kind: 'point', position: [0, 3, 0] },
      { id: 'floor', type: 'ground', size: [10, 10], material: 'soil' },
    ],
  };
  const { definition: prefab, left } = zhudaPrefabFromFilmScene(scene, 'river/town');
  assert.deepEqual(prefab, {
    id: 'river/town',
    kind: 'models',
    nodes: [
      { name: 'land', asset: 'wild/land.glb' },
      {
        name: 'ferns',
        asset: 'nature/fern.glb',
        position: [0, 0, 5],
        placements: [
          [1, 0, 2, 30, 1],
          [3, 0, 4, 60, 0.7],
        ],
        translucent: true,
      },
      { name: 'gate', asset: 'city/gate.glb', position: [0, 0, 152], emission: 0 },
    ],
    states: { default: {} },
  });
  for (const item of [
    'camera',
    'water node river',
    'light node lamp',
    'ground node floor',
    'lightmap of model gate',
  ])
    assert.ok(
      left.some((entry) => entry.startsWith(item)),
      item + ': ' + left.join(' | '),
    );
  // The source scene is not changed, and the copy is detached from it.
  prefab.nodes[1].placements[0][0] = 99;
  assert.equal(scene.nodes[1].placements[0][0], 1);
  assert.throws(
    () => zhudaPrefabFromFilmScene({ ...scene, nodes: scene.nodes.slice(3) }, 'x'),
    /no model nodes/,
  );
  assert.throws(() => zhudaPrefabFromFilmScene(scene, ''), /id required/);
});

test('levels of detail: borders, hysteresis and culling', async () => {
  const { zhudaLodLevel, validateZhudaLodDistances, ZhudaModelLod, ZHUDA_LOD_CULLED } =
    await import('../packages/core/runtime3d/ModelLod.ts');
  const from = [10, 30];
  assert.equal(zhudaLodLevel(5, from, 60), 0);
  assert.equal(zhudaLodLevel(20, from, 60), 1);
  assert.equal(zhudaLodLevel(40, from, 60), 2);
  assert.equal(zhudaLodLevel(80, from, 60), ZHUDA_LOD_CULLED);
  assert.equal(zhudaLodLevel(80, from, undefined), 2);
  // On a border a copy keeps what it draws: 10.5 m is level 0 coming out, level 1 going in.
  assert.equal(zhudaLodLevel(10.5, from, 60, 0), 0);
  assert.equal(zhudaLodLevel(10.5, from, 60, 1), 1);
  assert.equal(zhudaLodLevel(9.5, from, 60, 1), 1);
  assert.equal(zhudaLodLevel(9, from, 60, 1), 0);
  assert.equal(zhudaLodLevel(62, from, 60, 2), 2);
  assert.equal(zhudaLodLevel(58, from, 60, ZHUDA_LOD_CULLED), ZHUDA_LOD_CULLED);
  assert.equal(zhudaLodLevel(54, from, 60, ZHUDA_LOD_CULLED), 2);
  assert.equal(zhudaLodLevel(NaN, from, 60, 1), 1);

  assert.deepEqual(validateZhudaLodDistances([10, 30], 60), []);
  assert.match(validateZhudaLodDistances([30, 10], 60)[0], /level 2/);
  assert.match(validateZhudaLodDistances([10], 5)[0], /cullMeters/);
  assert.match(validateZhudaLodDistances([0], undefined)[0], /level 1/);

  const node = () => ({ active: true });
  const at = (x) => ({ transform: { position: { x, y: 0, z: 0 } } });
  const items = [0, 20, 100].map((x) => ({
    anchor: at(x),
    nodes: [node(), node()],
    from: [10],
    cull: 50,
  }));
  const lod = new ZhudaModelLod(items);
  assert.deepEqual(
    items.map((item) => item.nodes.map((n) => n.active)),
    [
      [true, false],
      [true, false],
      [true, false],
    ],
  );
  assert.deepEqual(lod.update([0, 0, 0]), { levels: [1, 1], culled: 1, switched: 2 });
  assert.deepEqual(
    items.map((item) => item.nodes.map((n) => n.active)),
    [
      [true, false],
      [false, true],
      [false, false],
    ],
  );
  assert.deepEqual(lod.update([0, 0, 0]), { levels: [1, 1], culled: 1, switched: 0 });
  assert.deepEqual(lod.update([100, 0, 0]), { levels: [1, 0], culled: 2, switched: 3 });
  assert.throws(() => lod.update([0, NaN, 0]), /finite/);
  lod.dispose();
  assert.deepEqual(
    items.map((item) => item.nodes.map((n) => n.active)),
    [
      [true, false],
      [true, false],
      [true, false],
    ],
  );
  assert.throws(() => lod.update([0, 0, 0]), /Disposed/);
  assert.throws(
    () => new ZhudaModelLod([{ anchor: at(0), nodes: [node()], from: [10] }]),
    /one more node/,
  );
});

test('model prefab definitions accept levels and reject bad ones with the node name', () => {
  const tree = { name: 'trees', asset: 'nature/tree.glb' };
  validatePrefabModels(
    definition([
      { ...tree, lod: [{ asset: 'nature/tree-far.glb', fromMeters: 30 }], cullMeters: 200 },
    ]),
  );
  validatePrefabModels(definition([{ ...tree, cullMeters: 80 }]));
  const fails = (node, pattern) =>
    assert.throws(() => validatePrefabModels(definition([node])), pattern);
  fails({ ...tree, lod: [{ asset: 'nature/tree-far.png', fromMeters: 30 }] }, /trees: lod asset/);
  fails({ ...tree, lod: [{ asset: '../tree.glb', fromMeters: 30 }] }, /trees: lod asset/);
  fails(
    {
      ...tree,
      lod: [
        { asset: 'a.glb', fromMeters: 30 },
        { asset: 'b.glb', fromMeters: 20 },
      ],
    },
    /trees: level 2/,
  );
  fails(
    { ...tree, lod: [{ asset: 'a.glb', fromMeters: 30 }], cullMeters: 10 },
    /trees: cullMeters/,
  );
  fails(
    {
      ...tree,
      lod: Array.from({ length: 5 }, (_, i) => ({ asset: 'a.glb', fromMeters: 10 * (i + 1) })),
    },
    /at most 4/,
  );
});
