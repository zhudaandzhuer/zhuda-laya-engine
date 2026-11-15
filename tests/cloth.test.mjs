// Cloth: the shapes, the bodies it is kept out of, the fixed step, and the
// solver's promises (the same deltas give the same cloth; a pause changes
// nothing; a long gap does no harm; no particle ends a step inside a body).
// Plain arithmetic, no browser; the draw is verify:cloth.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_CLOTH_BEND,
  ZHUDA_CLOTH_SHEAR,
  ZHUDA_CLOTH_SPAN,
  ZHUDA_CLOTH_STRUCTURAL,
  ZhudaClothSolver,
  ZhudaFixedStep,
  createZhudaClothFromMesh,
  createZhudaClothGrid,
  createZhudaClothTube,
  resolveZhudaClothOptions,
  validateZhudaClothShape,
  validateZhudaCollider,
  zhudaColliderDepth,
  prepareZhudaTable,
  zhudaTableRadius,
  zhudaTableReach,
} from '../packages/core/simulation/index.ts';
import { ZhudaCloth } from '../packages/core/runtime3d/Cloth.ts';
import { ZhudaLayeredClock } from '../packages/core/runtime3d/Clocks.ts';

const bytes = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const same = (a, b) => bytes(a).equals(bytes(b));
const at = (cloth, i) => Array.from(cloth.positions.subarray(i * 3, i * 3 + 3));
const kinds = (shape) => {
  const count = [0, 0, 0, 0];
  for (const kind of shape.constraints.kind) count[kind]++;
  return count;
};
const frames = (cloth, count, delta = 1 / 60) => {
  for (let f = 0; f < count; f++) cloth.advance(delta);
};
/** A body like a vase: wider in the middle, a little off round. */
const vase = (origin = [0, 0, 0]) => {
  const rows = 8,
    columns = 16,
    radii = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < columns; j++)
      radii.push(
        0.16 +
          0.05 * Math.sin((i / (rows - 1)) * Math.PI) +
          0.02 * Math.cos((j / columns) * 2 * Math.PI),
      );
  return {
    type: 'table',
    origin,
    axis: [0, 1, 0],
    forward: [0, 0, 1],
    height: 0.8,
    rows,
    columns,
    radii,
  };
};

test('a sheet is a weave of particles, with diagonals and what keeps it flat', () => {
  const shape = createZhudaClothGrid({ columns: 4, rows: 3, width: 3, height: 2 });
  assert.deepEqual(validateZhudaClothShape(shape), []);
  assert.equal(shape.particles.length, 12 * 3);
  // Across 3 a row and down 2 a column; two diagonals a cell; two apart across and down.
  assert.deepEqual(kinds(shape), [3 * 3 + 4 * 2, 3 * 2 * 2, 2 * 3 + 4 * 1, 0]);
  assert.deepEqual([shape.columns, shape.rows], [4, 3]);
  // The top edge centred on the origin, hanging down.
  assert.deepEqual(Array.from(shape.particles.subarray(0, 3)), [-1.5, 0, 0]);
  assert.deepEqual(Array.from(shape.particles.subarray(11 * 3)), [1.5, -2, 0]);
  // One vertex a particle; two triangles a cell.
  assert.deepEqual(Array.from(shape.particleOf), [...Array(12).keys()]);
  assert.equal(shape.indices.length, 3 * 2 * 6);
  assert.deepEqual(Array.from(shape.uvs.subarray(0, 2)), [0, 0]);
  assert.deepEqual(Array.from(shape.uvs.subarray(11 * 2)), [1, 1]);
  // The front faces +z: seen from there a triangle is wound as LayaAir draws a
  // front (the cross of its two edges points away from the eye).
  const [a, b, c] = shape.indices;
  const p = (i) => Array.from(shape.particles.subarray(i * 3, i * 3 + 3));
  const u = p(b).map((v, k) => v - p(a)[k]),
    v = p(c).map((value, k) => value - p(a)[k]);
  assert.ok(u[0] * v[1] - u[1] * v[0] < 0, 'cross(e1, e2) points to -z');
  // Each rest length is the distance it was made at.
  const { constraints } = shape;
  for (let i = 0; i < constraints.a.length; i++) {
    const d = p(constraints.a[i]).map((value, k) => value - p(constraints.b[i])[k]);
    assert.ok(Math.abs(Math.hypot(...d) - constraints.rest[i]) < 1e-6);
  }
  assert.throws(
    () => createZhudaClothGrid({ columns: 1, rows: 3, width: 1, height: 1 }),
    /columns/,
  );
  assert.throws(
    () => createZhudaClothGrid({ columns: 256, rows: 256, width: 1, height: 1 }),
    /65535/,
  );
  assert.throws(() => createZhudaClothGrid({ columns: 3, rows: 3, width: 0, height: 1 }), /width/);
  assert.throws(
    () => createZhudaClothGrid({ columns: 3, rows: 3, width: 1, height: 1, right: [0, 0, 0] }),
    /right: a direction/,
  );
});

