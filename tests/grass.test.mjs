// A field of grass: options, the blades of a patch, thinning with distance,
// the meshes and the turf; the back-face rule of the lit material it uses.
// Pure checks; the draw is verify:grass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_GRASS_BLADE_FLOATS,
  ZHUDA_GRASS_BANDS,
  ZHUDA_GRASS_TURF_LIFT_M,
  ZhudaGrassField,
  resolveZhudaGrass,
  validateZhudaGrass,
  zhudaGrassBands,
  zhudaGrassMeshes,
  zhudaGrassPatchBlades,
  zhudaGrassPatchClumps,
  zhudaGrassShown,
  zhudaGrassTurf,
} from '../packages/core/runtime3d/Grass.ts';
import {
  ZhudaLitSurfaceMaterial,
  buildZhudaLitVertexShaders,
} from '../packages/core/shaders/LitSurfaceMaterial.ts';

const AREA = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
const flat = () => 0;
const F = ZHUDA_GRASS_BLADE_FLOATS;

test('grass has defaults and refuses what cannot be grown', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat });
  assert.deepEqual(resolved, {
    area: AREA,
    density: 400,
    heightM: [0.14, 0.34],
    widthM: 0.03,
    distanceM: 60,
    fullDensityM: 5,
    patchM: 6,
    tip: [0.46, 0.6, 0.22],
    root: [0.1, 0.19, 0.06],
    dry: [0.66, 0.62, 0.3],
    dryness: 0.3,
    wind: { directionDeg: 30, strength: 0.35, speed: 1 },
    seed: 1,
    turf: true,
  });
  assert.equal(resolveZhudaGrass({ area: AREA, ground: flat, distanceM: 36 }).fullDensityM, 3);
  assert.deepEqual(validateZhudaGrass({ area: AREA, ground: flat }), []);
  const bad = validateZhudaGrass({
    area: { minX: 0, maxX: 0, minZ: 0, maxZ: 1 },
    ground: 0,
    grows: 1,
    density: 5,
    heightM: [0.3, 0.1],
    widthM: 1,
    distanceM: 5,
    fullDensityM: 100,
    patchM: 1,
    tip: [2, 0, 0],
    dryness: 2,
    wind: { strength: 3, speed: -1, directionDeg: NaN },
    seed: 1.5,
    turf: 'yes',
  });
  for (const field of [
    'area',
    'ground',
    'grows',
    'density',
    'heightM',
    'widthM',
    'distanceM',
    'fullDensityM',
    'patchM',
    'tip',
    'dryness',
    'wind.strength',
    'wind.speed',
    'wind.directionDeg',
    'seed',
    'turf',
  ])
    assert.ok(
      bad.some((line) => line.startsWith('grass.' + field)),
      field + ' is refused: ' + bad.join(' | '),
    );
  assert.throws(
    () => resolveZhudaGrass({ area: AREA, ground: flat, density: 5 }),
    /grass\.density/,
  );
  assert.deepEqual(validateZhudaGrass(null), ['grass: options must be an object']);
});

