import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaRandom,
  latticeHash,
  gradientNoise,
  fractalNoise,
  cellularNoise,
  validateZhudaTextureRecipe,
  evaluateZhudaTextureMask,
  bakeZhudaTextureSet,
  fingerprintZhudaTextureSet,
  createZhudaProceduralMaterial,
  createZhudaBoxMesh,
  createZhudaTubeMesh,
  createZhudaRodMesh,
  createZhudaIBeamMesh,
  transformZhudaMesh,
  mergeZhudaMeshes,
  computeZhudaMeshBounds,
  ZhudaPropRegistry,
  rotateZhudaCollider,
  mergeZhudaPlacedProps,
  instantiateZhudaPropBatches,
  validateZhudaSynthRecipe,
  renderZhudaSynth,
  renderZhudaSynthWav,
  ProceduralAssetProvider,
  parseZhudaRunParams,
  bootZhudaModules,
} from '../packages/core/procedural/index.ts';
import { AssetProviderError } from '../packages/core/runtime3d/AssetProvider.ts';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** Every triangle must follow the engine winding: cross(v1-v0, v2-v0) opposes the vertex normals. */
function assertWinding(mesh, label) {
  const p = (i) => [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
  const n = (i) => [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    const [pa, pb, pc] = [p(a), p(b), p(c)];
    const e1 = pb.map((v, k) => v - pa[k]),
      e2 = pc.map((v, k) => v - pa[k]);
    const cr = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const avg = [0, 1, 2].map((k) => n(a)[k] + n(b)[k] + n(c)[k]);
    const facing = cr[0] * avg[0] + cr[1] * avg[1] + cr[2] * avg[2];
    assert.ok(facing < 0, `${label}: triangle ${t / 3} has the wrong winding (${facing})`);
  }
}

const paintedSteel = {
  schemaVersion: 1,
  id: 'painted-corrugated-steel',
  tileMeters: [0.762, 2.286],
  seed: 7,
  base: { color: [0.55, 0.08, 0.06], roughness: 0.55, metallic: 0 },
  layers: [
    { name: 'ribs', mask: { type: 'stripes', axis: 'u', count: 10 }, heightMm: 19 },
    {
      name: 'grime',
      mask: { type: 'fbm', frequency: [3, 2], octaves: 4, range: [0.45, 0.8] },
      color: [0.07, 0.06, 0.05],
      roughness: 0.9,
      opacity: 0.6,
    },
    {
      name: 'rust',
      mask: { type: 'cells', frequency: 6, mode: 'id', range: [0.8, 0.95] },
      within: { type: 'fbm', frequency: 12, octaves: 3, range: [0.4, 0.7] },
      color: [0.22, 0.09, 0.04],
      roughness: 0.95,
      metallic: 0,
      heightMm: 0.3,
    },
  ],
};

test('random streams are deterministic, bounded and forkable without disturbing the parent', () => {
  const a = createZhudaRandom(4207),
    b = createZhudaRandom(4207);
  const first = Array.from({ length: 64 }, () => a.next());
  assert.deepEqual(
    first,
    Array.from({ length: 64 }, () => b.next()),
  );
  assert.ok(first.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(
    first.slice(0, 8),
    Array.from({ length: 8 }, () => createZhudaRandom(4208).next()),
  );

  const parent = createZhudaRandom(9),
    child = parent.fork('props').next();
  parent.next();
  parent.next();
  assert.equal(parent.fork('props').next(), child, 'a labelled fork ignores parent draws');
  assert.notEqual(parent.fork('props').next(), parent.fork('decals').next());
  assert.notEqual(parent.fork().next(), parent.fork().next(), 'unlabelled forks are numbered');

  const r = createZhudaRandom(1);
  for (let i = 0; i < 200; i++) {
    const n = r.int(-2, 3);
    assert.ok(Number.isInteger(n) && n >= -2 && n <= 3);
    const x = r.range(5, 6);
    assert.ok(x >= 5 && x < 6);
  }
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
  assert.throws(() => createZhudaRandom(NaN), /finite/);
  assert.throws(() => r.int(1.5, 2), /integer/);
  assert.throws(() => r.pick([]), /empty/);
});

test('noise is stable, in range and exactly periodic on integer lattices', () => {
  assert.equal(latticeHash(3, 5, 7), latticeHash(3, 5, 7));
  assert.notEqual(latticeHash(3, 5, 7), latticeHash(3, 5, 8));
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < 400; i++) {
    const u = (i * 0.6180339) % 1,
      v = (i * 0.3247179) % 1;
    const g = gradientNoise(u * 8, v * 8, 8, 8, 3);
    min = Math.min(min, g);
    max = Math.max(max, g);
    assert.ok(
      near(g, gradientNoise((u + 1) * 8, v * 8, 8, 8, 3), 1e-9),
      'gradient noise wraps in u',
    );
    assert.ok(
      near(g, gradientNoise(u * 8, (v - 1) * 8, 8, 8, 3), 1e-9),
      'gradient noise wraps in v',
    );
    const f = fractalNoise(u, v, 3, 5, 5, 11);
    assert.ok(f >= 0 && f <= 1);
    assert.ok(near(f, fractalNoise(u + 1, v + 1, 3, 5, 5, 11), 1e-9), 'fractal noise wraps');
    const c = cellularNoise(u * 6, v * 4, 6, 4, 2, []),
      w = cellularNoise((u + 1) * 6, (v + 1) * 4, 6, 4, 2, []);
    assert.ok(c[0] <= c[1] && c[2] >= 0 && c[2] < 1);
    assert.ok(near(c[0], w[0], 1e-9) && near(c[1], w[1], 1e-9) && c[2] === w[2], 'cells wrap');
  }
  assert.ok(min < -0.3 && max > 0.3 && min >= -1.05 && max <= 1.05, `range ${min}..${max}`);
});

test('texture recipes are validated with every problem listed', () => {
  assert.deepEqual(validateZhudaTextureRecipe(paintedSteel), []);
  assert.deepEqual(validateZhudaTextureRecipe(null), ['recipe must be an object']);
  const issues = validateZhudaTextureRecipe({
    schemaVersion: 2,
    id: 'Bad Id',
    tileMeters: [0, 1],
    base: { color: [2, 0, 0], roughness: 1.5, metallic: -1 },
    layers: [
      { mask: { type: 'fbm', frequency: 2.5, octaves: 9 }, color: [0, 0, 0] },
      { mask: { type: 'bricks', columns: 4, rows: 3, mortar: 0.6 }, heightMm: -2 },
      { mask: { type: 'stripes', axis: 'w', count: 0 } },
      { mask: { type: 'nope' }, roughness: 0.5, opacity: 2 },
      { mask: { type: 'cells', frequency: 4, range: [0.5, 0.5] }, metallic: 1 },
    ],
  });
  for (const expected of [
    'schemaVersion',
    'id:',
    'tileMeters',
    'base.color',
    'base.roughness',
    'base.metallic',
    'layers[0].mask.frequency',
    'layers[0].mask.octaves',
    'layers[1].mask.rows',
    'layers[1].mask.mortar',
    'layers[2].mask.axis',
    'layers[2].mask.count',
    'layers[2]: set at least one',
    'layers[3].mask.type',
    'layers[3].opacity',
    'layers[4].mask.range',
  ])
    assert.ok(
      issues.some((issue) => issue.startsWith(expected)),
      `missing issue ${expected} in ${JSON.stringify(issues)}`,
    );
  assert.throws(
    () => bakeZhudaTextureSet({ ...paintedSteel, id: 'X' }),
    /Invalid texture recipe: id/,
  );
  assert.throws(() => bakeZhudaTextureSet(paintedSteel, { size: 100 }), /power of two/);
  assert.throws(
    () => bakeZhudaTextureSet(paintedSteel, { normalConvention: 'unity' }),
    /directx or opengl/,
  );
});

test('every mask type stays in 0..1 and repeats with period one', () => {
  const masks = [
    { type: 'constant', value: 0.25 },
    { type: 'fbm', frequency: [4, 2], octaves: 3, seed: 5, range: [0.3, 0.7] },
    { type: 'cells', frequency: 5, mode: 'distance' },
    { type: 'cells', frequency: [3, 7], mode: 'edge', range: [0.4, 0.1] },
    { type: 'cells', frequency: 4, mode: 'id' },
    { type: 'stripes', axis: 'u', count: 10 },
    { type: 'stripes', axis: 'v', count: 6, profile: 'square', duty: 0.3 },
    { type: 'bricks', columns: 4, rows: 8, mortar: 0.08 },
  ];
  for (const mask of masks)
    for (let i = 0; i < 300; i++) {
      const u = (i * 0.754877) % 1,
        v = (i * 0.56984) % 1,
        value = evaluateZhudaTextureMask(mask, u, v, 13);
      assert.ok(value >= 0 && value <= 1, `${mask.type} out of range: ${value}`);
      assert.ok(
        near(value, evaluateZhudaTextureMask(mask, u + 1, v, 13), 1e-9) &&
          near(value, evaluateZhudaTextureMask(mask, u, v + 1, 13), 1e-9),
        `${mask.type}/${mask.mode ?? mask.profile ?? ''} does not tile`,
      );
    }
  assert.equal(evaluateZhudaTextureMask({ type: 'constant' }, 0.2, 0.9), 1);
});

test('baking is deterministic, seam-free and follows the Laya texture contract', () => {
  const a = bakeZhudaTextureSet(paintedSteel, { size: 64 }),
    b = bakeZhudaTextureSet(paintedSteel, { size: 64 });
  assert.equal(a.size, 64);
  assert.equal(a.bytes, 64 * 64 * 12);
  assert.deepEqual(a.tileMeters, [0.762, 2.286]);
  assert.equal(fingerprintZhudaTextureSet(a), fingerprintZhudaTextureSet(b));
  assert.match(fingerprintZhudaTextureSet(a), /^[0-9a-f]{8}$/);
  assert.notEqual(
    fingerprintZhudaTextureSet(a),
    fingerprintZhudaTextureSet(bakeZhudaTextureSet({ ...paintedSteel, seed: 8 }, { size: 64 })),
    'the recipe seed changes the result',
  );
  for (let i = 3; i < a.albedo.length; i += 4) {
    assert.equal(a.albedo[i], 255);
    assert.equal(a.normal[i], 255);
  }
  // Normals are unit length and never point into the surface.
  for (let o = 0; o < a.normal.length; o += 4) {
    const n = [a.normal[o], a.normal[o + 1], a.normal[o + 2]].map((c) => (c / 255) * 2 - 1);
    assert.ok(n[2] > 0);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 0.03);
  }
  // Seam: the jump across the wrap is no larger than the largest jump inside the tile.
  const size = a.size,
    jump = (x0, x1, row) => Math.abs(a.height[row * size + x0] - a.height[row * size + x1]);
  let inside = 0,
    seam = 0;
  for (let row = 0; row < size; row++) {
    for (let x = 0; x < size - 1; x++) inside = Math.max(inside, jump(x, x + 1, row));
    seam = Math.max(seam, jump(size - 1, 0, row));
  }
  assert.ok(seam <= inside * 1.001, `seam ${seam} vs inside ${inside}`);
});

