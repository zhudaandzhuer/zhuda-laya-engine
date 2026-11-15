// Signed distance shapes and the surface-nets mesher. Pure checks; the draw is verify:hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaSdfField,
  validateZhudaSdfShapes,
  createZhudaIsosurfaceMesh,
  validateZhudaIsosurface,
  joinZhudaSdfFields,
  splitZhudaMesh,
  zhudaSmoothMin,
  zhudaSdfDepthAlong,
  createZhudaSdfUnion,
} from '../packages/core/procedural/Isosurface.ts';

const at = (array, i, size) => [...array.subarray(i * size, i * size + size)];
/** Every edge used by exactly two triangles, once each way: closed and wound one way. */
function closedAndWound(mesh) {
  const directed = new Set();
  const undirected = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = mesh.indices[i + k],
        b = mesh.indices[i + ((k + 1) % 3)];
      const key = `${a}>${b}`;
      if (directed.has(key)) return false;
      directed.add(key);
      const u = a < b ? `${a},${b}` : `${b},${a}`;
      undirected.set(u, (undirected.get(u) ?? 0) + 1);
    }
  return [...undirected.values()].every((n) => n === 2);
}

test('a ball: vertices on the surface, normals outward, closed, winding into the body', () => {
  const r = 0.1;
  const field = createZhudaSdfField([{ kind: 'ellipsoid', center: [0, 0, 0], radii: [r, r, r] }]);
  const mesh = createZhudaIsosurfaceMesh({
    distance: field.distance,
    ...field.bounds,
    cellSize: 0.005,
  });
  const n = mesh.positions.length / 3;
  assert.ok(n > 1000);
  let worstRadius = 0,
    worstNormal = 1;
  for (let i = 0; i < n; i++) {
    const p = at(mesh.positions, i, 3),
      m = at(mesh.normals, i, 3);
    const l = Math.hypot(...p);
    worstRadius = Math.max(worstRadius, Math.abs(l - r));
    worstNormal = Math.min(worstNormal, (p[0] * m[0] + p[1] * m[1] + p[2] * m[2]) / l);
  }
  assert.ok(worstRadius < 1e-5, `every vertex within 0.01 mm of the sphere (${worstRadius})`);
  assert.ok(worstNormal > 0.999, `normals point out (${worstNormal})`);
  assert.ok(closedAndWound(mesh), 'closed and wound one way');
  // The engine's winding: cross(v1 - v0, v2 - v0) points into the body.
  let inward = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => at(mesh.positions, mesh.indices[i + k], 3));
    const u = b.map((v, k) => v - a[k]),
      v = c.map((x, k) => x - a[k]);
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cr[0] * a[0] + cr[1] * a[1] + cr[2] * a[2] < 0) inward++;
  }
  assert.ok(inward / (mesh.indices.length / 3) > 0.99);
  assert.ok(mesh.indices instanceof Uint16Array);
});

test('the same shapes give the same mesh', () => {
  const shapes = [
    { kind: 'roundCone', a: [0, 0, 0], b: [0, 0.1, 0], ra: 0.03, rb: 0.015 },
    {
      kind: 'ellipsoid',
      center: [0.02, 0.05, 0],
      radii: [0.02, 0.03, 0.01],
      blend: 0.01,
      flatten: { axis: [0, 0, 1], factor: 0.7 },
    },
  ];
  const make = () => {
    const f = createZhudaSdfField(shapes);
    return createZhudaIsosurfaceMesh({ distance: f.distance, ...f.bounds, cellSize: 0.003 });
  };
  const a = make(),
    b = make();
  assert.deepEqual(a.positions, b.positions);
  assert.deepEqual(a.indices, b.indices);
  assert.ok(closedAndWound(a));
});