test('fewer blades are shown far from the eye, and a mesh holds all that are', () => {
  assert.equal(zhudaGrassShown(0, 5, 60), 1);
  assert.equal(zhudaGrassShown(5, 5, 60), 1);
  assert.ok(Math.abs(zhudaGrassShown(20, 5, 60) - 0.125) < 1e-9);
  assert.equal(zhudaGrassShown(60, 5, 60), 0);
  assert.equal(zhudaGrassShown(NaN, 5, 60), 0);
  let before = 1;
  const all = ZHUDA_GRASS_BANDS.length;
  for (let d = 0; d < 60; d += 0.5) {
    const shown = zhudaGrassShown(d, 5, 60);
    assert.ok(shown <= before && shown > 0, 'falls steadily at ' + d);
    before = shown;
    const bands = zhudaGrassBands(d, 5, 60);
    // The meshes in use hold every blade drawn at that distance, and the
    // last of them is needed.
    assert.ok(ZHUDA_GRASS_BANDS[bands - 1].to >= shown, `${bands} meshes are enough at ${d}`);
    if (bands > 1)
      assert.ok(ZHUDA_GRASS_BANDS[bands - 1].from < shown, `and none too many at ${d}`);
  }
  assert.equal(zhudaGrassBands(0, 5, 60), all);
  assert.equal(zhudaGrassBands(59, 5, 60), 1);
  assert.equal(zhudaGrassBands(61, 5, 60), 0);
  assert.equal(zhudaGrassBands(NaN, 5, 60), 0);
  // The bands take every rank once.
  assert.equal(ZHUDA_GRASS_BANDS[0].from, 0);
  assert.equal(ZHUDA_GRASS_BANDS[all - 1].to, 1);
  for (let i = 1; i < all; i++)
    assert.equal(ZHUDA_GRASS_BANDS[i].from, ZHUDA_GRASS_BANDS[i - 1].to);
});

test('a patch grows the same blades every time, inside its square, on the ground', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat, density: 100 });
  const hill = (x, z) => 2 + 0.1 * x - 0.05 * z;
  const a = zhudaGrassPatchBlades(resolved, hill, undefined, 1, -2);
  const b = zhudaGrassPatchBlades(resolved, hill, undefined, 1, -2);
  assert.deepEqual(a, b);
  const count = a.length / F;
  // About the density asked for: 100 a square metre on 36.
  assert.ok(count > 3600 * 0.7 && count < 3600 * 1.4, 'blades: ' + count);
  for (let i = 0; i < a.length; i += F) {
    const [x, y, z, height, , lean, rank] = a.subarray(i, i + F);
    // A clump reaches a little past the edge of its patch.
    assert.ok(x > 6 - 0.4 && x < 12 + 0.4 && z > -12 - 0.4 && z < -6 + 0.4, `inside (${x}, ${z})`);
    assert.ok(Math.abs(y - hill(x, z)) < 1e-4, `on the slope (${y} at ${x}, ${z})`);
    assert.ok(height >= 0.02 && height <= 1 && lean >= 0 && lean <= 1 && rank >= 0 && rank < 1);
  }
  // Another patch, another seed: other blades.
  assert.notDeepEqual(zhudaGrassPatchBlades(resolved, hill, undefined, 2, -2), a);
  assert.notDeepEqual(
    zhudaGrassPatchBlades({ ...resolved, seed: 2 }, hill, undefined, 1, -2).slice(0, 70),
    a.slice(0, 70),
  );
});

test('the bands of a patch give every blade once', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat, density: 100 });
  const all = zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0);
  let total = 0;
  for (const { from, to } of ZHUDA_GRASS_BANDS) {
    const some = zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0, [from, to]);
    const expected = [];
    for (let i = 0; i < all.length; i += F)
      if (all[i + 6] >= from && all[i + 6] < to) expected.push(...all.subarray(i, i + F));
    assert.deepEqual([...some], expected, `ranks ${from}..${to}`);
    const part = some.length / all.length;
    assert.ok(Math.abs(part - (to - from)) < 0.05, `ranks ${from}..${to} keep ${part}`);
    total += some.length;
  }
  assert.equal(total, all.length);
});

test('a patch made in slices is the patch made at once', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat, density: 100 });
  const clumps = zhudaGrassPatchClumps(resolved);
  assert.equal(clumps, Math.round((100 * 36) / 7));
  for (const ranks of [
    [0, 1],
    [0.12, 0.25],
  ]) {
    const whole = zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0, ranks);
    const parts = [];
    for (let first = 0; first < clumps; first += 200)
      parts.push(
        ...zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0, ranks, [first, first + 200]),
      );
    assert.deepEqual(parts, [...whole], 'ranks ' + ranks);
  }
  assert.equal(
    zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0, [0, 1], [clumps, clumps + 9]).length,
    0,
  );
});

