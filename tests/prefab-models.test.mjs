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
