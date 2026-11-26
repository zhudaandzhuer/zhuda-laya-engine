// A walk grid with path finding, and a walking capsule, on worlds given as numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaWalkGrid,
  findZhudaPath,
  zhudaSolidQueryProvider,
  zhudaWalkLineClear,
} from '../packages/core/runtime3d/WalkGrid.ts';
import { ZhudaCharacterController } from '../packages/core/runtime3d/CharacterController.ts';
import { ZhudaSceneQueries } from '../packages/core/runtime3d/SceneQueries.ts';
import { resolveCameraBoom } from '../packages/core/runtime3d/CameraCollision.ts';

const box = (x0, z0, x1, z1, y0 = 0, y1 = 3) => ({
  kind: 'box',
  min: { x: x0, y: y0, z: z0 },
  max: { x: x1, y: y1, z: z1 },
});
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} against ${b}`);

test('a walk grid: what a walker of a size can stand in', () => {
  // A 10 x 10 yard with a wall across it that has a gap, a pillar, a pond with no ground, a low kerb.
  const solids = [
    box(-5, -0.25, 1, 0.25),
    box(2, -0.25, 5, 0.25),
    { kind: 'cylinder', center: { x: -3, z: 3 }, radius: 0.5, minY: 0, maxY: 3 },
    box(3, 3, 4, 4, 0, 0.2),
  ];
  const ground = (x, z) => (Math.hypot(x - 3, z + 3) < 1 ? null : 0);
  const grid = createZhudaWalkGrid({
    min: { x: -5, z: -5 },
    max: { x: 5, z: 5 },
    cell: 0.25,
    ground,
    solids,
    radius: 0.3,
  });
  assert.deepEqual([grid.columns, grid.rows], [40, 40]);
  assert.equal(grid.isWalkable(-2, -2), true);
  assert.equal(grid.isWalkable(0, 0), false, 'in the wall');
  assert.equal(grid.isWalkable(0, 0.45), false, 'within a radius of the wall');
  assert.equal(grid.isWalkable(1.5, 0), true, 'the middle of the gap');
  assert.equal(grid.isWalkable(1.15, 0), false, 'a 1 m gap leaves 0.4 m for a walker 0.6 m wide');
  assert.equal(grid.isWalkable(-3, 3.7), false, 'beside the pillar');
  assert.equal(grid.isWalkable(3, -3), false, 'no ground');
  assert.equal(grid.isWalkable(3.5, 3.5), true, 'a kerb lower than a step is not in the way');
  assert.equal(grid.isWalkable(9, 9), false);
  assert.ok(Number.isNaN(grid.heightOf(32, 8)));
  const beside = grid.nearestWalkable(0, 0);
  near(Math.hypot(beside.x, beside.z), Math.hypot(0.125, 0.625), 1e-9);
  assert.equal(grid.nearestWalkable(0, 0, 0.3), null);
  assert.ok(grid.walkableCells > 1000 && grid.walkableCells < 1600);
  assert.throws(
    () => createZhudaWalkGrid({ min: { x: 0, z: 0 }, max: { x: 0, z: 1 }, cell: 1 }),
    /min and max/,
  );
  assert.throws(
    () => createZhudaWalkGrid({ min: { x: 0, z: 0 }, max: { x: 1, z: 1 }, cell: 0 }),
    /cell/,
  );
  assert.throws(
    () =>
      createZhudaWalkGrid({
        min: { x: 0, z: 0 },
        max: { x: 1, z: 1 },
        cell: 1,
        solids: [{ kind: 'ball' }],
      }),
    /solid/,
  );
  assert.throws(
    () => createZhudaWalkGrid({ min: { x: 0, z: 0 }, max: { x: 9000, z: 9000 }, cell: 0.1 }),
    /larger cell/,
  );
});

test('a path goes through the gap, and its corners are the ones a straight run cannot skip', () => {
  const solids = [box(-5, -0.25, 1, 0.25), box(2, -0.25, 5, 0.25)];
  const grid = createZhudaWalkGrid({
    min: { x: -5, z: -5 },
    max: { x: 5, z: 5 },
    cell: 0.25,
    solids,
    radius: 0.3,
  });
  const from = { x: -4, z: -4 },
    to = { x: -4, z: 4 };
  assert.equal(zhudaWalkLineClear(grid, from, to), false);
  assert.equal(zhudaWalkLineClear(grid, from, { x: 4, z: -4 }), true);
  const path = findZhudaPath(grid, from, to);
  assert.equal(path.found, true);
  assert.deepEqual(path.points[0], from);
  assert.deepEqual(path.points.at(-1), to);
  // Through the gap (x between 1 and 2 at z = 0), and not much longer than the two straight legs.
  assert.ok(
    path.points.some((p) => p.x > 1 && p.x < 2 && Math.abs(p.z) < 1),
    JSON.stringify(path.points),
  );
  const straight = Math.hypot(5.5, 4) * 2;
  assert.ok(
    path.length >= straight - 0.01 && path.length < straight * 1.08,
    `${path.length} against ${straight}`,
  );
  assert.ok(path.points.length <= 5, `${path.points.length} points after smoothing`);
  for (let i = 1; i < path.points.length; i++)
    assert.equal(zhudaWalkLineClear(grid, path.points[i - 1], path.points[i]), true);
  const rough = findZhudaPath(grid, from, to, { smooth: false });
  assert.ok(rough.points.length > 20 && rough.length >= path.length - 1e-9);
  // The same twice: the search has no chance in it.
  assert.deepEqual(findZhudaPath(grid, from, to), path);
  // No way: a closed wall. And ends that cannot be stood in.
  const closed = createZhudaWalkGrid({
    min: { x: -5, z: -5 },
    max: { x: 5, z: 5 },
    cell: 0.25,
    solids: [box(-5, -0.25, 5, 0.25)],
    radius: 0.3,
  });
  const blocked = findZhudaPath(closed, from, to);
  assert.equal(blocked.found, false);
  assert.ok(blocked.visited > 100);
  assert.equal(findZhudaPath(grid, { x: 0, z: 0 }, to).found, false);
  assert.equal(findZhudaPath(grid, from, to, { maxVisited: 10 }).found, false);
  // A step too high between two cells is a wall to the path; a ramp is not.
  const terrace = (x) => (x < 0 ? 0 : 1);
  const cliff = createZhudaWalkGrid({
    min: { x: -2, z: -2 },
    max: { x: 2, z: 2 },
    cell: 0.25,
    ground: terrace,
  });
  assert.equal(findZhudaPath(cliff, { x: -1, z: 0 }, { x: 1, z: 0 }).found, false);
  const ramp = createZhudaWalkGrid({
    min: { x: -2, z: -2 },
    max: { x: 2, z: 2 },
    cell: 0.25,
    ground: (x, z) => (Math.abs(z) < 0.5 ? Math.min(1, Math.max(0, (x + 1) / 2)) : terrace(x)),
  });
  const up = findZhudaPath(ramp, { x: -1.5, z: 1.5 }, { x: 1.5, z: 1.5 });
  assert.equal(up.found, true);
  assert.ok(
    up.points.some((p) => Math.abs(p.z) < 0.5),
    'by the ramp',
  );
});

test('a walking capsule: slides, steps, slopes, edges, a fall and a jump', () => {
  const flat = { ground: () => 0, solids: [box(2, -5, 3, 5)] };
  const c = new ZhudaCharacterController({ world: flat, position: { x: 0, y: 0, z: 0 } });
  assert.equal(c.grounded, true);
  // Straight at a wall: it stops a radius short of it.
  let blocked = false;
  for (let i = 0; i < 120; i++) blocked = c.move(1 / 60, { x: 3, z: 0 }).blocked || blocked;
  assert.equal(blocked, true);
  near(c.position.x, 2 - 0.3, 0.02);
  near(c.position.z, 0, 1e-9);
  // At an angle to it: it slides along.
  for (let i = 0; i < 60; i++) c.move(1 / 60, { x: 3, z: 3 });
  near(c.position.x, 1.7, 0.02);
  assert.ok(c.position.z > 2.5, `slid to z ${c.position.z}`);
  // Very fast at a thin wall in one long step: not through it.
  const thin = new ZhudaCharacterController({
    world: { ground: () => 0, solids: [box(1, -5, 1.1, 5)] },
    position: { x: 0, y: 0, z: 0 },
  });
  thin.move(1 / 30, { x: 90, z: 0 });
  assert.ok(thin.position.x < 1, `stopped at ${thin.position.x}`);
  // A round pillar is walked round.
  const round = new ZhudaCharacterController({
    world: {
      ground: () => 0,
      solids: [{ kind: 'cylinder', center: { x: 2, z: 0.2 }, radius: 0.5, minY: 0, maxY: 3 }],
    },
    position: { x: 0, y: 0, z: 0 },
  });
  for (let i = 0; i < 240; i++) round.move(1 / 60, { x: 3, z: 0 });
  assert.ok(round.position.x > 4, `past the pillar at ${round.position.x}`);

  // Stairs of 0.3 are climbed; a ledge of 0.5 is not.
  const stairs = (x) => (x < 1 ? 0 : x < 1.6 ? 0.3 : x < 2.2 ? 0.6 : 0.9);
  const climber = new ZhudaCharacterController({
    world: { ground: stairs },
    position: { x: 0, y: 0, z: 0 },
  });
  for (let i = 0; i < 120; i++) climber.move(1 / 60, { x: 2, z: 0 });
  near(climber.position.y, 0.9);
  assert.equal(climber.grounded, true);
  const ledge = new ZhudaCharacterController({
    world: { ground: (x) => (x < 1 ? 0 : 0.5) },
    position: { x: 0, y: 0, z: 0 },
  });
  for (let i = 0; i < 120; i++) ledge.move(1 / 60, { x: 2, z: 0 });
  assert.ok(ledge.position.x < 1 && ledge.position.y === 0);
  // A hillside of 30 degrees is climbed, one of 60 is not; down either is walked.
  const hill = (deg) => ({ ground: (x) => Math.max(0, x - 1) * Math.tan((deg * Math.PI) / 180) });
  const gentle = new ZhudaCharacterController({ world: hill(30), position: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 120; i++) gentle.move(1 / 60, { x: 2, z: 0 });
  assert.ok(gentle.position.x > 3.5 && gentle.grounded);
  const steep = new ZhudaCharacterController({ world: hill(60), position: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 120; i++) steep.move(1 / 60, { x: 2, z: 0 });
  assert.ok(steep.position.x < 1.2, `the steep side stopped it at ${steep.position.x}`);
  const down = new ZhudaCharacterController({
    world: hill(60),
    position: { x: 1.15, y: hill(60).ground(1.15), z: 0 },
  });
  down.move(1 / 60, { x: -2, z: 0 });
  assert.ok(down.position.x < 1.15);

  // The map's edge is a wall, unless the game says a character may walk off it.
  const island = { ground: (x) => (Math.abs(x) <= 2 ? 0 : null) };
  const kept = new ZhudaCharacterController({ world: island, position: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 120; i++) kept.move(1 / 60, { x: 3, z: 0 });
  assert.ok(kept.position.x <= 2 && kept.grounded);
  const lost = new ZhudaCharacterController({
    world: island,
    position: { x: 0, y: 0, z: 0 },
    noGround: 'fall',
  });
  let fell = 0;
  for (let i = 0; i < 120; i++) fell += lost.move(1 / 60, { x: 3, z: 0 }).fellOff ? 1 : 0;
  assert.equal(fell, 1);
  assert.ok(lost.position.y < -5 && !lost.grounded);

  // Off a terrace 2 m high: a fall, then a landing, once each.
  const terrace = { ground: (x) => (x < 1 ? 2 : 0) };
  const walker = new ZhudaCharacterController({ world: terrace, position: { x: 0, y: 2, z: 0 } });
  const events = [];
  for (let i = 0; i < 120; i++) {
    const m = walker.move(1 / 60, { x: 2, z: 0 });
    if (m.fellOff) events.push(['fell', i]);
    if (m.landed) events.push(['landed', i]);
  }
  assert.deepEqual(
    events.map((e) => e[0]),
    ['fell', 'landed'],
  );
  // Falling 2 m at 20 m/s2 takes 0.447 s: 27 frames, give or take the step.
  assert.ok(Math.abs(events[1][1] - events[0][1] - 27) <= 2, JSON.stringify(events));
  near(walker.position.y, 0);
  // In the air it does not pass into the side of the terrace it left.
  const back = new ZhudaCharacterController({ world: terrace, position: { x: 1.2, y: 1, z: 0 } });
  assert.equal(back.grounded, false);
  back.move(1 / 60, { x: -30, z: 0 });
  assert.ok(back.position.x > 1);

  // A jump rises v2 / 2g and comes back; a second press in the air does nothing.
  const jumper = new ZhudaCharacterController({
    world: { ground: () => 0 },
    position: { x: 0, y: 0, z: 0 },
    jumpSpeed: 6,
    gravity: 20,
  });
  let top = 0,
    jumps = 0,
    landed = 0;
  for (let i = 0; i < 120; i++) {
    const m = jumper.move(1 / 240, { x: 0, z: 0 }, { jump: i < 5 });
    jumps += m.jumped ? 1 : 0;
    landed += m.landed ? 1 : 0;
    top = Math.max(top, jumper.position.y);
  }
  near(top, 36 / 40, 0.02);
  for (let i = 0; i < 400; i++) landed += jumper.move(1 / 240, { x: 0, z: 0 }).landed ? 1 : 0;
  assert.deepEqual([jumps, landed, jumper.grounded, jumper.position.y], [1, 1, true, 0]);

  // The same steps twice give the same place; teleport settles the ground.
  const a = new ZhudaCharacterController({ world: flat, position: { x: 0, y: 0, z: 0 } }),
    b = new ZhudaCharacterController({ world: flat, position: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 300; i++)
    (a.move(1 / 60, { x: Math.sin(i), z: Math.cos(i * 0.7) }),
      b.move(1 / 60, { x: Math.sin(i), z: Math.cos(i * 0.7) }));
  assert.deepEqual(a.position, b.position);
  a.teleport({ x: -3, y: 5, z: 0 });
  assert.equal(a.grounded, false);
  a.teleport({ x: -3, y: 0.2, z: 0 });
  assert.deepEqual([a.grounded, a.position.y], [true, 0]);
  assert.throws(
    () => new ZhudaCharacterController({ world: {}, position: { x: 0, y: 0, z: 0 } }),
    /ground/,
  );
  assert.throws(
    () =>
      new ZhudaCharacterController({ world: flat, position: { x: 0, y: 0, z: 0 }, height: 0.2 }),
    /two radii/,
  );
  assert.throws(() => a.move(2, { x: 0, z: 0 }), /seconds/);
  assert.throws(() => a.move(0.1, { x: NaN, z: 0 }), /wish/);
});

test('the same solids stop a camera boom', () => {
  const solids = [
    box(-1, -3, 1, -2),
    { kind: 'cylinder', center: { x: 4, z: 0 }, radius: 0.5, minY: 0, maxY: 2 },
  ];
  const provider = zhudaSolidQueryProvider(solids, 'town');
  const hit = provider.raycast(
    { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
    10,
  );
  near(hit.distance, 2);
  assert.deepEqual(hit.normal, { x: 0, y: 0, z: 1 });
  assert.equal(
    provider.raycast({ origin: { x: 0, y: 5, z: 0 }, direction: { x: 0, y: 0, z: -1 } }, 10),
    null,
    'over the box',
  );
  assert.equal(
    provider.raycast({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } }, 1.5),
    null,
    'out of reach',
  );
  const side = provider.raycast(
    { origin: { x: 0, y: 1, z: 0 }, direction: { x: 1, y: 0, z: 0 } },
    10,
  );
  near(side.distance, 3.5);
  near(side.normal.x, -1);
  const cap = provider.raycast(
    { origin: { x: 4, y: 5, z: 0 }, direction: { x: 0, y: -1, z: 0 } },
    10,
  );
  near(cap.distance, 3);
  assert.deepEqual(cap.normal, { x: 0, y: 1, z: 0 });
  // A camera 4 m behind a character who stands 2 m in front of the box comes forward of it.
  const queries = new ZhudaSceneQueries();
  queries.register(provider);
  const boom = resolveCameraBoom({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.5, z: -4 }, { queries });
  assert.equal(boom.blocked, true);
  assert.ok(boom.position.z > -2 && boom.position.z < 0, `camera at z ${boom.position.z}`);
  const free = resolveCameraBoom({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.5, z: 4 }, { queries });
  assert.equal(free.blocked, false);
});