test('a tube is closed round, with a seam in its mesh and its front outward', () => {
  const shape = createZhudaClothTube({
    columns: 8,
    rows: 3,
    center: [0, 1, 0],
    topRadius: 0.2,
    bottomRadius: 0.4,
    length: 0.5,
  });
  assert.deepEqual(validateZhudaClothShape(shape), []);
  assert.equal(shape.particles.length, 24 * 3);
  // Round 8 a ring and down 2 a column; diagonals; two apart round (all 8) and down.
  // and a span four apart round each ring, as long as the four threads between.
  assert.deepEqual(kinds(shape), [8 * 3 + 8 * 2, 8 * 2 * 2, 8 * 3 + 8 * 1, 8 * 3]);
  const span = shape.constraints.kind.indexOf(ZHUDA_CLOTH_SPAN);
  assert.deepEqual([shape.constraints.a[span], shape.constraints.b[span]], [0, 4]);
  assert.ok(
    Math.abs(shape.constraints.rest[span] - 4 * 2 * 0.2 * Math.sin(Math.PI / 8)) < 1e-6,
    'the way round, not the way across',
  );
  // One more column of vertices, and the last is the first particle again.
  assert.equal(shape.particleOf.length, 9 * 3);
  assert.equal(shape.particleOf[8], shape.particleOf[0]);
  assert.equal(shape.uvs[8 * 2], 1);
  // The first ring at the centre's height, the last half a metre down, wider.
  const p = (i) => Array.from(shape.particles.subarray(i * 3, i * 3 + 3));
  assert.ok(Math.abs(Math.hypot(p(0)[0], p(0)[2]) - 0.2) < 1e-6 && Math.abs(p(0)[1] - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(p(16)[0], p(16)[2]) - 0.4) < 1e-6);
  assert.ok(Math.abs(p(16)[1] - 0.5) < 1e-6);
  // Every triangle's front is outward: the cross of its edges points to the axis.
  for (let t = 0; t < shape.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => p(shape.particleOf[shape.indices[t + k]]));
    const u = b.map((v, k) => v - a[k]),
      v = c.map((value, k) => value - a[k]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const outward = [a[0] + b[0] + c[0], 0, a[2] + b[2] + c[2]];
    assert.ok(cross[0] * outward[0] + cross[2] * outward[2] < 0, `triangle ${t / 3}`);
  }
  assert.throws(
    () =>
      createZhudaClothTube({
        columns: 3,
        rows: 3,
        center: [0, 0, 0],
        topRadius: 1,
        bottomRadius: 1,
        length: 1,
      }),
    /columns/,
  );
  assert.throws(
    () =>
      createZhudaClothTube({
        columns: 8,
        rows: 3,
        center: [0, 0, 0],
        topRadius: 1,
        bottomRadius: 1,
        length: 1,
        forward: [0, -1, 0],
      }),
    /forward/,
  );
});

test('a cloth from a mesh: vertices in one place are one particle, edges are held, folds resisted', () => {
  // Two triangles of a square, the diagonal's two vertices given twice (a seam).
  const shape = createZhudaClothFromMesh({
    positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0],
    indices: [0, 1, 2, 3, 4, 5],
  });
  assert.deepEqual(validateZhudaClothShape(shape), []);
  assert.equal(shape.particles.length, 4 * 3);
  assert.deepEqual(Array.from(shape.particleOf), [0, 1, 2, 0, 2, 3]);
  // Five edges (four sides and the diagonal), and the two far corners across the diagonal.
  assert.deepEqual(kinds(shape), [5, 0, 1, 0]);
  const bend = shape.constraints.kind.indexOf(ZHUDA_CLOTH_BEND);
  assert.deepEqual([shape.constraints.a[bend], shape.constraints.b[bend]], [1, 3]);
  assert.ok(Math.abs(shape.constraints.rest[bend] - Math.SQRT2) < 1e-6);
  assert.equal(shape.uvs.length, 12);
  assert.throws(
    () => createZhudaClothFromMesh({ positions: [0, 0, 0, 1, 0, 0, 1, 1, 0], indices: [0, 1, 3] }),
    /3 is not a vertex/,
  );
  assert.throws(
    () => createZhudaClothFromMesh({ positions: [0, 0, 0, 1, 0], indices: [0, 1, 2] }),
    /three numbers a vertex/,
  );
  // A shape put together by hand is checked before it is used.
  const broken = createZhudaClothGrid({ columns: 3, rows: 3, width: 1, height: 1 });
  broken.constraints.a[0] = 99;
  assert.match(validateZhudaClothShape(broken)[0], /particle 99 is not there \(9 particles\)/);
  assert.throws(() => new ZhudaClothSolver(broken), /Invalid cloth shape: .*particle 99/);
  assert.equal(ZHUDA_CLOTH_STRUCTURAL + ZHUDA_CLOTH_SHEAR, 1);
});

