import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { zhudaCsg, validateZhudaCsgInput } from '../packages/core/csg/index.ts';
import { createZhudaBoxMesh, createZhudaLatheMesh } from '../packages/core/procedural/Geometry.ts';
import { computeMeshTangents } from '../packages/core/runtime3d/Surfaces.ts';

const repo = path.resolve(import.meta.dirname, '..');
const box = (w, h, d, at = [0, 0, 0], origin) => {
  const mesh = createZhudaBoxMesh({ width: w, height: h, depth: d, ...(origin ? { origin } : {}) });
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let k = 0; k < 3; k++) mesh.positions[i + k] += at[k];
  return mesh;
};
/** A closed sphere from the geometry kit's lathe: 24 sides, 16 rings. */
const sphere = (r, at = [0, 0, 0]) => {
  const rings = 16;
  const mesh = createZhudaLatheMesh({
    profile: Array.from({ length: rings + 1 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.PI * i) / rings;
      return [i === 0 || i === rings ? 0 : Math.cos(a) * r, Math.sin(a) * r];
    }),
    segments: 24,
  });
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let k = 0; k < 3; k++) mesh.positions[i + k] += at[k];
  return mesh;
};
const tri = (m, t) =>
  [0, 1, 2].map((k) => {
    const i = m.indices[t * 3 + k];
    return {
      p: [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]],
      n: m.normals ? [m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]] : null,
    };
  });
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Signed volume, positive when the triangles face out (the engine's winding). */
const volume = (m) => {
  let s = 0;
  for (let t = 0; t < m.indices.length / 3; t++) {
    const [a, b, c] = tri(m, t);
    s -= dot(a.p, cross(b.p, c.p)) / 6;
  }
  return s;
};
/** Closed, every edge used once each way once welded; each face where its normals point. */
function assertClosedOutward(m, label) {
  const ids = new Map(),
    weld = (p) => {
      const key = p.map((v) => Math.round(v * 1e4)).join(',');
      if (!ids.has(key)) ids.set(key, ids.size);
      return ids.get(key);
    };
  const directed = new Map();
  for (let t = 0; t < m.indices.length / 3; t++) {
    const v = tri(m, t);
    const w = v.map((x) => weld(x.p));
    for (let k = 0; k < 3; k++) {
      const key = w[k] + '>' + w[(k + 1) % 3];
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
    // The engine's winding: cross(v1 - v0, v2 - v0) points into the surface.
    const face = cross(sub(v[1].p, v[0].p), sub(v[2].p, v[0].p)).map((x) => -x);
    for (const x of v) assert.ok(dot(face, x.n) > 0, `${label}: a normal against its face`);
  }
  for (const [key, count] of directed) {
    assert.equal(count, 1, `${label}: edge ${key} twice the same way`);
    const [a, b] = key.split('>');
    assert.equal(directed.get(b + '>' + a), 1, `${label}: edge ${key} open`);
  }
}

const A = box(2, 2, 2);
const ball = sphere(0.7);

test('a box minus a sphere inside it: a closed box with a cavity of the sphere’s volume, no splinters', () => {
  const r = zhudaCsg(A, ball, 'subtract');
  assert.ok(Math.abs(volume(r.mesh) - (8 - volume(ball))) < 1e-5, `${volume(r.mesh)}`);
  assertClosedOutward(r.mesh, 'box minus sphere');
  assert.equal(r.report.openEdges, 0);
  // The box's faces were split by the sphere's planes but kept whole: 12 + 720 triangles.
  assert.deepEqual([r.report.trianglesIn, r.report.trianglesOut], [[12, 720], 732]);
  assert.deepEqual(r.groups, [
    { source: 'a', start: 0, count: 36 },
    { source: 'b', start: 36, count: 2160 },
  ]);
  // Union and intersection of the same: the box, the sphere.
  assert.ok(Math.abs(volume(zhudaCsg(A, ball, 'union').mesh) - 8) < 1e-5);
  assert.ok(Math.abs(volume(zhudaCsg(A, ball, 'intersect').mesh) - volume(ball)) < 1e-5);
});

test('a sphere that cuts the corner: the three operations agree on volume and stay closed', () => {
  const corner = sphere(1.2, [1, 1, 1]);
  const [u, s, i] = ['union', 'subtract', 'intersect'].map((op) => zhudaCsg(A, corner, op));
  for (const [r, label] of [
    [u, 'union'],
    [s, 'subtract'],
    [i, 'intersect'],
  ]) {
    assertClosedOutward(r.mesh, label);
    assert.equal(r.report.openEdges, 0, label);
  }
  const vb = volume(corner);
  assert.ok(Math.abs(volume(s.mesh) + volume(i.mesh) - 8) < 1e-4, 'A − B and A ∩ B make A');
  assert.ok(
    Math.abs(volume(u.mesh) + volume(i.mesh) - (8 + vb)) < 1e-4,
    'A ∪ B and A ∩ B make A and B',
  );
  // An eighth of the sphere (about) is inside the box.
  assert.ok(Math.abs(volume(i.mesh) - vb / 8) < vb * 0.02, `${volume(i.mesh)} against ${vb / 8}`);
});

test('overlapping, coplanar and touching boxes', () => {
  const shifted = box(2, 2, 2, [1, 0.5, 0]);
  const expected = { union: 13, subtract: 5, intersect: 3 };
  for (const op of ['union', 'subtract', 'intersect']) {
    const r = zhudaCsg(A, shifted, op);
    assert.ok(Math.abs(volume(r.mesh) - expected[op]) < 1e-6, `${op}: ${volume(r.mesh)}`);
    assertClosedOutward(r.mesh, `overlapping ${op}`);
  }
  // Coplanar: the same top and bottom.
  const level = box(2, 2, 2, [1, 0, 0]);
  const flat = zhudaCsg(A, level, 'union');
  assert.ok(Math.abs(volume(flat.mesh) - 12) < 1e-6);
  assertClosedOutward(flat.mesh, 'coplanar union');
  assertClosedOutward(zhudaCsg(A, level, 'subtract').mesh, 'coplanar subtract');
  // Touching face to face: one body of two; nothing to take away; nothing in common.
  const next = box(2, 2, 2, [2, 0, 0]);
  const joined = zhudaCsg(A, next, 'union');
  assert.ok(Math.abs(volume(joined.mesh) - 16) < 1e-6);
  assertClosedOutward(joined.mesh, 'touching union');
  assert.ok(Math.abs(volume(zhudaCsg(A, next, 'subtract').mesh) - 8) < 1e-6);
  assert.equal(zhudaCsg(A, next, 'intersect').report.trianglesOut, 0);
});

test('a wall with a door cut through it', () => {
  const wall = box(4, 3, 0.3, [0, 0, 0], 'bottom');
  const door = box(1, 2.1, 1, [0.6, 0, 0], 'bottom');
  const r = zhudaCsg(wall, door, 'subtract');
  assert.ok(Math.abs(volume(r.mesh) - (3.6 - 0.63)) < 1e-6, `${volume(r.mesh)}`);
  assertClosedOutward(r.mesh, 'wall with a door');
  // The door's sides inside the wall are the cut faces, from the door.
  assert.equal(r.groups.at(-1).source, 'b');
  // BSP splinters the faces it cuts: 24 triangles in, 90 out (recorded, not minimal).
  assert.equal(r.report.trianglesOut, 90);
});

test('a triangle without area is left out; an open mesh is refused with what is wrong', () => {
  const extra = box(2, 2, 2);
  const indices = new Uint16Array(extra.indices.length + 3);
  indices.set(extra.indices);
  indices.set([0, 0, 1], extra.indices.length);
  const degenerate = { ...extra, indices };
  assert.equal(validateZhudaCsgInput(degenerate).degenerateTriangles, 1);
  assert.ok(
    Math.abs(volume(zhudaCsg(degenerate, ball, 'subtract').mesh) - (8 - volume(ball))) < 1e-5,
  );
  const open = { ...extra, indices: extra.indices.slice(3) };
  const check = validateZhudaCsgInput(open);
  assert.equal(check.openEdges, 3);
  assert.throws(
    () => zhudaCsg(open, ball, 'union'),
    /CSG: a cannot be cut: 3 open edges: the mesh has a hole/,
  );
  assert.throws(() => zhudaCsg(A, open, 'union'), /CSG: b cannot be cut/);
  assert.throws(() => zhudaCsg(A, ball, 'xor'), /union, subtract or intersect/);
  assert.throws(
    () => zhudaCsg(A, ball, 'union', { maxTriangles: 100 }),
    /720 triangles; at most 100/,
  );
  assert.match(validateZhudaCsgInput({ positions: [], indices: [] }).issues[0], /positions/);
});

test('deterministic, attributes kept, tangents worked out again', () => {
  const one = zhudaCsg(A, sphere(1.2, [1, 1, 1]), 'subtract'),
    two = zhudaCsg(A, sphere(1.2, [1, 1, 1]), 'subtract');
  assert.deepEqual([...one.mesh.positions], [...two.mesh.positions]);
  assert.deepEqual([...one.mesh.indices], [...two.mesh.indices]);
  assert.equal(one.mesh.uvs.length, (one.mesh.positions.length / 3) * 2);
  const tangent = { ...A, tangents: computeMeshTangents(A) };
  const cut = zhudaCsg(tangent, ball, 'subtract');
  assert.equal(cut.mesh.tangents.length, (cut.mesh.positions.length / 3) * 4);
});

test('the subpath is its own bundle: ESM and CJS export it, the main bundle does not carry it', async () => {
  const esm = path.join(repo, 'dist/sdk/zhuda-laya-csg.esm.js');
  const cjs = path.join(repo, 'dist/sdk/zhuda-laya-csg.cjs');
  assert.ok(fs.existsSync(esm) && fs.existsSync(cjs), 'run npm run build first');
  const fromEsm = await import(pathToFileURL(esm).href);
  const fromCjs = createRequire(import.meta.url)(cjs);
  for (const mod of [fromEsm, fromCjs]) {
    assert.equal(typeof mod.zhudaCsg, 'function');
    assert.equal(typeof mod.validateZhudaCsgInput, 'function');
    assert.ok(Math.abs(volume(mod.zhudaCsg(A, ball, 'subtract').mesh) - (8 - volume(ball))) < 1e-5);
  }
  const main = fs.readFileSync(path.join(repo, 'dist/sdk/zhuda-laya-engine.esm.js'), 'utf8');
  assert.ok(!/zhudaCsg|bspSubtract/.test(main), 'the core bundle has no CSG');
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.exports['./csg'], {
    types: './packages/types/csg/index.d.ts',
    import: './dist/sdk/zhuda-laya-csg.esm.js',
    require: './dist/sdk/zhuda-laya-csg.cjs',
  });
});

test('cuts in succession: five windows in a wall stay closed; trouble is reported, not hidden', () => {
  let wall = box(8, 3, 0.3, [0, 0, 0], 'bottom');
  const counts = [];
  for (let i = 0; i < 5; i++) {
    const r = zhudaCsg(wall, box(0.8, 1, 1, [-3.2 + i * 1.6, 1, 0], 'bottom'), 'subtract');
    assert.deepEqual([r.report.openEdges, r.report.nonManifoldEdges], [0, 0], `window ${i + 1}`);
    wall = r.mesh;
    counts.push(r.report.trianglesOut);
  }
  assertClosedOutward(wall, 'five windows');
  assert.ok(Math.abs(volume(wall) - (8 * 3 * 0.3 - 5 * 0.8 * 1 * 0.3)) < 1e-6);
  // Splinters grow with every cut (recorded: 88, 232, 388, 564, 664).
  assert.deepEqual(counts, [88, 232, 388, 564, 664]);
});
