// Triangle BVH picking (ZhudaTriangleBvh) against brute force, and its
// provider for ZhudaSceneQueries. The draw that checks picks against pixels is
// verify:geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaTriangleBvh,
  createZhudaMeshQueryProvider,
  readZhudaLayaMeshTriangles,
} from '../packages/core/runtime3d/MeshQuery.ts';
import { ZhudaSceneQueries } from '../packages/core/runtime3d/SceneQueries.ts';
import { compose4 } from '../packages/core/runtime3d/Math3D.ts';
import {
  createZhudaTorusMesh,
  createZhudaBoxMesh,
  createZhudaExtrudeMesh,
} from '../packages/core/procedural/Geometry.ts';

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
const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** Every triangle, one by one (Möller-Trumbore written again, in world space). */
function bruteForce(positions, indices, matrix, ray, maxDistance = Infinity) {
  const length = Math.hypot(ray.direction.x, ray.direction.y, ray.direction.z),
    d = [ray.direction.x / length, ray.direction.y / length, ray.direction.z / length],
    o = [ray.origin.x, ray.origin.y, ray.origin.z];
  const corner = (i) => {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    return matrix ? apply(matrix, p) : p;
  };
  let best = null;
  for (let t = 0; t < indices.length / 3; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => corner(indices[t * 3 + k]));
    const e1 = b.map((v, k) => v - a[k]),
      e2 = c.map((v, k) => v - a[k]),
      p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]],
      det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-14) continue;
    const s = o.map((v, k) => v - a[k]),
      u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [
        s[1] * e1[2] - s[2] * e1[1],
        s[2] * e1[0] - s[0] * e1[2],
        s[0] * e1[1] - s[1] * e1[0],
      ],
      v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const distance = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (distance < 0 || distance > maxDistance) continue;
    if (!best || distance < best.distance) best = { distance, triangle: t, u, v };
  }
  return best;
}
function soup(next, count, spread = 10, size = 1.5) {
  const positions = [],
    indices = [];
  for (let t = 0; t < count; t++) {
    const centre = [0, 1, 2].map(() => (next() - 0.5) * spread);
    for (let k = 0; k < 3; k++) {
      positions.push(...centre.map((c) => c + (next() - 0.5) * size));
      indices.push(t * 3 + k);
    }
  }
  return { positions: new Float64Array(positions), indices: new Uint32Array(indices) };
}
function randomRay(next, spread = 14) {
  const origin = {
    x: (next() - 0.5) * spread,
    y: (next() - 0.5) * spread,
    z: (next() - 0.5) * spread,
  };
  // Aim near the middle so most rays meet something.
  const target = [0, 1, 2].map(() => (next() - 0.5) * 4);
  return {
    origin,
    direction: { x: target[0] - origin.x, y: target[1] - origin.y, z: target[2] - origin.z },
  };
}
function compare(bvh, mesh, matrix, rays, next, label) {
  let hits = 0;
  for (let i = 0; i < rays; i++) {
    const ray = randomRay(next),
      limit = next() < 0.2 ? next() * 8 : Infinity,
      expected = bruteForce(mesh.positions, mesh.indices, matrix, ray, limit),
      got = bvh.raycast(ray, limit);
    if (!expected) {
      assert.equal(got, null, `${label}: ray ${i} should miss`);
      continue;
    }
    hits++;
    assert.ok(got, `${label}: ray ${i} should hit triangle ${expected.triangle}`);
    assert.ok(
      Math.abs(got.distance - expected.distance) < 1e-7 * Math.max(1, expected.distance),
      `${label}: ray ${i} distance ${got.distance} vs ${expected.distance}`,
    );
    if (got.triangle !== expected.triangle) {
      // Only a tie (an edge shared by two triangles) may pick the other one.
      const other = bruteForce(
        mesh.positions,
        mesh.indices.slice(got.triangle * 3, got.triangle * 3 + 3),
        matrix,
        ray,
        limit,
      );
      assert.ok(
        other && Math.abs(other.distance - expected.distance) < 1e-7,
        `${label}: ray ${i} triangle`,
      );
    } else {
      assert.ok(Math.abs(got.barycentric[1] - expected.u) < 1e-6, `${label}: barycentric u`);
      assert.ok(Math.abs(got.barycentric[2] - expected.v) < 1e-6, `${label}: barycentric v`);
    }
    const w = got.barycentric;
    assert.ok(Math.abs(w[0] + w[1] + w[2] - 1) < 1e-12 && w.every((x) => x >= -1e-12));
    // The point is the corners weighted by the barycentric coordinates.
    const corners = [0, 1, 2].map((k) => {
      const i = mesh.indices[got.triangle * 3 + k],
        p = [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
      return matrix ? apply(matrix, p) : p;
    });
    const p = [0, 1, 2].map(
      (k) => w[0] * corners[0][k] + w[1] * corners[1][k] + w[2] * corners[2][k],
    );
    assert.ok(
      Math.hypot(p[0] - got.position.x, p[1] - got.position.y, p[2] - got.position.z) < 1e-6,
      `${label}: position`,
    );
    assert.ok(Math.abs(Math.hypot(got.normal.x, got.normal.y, got.normal.z) - 1) < 1e-9);
  }
  return hits;
}

test('the BVH finds the same nearest triangle as brute force (random soups and rays)', () => {
  const next = random(11);
  for (const [count, leaf] of [
    [1, 4],
    [7, 1],
    [300, 4],
    [2000, 8],
  ]) {
    const mesh = soup(next, count);
    const bvh = new ZhudaTriangleBvh({ ...mesh, maxLeafTriangles: leaf });
    assert.equal(bvh.triangleCount, count);
    assert.ok(bvh.nodeCount >= 1 && bvh.nodeCount <= 2 * count);
    const hits = compare(bvh, mesh, null, 400, next, `soup ${count}`);
    if (count >= 300) assert.ok(hits > 150, `most rays meet the soup (${hits})`);
  }
});

test('a world matrix with rotation, mirroring and uneven scale is applied to the query', () => {
  const next = random(5);
  const torus = createZhudaTorusMesh({
    radius: 2,
    tube: 0.6,
    radialSegments: 12,
    tubularSegments: 40,
  });
  const mesh = { positions: torus.positions, indices: torus.indices };
  for (const scale of [
    { x: 1, y: 1, z: 1 },
    { x: 2, y: 0.5, z: 1.3 },
    { x: -1, y: 1, z: 1 },
  ]) {
    const q = { x: 0.3, y: -0.5, z: 0.2, w: 0.79 },
      matrix = compose4({ x: 1, y: -2, z: 0.5 }, q, scale),
      bvh = new ZhudaTriangleBvh({ ...mesh, matrix });
    const hits = compare(bvh, mesh, matrix, 400, next, `torus ${JSON.stringify(scale)}`);
    assert.ok(hits > 40, `enough rays meet the torus (${hits})`);
  }
  // setMatrix moves it without a rebuild.
  const bvh = new ZhudaTriangleBvh(mesh);
  const down = { origin: { x: 2, y: 10, z: 0 }, direction: { x: 0, y: -1, z: 0 } };
  assert.ok(Math.abs(bvh.raycast(down).distance - 9.4) < 1e-6);
  bvh.setMatrix(compose4({ x: 0, y: 3, z: 0 }));
  assert.ok(Math.abs(bvh.raycast(down).distance - 6.4) < 1e-6);
  assert.deepEqual(
    Object.values(bvh.worldBounds().min).map((v) => +v.toFixed(5)),
    [-2.6, 2.4, -2.6],
  );
});

test('front and back faces follow the winding, outward normals stay outward', () => {
  // A closed box from the engine's builder: clockwise fronts.
  const box = createZhudaBoxMesh({ width: 2, height: 2, depth: 2 });
  const bvh = new ZhudaTriangleBvh(box);
  const fromOutside = bvh.raycast({
    origin: { x: 0, y: 0, z: 5 },
    direction: { x: 0, y: 0, z: -1 },
  });
  assert.equal(fromOutside.frontFace, true);
  assert.deepEqual(
    Object.values(fromOutside.normal).map((v) => Math.round(v) || 0),
    [0, 0, 1],
  );
  assert.ok(Math.abs(fromOutside.distance - 4) < 1e-9);
  // From inside the ray meets the back of the far wall.
  const fromInside = bvh.raycast({
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: -1 },
  });
  assert.equal(fromInside.frontFace, false);
  // The far wall's outward normal, which the ray runs along.
  assert.deepEqual(
    Object.values(fromInside.normal).map((v) => Math.round(v) || 0),
    [0, 0, -1],
  );
  assert.equal(
    bvh.raycast({ origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } }, Infinity, {
      side: 'front',
    }),
    null,
  );
  assert.equal(
    bvh.raycast({ origin: { x: 0, y: 0, z: 5 }, direction: { x: 0, y: 0, z: -1 } }, Infinity, {
      side: 'back',
    }).distance,
    6,
  );
  // Mirrored, the outside is still the front and the normal still points out.
  const mirrored = new ZhudaTriangleBvh({
    ...box,
    matrix: compose4(undefined, undefined, { x: -1, y: 1, z: 1 }),
  });
  const side = mirrored.raycast({ origin: { x: 5, y: 0, z: 0 }, direction: { x: -1, y: 0, z: 0 } });
  assert.equal(side.frontFace, true);
  assert.deepEqual(
    Object.values(side.normal).map((v) => Math.round(v) || 0),
    [1, 0, 0],
  );
  // Counter-clockwise source data says so.
  const ccw = new ZhudaTriangleBvh({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    winding: 'ccw',
  });
  const hit = ccw.raycast({ origin: { x: 0.2, y: 0.2, z: 1 }, direction: { x: 0, y: 0, z: -1 } });
  assert.equal(hit.frontFace, true);
  assert.deepEqual(
    Object.values(hit.normal).map((v) => Math.round(v) || 0),
    [0, 0, 1],
  );
  assert.deepEqual(
    hit.barycentric.map((v) => +v.toFixed(6)),
    [0.6, 0.2, 0.2],
  );
});

