// Extrusions with holes and a bevel, a tube along a Catmull-Rom curve, the
// torus and the ring. Pure checks; the draw is verify:geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaExtrudeMesh,
  validateZhudaExtrude,
  createZhudaCurveTubeMesh,
  validateZhudaCurveTube,
  validateZhudaCurve,
  sampleZhudaCurve,
  sampleZhudaCurvePath,
  createZhudaTorusMesh,
  validateZhudaTorus,
  createZhudaRingMesh,
  validateZhudaRing,
  createZhudaSweepMesh,
} from '../packages/core/procedural/Geometry.ts';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const at = (array, i, size) => [...array.subarray(i * size, i * size + size)];
const triangles = (mesh) => {
  const list = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const corner = [0, 1, 2].map((k) => mesh.indices[i + k]);
    list.push(corner.map((v) => ({ p: at(mesh.positions, v, 3), n: at(mesh.normals, v, 3) })));
  }
  return list;
};
/** The engine's winding: cross(v1 - v0, v2 - v0) points away from the surface. */
const facing = ([a, b, c]) => cross(sub(b.p, a.p), sub(c.p, a.p)).map((v) => -v);

/**
 * Closed and consistently wound: once vertices at one place are welded (they
 * differ only in normal or UV), every edge is used by exactly two triangles,
 * once each way.
 */
function assertWatertight(mesh, label) {
  const ids = new Map(),
    weld = (p) => {
      const key = p.map((v) => Math.round(v * 1e5)).join(',');
      if (!ids.has(key)) ids.set(key, ids.size);
      return ids.get(key);
    };
  const directed = new Map();
  for (const tri of triangles(mesh)) {
    const w = tri.map((v) => weld(v.p));
    assert.ok(new Set(w).size === 3, `${label}: a triangle collapsed to a line when welded`);
    for (let k = 0; k < 3; k++) {
      const key = w[k] + '>' + w[(k + 1) % 3];
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of directed) {
    assert.equal(count, 1, `${label}: edge ${key} is used twice the same way`);
    const [a, b] = key.split('>');
    assert.equal(directed.get(b + '>' + a), 1, `${label}: edge ${key} is open`);
  }
}
/** Signed volume by the divergence theorem, positive when the triangles face out. */
const volume = (mesh) =>
  triangles(mesh).reduce((sum, [a, b, c]) => sum - dot(a.p, cross(b.p, c.p)) / 6, 0);
/** Each triangle faces where its vertex normals point; none is without area. */
function assertNormalsOut(mesh, label) {
  for (const tri of triangles(mesh)) {
    const face = facing(tri);
    assert.ok(Math.hypot(...face) > 1e-10, `${label}: a triangle without area`);
    for (const v of tri) assert.ok(dot(face, v.n) > 0, `${label}: a normal points inward`);
    for (const v of tri)
      assert.ok(Math.abs(Math.hypot(...v.n) - 1) < 1e-5, `${label}: unit normals`);
  }
}
const area = (tris) =>
  tris.reduce((sum, [a, b, c]) => sum + Math.hypot(...cross(sub(b.p, a.p), sub(c.p, a.p))) / 2, 0);
const polygonArea = (ring) =>
  Math.abs(
    ring.reduce((s, [x0, z0], i) => {
      const [x1, z1] = ring[(i + 1) % ring.length];
      return s + x0 * z1 - x1 * z0;
    }, 0) / 2,
  );
const circle = (cx, cz, r, n, clockwise = false) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((clockwise ? -i : i) / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });
/** Deterministic random numbers for repeatable cases. */
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wall = [
  [0, 0],
  [4, 0],
  [4, 3],
  [0, 3],
];
const window1 = [
  [0.5, 0.5],
  [1.5, 0.5],
  [1.5, 2],
  [0.5, 2],
];
const window2 = circle(3, 1.5, 0.6, 24);