test('a round cone and a smooth union are distances, a fillet fills the corner', () => {
  const cone = createZhudaSdfField([
    { kind: 'roundCone', a: [0, 0, 0], b: [0, 1, 0], ra: 0.2, rb: 0.1 },
  ]);
  assert.ok(Math.abs(cone.distance(0, -0.2, 0)) < 1e-9);
  assert.ok(Math.abs(cone.distance(0, 1.1, 0)) < 1e-9);
  assert.ok(Math.abs(cone.distance(0.3, 0, 0) - 0.1) < 1e-9);
  assert.equal(zhudaSmoothMin(1, 2, 0), 1);
  assert.ok(zhudaSmoothMin(1, 1, 0.4) < 1);
  // Two balls side by side: the fillet joins them where a hard union leaves a notch.
  const balls = (blend) =>
    createZhudaSdfField([
      { kind: 'ellipsoid', center: [-0.1, 0, 0], radii: [0.11, 0.11, 0.11] },
      { kind: 'ellipsoid', center: [0.1, 0, 0], radii: [0.11, 0.11, 0.11], blend },
    ]);
  assert.ok(balls(0.06).distance(0, 0.06, 0) < balls(0).distance(0, 0.06, 0) - 0.005);
  // A cut takes the inside away.
  const cut = createZhudaSdfField([
    { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.1, 0.1, 0.1] },
    { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.05, 0.05, 0.05], subtract: true },
  ]);
  assert.ok(cut.distance(0, 0, 0) > 0);
});

test('the broad phase changes nothing it skips', () => {
  const shapes = [];
  for (let i = 0; i < 12; i++)
    shapes.push({
      kind: 'roundCone',
      a: [i * 0.03, 0, 0],
      b: [i * 0.03, 0.1, 0.01 * (i % 3)],
      ra: 0.01,
      rb: 0.008,
      blend: 0.006,
    });
  const field = createZhudaSdfField(shapes);
  // The same sum without skipping anything.
  const plain = (x, y, z) => {
    let d = Infinity;
    for (const s of shapes) {
      const e = createZhudaSdfField([s]).distance(x, y, z);
      d = d === Infinity ? e : zhudaSmoothMin(d, e, s.blend);
    }
    return d;
  };
  for (let k = 0; k < 200; k++) {
    const p = [
      ((k * 37) % 100) / 250 - 0.05,
      ((k * 53) % 100) / 700,
      ((k * 71) % 100) / 2000 - 0.02,
    ];
    assert.ok(Math.abs(field.distance(...p) - plain(...p)) < 1e-12);
  }
});

test('limbs join their trunk with a fillet and each other with none', () => {
  const trunk = createZhudaSdfField([
    { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.1, 0.03, 0.03] },
  ]);
  const limb = (x) =>
    createZhudaSdfField([{ kind: 'roundCone', a: [x, 0, 0], b: [x, 0.1, 0], ra: 0.011, rb: 0.01 }]);
  const body = joinZhudaSdfFields(trunk, [
    { field: limb(-0.011), blend: 0.01 },
    { field: limb(0.011), blend: 0.01 },
  ]);
  // Between the two limbs, high up, the distance is the plain least: no web between fingers.
  assert.ok(
    Math.abs(
      body.distance(0, 0.08, 0) -
        Math.min(limb(-0.011).distance(0, 0.08, 0), limb(0.011).distance(0, 0.08, 0)),
    ) < 1e-12,
  );
  // Where a limb meets the trunk, the fillet fills the corner.
  assert.ok(
    body.distance(0.024, 0.032, 0) <
      Math.min(trunk.distance(0.024, 0.032, 0), limb(0.011).distance(0.024, 0.032, 0)),
  );
  assert.equal(body.nearest(0.011, 0.09, 0), 1);
  assert.equal(body.nearest(0.09, 0, 0), -1);
  assert.throws(() => joinZhudaSdfFields(trunk, [{ field: null, blend: 0 }]), /limbs\[0\]\.field/);
});

