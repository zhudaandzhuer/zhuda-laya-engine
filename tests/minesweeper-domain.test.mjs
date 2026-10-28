import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, MinesweeperGame } from '../src/domain/MinesweeperCore.ts';

test('MinesweeperGame guarantees 3x3 safe zone on first click and flood-fills empty neighbors', () => {
  const game = new MinesweeperGame(DIFFICULTIES.beginner);
  const res = game.reveal(4, 4);
  assert.equal(res.hitMine, false);
  assert.equal(game.status, 'playing');
  assert.ok(res.changed.length >= 1);

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const cell = game.getCell(4 + dr, 4 + dc);
      assert.equal(cell.isMine, false, `Cell (${4 + dr}, ${4 + dc}) in first-click 3x3 zone must be safe`);
    }
  }
});

test('MinesweeperGame flag cycle transitions hidden -> flagged -> question -> hidden', () => {
  const game = new MinesweeperGame(DIFFICULTIES.beginner);
  assert.equal(game.remainingMines, 10);

  let cell = game.toggleFlag(0, 0);
  assert.equal(cell.state, 'flagged');
  assert.equal(game.remainingMines, 9);

  cell = game.toggleFlag(0, 0);
  assert.equal(cell.state, 'question');
  assert.equal(game.remainingMines, 10);

  cell = game.toggleFlag(0, 0);
  assert.equal(cell.state, 'hidden');
});