test('an extrusion with holes is closed, faces out and leaves the holes open', () => {
  const shape = createZhudaExtrudeMesh({ outline: wall, holes: [window1, window2], height: 0.3 });
  assertWatertight(shape, 'wall with windows');
  assertNormalsOut(shape, 'wall with windows');
  const solid = 12 - polygonArea(window1) - polygonArea(window2);
  assert.ok(Math.abs(volume(shape) - solid * 0.3) < 1e-4, `volume ${volume(shape)}`);
  // Walls: 4 outside, 4 + 24 inside; each cap n - 2 + 2 per hole triangles.
  const edges = 4 + 4 + 24;
  assert.equal(shape.indices.length / 3, edges * 2 + 2 * (edges - 2 + 2 * 2));
  const top = triangles(shape).filter(([a]) => a.n[1] > 0.5);
  assert.ok(Math.abs(area(top) - solid) < 1e-4, 'the top covers the outline less the holes');
  // Nothing of the top lies over a hole's middle.
  const over = (point) =>
    top.some(([a, b, c]) => {
      const d = (p, q) =>
        (q.p[0] - p.p[0]) * (point[1] - p.p[2]) - (q.p[2] - p.p[2]) * (point[0] - p.p[0]);
      const s = [d(a, b), d(b, c), d(c, a)];
      return s.every((v) => v >= 0) || s.every((v) => v <= 0);
    });
  assert.equal(over([1, 1.25]), false);
  assert.equal(over([3, 1.5]), false);
  assert.equal(over([2.2, 1.5]), true);
  // The inside of a hole faces into the hole.
  for (const [a, b, c] of triangles(shape).filter(([v]) => Math.abs(v.n[1]) < 0.5)) {
    const middle = [(a.p[0] + b.p[0] + c.p[0]) / 3, (a.p[2] + b.p[2] + c.p[2]) / 3];
    if (Math.hypot(middle[0] - 3, middle[1] - 1.5) < 0.61)
      assert.ok(dot(a.n, [3 - middle[0], 0, 1.5 - middle[1]]) > 0, 'round hole faces its middle');
  }
  // Drawn either way round, the holes come out the same.
  const reversed = createZhudaExtrudeMesh({
    outline: [...wall].reverse(),
    holes: [[...window1].reverse(), window2],
    height: 0.3,
  });
  assertWatertight(reversed, 'reversed');
  assert.ok(Math.abs(volume(reversed) - volume(shape)) < 1e-6);
});

test('a concave outline with many holes fills exactly (random cases)', () => {
  const next = random(7);
  for (let round = 0; round < 60; round++) {
    // A star-shaped outline round the origin, and holes on a grid inside it.
    const n = 6 + Math.floor(next() * 40);
    const outline = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2,
        r = 4 + next() * 2;
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    const holes = [];
    for (let gx = -2; gx <= 2; gx++)
      for (let gz = -2; gz <= 2; gz++)
        if (next() < 0.45) {
          const sides = 3 + Math.floor(next() * 8),
            r = 0.15 + next() * 0.3;
          holes.push(
            Array.from({ length: sides }, (_, i) => {
              const a = (i / sides) * Math.PI * 2 + next() * 0.3,
                rr = r * (0.6 + 0.4 * next());
              return [gx * 1.1 + rr * Math.cos(a), gz * 1.1 + rr * Math.sin(a)];
            }),
          );
        }
    assert.deepEqual(validateZhudaExtrude({ outline, holes, height: 1 }), [], `round ${round}`);
    const shape = createZhudaExtrudeMesh({ outline, holes, height: 1 });
    assertWatertight(shape, `round ${round}`);
    const expected = polygonArea(outline) - holes.reduce((s, h) => s + polygonArea(h), 0);
    const top = triangles(shape).filter(([a]) => a.n[1] > 0.5);
    assert.ok(
      Math.abs(area(top) - expected) < 1e-3,
      `round ${round}: top ${area(top)} vs ${expected}`,
    );
    assert.ok(Math.abs(volume(shape) - expected) < 1e-3, `round ${round}: volume`);
    for (const tri of top) assert.ok(facing(tri)[1] > 0, `round ${round}: the top faces up`);
  }
});

