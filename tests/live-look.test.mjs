import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveZhudaFilmLook,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { updateZhudaLookInPlace, zhudaSunRadiance } from '../packages/core/film/LiveLook.ts';
import {
  buildZhudaLitVertexShaders,
  validateZhudaLitVertexHook,
} from '../packages/core/shaders/LitSurfaceMaterial.ts';
import {
  litVertex,
  litShadowVertex,
  litDepthVertex,
} from '../packages/core/shaders/LitSurfaceTemplates.ts';

const base = {
  preset: 'day',
  shadows: { distance: 60 },
  fog: { start: 20, end: 120 },
  grade: { exposure: 1.2, contrast: 1.05, bloom: 0.1 },
  lightFog: { density: 0.01, shafts: { strength: 1 } },
};
const reason = (a, b) =>
  zhudaFilmLookRebuildReason(resolveZhudaFilmLook(a), resolveZhudaFilmLook(b));

test('continuous look changes are set in place', () => {
  assert.equal(reason(base, base), null);
  for (const change of [
    { sun: { elevationDeg: 5, azimuthDeg: 120, intensity: 0.4, color: [1, 0.5, 0.3] } },
    { ambient: [0.05, 0.06, 0.1], sky: [0.1, 0.1, 0.2] },
    { atmosphere: { thickness: 2.5, exposure: 0.3, skyTint: [0.2, 0.3, 0.5] } },
    { fog: { color: [0.1, 0.1, 0.15], start: 5, end: 60 } },
    { shadows: { distance: 30, strength: 0.4, softness: 'hard', cascades: 4, resolution: 1024 } },
    { grade: { ...base.grade, exposure: 3 } },
  ])
    assert.equal(reason(base, { ...base, ...change }), null, JSON.stringify(change));
});

test('weather values are set in place: grade strengths and the fog', () => {
  assert.equal(
    reason(base, {
      ...base,
      grade: { ...base.grade, contrast: 1.4, saturation: 0.6, bloom: 0.5 },
    }),
    null,
  );
  assert.equal(
    reason(base, {
      ...base,
      lightFog: {
        ...base.lightFog,
        density: 0.03,
        color: [0.2, 0.2, 0.25],
        scatter: 0.4,
        shafts: { ...base.lightFog.shafts, strength: 0.2, anisotropy: 0.3 },
      },
    }),
    null,
  );
});

test('quality 0 keeps a bare HDR chain only where asked', async () => {
  const { zhudaLookForQuality } = await import('../packages/core/film/LookQuality.ts');
  const look = resolveZhudaFilmLook({ ...base, grade: { ...base.grade, vignette: 0.3, ao: 0.5 } });
  assert.equal(zhudaLookForQuality(look, 0).grade, false);
  const kept = zhudaLookForQuality(look, 0, { keepGrade: true });
  assert.equal(kept.lightFog, false);
  assert.deepEqual(
    [kept.grade.bloom, kept.grade.ao, kept.grade.grain, kept.grade.vignette, kept.grade.fringe],
    [0, 0, 0, 0, 0],
  );
  assert.equal(kept.grade.exposure, look.grade.exposure);
  assert.equal(
    zhudaLookForQuality(resolveZhudaFilmLook({ ...base, grade: false, lightFog: false }), 0, {
      keepGrade: true,
    }).grade,
    false,
  );
});