test('a body says how deep a point is in it and the way out', () => {
  const out = new Float64Array(6);
  const near = (got, want, what) =>
    want.forEach((value, k) =>
      assert.ok(Math.abs(got[k] - value) < 1e-9, `${what} ${k}: ${got[k]}`),
    );
  // A ball.
  const ball = { type: 'sphere', center: [1, 2, 3], radius: 0.5 };
  assert.ok(Math.abs(zhudaColliderDepth(ball, 0, 1.3, 2, 3, out) - 0.2) < 1e-9);
  near(out, [1.5, 2, 3, 1, 0, 0], 'ball');
  assert.ok(zhudaColliderDepth(ball, 0, 1.6, 2, 3) < 0);
  assert.ok(Math.abs(zhudaColliderDepth(ball, 0.02, 1.51, 2, 3, out) - 0.01) < 1e-9, 'grown');
  near(out, [1.52, 2, 3], 'grown ball');
  assert.ok(zhudaColliderDepth(ball, 0, 1, 2, 3, out) > 0);
  near(out, [1, 2.5, 3, 0, 1, 0], 'a point at the very middle goes up');
  // A rod: its side, and past its end.
  const rod = { type: 'capsule', a: [0, 0, 0], b: [2, 0, 0], radius: 0.25 };
  assert.ok(Math.abs(zhudaColliderDepth(rod, 0, 1, 0.1, 0, out) - 0.15) < 1e-9);
  near(out, [1, 0.25, 0, 0, 1, 0], 'rod side');
  assert.ok(Math.abs(zhudaColliderDepth(rod, 0, 2.2, 0, 0, out) - 0.05) < 1e-9);
  near(out, [2.25, 0, 0, 1, 0, 0], 'rod end');
  // A floor.
  const floor = { type: 'plane', point: [0, 1, 0], normal: [0, 1, 0] };
  assert.ok(Math.abs(zhudaColliderDepth(floor, 0, 5, 0.75, -3, out) - 0.25) < 1e-9);
  near(out, [5, 1, -3, 0, 1, 0], 'floor');
  assert.ok(zhudaColliderDepth(floor, 0, 5, 1.2, -3) < 0);
  // A table: the radius between its values, round and up.
  const body = vase([0, 1, 0]);
  assert.ok(Math.abs(zhudaTableRadius(body, 0, 0) - 0.18) < 1e-6, 'the foot, forward');
  assert.ok(Math.abs(zhudaTableRadius(body, 0, Math.PI) - 0.14) < 1e-6, 'the foot, behind');
  assert.ok(
    Math.abs(zhudaTableRadius(body, 0, Math.PI / 16) - (body.radii[0] + body.radii[1]) / 2) < 1e-6,
    'half way between two columns',
  );
  assert.ok(
    Math.abs(zhudaTableRadius(body, 0, -Math.PI / 16) - (body.radii[0] + body.radii[15]) / 2) <
      1e-6,
    'round the seam',
  );
  assert.ok(
    Math.abs(zhudaTableRadius(body, 0.8 / 14, 0) - (body.radii[0] + body.radii[16]) / 2) < 1e-6,
    'half way between two rings',
  );
  assert.equal(zhudaTableRadius(body, 5, 0), zhudaTableRadius(body, 0.8, 0), 'clamped above');
  assert.ok(Math.abs(zhudaTableReach(body) - Math.max(...body.radii)) < 1e-12);
  // Inside by its side, at its widest (the radius does not change with height
  // there): out to the surface, by the shortest way, which on an oval is not
  // quite straight out from the axis.
  const side = zhudaTableRadius(body, 0.4, Math.PI / 2);
  const depth = zhudaColliderDepth(body, 0, 0.1, 1.4, 0, out);
  assert.ok(depth > 0 && depth <= side - 0.1 + 1e-9, `no farther than straight out (${depth})`);
  assert.ok(Math.abs(depth - (side - 0.1)) < 0.003, 'and nearly that');
  const landed = Array.from(out.subarray(0, 3));
  // Put out of it, and no farther than a hair past its surface (the surface is curved).
  const after = zhudaColliderDepth(body, 0, ...landed);
  assert.ok(after <= 1e-6 && after > -0.002, `put on the surface (${after})`);
  assert.ok(Math.abs(Math.hypot(...landed.map((v, k) => v - [0.1, 1.4, 0][k])) - depth) < 2e-3);
  assert.ok(Math.abs(Math.hypot(out[3], out[4], out[5]) - 1) < 1e-9 && out[3] > 0.95);
  // On a shoulder (the radius falls with height) the way out is up as much as out.
  const dome = {
    ...body,
    radii: Array.from(
      { length: 8 * 16 },
      (_, i) => 0.3 * Math.sqrt(1 - (Math.floor(i / 16) / 7) ** 2),
    ),
  };
  const under = zhudaColliderDepth(dome, 0, 0.05, 1.7, 0, out);
  assert.ok(under > 0, 'under the shoulder');
  assert.ok(out[4] > 0.5, `pushed up as much as out (${out[4]})`);
  assert.ok(out[1] > 1.7 && Math.abs(out[0] - 0.05) < 0.1, 'not thrown sideways');
  assert.ok(zhudaColliderDepth(dome, 0, out[0], out[1], out[2]) <= 1e-6, 'and out of it');
  // Wherever a point is inside, where it is put is not.
  for (let i = 0; i < 400; i++) {
    const point = [0.35 * Math.sin(i * 1.7), 1 + 0.8 * ((i * 0.618) % 1), 0.35 * Math.cos(i * 2.3)];
    for (const table of [body, dome])
      if (zhudaColliderDepth(table, 0.01, ...point, out) > 0)
        assert.ok(
          zhudaColliderDepth(table, 0.01, out[0], out[1], out[2]) <= 1e-6,
          `point ${i} (${point}) put at ${Array.from(out.subarray(0, 3))}`,
        );
  }
  // Just under its top: out through the top, which is nearer.
  assert.ok(Math.abs(zhudaColliderDepth(body, 0, 0.05, 1.79, 0, out) - 0.01) < 1e-9);
  near(out, [0.05, 1.8, 0, 0, 1, 0], 'table top');
  assert.ok(Math.abs(zhudaColliderDepth(body, 0, 0.05, 1.004, 0, out) - 0.004) < 1e-9);
  near(out, [0.05, 1, 0, 0, -1, 0], 'table foot');
  assert.ok(zhudaColliderDepth(body, 0, 0.05, 1.9, 0) < 0, 'above it');
  assert.ok(zhudaColliderDepth(body, 0, 0.5, 1.4, 0) < 0, 'beside it');
  // A table worked out beforehand gives the same answers, to the bit.
  const prepared = prepareZhudaTable(body);
  assert.equal(prepared.reach, zhudaTableReach(body));
  const other = new Float64Array(6);
  for (let i = 0; i < 400; i++) {
    const point = [0.3 * Math.sin(i * 1.7), 1 + 0.8 * ((i * 0.618) % 1), 0.3 * Math.cos(i * 2.3)];
    const plain = zhudaColliderDepth(body, 0.01, ...point, out),
      quick = zhudaColliderDepth(body, 0.01, ...point, other, prepared);
    assert.equal(quick > 0, plain > 0, `point ${i}`);
    if (plain > 0) {
      assert.equal(quick, plain);
      assert.deepEqual(Array.from(other), Array.from(out));
    }
  }
  // Filled again in place when the table is the same size.
  assert.equal(prepareZhudaTable({ ...body, origin: [5, 5, 5] }, prepared), prepared);
});