test('holes in a row, on one line with corners of the outline, still fill', () => {
  // Square holes whose bottoms lie on one line, and an outline with corners
  // on that line and points in a straight run: the cuts meet edges end on.
  const outline = [
    [0, 0],
    [2, 0],
    [4, 0],
    [10, 0],
    [10, 1],
    [11, 1],
    [11, 3],
    [10, 3],
    [10, 4],
    [0, 4],
    [0, 1],
  ];
  const holes = [1, 3, 5, 7].map((x) => [
    [x, 1],
    [x + 1, 1],
    [x + 1, 2],
    [x, 2],
  ]);
  holes.push([
    [8.5, 1],
    [9.5, 2],
    [8.5, 3],
  ]);
  assert.deepEqual(validateZhudaExtrude({ outline, holes, height: 1 }), []);
  const shape = createZhudaExtrudeMesh({ outline, holes, height: 1 });
  assertWatertight(shape, 'row of holes');
  const expected = polygonArea(outline) - holes.reduce((s, h) => s + polygonArea(h), 0);
  const top = triangles(shape).filter(([a]) => a.n[1] > 0.5);
  assert.ok(Math.abs(area(top) - expected) < 1e-9, `top ${area(top)} vs ${expected}`);
  assert.ok(top.every((t) => facing(t)[1] >= 0));
  // A comb: deep notches, a hole in each tooth.
  const comb = [[0, 0]];
  for (let i = 0; i < 12; i++) comb.push([i * 2 + 1, 6], [i * 2 + 2, 6], [i * 2 + 2, 1]);
  comb.push([25, 1], [25, 0]);
  const teeth = Array.from({ length: 12 }, (_, i) => circle(i * 2 + 1.5, 4, 0.3, 7));
  const combShape = createZhudaExtrudeMesh({ outline: comb, holes: teeth, height: 0.2 });
  assertWatertight(combShape, 'comb');
  const combTop = triangles(combShape).filter(([a]) => a.n[1] > 0.5);
  const combArea = polygonArea(comb) - teeth.reduce((s, h) => s + polygonArea(h), 0);
  assert.ok(Math.abs(area(combTop) - combArea) < 1e-4, `comb top ${area(combTop)} vs ${combArea}`);
});

test('a bevel draws the top in, rounds or cuts the edge and keeps the shape closed', () => {
  const square = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [segments, bevelBottom] of [
    [1, false],
    [4, false],
    [3, true],
  ]) {
    const label = `bevel ${segments}${bevelBottom ? ' both' : ''}`;
    const shape = createZhudaExtrudeMesh({
      outline: square,
      holes: [circle(0, 0, 0.4, 16, true)],
      height: 1,
      bevel: 0.1,
      bevelSegments: segments,
      bevelBottom,
    });
    assertWatertight(shape, label);
    assertNormalsOut(shape, label);
    const v = volume(shape),
      full = (4 - polygonArea(circle(0, 0, 0.4, 16))) * 1;
    assert.ok(v < full && v > full * 0.9, `${label}: a little less than the sharp block (${v})`);
    // The top is the square drawn in by the bevel; the footprint is the square.
    const top = triangles(shape).filter(([a]) => a.n[1] > 0.999);
    const reach = Math.max(...top.flatMap((t) => t.map((x) => Math.abs(x.p[0]))));
    assert.ok(Math.abs(reach - 0.9) < 1e-6, `${label}: the top reaches 0.9 m (${reach})`);
    const low = triangles(shape)
      .flat()
      .filter((x) => x.p[1] < 1e-6);
    const foot = Math.max(...low.map((x) => Math.abs(x.p[0])));
    assert.ok(Math.abs(foot - (bevelBottom ? 0.9 : 1)) < 1e-6, `${label}: footprint ${foot}`);
    // Bevel normals tilt between level and up.
    const tilted = triangles(shape)
      .flat()
      .filter((x) => x.n[1] > 0.05 && x.n[1] < 0.999);
    assert.ok(tilted.length > 0, `${label}: there is a bevel`);
    if (segments === 1)
      assert.ok(
        tilted.every((x) => Math.abs(x.n[1] - Math.SQRT1_2) < 1e-6),
        'a flat cut at 45°',
      );
  }
  // A concave L with a rounded bevel stays closed.
  const ell = createZhudaExtrudeMesh({
    outline: [
      [0, 0],
      [3, 0],
      [3, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ],
    height: 0.5,
    bevel: 0.2,
    bevelSegments: 5,
  });
  assertWatertight(ell, 'L');
  assertNormalsOut(ell, 'L');
});