test('a known slope gives the documented normal direction and channel packing', () => {
  // One sine ridge across u: height rises on the first half of the tile.
  const ridge = {
    schemaVersion: 1,
    id: 'ridge',
    tileMeters: [1, 1],
    base: { color: [0.5, 0.5, 0.5], roughness: 0.25, metallic: 1 },
    layers: [{ mask: { type: 'stripes', axis: 'u', count: 1 }, heightMm: 100 }],
  };
  const gl = bakeZhudaTextureSet(ridge, { size: 32, normalConvention: 'opengl' }),
    dx = bakeZhudaTextureSet(ridge, { size: 32 });
  const at = (set, x, y) => (y * 32 + x) * 4;
  // Rising along +u tilts the normal toward -u; no change along v keeps green neutral.
  assert.ok(gl.normal[at(gl, 8, 16)] < 110, 'red below neutral on the rising side');
  assert.ok(gl.normal[at(gl, 24, 16)] > 146, 'red above neutral on the falling side');
  assert.ok(Math.abs(gl.normal[at(gl, 8, 16) + 1] - 128) <= 1);
  assert.equal(dx.normalConvention, 'directx');
  // Laya packing: R = metallic, A = smoothness = 1 - roughness.
  assert.equal(dx.metallicGloss[0], 255);
  assert.equal(dx.metallicGloss[3], 191);
  // Linear 0.5 encodes to sRGB 188.
  assert.equal(dx.albedo[0], 188);

  // Convention flip: a ridge across v changes green in opposite directions.
  const acrossV = {
    ...ridge,
    id: 'ridge-v',
    layers: [{ mask: { type: 'stripes', axis: 'v', count: 1 }, heightMm: 100 }],
  };
  const glV = bakeZhudaTextureSet(acrossV, { size: 32, normalConvention: 'opengl' }),
    dxV = bakeZhudaTextureSet(acrossV, { size: 32, normalConvention: 'directx' });
  const o = (8 * 32 + 16) * 4 + 1;
  assert.ok(glV.normal[o] < 110 && dxV.normal[o] > 146);
  assert.equal(glV.normal[o] + dxV.normal[o], 255);
});