test('nothing grows where the game says no, and the grass beside it is the same', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat, density: 100 });
  const open = zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0);
  const road = (x) => x < 2 || x > 4;
  const cut = zhudaGrassPatchBlades(resolved, flat, road, 0, 0);
  assert.ok(cut.length < open.length);
  const far = (blades) => {
    const kept = [];
    for (let i = 0; i < blades.length; i += F)
      if (blades[i] < 1.5 || blades[i] > 4.5) kept.push(...blades.subarray(i, i + F));
    return kept;
  };
  assert.deepEqual(far(cut), far(open), 'blades away from the road are untouched');
  // A clump is asked once, at its middle: no clump stands on the road.
  for (let i = 0; i < cut.length; i += F)
    assert.ok(cut[i] < 2.4 || cut[i] > 3.6, 'a blade in the middle of the road at ' + cut[i]);
  // No ground, no grass; outside the area, none.
  assert.equal(zhudaGrassPatchBlades(resolved, () => null, undefined, 0, 0).length, 0);
  assert.equal(zhudaGrassPatchBlades(resolved, () => NaN, undefined, 0, 0).length, 0);
  assert.equal(zhudaGrassPatchBlades(resolved, flat, undefined, 40, 40).length, 0);
  // The ground is not asked about clumps that have no blade of the ranks wanted.
  let asked = 0;
  const counting = () => (asked++, 0);
  zhudaGrassPatchBlades(resolved, counting, undefined, 0, 0, [0, 0.06]);
  const few = asked;
  asked = 0;
  zhudaGrassPatchBlades(resolved, counting, undefined, 0, 0, [0, 1]);
  assert.ok(few < asked * 0.6, `a far patch asks less of the ground (${few} against ${asked})`);
});

test('meshes hold every blade given and stay under 65 535 vertices', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat, density: 400 });
  const blades = zhudaGrassPatchBlades(resolved, flat, undefined, 0, 0);
  const total = blades.length / F;
  for (const segments of [1, 2, 3]) {
    const meshes = zhudaGrassMeshes(blades, segments);
    let held = 0;
    for (const mesh of meshes) {
      const vertices = mesh.vertices.length / 8;
      assert.ok(vertices <= 65535);
      assert.equal(vertices, mesh.blades * (segments * 2 + 1));
      assert.equal(mesh.indices.length, mesh.blades * (segments * 2 - 1) * 3);
      assert.ok(mesh.indices.every((i) => i < vertices));
      assert.ok(mesh.vertices.every(Number.isFinite));
      for (let k = 0; k < 3; k++) assert.ok(mesh.min[k] <= mesh.max[k]);
      held += mesh.blades;
    }
    assert.equal(held, total);
    if (segments === 3) assert.ok(meshes.length > 1, 'a full patch needs more than one mesh');
  }
  assert.throws(() => zhudaGrassMeshes(blades, 0), /grass segments/);
  assert.deepEqual(zhudaGrassMeshes(new Float32Array(0), 3), []);
  // A vertex says what the vertex program needs to stand the blade up again.
  const one = new Float32Array([1, 2, 3, 0.25, 0, 0.6, 100 / 255]);
  const [mesh] = zhudaGrassMeshes(one, 3);
  assert.equal(mesh.vertices.length / 8, 7);
  const tip = mesh.vertices.subarray(6 * 8);
  // Faces +X, leans 0.6 of its 25 cm that way, stands 25 cm tall.
  assert.ok(Math.abs(tip[0] - (1 + 0.15)) < 1e-6 && Math.abs(tip[1] - 2.25) < 1e-6 && tip[2] === 3);
  assert.deepEqual([...tip.subarray(3, 6)], [1, 0, 0]);
  assert.equal(Math.floor(tip[6]), 100, 'rank');
  assert.equal(tip[6] - Math.floor(tip[6]), 0.5, 'the tip is in the middle of the blade');
  const both = Math.floor(tip[7]);
  assert.equal(both % 128, 25, 'height in centimetres');
  assert.equal(Math.floor(both / 128), 9, 'lean in fifteenths');
  assert.equal(tip[7] - both, 0.75, 'the tip is the end of the blade');
  const foot = mesh.vertices.subarray(0, 8);
  assert.deepEqual([foot[0], foot[1], foot[2]], [1, 2, 3]);
  assert.equal(foot[7] - Math.floor(foot[7]), 0.25);
});