test('a mesh provider answers ZhudaSceneQueries with the nearest entity and its triangle', () => {
  const queries = new ZhudaSceneQueries();
  const wall = createZhudaExtrudeMesh({
    outline: [
      [-2, 0],
      [2, 0],
      [2, 0.2],
      [-2, 0.2],
    ],
    holes: [
      [
        [-0.5, 0.05],
        [0.5, 0.05],
        [0.5, 0.15],
        [-0.5, 0.15],
      ],
    ],
    height: 3,
  });
  // A wall standing in the XY plane... here simply its slab in X/Z, 3 m high.
  const near = new ZhudaTriangleBvh(wall),
    far = new ZhudaTriangleBvh({ ...wall, matrix: compose4({ x: 0, y: 0, z: 4 }) });
  queries.register(createZhudaMeshQueryProvider(near, { entityId: 'wall', layer: 1 }));
  queries.register(
    createZhudaMeshQueryProvider(far, { entityId: 'far-wall', instanceId: 7, layer: 2 }),
  );
  const down = (x, z) => ({ origin: { x, y: 10, z }, direction: { x: 0, y: -1, z: 0 } });
  const across = (x) => ({ origin: { x, y: 1, z: -5 }, direction: { x: 0, y: 0, z: 1 } });
  const first = queries.raycast(across(1.5));
  assert.equal(first.entityId, 'wall');
  assert.ok(Math.abs(first.distance - 5) < 1e-6);
  assert.equal(typeof first.triangle, 'number');
  assert.equal(first.frontFace, true);
  // Through the hole (seen from above) the ray goes on down to nothing.
  assert.equal(queries.raycast(down(0, 0.1)), null);
  assert.equal(queries.raycast(down(1, 0.1)).entityId, 'wall');
  // Layer mask 2 sees only the far wall, with its instance.
  const masked = queries.raycast(across(1.5), Infinity, 2);
  assert.equal(masked.entityId, 'far-wall');
  assert.equal(masked.instanceId, 7);
  assert.ok(Math.abs(masked.distance - 9) < 1e-6);
  // A distance limit short of the wall.
  assert.equal(queries.raycast(across(1.5), 4.5), null);
  assert.throws(() => createZhudaMeshQueryProvider(near, {}), /entityId/);
  assert.throws(() => createZhudaMeshQueryProvider({}, { entityId: 'x' }), /ZhudaTriangleBvh/);
  assert.throws(() => createZhudaMeshQueryProvider(near, { entityId: 'x', layer: -1 }), /layer/);
});

