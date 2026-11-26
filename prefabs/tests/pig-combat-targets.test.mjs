// What the pig's attacks strike (src/systems/combat/targets.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBO, REACH, SWAY, aimAt, aimRange, countCombo, landAhead, push, stepSway, struck } from '../systems/pig-combat/targets.ts';

const post = (id, x, z) => ({ id, x, z, radius: 0.3 });
const pig = { x: 0, z: 0, yawDeg: 0 }; // facing +z

test('a blow strikes what is close ahead, not what is far, beside or behind', () => {
  const targets = [post('ahead', 0, 1.2), post('far', 0, 3), post('beside', 1.4, 0), post('behind', 0, -1)];
  assert.deepEqual(struck('jab', pig, targets).map((hit) => hit.id), ['ahead']);
  const [hit] = struck('jab', pig, targets);
  assert.ok(hit.after === 0 && hit.pushZ > 0.99, 'at once, and it is pushed away from the pig');
});

test('a hook sweeps wider than a jab, and the boxer\'s skill strikes all round it', () => {
  const side = [post('side', 1.1, 0.5)];
  assert.equal(struck('jab', pig, side).length, 0);
  assert.equal(struck('hook', pig, side).length, 1);
  assert.deepEqual(struck('blaze', pig, [post('a', 0, 2), post('b', 0, -2), post('c', 2.2, 0), post('d', 0, 4)]).map((hit) => hit.id), ['a', 'b', 'c']);
});

test('ablaze, the boxer strikes half as hard again', () => {
  const target = [post('t', 0, 1)];
  assert.equal(struck('straight', pig, target, true)[0].damage, Math.round(REACH.straight.damage * 1.5));
});

test('a wave from the sword strikes what is in its way, the further the later, and not what is to the side', () => {
  const hits = struck('crescent', pig, [post('near', 0, 2), post('far', 0.6, 8), post('aside', 3, 5), post('beyond', 0, 12), post('behind', 0, -2)]);
  assert.deepEqual(hits.map((hit) => hit.id), ['near', 'far']);
  assert.ok(hits[0].after < hits[1].after && Math.abs(hits[1].after - (8 - 0.3) / REACH.crescent.speed) < 0.02);
  assert.ok(hits.every((hit) => hit.pushZ > 0.99), 'pushed the way the wave goes');
});

test('the leaping cut strikes what is near before it at once and throws a small wave ahead; the great kick reaches further than a blow; a roll only what it rolls against', () => {
  const hits = struck('chop', pig, [post('near', 0.5, 1.5), post('ahead', 0, 3.5), post('behind', 0, -1.5)]);
  assert.deepEqual(hits.map((hit) => [hit.id, hit.after > 0]), [['near', false], ['ahead', true]]);
  assert.equal(struck('kick', pig, [post('a', 0, 2.1), post('b', 0, 3)]).length, 1);
  assert.equal(struck('jab', pig, [post('a', 0, 2.1)]).length, 0);
  assert.deepEqual(struck('roll', pig, [post('touching', 0.5, 0.2), post('a step off', 0, 1.6)]).map((hit) => hit.id), ['touching']);
});

test('the ice charm freezes what it lands on; the fire charm does not', () => {
  const there = [post('there', 0, 3.7)];
  assert.ok(struck('ice-charm', pig, there)[0].freeze > 1);
  assert.equal(struck('charm', pig, there)[0].freeze, undefined);
});

test('a charm strikes what stands round the place it lands, a moment after it is thrown; the great charm four times', () => {
  const targets = [post('there', 0.5, 3.7), post('short', 0, 1), post('wide', 3, 3.7)];
  const fire = struck('charm', pig, targets);
  assert.deepEqual(fire.map((hit) => hit.id), ['there']);
  assert.ok(fire[0].after > 0.3);
  const great = struck('great-charm', pig, targets);
  assert.equal(great.filter((hit) => hit.id === 'there').length, 4);
  assert.ok(great.some((hit) => hit.id === 'wide'), 'and reaches further');
  assert.ok(great[3].after > great[0].after);
});

test('as an attack begins the pig turns to the nearest target ahead of it, and not to one behind', () => {
  const yaw = aimAt(pig, [post('right', 1, 1), post('further', -1, 2)], 3);
  assert.ok(Math.abs(yaw - 45) < 1e-6, 'toward the nearer: ' + yaw);
  assert.equal(aimAt(pig, [post('behind', 0, -1)], 3), 0, 'one behind is left alone');
  assert.equal(aimAt(pig, [post('far', 0, 9)], 3), 0);
  assert.ok(aimRange('crescent') > aimRange('jab') && aimRange('charm') > aimRange('cut'));
  // Aimed so, the blow lands.
  const aimed = { ...pig, yawDeg: yaw };
  assert.equal(struck('jab', aimed, [post('right', 1, 1)]).length, 1);
});

test('a struck post leans away, rocks back and comes to rest upright, never past its limit', () => {
  let sway = push({ x: 0, z: 0, vx: 0, vz: 0 }, 0, 1, 1);
  let furthest = 0, crossed = 0, last = 0;
  for (let i = 0; i < 240; i++) {
    sway = stepSway(sway, 1 / 60);
    furthest = Math.max(furthest, Math.hypot(sway.x, sway.z));
    if (Math.sign(sway.z) !== Math.sign(last) && last !== 0) crossed++;
    last = sway.z;
  }
  assert.ok(furthest > 0.2 && furthest <= SWAY.most + 1e-9, 'it leans: ' + furthest);
  assert.ok(crossed >= 2, 'it rocks back and forth');
  assert.ok(Math.hypot(sway.x, sway.z) < 0.01 && Math.hypot(sway.vx, sway.vz) < 0.05, 'and stands again');
  // Struck again and again it does not fall over.
  for (let i = 0; i < 60; i++) sway = stepSway(push(sway, 0, 1, 1.2), 1 / 60);
  assert.ok(Math.hypot(sway.x, sway.z) <= SWAY.most + 1e-9);
});

test('blows that follow one another are counted together; left alone the count ends', () => {
  let combo = { count: 0, since: 0 };
  for (let i = 0; i < 5; i++) {
    combo = countCombo(combo, 1, 1 / 60);
    for (let f = 0; f < 12; f++) combo = countCombo(combo, 0, 1 / 60);
  }
  assert.equal(combo.count, 5);
  combo = countCombo(combo, 3, 1 / 60);
  assert.equal(combo.count, 8, 'three struck at once count three');
  for (let f = 0; f < (COMBO.keeps + 0.1) * 60; f++) combo = countCombo(combo, 0, 1 / 60);
  assert.equal(combo.count, 0);
});

test('a charm is thrown so that it lands on a target before the pig, near or far; with none, at its own distance', () => {
  assert.equal(landAhead('charm', pig, []), REACH.charm.ahead);
  assert.equal(landAhead('charm', pig, [post('near', 0, 2.2)]), 2.2);
  assert.equal(landAhead('charm', pig, [post('far', 0.3, 6)]), 6);
  assert.equal(landAhead('charm', pig, [post('too far', 0, 9), post('aside', 3, 3)]), REACH.charm.ahead);
  assert.equal(landAhead('charm', pig, [post('at its feet', 0, 0.5)]), 1.6, 'not on its own head');
  // Landing there, it strikes it.
  const near = [post('near', 0, 2.2)];
  assert.equal(struck('charm', pig, near, false, landAhead('charm', pig, near)).length, 1);
});