test('boxes have metre UVs, exact bounds, optional bevels and engine winding', () => {
  const box = createZhudaBoxMesh({ width: 6.06, height: 2.59, depth: 2.44, origin: 'bottom' });
  assert.equal(box.positions.length / 3, 24);
  assert.equal(box.indices.length, 36);
  assertWinding(box, 'box');
  const bounds = computeZhudaMeshBounds(box);
  for (const [value, expected] of [
    [bounds.min[0], -3.03],
    [bounds.max[0], 3.03],
    [bounds.min[1], 0],
    [bounds.max[1], 2.59],
    [bounds.min[2], -1.22],
    [bounds.max[2], 1.22],
  ])
    assert.ok(near(value, expected, 1e-5));
  assert.ok(near(Math.max(...box.uvs), 6.06, 1e-5), 'UVs are metres');

  const bevel = createZhudaBoxMesh({ width: 1, height: 1, depth: 1, bevel: 0.05 });
  assert.equal(bevel.indices.length / 3, 12 + 24 + 8);
  assertWinding(bevel, 'bevel box');
  const bb = computeZhudaMeshBounds(bevel);
  assert.ok(near(bb.min[0], -0.5, 1e-6) && near(bb.max[1], 0.5, 1e-6));
  for (let i = 0; i < bevel.normals.length; i += 3)
    assert.ok(
      near(Math.hypot(bevel.normals[i], bevel.normals[i + 1], bevel.normals[i + 2]), 1, 1e-5),
    );

  assert.throws(() => createZhudaBoxMesh({ width: 0, height: 1, depth: 1 }), /width/);
  assert.throws(() => createZhudaBoxMesh({ width: 1, height: 1, depth: 1, bevel: 0.5 }), /bevel/);
  assert.throws(
    () => createZhudaBoxMesh({ width: 1, height: 1, depth: 1, origin: 'top' }),
    /origin/,
  );
});