test('structural look changes name what has to be rebuilt', () => {
  assert.equal(reason(base, { ...base, shadows: false }), 'shadows');
  assert.equal(reason(base, { ...base, atmosphere: false }), 'atmosphere');
  assert.equal(reason(base, { ...base, fog: false }), 'fog');
  assert.equal(reason(base, { ...base, ambientGround: [0.1, 0.08, 0.05] }), 'ambientGround');
  assert.equal(reason(base, { ...base, grade: false, lightFog: false }), 'grade');
  // Switching an effect of the chain on or off rebuilds it; its strength does not.
  assert.equal(reason(base, { ...base, grade: { ...base.grade, bloom: 0 } }), 'grade');
  assert.equal(reason(base, { ...base, grade: { ...base.grade, ao: 0 } }), 'grade');
  assert.equal(reason(base, { ...base, lightFog: false }), 'lightFog');
  assert.equal(
    reason(base, { ...base, lightFog: { ...base.lightFog, shafts: false } }),
    'lightFog',
  );
  assert.equal(
    reason(base, {
      ...base,
      lightFog: { ...base.lightFog, shafts: { ...base.lightFog.shafts, steps: 12 } },
    }),
    'lightFog',
  );
  assert.equal(reason(base, { ...base, panorama: { asset: 'sky.jpg' } }), 'panorama');
  assert.equal(reason(base, { ...base, environment: { position: [0, 1, 0] } }), 'environment');
});

test('a look without a vertex hook keeps the native vertex programs byte for byte', () => {
  assert.deepEqual(buildZhudaLitVertexShaders(), {
    forward: litVertex,
    shadow: litShadowVertex,
    depth: litDepthVertex,
  });
});

const hook = `void zhudaVertex(inout vec3 p, inout vec3 n, vec2 uv, vec3 origin) {
  p.x += sin(u_ZhudaTime + origin.x) * uv.y * 0.2; // wind
}`;

test('the vertex hook runs in the forward, shadow and depth-normal passes', () => {
  const { forward, shadow, depth } = buildZhudaLitVertexShaders(hook);
  for (const [name, source] of Object.entries({ forward, shadow, depth })) {
    assert.ok(source.includes('void zhudaVertex('), name + ' declares the hook');
    assert.ok(source.indexOf('void zhudaVertex(') < source.indexOf('void main(){'), name);
  }
  // Forward and depth: hook between the native world-space set-up and the varyings.
  for (const source of [forward, depth])
    assert.match(
      source,
      /initPixelParams\(pixel,vertex\);zhudaApplyVertex\(pixel,vertex\);sharePixelParams\(pixel\);/,
    );
  assert.match(forward, /sharePixelParams\(pixel\);[\s\S]*getPositionCS\(pixel\.positionWS\)/);
  assert.match(
    depth,
    /sharePixelParams\(pixel\);vec4 positionCS=getPositionCS\(pixel\.positionWS\)/,
  );
  // Shadow caster: hook before the biased light-space projection.
  assert.match(
    shadow,
    /zhudaVertex\(positionWS,normalWS,zhudaUV,worldMat\[3\]\.xyz\);normalWS=normalize\(normalWS\);\}vec4 positionCS=DepthPositionCS\(positionWS,normalWS\);/,
  );
});

test('the vertex hook is a bounded function body', () => {
  assert.deepEqual(validateZhudaLitVertexHook(hook), []);
  assert.match(validateZhudaLitVertexHook('void wind(){}')[0], /must define zhudaVertex/);
  assert.match(validateZhudaLitVertexHook(42)[0], /must define zhudaVertex/);
  assert.match(
    validateZhudaLitVertexHook('uniform float u_ZhudaT;' + hook)[0],
    /function body contract/,
  );
  assert.match(validateZhudaLitVertexHook(hook + 'void main(){}')[0], /function body contract/);
  assert.match(
    validateZhudaLitVertexHook('#include "Camera.glsl"\n' + hook)[0],
    /function body contract/,
  );
  assert.match(
    validateZhudaLitVertexHook(hook.replace('// wind', 'gl_Position = vec4(0.0);'))[0],
    /clip-space output/,
  );
  // Comments may mention anything.
  assert.deepEqual(validateZhudaLitVertexHook('// uniform, void main(), gl_Position\n' + hook), []);
  assert.throws(() => buildZhudaLitVertexShaders('void main(){}'), /zhudaVertex/);
});