test('depth along a line through a ball', () => {
  const ball = createZhudaSdfField([
    { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.1, 0.1, 0.1] },
  ]);
  const depth = zhudaSdfDepthAlong(ball.distance, [0, 0, 0.0999], [0, 0, -1], 1);
  assert.ok(Math.abs(depth - 0.1999) < 0.003, String(depth));
});

test('a large mesh is cut into chunks of 16-bit indices with nothing lost', () => {
  const field = createZhudaSdfField([
    { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.1, 0.1, 0.1] },
  ]);
  const mesh = createZhudaIsosurfaceMesh({
    distance: field.distance,
    ...field.bounds,
    cellSize: 0.0012,
  });
  const n = mesh.positions.length / 3;
  assert.ok(n > 65535 && mesh.indices instanceof Uint32Array);
  const chunks = splitZhudaMesh(mesh);
  assert.ok(chunks.length >= 2);
  let triangles = 0;
  for (const c of chunks) {
    assert.ok(c.positions.length / 3 <= 65535 && c.indices instanceof Uint16Array);
    assert.equal(c.normals.length, c.positions.length);
    triangles += c.indices.length / 3;
  }
  assert.equal(triangles, mesh.indices.length / 3);
  // The first triangle of the second chunk is the same triangle of the whole.
  const first = chunks[0].indices.length / 3;
  const whole = at(mesh.positions, mesh.indices[first * 3], 3);
  const part = at(chunks[1].positions, chunks[1].indices[0], 3);
  assert.deepEqual(part, whole);
  assert.throws(() => splitZhudaMesh(mesh, 70000), /maxVertices/);
});

test('refusals name what is wrong', () => {
  assert.deepEqual(validateZhudaSdfShapes([]), ['shapes must be a list of at least one shape']);
  const errors = validateZhudaSdfShapes([
    { kind: 'roundCone', a: [0, 0], b: [0, 1, 0], ra: -1, rb: 1, subtract: true },
    {
      kind: 'ellipsoid',
      center: [0, 0, 0],
      radii: [1, 0, 1],
      flatten: { axis: [0, 0, 0], factor: 2 },
    },
    { kind: 'box' },
  ]);
  for (const part of [
    '.a and .b',
    '.ra and .rb',
    'subtract cannot cut the first',
    '.radii',
    'flatten.axis',
    'flatten.factor',
    'kind must be',
  ])
    assert.ok(
      errors.some((e) => e.includes(part)),
      part,
    );
  assert.ok(
    validateZhudaSdfShapes([
      {
        kind: 'ellipsoid',
        center: [0, 0, 0],
        radii: [1, 1, 1],
        axes: [
          [1, 0, 0],
          [1, 0, 0],
          [0, 0, 1],
        ],
      },
    ]).some((e) => e.includes('square')),
  );
  assert.throws(() => createZhudaSdfField([{ kind: 'box' }]), /Invalid signed distance shapes/);
  const iso = validateZhudaIsosurface({
    distance: 1,
    min: [0, 0, 0],
    max: [0, 1, 1],
    cellSize: 0,
    project: 9,
  });
  for (const part of ['distance must', 'min must be below', 'cellSize', 'project'])
    assert.ok(
      iso.some((e) => e.includes(part)),
      part,
    );
  assert.ok(
    validateZhudaIsosurface({
      distance: () => 1,
      min: [0, 0, 0],
      max: [1, 1, 1],
      cellSize: 0.0001,
    }).some((e) => e.includes('64 million')),
  );
  // A surface that reaches the box's side is refused rather than left open.
  const big = createZhudaSdfField([{ kind: 'ellipsoid', center: [0, 0, 0], radii: [1, 1, 1] }]);
  assert.throws(
    () =>
      createZhudaIsosurfaceMesh({
        distance: big.distance,
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
        cellSize: 0.05,
      }),
    /side of the box/,
  );
  assert.throws(
    () =>
      createZhudaIsosurfaceMesh({
        distance: (x) => 1 + x * 0,
        min: [0, 0, 0],
        max: [1, 1, 1],
        cellSize: 0.1,
      }),
    /no surface/,
  );
  assert.throws(
    () =>
      createZhudaIsosurfaceMesh({
        distance: big.distance,
        ...big.bounds,
        cellSize: 0.05,
        maxVertices: 100,
      }),
    /more than 100 vertices/,
  );
});