test('turf lies on the ground where grass grows and stops where it does not', () => {
  const resolved = resolveZhudaGrass({ area: AREA, ground: flat, patchM: 6 });
  const hill = (x, z) => 0.2 * x + 0.1 * z;
  const turf = zhudaGrassTurf(resolved, hill, undefined, 0, 0);
  // 12 squares a side: 13 × 13 corners, two triangles a square.
  assert.equal(turf.vertices.length / 8, 169);
  assert.equal(turf.indices.length, 144 * 6);
  assert.equal(turf.blades, 0);
  for (let i = 0; i < turf.vertices.length; i += 8) {
    const [x, y, z, nx, ny, nz, cover, mark] = turf.vertices.subarray(i, i + 8);
    assert.ok(Math.abs(y - hill(x, z) - ZHUDA_GRASS_TURF_LIFT_M) < 1e-5);
    assert.deepEqual([nx, ny, nz, cover, mark], [0, 1, 0, 1, 0.25]);
  }
  // Each triangle faces up.
  for (let i = 0; i < turf.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => turf.vertices.subarray(turf.indices[i + k] * 8));
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    assert.ok(up > 0, 'triangle ' + i / 3);
  }
  // A road: squares with no growing corner are left out, the edge carries 0.
  const road = (x) => x < 2 || x > 4;
  const cut = zhudaGrassTurf(resolved, flat, road, 0, 0);
  assert.ok(cut.indices.length < turf.indices.length);
  const covers = new Set();
  for (let i = 0; i < cut.vertices.length; i += 8) covers.add(cut.vertices[i + 6]);
  assert.deepEqual([...covers].sort(), [0, 1]);
  for (let i = 0; i < cut.vertices.length; i += 8)
    assert.ok(
      cut.vertices[i] <= 2.5 || cut.vertices[i] >= 3.5,
      'no turf in the middle of the road',
    );
  // Nothing grows, or there is no ground: no turf.
  assert.equal(
    zhudaGrassTurf(resolved, flat, () => false, 0, 0),
    null,
  );
  assert.equal(
    zhudaGrassTurf(resolved, () => null, undefined, 0, 0),
    null,
  );
  // The far edge of the area: no turf past it.
  assert.equal(zhudaGrassTurf(resolved, flat, undefined, 6, 0), null);
});