test('a body that is not one is refused in words', () => {
  assert.deepEqual(validateZhudaCollider({ type: 'sphere', center: [0, 0, 0], radius: 1 }), []);
  assert.deepEqual(validateZhudaCollider(vase()), []);
  assert.match(validateZhudaCollider(null)[0], /an object with a type/);
  assert.match(validateZhudaCollider({ type: 'box' })[0], /sphere, capsule, table or plane/);
  assert.match(
    validateZhudaCollider({ type: 'sphere', center: [0, 0], radius: 1 })[0],
    /collider.center: three finite numbers/,
  );
  assert.match(
    validateZhudaCollider({ type: 'capsule', a: [0, 0, 0], b: [1, 0, 0], radius: 0 })[0],
    /collider.radius: metres, more than 0/,
  );
  assert.match(
    validateZhudaCollider({ type: 'plane', point: [0, 0, 0], normal: [0, 2, 0] })[0],
    /normal: a unit vector/,
  );
  assert.match(
    validateZhudaCollider({ ...vase(), radii: [0.1, 0.2] })[0],
    /radii: 128 radii \(rows times columns\), not 2/,
  );
  assert.match(validateZhudaCollider({ ...vase(), forward: [0, 1, 0] })[0], /square to the axis/);
  assert.match(validateZhudaCollider({ ...vase(), rows: 1 })[0], /rows: a whole number, 2 to 1024/);
  const cloth = new ZhudaClothSolver(
    createZhudaClothGrid({ columns: 3, rows: 3, width: 1, height: 1 }),
  );
  assert.throws(() => cloth.addCollider({ type: 'sphere', center: [0, 0, 0] }), /radius/);
  const id = cloth.addCollider({ type: 'sphere', center: [0, 0, 0], radius: 1 });
  assert.equal(cloth.colliders.size, 1);
  cloth.setCollider(id, { type: 'sphere', center: [0, 5, 0], radius: 1 });
  assert.deepEqual(cloth.colliders.get(id).center, [0, 5, 0]);
  assert.throws(() => cloth.setCollider(99, vase()), /No collider 99/);
  cloth.removeCollider(id);
  assert.throws(() => cloth.removeCollider(id), /No collider/);
});

test('the fixed step hands a delta out in whole steps and drops what is over its cap', () => {
  const clock = new ZhudaFixedStep({ step: 1 / 100, maxSteps: 5 });
  assert.equal(clock.take(0.025), 2);
  assert.ok(Math.abs(clock.pendingSeconds - 0.005) < 1e-12);
  assert.ok(Math.abs(clock.alpha - 0.5) < 1e-9);
  assert.equal(clock.take(0.005), 1, 'what was left counts');
  assert.equal(clock.take(0), 0);
  assert.equal(clock.take(0.004), 0);
  assert.equal(clock.take(0.006), 1);
  // A second of nothing: five steps, the other ninety-five dropped, nothing kept to catch up with.
  assert.equal(clock.take(1), 5);
  assert.deepEqual([clock.steps, clock.dropped], [9, 95]);
  assert.ok(clock.pendingSeconds < 1e-9);
  assert.equal(clock.take(0.01), 1);
  for (const bad of [-0.01, Number.NaN, Infinity, '0.1'])
    assert.throws(() => clock.take(bad), /Invalid delta: seconds, zero or more/);
  assert.deepEqual([clock.steps, clock.dropped], [10, 95], 'a refused delta changes nothing');
  clock.reset();
  assert.deepEqual([clock.steps, clock.dropped, clock.pendingSeconds], [0, 0, 0]);
  assert.throws(() => new ZhudaFixedStep({ step: 0, maxSteps: 1 }), /Invalid step/);
  assert.throws(() => new ZhudaFixedStep({ step: 0.01, maxSteps: 0 }), /Invalid maxSteps/);
});

test("a cloth's options have defaults and ranges, and an unknown one is named", () => {
  const options = resolveZhudaClothOptions();
  assert.deepEqual(options, {
    step: 1 / 240,
    rounds: 2,
    maxSteps: 8,
    gravity: [0, -9.81, 0],
    drag: 1,
    compliance: { structural: 0, shear: 3e-4, bend: 2e-4 },
    thickness: 0.01,
    friction: 0.5,
    maxSpeed: 6,
    wind: [0, 0, 0],
    windDrag: 2,
    tether: 0.02,
    grabSpeed: 10,
    grabStretch: 0.1,
  });
  assert.equal(resolveZhudaClothOptions({ tether: false }).tether, false);
  assert.throws(
    () => resolveZhudaClothOptions({ stiffness: 1 }),
    /Unknown cloth option: stiffness/,
  );
  assert.throws(() => resolveZhudaClothOptions({ rounds: 0 }), /Invalid rounds/);
  assert.throws(() => resolveZhudaClothOptions({ step: 1 }), /Invalid step/);
  assert.throws(() => resolveZhudaClothOptions({ gravity: [0, 1] }), /Invalid gravity/);
  assert.throws(() => resolveZhudaClothOptions({ friction: 5 }), /Invalid friction: 0 to 4/);
  assert.throws(
    () => resolveZhudaClothOptions({ compliance: { twist: 1 } }),
    /Unknown compliance: twist/,
  );
  assert.throws(() => resolveZhudaClothOptions({ compliance: { bend: -1 } }), /compliance.bend/);
});

const hung = (options) => {
  const cloth = new ZhudaClothSolver(
    createZhudaClothGrid({ columns: 13, rows: 13, width: 1, height: 1, origin: [-0.5, 2, 0] }),
    options,
  );
  for (let c = 0; c < 13; c++) cloth.pin(c);
  return cloth;
};