test('a union of many small shapes through a grid: exact near them, never over the truth far away', () => {
  const shapes = [];
  for (let i = 0; i < 300; i++)
    shapes.push({
      kind: 'roundCone',
      a: [(i % 20) * 0.01, Math.floor(i / 20) * 0.01, 0],
      b: [(i % 20) * 0.01 + 0.006, Math.floor(i / 20) * 0.01, 0.002],
      ra: 0.001,
      rb: 0.0008,
    });
  const union = createZhudaSdfUnion(shapes, { reach: 0.004, cell: 0.008 });
  const plain = createZhudaSdfField(shapes);
  for (let k = 0; k < 400; k++) {
    const p = [
      ((k * 37) % 211) / 1000 - 0.005,
      ((k * 53) % 157) / 1000 - 0.005,
      ((k * 71) % 23) / 1000 - 0.011,
    ];
    const truth = plain.distance(...p),
      fast = union.distance(...p);
    if (truth < 0.004) assert.ok(Math.abs(fast - truth) < 1e-12, `exact near (${truth}, ${fast})`);
    else assert.ok(fast <= truth + 1e-12 && fast >= 0.004 - 1e-12, 'never over the truth');
  }
  assert.equal(union.nearest(0.003, 0, 0), 0);
  assert.throws(
    () => createZhudaSdfUnion([{ ...shapes[0], blend: 0.01 }]),
    /no blend and no subtract/,
  );
});

test('a shape is never nearer than its box: skipping by the box leaves no step in the surface', () => {
  // A long flat ellipsoid: far off its ends its estimated distance falls below the distance
  // to its box. The field holds it at the box's, so a broad phase that skips by the box gives
  // the same number as one that asks.
  const shape = { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.04, 0.005, 0.02] };
  const field = createZhudaSdfField([shape]);
  const box = (x, y, z) =>
    Math.hypot(
      Math.max(Math.abs(x) - 0.04, 0),
      Math.max(Math.abs(y) - 0.005, 0),
      Math.max(Math.abs(z) - 0.02, 0),
    );
  for (let k = 0; k < 500; k++) {
    const p = [
      ((k * 37) % 300) / 1000 - 0.15,
      ((k * 53) % 300) / 1000 - 0.15,
      ((k * 71) % 300) / 1000 - 0.15,
    ];
    const d = field.distance(...p);
    if (d > 0) assert.ok(d >= box(...p) - 1e-12);
  }
  // Joined to a second shape, the field is the same with and without the skip.
  const shapes = [
    shape,
    {
      kind: 'roundCone',
      a: [0.03, 0.004, 0],
      b: [0.03, 0.05, 0],
      ra: 0.006,
      rb: 0.004,
      blend: 0.012,
    },
  ];
  const both = createZhudaSdfField(shapes);
  const each = shapes.map((s) => createZhudaSdfField([s]));
  for (let k = 0; k < 500; k++) {
    const p = [
      ((k * 37) % 120) / 1000 - 0.06,
      ((k * 53) % 90) / 1000 - 0.02,
      ((k * 71) % 60) / 1000 - 0.03,
    ];
    const asked = zhudaSmoothMin(each[0].distance(...p), each[1].distance(...p), 0.012);
    assert.ok(Math.abs(both.distance(...p) - asked) < 1e-12);
  }
});

