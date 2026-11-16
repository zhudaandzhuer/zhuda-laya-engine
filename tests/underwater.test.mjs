import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  installLaya342Underwater,
  resolveZhudaUnderwater,
  validateZhudaUnderwater,
  zhudaCausticIntensity,
  zhudaPatchUnderwaterInclude,
  zhudaUnderwaterInstalled,
  zhudaUnderwaterTransmittance,
  zhudaUnderwaterWaves,
  ZHUDA_UNDERWATER_DEFINE,
} from '../packages/core/runtime3d/Underwater.ts';
import {
  parseZhudaFilmScene,
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';

/** An include's text as LayaAir 3.4.2 registers it (from the vendored build). */
function vendorInclude(name) {
  const source = fs.readFileSync(
    new URL('../vendor/laya-3.4.2/libs/laya.d3.js', import.meta.url),
    'utf8',
  );
  const head = `addInclude("${name}",`;
  const at = source.indexOf(head);
  assert.ok(at >= 0, name);
  const quote = source[at + head.length];
  const start = at + head.length + 1;
  return Function(
    `return ${quote}${source.slice(start, source.indexOf(quote + ')', start))}${quote}`,
  )();
}

test('water dims red first, then green, blue last', () => {
  const r = resolveZhudaUnderwater();
  const [red, green, blue] = zhudaUnderwaterTransmittance(r.extinction, 5);
  assert.ok(red < green && green < blue, `${red} ${green} ${blue}`);
  assert.deepEqual(zhudaUnderwaterTransmittance(r.extinction, 0), [1, 1, 1]);
  assert.ok(Math.abs(zhudaUnderwaterTransmittance([0.5, 0.5, 0.5], 2)[0] - Math.exp(-1)) < 1e-12);
});

test('caustics: no gathering at the surface, bright lines a few metres down, moving with time', () => {
  // At the surface the light has not been bent yet.
  for (const [x, z] of [
    [0, 0],
    [1.3, -0.7],
    [4, 2],
  ])
    assert.equal(zhudaCausticIntensity(x, z, 0, 1.5), 1);
  // A few metres down the waves focus it: some places far brighter, others dimmer.
  const values = [];
  for (let x = 0; x < 6; x += 0.05)
    for (let z = 0; z < 6; z += 0.05) values.push(zhudaCausticIntensity(x, z, 4, 1.5));
  const max = Math.max(...values),
    min = Math.min(...values);
  assert.ok(max > 2.5 && max <= 6, `brightest ${max}`);
  assert.ok(min < 0.8, `dimmest ${min}`);
  assert.notEqual(zhudaCausticIntensity(1, 1, 4, 0), zhudaCausticIntensity(1, 1, 4, 0.5));
  // The waves: four trains, a slope that is the derivative of the height.
  const e = 1e-4,
    a = zhudaUnderwaterWaves(0.7, 1.9, 2),
    dx =
      (zhudaUnderwaterWaves(0.7 + e, 1.9, 2).height -
        zhudaUnderwaterWaves(0.7 - e, 1.9, 2).height) /
      (2 * e);
  assert.ok(Math.abs(dx - a.slope[0]) < 1e-6, `${dx} against ${a.slope[0]}`);
  assert.equal(zhudaUnderwaterWaves(1, 1, 1, 2.5, 0).height, 0, 'no waves, flat water');
});

test('options are validated and resolved', () => {
  assert.deepEqual(validateZhudaUnderwater({}), []);
  const r = resolveZhudaUnderwater({ surfaceY: 7, caustics: { strength: 2 } });
  assert.equal(r.surfaceY, 7);
  assert.equal(r.caustics.strength, 2);
  assert.equal(r.caustics.waveMeters, 2.5);
  assert.equal(resolveZhudaUnderwater({ caustics: false }).caustics, false);
  for (const [bad, word] of [
    [{ extinction: [1, 2] }, /extinction/],
    [{ extinction: [1, 2, 11] }, /extinction/],
    [{ color: 'blue' }, /color/],
    [{ maxDistance: 0 }, /maxDistance/],
    [{ caustics: { strength: 9 } }, /caustics\.strength/],
    [{ caustics: { size: 3 } }, /caustics\.size: not/],
    [{ depth: 3 }, /depth: not an underwater field/],
    [{ surface: 'yes' }, /surface/],
  ])
    assert.match(validateZhudaUnderwater(bad).join(), word);
});

test("the light patch fits LayaAir 3.4.2's PBR and Blinn-Phong text, behind its define", () => {
  for (const [name, position] of [
    ['PBRFrag.glsl', 'info.positionWS'],
    ['BlinnPhongFrag.glsl', 'positionWS'],
  ]) {
    const text = vendorInclude(name);
    const made = zhudaPatchUnderwaterInclude(name, text);
    assert.equal(made.reason, undefined, name);
    assert.ok(
      made.text.includes(`light.color*=zhudaUnderwaterLight(${position},light.dir);`),
      name,
    );
    assert.ok(
      made.text.indexOf('vec3 zhudaUnderwaterLight(') < made.text.indexOf('void getPixelInfo('),
      name,
    );
    // Everything added is behind the define: without it the shader is LayaAir's.
    const added = made.text.replace(text.slice(0, 0), '');
    assert.ok(added.includes(`#ifdef ${ZHUDA_UNDERWATER_DEFINE}`));
    assert.ok(
      zhudaPatchUnderwaterInclude(name, text.replace('getLight(directionLight)', 'x')).reason,
      name,
    );
  }
  assert.deepEqual(zhudaPatchUnderwaterInclude('Lighting.glsl', 'a'), { text: 'a' });
});

test("its three scene vectors come after LayaAir's own, installed before Laya.init", () => {
  const maps = new Map();
  const factory = {
    createGlobalUniformMap(name) {
      if (!maps.has(name)) {
        const entries = [];
        maps.set(name, { entries, addShaderUniform: (_id, n) => entries.push(n) });
      }
      return maps.get(name);
    },
  };
  const ids = new Map();
  const added = [];
  const runtime = {
    Shader3D: {
      addInclude: (name) => added.push(name),
      propertyNameToID: (n) => (ids.has(n) ? ids.get(n) : ids.set(n, ids.size).size - 1),
    },
    ShaderDataType: { Vector4: 'vec4' },
    Scene3D: {
      shaderValueInit() {
        const map = (this.sceneUniformMap = factory.createGlobalUniformMap('Scene3D'));
        for (const n of [
          'u_Time',
          'u_FogParams',
          'u_FogColor',
          'u_GIRotate',
          'u_DirationLightCount',
        ])
          map.addShaderUniform(0, n);
      },
    },
  };
  assert.equal(installLaya342Underwater(runtime), true);
  runtime.Shader3D.addInclude('PBRFrag.glsl', vendorInclude('PBRFrag.glsl'));
  assert.equal(maps.has('Scene3D'), false);
  assert.equal(zhudaUnderwaterInstalled(runtime).light, false);
  runtime.Scene3D.shaderValueInit();
  assert.deepEqual(maps.get('Scene3D').entries, [
    'u_Time',
    'u_FogParams',
    'u_FogColor',
    'u_GIRotate',
    'u_DirationLightCount',
    'u_ZhudaCaustics',
    'u_ZhudaCausticsFade',
    'u_ZhudaWaterSigma',
  ]);
  assert.equal(zhudaUnderwaterInstalled(runtime).light, true);
});

const context = { props: [], recipes: ['asphalt'] };
const scene = (look) => ({
  schemaVersion: 1,
  id: 'sea',
  camera: { eye: [0, 2, 8], target: [0, 1, 0] },
  look,
  nodes: [{ id: 'floor', type: 'ground', size: [40, 40], material: 'asphalt' }],
});

test('a film look under water: needs grade, validated, resolved with a display colour', () => {
  assert.deepEqual(
    validateZhudaFilmScene(scene({ preset: 'day', grade: {}, underwater: true }), context),
    [],
  );
  assert.match(
    validateZhudaFilmScene(scene({ preset: 'day', underwater: true }), context).join(),
    /look\.underwater: needs grade/,
  );
  assert.match(
    validateZhudaFilmScene(
      scene({ preset: 'day', grade: {}, underwater: { caustics: { strength: 5 } } }),
    ).join(),
    /look\.underwater\.caustics\.strength: use 0\.\.4/,
  );
  const look = resolveZhudaFilmLook(
    parseZhudaFilmScene(scene({ preset: 'day', grade: {}, underwater: { surfaceY: 7 } }), context)
      .look,
  );
  assert.equal(look.underwater.surfaceY, 7);
  assert.deepEqual(look.underwater.color, [0.17, 0.33, 0.38], 'a display colour by default');
  assert.equal(
    resolveZhudaFilmLook(parseZhudaFilmScene(scene({ preset: 'day' }), context).look).underwater,
    false,
  );
});

test('changing the water in place, and what rebuilds the look', () => {
  const resolve = (underwater) =>
    resolveZhudaFilmLook(
      parseZhudaFilmScene(scene({ preset: 'day', grade: {}, underwater }), context).look,
    );
  assert.equal(
    zhudaFilmLookRebuildReason(
      resolve({ surfaceY: 1 }),
      resolve({ surfaceY: 3, extinction: [1, 0.2, 0.1] }),
    ),
    null,
  );
  assert.equal(zhudaFilmLookRebuildReason(resolve(true), resolve(false)), 'underwater');
  assert.equal(
    zhudaFilmLookRebuildReason(resolve(true), resolve({ caustics: false })),
    'underwater',
  );
  assert.equal(
    zhudaFilmLookRebuildReason(resolve(true), resolve({ surface: false })),
    'underwater',
  );
});

test('quality levels: caustics go at level 1, the water at level 0 with the HDR chain', () => {
  const look = resolveZhudaFilmLook(
    parseZhudaFilmScene(scene({ preset: 'day', grade: {}, underwater: true }), context).look,
  );
  assert.ok(zhudaLookForQuality(look, 2).underwater.caustics);
  assert.equal(zhudaLookForQuality(look, 1).underwater.caustics, false);
  assert.ok(zhudaLookForQuality(look, 1).underwater, 'the medium stays at level 1');
  assert.equal(zhudaLookForQuality(look, 0).underwater, false);
});