test('tubes, rods and I-beams are closed, correctly wound and sized', () => {
  const tube = createZhudaTubeMesh({
    path: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 2, 0],
      [2, 2, 1],
    ],
    radius: 0.05,
    radialSegments: 6,
  });
  assertWinding(tube, 'tube');
  assert.equal(tube.indices.length / 3, 3 * 6 * 2 + 2 * 6);
  for (let i = 0; i < tube.normals.length; i += 3)
    assert.ok(near(Math.hypot(tube.normals[i], tube.normals[i + 1], tube.normals[i + 2]), 1, 1e-5));

  const rod = createZhudaRodMesh([0, 0, 0], [0, 0, 2], 0.1, 8);
  assertWinding(rod, 'rod');
  const rb = computeZhudaMeshBounds(rod);
  assert.ok(near(rb.min[2], 0, 1e-6) && near(rb.max[2], 2, 1e-6) && near(rb.max[0], 0.1, 1e-6));

  for (const axis of ['x', 'y', 'z']) {
    const beam = createZhudaIBeamMesh({
      length: 4,
      depth: 0.4,
      width: 0.2,
      flangeThickness: 0.02,
      webThickness: 0.012,
      axis,
    });
    assertWinding(beam, `i-beam ${axis}`);
    const b = computeZhudaMeshBounds(beam),
      index = { x: 0, y: 1, z: 2 }[axis];
    assert.ok(near(b.max[index] - b.min[index], 4, 1e-5), `beam runs along ${axis}`);
  }
  assert.throws(() => createZhudaTubeMesh({ path: [[0, 0, 0]], radius: 1 }), /points/);
  assert.throws(
    () =>
      createZhudaTubeMesh({
        path: [
          [0, 0, 0],
          [0, 0, 0],
        ],
        radius: 1,
      }),
    /Degenerate/,
  );
  assert.throws(
    () =>
      createZhudaIBeamMesh({
        length: 1,
        depth: 0.1,
        width: 0.1,
        flangeThickness: 0.06,
        webThickness: 0.01,
      }),
    /flangeThickness/,
  );
});

test('transform keeps winding and merge keeps every triangle within the vertex limit', () => {
  const box = createZhudaBoxMesh({ width: 2, height: 1, depth: 1 });
  const moved = transformZhudaMesh(box, { position: [10, 0, -3], yawDeg: 90, scale: 2 });
  assertWinding(moved, 'transformed box');
  const b = computeZhudaMeshBounds(moved);
  // Yaw 90 swaps the 4 m width onto Z.
  assert.ok(near(b.max[2] - b.min[2], 4, 1e-5) && near(b.max[0] - b.min[0], 2, 1e-5));
  assert.ok(near((b.max[0] + b.min[0]) / 2, 10, 1e-5) && near((b.max[2] + b.min[2]) / 2, -3, 1e-5));
  assert.notEqual(moved.positions, box.positions, 'transform returns a copy');
  assert.throws(() => transformZhudaMesh(box, { scale: -1 }), /scale/);

  const parts = Array.from({ length: 10 }, (_, i) =>
    transformZhudaMesh(box, { position: [i * 3, 0, 0] }),
  );
  const one = mergeZhudaMeshes(parts);
  assert.equal(one.length, 1);
  assert.equal(one[0].positions.length / 3, 240);
  assert.equal(one[0].indices.length, 360);
  assertWinding(one[0], 'merged');
  const split = mergeZhudaMeshes(parts, 60);
  assert.equal(split.length, 5);
  assert.equal(
    split.reduce((sum, mesh) => sum + mesh.indices.length, 0),
    360,
  );
  for (const mesh of split) assert.ok(Math.max(...mesh.indices) < mesh.positions.length / 3);
  assert.throws(() => mergeZhudaMeshes(parts, 10), /exceeds maxVertices/);
});