test('extrusions that cannot be built are refused with the place that is wrong', () => {
  const issues = (options) => validateZhudaExtrude({ outline: wall, height: 1, ...options });
  assert.deepEqual(issues({}), []);
  assert.match(
    issues({
      holes: [
        [
          [5, 1],
          [6, 1],
          [6, 2],
        ],
      ],
    }).join(),
    /holes\[0\]: it must lie inside the outline/,
  );
  assert.match(
    issues({
      holes: [
        [
          [3.5, 1],
          [4.5, 1],
          [4.5, 2],
          [3.5, 2],
        ],
      ],
    }).join(),
    /holes\[0\]: it must lie inside the outline/,
  );
  // A hole touching the outline's edge.
  assert.match(
    issues({
      holes: [
        [
          [1, 0],
          [2, 1],
          [1, 1],
        ],
      ],
    }).join(),
    /holes\[0\]: it must lie inside/,
  );
  assert.match(
    issues({
      holes: [
        window1,
        [
          [1, 1],
          [2, 1],
          [2, 2.5],
          [1, 2.5],
        ],
      ],
    }).join(),
    /holes\[0\]: it overlaps or touches holes\[1\]/,
  );
  // One hole inside another.
  assert.match(
    issues({ holes: [circle(2, 1.5, 1, 12), circle(2, 1.5, 0.3, 8)] }).join(),
    /overlaps or touches/,
  );
  assert.match(issues({ holes: [[[1, 1]]] }).join(), /holes\[0\]: use 3\.\.256 \[x, z\] pairs/);
  assert.match(issues({ holes: 'no' }).join(), /holes: use a list/);
  assert.match(issues({ bevel: -1 }).join(), /bevel: use 0\.\.100 metres/);
  assert.match(issues({ bevel: 1 }).join(), /bevel: it must be less than the height/);
  assert.match(issues({ bevel: 0.6, bevelBottom: true }).join(), /twice the bevel/);
  assert.match(issues({ bevel: 0.1, caps: false }).join(), /a bevel needs caps/);
  assert.match(
    issues({ bevel: 0.1, bevelSegments: 9 }).join(),
    /bevelSegments: use a whole number 1\.\.8/,
  );
  assert.match(issues({ bevelBottom: 'yes' }).join(), /bevelBottom: true or false/);
  // Too wide for a thin part: the top would turn inside out.
  assert.match(
    validateZhudaExtrude({
      outline: [
        [0, 0],
        [4, 0],
        [4, 0.15],
        [0, 0.15],
      ],
      height: 1,
      bevel: 0.1,
    }).join(),
    /bevel: too wide for this outline/,
  );
  // Too wide between a hole and the outline: the widened hole would cross it.
  assert.match(
    issues({
      holes: [
        [
          [0.2, 0.2],
          [1, 0.2],
          [1, 1],
          [0.2, 1],
        ],
      ],
      height: 2,
      bevel: 0.15,
    }).join(),
    /bevel: too wide/,
  );
  assert.throws(
    () =>
      createZhudaExtrudeMesh({
        outline: wall,
        height: 1,
        holes: [
          [
            [9, 9],
            [10, 9],
            [10, 10],
          ],
        ],
      }),
    /Invalid extrusion: holes\[0\]/,
  );
});

