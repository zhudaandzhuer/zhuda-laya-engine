// 2d/slot-ui without the engine: the frame clock, win tiers, the control bar's rules, the
// cascade step player with fake ports on real seeded rounds, and the sound bridge with a fake
// audio adapter. (The Laya views are checked in viewer2d: scene cascade-slot.)
import test from 'node:test';
import assert from 'node:assert/strict';

const { FrameClock, easeOutQuad } = await import('../2d/slot-ui/frame-clock.ts');
const { winTier, DEFAULT_WIN_TIERS } = await import('../2d/slot-ui/win-tiers.ts');
const { ControlModel, stepBet, LONG_PRESS_MS } = await import('../2d/slot-ui/control-model.ts');
const { CascadeStepPlayer, DEFAULT_TIMINGS } = await import('../2d/slot-ui/step-player.ts');
const { SlotSoundBridge, NEUTRAL_CUES } = await import('../2d/slot-ui/sound-bridge.ts');
const { createSeedResolver } = await import('../2d/cascade-math/seed-resolver.ts');
const { exampleConfig } = await import('../2d/cascade-math/example-config.ts');

test('frame clock: waits and tweens follow update(), speed and finishAll', async () => {
  const clock = new FrameClock();
  const seen = [];
  let done = false;
  const tween = clock.tween(100, (t) => seen.push(Math.round(t * 100) / 100), easeOutQuad).then(() => (done = true));
  for (let i = 0; i < 3; i++) clock.update(0.04);
  await tween;
  assert.equal(done, true);
  assert.equal(seen.at(-1), 1);
  assert.equal(seen.length, 3);
  let waited = false;
  void clock.wait(1000).then(() => (waited = true));
  clock.speed = 4;
  clock.update(0.2);
  await Promise.resolve();
  assert.equal(waited, false);
  clock.update(0.06);
  await new Promise((r) => setImmediate(r));
  assert.equal(waited, true);
  let last = 0;
  void clock.tween(5000, (t) => (last = t));
  clock.finishAll();
  assert.equal(last, 1);
  assert.equal(clock.pending, 0);
});

test('win tiers and the control bar rules', () => {
  assert.equal(winTier(99, 10), null);
  assert.equal(winTier(100, 10).id, 'big');
  assert.equal(winTier(1000, 10).id, 'legend');
  assert.equal(winTier(30, 0).id, 'great'); // a zero bet counts as 1
  assert.equal(DEFAULT_WIN_TIERS.length, 4);
  assert.deepEqual([stepBet([10, 20, 50], 50, 1), stepBet([10, 20, 50], 50, 1, true), stepBet([10, 20, 50], 10, -1, true)], [50, 10, 50]);
  const m = new ControlModel([10, 20, 50]);
  assert.equal(m.step(1), 20);
  assert.equal(m.step(1), 50);
  assert.equal(m.step(1), null);
  m.action = 'accelerate';
  assert.equal(m.betEnabled, false);
  assert.equal(m.step(-1), null);
  assert.equal(m.autoEnabled, false);
  m.autoRemaining = 3;
  assert.equal(m.autoEnabled, true);
  m.action = 'wait';
  assert.equal(m.face.enabled, false);
  assert.equal(m.toggleBurst(), true);
  assert.equal(LONG_PRESS_MS, 360);
});

const resolve = createSeedResolver(exampleConfig());
const snapshot = (key, bet = 10) => {
  const { p, b } = resolve(key, bet);
  return { contractVersion: 1, id: key, sequence: 1, fixture: key, singleBet: bet, bet: p.totalBet, win: p.mainWin + b.total, mainWin: p.mainWin, bonusWin: b.total, pointsAfter: 0, presented: false, acceptedAt: 0, burst: false, p, b };
};
function fakes() {
  const calls = [];
  const board = {
    show: () => calls.push('show'),
    drop: async (_g, _o, ms) => void calls.push(`drop ${ms}`),
    tumble: async (f, fast) => void calls.push(`tumble ${f.wave}${fast ? ' fast' : ''}`),
    multiply: async (_o, base, m, win) => void calls.push(`multiply ${base}×${m}=${win}`),
    noWin: () => calls.push('no-win'),
    idle: () => calls.push('idle'),
  };
  const celebration = { play: async (win, _bet, tier, o) => void calls.push(`celebrate ${tier.id} ${win}${o?.title ? ' ' + o.title : ''}`), collect: () => calls.push('collect') };
  const hud = { setWin: (n) => calls.push(`win ${n}`), setTitle: () => {}, setMultiplier: (m) => calls.push(`meter ${m}`), setFreeSpins: () => {} };
  const sound = { play: (c) => calls.push(`sound ${c}`) };
  const phases = [];
  const context = (mode = 'normal') => ({ replay: false, mode, phase: (p) => phases.push(p), getAuto: () => ({}), shouldFinish: () => true });
  return { calls, phases, context, ports: { board, celebration, hud, sound, wait: async () => {} } };
}

