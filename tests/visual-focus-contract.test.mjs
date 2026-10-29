import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualFocusContract } from '../packages/core/VisualFocusContract.ts';

function makeTargets(ids) {
  const state = new Map(ids.map((id) => [id, false]));
  const targets = ids.map((id) => ({
    id,
    setDimmed(dimmed) {
      state.set(id, dimmed);
    }
  }));
  return { targets, state };
}

test('VisualFocusContract dims every target outside the winning set', () => {
  const { targets, state } = makeTargets(['reel0:row0', 'reel1:row0', 'reel2:row0']);
  const report = VisualFocusContract.apply(
    targets,
    VisualFocusContract.focus(['reel1:row0'])
  );

  assert.equal(report.mode, 'focus');
  assert.equal(report.active, true);
  assert.deepEqual(report.dimmedIds, ['reel0:row0', 'reel2:row0']);
  assert.equal(state.get('reel0:row0'), true);
  assert.equal(state.get('reel1:row0'), false);
  assert.equal(state.get('reel2:row0'), true);
});

test('VisualFocusContract treats an empty focus set as whole-scope dimming', () => {
  const { targets, state } = makeTargets([0, 1, 2, 3, 4]);
  const report = VisualFocusContract.assert(targets, VisualFocusContract.focus(), 5);

  assert.equal(report.active, false);
  assert.deepEqual(report.winningIds, []);
  assert.deepEqual([...state.values()], [true, true, true, true, true]);
});

test('VisualFocusContract clear mode restores every target explicitly', () => {
  const { targets, state } = makeTargets([0, 1, 2]);
  VisualFocusContract.apply(targets, VisualFocusContract.focus([1]));
  const report = VisualFocusContract.apply(targets, VisualFocusContract.clear());

  assert.equal(report.mode, 'clear');
  assert.equal(report.active, false);
  assert.deepEqual(report.dimmedIds, []);
  assert.deepEqual([...state.values()], [false, false, false]);
});
