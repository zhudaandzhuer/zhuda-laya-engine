// The island characters' rules without the engine: the world they are given, where they may
// stand, what a fall lands on, the way round things, and the presets that reproduce the games.
import test from 'node:test';
import assert from 'node:assert/strict';

const pw = await import('../3d/island-pig/pig-world.ts');
const { planeHit } = await import('../3d/island-pig/hand.ts');
const { SKY_ISLAND_WORLD, STAGE, TOWER, roofAt } = await import('../3d/sky-island/layout.ts');
const { HOUSE, POND, TREE, groundAt } = await import('../3d/sky-island/ground.ts');

/** A round island 10 m across with a 2 m box in the middle, nothing else. */
const disc = {
  ground: (x, z) => (Math.hypot(x, z) < 5 ? 0 : null),
  inside: (x, z) => 5 - Math.hypot(x, z),
  obstacles: { circles: [], boxes: [[0, 0, 1, 1]] },
  lostBelow: -10,
  respawnSpan: 4,
  respawnHeight: 8,
  reach: 6,
};

test('the floating island is a whole PigWorld', () => {
  const w = SKY_ISLAND_WORLD;
  for (const k of ['ground', 'inside', 'obstacles', 'lostBelow', 'respawnSpan', 'respawnHeight', 'reach']) assert.ok(k in w, k);
  assert.equal(typeof w.pond.distance, 'function');
  assert.equal(w.pond.waterY, POND.water);
  assert.deepEqual(w.caps.map((c) => [c.x, c.z]), [[TOWER.x, TOWER.z]]);
});

test('standing: in from the rim, off the pond, clear of things; any world works the same way', () => {
  const w = SKY_ISLAND_WORLD;
  assert.equal(pw.standable(w, ...STAGE.center), true);
  assert.equal(pw.standable(w, POND.center[0], POND.center[1]), false, 'pond');
  assert.equal(pw.standable(w, HOUSE.center[0], HOUSE.center[1]), false, 'house');
  assert.equal(pw.standable(w, TREE.center[0] + 0.3, TREE.center[1]), false, 'tree');
  assert.equal(pw.standable(w, 8.5, 0), false, 'rim');
  assert.equal(pw.standable(disc, 3, 0), true);
  assert.equal(pw.standable(disc, 0.5, 0), false, 'the box');
  assert.equal(pw.standable(disc, 4.5, 0), false, 'too near the rim');
  assert.equal(pw.standable(disc, 1.2, 0, 0.35), false, 'the margin keeps it off the box');
  assert.equal(pw.standable(disc, 1.2, 0, 0.1), true);
});

test('a fall lands on the tower cap, the roof or the ground, and over nothing on nothing', () => {
  const w = SKY_ISLAND_WORLD;
  const cap = pw.surfaceAt(w, TOWER.x, TOWER.z);
  assert.equal(cap.roof, true);
  assert.equal(cap.y, HOUSE.height + TOWER.top);
  assert.equal(cap.cap, w.caps[0]);
  const roof = pw.surfaceAt(w, HOUSE.center[0] + 0.5, HOUSE.center[1] + 0.5);
  assert.deepEqual(roof, { y: roofAt(HOUSE.center[0] + 0.5, HOUSE.center[1] + 0.5), roof: true });
  assert.deepEqual(pw.surfaceAt(w, ...STAGE.center), { y: groundAt(...STAGE.center), roof: false });
  assert.equal(pw.surfaceAt(w, 20, 0), null);
  assert.deepEqual(pw.surfaceAt(disc, 1, 1), { y: 0, roof: false }, 'no roof, no caps: the ground');
});

test('the way round: straight when clear, round the house when not, none when walled in', () => {
  const w = SKY_ISLAND_WORLD;
  const free = (x, z) => pw.standable(w, x, z, 0.22);
  const goal = [STAGE.center[0], STAGE.center[1]];
  assert.deepEqual(pw.findWay(free, [-2.6, 3.9], goal), [goal], 'in plain sight');
  // from beside the cart, behind the house, to the stage: several legs, each clear, ending at the goal
  const from = [6.0, -1.0];
  assert.ok(free(...from));
  const way = pw.findWay(free, from, goal, w.reach);
  assert.ok(way && way.length >= 2, JSON.stringify(way));
  assert.deepEqual(way.at(-1), goal);
  let here = from;
  for (const p of way) assert.ok(pw.clearLine(free, here[0], here[1], p[0], p[1]), `leg to ${p}`), (here = p);
  assert.ok(pw.wayLength(from, way) > Math.hypot(goal[0] - from[0], goal[1] - from[1]));
  // round the disc's box
  const dfree = (x, z) => pw.standable(disc, x, z, 0.22);
  const round = pw.findWay(dfree, [-3, 0], [3, 0], disc.reach);
  assert.ok(round.length >= 2 && round.every((p) => dfree(...p)));
  // walled in: no way
  assert.equal(pw.findWay((x, z) => Math.hypot(x, z) < 1 || Math.hypot(x - 4, z) < 1, [0, 0], [4, 0], 6), null);
});

test('clips: Land, Shake and Bow play once; the rest loop; the acts count beats', () => {
  assert.equal(pw.looped('Land'), false);
  assert.equal(pw.looped('Shake'), false);
  assert.equal(pw.looped('Bow'), false);
  for (const c of ['Idle', 'Walk', 'Fall', 'Dizzy', 'Sing', 'Dance', 'Sit']) assert.equal(pw.looped(c), true, c);
  assert.equal(pw.BASE_CLIPS.length, 9);
  assert.equal(pw.ACTS.Sing, 4);
  assert.equal(pw.ACTS.Dance, 4);
});

test('the presets: the sky game’s single Zhuda, and the redesign’s shape', () => {
  assert.deepEqual(pw.SKY_ISLAND_GAME_PIG, { performs: false, cheerChance: 0.18, respawnInView: false, pickHeights: [0.25, 0.45, 0.65, 0.85], name: 'zhuda-holder' });
  const zhuer = pw.redesignShape(1.0);
  assert.equal(zhuer.size, 1.2);
  assert.deepEqual(zhuer.scruff, [0, 0.95, -0.13]);
  assert.equal(zhuer.radius, 0.36);
});

test('the hand carries along a plane facing the camera', () => {
  const plane = { point: [0, 1, 0], normal: [0, 0, 1] };
  assert.deepEqual(planeHit([0, 1, 10], [0, 0, -1], plane), [0, 1, 0]);
  assert.equal(planeHit([0, 1, 10], [1, 0, 0], plane), null, 'along it');
  assert.equal(planeHit([0, 1, 10], [0, 0, 1], plane), null, 'away from it');
});
