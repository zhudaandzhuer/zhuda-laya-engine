import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game, PADS, ROAD, ROAD_LENGTH, START_COINS, START_LIVES, TOWERS, WAVES, along, botBuild, playOut } from '../src/core/td.ts';

test('the road is walked end to end and no pad stands on it', () => {
  assert.deepEqual([along(0).x, along(0).z], ROAD[0]);
  const end = along(ROAD_LENGTH);
  assert.ok(Math.abs(end.x - 30) < 0.01 && Math.abs(end.z - 10) < 0.01);
  for (const [px, pz] of PADS) {
    let nearest = Infinity;
    for (let d = 0; d <= ROAD_LENGTH; d += 0.25) nearest = Math.min(nearest, Math.hypot(along(d).x - px, along(d).z - pz));
    assert.ok(nearest > 2.2 && nearest < 8, `pad ${px},${pz}: ${nearest.toFixed(1)} m from the road`);
  }
});

test('building, upgrading and selling move the right coins; a pad holds one tower', () => {
  const g = new Game();
  assert.ok(g.build(0, 'arrow') && !g.build(0, 'fire'));
  assert.equal(g.coins, START_COINS - 70);
  assert.ok(g.upgrade(0));
  assert.equal(g.coins, START_COINS - 160);
  assert.ok(!g.upgrade(0)); // 150 for the third level, 60 in hand
  assert.equal(g.sell(0), Math.floor(160 * 0.7));
  assert.equal(g.towers.length, 0);
  assert.ok(!g.build(1, 'fire') || g.coins >= 0);
});

test('with no towers the gate falls; every beast that arrives costs its lives', () => {
  const g = playOut(() => {});
  assert.equal(g.state, 'lost');
  assert.ok(g.wave <= 2 && g.lives === 0 && g.kills === 0);
});

test('a careful builder holds all twelve waves; a builder of arrows alone does not', () => {
  const g = playOut(botBuild);
  assert.equal(g.state, 'won', `wave ${g.wave + 1}, lives ${g.lives}`);
  assert.ok(g.lives >= 8 && g.lives <= START_LIVES, `lives ${g.lives}`);
  assert.equal(g.wave, WAVES.length);
  const arrows = playOut((x) => {
    for (let pad = 0; pad < PADS.length; pad++) x.build(pad, 'arrow');
    for (const t of x.towers) x.upgrade(t.pad);
  });
  assert.equal(arrows.state, 'lost');
  assert.ok(arrows.wave >= 5, `arrows alone fell on wave ${arrows.wave + 1}`);
});

test('frost slows, fire burns more than one, the same game twice is the same game', () => {
  const run = (kind: 'frost' | 'fire' | 'arrow') => {
    const g = new Game();
    g.coins = 1000;
    g.build(1, kind);
    g.send();
    let slowed = 0, multi = 0;
    for (let i = 0; i < 30 * 40 && g.state === 'wave'; i++) {
      const before = g.enemies.filter((e) => e.hp < e.maxHp).length;
      g.step();
      slowed = Math.max(slowed, g.enemies.filter((e) => e.slow > 0).length);
      multi = Math.max(multi, g.enemies.filter((e) => e.hp < e.maxHp).length - before);
    }
    return { slowed, multi, kills: g.kills, time: g.time };
  };
  assert.ok(run('frost').slowed >= 1 && run('arrow').slowed === 0);
  assert.deepEqual(run('fire'), run('fire'));
  assert.ok(TOWERS.fire.splash![0] > 0);
  const a = playOut(botBuild), b = playOut(botBuild);
  assert.equal(a.time, b.time);
  assert.equal(a.kills, b.kills);
});