test('the same deltas give the same cloth, to the last bit', () => {
  const deltas = Array.from({ length: 180 }, (_, f) => (f % 7 === 3 ? 1 / 30 : 1 / 60));
  const run = () => {
    const cloth = hung({ wind: [0.5, 0, 2], windDrag: 2 });
    cloth.addCollider({ type: 'sphere', center: [0, 1.4, 0.15], radius: 0.3 });
    cloth.grab(13 * 12 + 6);
    deltas.forEach((delta, f) => {
      if (f === 60) cloth.dragTo(13 * 12 + 6, 0.4, 1.6, 0.6);
      if (f === 120) cloth.release(13 * 12 + 6);
      cloth.advance(delta);
    });
    return cloth;
  };
  const one = run(),
    other = run();
  assert.ok(same(one.positions, other.positions), 'a second cloth made the same way');
  assert.ok(same(one.previous, other.previous));
  assert.equal(one.inspect().steps, other.inspect().steps);
  // It did move: the check is not of a cloth that stood still.
  assert.ok(!same(one.positions, one.shape.particles));
  // A delta cut in two is the delta whole, while both hold the same whole steps.
  const whole = hung(),
    halves = hung();
  for (let f = 0; f < 60; f++) {
    whole.advance(1 / 30);
    halves.advance(1 / 60);
    halves.advance(1 / 60);
  }
  assert.equal(whole.inspect().steps, 480);
  assert.equal(halves.inspect().steps, 480);
  assert.ok(same(whole.positions, halves.positions));
  // Put back and run again: the same once more.
  const again = hung();
  frames(again, 90);
  const first = Float32Array.from(again.positions);
  again.reset();
  assert.ok(same(again.positions, again.shape.particles), 'back to its shape');
  frames(again, 90);
  assert.ok(same(again.positions, first));
});

test('a hanging sheet comes to rest, as long as it was made', () => {
  const cloth = hung();
  frames(cloth, 30);
  assert.ok(cloth.inspect().kineticEnergy > 1e-3, 'it swings first');
  frames(cloth, 570);
  const report = cloth.inspect();
  assert.ok(report.kineticEnergy < 1e-6, `at rest (${report.kineticEnergy})`);
  assert.ok(report.maxStretch < 0.05, `not stretched (${report.maxStretch})`);
  // The bottom edge is a metre under the pins, give or take the stretch.
  for (let c = 0; c < 13; c++) {
    const y = at(cloth, 13 * 12 + c)[1];
    assert.ok(y < 1.0 && y > 0.95, `bottom at ${y}`);
  }
  // The pins have not moved.
  for (let c = 0; c < 13; c++)
    assert.deepEqual(at(cloth, c), [c / 12 - 0.5, 2, 0].map(Math.fround));
  assert.equal(report.pinned, 13);
  assert.equal(report.safeRadius, 6 / 240);
});

test('hung by two corners a sheet does not stretch like rubber: no particle strays from its pin', () => {
  const corners = (options) => {
    const cloth = new ZhudaClothSolver(
      createZhudaClothGrid({ columns: 21, rows: 21, width: 1, height: 1, origin: [-0.5, 2, 0] }),
      options,
    );
    cloth.pin(0);
    cloth.pin(20);
    frames(cloth, 1200);
    return cloth.inspect();
  };
  const held = corners(),
    loose = corners({ tether: false });
  assert.ok(held.maxStretch < 0.1, `with the limit: ${held.maxStretch}`);
  assert.ok(loose.maxStretch > 0.15, `without it: ${loose.maxStretch}`);
  assert.ok(held.kineticEnergy < 1e-5, `at rest (${held.kineticEnergy})`);
});

test('a pin holds, moves what hangs from it, and lets go', () => {
  const cloth = hung();
  frames(cloth, 240);
  assert.throws(() => cloth.movePin(100, 0, 0, 0), /not pinned/);
  assert.throws(() => cloth.pin(999), /Invalid particle: 0 to 168/);
  assert.throws(() => cloth.pin(0, [0, Number.NaN, 0]), /Invalid place/);
  // The whole top edge is carried half a metre along x in a second, a little a frame.
  let most = 0;
  for (let f = 1; f <= 60; f++) {
    for (let c = 0; c < 13; c++) cloth.movePin(c, c / 12 - 0.5 + f / 120, 2, 0);
    cloth.advance(1 / 60);
    most = Math.max(most, cloth.measureStrain());
  }
  assert.ok(most < 0.06, `carried without stretching (${most})`);
  frames(cloth, 600);
  const middle = at(cloth, 13 * 12 + 6);
  assert.ok(Math.abs(middle[0] - 0.5) < 0.01, `the bottom followed (${middle[0]})`);
  assert.ok(cloth.inspect().maxStretch < 0.05);
  // Put somewhere else at once: the cloth is carried as it is, its motion with it.
  frames(cloth, 5);
  const was = Float32Array.from(cloth.positions),
    speed = cloth.inspect().kineticEnergy;
  cloth.shift(10, -1, 3);
  for (let i = 0; i < cloth.count; i++)
    assert.deepEqual(
      at(cloth, i),
      [was[i * 3] + 10, was[i * 3 + 1] - 1, was[i * 3 + 2] + 3].map(Math.fround),
    );
  assert.ok(Math.abs(cloth.inspect().kineticEnergy - speed) < 1e-3);
  assert.ok(cloth.inspect().maxStretch < 0.05);
  cloth.shift(-10, 1, -3);
  assert.throws(() => cloth.shift(0, Number.NaN, 0), /Invalid shift/);
  // Let go of everything: it falls.
  for (let c = 0; c < 13; c++) cloth.unpin(c);
  assert.throws(() => cloth.unpin(0), /not pinned/);
  assert.equal(cloth.isPinned(0), false);
  frames(cloth, 30);
  assert.ok(at(cloth, 0)[1] < 1.5, 'the top edge fell');
  // A pin put somewhere: the particle is there at once.
  cloth.pin(5, [3, 3, 3]);
  assert.deepEqual(at(cloth, 5), [3, 3, 3]);
});