function containerProp() {
  return {
    id: 'container20',
    size: [6.06, 2.59, 2.44],
    defaults: { paint: 'paint_red', dented: false },
    build(params, random) {
      return {
        parts: [
          {
            name: 'body',
            material: params.paint,
            mesh: createZhudaBoxMesh({
              width: 6.06,
              height: 2.59,
              depth: 2.44,
              origin: 'bottom',
              bevel: 0.03,
            }),
          },
          {
            name: 'lock-bar',
            material: 'steel_galv',
            mesh: createZhudaRodMesh(
              [3.04, 0.2, random.range(-0.6, -0.4)],
              [3.04, 2.4, -0.5],
              0.02,
              6,
            ),
          },
        ],
        colliders: [{ min: [-3.03, 0, -1.22], max: [3.03, 2.59, 1.22], surface: 'metal' }],
        sockets: { roof: [0, 2.59, 0] },
      };
    },
  };
}

test('prop registry builds reproducible props and rejects mis-sized or malformed ones', () => {
  const props = new ZhudaPropRegistry().register(containerProp());
  assert.deepEqual(props.ids(), ['container20']);
  assert.deepEqual(props.sizeOf('container20'), [6.06, 2.59, 2.44]);
  const a = props.build('container20', { seed: 3 }),
    b = props.build('container20', { seed: 3 }),
    c = props.build('container20', { seed: 4 });
  assert.deepEqual([...a.parts[1].mesh.positions], [...b.parts[1].mesh.positions]);
  assert.notDeepEqual([...a.parts[1].mesh.positions], [...c.parts[1].mesh.positions]);
  assert.equal(
    props.build('container20', { params: { paint: 'paint_blue' } }).parts[0].material,
    'paint_blue',
  );
  assert.throws(
    () => props.build('container20', { params: { colour: 'x' } }),
    /unknown parameter colour/,
  );
  assert.throws(() => props.build('crate'), /Unknown prop: crate. Registered: container20/);
  assert.throws(() => props.register(containerProp()), /Duplicate prop id/);
  assert.throws(
    () => new ZhudaPropRegistry().register({ ...containerProp(), id: 'Bad Id' }),
    /Prop id/,
  );

  const oversized = new ZhudaPropRegistry().register({
    ...containerProp(),
    id: 'wrong-scale',
    size: [0.6, 0.26, 0.24],
  });
  assert.throws(
    () => oversized.build('wrong-scale'),
    /leaves the declared 0.6 x 0.26 x 0.24 m size/,
  );
  const noSurface = new ZhudaPropRegistry().register({
    ...containerProp(),
    id: 'no-surface',
    build: () => ({
      ...containerProp().build({ paint: 'p' }, createZhudaRandom(1)),
      colliders: [{ min: [0, 0, 0], max: [1, 1, 1] }],
    }),
  });
  assert.throws(() => noSurface.build('no-surface'), /surface tag/);
});

test('placement moves parts, sockets and colliders; oblique boxes are sliced', () => {
  const props = new ZhudaPropRegistry().register(containerProp());
  const straight = props.place('container20', { position: [10, 0, 5], yawDeg: 90 });
  assert.equal(straight.instance, 'container20#0');
  assert.equal(straight.colliders.length, 1);
  const box = straight.colliders[0];
  // Yaw 90: the 6.06 m length now lies along Z.
  assert.ok(near(box.max[2] - box.min[2], 6.06, 1e-6) && near(box.max[0] - box.min[0], 2.44, 1e-6));
  assert.ok(near(box.min[1], 0) && near(box.max[1], 2.59, 1e-6) && box.surface === 'metal');
  assert.ok(near(straight.sockets.roof[0], 10) && near(straight.sockets.roof[1], 2.59, 1e-6));
  const world = computeZhudaMeshBounds(straight.parts[0].mesh);
  assert.ok(
    near((world.min[0] + world.max[0]) / 2, 10, 1e-4) &&
      near((world.min[2] + world.max[2]) / 2, 5, 1e-4),
  );

  const oblique = rotateZhudaCollider(
    { min: [-3, 0, -1], max: [3, 2, 1], surface: 'metal' },
    30,
    [0, 0, 0],
  );
  assert.equal(oblique.length, 3, 'a 6 x 2 box at 30 degrees becomes three slices');
  const area = (c) => (c.max[0] - c.min[0]) * (c.max[2] - c.min[2]);
  const single = rotateZhudaCollider(
    { min: [-3, 0, -1], max: [3, 2, 1], surface: 'metal' },
    30,
    [0, 0, 0],
  ).reduce((sum, c) => sum + area(c), 0);
  // One bounding box of the same rotated footprint would cover far more ground.
  const c = Math.cos(Math.PI / 6),
    s = Math.sin(Math.PI / 6),
    loose = (6 * c + 2 * s) * (6 * s + 2 * c);
  assert.ok(single < loose * 0.8, `sliced area ${single} vs single box ${loose}`);
  assert.equal(
    props.place('container20', { position: [0, 0, 0], instance: 'gate-left' }).instance,
    'gate-left',
  );
  assert.throws(() => props.place('container20', { position: [0, 0] }), /position required/);
});

