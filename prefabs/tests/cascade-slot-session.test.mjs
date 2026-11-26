// The source game's ledger gate (<original-cascade-slot> scripts/verify-all-gates.mjs, gate 2:
// commit before play, quota, crash recovery, concurrent accepts, corrupt save, short balance,
// 100-round audit), ported onto systems/slot-round's LocalSession with seeded cascade rounds.
import test from 'node:test';
import assert from 'node:assert/strict';

const { LocalSession } = await import('../systems/slot-round/local-session.ts');
const { createSeedResolver } = await import('../2d/cascade-math/seed-resolver.ts');
const { exampleConfig } = await import('../2d/cascade-math/example-config.ts');

const resolve = createSeedResolver(exampleConfig());
const KEY = 'cascade.local-session.v1';
class MemoryStorage {
  map = new Map();
  failOnSet = false;
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    if (this.failOnSet) throw Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' });
    this.map.set(k, String(v));
  }
}
let n = 0;
const open = async (storage) => {
  const s = new LocalSession({ storage, resolve, saveKey: KEY, rules: 'cascade-v1', bets: [10, 20, 50], uuid: () => `u${++n}`, now: () => 1 });
  await s.open();
  return s;
};

test('commit before play, quota, recovery, concurrency, corruption, short balance, 100-round audit', async () => {
  const storage = new MemoryStorage();
  const session = await open(storage);
  const r1 = await session.accept('seed:168', 10);
  const saved = JSON.parse(storage.getItem(KEY));
  assert.deepEqual([saved.sequence, r1.win, saved.points], [1, 204, 100000 - 10 + 204]);

  storage.failOnSet = true;
  await assert.rejects(session.accept('seed:2', 10), /無法保存/);
  storage.failOnSet = false;
  assert.equal(session.points, 100194);

  const again = await open(storage);
  assert.deepEqual([again.points, again.state.sequence], [100194, 1]);

  const [a, b] = await Promise.all([session.accept('seed:3', 10), session.accept('seed:4', 10)]);
  assert.ok(a.sequence < b.sequence);
  assert.equal(session.state.sequence, 3);

  const corrupt = new MemoryStorage();
  corrupt.setItem(KEY, '{corrupt json');
  await assert.rejects(open(corrupt), /內容損壞/);
  assert.equal(corrupt.getItem(KEY), '{corrupt json', 'a broken save is not overwritten');

  const poor = new MemoryStorage();
  const low = await open(poor);
  const state = JSON.parse(poor.getItem(KEY));
  state.sequence = 1;
  state.basePoints = 15;
  const empty = resolve('seed:1', 10);
  assert.equal(empty.p.mainWin + empty.b.total, 0);
  state.points = 5;
  state.rounds = [{ id: 'low-1', sequence: 1, fixture: 'seed:1', singleBet: 10, bet: 10, mainWin: 0, bonusWin: 0, win: 0, pointsAfter: 5, acceptedAt: 1, presented: true, burst: false }];
  poor.setItem(KEY, JSON.stringify(state));
  low.refresh();
  await assert.rejects(low.accept('seed:2', 10), /點數不足/);
  assert.equal(low.points, 5);

  await session.reset();
  for (let i = 0; i < 100; i++) {
    const before = session.points;
    const r = await session.accept(`seed:${1000 + i}`, 10);
    assert.equal(session.points, before - 10 + r.win, `round ${i}`);
  }
  assert.equal((await open(storage)).points, session.points);
});