test('a hand takes a particle where it is asked to, waits at the cloth where it cannot, and lets go', () => {
  const cloth = hung();
  frames(cloth, 240);
  const corner = 13 * 12; // the bottom left corner
  const rest = at(cloth, corner);
  assert.throws(() => cloth.grab(0), /pinned: unpin it/);
  assert.throws(() => cloth.dragTo(corner, 0, 0, 0), /not held/);
  cloth.grab(corner);
  assert.throws(() => cloth.grab(corner), /held already/);
  assert.throws(() => cloth.pin(corner), /held by a hand/);
  assert.equal(cloth.isGrabbed(corner), true);
  assert.equal(cloth.inspect().grabbed, 1);
  // Within reach: lifted and brought forward a little. The particle is where the hand is.
  const to = [rest[0] + 0.1, rest[1] + 0.25, rest[2] + 0.3];
  cloth.dragTo(corner, ...to);
  let most = 0;
  for (let f = 0; f < 240; f++) {
    cloth.advance(1 / 60);
    most = Math.max(most, cloth.measureStrain());
  }
  // The hand is where it was asked to be, and the particle within the hand's slack of it
  // (a tenth of the weave's spacing: the weight that hangs from it pulls it that far at most).
  const held = at(cloth, corner),
    slack = (0.1 * 1) / 12;
  assert.ok(Math.hypot(...cloth.handOf(corner).map((v, k) => v - to[k])) < 1e-6);
  assert.ok(Math.hypot(...held.map((v, k) => v - to[k])) < slack, `at the hand (${held})`);
  assert.ok(most < 0.12, `not torn from its neighbours on the way (${most})`);
  // Out of reach: three metres off. The cloth is not stretched to follow; the hand waits.
  cloth.dragTo(corner, rest[0] - 3, rest[1], rest[2]);
  most = 0;
  for (let f = 0; f < 240; f++) {
    cloth.advance(1 / 60);
    most = Math.max(most, cloth.measureStrain());
  }
  assert.ok(most < 0.12, `the weave holds (${most})`);
  const hand = cloth.handOf(corner),
    particle = at(cloth, corner);
  assert.ok(hand[0] > rest[0] - 1.5, `the hand waits at the cloth (${hand[0]})`);
  assert.ok(Math.hypot(...hand.map((v, k) => v - particle[k])) <= slack + 1e-6);
  assert.ok(particle[0] < rest[0] - 0.1, `pulled as far as it goes (${particle[0]})`);
  // Let go: it swings back and comes to rest where it hung.
  cloth.release(corner);
  assert.throws(() => cloth.release(corner), /not held/);
  assert.throws(() => cloth.handOf(corner), /not held/);
  frames(cloth, 900);
  const back = at(cloth, corner);
  assert.ok(Math.hypot(...back.map((v, k) => v - rest[k])) < 0.02, `back where it hung (${back})`);
  assert.ok(cloth.inspect().kineticEnergy < 1e-5);
});

test('a pause changes nothing; a long gap spends its cap and does no harm', () => {
  const cloth = hung({ wind: [0, 0, 3], windDrag: 3 });
  cloth.addCollider({ type: 'sphere', center: [0, 1.4, 0.2], radius: 0.3 });
  frames(cloth, 45);
  const before = Float32Array.from(cloth.positions),
    was = Float32Array.from(cloth.previous),
    steps = cloth.inspect().steps;
  // A paused layer hands out zeros.
  for (let f = 0; f < 600; f++) assert.deepEqual(cloth.advance(0), { steps: 0, dropped: 0 });
  assert.ok(same(cloth.positions, before) && same(cloth.previous, was));
  assert.equal(cloth.inspect().steps, steps);
  // A delta that is not one is refused, and nothing has moved.
  for (const bad of [Number.NaN, -1, Infinity])
    assert.throws(() => cloth.advance(bad), /Invalid delta/);
  assert.ok(same(cloth.positions, before));
  // Five seconds in one delta (a lost focus): eight steps, the rest dropped.
  assert.deepEqual(cloth.advance(5), { steps: 8, dropped: 1192 });
  const control = hung({ wind: [0, 0, 3], windDrag: 3 });
  control.addCollider({ type: 'sphere', center: [0, 1.4, 0.2], radius: 0.3 });
  frames(control, 45);
  control.advance(8 / 240);
  assert.ok(same(cloth.positions, control.positions), 'as if a thirtieth of a second had passed');
  // And on it goes: every particle finite, within the sheet's reach of its pins, out of the ball.
  for (let f = 0; f < 120; f++) {
    cloth.advance(f % 10 === 0 ? 2 : 1 / 60);
    assert.equal(cloth.countInside(), 0, `frame ${f}`);
  }
  for (let i = 0; i < cloth.count; i++) {
    const p = at(cloth, i);
    assert.ok(p.every(Number.isFinite));
    assert.ok(Math.hypot(p[0], p[1] - 2, p[2]) < 1.5, `particle ${i} at ${p}`);
  }
  assert.ok(cloth.inspect().maxStretch < 0.1);
});

