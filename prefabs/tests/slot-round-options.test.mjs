// systems/slot-round options taken in from <original-cascade-slot> (fsm, beforeRound, contractVersion);
// without them the module is dungeon-spin's (tests/slot-round.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';

const { GameRuntime } = await import('../systems/slot-round/game-runtime.ts');
const { LocalSession } = await import('../systems/slot-round/local-session.ts');
const { Diagnostics } = await import('../systems/slot-round/diagnostics.ts');

const memory = () => {
  const data = new Map();
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
};
// a tiny rule set: fixture 'w<n>' wins n, anything else wins nothing; a bet costs the bet
const resolve = (f, bet) => ({ p: { totalBet: bet, mainWin: /^w(\d+)$/.test(f) ? Number(f.slice(1)) : 0 }, b: { total: 0 } });
let n = 0;
const session = (extra = {}) => new LocalSession({ storage: memory(), resolve, uuid: () => `u${++n}`, now: () => 5, ...extra });
const tick = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

test('fsm: phases move the formal state; an unexpected step is recorded, not refused', async () => {
  const seen = [];
  const presentation = {
    play: async (_r, ctx) => {
      ctx.phase('revealing');
      ctx.phase('resolving');
      ctx.phase('celebration');
      ctx.phase('bonus'); // celebration → bonus is not a valid step
    },
  };
  const s = session();
  await s.open();
  const runtime = new GameRuntime({ presentation, fsm: true, initial: { fixture: 'w5' } });
  runtime.subscribe((e) => seen.push(e.state.fsmState));
  runtime.attachSession(s);
  assert.equal(runtime.state.fsmState, 'IDLE');
  await runtime.advance();
  assert.deepEqual([...new Set(seen)], ['IDLE', 'BET_COMMITTED', 'REVEALING', 'RESOLVING', 'CELEBRATING', 'BONUS']);
  assert.equal(runtime.state.fsmState, 'IDLE');
  const warning = runtime.diagnostics.entries.find((e) => e.type === 'fsm.warning');
  assert.deepEqual([warning.from, warning.to], ['CELEBRATING', 'BONUS']);
  assert.ok(runtime.diagnostics.entries.every((e) => 'fsmState' in e));
  assert.equal(runtime.diagnostics.tail(2).length, 2);
});

test('without fsm the state and the records have no fsmState (dungeon-spin unchanged)', async () => {
  const s = session();
  await s.open();
  const runtime = new GameRuntime({ presentation: { play: async () => {} } });
  runtime.attachSession(s);
  await runtime.advance();
  assert.ok(!('fsmState' in runtime.state));
  assert.ok(runtime.diagnostics.entries.every((e) => !('fsmState' in e)));
});

test('beforeRound gives every round, manual or auto, its own fixture', async () => {
  const s = session();
  await s.open();
  let next = 1;
  const played = [];
  const runtime = new GameRuntime({
    presentation: { play: async (r) => void played.push(r.fixture) },
    beforeRound: (_sel, { fromAuto }) => ({ fixture: `w${next++}`, ...(fromAuto ? {} : {}) }),
    timer: (fn) => setImmediate(fn),
    cancelTimer: () => {},
  });
  runtime.attachSession(s);
  await runtime.advance();
  await runtime.advance();
  const auto = runtime.startAuto(3);
  await tick();
  assert.equal(await auto, true);
  assert.deepEqual(played, ['w1', 'w2', 'w3', 'w4', 'w5']);
  assert.equal(s.points, 100000 - 5 * 10 + (1 + 2 + 3 + 4 + 5));
  // a throwing beforeRound refuses the round and keeps the money
  const broken = new GameRuntime({ presentation: { play: async () => {} }, beforeRound: () => { throw Error('no seed'); } });
  const s2 = session();
  await s2.open();
  broken.attachSession(s2);
  assert.equal(await broken.advance(), false);
  assert.equal(s2.points, 100000);
  assert.ok(broken.diagnostics.entries.some((e) => e.type === 'beforeRound.error'));
});

test('contractVersion stamps saved rounds and replays; off by default', async () => {
  const on = session({ contractVersion: true, saveKey: 'k.v1' });
  await on.open();
  await on.accept('w3', 10);
  assert.equal(on.state.rounds[0].contractVersion, 1);
  assert.equal(Object.keys(on.state.rounds[0])[0], 'contractVersion');
  assert.equal(on.replay().contractVersion, 1);
  const off = session();
  await off.open();
  await off.accept('w3', 10);
  assert.ok(!('contractVersion' in off.state.rounds[0]));
  assert.ok(!('contractVersion' in off.replay()));
  assert.ok(new Diagnostics().tail(3).length === 0);
});
