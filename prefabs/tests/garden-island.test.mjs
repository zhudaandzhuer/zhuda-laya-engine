// The garden island's own rules without a browser (ported from games/zhuda-garden-island
// tests/land.test.mjs), its views, and the walker's world rule on it.
import test from 'node:test';
import assert from 'node:assert/strict';

const { START, STEPS, STEP_TOP, TREES, CULMS, BUSHES, ROCKS, LANTERNS, WATER_Y, POND, TERRACE, HALF, groundAt, heightAt, walkable, waterEdge, grassGrows, insideBy } = await import('../3d/garden-island/land.ts');
const { GARDEN_VIEWS, GARDEN_START, CROWN_SPHERES } = await import('../3d/garden-island/views.ts');
const { slide } = await import('../3d/island-walker/walk-world.ts');

test('the sea is below 0 outside the shore and the lawn is above the water inland', () => {
  assert.ok(heightAt(50, 0) < 0);
  assert.ok(insideBy(0, 0) > 30);
  assert.ok(heightAt(...START) > WATER_Y);
});

test('the pond is a hollow under its water, and its stepping stones can be walked', () => {
  assert.ok(heightAt(...POND.center) < WATER_Y - 0.4);
  assert.equal(walkable(POND.center[0] + 3, POND.center[1] - 2.5), false);
  for (const [x, z] of STEPS) {
    assert.ok(walkable(x, z));
    assert.equal(groundAt(x, z), STEP_TOP);
  }
});

test('nothing grows or stands in the water', () => {
  for (const t of TREES) assert.ok(waterEdge(t.x, t.z) > 1, `tree at ${t.x},${t.z}`);
  for (let x = -40; x <= 40; x += 1.7) for (let z = -40; z <= 40; z += 1.7) if (grassGrows(x, z)) assert.ok(waterEdge(x, z) > 0.7);
});

test('the island is the one the game shipped: same counts of trees, culms, bushes, stones and lanterns', () => {
  // Seeded placement: a change here changes every picture of the island.
  assert.deepEqual([TREES.length, CULMS.length, BUSHES.length, ROCKS.length, LANTERNS.length], [50, 150, 60, 76, 6]);
  assert.equal(groundAt(TERRACE.center[0], TERRACE.center[1]), TERRACE.height);
  assert.equal(groundAt(HALF + 1, 0), null, 'off the map');
});

test('every view stands on walkable ground, at a real hour, and the start is where the game started', () => {
  assert.deepEqual(GARDEN_START, START);
  for (const [id, v] of Object.entries(GARDEN_VIEWS)) {
    assert.ok(walkable(v.at[0], v.at[1]), `${id} is walkable`);
    assert.notEqual(groundAt(v.at[0], v.at[1]), null, id);
    assert.ok(v.hour >= 0 && v.hour < 24, id);
    assert.ok(v.distance >= 3 && v.distance <= 40 && v.pitch > 0 && v.pitch < 1.4, id);
    assert.ok(v.label.length > 0, id);
  }
});

test('a crown sphere for every tree, up in the air over its trunk', () => {
  assert.equal(CROWN_SPHERES.length, TREES.length);
  CROWN_SPHERES.forEach(([x, y, z, r], i) => {
    const t = TREES[i];
    assert.ok(y - r > groundAt(t.x, t.z), `crown ${i} is above the ground`);
    assert.ok(Math.hypot(x - t.x, z - t.z) < t.height, `crown ${i} is over its trunk`);
  });
});

test('the walker’s step rule on the island: walking into the pond stops at its shore, and the stones lead across', () => {
  const world = { groundAt, walkable };
  const walk = (from, to, seconds = 30) => {
    let [x, z] = from;
    const path = [];
    for (let i = 0; i < seconds * 60; i++) {
      const dx = to[0] - x,
        dz = to[1] - z,
        d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      const step = Math.min(d, 3.1 / 60);
      const next = slide(world, x, z, x + (dx / d) * step, z + (dz / d) * step);
      if (!next) break;
      [x, z] = next;
      path.push([x, z]);
    }
    return { at: [x, z], path };
  };
  // Straight at the middle of the pond from the path: the feet stay on walkable ground, short of the deep water.
  const toPond = walk(START, POND.center);
  assert.ok(toPond.path.length > 100);
  for (const [x, z] of toPond.path) assert.ok(walkable(x, z));
  assert.ok(Math.hypot(toPond.at[0] - POND.center[0], toPond.at[1] - POND.center[1]) > 2, 'stopped at the shore');
  // Stone to stone across the pond: never a foot in deep water; where two stones are close
  // enough (0→1, 2→3, 3→4) the walk gets there, elsewhere it stops at the gap.
  const arrived = [];
  for (let i = 0; i + 1 < STEPS.length; i++) {
    const { at, path } = walk([STEPS[i][0], STEPS[i][1]], [STEPS[i + 1][0], STEPS[i + 1][1]], 5);
    for (const [x, z] of path) assert.ok(walkable(x, z));
    if (Math.hypot(at[0] - STEPS[i + 1][0], at[1] - STEPS[i + 1][1]) < 0.1) arrived.push(i);
  }
  assert.deepEqual(arrived, [0, 2, 3]);
  // A blocked step is null, and a step along a shore slides.
  const blocked = { groundAt: () => 0, walkable: () => false };
  assert.equal(slide(blocked, 0, 0, 1, 1), null);
  const wallEast = { groundAt: () => 0, walkable: (x) => x < 1 };
  assert.deepEqual(slide(wallEast, 0.9, 0, 1.1, 0.2), [0.9, 0.2]);
});
