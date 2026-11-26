// 2d/prefab-atlas with a stand-in for Laya.Texture and the prefab library (it imports only types).
import test from 'node:test';
import assert from 'node:assert/strict';

const made = [];
globalThis.Laya = { Texture: { createFromTexture: (texture, x, y, w, h) => (made.push([x, y, w, h]), { of: texture, x, y, w, h }) } };
const { mountAtlasPrefab, gridCell, gridCellAt } = await import('../2d/prefab-atlas/prefab-atlas.ts');

test('cells of an evenly divided atlas, with fractional sizes as the dungeon views computed them', () => {
  const hero = { width: 2032, height: 774 };
  const cell = gridCell(hero, 3, 2, 1, 1); // magic pose
  assert.deepEqual([cell.x, cell.y, cell.w, cell.h], [2032 / 3, 387, 2032 / 3, 387]);
  const creatures = { width: 1983, height: 793 };
  const boss = gridCellAt(creatures, 5, 2, 9);
  assert.deepEqual([boss.x, boss.y], [4 * (1983 / 5), 793 / 2]); // the same float the original wrote as 4 * cellW
  assert.deepEqual([gridCellAt(creatures, 5, 2, 7).x, gridCellAt(creatures, 5, 2, 7).y], [2 * (1983 / 5), 793 / 2]);
  assert.equal(gridCellAt(creatures, 5, 2, 0).of, creatures);
});

test('mountAtlasPrefab mounts the checked prefab hidden and hands out its decoded texture', async () => {
  const texture = { width: 10, height: 10 };
  const calls = [];
  const root = { visible: true };
  const library = {
    instantiate: async (id, options) => (calls.push([id, options]), { root, find: (node) => (node === 'Atlas' ? { source: texture } : { source: null }), dispose() {} }),
  };
  const parent = {};
  const got = await mountAtlasPrefab(library, 'visual/atlas', 'Atlas', parent);
  assert.deepEqual(calls, [['visual/atlas', { state: 'idle', parent }]]);
  assert.equal(root.visible, false);
  assert.equal(got.texture, texture);
  await assert.rejects(mountAtlasPrefab(library, 'visual/atlas', 'Other', parent, 'busy'), /did not expose its texture \(Other\)/);
  assert.equal(calls[1][1].state, 'busy');
});
