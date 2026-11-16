import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaIsosurfaceMesh,
  validateZhudaIsosurface,
  zhudaIsosurfaceGrid,
  zhudaVolumeDistance,
} from '../packages/core/procedural/Isosurface.ts';
import {
  computeZhudaDensityVolume,
  validateZhudaDensitySpec,
} from '../packages/core/runtime3d/DensityVolume.ts';

/** A box's signed distance (exact outside, the largest axis inside). */
const box = (x, y, z, c, half) => {
  const qx = Math.abs(x - c[0]) - half[0],
    qy = Math.abs(y - c[1]) - half[1],
    qz = Math.abs(z - c[2]) - half[2];
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qy, qz), 0);
};
const sphere = (x, y, z, c, r) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
/** A slab resting on the floor of the box, and three loose specks above it. */
const SPECKS = [
  [0, 2.4, 0],
  [2, 3, 1],
  [-2, 2.2, -2],
];
const slabWithSpecks = (x, y, z) =>
  Math.min(box(x, y, z, [0, 0.55, 0], [3, 0.5, 3]), ...SPECKS.map((c) => sphere(x, y, z, c, 0.35)));
const BOX = { min: [-4, 0, -4], max: [4, 4, 4], cellSize: 0.1 };

/** Connected pieces of a mesh (triangles sharing a vertex) and whether every edge has two triangles. */
function pieces(mesh) {
  const parent = new Int32Array(mesh.positions.length / 3).map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const edges = new Map();
  const ix = mesh.indices;
  for (let t = 0; t < ix.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = ix[t + k],
        b = ix[t + ((k + 1) % 3)];
      parent[find(a)] = find(b);
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  const roots = new Set();
  for (let t = 0; t < ix.length; t++) roots.add(find(ix[t]));
  return { count: roots.size, closed: [...edges.values()].every((n) => n === 2) };
}

test('loose specks are removed before meshing: one closed piece instead of four', () => {
  const all = createZhudaIsosurfaceMesh({ distance: slabWithSpecks, ...BOX });
  assert.deepEqual(pieces(all), { count: 4, closed: true });
  const kept = createZhudaIsosurfaceMesh({
    distance: slabWithSpecks,
    ...BOX,
    removeFloating: true,
  });
  assert.deepEqual(pieces(kept), { count: 1, closed: true });
  // Nothing of the specks is left: every vertex is on the slab (below 1.2 m).
  let top = -Infinity;
  for (let i = 1; i < kept.positions.length; i += 3) top = Math.max(top, kept.positions[i]);
  assert.ok(top < 1.2, `highest vertex ${top}`);
  // The slab itself is the same mesh as without the specks.
  const slab = createZhudaIsosurfaceMesh({
    distance: (x, y, z) => box(x, y, z, [0, 0.55, 0], [3, 0.5, 3]),
    ...BOX,
  });
  assert.equal(kept.positions.length, slab.positions.length);
  assert.deepEqual([...kept.indices], [...slab.indices]);
  // Without the option nothing changes.
  const again = createZhudaIsosurfaceMesh({
    distance: slabWithSpecks,
    ...BOX,
    removeFloating: false,
  });
  assert.deepEqual([...again.positions], [...all.positions]);
});

test('removeFloating keeps the largest body, or the one at a point, and says when there is none', () => {
  const largest = createZhudaIsosurfaceMesh({
    distance: slabWithSpecks,
    ...BOX,
    removeFloating: { anchor: 'largest' },
  });
  assert.deepEqual(pieces(largest), { count: 1, closed: true });
  const speck = createZhudaIsosurfaceMesh({
    distance: slabWithSpecks,
    ...BOX,
    removeFloating: { anchor: [2, 3, 1] },
  });
  assert.deepEqual(pieces(speck), { count: 1, closed: true });
  for (let i = 0; i < speck.positions.length; i += 3)
    assert.ok(
      Math.hypot(speck.positions[i] - 2, speck.positions[i + 1] - 3, speck.positions[i + 2] - 1) <
        0.5,
    );
  assert.throws(
    () =>
      createZhudaIsosurfaceMesh({
        distance: slabWithSpecks,
        ...BOX,
        removeFloating: { anchor: [3.5, 3.5, 3.5] },
      }),
    /anchor point is not inside/,
  );
  // A body that floats entirely: nothing on the floor to keep.
  assert.throws(
    () =>
      createZhudaIsosurfaceMesh({
        distance: (x, y, z) => sphere(x, y, z, [0, 2, 0], 0.5),
        ...BOX,
        removeFloating: true,
      }),
    /nothing is inside within a cell of the box's floor/,
  );
  assert.match(
    validateZhudaIsosurface({
      distance: slabWithSpecks,
      ...BOX,
      removeFloating: { anchor: 'top' },
    })[0],
    /removeFloating/,
  );
});

test('a volume on the mesher grid meshes as the field it was sampled from', async () => {
  const grid = zhudaIsosurfaceGrid(BOX.min, BOX.max, BOX.cellSize);
  assert.deepEqual(grid.size, [85, 45, 85]);
  assert.deepEqual(grid.origin, [-4.2, -0.2, -4.2]);
  const volume = await computeZhudaDensityVolume({
    name: 'ZhudaTestSlab',
    glsl: 'float zhudaDensity(vec3 p){return p.y;}',
    density: slabWithSpecks,
    ...BOX,
  });
  assert.equal(volume.backend, 'cpu', 'no compute in Node: the JavaScript density');
  assert.deepEqual(volume.size, grid.size);
  const sampled = createZhudaIsosurfaceMesh({
    distance: slabWithSpecks,
    ...BOX,
    removeFloating: true,
  });
  const fromVolume = createZhudaIsosurfaceMesh({
    distance: slabWithSpecks,
    volume,
    ...BOX,
    removeFloating: true,
  });
  // The same cells, the same quads; the vertices land on the same surface.
  assert.deepEqual([...fromVolume.indices], [...sampled.indices]);
  let worst = 0;
  for (let i = 0; i < sampled.positions.length; i++)
    worst = Math.max(worst, Math.abs(sampled.positions[i] - fromVolume.positions[i]));
  assert.ok(worst < BOX.cellSize * 0.02, `largest move ${worst}`);
  // With the volume alone (interpolated), still one closed piece, a near count.
  const alone = createZhudaIsosurfaceMesh({ volume, ...BOX, removeFloating: true });
  assert.deepEqual(pieces(alone), { count: 1, closed: true });
  assert.equal(alone.indices.length, sampled.indices.length);
  // The interpolated field equals the grid at its points.
  const field = zhudaVolumeDistance(volume);
  assert.ok(
    Math.abs(
      field(-4.2 + 10 * 0.1, -0.2 + 5 * 0.1, -4.2 + 7 * 0.1) -
        volume.values[10 + 5 * 85 + 7 * 85 * 45],
    ) < 1e-6,
  );
  // A volume of another box is refused with what it should be.
  assert.match(
    validateZhudaIsosurface({ volume, min: [-4, 0, -4], max: [4, 4, 5], cellSize: 0.1 }).join(),
    /volume does not cover this box's grid \(85 x 45 x 95 points/,
  );
});

test('a density load is cancelled, times out and fails, and gives no result after', async () => {
  const spec = {
    name: 'ZhudaTestField',
    glsl: 'float zhudaDensity(vec3 p){return length(p)-1.0;}',
    density: (x, y, z) => Math.hypot(x, y, z) - 1,
    min: [-2, -2, -2],
    max: [2, 2, 2],
    cellSize: 0.02,
  };
  const before = new AbortController();
  before.abort();
  await assert.rejects(computeZhudaDensityVolume(spec, { signal: before.signal }), {
    name: 'AbortError',
  });
  const during = new AbortController();
  let calls = 0;
  const counted = {
    ...spec,
    density: (x, y, z) => (calls++ === 50000 && during.abort(), spec.density(x, y, z)),
  };
  await assert.rejects(computeZhudaDensityVolume(counted, { signal: during.signal }), {
    name: 'AbortError',
  });
  const total = zhudaIsosurfaceGrid(spec.min, spec.max, spec.cellSize).size.reduce((a, b) => a * b);
  assert.ok(calls < total, `stopped part way: ${calls} of ${total}`);
  await assert.rejects(computeZhudaDensityVolume(spec, { timeoutMs: 1 }), { name: 'TimeoutError' });
  await assert.rejects(
    computeZhudaDensityVolume({
      ...spec,
      density: () => {
        throw Error('bad rock');
      },
    }),
    /bad rock/,
  );
  await assert.rejects(
    computeZhudaDensityVolume({ ...spec, cellSize: 0.5, density: () => Number.NaN }),
    /not finite at grid point 0/,
  );
  const ok = await computeZhudaDensityVolume({ ...spec, cellSize: 0.25 });
  assert.equal(ok.values.length, 21 * 21 * 21);
});

test('density specs are validated before any work', () => {
  const good = {
    name: 'ZhudaRock',
    glsl: 'float zhudaDensity(vec3 p){return p.y;}',
    density: (x, y) => y,
    min: [0, 0, 0],
    max: [1, 1, 1],
    cellSize: 0.1,
  };
  assert.deepEqual(validateZhudaDensitySpec(good), []);
  assert.match(validateZhudaDensitySpec({ ...good, name: 'rock' }).join(), /name/);
  assert.match(
    validateZhudaDensitySpec({ ...good, glsl: 'float f(vec3 p){return 0.0;}' }).join(),
    /zhudaDensity/,
  );
  assert.match(
    validateZhudaDensitySpec({
      ...good,
      glsl: 'uniform float u;float zhudaDensity(vec3 p){return u;}',
    }).join(),
    /belong to the engine/,
  );
  assert.match(validateZhudaDensitySpec({ ...good, cellSize: 0.002 }).join(), /at most 16777216/);
  assert.match(validateZhudaDensitySpec({ ...good, density: 3 }).join(), /JavaScript/);
});
