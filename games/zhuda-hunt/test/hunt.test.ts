import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hunt, HUNTER_MOVES, STEP, carve, partPosition } from '../src/core/hunt.ts';
import { GEAR, MONSTERS, QUESTS, forge, forgeBlock, grant, loadoutOf, newSave, questOpen } from '../src/core/data.ts';
import { careful, masher, run } from '../src/core/bots.ts';

const base = { attack: 100, defense: 0, potions: 5 };
const still = { mx: 0, mz: 0 };
const steps = (hunt: Hunt, n: number, input = still) => {
  const all = [];
  for (let i = 0; i < n; i++) all.push(...hunt.step(input));
  return all;
};
/** Puts the hunter in front of a part, facing it. */
function face(hunt: Hunt, part: 'head' | 'legs' | 'tail' | 'body', gap = 1.2) {
  const p = partPosition(hunt.monster, part);
  const away = part === 'legs' || part === 'body' ? hunt.monster.yaw + Math.PI / 2 : Math.atan2(p.x - hunt.monster.x, p.z - hunt.monster.z);
  hunt.hunter.x = p.x + Math.sin(away) * (p.r + gap);
  hunt.hunter.z = p.z + Math.cos(away) * (p.r + gap);
  hunt.hunter.yaw = away + Math.PI;
}

test('a press made early is kept by the buffer and comes out as the combo', () => {
  const hunt = new Hunt('taotie', base, 3);
  hunt.monster.think = 999;
  face(hunt, 'tail');
  hunt.press('light');
  const first = steps(hunt, 10);
  assert.equal(first.find((e) => e.type === 'action')?.action, 'light1');
  // Pressed during the active frames: too early to cancel, kept, and started when the window opens (frame 13).
  hunt.press('light');
  assert.equal(hunt.hunter.action, 'light1');
  const next = steps(hunt, 8);
  assert.equal(next.find((e) => e.type === 'action')?.action, 'light2');
});

test('an attack is a commitment: no roll before its cancel window', () => {
  const hunt = new Hunt('taotie', base, 3);
  hunt.monster.think = 999;
  hunt.press('heavy');
  steps(hunt, 5);
  hunt.press('dodge');
  steps(hunt, 12); // the buffer forgets after 0.22 s
  assert.equal(hunt.hunter.action, 'heavy');
  steps(hunt, 40);
  hunt.press('dodge');
  steps(hunt, 2);
  assert.equal(hunt.hunter.action, 'dodge');
});

test('damage follows motion value, attack and hitzone; the head is the weak point', () => {
  const dmg = (part: 'head' | 'body') => {
    const hunt = new Hunt('taotie', base, 3);
    hunt.monster.think = 999;
    face(hunt, part, 0.6);
    hunt.press('light');
    return steps(hunt, 12).find((e) => e.type === 'hit');
  };
  const head = dmg('head'), body = dmg('body');
  assert.ok(head && head.type === 'hit' && body && body.type === 'hit');
  assert.equal(head.part, 'head');
  assert.equal(head.damage, Math.round(0.18 * 100 * MONSTERS.taotie.parts.head.cut));
  assert.ok(head.damage > body.damage && head.weak && !body.weak);
});

test('a roll timed on the strike passes through it; standing still is hit', () => {
  const outcome = (roll: boolean) => {
    const hunt = new Hunt('taotie', base, 5);
    const m = hunt.monster;
    hunt.hunter.x = m.x;
    hunt.hunter.z = m.z - 3.2;
    m.think = 0.01;
    let hurt = 0, rolled = false;
    for (let i = 0; i < 400 && m.state !== 'recover'; i++) {
      if (roll && !rolled && m.state === 'windup' && m.span - m.t <= 0.1) (rolled = true), hunt.press('dodge');
      for (const e of hunt.step(still)) if (e.type === 'hurt') hurt += 1;
    }
    return hurt;
  };
  assert.equal(outcome(false), 1);
  assert.equal(outcome(true), 0);
});

test('parts break, legs trip it, blunt blows to the head stun it, the tail is cut off only by a blade', () => {
  const hunt = new Hunt('taotie', { ...base, attack: 300 }, 9);
  const m = hunt.monster;
  m.think = 9999;
  const seen = new Set<string>();
  const hit = (part: 'head' | 'legs' | 'tail', button: 'light' | 'heavy', n: number) => {
    for (let i = 0; i < n && m.state !== 'dead'; i++) {
      if (part === 'tail' && m.state === 'roam') (m.state = 'recover'), (m.t = 0), (m.span = 3); // held still, as after a missed charge
      face(hunt, part, 0.5);
      hunt.press(button);
      for (const e of steps(hunt, 80)) seen.add(e.type === 'break' ? `break:${e.part}` : e.type);
      m.think = 9999;
    }
  };
  hit('legs', 'light', 12);
  assert.ok(seen.has('topple') && seen.has('break:legs'));
  hit('tail', 'heavy', 5);
  assert.ok(seen.has('break:tail'));
  assert.ok(seen.has('enrage'));
  const loot = carve(hunt, 9);
  assert.ok(loot['饕餮尾'] === 1 && loot['饕餮厚皮'] >= 3);
});

test('three faints fail the quest; the timer ends it', () => {
  const r = run('taotie', base, masher, 2);
  assert.equal(r.result, 'failed');
  assert.equal(r.faints, 3);
  const idle = new Hunt('taotie', { ...base, defense: 100000 }, 2);
  while (idle.result === 'running') idle.step(still);
  assert.equal(idle.result, 'timeout');
  assert.ok(Math.abs(idle.time - 600) < STEP * 2);
});

test('balance: a hunter who reads the windups clears each quest with the gear before it; a masher clears none', () => {
  const tiers: Record<string, [number, number]> = { taotie: [100, 0], qiongqi: [132, 25], xingtian: [168, 55] };
  for (const [monster, [attack, defense]] of Object.entries(tiers)) {
    for (let seed = 1; seed <= 4; seed++) {
      const good = run(monster, { attack, defense, potions: 5 }, careful('legs'), seed);
      assert.equal(good.result, 'won', `${monster} seed ${seed}`);
      assert.ok(good.seconds > 90 && good.seconds < 420, `${monster} took ${good.seconds}s`);
      assert.equal(run(monster, { attack, defense, potions: 5 }, masher, seed).result, 'failed');
    }
  }
});

test('the same seed plays the same hunt', () => {
  const a = run('qiongqi', { attack: 132, defense: 25, potions: 5 }, careful('head'), 7);
  const b = run('qiongqi', { attack: 132, defense: 25, potions: 5 }, careful('head'), 7);
  assert.equal(a.hunt.time, b.hunt.time);
  assert.deepEqual(a.counts, b.counts);
});

test('quests open in order and the forge takes what it says', () => {
  const save = newSave();
  assert.deepEqual(QUESTS.map((q) => questOpen(save, q)), [true, false, false]);
  grant(save, QUESTS[0], { 饕餮厚皮: 3, 饕餮巨齒: 1 }, 200);
  assert.ok(questOpen(save, QUESTS[1]));
  const w1 = GEAR.find((g) => g.id === 'w1')!;
  assert.equal(forgeBlock(save, w1), '');
  assert.ok(forge(save, 'w1'));
  assert.equal(loadoutOf(save).attack, 132);
  assert.equal(save.coins, 200);
  assert.equal(forgeBlock(save, GEAR.find((g) => g.id === 'w3')!), '需要先有風虎牙刀');
  for (const m of Object.values(HUNTER_MOVES)) assert.ok(m.spec.frameCount > 0);
});
