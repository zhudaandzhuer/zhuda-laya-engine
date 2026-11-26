import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSS_AT, MAX_ENEMIES, MAX_LEVEL, RUN_SECONDS, Run, SLOTS, WEAPONS, bot, botChoose, metaCost, play } from '../src/core/run.ts';

const still = () => ({ mx: 0, my: 0 });

test('the same seed is the same run', () => {
  const a = play(11, bot, botChoose), b = play(11, bot, botChoose);
  assert.equal(a.time, b.time);
  assert.equal(a.player.kills, b.player.kills);
  assert.deepEqual([...a.weapons], [...b.weapons]);
});

test('standing still lasts the first minute and not the third', () => {
  for (let seed = 1; seed <= 4; seed++) {
    const r = play(seed, still, () => 0);
    assert.equal(r.state, 'dead');
    assert.ok(r.time > 45 && r.time < 150, `seed ${seed}: ${r.time}`);
  }
});

// The same seed is the same run on one machine, not on every machine: the run uses Math.hypot,
// atan2, sin, cos and pow, whose last bit differs between V8 versions and processors, and five
// minutes of play turn that into another run. So the share of wins is taken over enough runs for
// it not to hang on which ones: 24 seeds, a third to seven eighths of them won. (Seeds 1 to 8
// alone gave 4 to 7 wins on Linux x64 with Node 24 and 3 on macOS arm64 with Node 26; 40 seeds
// there gave 23, in eights 3, 6, 6, 2 and 6.)
test('a player who keeps moving and builds one kit wins about half its runs or more, never all, and the field fills', () => {
  const runs = Array.from({ length: 24 }, (_, i) => play(i + 1, bot, botChoose));
  const wins = runs.filter((r) => r.state === 'won').length;
  assert.ok(wins >= 8 && wins <= 21, `wins ${wins} of ${runs.length}`);
  // The field fills in most runs; a kit that kills fast enough keeps it from filling (two of 24 there).
  const filled = runs.filter((r) => r.peak >= 250).length;
  assert.ok(filled >= runs.length * 0.75, `the field filled in ${filled} of ${runs.length}`);
  for (const r of runs) {
    assert.ok(r.peak <= MAX_ENEMIES + 2, `peak ${r.peak}`);
    // A won run is a full five minutes with a kit built (the weakest of 15 wins there: level 13, 834 kills).
    if (r.state === 'won') assert.ok(r.player.level >= 10 && r.player.kills > 500 && Math.abs(r.time - RUN_SECONDS) < 0.1, `level ${r.player.level}, kills ${r.player.kills}, time ${r.time}`);
    if (r.time > BOSS_AT) assert.ok(r.bossSpawned);
  }
});

test('a level offers three different upgrades; the run waits for the choice', () => {
  const run = new Run(5);
  while (run.state === 'play') run.step(bot(run));
  assert.equal(run.state, 'choose');
  assert.equal(run.choices.length, 3);
  assert.equal(new Set(run.choices.map((c) => JSON.stringify(c))).size, 3);
  const t = run.time;
  run.step(still());
  assert.equal(run.time, t);
  run.choose(1);
  assert.equal(run.state, 'play');
});

test('slots are limited, levels stop at five, and a weapon evolves only with its partner', () => {
  const run = play(4, bot, botChoose);
  assert.ok(run.weapons.size <= SLOTS && run.passives.size <= SLOTS);
  for (const [id, w] of run.weapons) {
    assert.ok(w.level <= MAX_LEVEL);
    if (w.evolved) assert.ok(w.level === MAX_LEVEL && (run.passives.get(WEAPONS[id].evolve) ?? 0) > 0);
  }
  assert.ok([...run.weapons.values()].some((w) => w.evolved));
});

test('permanent upgrades help and cost more each time', () => {
  assert.ok(metaCost(1) > metaCost(0));
  const base = Array.from({ length: 6 }, (_, i) => play(i + 20, bot, botChoose).time).reduce((a, b) => a + b);
  const strong = Array.from({ length: 6 }, (_, i) => play(i + 20, bot, botChoose, { might: 5, vitality: 5, greed: 0 }).time).reduce((a, b) => a + b);
  assert.ok(strong >= base, `${strong} < ${base}`);
  assert.ok(new Run(1, { might: 0, vitality: 5, greed: 0 }).player.maxHp === 160);
});

test('a step with the field full stays cheap', () => {
  const run = new Run(3);
  let worst = 0, n = 0, total = 0;
  while (run.state === 'play' || run.state === 'choose') {
    if (run.state === 'choose') run.choose(botChoose(run));
    const t = performance.now();
    run.step(bot(run));
    const ms = performance.now() - t;
    if (run.enemies.length > 300) (worst = Math.max(worst, ms)), (total += ms), n++;
  }
  assert.ok(n > 100 && total / n < 4, `mean ${total / n} ms over ${n} full steps (worst ${worst})`);
});