test('merging placed props batches by material', () => {
  const props = new ZhudaPropRegistry().register(containerProp());
  const placed = [];
  for (let i = 0; i < 12; i++)
    placed.push(
      props.place('container20', {
        position: [i * 7, 0, 0],
        seed: i,
        params: { paint: i % 2 ? 'paint_red' : 'paint_blue' },
      }),
    );
  const batches = mergeZhudaPlacedProps(placed);
  assert.deepEqual(
    batches.map((batch) => batch.material),
    ['paint_blue', 'paint_red', 'steel_galv'],
  );
  // 24 source parts collapse into one mesh per material.
  assert.deepEqual(
    batches.map((batch) => batch.meshes.length),
    [1, 1, 1],
  );
  assert.equal(batches[0].triangles, 6 * 44);
  for (const batch of batches) for (const mesh of batch.meshes) assertWinding(mesh, batch.material);
});

test('renderer hand-off binds baked maps and merged meshes through the existing Laya adapters', (t) => {
  const destroyed = [];
  class Texture2D {
    constructor(width, height, format, mipmap, canRead, sRGB) {
      Object.assign(this, { width, height, format, mipmap, canRead, sRGB });
    }
    setPixelsData(pixels) {
      this.pixels = pixels;
    }
    destroy() {
      destroyed.push('texture');
    }
  }
  class PBRStandardMaterial {
    destroy() {
      destroyed.push('material');
    }
  }
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  const created = [];
  globalThis.Laya = {
    Texture2D,
    PBRStandardMaterial,
    UnlitMaterial: class {},
    TextureFormat: { R8G8B8A8: 'rgba8' },
    Color: class {
      constructor(...rgba) {
        this.rgba = rgba;
      }
    },
    Vector4: class {
      constructor(...v) {
        this.v = v;
      }
    },
    Vector3,
    Bounds: class {
      constructor(min, max) {
        Object.assign(this, { min, max });
      }
    },
    RenderState: {},
    PrimitiveMesh: {
      _createMesh(declaration, vertices, indices) {
        const mesh = { declaration, vertices, indices, destroy: () => destroyed.push('mesh') };
        created.push(mesh);
        return mesh;
      },
    },
    VertexMesh: { getVertexDeclaration: (layout) => layout },
    MeshSprite3D: class {
      constructor(mesh) {
        this.mesh = mesh;
        this.meshRenderer = {};
      }
      destroy() {
        destroyed.push('node');
      }
    },
  };
  t.after(() => delete globalThis.Laya);

  const set = bakeZhudaTextureSet(paintedSteel, { size: 32 });
  const surface = createZhudaProceduralMaterial(set, { tint: [0.2, 0.4, 1, 1] });
  assert.equal(surface.textures.length, 3);
  assert.deepEqual(
    surface.textures.map((texture) => [texture.width, texture.mipmap, texture.sRGB]),
    [
      [32, true, true],
      [32, true, false],
      [32, true, false],
    ],
  );
  assert.equal(surface.material.albedoTexture, surface.textures[0]);
  assert.equal(surface.material.normalTexture, surface.textures[1]);
  assert.equal(surface.material.metallicGlossTexture, surface.textures[2]);
  assert.equal(surface.material.smoothness, 1, 'the gloss map is not scaled down');
  assert.deepEqual(surface.material.albedoColor.rgba, [0.2, 0.4, 1, 1]);
  assert.ok(
    near(surface.material.tilingOffset.v[0], 1 / 0.762) &&
      near(surface.material.tilingOffset.v[1], 1 / 2.286),
  );
  assert.equal(
    createZhudaProceduralMaterial(set, { uvUnit: 'tile', mipmap: false }).textures[0].mipmap,
    false,
  );
  assert.throws(
    () =>
      createZhudaProceduralMaterial(
        bakeZhudaTextureSet(paintedSteel, { size: 32, normalConvention: 'opengl' }),
      ),
    /directx/,
  );
  destroyed.length = 0;
  surface.dispose();
  surface.dispose();
  assert.deepEqual(destroyed, ['material', 'texture', 'texture', 'texture']);

  const props = new ZhudaPropRegistry().register(containerProp());
  const batches = mergeZhudaPlacedProps([
    props.place('container20', { position: [0, 0, 0] }),
    props.place('container20', { position: [8, 0, 0] }),
  ]);
  const materials = { paint_red: { name: 'red' }, steel_galv: { name: 'galv' } };
  const scene = instantiateZhudaPropBatches(batches, (name) => materials[name]);
  assert.equal(scene.meshes.length, 2);
  assert.deepEqual(
    scene.meshes.map((mesh) => mesh.node.meshRenderer.sharedMaterial.name),
    ['red', 'galv'],
  );
  // Baked materials are normal-mapped, so every batch mesh needs a tangent frame;
  // without TANGENT the normal map has no effect on a real GPU.
  assert.equal(created[0].declaration, 'POSITION,NORMAL,UV,TANGENT');
  assert.ok(scene.meshes.every((mesh) => mesh.stride === 12 && mesh.data.tangents?.length));
  destroyed.length = 0;
  assert.throws(
    () => instantiateZhudaPropBatches(batches, (name) => (name === 'paint_red' ? {} : null)),
    /No material resolved for steel_galv/,
  );
  assert.deepEqual(
    destroyed,
    ['node', 'mesh'],
    'a failed hand-off releases what it already created',
  );
  scene.dispose();
});