test('a Catmull-Rom curve passes through its points, evenly sampled', () => {
  const points = [
    [0, 0, 0],
    [2, 1, 0],
    [4, 0, 1],
    [5, 2, 3],
    [3, 3, 4],
  ];
  for (const kind of ['centripetal', 'chordal', 'uniform']) {
    const samples = sampleZhudaCurve({ points, kind }, 400);
    assert.equal(samples.length, 400);
    assert.deepEqual(
      samples[0].map((v) => +v.toFixed(9)),
      points[0],
    );
    assert.ok(
      Math.hypot(...sub(samples[399], points[4])) < 1e-9,
      `${kind}: ends on the last point`,
    );
    for (const p of points) {
      const nearest = Math.min(...samples.map((q) => Math.hypot(...sub(p, q))));
      assert.ok(nearest < 0.02, `${kind}: passes through ${p} (${nearest})`);
    }
    const gaps = samples.slice(1).map((q, i) => Math.hypot(...sub(q, samples[i])));
    const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    assert.ok(
      gaps.every((g) => Math.abs(g - mean) < mean * 0.02),
      `${kind}: evenly spaced`,
    );
  }
  // Closed: the start is not repeated and the last gap is like the others.
  const loop = sampleZhudaCurve({ points: points.slice(0, 4), closed: true }, 100);
  assert.equal(loop.length, 100);
  const gaps = loop.map((q, i) => Math.hypot(...sub(loop[(i + 1) % 100], q)));
  assert.ok(Math.max(...gaps) / Math.min(...gaps) < 1.05, 'a closed curve runs round evenly');
  // A closed curve feeds a closed sweep: a ring of kerb.
  const kerb = createZhudaSweepMesh({
    profile: [
      [0, 0],
      [0.3, 0],
      [0.3, 0.2],
      [0, 0.2],
    ],
    path: sampleZhudaCurve(
      {
        points: [
          [0, 0, 0],
          [4, 0, 0],
          [4, 0, 4],
          [0, 0, 4],
        ],
        closed: true,
      },
      48,
    ),
    closed: true,
  });
  assertWatertight(kerb, 'kerb ring');
});

test('a LayaAir CurvePath feeds the tube and sweep builders', () => {
  // The LayaAir shape: one shared vector, a share 0..1 along by length.
  const shared = { x: 0, y: 0, z: 0 };
  const path = {
    getPointAt(t) {
      shared.x = Math.cos(t * Math.PI);
      shared.y = 0;
      shared.z = Math.sin(t * Math.PI);
      return shared;
    },
  };
  const points = sampleZhudaCurvePath(path, 33);
  assert.equal(points.length, 33);
  assert.ok(Math.hypot(...sub(points[0], [1, 0, 0])) < 1e-12);
  assert.ok(Math.hypot(...sub(points[32], [-1, 0, 0])) < 1e-9, 'copied, not the shared vector');
  const loop = sampleZhudaCurvePath(
    { getPointAt: (t) => ({ x: Math.cos(t * 2 * Math.PI), y: 0, z: Math.sin(t * 2 * Math.PI) }) },
    24,
    { closed: true },
  );
  assert.equal(loop.length, 24);
  assertWatertight(
    createZhudaSweepMesh({
      profile: [
        [0, 0],
        [0.1, 0],
        [0.1, 0.1],
      ],
      path: loop,
      closed: true,
    }),
    'swept along a CurvePath',
  );
  assert.throws(() => sampleZhudaCurvePath({}, 10), /getPointAt/);
  assert.throws(() => sampleZhudaCurvePath(path, 1), /count must be/);
  assert.throws(
    () => sampleZhudaCurvePath({ getPointAt: () => ({ x: NaN, y: 0, z: 0 }) }, 4),
    /not finite/,
  );
  assert.throws(
    () => sampleZhudaCurvePath({ getPointAt: () => ({ x: 1, y: 0, z: 0 }) }, 4),
    /no length/,
  );
});

