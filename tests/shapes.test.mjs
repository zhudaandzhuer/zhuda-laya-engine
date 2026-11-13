// Lathe and extrude: the two builders and the film nodes that use them.
// Pure checks; the draw is verify:film-shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaExtrudeMesh,
  createZhudaLatheMesh,
  validateZhudaExtrude,
  validateZhudaLathe,
} from '../packages/core/procedural/Geometry.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

const vertex = (mesh, i) => ({
  p: [...mesh.positions.subarray(i * 3, i * 3 + 3)],
  n: [...mesh.normals.subarray(i * 3, i * 3 + 3)],
  uv: [...mesh.uvs.subarray(i * 2, i * 2 + 2)],
});
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const triangles = (mesh) => {
  const list = [];
  for (let i = 0; i < mesh.indices.length; i += 3)
    list.push([0, 1, 2].map((k) => vertex(mesh, mesh.indices[i + k])));
  return list;
};
/** The engine's winding: cross(v1 - v0, v2 - v0) points away from the surface normal. */
const assertWinding = (mesh) => {
  for (const [a, b, c] of triangles(mesh)) {
    const face = cross(sub(b.p, a.p), sub(c.p, a.p));
    const normal = a.n.map((v, i) => v + b.n[i] + c.n[i]);
    assert.ok(Math.hypot(...face) > 1e-9, 'no triangle without area');
    assert.ok(dot(face, normal) < 0, 'every triangle faces the way its normals point');
  }
};
const bounds = (mesh) => {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], mesh.positions[i + k]);
      max[k] = Math.max(max[k], mesh.positions[i + k]);
    }
  return { min: min.map((v) => +v.toFixed(4)), max: max.map((v) => +v.toFixed(4)) };
};
const vertices = (mesh) =>
  Array.from({ length: mesh.positions.length / 3 }, (_, i) => vertex(mesh, i));

test('a lathe turns an outline about the vertical axis with outward, smooth normals', () => {
  const cylinder = createZhudaLatheMesh({
    profile: [
      [0.5, 0],
      [0.5, 2],
    ],
    segments: 16,
  });
  // 16 quads around, and a disc of 16 triangles at each end.
  assert.equal(cylinder.indices.length / 3, 16 * 2 + 16 * 2);
  assert.deepEqual(bounds(cylinder), { min: [-0.5, 0, -0.5], max: [0.5, 2, 0.5] });
  assertWinding(cylinder);
  for (const { p, n, uv } of vertices(cylinder).filter((v) => Math.abs(v.n[1]) < 0.5)) {
    assert.ok(Math.abs(dot(n, [p[0] / 0.5, 0, p[2] / 0.5]) - 1) < 1e-5, 'the wall faces outward');
    // UVs are metres: around the wall and up it.
    assert.ok(uv[0] >= 0 && uv[0] <= Math.PI + 1e-5 && (uv[1] === 0 || uv[1] === 2));
  }
  assert.equal(
    createZhudaLatheMesh({
      profile: cylinder
        ? [
            [0.5, 0],
            [0.5, 2],
          ]
        : [],
      caps: false,
    }).indices.length / 3,
    24 * 2,
  );

  // A cone: the ring on the axis is one point, so each side is one triangle.
  const cone = createZhudaLatheMesh({
    profile: [
      [1, 0],
      [0, 2],
    ],
    segments: 12,
  });
  assert.equal(cone.indices.length / 3, 12 + 12);
  assertWinding(cone);
  assert.ok(
    vertices(cone)
      .filter((v) => v.n[1] > -0.5)
      .every((v) => v.n[1] > 0.4),
  );
});

test('sharp corners of the outline stay edges; a hollow form faces inward on the inside', () => {
  const stepped = [
    [0.5, 0],
    [0.5, 1],
    [0.2, 1],
  ];
  const rim = (mesh) =>
    vertices(mesh)
      .filter(
        (v) => Math.abs(v.p[1] - 1) < 1e-6 && Math.abs(Math.hypot(v.p[0], v.p[2]) - 0.5) < 1e-6,
      )
      .map((v) => +v.n[1].toFixed(3));
  // The wall (normal level) and the top (normal straight up) meet at a hard edge.
  assert.deepEqual(
    [...new Set(rim(createZhudaLatheMesh({ profile: stepped, caps: false })))],
    [0, 1],
  );
  // Asked to smooth every corner, the two share one normal halfway.
  assert.deepEqual(
    [...new Set(rim(createZhudaLatheMesh({ profile: stepped, caps: false, creaseDeg: 180 })))],
    [0.707],
  );
  const bowl = createZhudaLatheMesh({
    profile: [
      [0.4, 0],
      [0.5, 0.3],
      [0.45, 0.3],
      [0.36, 0.05],
      [0, 0.05],
    ],
  });
  assertWinding(bowl);
  const inner = vertices(bowl).filter((v) => Math.abs(Math.hypot(v.p[0], v.p[2]) - 0.36) < 1e-6);
  assert.ok(inner.length > 0);
  assert.ok(
    inner.some((v) => dot(v.n, [v.p[0], 0, v.p[2]]) < 0),
    'the inside wall faces the axis',
  );
});

