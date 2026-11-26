import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../src/core/board.ts';

const T0 = Date.UTC(2026, 10, 25);
const item = (chain: B.Chain, tier: number): B.Cell => ({ kind: 'item', chain, tier });

test('two of a kind make the next dish; the top dish does not merge', () => {
  const s = B.newState(T0);
  s.cells[0] = item('veg', 2);
  s.cells[1] = item('veg', 2);
  assert.deepEqual(B.drag(s, 0, 1), { ok: true, what: 'merge', at: 1, tier: 3 });
  assert.equal(s.cells[0], null);
  s.cells[0] = item('veg', B.TOP);
  s.cells[1] = item('veg', B.TOP);
  assert.equal((B.drag(s, 0, 1) as any).what, 'swap');
});

test('a drag moves to a free cell and swaps with anything else, sources included; nothing is lost', () => {
  const s = B.newState(T0);
  s.cells[0] = item('veg', 1);
  s.cells[1] = item('tea', 1);
  const count = () => s.cells.filter(Boolean).length;
  const before = count();
  assert.equal((B.drag(s, 0, 5) as any).what, 'move');
  assert.equal((B.drag(s, 5, 1) as any).what, 'swap');
  const source = s.cells.findIndex((c) => c?.kind === 'source');
  assert.equal((B.drag(s, 1, source) as any).what, 'swap');
  assert.equal(s.cells[1]?.kind, 'source');
  assert.equal(count(), before);
});

test('a source costs one energy, drops beside itself, refuses without energy or room', () => {
  const s = B.newState(T0);
  const source = s.cells.findIndex((c) => c?.kind === 'source');
  const r = B.tap(s, source);
  assert.ok(r.ok && r.what === 'spawn' && Math.abs((r.at % B.COLS) - (source % B.COLS)) + Math.abs(Math.floor(r.at / B.COLS) - Math.floor(source / B.COLS)) === 1);
  assert.equal(s.energy, B.MAX_ENERGY - 1);
  s.energy = 0;
  assert.deepEqual(B.tap(s, source), { ok: false, why: 'energy' });
  s.energy = 5;
  for (let i = 0; i < B.CELLS; i++) s.cells[i] ??= item('veg', 0);
  assert.deepEqual(B.tap(s, source), { ok: false, why: 'full' });
  assert.equal(B.sell(s, 0), 1);
  assert.ok(B.tap(s, source).ok);
});

test('energy comes back one every thirty seconds, up to the cap; coins buy it', () => {
  const s = B.newState(T0);
  s.energy = 10;
  B.tick(s, T0 + 95_000);
  assert.equal(s.energy, 13);
  assert.equal(Math.round(B.nextEnergyIn(s, T0 + 95_000)), 25);
  B.tick(s, T0 + 3 * 3600_000);
  assert.equal(s.energy, B.MAX_ENERGY);
  s.energy = 0;
  s.coins = 150;
  assert.ok(B.buyEnergy(s) && s.energy === 30 && s.coins === 0 && !B.buyEnergy(s));
});

test('serving takes exactly what was asked and pays; a level refills energy and brings the third source', () => {
  const s = B.newState(T0);
  s.orders[0] = { who: 'bai-zhi', wants: [{ chain: 'veg', tier: 1 }, { chain: 'veg', tier: 1 }], coins: 9, xp: 500 };
  s.cells[0] = item('veg', 1);
  assert.equal(B.serve(s, 0), null);
  s.cells[1] = item('veg', 1);
  s.cells[2] = item('veg', 1);
  s.energy = 20;
  const r = B.serve(s, 0)!;
  assert.ok(r.levelUp && r.arrived === 'bun' && s.level >= 3 && s.coins === 9);
  assert.equal(s.cells.filter((c) => c?.kind === 'item').length, 1);
  assert.equal(s.cells.filter((c) => c?.kind === 'source').length, 3);
  assert.ok(s.energy > 20);
  assert.equal(new Set(s.orders.map((o) => o.who)).size, 3);
});

test('a patient player reaches the last level; orders are always makeable; the board never jams', () => {
  for (const seed of [1, 2, 3]) {
    const s = B.newState(T0, seed);
    let now = T0, moves = 0, waits = 0;
    while (!s.done && moves < 60000) {
      B.tick(s, now);
      const m = B.botMove(s);
      if (m.do === 'wait') (now += 60_000), waits++;
      else (now += 1500), B.apply(s, m);
      moves++;
      for (const o of s.orders) for (const w of o.wants) assert.ok(w.tier >= 1 && w.tier <= B.TOP && s.level >= B.SOURCE_LEVEL[w.chain]);
    }
    assert.ok(s.done, `seed ${seed}: level ${s.level} after ${moves} moves`);
    const hours = (now - T0) / 3600_000;
    assert.ok(hours > 1 && hours < 40, `seed ${seed}: ${hours.toFixed(1)} h, ${s.served} served, ${waits} waits`);
  }
});