test('a tube along a curve is closed, faces out and holds its radius', () => {
  const points = [
    [0, 0, 0],
    [2, 1, 0],
    [3, 3, 1],
    [1, 4, 2],
  ];
  const open = createZhudaCurveTubeMesh({
    points,
    radius: 0.2,
    tubularSegments: 80,
    radialSegments: 10,
  });
  assert.equal(open.positions.length / 3, 81 * 11 + 2 * 12);
  assert.equal(open.indices.length / 3, 80 * 10 * 2 + 2 * 10);
  assertWatertight(open, 'open tube');
  assertNormalsOut(open, 'open tube');
  const length = (() => {
    const s = sampleZhudaCurve({ points }, 2000);
    return s.slice(1).reduce((sum, q, i) => sum + Math.hypot(...sub(q, s[i])), 0);
  })();
  // A ten-sided section holds 10/(2π)·sin(2π/10) of a circle's area.
  const section = 0.5 * 10 * 0.2 * 0.2 * Math.sin((2 * Math.PI) / 10);
  assert.ok(Math.abs(volume(open) / (section * length) - 1) < 0.02, `volume ${volume(open)}`);
  // Every wall vertex sits one radius from the curve.
  const centre = sampleZhudaCurve({ points }, 4000);
  for (let i = 0; i < 81 * 11; i += 37) {
    const p = at(open.positions, i, 3);
    const d = Math.min(...centre.map((q) => Math.hypot(...sub(p, q))));
    assert.ok(Math.abs(d - 0.2) < 0.005, `radius held (${d})`);
  }
  // A closed loop: no caps, the seam meets itself without a twist.
  const loop = createZhudaCurveTubeMesh({
    points: [
      [0, 0, 0],
      [3, 1, 0],
      [3, 2, 3],
      [0, 0.5, 3],
      [-1, 2, 1],
    ],
    closed: true,
    radius: 0.15,
    tubularSegments: 120,
    radialSegments: 8,
  });
  assert.equal(loop.indices.length / 3, 120 * 8 * 2);
  assertWatertight(loop, 'closed tube');
  assertNormalsOut(loop, 'closed tube');
  assert.ok(volume(loop) > 0);
  // Straight up: the first frame does not fall over.
  assertWatertight(
    createZhudaCurveTubeMesh({
      points: [
        [0, 0, 0],
        [0, 3, 0],
      ],
      radius: 0.1,
    }),
    'vertical tube',
  );
});

test('curves and tubes that cannot be built are refused', () => {
  assert.match(validateZhudaCurve({ points: [[0, 0, 0]] }).join(), /points: use 2\.\.256/);
  assert.match(
    validateZhudaCurve({
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      closed: true,
    }).join(),
    /points: use 3\.\.256/,
  );
  assert.match(
    validateZhudaCurve({
      points: [
        [0, 0, 0],
        [0, 0, 0],
        [1, 0, 0],
      ],
    }).join(),
    /points\[1\]: the same point/,
  );
  assert.match(
    validateZhudaCurve({
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 0, 0],
      ],
      closed: true,
    }).join(),
    /does not repeat its first point/,
  );
  assert.match(
    validateZhudaCurve({
      points: [
        [0, 0, 0],
        [1, NaN, 0],
      ],
    }).join(),
    /points\[1\]/,
  );
  assert.match(
    validateZhudaCurve({
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      kind: 'bezier',
    }).join(),
    /kind/,
  );
  const tube = (more) =>
    validateZhudaCurveTube({
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      radius: 0.1,
      ...more,
    });
  assert.deepEqual(tube({}), []);
  assert.match(tube({ radius: 0 }).join(), /radius/);
  assert.match(tube({ tubularSegments: 1 }).join(), /tubularSegments/);
  assert.match(tube({ radialSegments: 65 }).join(), /radialSegments/);
  assert.match(
    tube({ tubularSegments: 2048, radialSegments: 64 }).join(),
    /more than one mesh holds/,
  );
  assert.throws(
    () => createZhudaCurveTubeMesh({ points: [[0, 0, 0]], radius: 1 }),
    /Invalid curve tube/,
  );
  assert.throws(
    () =>
      sampleZhudaCurve(
        {
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        },
        1,
      ),
    /count/,
  );
});