test('two round cones in a line, joined without a fillet, leave no bulge where they meet', () => {
  const a = [0, 0, 0],
    m = [0, 0.02, 0],
    b = [0, 0.04, 0];
  const width = (blend) => {
    const f = createZhudaSdfField([
      { kind: 'roundCone', a, b: m, ra: 0.01, rb: 0.009 },
      { kind: 'roundCone', a: m, b, ra: 0.009, rb: 0.008, blend },
    ]);
    let lo = 0,
      hi = 0.03;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (f.distance(mid, 0.02, 0) < 0) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // A round cone meets its end balls on a tangent, so it is a hair wider than the ball there.
  assert.ok(Math.abs(width(0) - 0.009) < 5e-5, String(width(0)));
  // A fillet of 4 mm there makes the body wider by most of a millimetre: why a hand's fingers join their pieces with none.
  assert.ok(width(0.004) > 0.0095, String(width(0.004)));
});

test('a shape that overlaps the body is never skipped, inside it or on its surface', () => {
  // Two cones in a line, no fillet, the second deeper where they overlap: inside both, the
  // field is the least of the two. (The broad phase once skipped the second there, since its
  // box distance, 0, was above the negative distance already found, and left a pit in a finger.)
  const shapes = [
    {
      kind: 'roundCone',
      a: [0, 0, 0],
      b: [0, 0.02, 0],
      ra: 0.01,
      rb: 0.009,
      blend: 0.001,
      flatten: { axis: [0, 0, 1], factor: 0.85 },
    },
    {
      kind: 'roundCone',
      a: [0, 0.02, 0],
      b: [0, 0.04, 0],
      ra: 0.009,
      rb: 0.008,
      flatten: { axis: [0, 0, 1], factor: 0.85 },
    },
  ];
  const both = createZhudaSdfField(shapes);
  const each = shapes.map((s) => createZhudaSdfField([s]));
  for (let k = 0; k < 400; k++) {
    const p = [
      ((k * 37) % 40) / 2000 - 0.01,
      ((k * 53) % 90) / 2000,
      ((k * 71) % 30) / 2000 - 0.0075,
    ];
    const asked = Math.min(
      zhudaSmoothMin(each[0].distance(...p), Infinity, 0),
      each[1].distance(...p),
    );
    assert.ok(Math.abs(both.distance(...p) - asked) < 1e-12, `at ${p}`);
  }
  // Squeezed about each cone's own axis: the two meet without a step.
  let last = null;
  for (let y = 0.015; y <= 0.025; y += 0.0005) {
    let lo = 0,
      hi = 0.02;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (both.distance(0, y, mid) < 0) lo = mid;
      else hi = mid;
    }
    if (last !== null) assert.ok(Math.abs(lo - last) < 0.0001, `no step at ${y}`);
    last = lo;
  }
});

test('a shape kept on one side of a plane is cut there and unchanged on its side', () => {
  const whole = createZhudaSdfField([
    { kind: 'ellipsoid', center: [0, 0, 0], radii: [0.03, 0.03, 0.03] },
  ]);
  const half = createZhudaSdfField([
    {
      kind: 'ellipsoid',
      center: [0, 0, 0],
      radii: [0.03, 0.03, 0.03],
      keep: { normal: [0, 0, 1], offset: 0.01 },
    },
  ]);
  // Below the plane it is the whole ball; above it, nothing is left.
  assert.ok(Math.abs(half.distance(0, 0, -0.03) - whole.distance(0, 0, -0.03)) < 1e-12);
  assert.ok(half.distance(0, 0, 0.02) > 0);
  assert.ok(Math.abs(half.distance(0, 0, 0.01)) < 1e-12);
  assert.ok(
    validateZhudaSdfShapes([
      {
        kind: 'ellipsoid',
        center: [0, 0, 0],
        radii: [1, 1, 1],
        keep: { normal: [0, 0, 0], offset: 'x' },
      },
    ]).some((e) => e.includes('keep.normal')),
  );
});