test('a LayaAir mesh is read through getPositions and getIndices', () => {
  const box = createZhudaBoxMesh({ width: 1, height: 1, depth: 1 });
  const fake = {
    getPositions(out) {
      out.length = box.positions.length / 3;
      for (let i = 0; i < out.length; i++)
        out[i] = {
          x: box.positions[i * 3],
          y: box.positions[i * 3 + 1],
          z: box.positions[i * 3 + 2],
        };
    },
    getIndices: () => box.indices.slice(),
  };
  const read = readZhudaLayaMeshTriangles(fake);
  assert.deepEqual([...read.positions], [...box.positions]);
  assert.deepEqual([...read.indices], [...box.indices]);
  assert.equal(new ZhudaTriangleBvh(read).triangleCount, 12);
  assert.throws(
    () =>
      readZhudaLayaMeshTriangles({
        getPositions() {
          throw Error('NotReadableError');
        },
        getIndices: () => [],
      }),
    /not readable/,
  );
  assert.throws(() => readZhudaLayaMeshTriangles({}), /getPositions and getIndices/);
});

test('bad meshes, matrices and rays are refused with the reason', () => {
  const ok = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] };
  assert.throws(() => new ZhudaTriangleBvh({ positions: [0, 0, 0, 1] }), /x, y, z per vertex/);
  assert.throws(() => new ZhudaTriangleBvh({ positions: [0, 0, 0] }), /at least one triangle/);
  assert.throws(
    () => new ZhudaTriangleBvh({ positions: [0, 0, NaN, 1, 0, 0, 0, 1, 0] }),
    /position 0 is not finite/,
  );
  assert.throws(() => new ZhudaTriangleBvh({ ...ok, indices: [0, 1] }), /in threes/);
  assert.throws(
    () => new ZhudaTriangleBvh({ ...ok, indices: [0, 1, 3] }),
    /index 2 \(3\) is outside/,
  );
  assert.throws(() => new ZhudaTriangleBvh({ ...ok, indices: [0, 1, 1.5] }), /index 2/);
  assert.throws(() => new ZhudaTriangleBvh({ ...ok, maxLeafTriangles: 0 }), /maxLeafTriangles/);
  assert.throws(() => new ZhudaTriangleBvh({ ...ok, winding: 'left' }), /winding/);
  assert.throws(() => new ZhudaTriangleBvh({ ...ok, matrix: [1, 0, 0] }), /16 finite numbers/);
  assert.throws(
    () => new ZhudaTriangleBvh({ ...ok, matrix: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
    /cannot be inverted/,
  );
  assert.throws(
    () =>
      new ZhudaTriangleBvh({ ...ok, matrix: [1, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
    /affine/,
  );
  const bvh = new ZhudaTriangleBvh(ok);
  assert.throws(
    () => bvh.raycast({ origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 } }),
    /no length/,
  );
  assert.throws(
    () => bvh.raycast({ origin: { x: NaN, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }),
    /finite/,
  );
  assert.throws(
    () => bvh.raycast({ origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }, -1),
    /0 or more/,
  );
  assert.throws(
    () =>
      bvh.raycast({ origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }, 1, {
        side: 'top',
      }),
    /side/,
  );
  // Triangles without area are left out; a mesh of only those answers nothing.
  const flat = new ZhudaTriangleBvh({ positions: [0, 0, 0, 1, 0, 0, 2, 0, 0] });
  assert.equal(flat.triangleCount, 0);
  assert.equal(flat.worldBounds(), null);
  assert.equal(
    flat.raycast({ origin: { x: 1, y: 1, z: 0 }, direction: { x: 0, y: -1, z: 0 } }),
    null,
  );
});

test('a large mesh builds and answers quickly', () => {
  const torus = createZhudaTorusMesh({
    radius: 2,
    tube: 0.5,
    radialSegments: 64,
    tubularSegments: 256,
  });
  const started = performance.now();
  const bvh = new ZhudaTriangleBvh(torus);
  const built = performance.now() - started;
  assert.equal(bvh.triangleCount, 64 * 256 * 2);
  const next = random(3),
    t0 = performance.now();
  let hits = 0;
  for (let i = 0; i < 2000; i++) if (bvh.raycast(randomRay(next))) hits++;
  const each = (performance.now() - t0) / 2000;
  assert.ok(hits > 300);
  // Loose bounds for a loaded test machine; the point is that it is not brute force.
  assert.ok(built < 2000, `built in ${built.toFixed(0)} ms`);
  assert.ok(each < 1, `${(each * 1000).toFixed(1)} µs a ray`);
});