test('a torus is closed, faces out and has the volume of a ring of tube', () => {
  const torus = createZhudaTorusMesh({
    radius: 1,
    tube: 0.25,
    radialSegments: 32,
    tubularSegments: 96,
  });
  assert.equal(torus.positions.length / 3, 97 * 33);
  assert.equal(torus.indices.length / 3, 96 * 32 * 2);
  assertWatertight(torus, 'torus');
  assertNormalsOut(torus, 'torus');
  const exact = 2 * Math.PI * Math.PI * 1 * 0.25 * 0.25;
  assert.ok(Math.abs(volume(torus) / exact - 1) < 0.01, `volume ${volume(torus)} vs ${exact}`);
  // Lying flat about +Y.
  const ys = [];
  for (let i = 1; i < torus.positions.length; i += 3) ys.push(torus.positions[i]);
  assert.ok(Math.abs(Math.max(...ys) - 0.25) < 1e-6 && Math.abs(Math.min(...ys) + 0.25) < 1e-6);
  // Each normal points from the middle of the tube.
  for (let i = 0; i < torus.positions.length / 3; i += 13) {
    const p = at(torus.positions, i, 3),
      n = at(torus.normals, i, 3),
      r = Math.hypot(p[0], p[2]),
      c = [p[0] / r, 0, p[2] / r];
    assert.ok(Math.abs(dot(n, sub(p, c)) / 0.25 - 1) < 1e-5);
  }
  assert.match(
    validateZhudaTorus({ radius: 1, tube: 1 }).join(),
    /tube: it must be less than radius/,
  );
  assert.match(validateZhudaTorus({ radius: 0, tube: 0.1 }).join(), /radius/);
  assert.match(
    validateZhudaTorus({ radius: 1, tube: 0.2, radialSegments: 2 }).join(),
    /radialSegments/,
  );
  assert.match(
    validateZhudaTorus({ radius: 1, tube: 0.2, tubularSegments: 257 }).join(),
    /tubularSegments/,
  );
  assert.throws(() => createZhudaTorusMesh({ radius: 1, tube: 2 }), /Invalid torus/);
});

test('a ring is flat and faces up; with a thickness it is a closed washer or coin', () => {
  const flat = createZhudaRingMesh({ outerRadius: 1, innerRadius: 0.6, segments: 32 });
  assert.equal(flat.positions.length / 3, 33 * 2);
  assert.equal(flat.indices.length / 3, 64);
  assertNormalsOut(flat, 'flat ring');
  const tris = triangles(flat);
  assert.ok(
    tris.every((t) => facing(t)[1] > 0),
    'every triangle faces up',
  );
  const annulus = 0.5 * 32 * Math.sin((2 * Math.PI) / 32) * (1 - 0.36);
  assert.ok(Math.abs(area(tris) - annulus) < 1e-6);
  const disc = createZhudaRingMesh({ outerRadius: 0.5, segments: 12 });
  assert.equal(disc.indices.length / 3, 12);
  const washer = createZhudaRingMesh({
    outerRadius: 1,
    innerRadius: 0.5,
    segments: 40,
    thickness: 0.1,
  });
  assertWatertight(washer, 'washer');
  assertNormalsOut(washer, 'washer');
  const polygon = (r) => 0.5 * 40 * r * r * Math.sin((2 * Math.PI) / 40);
  assert.ok(Math.abs(volume(washer) - (polygon(1) - polygon(0.5)) * 0.1) < 1e-6);
  const coin = createZhudaRingMesh({ outerRadius: 0.3, segments: 24, thickness: 0.05 });
  assertWatertight(coin, 'coin');
  assertNormalsOut(coin, 'coin');
  assert.match(
    validateZhudaRing({ outerRadius: 1, innerRadius: 1 }).join(),
    /innerRadius: it must be less/,
  );
  assert.match(validateZhudaRing({ outerRadius: -1 }).join(), /outerRadius/);
  assert.match(validateZhudaRing({ outerRadius: 1, segments: 2 }).join(), /segments/);
  assert.match(validateZhudaRing({ outerRadius: 1, thickness: 0 }).join(), /thickness/);
  assert.throws(() => createZhudaRingMesh({ outerRadius: 1, innerRadius: 2 }), /Invalid ring/);
});