test('an extrusion raises an outline, concave or not, drawn either way round', () => {
  const outline = [
    [0, 0],
    [2, 0],
    [2, 1],
    [1, 1],
    [1, 2],
    [0, 2],
  ];
  const shape = createZhudaExtrudeMesh({ outline, height: 1.5 });
  // Six walls of two triangles, and four triangles on the top and on the underside.
  assert.equal(shape.indices.length / 3, 6 * 2 + 4 * 2);
  assert.deepEqual(bounds(shape), { min: [0, 0, 0], max: [2, 1.5, 2] });
  assertWinding(shape);
  const top = triangles(shape).filter(([a]) => a.n[1] > 0.5);
  const area = top.reduce(
    (sum, [a, b, c]) => sum + Math.hypot(...cross(sub(b.p, a.p), sub(c.p, a.p))) / 2,
    0,
  );
  assert.ok(Math.abs(area - 3) < 1e-6, 'the top covers the outline exactly');
  const reversed = createZhudaExtrudeMesh({ outline: [...outline].reverse(), height: 1.5 });
  assertWinding(reversed);
  assert.deepEqual(bounds(reversed), bounds(shape));
  // Walls of a square face away from its middle.
  const square = createZhudaExtrudeMesh({
    outline: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    height: 1,
  });
  for (const { p, n } of vertices(square).filter((v) => Math.abs(v.n[1]) < 0.5))
    assert.ok(dot(n, [p[0], 0, p[2]]) > 0);
  assert.equal(createZhudaExtrudeMesh({ outline, height: 1, caps: false }).indices.length / 3, 12);
});

test('bad shapes are refused with the place that is wrong', () => {
  assert.deepEqual(
    validateZhudaLathe({
      profile: [
        [0.5, 0],
        [-0.1, 1],
        [-0.1, 1],
      ],
      segments: 2,
    }),
    [
      'profile[1]: the radius cannot be negative',
      'profile[2]: the radius cannot be negative',
      'segments: use a whole number 3..96',
    ],
  );
  assert.deepEqual(validateZhudaLathe({ profile: [[0.5, 0]] }), [
    'profile: use 2..256 [radius, height] pairs',
  ]);
  assert.deepEqual(
    validateZhudaLathe({
      profile: [
        [0.5, 0],
        [0.5, 0],
      ],
    }),
    ['profile[1]: the same point as the one before it'],
  );
  assert.throws(() => createZhudaLatheMesh({ profile: 'round' }), /Invalid lathe/);
  // A bow-tie crosses itself.
  assert.deepEqual(
    validateZhudaExtrude({
      outline: [
        [0, 0],
        [1, 1],
        [1, 0],
        [0, 1],
      ],
      height: 1,
    }),
    ['outline: edge 0 crosses edge 2'],
  );
  assert.deepEqual(
    validateZhudaExtrude({
      outline: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      height: 0,
    }),
    ['outline: it encloses no area', 'height: use a positive number of metres'],
  );
  assert.throws(
    () =>
      createZhudaExtrudeMesh({
        outline: [
          [0, 0],
          [1, 0],
        ],
        height: 1,
      }),
    /3\.\.256/,
  );
});

test('film scenes take lathe and extrude nodes', () => {
  const scene = (nodes) => ({
    schemaVersion: 1,
    id: 'shapes',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'asphalt' }, ...nodes],
  });
  const context = { props: [], recipes: ['asphalt', 'concrete'] };
  const bollard = {
    id: 'bollard',
    type: 'lathe',
    profile: [
      [0.12, 0],
      [0.12, 0.8],
      [0.09, 0.95],
      [0, 1],
    ],
    position: [1, 0, 0],
    material: 'concrete',
  };
  const kerb = {
    id: 'kerb',
    type: 'extrude',
    outline: [
      [0, 0],
      [4, 0],
      [4, 0.3],
      [0, 0.3],
    ],
    height: 0.15,
    position: [-2, 0, 2],
    yawDeg: 30,
    material: 'concrete',
  };
  assert.deepEqual(validateZhudaFilmScene(scene([bollard, kerb]), context), []);
  assert.deepEqual(
    validateZhudaFilmScene(
      scene([
        {
          ...bollard,
          profile: [
            [0.12, 0],
            [-1, 1],
          ],
          sides: 8,
        },
        { ...kerb, height: -1 },
        { id: 'x', type: 'sphere' },
      ]),
      context,
    ),
    [
      'scene.nodes[1].sides: unknown field',
      'scene.nodes[1].profile[1]: the radius cannot be negative',
      'scene.nodes[2].height: use a positive number of metres',
      'scene.nodes[3].type: use prop, box, lathe, extrude, ground, model, reflector, water or light',
    ],
  );
});
