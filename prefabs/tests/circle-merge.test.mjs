// systems/circle-merge: a dropped circle comes to rest inside the container, two of a tier become
// one of the next with its points, two of the top tier vanish, and a pile does not interpenetrate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, GRAVITY } from '../systems/circle-merge/circle-merge.ts';

const RADII = [26, 35, 45, 56, 68, 82, 97, 113, 131, 150];
const POINTS = RADII.map((_, i) => ((i + 1) * (i + 2)) / 2);
const make = () => new World({ left: 0, right: 700, floor: 1000 }, RADII, POINTS);

test('a dropped circle falls and rests on the floor inside the walls', () => {
  assert.ok(GRAVITY > 0);
  const w = make();
  const b = w.add(3, 690, 100);
  for (let i = 0; i < 240; i++) w.step(1 / 60);
  assert.ok(Math.abs(b.y - (1000 - RADII[3])) < 2, `y=${b.y}`);
  assert.ok(b.x <= 700 - RADII[3] + 0.01);
});

test('two of a tier merge into the next tier with its points', () => {
  const w = make();
  w.add(2, 300, 900);
  w.add(2, 340, 700);
  let events = [];
  for (let i = 0; i < 120 && events.length === 0; i++) events = w.step(1 / 60);
  assert.equal(events.length, 1);
  assert.equal(events[0].from, 2);
  assert.equal(events[0].to, 3);
  assert.equal(events[0].points, POINTS[3]);
  assert.equal(w.bodies.length, 1);
  assert.equal(w.bodies[0].tier, 3);
  assert.equal(w.bodies[0].r, RADII[3]);
});

test('two of the top tier vanish', () => {
  const w = make();
  const top = RADII.length - 1;
  w.add(top, 200, 800);
  w.add(top, 400, 800);
  let events = [];
  for (let i = 0; i < 120 && events.length === 0; i++) events = w.step(1 / 60);
  assert.equal(events[0].to, -1);
  assert.equal(w.bodies.length, 0);
});

test('different tiers stack without overlapping much', () => {
  const w = make();
  for (let i = 0; i < 12; i++) w.add(i % 5, 350 + (i % 3) * 10, 100 - i * 80);
  for (let i = 0; i < 600; i++) w.step(1 / 60);
  for (const a of w.bodies)
    for (const b of w.bodies) {
      if (a === b || a.tier === b.tier) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d > (a.r + b.r) * 0.9, `overlap ${d} vs ${a.r + b.r}`);
    }
});

test('the same drops give the same pile: nothing in a step is random', () => {
  const run = () => {
    const w = make();
    for (let i = 0; i < 10; i++) w.add(i % 4, 120 + i * 47, -i * 60);
    for (let i = 0; i < 400; i++) w.step(1 / 60);
    return w.bodies.map((b) => [b.tier, Math.round(b.x * 1000), Math.round(b.y * 1000)]);
  };
  assert.deepEqual(run(), run());
});
