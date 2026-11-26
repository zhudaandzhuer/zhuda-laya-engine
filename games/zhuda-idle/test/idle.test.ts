import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as G from '../src/core/idle.ts';
import { session } from '../src/core/bot.ts';

const T0 = Date.UTC(2026, 10, 25, 1, 0, 0);
const HOUR = 3600_000;
const rich = () => Object.assign(G.newSave(T0, 7), { jade: 100 * 200000 });

test('the published rates are the rates: 200,000 pulls', () => {
  const save = rich();
  const seen = { R: 0, SR: 0, SSR: 0 };
  for (let i = 0; i < 20000; i++) for (const p of G.summon(save, 10)!) seen[p.rarity] += 1;
  const n = 200000;
  // With pity the SSR share is above the base 2 %; the hard pity bounds it.
  assert.ok(seen.SSR / n > G.RATES.SSR && seen.SSR / n < 0.035, `SSR ${seen.SSR / n}`);
  assert.ok(seen.SR / n > G.RATES.SR - 0.01 && seen.SR / n < 0.2, `SR ${seen.SR / n}`);
  assert.equal(seen.R + seen.SR + seen.SSR, n);
});

test('pity: never 60 pulls without an SSR, never ten without an SR or better', () => {
  const save = rich();
  let dry = 0, worst = 0, grey = 0, worstGrey = 0;
  for (let i = 0; i < 5000; i++)
    for (const p of G.summon(save, 10)!) {
      dry = p.rarity === 'SSR' ? 0 : dry + 1;
      grey = p.rarity === 'R' ? grey + 1 : 0;
      worst = Math.max(worst, dry);
      worstGrey = Math.max(worstGrey, grey);
    }
  assert.ok(worst < G.HARD_PITY, `longest dry run ${worst}`);
  assert.ok(worstGrey <= 9, `longest run of R ${worstGrey}`);
  assert.equal(G.ssrChance(G.HARD_PITY - 1), 1);
  assert.equal(G.ssrChance(0), G.RATES.SSR);
  assert.ok(G.ssrChance(50) > G.ssrChance(45) && G.ssrChance(45) > G.ssrChance(43));
});

test('a summon costs tickets first, then jade, and refuses when short', () => {
  const save = G.newSave(T0);
  save.tickets = 4;
  save.jade = 650;
  assert.deepEqual(G.summonCost(save, 10), { tickets: 4, jade: 600 });
  assert.equal(G.summon(save, 10)!.length, 10);
  assert.equal(save.tickets, 0);
  assert.equal(save.jade, 50);
  assert.equal(G.summon(save, 1), null);
});

test('duplicates become shards and shards become stars', () => {
  const save = rich();
  for (let i = 0; i < 60; i++) G.summon(save, 10);
  const id = 'bai-zhi', own = save.heroes[id];
  assert.ok(own.shards >= 20);
  const before = G.heroPower(id, own);
  assert.ok(G.starUp(save, id));
  assert.equal(G.heroPower(id, own), Math.round(before * 1.25));
});

test('power decides a fight: far above wins, far below loses, rewards only on a win', () => {
  const save = G.newSave(T0);
  save.stage = 30;
  const coins = save.coins;
  const lost = G.fight(save);
  assert.ok(!lost.win && save.stage === 30 && save.coins === coins && lost.blows.at(-1)!.team === 0);
  save.stage = 1;
  for (const id of save.team) save.heroes[id].level = 20;
  const won = G.fight(save);
  assert.ok(won.win && save.stage === 2 && won.blows.at(-1)!.enemy === 0 && save.coins > coins);
});

test('idle earnings grow with time, stop at twelve hours and reset on a claim', () => {
  const save = G.newSave(T0);
  assert.equal(G.afkPending(save, T0), 0);
  const hour = G.afkPending(save, T0 + HOUR);
  assert.equal(hour, G.afkRate(save) * 60);
  assert.equal(G.afkPending(save, T0 + 30 * HOUR), G.afkRate(save) * G.AFK_CAP_MIN);
  assert.equal(G.claimAfk(save, T0 + HOUR), hour);
  assert.equal(G.afkPending(save, T0 + HOUR), 0);
});

test('a new day resets the daily tasks and moves the sign-in on; gifts are claimed once', () => {
  const save = G.newSave(T0);
  assert.ok(G.claimLogin(save));
  assert.equal(save.tickets, 10); // 開局送十連
  assert.ok(!G.claimLogin(save));
  save.daily.clears = 5;
  assert.ok(G.claimTask(save, 'clear') && !G.claimTask(save, 'clear'));
  assert.ok(G.rollDay(save, T0 + 24 * HOUR) && !G.rollDay(save, T0 + 25 * HOUR));
  assert.equal(save.daily.clears, 0);
  assert.ok(G.claimLogin(save));
  assert.equal(save.jade, 300 + 60 + 300);
});

test('the red dots point at what can be collected', () => {
  const save = G.newSave(T0);
  const d = G.dots(save, T0);
  assert.ok(d.gifts && d.heroes && !d.battle && !d.tasks && !d.summon);
  G.claimLogin(save);
  assert.ok(G.dots(save, T0).summon);
  assert.ok(G.dots(save, T0 + HOUR).battle);
});

test('a week of play: the wall comes but never for two days running, and nothing is ever bought', () => {
  for (const seed of [99, 5, 1234, 31337]) {
    const save = G.newSave(T0, seed);
    const reached: number[] = [];
    for (let day = 0; day < 7; day++) {
      for (let visit = 0; visit < 4; visit++) session(save, T0 + day * 24 * HOUR + visit * 4 * HOUR);
      reached.push(save.stage);
    }
    for (let i = 2; i < reached.length; i++) assert.ok(reached[i] > reached[i - 2], `seed ${seed} stuck two days: ${reached}`);
    assert.ok(reached[0] >= 25 && reached[0] <= 50, `seed ${seed} first day ${reached[0]}`);
    assert.ok(reached[6] >= reached[0] + 20 && reached[6] <= 110, `seed ${seed} a week ${reached}`);
    assert.ok(G.vipLevel(save) >= 3);
    assert.ok(Object.keys(save.heroes).length >= 8);
  }
});