test('no particle ends a step inside a body: a ball, a rod, a table and a floor', () => {
  const cloth = new ZhudaClothSolver(
    createZhudaClothGrid({
      columns: 25,
      rows: 25,
      width: 1.6,
      height: 1.6,
      origin: [-0.8, 1.4, -0.8],
      down: [0, 0, 1],
    }),
  );
  cloth.addCollider({ type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] });
  cloth.addCollider({ type: 'sphere', center: [-0.35, 0.45, 0], radius: 0.45 });
  cloth.addCollider({ type: 'capsule', a: [-0.7, 0.2, 0.55], b: [0.7, 0.2, 0.55], radius: 0.12 });
  cloth.addCollider(vase([0.45, 0, -0.1]));
  let lowest = Infinity;
  for (let f = 0; f < 480; f++) {
    cloth.advance(1 / 60);
    assert.equal(cloth.countInside(), 0, `frame ${f}`);
    lowest = Math.min(lowest, ...Array.from({ length: cloth.count }, (_, i) => at(cloth, i)[1]));
  }
  // Counted against the bodies themselves, the cloth is its thickness clear of them.
  assert.equal(cloth.countInside(1e-4, 0), 0);
  assert.equal(cloth.countInside(1e-4, 0.009), 0, 'nine millimetres clear of every body');
  assert.ok(lowest > 0.0099, `it lies on the floor, a thickness above it (${lowest})`);
  // It came down onto them: some of it rests on the ball's top, and it is still a cloth.
  const top = Math.max(...Array.from({ length: cloth.count }, (_, i) => at(cloth, i)[1]));
  assert.ok(top > 0.85 && top < 0.95, `over the ball (${top})`);
  assert.ok(cloth.inspect().maxStretch < 0.15);
  // A hand that asks for the middle of the ball is stopped at its skin.
  const corner = 0;
  cloth.grab(corner);
  cloth.dragTo(corner, -0.35, 0.45, 0);
  for (let f = 0; f < 240; f++) {
    cloth.advance(1 / 60);
    assert.equal(cloth.countInside(), 0, `dragged, frame ${f}`);
  }
  const held = at(cloth, corner);
  assert.ok(Math.hypot(held[0] + 0.35, held[1] - 0.45, held[2]) >= 0.46 - 1e-4);
  // A pin is its owner's business: one put inside a body is counted, not moved.
  cloth.release(corner);
  cloth.pin(corner, [-0.35, 0.45, 0]);
  cloth.advance(1 / 60);
  assert.deepEqual(
    at(cloth, corner).map((v) => +v.toFixed(5)),
    [-0.35, 0.45, 0],
  );
  assert.equal(cloth.countInside(), 1);
  assert.equal(cloth.inspect().inside, 1);
});

test('the air pushes a cloth that faces it, and slows one that moves', () => {
  const run = (options) => {
    const cloth = hung(options);
    frames(cloth, 600);
    return cloth;
  };
  const still = run(),
    blown = run({ wind: [0, 0, 4], windDrag: 3 });
  const bottom = (cloth) => at(cloth, 13 * 12 + 6)[2];
  assert.ok(Math.abs(bottom(still)) < 1e-6, 'without wind it hangs straight');
  assert.ok(bottom(blown) > 0.15, `blown along the wind (${bottom(blown)})`);
  assert.ok(blown.inspect().maxStretch < 0.06);
  // Changed while it runs.
  blown.setWind(0, 0, 0);
  frames(blown, 900);
  assert.ok(Math.abs(bottom(blown)) < 0.01, 'the wind dropped, and it hangs again');
  assert.throws(() => blown.setWind(0, 0, 0, 99), /windDrag/);
  blown.setGravity(0, 0, 0);
  assert.deepEqual(blown.options.gravity, [0, 0, 0]);
  blown.setCompliance({ bend: 0.01 });
  assert.equal(blown.options.compliance.bend, 0.01);
  assert.equal(blown.options.compliance.shear, 3e-4);
});

test('the particle a ray comes to first is the one a hand would take', () => {
  const cloth = hung();
  // A ray from in front of the sheet, straight at the particle of column 4, row 6.
  const target = at(cloth, 13 * 6 + 4);
  assert.equal(cloth.nearestToRay([target[0], target[1], 5], [0, 0, -1]), 13 * 6 + 4);
  // A little off it is still it; far off every particle is nothing.
  assert.equal(cloth.nearestToRay([target[0] + 0.02, target[1], 5], [0, 0, -7]), 13 * 6 + 4);
  assert.equal(cloth.nearestToRay([5, 5, 5], [0, 0, -1]), -1);
  // Behind the ray's start does not count.
  assert.equal(cloth.nearestToRay([target[0], target[1], -5], [0, 0, -1]), -1);
  assert.throws(() => cloth.nearestToRay([0, 0, 0], [0, 0, 0]), /direction/);
  assert.throws(() => cloth.nearestToRay([0, 0, 0], [0, 0, 1], 0), /reach/);
});

/** Enough of LayaAir to make a dynamic mesh and count what is made and destroyed. */
function fakeLaya() {
  const log = { meshes: 0, nodes: 0, destroyedMeshes: 0, destroyedNodes: 0, uploads: [] };
  class Node {
    transform = {};
    meshRenderer = {};
    constructor(mesh) {
      this.mesh = mesh;
      log.nodes++;
    }
    destroy() {
      log.destroyedNodes++;
    }
  }
  return {
    log,
    MeshSprite3D: Node,
    Vector3: class {
      constructor(x, y, z) {
        Object.assign(this, { x, y, z });
      }
    },
    Bounds: class {
      constructor(min, max) {
        Object.assign(this, { min, max });
      }
    },
    VertexMesh: { getVertexDeclaration: (text) => text },
    PrimitiveMesh: {
      _createMesh: (declaration, vertices, indices) => {
        log.meshes++;
        return {
          declaration,
          vertices,
          indices,
          _vertexBuffer: { setData: (b, at, from, length) => log.uploads.push({ at, length }) },
          destroy: () => log.destroyedMeshes++,
        };
      },
    },
  };
}