// A stand-in for LayaAir: enough for a field to make and drop its meshes.
function fakeLaya() {
  const live = { meshes: 0, nodes: 0, materials: 0 };
  const shaders = new Map();
  class Vector {
    constructor(...v) {
      [this.x, this.y, this.z, this.w] = v;
    }
  }
  class Material {
    values = {};
    constructor() {
      live.materials++;
    }
    setShaderName() {}
    setVector2(k, v) {
      this.values[k] = v;
    }
    setVector3(k, v) {
      this.values[k] = v;
    }
    setVector4(k, v) {
      this.values[k] = v;
    }
    setFloat() {}
    setTexture() {}
    destroy() {
      live.materials--;
    }
  }
  const laya = {
    live,
    shaders,
    Vector2: Vector,
    Vector3: Vector,
    Vector4: Vector,
    Color: Vector,
    Bounds: class {
      constructor(min, max) {
        this.min = min;
        this.max = max;
      }
    },
    RenderState: { CULL_NONE: 0 },
    ShaderDataType: new Proxy({}, { get: (_, k) => k }),
    ShaderFeatureType: { D3: 1 },
    SubShader: class {
      static DefaultAttributeMap = {};
      passes = [];
      addShaderPass(vertex, fragment, mode) {
        this.passes.push({ vertex, fragment, mode });
      }
    },
    Shader3D: {
      find: (name) => shaders.get(name),
      add(name) {
        const shader = {
          subs: [],
          addSubShader(sub) {
            this.subs.push(sub);
          },
        };
        shaders.set(name, shader);
        return shader;
      },
    },
    PBRStandardMaterial: Material,
    UnlitMaterial: Material,
    PBRRenderMode: { Opaque: 0, Fade: 2 },
    VertexMesh: { getVertexDeclaration: (text) => text },
    PrimitiveMesh: {
      _createMesh(declaration, vertices, indices) {
        live.meshes++;
        return {
          declaration,
          vertices,
          indices,
          destroy() {
            live.meshes--;
          },
        };
      },
    },
    MeshSprite3D: class {
      constructor(mesh) {
        this.mesh = mesh;
        this.meshRenderer = {};
        live.nodes++;
      }
      destroy() {
        live.nodes--;
      }
    },
  };
  return laya;
}

test('a field makes the patches round the eye, a few at a time, and gives them back', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const children = [];
    const scene = { addChild: (node) => children.push(node) };
    const options = { area: AREA, ground: flat, density: 60, distanceM: 20, patchM: 4 };
    const field = new ZhudaGrassField(scene, options);
    assert.equal(laya.live.materials, 1);
    assert.deepEqual(field.stats, { patches: 0, blades: 0, vertices: 0, pending: 0 });
    // The first call makes the nearest patch at least, and says what is left.
    const left = field.update([0, 1.5, 0], 0, 1);
    assert.equal(field.stats.patches, 1);
    assert.ok(left > 10 && field.stats.pending === left);
    let calls = 1;
    while (field.update([0, 1.5, 0], 0, 2000) > 0) calls++;
    assert.ok(calls > 5, 'made over several calls: ' + calls);
    const full = field.stats;
    assert.equal(full.pending, 0);
    // Every patch within reach of the eye, none beyond.
    assert.ok(full.patches >= 80 && full.patches <= 150, 'patches: ' + full.patches);
    assert.equal(laya.live.nodes, laya.live.meshes);
    assert.ok(children.length >= laya.live.nodes, 'every node went into the scene');
    // Standing still makes nothing more.
    assert.equal(field.update([0, 1.5, 0], 1), 0);
    assert.deepEqual(field.stats, full);
    // The eye and the time reach the material.
    const eye = field['material'].material.values.u_ZhudaGrassEye;
    assert.deepEqual([eye.x, eye.y, eye.z, eye.w], [0, 1.5, 0, 1]);
    // At once makes what several calls made.
    const other = new ZhudaGrassField(scene, options);
    other.fill([0, 1.5, 0], 0);
    assert.deepEqual(other.stats, full);
    other.dispose();
    // Walking on drops what is left behind.
    field.fill([25, 1.5, 0], 0);
    const moved = field.stats;
    assert.ok(moved.patches < full.patches, 'near the edge of the land there are fewer patches');
    field.fill([0, 1.5, 0], 0);
    // Back again: the same patches; a few keep the fuller mesh they came with.
    const back = field.stats;
    assert.equal(back.patches, full.patches);
    assert.ok(
      back.blades >= full.blades && back.blades < full.blades * 1.05,
      `blades ${back.blades} against ${full.blades}`,
    );
    // The wind is changed in place and checked.
    field.setWind({ directionDeg: 90, strength: 1, speed: 2 });
    const wind = field['material'].material.values.u_ZhudaGrassWind;
    assert.ok(Math.abs(wind.x) < 1e-9 && Math.abs(wind.y - 1) < 1e-9 && wind.w === 2);
    assert.throws(() => field.setWind({ strength: 4 }), /wind\.strength/);
    assert.throws(() => field.update([0, NaN, 0], 0), /finite/);
    assert.throws(() => field.update([0, 0, 0], 0, 0), /blades >= 1/);
    field.dispose();
    field.dispose();
    assert.deepEqual(laya.live, { meshes: 0, nodes: 0, materials: 0 });
    assert.throws(() => field.update([0, 0, 0], 0), /Disposed grass/);
    assert.throws(() => field.setWind({}), /Disposed grass/);
    // A large patch is made over several calls and drawn when it is whole.
    const dense = new ZhudaGrassField(scene, { ...options, density: 1200, patchM: 8 });
    const first = children.length;
    assert.ok(dense.update([0, 1.5, 0], 0, 1) > 0);
    // Its first four meshes are small; the fifth holds half its blades.
    while (children.length - first < 4) dense.update([0, 1.5, 0], 0, 1);
    const shown = () => children.slice(first).filter((node) => node.active === true).length;
    assert.equal(shown(), 4);
    const before = dense.stats.blades;
    dense.update([0, 1.5, 0], 0, 1);
    const made = children.length - first;
    assert.ok(made > 4, 'a part of the fifth is made');
    assert.equal(shown(), 4, 'and not drawn yet');
    assert.equal(dense.stats.blades, before, 'nor counted');
    while (shown() === 4) dense.update([0, 1.5, 0], 0, 1);
    assert.ok(children.length - first > made, 'in more than one part');
    assert.equal(shown(), children.length - first, 'shown together');
    assert.ok(dense.stats.blades > before * 1.8);
    // Given up half made, it leaves nothing behind.
    dense.update([0, 1.5, 0], 0, 1);
    dense.dispose();
    assert.deepEqual(laya.live, { meshes: 0, nodes: 0, materials: 0 });
    // Without turf a patch where nothing grows has no mesh at all.
    const bare = new ZhudaGrassField(scene, { ...options, grows: () => false });
    bare.fill([0, 1.5, 0], 0);
    assert.equal(laya.live.meshes, 0);
    assert.equal(bare.stats.blades, 0);
    bare.dispose();
  } finally {
    globalThis.Laya = before;
  }
});