test('step player: drop, every wave, multiplier, coins, celebration — in the source\'s order and timings', async () => {
  const f = fakes();
  const player = new CascadeStepPlayer(f.ports);
  const round = snapshot('seed:168');
  player.accepted(round, f.context());
  await player.play(round, f.context());
  player.complete(round, f.context());
  const shown = f.calls.filter((c) => !c.startsWith('sound') && !c.startsWith('meter'));
  assert.deepEqual(shown, ['idle', `drop ${DEFAULT_TIMINGS.dropMs}`, 'tumble 1', 'tumble 2', 'tumble 3', 'tumble 4', 'multiply 51×4=204', 'win 204', 'celebrate big 204', 'idle', 'win 204']);
  assert.deepEqual(f.phases, ['revealing', 'resolving', 'celebration', 'idle']);
  assert.ok(f.calls.includes('meter 4'));
  assert.deepEqual(f.calls.filter((c) => c.startsWith('sound')).slice(0, 3), ['sound spin', 'sound tumble', 'sound tumble']);
  assert.deepEqual(player.trace, ['drop', 'wave:1', 'wave:2', 'wave:3', 'wave:4', 'multiply:4', 'celebrate:big']);
});

test('step player: turbo skips the celebration; a losing round waits; accelerate and collect', async () => {
  const f = fakes();
  let speed = 'normal';
  const player = new CascadeStepPlayer({ ...f.ports, onAccelerate: (on) => (speed = on ? 'fast' : 'normal') });
  await player.play(snapshot('seed:168'), f.context('burst'));
  assert.ok(f.calls.includes(`drop ${DEFAULT_TIMINGS.dropFastMs}`) && f.calls.includes('tumble 1 fast'));
  assert.ok(!f.calls.some((c) => c.startsWith('celebrate')));
  f.calls.length = 0;
  await player.play(snapshot('seed:1'), f.context());
  assert.ok(f.calls.includes('no-win') && !f.calls.some((c) => c.startsWith('tumble')));
  player.accelerate();
  assert.equal(speed, 'fast');
  assert.equal(player.accelerated, true);
  player.collect();
  player.finalize();
  assert.equal(speed, 'normal');
  assert.ok(f.calls.includes('collect') && f.calls.includes('sound collect'));
});

test('step player: free spins play the round\'s real spins and end with the feature total', async () => {
  const f = fakes();
  const player = new CascadeStepPlayer(f.ports);
  const round = snapshot('seed:22:buy');
  await player.play(round, f.context());
  assert.equal(player.trace.filter((t) => t.startsWith('free:')).length, round.b.spins.length);
  assert.equal(f.calls.filter((c) => c.startsWith('drop')).length, 1 + round.b.spins.length);
  assert.ok(f.calls.includes(`celebrate feature ${round.b.total} 免費遊戲總贏分`));
  assert.ok(f.calls.includes(`meter ${round.b.spins.at(-1).globalMultiplier}`));
  assert.equal(f.calls.filter((c) => c.startsWith('win ')).at(-1), `win ${round.win}`);
  assert.deepEqual(f.phases.slice(0, 3), ['revealing', 'resolving', 'bonus']);
});

test('sound bridge: tones through the adapter, samples once loaded, mute, unknown cues', () => {
  const tones = [];
  const samples = [];
  let muted = null;
  const adapter = { scheduleTone: (o) => (tones.push(o), true), playSample: (o) => (samples.push(o), true), setMuted: (m) => (muted = m), unlockAudio: () => true };
  const bridge = new SlotSoundBridge(adapter, { ...NEUTRAL_CUES, coin: { ...NEUTRAL_CUES.coin, sample: 'sfx/coin.ogg' } });
  assert.equal(bridge.unlock(), true);
  assert.equal(bridge.play('multiplier'), true);
  assert.equal(tones.length, NEUTRAL_CUES.multiplier.tones.length);
  assert.deepEqual(tones.map((t) => t.delaySec), NEUTRAL_CUES.multiplier.tones.map((n) => n.at));
  assert.ok(new Set(tones.map((t) => t.id)).size === tones.length && tones.every((t) => t.channel === 'sfx'));
  bridge.play('coin');
  assert.equal(samples.length, 0); // not loaded yet: tones
  bridge.markLoaded('sfx/coin.ogg');
  bridge.play('coin');
  assert.deepEqual(samples.map((s) => s.sampleId), ['sfx/coin.ogg']);
  assert.equal(bridge.play('nope'), false);
  bridge.setEnabled(false);
  assert.equal(muted, true);
  assert.equal(bridge.play('spin'), false);
  assert.equal(new SlotSoundBridge(null).play('spin'), false);
  assert.equal(bridge.lastCue, 'coin');
});