test('a drawn cloth moves its mesh with its particles, on the clock it is given', () => {
  const laya = fakeLaya();
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const parent = { children: [], addChild: (node) => parent.children.push(node) };
    const shape = createZhudaClothTube({
      columns: 12,
      rows: 6,
      center: [0, 1, 0],
      topRadius: 0.2,
      bottomRadius: 0.35,
      length: 0.5,
    });
    const cloth = new ZhudaCloth(shape, parent, { strain: { scale: 10 } });
    assert.equal(parent.children[0], cloth.node);
    assert.equal(cloth.mesh.mesh.declaration, 'POSITION,NORMAL,COLOR,UV');
    assert.equal(cloth.mesh.stride, 12);
    assert.equal(cloth.mesh.vertices.length, 13 * 6 * 12);
    for (let c = 0; c < 12; c++) cloth.solver.pin(c);
    const vertex = (v) => Array.from(cloth.mesh.vertices.subarray(v * 12, v * 12 + 12));
    const check = () => {
      for (let v = 0; v < shape.particleOf.length; v++) {
        const p = at(cloth.solver, shape.particleOf[v]),
          got = vertex(v);
        assert.deepEqual(got.slice(0, 3), p, `vertex ${v} is where its particle is`);
        assert.ok(Math.abs(Math.hypot(...got.slice(3, 6)) - 1) < 1e-5, 'a unit normal');
        // A skirt's front is outward.
        assert.ok(got[3] * p[0] + got[5] * p[2] > 0, `vertex ${v}: its normal points out`);
        assert.deepEqual(got.slice(6, 9), [1, 1, 1], 'white');
        assert.ok(got[9] >= 0 && got[9] <= 1);
      }
      // The seam's two vertices are one particle: one place, one normal.
      assert.deepEqual(vertex(12).slice(0, 6), vertex(0).slice(0, 6));
    };
    check();
    assert.equal(laya.log.uploads.length, 1, 'written once when made');
    // Driven by a layer of the engine's clock.
    const layers = new ZhudaLayeredClock();
    layers.advance(1 / 60);
    assert.deepEqual(cloth.updateFrom(layers), { steps: 4, dropped: 0 });
    assert.equal(laya.log.uploads.length, 2);
    assert.deepEqual(laya.log.uploads[1], { at: 0, length: 13 * 6 * 12 * 4 });
    check();
    // Paused: zero comes, nothing runs, nothing is uploaded.
    layers.setPaused('world', true);
    layers.advance(1 / 60);
    const before = Float32Array.from(cloth.solver.positions);
    assert.deepEqual(cloth.updateFrom(layers), { steps: 0, dropped: 0 });
    assert.equal(laya.log.uploads.length, 2);
    assert.ok(same(cloth.solver.positions, before));
    // Another layer still runs; at half speed, half the steps.
    layers.setTimeScale('vfx', 0.5);
    layers.advance(1 / 60);
    assert.deepEqual(cloth.updateFrom(layers, 'vfx'), { steps: 2, dropped: 0 });
    assert.throws(() => cloth.updateFrom(layers, 'cloth'), /Unknown time layer: cloth/);
    // A pull stretches the weave, and the vertex's alpha says so.
    layers.setPaused('world', false);
    const hem = 12 * 5 + 3;
    cloth.solver.grab(hem);
    cloth.solver.dragTo(hem, 2, 0.2, 2);
    for (let f = 0; f < 120; f++) {
      layers.advance(1 / 60);
      cloth.updateFrom(layers);
    }
    check();
    const most = cloth.solver.measureStrain();
    assert.ok(most > 0.005, `stretched (${most})`);
    let alpha = 0;
    for (let v = 0; v < shape.particleOf.length; v++) alpha = Math.max(alpha, vertex(v)[9]);
    assert.ok(alpha > 0.02 && alpha <= 1, `written to the colour's alpha (${alpha})`);
    // A pin moved while no step runs: `refresh` writes it.
    cloth.solver.movePin(0, 5, 5, 5);
    cloth.refresh();
    assert.deepEqual(vertex(0).slice(0, 3), [5, 5, 5]);
    cloth.dispose();
    cloth.dispose();
    assert.deepEqual([laya.log.destroyedMeshes, laya.log.destroyedNodes], [1, 1]);
    assert.throws(() => cloth.update(1 / 60), /Disposed cloth/);
    assert.throws(() => cloth.solver.advance(1 / 60), /Disposed cloth/);
    // Without `strain` the mesh carries no colours.
    const bare = new ZhudaCloth(
      createZhudaClothGrid({ columns: 4, rows: 4, width: 1, height: 1 }),
      parent,
    );
    assert.equal(bare.mesh.mesh.declaration, 'POSITION,NORMAL,UV');
    // A flat sheet's front is +z.
    assert.deepEqual(Array.from(bare.mesh.vertices.subarray(3, 6)), [0, 0, 1]);
    bare.dispose();
    assert.throws(() => new ZhudaCloth(shape, parent, { strain: { scale: 0 } }), /Invalid strain/);
    assert.throws(() => new ZhudaCloth(shape, parent, { rounds: 0 }), /Invalid rounds/);
    // Made and destroyed thirty times: as many gone as made.
    const made = { ...laya.log };
    for (let i = 0; i < 30; i++) {
      const again = new ZhudaCloth(shape, parent, { strain: true });
      again.solver.addCollider(vase());
      again.update(1 / 60);
      again.dispose();
    }
    assert.equal(laya.log.meshes - made.meshes, 30);
    assert.equal(laya.log.destroyedMeshes - made.destroyedMeshes, 30);
    assert.equal(laya.log.destroyedNodes - made.destroyedNodes, 30);
  } finally {
    globalThis.Laya = saved;
  }
});
