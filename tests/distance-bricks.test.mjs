import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaDistanceBricks,
  validateZhudaDistanceBricks,
} from '../packages/core/runtime3d/DistanceBricks.ts';
import { ZhudaSceneQueries } from '../packages/core/runtime3d/SceneQueries.ts';
import { resolveCameraBoom } from '../packages/core/runtime3d/CameraCollision.ts';
import { zhudaIsosurfaceGrid } from '../packages/core/procedural/Isosurface.ts';

const sphere = (x, y, z) => Math.hypot(x, y, z) - 2;
const box = (x, y, z, c, h) => {
  const qx = Math.abs(x - c[0]) - h[0],
    qy = Math.abs(y - c[1]) - h[1],
    qz = Math.abs(z - c[2]) - h[2];
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
    Math.min(Math.max(qx, qy, qz), 0)
  );
};
/**
 * A wall 4 m wide, 3 m high and 1 m thick with an opening 1.2 m wide and
 * 1.5 m high through it: two pillars and a lintel, a union of exact boxes,
 * so the distance is exact outside (a wall minus an opening, max(a, -b),
 * would say less than the true distance inside the opening).
 */
const arch = (x, y, z) =>
  Math.min(
    box(x, y, z, [-1.3, 1.5, 0], [0.7, 1.5, 0.5]),
    box(x, y, z, [1.3, 1.5, 0], [0.7, 1.5, 0.5]),
    box(x, y, z, [0, 2.25, 0], [0.6, 0.75, 0.5]),
  );
/** Deterministic points in a box. */
function* points(count, min, max) {
  let s = 12345;
  const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < count; i++) yield [0, 1, 2].map((k) => min[k] + (max[k] - min[k]) * r());
}

const ball = ZhudaDistanceBricks.build({
  distance: sphere,
  min: [-4, -4, -4],
  max: [4, 4, 4],
  cellSize: 0.1,
  band: 0.5,
});

test('distances near the surface within a quantization step, beyond it at least band with the sign', () => {
  const step = 0.5 / 127;
  let worst = 0,
    near = 0;
  for (const p of points(20000, [-3.9, -3.9, -3.9], [3.9, 3.9, 3.9])) {
    const exact = sphere(...p),
      kept = ball.distance(...p);
    if (Math.abs(exact) < 0.45) {
      near++;
      worst = Math.max(worst, Math.abs(kept - exact));
    } else if (Math.abs(exact) > 0.75) assert.equal(kept, Math.sign(exact) * 0.5, `${p}`);
  }
  assert.ok(near > 1000, `${near} points near the surface`);
  // A step of the bytes, and what trilinear makes of a curved surface 0.1 m apart.
  assert.ok(worst < step + 0.004, `largest error ${worst} m (step ${step})`);
  assert.equal(ball.distance(0, 0, 0), -0.5, 'deep inside: at least band inside');
  assert.equal(ball.distance(9, 0, 0), 0.5, 'outside the region: band');
  assert.equal(ball.contains(9, 0, 0), false);
});

test('normals point out of the surface', () => {
  for (const p of points(500, [-3, -3, -3], [3, 3, 3])) {
    const r = Math.hypot(...p);
    if (Math.abs(r - 2) > 0.3) continue;
    const n = ball.normal(...p);
    const cos = (n[0] * p[0] + n[1] * p[1] + n[2] * p[2]) / r;
    assert.ok(cos > Math.cos((3 * Math.PI) / 180), `${p}: ${n}`);
  }
});

test('a ray meets the sphere where it should, misses it, and starts inside at 0', () => {
  const hit = ball.raycast([-3.5, 0.3, 0.1], [1, 0, 0]);
  assert.ok(Math.abs(hit.distance - (3.5 - Math.sqrt(4 - 0.1))) < 0.01, `${hit.distance}`);
  assert.ok(Math.abs(Math.hypot(...hit.position) - 2) < 0.01);
  assert.ok(hit.normal[0] < -0.98);
  assert.equal(ball.raycast([-3.5, 2.5, 0], [1, 0, 0]), null, 'passes over it');
  assert.equal(ball.raycast([-3.5, 0, 0], [1, 0, 0], 1), null, 'stops short of it');
  assert.equal(ball.raycast([0, 0, 0], [0, 1, 0]).distance, 0, 'from inside');
  // From outside the region: the ray is followed from where it enters.
  const far = ball.raycast([-9, 0, 0], [1, 0, 0]);
  assert.ok(Math.abs(far.distance - 7) < 0.01, `${far.distance}`);
  assert.equal(ball.raycast([-9, 0, 0], [-1, 0, 0]), null, 'away from the region');
});

const wall = ZhudaDistanceBricks.build({
  distance: arch,
  min: [-3, -1, -3.5],
  max: [3, 3.5, 3.5],
  cellSize: 0.05,
  band: 1,
});

test('a sphere smaller than an opening sweeps through it; a larger one stops at the wall', () => {
  assert.equal(wall.sweepSphere([0, 0.7, -3], [0, 0.7, 3], 0.4), null, 'r 0.4 through 1.2 m');
  const stuck = wall.sweepSphere([0, 0.7, -3], [0, 0.7, 3], 0.7);
  // It touches the edges of the opening (x = ±0.6 on the face z = -0.5) at z = -0.5 - sqrt(0.7² - 0.6²).
  const expected = 3 - 0.5 - Math.sqrt(0.49 - 0.36);
  assert.ok(Math.abs(stuck.distance - expected) < 0.02, `${stuck.distance} against ${expected}`);
  assert.ok(stuck.normal[2] < -0.5, `pushed back toward -z: ${stuck.normal}`);
  // Through the solid part of the wall it stops at the face, one radius off.
  const face = wall.sweepSphere([1.4, 2.2, -3], [1.4, 2.2, 3], 0.3);
  assert.ok(Math.abs(face.position[2] - -0.8) < 0.02, `${face.position}`);
  assert.throws(() => wall.sweepSphere([0, 0, 0], [0, 0, 1], 1), /below band/);
  assert.equal(wall.sweepSphere([0, 2, -0.5], [0, 2, -0.5], 0.3).distance, 0, 'already touching');
});

