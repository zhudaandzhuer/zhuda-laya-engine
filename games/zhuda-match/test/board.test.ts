import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board, KINDS, LEVELS, SIZE, bestMove, clone } from '../src/core/board.ts';

const fruit = (kind: number, id: number, special: 'none' | 'bolt' | 'star' = 'none') => ({ kind, special, id });
/** A board laid out by rows of digits (kinds); the rest of the rules run on it as on any other. */
function laid(rows: string[], seed = 5): Board {
  const b = new Board({ id: 't', name: 't', moves: 30, target: 1e9, kinds: KINDS }, seed);
  b.cells = rows.flatMap((r, y) => [...r].map((ch, x) => fruit(Number(ch), 100000 + y * SIZE + x)));
  return b;
}
// No three in a line anywhere, and no swap makes one: two kinds in 2 x 2 blocks... a move is laid on top where wanted.
const QUIET = ['01230123', '23012301', '01230123', '23012301', '01230123', '23012301', '01230123', '23012301'];

test('a new board has no line of three, has a move, and is the same for the same seed', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const b = new Board(LEVELS[seed % LEVELS.length], seed);
    assert.equal(Board.runs(b.cells).length, 0);
    assert.ok(b.hint());
    assert.deepEqual(new Board(LEVELS[seed % LEVELS.length], seed).cells, b.cells);
    assert.equal(new Set(b.cells.map((c) => c.id)).size, SIZE * SIZE);
  }
});

test('a swap that bursts nothing is refused and costs nothing; neighbours only', () => {
  const b = laid(QUIET);
  assert.equal(Board.runs(b.cells).length, 0);
  assert.equal(b.move(0, 1), null);
  assert.equal(b.move(0, 9), null);
  assert.equal(b.movesLeft, 30);
  assert.equal(b.score, 0);
});

test('three burst for 30, what is above falls, new fruit comes in at the top, and every cell is full', () => {
  const rows = [...QUIET];
  rows[7] = '55455123'; // swapping columns 2 and 3 of the bottom row lines up 5 5 5
  const b = laid(rows);
  const above = b.cells[6 * SIZE].id;
  const rounds = b.move(7 * SIZE + 2, 7 * SIZE + 3)!;
  assert.ok(rounds.length >= 1);
  assert.deepEqual(rounds[0].burst, [56, 57, 58]);
  assert.equal(rounds[0].points, 30);
  assert.equal(rounds[0].after[7 * SIZE].id, above);
  assert.ok(rounds[0].after[0].id < 100000, 'a new fruit at the top');
  assert.ok(b.cells.every((c) => c.kind >= 0 && c.kind <= KINDS));
  assert.equal(b.movesLeft, 29);
  assert.equal(Board.runs(b.cells).length, 0);
});

test('four in a line leave a bolt where the fruit landed; a bolt clears its row and column', () => {
  const rows = [...QUIET];
  rows[7] = '55451123'; // 5 5 . 5 with a 5 above the gap
  rows[6] = '01530123';
  const b = laid(rows);
  const rounds = b.move(6 * SIZE + 2, 7 * SIZE + 2)!;
  assert.equal(rounds[0].made.length, 1);
  assert.deepEqual({ ...rounds[0].made[0] }, { at: 58, special: 'bolt', kind: 5 });
  assert.equal(rounds[0].burst.length, 4);
  const bolt = b.cells.findIndex((c) => c.special === 'bolt');
  assert.ok(bolt >= 0);
  // Burst it: every cell of its row and column goes.
  const before = b.score;
  const caught = (b as any).settle(new Set([bolt]), [], 1);
  assert.equal(caught.burst.length, SIZE * 2 - 1);
  assert.equal(b.score - before, 150 + 120);
});

test('five in a line leave a star; a star swapped with a fruit clears every one of its kind', () => {
  const rows = [...QUIET];
  rows[7] = '55455123'; // 5 5 . 5 5 with a 5 above the gap
  rows[6] = '01530123';
  const b = laid(rows);
  const rounds = b.move(6 * SIZE + 2, 7 * SIZE + 2)!;
  assert.equal(rounds[0].made[0].special, 'star');
  const star = b.cells.findIndex((c) => c.special === 'star');
  const neighbour = star % SIZE < SIZE - 1 ? star + 1 : star - 1;
  const kind = b.cells[neighbour].kind;
  const count = b.cells.filter((c) => c.kind === kind).length;
  const r = b.move(star, neighbour)!;
  assert.equal(r[0].burst.length, count + 1);
});

test('a chain scores more each round, and a board with nothing to do is shuffled into one with a move', () => {
  const b = new Board(LEVELS[1], 3);
  let chained = false;
  for (let i = 0; i < 20 && b.state === 'play'; i++) {
    const m = bestMove(b)!;
    const rounds = b.move(m[0], m[1])!;
    if (rounds.length > 1) (chained = true), assert.ok(rounds[1].points >= rounds[1].burst.length * 20);
    assert.ok(b.hint(), 'always a move');
    assert.equal(Board.runs(b.cells).length, 0);
  }
  assert.ok(chained);
  // Nothing to do on this one: the next move anywhere else leaves it shuffled.
  const rows = [...QUIET];
  rows[7] = '55455123';
  const stuck = laid(rows, 11);
  stuck.move(7 * SIZE + 2, 7 * SIZE + 3);
  assert.ok(stuck.hint());
  assert.equal(Board.runs(stuck.cells).length, 0);
});

test('a player who takes the best move at hand clears most boards of every level, never all of the last', () => {
  const wins = LEVELS.map((level) => {
    let won = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const b = new Board(level, seed);
      while (b.state === 'play') {
        const m = bestMove(b)!;
        b.move(m[0], m[1]);
      }
      if (b.state === 'won') won++;
    }
    return won;
  });
  assert.ok(wins[0] >= 17, `level 1: ${wins}`);
  assert.ok(wins.every((w) => w >= 8), `${wins}`);
  assert.ok(wins[3] < 20, `the last level is not a walk: ${wins}`);
  const a = new Board(LEVELS[0], 9), c = clone(a);
  a.move(...bestMove(a)!);
  assert.equal(c.movesLeft, LEVELS[0].moves);
});