const impact = {
  schemaVersion: 1,
  id: 'metal-impact',
  durationSec: 0.25,
  sampleRate: 22050,
  seed: 5,
  layers: [
    { type: 'noise', color: 'white', gain: 1, envelope: { releaseSec: 0.04 }, highpassHz: 1200 },
    {
      type: 'tone',
      wave: 'sine',
      frequencyHz: 880,
      endFrequencyHz: 640,
      gain: 0.6,
      envelope: { attackSec: 0.002, releaseSec: 0.2 },
    },
    {
      type: 'noise',
      color: 'brown',
      gain: 0.3,
      envelope: { releaseSec: 0.1 },
      lowpassHz: 400,
      startSec: 0.01,
    },
  ],
};

test('synth recipes render deterministic, normalised audio and a valid WAV', () => {
  assert.deepEqual(validateZhudaSynthRecipe(impact), []);
  const a = renderZhudaSynth(impact),
    b = renderZhudaSynth(impact);
  assert.equal(a.sampleRate, 22050);
  assert.equal(a.samples.length, Math.round(0.25 * 22050));
  assert.deepEqual([...a.samples.subarray(0, 512)], [...b.samples.subarray(0, 512)]);
  let peak = 0;
  for (const sample of a.samples) peak = Math.max(peak, Math.abs(sample));
  assert.ok(near(peak, 0.9, 1e-6), `peak ${peak}`);
  assert.ok(Math.abs(a.samples[a.samples.length - 1]) < 0.05, 'the tail has decayed');
  assert.notDeepEqual(
    [...a.samples.subarray(0, 64)],
    [...renderZhudaSynth({ ...impact, seed: 6 }).samples.subarray(0, 64)],
  );

  const wav = renderZhudaSynthWav(impact),
    view = new DataView(wav.buffer),
    tag = (offset) => String.fromCharCode(...wav.subarray(offset, offset + 4));
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(tag(36), 'data');
  assert.equal(view.getUint16(20, true), 1, 'PCM');
  assert.equal(view.getUint16(22, true), 1, 'mono');
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), a.samples.length * 2);
  assert.equal(wav.length, 44 + a.samples.length * 2);
  assert.equal(view.getUint32(4, true), wav.length - 8);

  const issues = validateZhudaSynthRecipe({
    schemaVersion: 1,
    id: 'bad',
    durationSec: 60,
    sampleRate: 12345,
    layers: [
      { type: 'tone', frequencyHz: 5, gain: 9, envelope: {} },
      { type: 'hum', gain: 1, envelope: { releaseSec: 1 } },
    ],
  });
  for (const expected of [
    'durationSec',
    'sampleRate',
    'layers[0].gain',
    'layers[0].envelope.releaseSec',
    'layers[0].frequencyHz',
    'layers[1].type',
  ])
    assert.ok(
      issues.some((issue) => issue.startsWith(expected)),
      `missing ${expected}`,
    );
  assert.throws(() => renderZhudaSynth({ ...impact, layers: [] }), /Invalid synth recipe: layers/);
});