test('the back of a two-sided lit surface can keep the normal it was given', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const surface = 'void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {}';
    const fragments = (name, backFaces) => {
      new ZhudaLitSurfaceMaterial({ name, surface, backFaces }).dispose();
      return laya.shaders.get(name).subs[0].passes;
    };
    const turned = 'if(!gl_FrontFacing){pixel.normalWS=-pixel.normalWS;';
    const mirrored = fragments('ZhudaTestMirrored');
    const same = fragments('ZhudaTestSame', 'same');
    for (const pass of mirrored) assert.ok(!pass.fragment.includes(turned));
    assert.ok(same[0].fragment.includes(turned), 'the lit pass');
    assert.ok(same[2].fragment.includes(turned), 'the depth-normal pass');
    assert.ok(!same[1].fragment.includes(turned), 'the shadow pass has no normal to turn');
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestBad', surface, backFaces: 'both' }),
      /backFaces/,
    );
    // One shader name cannot mean both.
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestMirrored', surface, backFaces: 'same' }),
      /different contract/,
    );
    // The grass uses it, and its vertex hook is one the lit passes accept.
    const field = new ZhudaGrassField({ addChild() {} }, { area: AREA, ground: flat });
    const grass = laya.shaders.get('ZhudaGrassBlades').subs[0].passes;
    assert.ok(grass[0].fragment.includes(turned));
    assert.ok(grass[0].vertex.includes('u_ZhudaGrassEye'));
    assert.equal(grass.length, 3);
    field.dispose();
    assert.equal(buildZhudaLitVertexShaders().forward.includes('zhudaVertex'), false);
  } finally {
    globalThis.Laya = before;
  }
});