class V3 {
  constructor(x = 0, y = 0, z = 0) {
    Object.assign(this, { x, y, z });
  }
}
class C {
  constructor(r, g, b, a) {
    Object.assign(this, { r, g, b, a });
  }
}
const fakeLaya = {
  Vector3: V3,
  Color: C,
  ShadowMode: { None: 0, Hard: 1, SoftHigh: 2 },
  ShadowCascadesMode: { NoCascades: 0, TwoCascades: 1, FourCascades: 2 },
};

test('in-place update moves the sun and sets every continuous value it owns', () => {
  const look = resolveZhudaFilmLook({
    ...base,
    sun: { elevationDeg: 12, azimuthDeg: -70, intensity: 0.8, color: [1, 0.6, 0.4] },
    ambient: [0.1, 0.12, 0.2],
    sky: [0.3, 0.2, 0.1],
    atmosphere: { thickness: 2, exposure: 0.7, sunSize: 0.05 },
    fog: { color: [0.2, 0.2, 0.25], start: 10, end: 90 },
    shadows: { distance: 40, strength: 0.6, softness: 'hard', cascades: 4, resolution: 1024 },
    grade: { ...base.grade, exposure: 2.5 },
  });
  const sunNode = {
    transform: {
      rotationEuler: null,
      getForward: (out) => Object.assign(out, { x: 0, y: -1, z: 0 }),
    },
  };
  const sun = { owner: sunNode };
  const scene3D = {},
    camera = {},
    sky = {},
    exposures = [],
    grades = [],
    finishes = [],
    fogs = [],
    suns = [];
  const parts = {
    sky,
    film: { setGrade: (values) => (exposures.push(values.exposure), grades.push(values)) },
    finish: { setFinish: (values) => finishes.push(values) },
    lightFog: {
      attachSun: (scene, s) => suns.push([scene, s]),
      setFog: (values) => fogs.push(values),
    },
  };
  updateZhudaLookInPlace(fakeLaya, { scene3D, camera, sun, parts }, look);
  assert.deepEqual(sunNode.transform.rotationEuler, new V3(-12, -70, 0));
  assert.equal(sun.intensity, 0.8);
  assert.deepEqual(sun.color, new C(1, 0.6, 0.4, 1));
  assert.deepEqual(scene3D.ambientColor, new C(0.1, 0.12, 0.2, 1));
  assert.deepEqual(camera.clearColor, new C(0.3, 0.2, 0.1, 1));
  assert.equal(sun.shadowMode, fakeLaya.ShadowMode.Hard);
  assert.equal(sun.shadowDistance, 40);
  assert.equal(sun.shadowStrength, 0.6);
  assert.equal(sun.shadowResolution, 1024);
  assert.equal(sun.shadowCascadesMode, fakeLaya.ShadowCascadesMode.FourCascades);
  assert.equal(sky.atmosphereThickness, 2);
  assert.equal(sky.exposure, 0.7);
  assert.equal(sky.sunSize, 0.05);
  assert.deepEqual(scene3D.fogColor, new C(0.2, 0.2, 0.25, 1));
  assert.equal(scene3D.fogStart, 10);
  assert.equal(scene3D.fogEnd, 90);
  assert.deepEqual(exposures, [2.5]);
  // The strengths of the grade, the lens finish and the fog go in with it.
  assert.equal(grades[0].contrast, look.grade.contrast);
  assert.equal(grades[0].saturation, look.grade.saturation);
  assert.equal(grades[0].bloomIntensity, look.grade.bloom);
  assert.equal(finishes[0].vignette, look.grade.vignette);
  assert.equal(fogs[0].density, look.lightFog.density);
  assert.deepEqual(fogs[0].shafts, {
    strength: look.lightFog.shafts.strength,
    anisotropy: look.lightFog.shafts.anisotropy,
  });
  assert.equal(suns.length, 1);
  assert.equal(suns[0][0], scene3D);
  assert.deepEqual(suns[0][1].toward, [-0, 1, -0]);
  assert.deepEqual(suns[0][1].color, zhudaSunRadiance(look));
});