test('procedural provider serves generated bytes, honours limits and delegates the rest', async () => {
  const calls = [];
  const fallback = {
    name: 'files',
    async load(id) {
      calls.push(id);
      return { id, bytes: new Uint8Array([9]) };
    },
  };
  const provider = new ProceduralAssetProvider({ fallback, maxBytes: 100_000 });
  provider.register('audio/impact.wav', () => renderZhudaSynthWav(impact), 'audio');
  provider.register('big.bin', () => new Uint8Array(200_000));
  provider.register('bad.bin', () => 'not bytes');
  assert.equal(provider.has('./audio/impact.wav'), true);
  assert.throws(() => provider.register('audio/impact.wav', () => new Uint8Array(1)), /Duplicate/);
  assert.throws(() => provider.register('../escape', () => new Uint8Array(1)), /Invalid asset id/);

  const phases = [];
  const loaded = await provider.load('audio/impact.wav', {
    onProgress: (p) => phases.push(p.phase),
  });
  assert.equal(loaded.id, 'audio/impact.wav');
  assert.equal(loaded.manifest.kind, 'audio');
  assert.equal(loaded.manifest.bytes, loaded.bytes.byteLength);
  assert.deepEqual(phases, ['downloading', 'ready']);
  assert.deepEqual(
    (await provider.getManifest()).entries.map((entry) => entry.id),
    ['audio/impact.wav', 'bad.bin', 'big.bin'],
  );

  await assert.rejects(
    provider.load('big.bin'),
    (error) => error instanceof AssetProviderError && error.code === 'too-large',
  );
  await assert.rejects(provider.load('bad.bin'), (error) => error.code === 'integrity');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    provider.load('audio/impact.wav', { signal: controller.signal }),
    (error) => error.code === 'aborted',
  );

  assert.deepEqual([...(await provider.load('textures/logo.png')).bytes], [9]);
  assert.deepEqual(calls, ['textures/logo.png']);
  await assert.rejects(
    new ProceduralAssetProvider().load('missing.bin'),
    (error) => error.code === 'http' && error.status === 404,
  );
  provider.dispose();
  await assert.rejects(provider.load('audio/impact.wav'), (error) => error.code === 'disposed');
});

test('run parameters and module boot give isolated showcases and stub fallbacks', async () => {
  assert.deepEqual(parseZhudaRunParams(''), {
    seed: 1,
    show: undefined,
    fixedDt: undefined,
    shot: false,
    bench: false,
    raw: {},
  });
  const params = parseZhudaRunParams('?seed=4207&show=mats&dt=0.016&shot=1', '#bench');
  assert.equal(params.seed, 4207);
  assert.equal(params.show, 'mats');
  assert.equal(params.fixedDt, 0.016);
  assert.equal(params.shot, true);
  assert.equal(params.bench, true);
  assert.throws(() => parseZhudaRunParams('?seed=-1'), /seed/);
  assert.throws(() => parseZhudaRunParams('?dt=0'), /dt/);

  const order = [];
  const modules = {
    render: { required: true, create: () => (order.push('render'), { ok: true }) },
    mats: {
      create: (ctx) => (order.push('mats'), { uses: ctx.render }),
      showcase: (ctx) => ({ camera: [0, 1, 2], sawMats: !!ctx.mats }),
    },
    audio: {
      create: () => {
        throw Error('no device');
      },
      stub: () => ({ stub: true }),
    },
    level: { create: () => (order.push('level'), 'level'), showcase: () => 'level-view' },
  };
  const full = {};
  const report = await bootZhudaModules(full, modules);
  assert.deepEqual(report.modules, {
    render: 'ready',
    mats: 'ready',
    audio: 'stub',
    level: 'ready',
  });
  assert.deepEqual(report.errors, [{ module: 'audio', message: 'no device' }]);
  assert.deepEqual(full.audio, { stub: true });
  assert.equal(full.mats.uses, full.render);
  assert.deepEqual(order, ['render', 'mats', 'level']);
  assert.ok(Object.values(report.ms).every((ms) => ms >= 0));

  const isolated = {};
  const shown = await bootZhudaModules(isolated, modules, { show: 'mats' });
  assert.deepEqual(shown.modules, {
    render: 'ready',
    mats: 'ready',
    audio: 'skipped',
    level: 'skipped',
  });
  assert.equal(shown.showcase, 'mats');
  assert.deepEqual(shown.showcaseResult, { camera: [0, 1, 2], sawMats: true });
  assert.equal('level' in isolated, false);

  await assert.rejects(
    bootZhudaModules({}, modules, { show: 'audio' }),
    /Unknown showcase "audio". Available: mats, level/,
  );
  await assert.rejects(
    bootZhudaModules(
      {},
      {
        render: {
          create: () => {
            throw Error('lost context');
          },
        },
      },
    ),
    /Module "render" failed and has no stub: lost context/,
  );
});
