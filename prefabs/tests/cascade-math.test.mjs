// 2d/cascade-math: the TypeScript cascade engine is the Go server's (same digests as
// server/slotmath/testdata/parity.json), the seeded rounds feed LocalSession, and the fixture
// pipeline. No browser, no engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const { CascadeEngine, evaluate } = await import('../2d/cascade-math/engine.ts');
const { Mulberry32, createSeededRng, buildStrip } = await import('../2d/cascade-math/rng.ts');
const { exampleConfig } = await import('../2d/cascade-math/example-config.ts');
const { pay, scatterPay, cost, validateConfig } = await import('../2d/cascade-math/config.ts');
const { createSeedResolver, seedKey, parseSeedKey } = await import('../2d/cascade-math/seed-resolver.ts');
const { resolveFixture, fixtureContext, createFixturePipeline, targetMatchBonus } = await import('../2d/cascade-math/fixture-pipeline.ts');
const { exampleFixtureConfig } = await import('../2d/cascade-math/example-fixtures.ts');
const { LocalSession } = await import('../systems/slot-round/local-session.ts');

// encoding/json's map order: keys sorted, absent fields left out
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

test('the TypeScript engine plays the Go server\'s rounds (parity digests, 90 rounds incl. bought free spins)', () => {
  const want = JSON.parse(fs.readFileSync(new URL('../server/slotmath/testdata/parity.json', import.meta.url), 'utf8'));
  assert.equal(want.length, 90);
  for (const w of want) {
    const r = new CascadeEngine(exampleConfig(), new Mulberry32(w.seed), { now: () => 0 }).spin(w.request, 'parity');
    assert.equal(r.totalWin, w.totalWin, `seed ${w.seed}`);
    assert.equal(createHash('sha256').update(canon(r)).digest('hex'), w.sha256, `seed ${w.seed} ${JSON.stringify(w.request)}`);
  }
});

test('Mulberry32: the Go generator\'s values; createSeededRng is the source client\'s generator', () => {
  const m = new Mulberry32(1);
  assert.deepEqual([m.next(), m.next(), m.next()], [2693262067, 11749833, 2265367787]);
  const n = new Mulberry32(1);
  assert.deepEqual(Array.from({ length: 8 }, () => n.intN(171)), [107, 0, 90, 167, 165, 48, 104, 123]);
  assert.equal(n.intN(0), 0);
  const r = createSeededRng(20261101);
  assert.equal(Math.round(r() * 4294967296), 2894595015);
  const strip = buildStrip({ 3: 2, 1: 4, 9: 1 }, 5);
  assert.deepEqual([...strip].sort(), [1, 1, 1, 1, 3, 3, 9]);
  assert.deepEqual(strip, buildStrip({ 1: 4, 3: 2, 9: 1 }, 5));
});

test('paytable tiers, scatter pays, costs and config checks', () => {
  const c = exampleConfig();
  assert.deepEqual([7, 8, 10, 11, 13, 14, 30].map((k) => pay(c, 1, k, 10)), [0, 60, 60, 150, 150, 300, 300]);
  assert.equal(pay(c, 8, 8, 15), 6);
  assert.equal(pay(c, c.scatterSymbol, 9, 10), 0);
  assert.deepEqual([3, 4, 5, 6, 9].map((k) => scatterPay(c, k, 10)), [0, 20, 50, 200, 200]);
  assert.deepEqual(cost(c, { betAmount: 20, anteBet: true, buyFeature: true }), [20, 30]);
  assert.deepEqual(cost(c, { betAmount: 0, buyFeature: true }), [10, 800]);
  assert.throws(() => validateConfig({ ...c, baseReels: c.baseReels.slice(1) }), /strips/);
  assert.throws(() => validateConfig({ ...c, paySymbols: [...c.paySymbols, c.multiplierSymbol], paytable: { ...c.paytable, [c.multiplierSymbol]: [{ min: 8, pay: 1 }] } }), /scatter\/multiplier/);
  const grid = Array.from({ length: 30 }, (_, i) => 3 + (i % 5));
  for (const i of [0, 3, 7, 10, 14, 17, 21, 23]) grid[i] = 8;
  const { awards, winning } = evaluate(c, grid, 10);
  assert.equal(awards.length, 1);
  assert.deepEqual([awards[0].symbol, awards[0].count, awards[0].amount, winning.size], [8, 8, 4, 8]);
});