test('in-place update leaves parts the look does not have alone', () => {
  const look = resolveZhudaFilmLook({ sky: [0.1, 0.1, 0.1] });
  const sun = { owner: { transform: { getForward: () => {} } } };
  const scene3D = {};
  updateZhudaLookInPlace(fakeLaya, { scene3D, camera: {}, sun, parts: {} }, look);
  assert.equal(sun.shadowMode, undefined);
  assert.equal(scene3D.fogColor, undefined);
});

test('the hemisphere ambient mixes two prefiltered bases instead of prefiltering again', async () => {
  const { prefilterZhudaEnvironment, prefilterZhudaHemisphere, zhudaHemisphereCube } = await import(
    '../packages/core/runtime3d/EnvironmentProbe.ts'
  );
  for (const [sky, ground] of [
    [
      [0.36, 0.42, 0.5],
      [0.16, 0.14, 0.08],
    ],
    [
      [2, 0, 0.3],
      [0, 0.7, 0],
    ],
  ]) {
    const full = prefilterZhudaEnvironment(zhudaHemisphereCube(sky, ground), { size: 16 });
    const mixed = prefilterZhudaHemisphere(sky, ground);
    assert.deepEqual(mixed.spec.levels, full.spec.levels);
    assert.equal(mixed.pixels.length, full.pixels.length);
    let worst = 0;
    for (let i = 0; i < full.pixels.length; i++)
      worst = Math.max(worst, Math.abs(mixed.pixels[i] - full.pixels[i]));
    assert.ok(worst < 1e-5, 'pixels ' + worst);
    mixed.spec.ambientSH.forEach((v, i) => assert.ok(Math.abs(v - full.spec.ambientSH[i]) < 1e-6));
  }
  assert.throws(() => prefilterZhudaHemisphere([-1, 0, 0], [0, 0, 0]), /non-negative/);
  const t = performance.now();
  for (let i = 0; i < 100; i++) prefilterZhudaHemisphere([0.3, 0.4, i / 100], [0.1, 0.1, 0.1]);
  assert.ok((performance.now() - t) / 100 < 0.5, 'cheap enough for every frame');
});

test('padded bounds stay padded when vertices change', async () => {
  const { ZhudaDynamicMesh } = await import('../packages/core/runtime3d/Surfaces.ts');
  const before = globalThis.Laya;
  class V3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  globalThis.Laya = {
    Vector3: V3,
    Bounds: class {
      constructor(min, max) {
        this.min = { ...min };
        this.max = { ...max };
      }
    },
    PrimitiveMesh: { _createMesh: () => ({ _vertexBuffer: { setData() {} } }) },
    VertexMesh: { getVertexDeclaration: (s) => s },
    MeshSprite3D: class {
      constructor() {
        this.meshRenderer = {};
      }
      destroy() {}
    },
  };
  try {
    const mesh = new ZhudaDynamicMesh({
      positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 1, 3]),
      indices: new Uint16Array([0, 1, 2]),
    });
    assert.deepEqual(
      [mesh.mesh.bounds.min, mesh.mesh.bounds.max],
      [
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 1, z: 3 },
      ],
    );
    mesh.padBounds(0.5);
    assert.deepEqual(mesh.mesh.bounds.min, { x: -0.5, y: -0.5, z: -0.5 });
    assert.deepEqual(mesh.mesh.bounds.max, { x: 2.5, y: 1.5, z: 3.5 });
    mesh.setPosition(1, 4, 0, 0);
    mesh.updateRange(1, 1);
    assert.deepEqual(
      mesh.mesh.bounds.max,
      { x: 4.5, y: 1.5, z: 3.5 },
      'the padding survives an update',
    );
    assert.throws(() => mesh.padBounds(-1), /padBounds/);
    assert.throws(() => mesh.padBounds(NaN), /padBounds/);
    mesh.padBounds(0);
    assert.deepEqual(mesh.mesh.bounds.max, { x: 4, y: 1, z: 3 });
  } finally {
    globalThis.Laya = before;
  }
});