test("a consumer's slide along the wall: the sphere moves along it and never ends inside", () => {
  // The rule is the test's own, as it would be a game's: move to the contact,
  // then spend what is left of the move along the surface, three times at most.
  const slide = (from, to, radius) => {
    let position = from,
      target = to;
    for (let i = 0; i < 3; i++) {
      const hit = wall.sweepSphere(position, target, radius);
      if (!hit) return target;
      const back = 0.002;
      position = hit.position.map((v, k) => v + hit.normal[k] * back);
      const rest = target.map((v, k) => v - position[k]);
      const into = rest[0] * hit.normal[0] + rest[1] * hit.normal[1] + rest[2] * hit.normal[2];
      target = position.map((v, k) => v + rest[k] - hit.normal[k] * Math.min(0, into));
    }
    return position;
  };
  // Toward the solid wall at a slant: it ends against the face and slides along x.
  const end = slide([1.4, 2.2, -2], [2.6, 2.2, 1], 0.3);
  assert.ok(Math.abs(end[2] - -0.8) < 0.03, `stays in front of the face: ${end}`);
  assert.ok(end[0] > 2.5, `moved along it: ${end}`);
  assert.ok(wall.distance(...end) >= 0.3 - 0.01, 'not inside');
});

test('the camera boom stops short of rock kept as bricks', () => {
  const queries = new ZhudaSceneQueries();
  const solid = ZhudaDistanceBricks.build({
    distance: (x, y, z) => box(x, y, z, [0, 1.5, 0], [2, 1.5, 0.5]),
    min: [-3, -1, -3.5],
    max: [3, 3.5, 3.5],
    cellSize: 0.05,
    band: 1,
  });
  const off = queries.register(solid.queryProvider('rock'));
  const boom = resolveCameraBoom(
    { x: 0, y: 1.5, z: -3 },
    { x: 0, y: 1.5, z: 3 },
    { queries, radius: 0.2, clearance: 0.1 },
  );
  assert.equal(boom.blocked, true);
  assert.ok(boom.position.z < -0.5 - 0.2 && boom.position.z > -1.0, `${boom.position.z}`);
  const sweep = queries.sweepSphere({ x: 0, y: 1.5, z: -3 }, { x: 0, y: 1.5, z: 3 }, 0.25);
  assert.equal(sweep.entityId, 'rock');
  assert.ok(Math.abs(sweep.position.z - -0.75) < 0.02);
  off();
  assert.equal(
    resolveCameraBoom({ x: 0, y: 1.5, z: -3 }, { x: 0, y: 1.5, z: 3 }, { queries }).blocked,
    false,
  );
});

test('memory: bytes near the surface instead of a full grid; a volume gives the same field', () => {
  const s = ball.stats;
  assert.deepEqual([s.total, ball.bricks], [27 * 27 * 27, [27, 27, 27]]);
  assert.ok(s.kept < s.total / 4, `${s.kept} of ${s.total} bricks kept`);
  assert.equal(s.bytes, s.kept * 64 + s.total * 4);
  assert.ok(
    s.bytes * 8 < s.denseBytes,
    `${s.bytes} bytes against ${s.denseBytes} for a dense float grid`,
  );
  // From a volume on the isosurface grid of the same box (values at the grid points).
  const grid = zhudaIsosurfaceGrid([-4, -4, -4], [4, 4, 4], 0.1);
  const values = new Float32Array(grid.size[0] * grid.size[1] * grid.size[2]);
  for (let k = 0, n = 0; k < grid.size[2]; k++)
    for (let j = 0; j < grid.size[1]; j++)
      for (let i = 0; i < grid.size[0]; i++, n++)
        values[n] = sphere(
          grid.origin[0] + i * 0.1,
          grid.origin[1] + j * 0.1,
          grid.origin[2] + k * 0.1,
        );
  const fromVolume = ZhudaDistanceBricks.build({
    volume: { values, size: grid.size, origin: grid.origin, cellSize: 0.1, backend: 'cpu' },
    min: [-4, -4, -4],
    max: [4, 4, 4],
    cellSize: 0.1,
    band: 0.5,
  });
  let worst = 0;
  for (const p of points(3000, [-3, -3, -3], [3, 3, 3]))
    worst = Math.max(worst, Math.abs(fromVolume.distance(...p) - ball.distance(...p)));
  assert.ok(worst < 0.01, `${worst}`);
});

test('bad options are refused', () => {
  const ok = { distance: sphere, min: [0, 0, 0], max: [1, 1, 1], cellSize: 0.1 };
  assert.deepEqual(validateZhudaDistanceBricks(ok), []);
  assert.match(validateZhudaDistanceBricks({ ...ok, distance: undefined }).join(), /distance/);
  assert.match(validateZhudaDistanceBricks({ ...ok, max: [0, 1, 1] }).join(), /min below max/);
  assert.match(validateZhudaDistanceBricks({ ...ok, band: 0.1 }).join(), /two cells/);
  assert.match(
    validateZhudaDistanceBricks({ ...ok, max: [1000, 1000, 1000], cellSize: 0.05 }).join(),
    /at most 16777216/,
  );
  assert.throws(
    () => ZhudaDistanceBricks.build({ ...ok, distance: () => Number.NaN }),
    /not finite/,
  );
  assert.throws(() => ball.raycast([0, 0, 0], [0, 0, 0]), /not zero/);
});