test('seeded rounds: the same key is the same round, and LocalSession re-checks them on every load', async () => {
  const cfg = exampleConfig();
  const resolve = createSeedResolver(cfg);
  assert.deepEqual(parseSeedKey('seed:22:buy'), { seed: 22, mode: 'buy' });
  assert.equal(parseSeedKey('seed:x'), null);
  assert.equal(seedKey(7, 'ante'), 'seed:7:ante');
  assert.deepEqual(resolve('seed:168', 10), resolve('seed:168', 10));
  const r = resolve('seed:168', 10);
  assert.deepEqual([r.p.spin.waves.length, r.p.spin.multiplier, r.p.mainWin, r.p.totalBet], [4, 4, 204, 10]);
  const bought = resolve('seed:22:buy', 10);
  assert.deepEqual([bought.p.totalBet, bought.b.spins.length, bought.b.total], [800, 12, 1585]);
  assert.equal(bought.b.spins.reduce((n, s) => n + s.win, 0), bought.b.total);
  assert.throws(() => resolve('three', 10), /unknown round key/);

  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  let id = 0;
  const make = () => new LocalSession({ storage, resolve, saveKey: 'cascade.v1', rules: 'cascade-example-v1', bets: [10, 20, 50, 100], uuid: () => `u${++id}`, now: () => 1 });
  const a = make();
  await a.open();
  for (const key of ['seed:1', 'seed:168', 'seed:22:buy', 'seed:5:ante']) await a.accept(key, 10);
  const expected = 100000 - 10 + resolve('seed:1', 10).p.mainWin - 10 + 204 - 800 + 1605 - 15 + resolve('seed:5:ante', 10).p.mainWin + resolve('seed:5:ante', 10).b.total;
  assert.equal(a.points, expected);
  const b = make();
  await b.open(); // every round re-played and checked
  assert.equal(b.points, expected);
  const save = JSON.parse(data.get('cascade.v1'));
  save.rounds[1].win += 1;
  data.set('cascade.v1', JSON.stringify(save));
  await assert.rejects(make().open(), /存檔未被覆寫/);
});

test('fixture pipeline: scripted rounds, seeded random grids, target-match bonus, refused bets', () => {
  const cfg = exampleFixtureConfig();
  assert.equal(resolveFixture(cfg, 'empty', 10).p.mainWin, 0);
  const small = resolveFixture(cfg, 'small', 20);
  assert.deepEqual([small.p.mainWin, small.p.tumbleCount, small.p.cue], [8, 1, 'small']);
  const double = resolveFixture(cfg, 'double', 10);
  assert.deepEqual([double.p.awards.length, double.p.totalMultiplier, double.p.mainWin, double.p.cue], [2, 5, (16 + 8) * 5, 'multi']);
  assert.deepEqual(double.p.steps.map((s) => s.type), ['INITIAL_GRID', 'PAY_ANYWHERE_EVAL', 'TUMBLE_DROP', 'MULTIPLIER_ORB_HIT']);
  const frame = double.p.tumbleFrames[1];
  assert.equal(frame.gridBefore.join(), double.p.tumbleFrames[0].gridAfter.join());
  const feature = resolveFixture(cfg, 'feature', 10);
  assert.deepEqual([feature.p.opportunities, feature.p.cue, feature.b.beats.length], [2, 'feature', 3]);
  assert.equal(feature.b.total, feature.b.beats.at(-1).cumulative);
  assert.equal(resolveFixture(cfg, 'nope', 10).p.grid.join(), cfg.fixtures.small.grid.join());
  for (const bad of [11, 0, -10, NaN]) assert.throws(() => resolveFixture(cfg, 'small', bad), /非法單注金額/);
  // a seeded random grid finishes synchronously and replays
  const run = (seed) => {
    const ctx = fixtureContext(cfg, 'random', 10, seed);
    createFixturePipeline(cfg).executeSync(ctx);
    return ctx;
  };
  assert.equal(run(9).steps.length > 0, true);
  assert.deepEqual(run(9), run(9));
  assert.notDeepEqual(run(9).grid, run(10).grid);
  // the cost target spends a chance; full rows add the full value
  const beats = targetMatchBonus(cfg, [[0, 1, 2, 3, 4], [5, 5, 5, 5, 5]], 10, 1);
  assert.deepEqual(beats.beats.map((b) => [b.before, b.remaining, b.amount]), [[1, 0, 0]]);
  assert.equal(targetMatchBonus(cfg, [[5, 5, 5, 5, 5]], 10, 1).total, (4 * 4 + 80) * 10);
});
