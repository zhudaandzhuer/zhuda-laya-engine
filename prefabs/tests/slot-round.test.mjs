// systems/slot-round: the round runtime, auto-advance and the local play-money ledger,
// run without a browser (fake storage, fake presentation, fake timers).
import test from 'node:test';
import assert from 'node:assert/strict';

const { primaryAction } = await import('../systems/slot-round/contracts.ts');
const { GameRuntime } = await import('../systems/slot-round/game-runtime.ts');
const { LocalSession } = await import('../systems/slot-round/local-session.ts');
const { AutoAdvance } = await import('../systems/slot-round/auto-advance.ts');
const { Diagnostics } = await import('../systems/slot-round/diagnostics.ts');
const { MathEngine } = await import('../2d/dungeon-spin/math.ts');

const memory = () => {
  const data = new Map();
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
};
let ids = 0;
const session = (storage = memory(), extra = {}) =>
  new LocalSession({ storage, resolve: (f, b) => MathEngine.resolve(f, b), uuid: () => `u${++ids}`, now: () => 1000, ...extra });
const tick = () => new Promise((r) => setImmediate(r));

test('the big button: wait, stop, collect-next, accelerate, advance', () => {
  const base = { ready: true, busy: false, roundBusy: false, finalizing: false, phase: 'idle', auto: { running: false, stopping: false } };
  assert.equal(primaryAction({ ...base, ready: false }), 'wait');
  assert.equal(primaryAction({ ...base, auto: { running: true, stopping: false } }), 'stop');
  assert.equal(primaryAction({ ...base, auto: { running: true, stopping: true } }), 'wait');
  assert.equal(primaryAction({ ...base, finalizing: true }), 'wait');
  assert.equal(primaryAction({ ...base, roundBusy: true, phase: 'walking' }), 'accelerate');
  assert.equal(primaryAction({ ...base, roundBusy: true, phase: 'celebration' }), 'collect-next');
  assert.equal(primaryAction({ ...base, roundBusy: true, phase: 'preview' }), 'collect-next');
  assert.equal(primaryAction(base), 'advance');
});

test('a round is saved before it is shown, then marked presented; the button follows the phases', async () => {
  const storage = memory();
  const s = session(storage, { saveKey: 'test.v1', rules: 'original-fixed-v1' });
  await s.open();
  const seen = [];
  let release;
  const presentation = {
    play: async (round, ctx) => {
      // already in the save when the presentation starts
      const saved = JSON.parse(storage.getItem('test.v1'));
      seen.push(['play', saved.sequence, saved.rounds.at(-1).presented, round.win]);
      ctx.phase('walking');
      await new Promise((r) => (release = r));
      ctx.phase('celebration');
      await new Promise((r) => (release = r));
    },
    accelerate: () => seen.push('accelerate'),
    collect: () => { seen.push('collect'); release(); },
  };
  const runtime = new GameRuntime({ presentation, initial: { fixture: 'multi', singleBet: 10, mode: 'normal' } });
  const primaries = [];
  runtime.subscribe((e) => primaries.push(e.state.primary));
  runtime.attachSession(s);
  assert.equal(runtime.state.primary, 'advance');
  const done = runtime.advance();
  await tick();
  assert.deepEqual(seen[0], ['play', 1, false, 12030]);
  assert.equal(runtime.state.primary, 'accelerate');
  await runtime.advance(); // accelerate
  assert.ok(seen.includes('accelerate'));
  release();
  await tick();
  assert.equal(runtime.state.phase, 'celebration');
  assert.equal(runtime.state.primary, 'collect-next');
  const before = s.state.sequence;
  await runtime.advance(); // collect, then the queued advance plays the next round
  await done;
  await tick();
  assert.ok(seen.includes('collect'));
  assert.equal(s.state.sequence, before + 1, 'collect-next queued another round');
  release(); await tick(); release(); await tick(); await tick();
  const save = JSON.parse(storage.getItem('test.v1'));
  assert.equal(save.rounds[0].presented, true);
  assert.equal(save.points, 100000 - 90 + 12030 - 90 + 12030);
  assert.ok(primaries.includes('accelerate') && primaries.includes('collect-next'));
});

test('a presentation that throws never undoes the accepted round', async () => {
  const s = session();
  await s.open();
  const recovered = [];
  const runtime = new GameRuntime({
    presentation: { play: () => { throw new Error('boom'); }, recover: (round, err) => recovered.push([round.sequence, err.message]) },
    initial: { fixture: 'three', singleBet: 20 },
  });
  runtime.attachSession(s);
  const result = await runtime.play();
  assert.equal(result.presentationError.message, 'boom');
  assert.deepEqual(recovered, [[1, 'boom']]);
  assert.equal(s.points, 100000 - 180 + 200);
  assert.equal(s.last.presented, false);
  assert.equal(runtime.state.phase, 'idle');
  assert.equal(runtime.state.primary, 'advance');
});

test('auto-advance plays the batch with pauses, audits each result, and stops when asked', async () => {
  const s = session();
  await s.open();
  const timers = [];
  const runtime = new GameRuntime({
    presentation: { play: () => {} },
    initial: { fixture: 'empty', singleBet: 10 },
    timer: (fn, ms) => (timers.push([fn, ms]), timers.length),
    cancelTimer: () => {},
  });
  runtime.attachSession(s);
  const batch = runtime.startAuto(3);
  for (let i = 0; i < 20 && !timers.length; i++) await tick();
  assert.equal(timers[0][1], 450, 'default pause between rounds');
  assert.equal(runtime.state.primary, 'stop');
  timers.shift()[0]();
  for (let i = 0; i < 20 && !timers.length; i++) await tick();
  timers.shift()[0]();
  assert.equal(await batch, true);
  assert.equal(runtime.auto.state.completed, 3);
  assert.equal(runtime.auto.state.reason, 'complete');
  assert.equal(runtime.auto.state.net, -270);
  assert.equal(runtime.lastAutoCount, 3);
  // stop during a batch: the round being shown finishes, then the batch ends
  const again = runtime.startAuto(10);
  for (let i = 0; i < 20 && !timers.length; i++) await tick();
  runtime.advance(); // primary is 'stop'
  assert.equal(await again, false);
  assert.equal(runtime.auto.state.reason, 'stopped');
  assert.equal(runtime.auto.state.completed, 1);
  await assert.rejects(new AutoAdvance({ play: async () => true }).start(1000), /1–999/);
});

test('auto-advance refuses a repeated round id', async () => {
  // the timer must call back later, never synchronously (done() reads the id the timer returns)
  const auto = new AutoAdvance({ play: async () => ({ id: 'same', bet: 90, win: 0, replay: false }), delayMs: 0, timer: (fn) => setImmediate(fn), cancelTimer: clearImmediate });
  assert.equal(await auto.start(3), false);
  assert.equal(auto.state.reason, 'error');
  assert.match(auto.state.error.message, /重複回合/);
});

test('the ledger re-checks the whole save on every read and refuses a tampered one', async () => {
  const storage = memory();
  const s = session(storage, { saveKey: 'k.v1' });
  await s.open();
  await s.accept('boss', 10);
  await s.accept('three', 50);
  assert.equal(s.points, 100000 - 90 + 850 + 45360 - 450 + 500);
  const save = JSON.parse(storage.getItem('k.v1'));
  storage.setItem('k.v1', JSON.stringify({ ...save, points: save.points + 1 }));
  assert.throws(() => s.refresh(), /存檔未被覆寫：本地存檔總額核對失敗/);
  storage.setItem('k.v1', JSON.stringify({ ...save, rounds: save.rounds.map((r, i) => (i ? { ...r, win: r.win + 10 } : r)) }));
  assert.throws(() => s.refresh(), /金額核對失敗/);
  storage.setItem('k.v1', '{nope');
  assert.throws(() => s.refresh(), /內容損壞/);
  storage.setItem('k.v1', JSON.stringify({ ...save, rules: 'other-rules' }));
  assert.throws(() => s.refresh(), /格式不符/);
});

test('a failed write leaves the points as they were; the save keeps the last `limit` rounds', async () => {
  const storage = memory();
  const s = session(storage, { limit: 3 });
  await s.open();
  for (let i = 0; i < 5; i++) await s.accept('three', 10);
  const save = JSON.parse(storage.getItem('slot-round.local-session.v1'));
  assert.equal(save.rounds.length, 3);
  assert.equal(save.sequence, 5);
  assert.equal(save.basePoints, 100000 + 2 * 10);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(s.accept('three', 10), /點數尚未變更/);
  assert.equal(s.points, 100000 + 5 * 10);
});

test('options: save key, lock name, starting points and bets', async () => {
  const storage = memory();
  const locks = [];
  const s = session(storage, { saveKey: 'dungeon-spin.local-session.v1', rules: 'original-fixed-v1', initialPoints: 500, bets: [5, 10], lock: async (name, cb) => (locks.push(name), cb()) });
  await s.open();
  assert.deepEqual(locks, ['dungeon-spin.local-session']);
  assert.equal(JSON.parse(storage.getItem('dungeon-spin.local-session.v1')).points, 500);
  assert.equal(s.fresh().rules, 'original-fixed-v1');
  const runtime = new GameRuntime({ presentation: { play: () => {} }, bets: [5, 10], initial: { fixture: 'three' } });
  assert.equal(runtime.selection.singleBet, 5);
  assert.equal(runtime.configure({ singleBet: 10 }), true);
  assert.throws(() => runtime.configure({ singleBet: 20 }), /回合設定不符/);
  assert.throws(() => new GameRuntime({ presentation: {} }), /PresentationPort\.play/);
});

test('a reload replays the last saved round instead of losing it', async () => {
  const storage = memory();
  const first = session(storage);
  await first.open();
  await first.accept('boss', 20);
  const second = session(storage);
  await second.open();
  const runtime = new GameRuntime({ presentation: { play: () => {} } });
  runtime.attachSession(second);
  assert.equal(runtime.last.fixture, 'boss');
  assert.equal(runtime.selection.fixture, 'boss');
  assert.equal(runtime.selection.singleBet, 20);
  assert.equal(runtime.last.b.total, 90720);
  const d = new Diagnostics({ limit: 2, now: () => 7 });
  d.record('a'); d.record('b', { x: 1 }); d.record('c');
  assert.deepEqual(d.export().entries.map((e) => e.type), ['b', 'c']);
});
