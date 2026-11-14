import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZHUDA_LIGHT_DEFINES,
  ZhudaLightingDepth,
  installLaya342LightingDepth,
  setZhudaSpotPenumbra,
  validateZhudaLightingDepth,
  zhudaLayaFalloff,
  zhudaLightingDepthInstalled,
  zhudaPhysicalFalloff,
  zhudaSpotCone,
} from '../packages/core/runtime3d/LightingDepth.ts';
import { installLaya342PointShadows } from '../packages/core/runtime3d/PointShadow.ts';
import {
  ZhudaPointShadowSchedule,
  validateZhudaPointShadowSchedule,
} from '../packages/core/runtime3d/PointShadowSchedule.ts';
import {
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';
import { zhudaLookLighting } from '../packages/core/film/LiveLook.ts';

const near = (a, b, by, what) => assert.ok(Math.abs(a - b) <= by, `${what ?? ''}: ${a} for ${b}`);

test('the options of lighting depth are checked', () => {
  assert.deepEqual(validateZhudaLightingDepth({}), []);
  assert.deepEqual(
    validateZhudaLightingDepth({
      falloff: 'physical',
      shadowSpread: 2.5,
      cascadeBlend: true,
      contactShadows: 0.3,
    }),
    [],
  );
  assert.deepEqual(validateZhudaLightingDepth({ contactShadows: 0 }), []);
  assert.deepEqual(validateZhudaLightingDepth({ falloff: 'linear' }), [
    'falloff: use laya or physical',
  ]);
  assert.deepEqual(validateZhudaLightingDepth({ shadowSpread: 0.5 }), ['shadowSpread: use 1..4']);
  assert.deepEqual(validateZhudaLightingDepth({ shadowSpread: 5 }), ['shadowSpread: use 1..4']);
  assert.deepEqual(validateZhudaLightingDepth({ contactShadows: 0.01 }), [
    'contactShadows: use 0 or 0.02..2',
  ]);
  assert.deepEqual(validateZhudaLightingDepth({ cascadeBlend: 1 }), [
    'cascadeBlend: use true or false',
  ]);
});

test('a lamp by the square of the distance: 1 at one unit, a quarter at two, nothing at its range', () => {
  near(zhudaPhysicalFalloff(1, 10), 1, 3e-4);
  near(zhudaPhysicalFalloff(2, 10), 0.25, 1e-3);
  near(zhudaPhysicalFalloff(4, 10), 1 / 16, 4e-3);
  // Half way out the window has taken an eighth off what the square says.
  near(zhudaPhysicalFalloff(5, 10) * 25, 0.879, 1e-3);
  assert.equal(zhudaPhysicalFalloff(10, 10), 0);
  assert.equal(zhudaPhysicalFalloff(14, 10), 0);
  // Never without end at the lamp itself.
  assert.ok(Number.isFinite(zhudaPhysicalFalloff(0, 10)));
  let last = Infinity;
  for (let d = 0.1; d <= 10; d += 0.1) {
    const now = zhudaPhysicalFalloff(d, 10);
    assert.ok(now <= last, `no brighter farther out: ${d}`);
    last = now;
  }
  // LayaAir's own: 1 at the lamp whatever its range, nothing from its range on.
  assert.equal(zhudaLayaFalloff(0, 5), 1);
  assert.equal(zhudaLayaFalloff(0, 50), 1);
  near(zhudaLayaFalloff(5, 10), 1 / 7.25, 1e-12);
  assert.equal(zhudaLayaFalloff(10, 10), 0);
  // The same lamp reaches twice as far with twice the range: brightness follows the range, not the distance.
  near(zhudaLayaFalloff(2, 10), zhudaLayaFalloff(4, 20), 1e-12);
});

test("a spot's cone: all of the light inside the inner cone, none outside, a smooth step between", () => {
  assert.equal(zhudaSpotCone(0, 60), 1);
  assert.equal(zhudaSpotCone(15, 60), 1, "LayaAir's own half: soft from 15 to 30 degrees");
  assert.equal(zhudaSpotCone(30, 60), 0);
  assert.equal(zhudaSpotCone(45, 60), 0);
  near(zhudaSpotCone(22, 60), 0.665, 2e-3);
  // A hard rim, and soft from the middle out.
  assert.equal(zhudaSpotCone(29, 60, 0), 1);
  near(zhudaSpotCone(15, 60, 1), 0.839, 2e-3);
  assert.ok(zhudaSpotCone(1, 60, 1) < 1 && zhudaSpotCone(1, 60, 1) > 0.99);
  for (const penumbra of [0, 0.25, 0.5, 1]) {
    let last = 1;
    for (let a = 0; a <= 35; a += 1) {
      const now = zhudaSpotCone(a, 60, penumbra);
      assert.ok(now <= last + 1e-12 && now >= 0, `penumbra ${penumbra} at ${a}`);
      last = now;
    }
  }
});

/** The text LayaAir 3.4.2 registers for an include, read from the vendored library. */
function vendoredInclude(name) {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../vendor/laya-3.4.2/libs/laya.d3.js'),
    'utf8',
  );
  const start = source.indexOf(`addInclude("${name}",`);
  assert.ok(start > 0, `${name} is registered by the vendored library`);
  let at = start + `addInclude("${name}",`.length;
  const quote = source[at];
  assert.ok(quote === '"' || quote === "'", 'a string follows');
  let end = at + 1;
  while (source[end] !== quote) end += source[end] === '\\' ? 2 : 1;
  // The literal as JavaScript reads it.
  return Function(`return ${source.slice(at, end + 1)}`)();
}

/** A runtime as far as the patch touches it: what it registers is kept by name. */
function fakeRuntime() {
  const includes = new Map();
  const defines = new Map();
  const uploads = [];
  class Vector4 {
    constructor(x = 0, y = 0, z = 0, w = 0) {
      Object.assign(this, { x, y, z, w });
    }
  }
  const texture = {
    setSubPixelsData(x, y, width, height, pixels) {
      uploads.push(Float32Array.from(pixels));
    },
  };
  class Scene3D {
    _directionLights = { _length: 0, _elements: [] };
    _pointLights = { _length: 0, _elements: [] };
    _spotLights = { _length: 0, _elements: [] };
    pixels = new Float32Array(16 * 8);
    _getLightTexture() {
      return texture;
    }
    // LayaAir writes three texels of each row, then uploads the rows it wrote.
    _prepareSceneToRender() {
      const rows =
        this._directionLights._length + this._pointLights._length + this._spotLights._length;
      for (let row = 0; row < rows; row++) this.pixels.fill(7, row * 16, row * 16 + 12);
      if (rows) texture.setSubPixelsData(0, 0, 4, rows, this.pixels, 0, false, false, false);
    }
  }
  class ShaderData {
    defines = new Set();
    vectors = new Map();
    addDefine(d) {
      this.defines.add(d.name);
    }
    removeDefine(d) {
      this.defines.delete(d.name);
    }
    getVector(id) {
      return this.vectors.get(id);
    }
    setVector(id, value) {
      this.vectors.set(id, value);
    }
  }
  const l = {
    Shader3D: {
      addInclude(name, text) {
        includes.set(name, text);
      },
      getDefineByName: (name) => defines.get(name) ?? defines.set(name, { name }).get(name),
    },
    Scene3D,
    Stat: { enableLight: true },
    Vector4,
    ShadowCasterPass: { SHADOW_PARAMS: 41 },
    DepthTextureMode: { None: 0, Depth: 1, DepthNormals: 2 },
  };
  return { l, includes, uploads, ShaderData };
}

test('the patch changes the vendored includes, with point shadows, and leaves other text alone', () => {
  const texts = Object.fromEntries(
    ['Lighting.glsl', 'ShadowSampler.glsl', 'Camera.glsl'].map((name) => [
      name,
      vendoredInclude(name),
    ]),
  );
  const { l, includes } = fakeRuntime();
  assert.equal(installLaya342LightingDepth({}), false, 'no runtime, nothing to patch');
  // As `ZhudaEngine.boot` installs them: point shadows first.
  assert.equal(installLaya342PointShadows(l), true);
  assert.equal(installLaya342LightingDepth(l), true);
  assert.equal(installLaya342LightingDepth(l), true, 'installing again changes nothing');
  assert.equal(zhudaLightingDepthInstalled(l), false, 'nothing registered yet');
  for (const [name, text] of Object.entries(texts)) l.Shader3D.addInclude(name, text);
  l.Shader3D.addInclude('Math.glsl', 'float one(){return 1.0;}');
  assert.equal(zhudaLightingDepthInstalled(l), true);
  assert.equal(includes.get('Math.glsl'), 'float one(){return 1.0;}');
  const lighting = includes.get('Lighting.glsl'),
    shadows = includes.get('ShadowSampler.glsl'),
    cameraText = includes.get('Camera.glsl');
  for (const [text, fragments] of [
    [
      lighting,
      [
        `#ifdef ${ZHUDA_LIGHT_DEFINES.inverseSquare}\nfloat zhudaWindow=`,
        'float zhudaPenumbra;};',
        `#ifdef ${ZHUDA_LIGHT_DEFINES.spotPenumbra}\ncosAngles.y=`,
        'texelFetch(u_LightBuffer,ivec2(3,spotIndex),0).x',
        'float zhudaContactShadow(vec3 positionWS,vec3 travel){',
        'light.attenuation=min(light.attenuation,zhudaContactShadow(positionWS,light.direction));',
        // The point shadow's own change is still made.
        'zhudaPointShadow(pointLight.position,normalWS,positionWS)',
      ],
    ],
    [
      shadows,
      [
        `#ifdef ${ZHUDA_LIGHT_DEFINES.cascadeBlend}\nvec3 zhudaFrom=`,
        'float zhudaWideShadow(vec3 coord,vec4 shadowmapSize){',
        `#ifndef ${ZHUDA_LIGHT_DEFINES.shadowSpread}\nattenuation=sampleShdowMapFiltered9(coord,shadowmapSize);`,
        'guard*=max(u_ShadowParams.z,1.0);',
      ],
    ],
    [cameraText, ['uniform highp sampler2D u_CameraDepthTexture;']],
  ])
    for (const fragment of fragments) assert.ok(text.includes(fragment), fragment);
  // What LayaAir's preprocessor needs: a directive starts its line, and no `#else` of this engine's.
  for (const text of [lighting, shadows])
    for (const line of text.split('\n')) {
      const at = line.search(/#(ifdef|ifndef|if|endif)\b/);
      if (at > 0 && /ZHUDA_|zhuda/.test(line)) assert.fail(`a directive inside a line: ${line}`);
    }
  for (const name of ['Lighting.glsl', 'ShadowSampler.glsl']) {
    const added = includes.get(name).length - texts[name].length;
    assert.ok(added > 200, `${name} grew by ${added}`);
    const elses = (text) => (text.match(/#else/g) ?? []).length;
    assert.equal(elses(includes.get(name)), elses(texts[name]), `${name}: no #else added`);
  }
  // `flat` and other words GLSL keeps for itself are not used as names.
  assert.doesNotMatch(lighting, /float (flat|smooth|sample|input|output|filter)\b/);
  // Another release's text: one sentence is missing, and the include is registered as it is.
  const other = fakeRuntime();
  installLaya342LightingDepth(other.l);
  const changed = texts['ShadowSampler.glsl'].replace('vec2 guard=', 'vec2 border=');
  other.l.Shader3D.addInclude('ShadowSampler.glsl', changed.replaceAll('guard', 'border'));
  other.l.Shader3D.addInclude('Lighting.glsl', texts['Lighting.glsl']);
  assert.equal(other.includes.get('ShadowSampler.glsl'), changed.replaceAll('guard', 'border'));
  assert.equal(zhudaLightingDepthInstalled(other.l), false);
});

test("a spot's penumbra is written into the fourth texel of its row just before the upload", () => {
  const { l, uploads } = fakeRuntime();
  installLaya342LightingDepth(l);
  const scene = new l.Scene3D();
  const first = {},
    second = {};
  scene._directionLights._length = 1;
  scene._pointLights._length = 2;
  scene._spotLights = { _length: 2, _elements: [first, second] };
  setZhudaSpotPenumbra(first, 0.2);
  scene._prepareSceneToRender();
  const row = (pixels, index) => [...pixels.subarray(index * 16, index * 16 + 16)];
  // Rows: one sun, two lamps, then the spots. The penumbra and one; nothing for a light without one.
  near(row(uploads.at(-1), 3)[12], 1.2, 1e-6);
  assert.equal(row(uploads.at(-1), 4)[12], 0);
  assert.deepEqual(row(uploads.at(-1), 3).slice(0, 12), Array(12).fill(7), "LayaAir's texels stay");
  assert.equal(row(uploads.at(-1), 2)[12], 0, 'a lamp has none');
  // LayaAir puts the brightest first: the value follows the light, not the row.
  scene._spotLights._elements = [second, first];
  setZhudaSpotPenumbra(second, 1);
  scene._prepareSceneToRender();
  assert.equal(row(uploads.at(-1), 3)[12], 2);
  near(row(uploads.at(-1), 4)[12], 1.2, 1e-6);
  setZhudaSpotPenumbra(first, null);
  setZhudaSpotPenumbra(second, 0);
  scene._prepareSceneToRender();
  assert.equal(row(uploads.at(-1), 3)[12], 1, 'a hard rim is 0 and one');
  assert.equal(row(uploads.at(-1), 4)[12], 0, "taken away: LayaAir's own again");
  // With the lights switched off LayaAir writes no rows.
  l.Stat.enableLight = false;
  scene._prepareSceneToRender();
  assert.equal(row(uploads.at(-1), 3)[12], 1, 'left as it was');
  assert.throws(() => setZhudaSpotPenumbra(first, 1.5), /use 0\.\.1/);
  assert.throws(() => setZhudaSpotPenumbra(null, 0.5), /spot light component/);
});

test("a scene's switches: defines, the two spare numbers, the camera's depth picture", () => {
  const { l, ShaderData } = fakeRuntime();
  installLaya342LightingDepth(l);
  const scene = { _shaderValues: new ShaderData() };
  const before = globalThis.Laya;
  globalThis.Laya = l;
  try {
    assert.throws(() => new ZhudaLightingDepth(scene), /needs installLaya342LightingDepth/);
    for (const name of ['Lighting.glsl', 'ShadowSampler.glsl'])
      l.Shader3D.addInclude(name, vendoredInclude(name));
    assert.throws(() => new ZhudaLightingDepth({}), /A Scene3D is required/);
    assert.throws(
      () => new ZhudaLightingDepth(scene, { contactShadows: 0.3 }),
      /contactShadows needs the camera/,
    );
    // LayaAir's own strengths are in the vector already.
    const laya = new l.Vector4(0.8, 0.6, 0, 0);
    scene._shaderValues.setVector(l.ShadowCasterPass.SHADOW_PARAMS, laya);
    const camera = { depthTextureMode: l.DepthTextureMode.DepthNormals };
    const lighting = new ZhudaLightingDepth(scene, {}, camera);
    const params = () => scene._shaderValues.getVector(l.ShadowCasterPass.SHADOW_PARAMS);
    const defines = () => [...scene._shaderValues.defines].sort();
    assert.deepEqual(defines(), [ZHUDA_LIGHT_DEFINES.spotPenumbra]);
    assert.deepEqual({ ...params() }, { x: 0.8, y: 0.6, z: 1, w: 0 });
    assert.notEqual(params(), laya, 'a new vector: one changed in place is taken for unchanged');
    assert.throws(() => new ZhudaLightingDepth(scene), /already has a ZhudaLightingDepth/);
    const earlier = params();
    lighting.set({
      falloff: 'physical',
      shadowSpread: 2,
      cascadeBlend: true,
      contactShadows: 0.3,
    });
    assert.deepEqual(defines(), Object.values(ZHUDA_LIGHT_DEFINES).sort());
    assert.deepEqual({ ...params() }, { x: 0.8, y: 0.6, z: 2, w: 0.3 });
    assert.notEqual(params(), earlier);
    assert.equal(camera.depthTextureMode, 3, 'the depth picture is asked for');
    // One value at a time; the rest stays.
    lighting.set({ shadowSpread: 1 });
    assert.ok(!scene._shaderValues.defines.has(ZHUDA_LIGHT_DEFINES.shadowSpread));
    assert.ok(scene._shaderValues.defines.has(ZHUDA_LIGHT_DEFINES.inverseSquare));
    assert.equal(params().w, 0.3);
    lighting.set({ contactShadows: 0 });
    assert.equal(camera.depthTextureMode, 2, 'and given back');
    assert.throws(() => lighting.set({ shadowSpread: 9 }), /shadowSpread: use 1\.\.4/);
    lighting.set({ contactShadows: 0.5 });
    lighting.dispose();
    assert.deepEqual(defines(), []);
    assert.deepEqual({ ...params() }, { x: 0.8, y: 0.6, z: 0, w: 0 });
    assert.equal(camera.depthTextureMode, 2);
    assert.throws(() => lighting.set({}), /Disposed lighting/);
    lighting.dispose();
    // A scene whose shadows have not been drawn yet has no such vector: none
    // is made (LayaAir would then change it in place, and on WebGPU its
    // strength would never arrive). LayaAir makes it, and the two numbers
    // go in as it is put back; what it is handed to change is a copy.
    {
      const fresh = { _shaderValues: new ShaderData() };
      const id = l.ShadowCasterPass.SHADOW_PARAMS;
      const owner = new ZhudaLightingDepth(fresh, { shadowSpread: 3 });
      assert.equal(fresh._shaderValues.vectors.get(id), undefined);
      // As LayaAir's shadow pass does.
      const pass = (strength) => {
        let v = fresh._shaderValues.getVector(id);
        v = v ? v : new l.Vector4();
        v.x = strength;
        fresh._shaderValues.setVector(id, v);
        return v;
      };
      pass(0.9);
      assert.deepEqual({ ...fresh._shaderValues.vectors.get(id) }, { x: 0.9, y: 0, z: 3, w: 0 });
      const kept = fresh._shaderValues.vectors.get(id);
      const handed = pass(0.4);
      assert.notEqual(handed, kept, "a copy is changed, not the scene's own");
      assert.equal(kept.x, 0.9, 'which stays as it was until the new one is put back');
      assert.deepEqual({ ...fresh._shaderValues.vectors.get(id) }, { x: 0.4, y: 0, z: 3, w: 0 });
      owner.set({ shadowSpread: 1.5 });
      assert.equal(fresh._shaderValues.vectors.get(id).z, 1.5);
      owner.dispose();
      assert.ok(
        !Object.hasOwn(fresh._shaderValues, 'getVector'),
        "the scene's own methods are back",
      );
      assert.equal(pass(0.7), fresh._shaderValues.vectors.get(id), 'as LayaAir does it by itself');
      assert.deepEqual({ ...fresh._shaderValues.vectors.get(id) }, { x: 0.7, y: 0, z: 0, w: 0 });
    }
    // A camera that drew its depth picture already keeps drawing it.
    const drawing = { depthTextureMode: 1 };
    const again = new ZhudaLightingDepth(scene, { contactShadows: 0.2 }, drawing);
    again.dispose();
    assert.equal(drawing.depthTextureMode, 1);
    // A scene destroyed with its owner left on it: LayaAir has taken the
    // scene's values away, and the owner still changes and goes quietly.
    const lost = { _shaderValues: new ShaderData() };
    const lens = { depthTextureMode: 0 };
    const stray = new ZhudaLightingDepth(lost, { contactShadows: 0.3 }, lens);
    assert.equal(lens.depthTextureMode, 1);
    lost.destroyed = true;
    lost._shaderValues = null;
    stray.set({ shadowSpread: 2 });
    stray.dispose();
    assert.equal(lens.depthTextureMode, 0, 'a camera that is still there is left as it was');
    const dead = { _shaderValues: new ShaderData() };
    const deadLens = { depthTextureMode: 0 };
    const orphan = new ZhudaLightingDepth(dead, { contactShadows: 0.3 }, deadLens);
    dead.destroyed = deadLens.destroyed = true;
    dead._shaderValues = null;
    orphan.dispose();
    assert.equal(deadLens.depthTextureMode, 1, 'a destroyed camera is not touched');
  } finally {
    globalThis.Laya = before;
  }
});

test('a schedule draws the lamp that has waited longest, so many a frame', () => {
  assert.deepEqual(validateZhudaPointShadowSchedule({}), []);
  assert.deepEqual(validateZhudaPointShadowSchedule({ perFrame: 0 }), [
    'perFrame: use a whole number 1..8',
  ]);
  assert.deepEqual(validateZhudaPointShadowSchedule({ tolerance: -1 }), ['tolerance: use 0..10']);
  assert.throws(() => new ZhudaPointShadowSchedule(null), /draw function/);
  const drawn = [];
  const cleared = [];
  const schedule = new ZhudaPointShadowSchedule(
    (position, range, light) => drawn.push([light, [...position], range]),
    {},
    (light) => cleared.push(light),
  );
  assert.deepEqual(schedule.update(), [], 'no lamps, nothing to draw');
  for (let i = 0; i < 3; i++) schedule.set(i, { position: [i, 2, 0], range: 8 });
  assert.deepEqual(schedule.pending(), [0, 1, 2]);
  assert.deepEqual([schedule.update(), schedule.update(), schedule.update()], [[0], [1], [2]]);
  assert.deepEqual(drawn.at(-1), [2, [2, 2, 0], 8]);
  assert.deepEqual(schedule.update(), [], 'all up to date');
  // The same place again, or a move within the tolerance, is no reason to draw.
  schedule.set(1, { position: [1.005, 2, 0], range: 8 });
  assert.deepEqual(schedule.update(), []);
  schedule.set(1, { position: [1.5, 2, 0], range: 8 });
  schedule.set(0, { position: [0, 2, 0], range: 9 });
  // Both out of date since the same frame: the lower number first.
  assert.deepEqual([schedule.update(), schedule.update(), schedule.update()], [[0], [1], []]);
  assert.deepEqual(drawn.at(-1), [1, [1.5, 2, 0], 8]);
  // Something moved near one lamp.
  schedule.touch(2);
  assert.deepEqual(schedule.update(), [2]);
  // Then near all of them; a frame later the first one moves again: those
  // that have waited since before it go first.
  schedule.touch();
  assert.deepEqual(schedule.update(), [0]);
  schedule.set(0, { position: [0, 2.5, 0], range: 9 });
  assert.deepEqual(schedule.pending(), [1, 2, 0]);
  assert.deepEqual(schedule.flush(), [1, 2, 0], 'all at once, for a cut');
  assert.deepEqual(schedule.pending(), []);
  schedule.remove(1);
  assert.deepEqual(cleared, [1]);
  schedule.remove(1);
  assert.deepEqual(cleared, [1], 'told once');
  schedule.touch();
  assert.deepEqual(schedule.pending(), [0, 2]);
  assert.throws(() => schedule.set(-1, { position: [0, 0, 0], range: 1 }), /whole number/);
  assert.throws(() => schedule.set(0, { position: [0, 0], range: 1 }), /position and a range/);
  assert.throws(() => schedule.set(0, { position: [0, 0, 0], range: 0 }), /position and a range/);
});

test('lamps in a busy street take turns, and a new lamp goes first', () => {
  const drawn = [];
  const schedule = new ZhudaPointShadowSchedule((position, range, light) => drawn.push(light), {
    perFrame: 2,
  });
  for (let i = 0; i < 8; i++) schedule.set(i, { position: [i, 3, 0], range: 6, moving: true });
  const frames = [];
  for (let frame = 0; frame < 12; frame++) frames.push(schedule.update());
  // Two a frame: each lamp every fourth frame, in the same order every round.
  assert.deepEqual(frames.slice(0, 4), [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
  ]);
  assert.deepEqual(frames.slice(4, 8), frames.slice(0, 4));
  assert.equal(drawn.length, 24);
  // A lamp that was never drawn does not wait behind the round.
  schedule.set(20, { position: [0, 3, 5], range: 6 });
  assert.deepEqual(schedule.update(), [20, 0]);
  // A still lamp among them is drawn when it is touched, in its turn (the
  // others have been out of date for longer), and not otherwise.
  assert.ok(!schedule.pending().includes(20));
  schedule.touch(20);
  const round = [];
  for (let frame = 0; frame < 5; frame++) round.push(schedule.update());
  assert.equal(round.flat().filter((light) => light === 20).length, 1, JSON.stringify(round));
  assert.ok(!round[0].includes(20), 'not ahead of lamps that waited longer');
  assert.ok(round[4].includes(20), 'after one round of them, ahead of a lamp that waited as long');
  const next = [];
  for (let frame = 0; frame < 5; frame++) next.push(schedule.update());
  assert.ok(!next.flat().includes(20), 'and not again until it is touched');
});

const scene = (look, nodes = []) => ({
  schemaVersion: 1,
  id: 'lights',
  camera: { eye: [0, 1, 4], target: [0, 1, 0] },
  look,
  nodes,
});
const context = { materials: [] };
const spot = (extra) => ({
  id: 'lamp',
  type: 'light',
  kind: 'spot',
  position: [0, 4, 0],
  target: [0, 0, 0],
  ...extra,
});

test('a look names how its lamps fall off and how its sun shadow is finished', () => {
  const look = resolveZhudaFilmLook({ preset: 'day' });
  assert.equal(look.lightFalloff, 'laya');
  assert.deepEqual(
    [look.shadows.spread, look.shadows.blend, look.shadows.contact],
    [1, false, 0],
    'as LayaAir draws unless asked',
  );
  assert.deepEqual(zhudaLookLighting(look), {
    falloff: 'laya',
    shadowSpread: 1,
    cascadeBlend: false,
    contactShadows: 0,
  });
  const asked = resolveZhudaFilmLook({
    lightFalloff: 'physical',
    shadows: { spread: 2.5, blend: true, contact: 0.3 },
  });
  assert.deepEqual(zhudaLookLighting(asked), {
    falloff: 'physical',
    shadowSpread: 2.5,
    cascadeBlend: true,
    contactShadows: 0.3,
  });
  // A hard shadow has no edge to widen; no shadows, nothing of theirs.
  assert.equal(
    zhudaLookLighting(resolveZhudaFilmLook({ shadows: { softness: 'hard', spread: 3 } }))
      .shadowSpread,
    1,
  );
  assert.deepEqual(zhudaLookLighting(resolveZhudaFilmLook({ shadows: false })), {
    falloff: 'laya',
    shadowSpread: 1,
    cascadeBlend: false,
    contactShadows: 0,
  });
  assert.deepEqual(
    validateZhudaFilmScene(
      scene({ lightFalloff: 'physical', shadows: { spread: 2, blend: true, contact: 0.25 } }, [
        spot({ intensity: 400, penumbra: 0.2 }),
      ]),
      context,
    ),
    [],
  );
  const issues = validateZhudaFilmScene(
    scene({ lightFalloff: 'square', shadows: { spread: 5, blend: 'yes', contact: 3 } }, [
      spot({ intensity: 400, penumbra: 2 }),
      { id: 'bulb', type: 'light', kind: 'point', position: [0, 2, 0], penumbra: 0.5 },
    ]),
    context,
  );
  for (const fragment of [
    'look.lightFalloff: use laya or physical',
    'shadows.spread: use 1..4',
    'shadows.blend: use true or false',
    'shadows.contact: use 0.02..2',
    // Without the square a lamp's number is not its brightness at a metre.
    'nodes[0].intensity: use 0..20',
    'nodes[0].penumbra: spot lights only, 0..1',
    'nodes[1].penumbra: spot lights only, 0..1',
  ])
    assert.ok(
      issues.some((issue) => issue.includes(fragment)),
      `${fragment}: ${issues}`,
    );
  assert.ok(
    validateZhudaFilmScene(
      scene({ lightFalloff: 'physical' }, [spot({ intensity: 2001 })]),
      context,
    ).some((issue) => issue.includes('intensity: use 0..2000')),
  );
  assert.deepEqual(
    validateZhudaFilmScene(scene({ shadows: { contact: 0 } }), context),
    [],
    '0 is none',
  );
});

test('lighting values change in a running look; lower quality levels drop what costs', () => {
  const base = { preset: 'day', grade: {} };
  const reason = (to) =>
    zhudaFilmLookRebuildReason(resolveZhudaFilmLook(base), resolveZhudaFilmLook(to));
  assert.equal(reason({ ...base, lightFalloff: 'physical' }), null);
  assert.equal(reason({ ...base, shadows: { spread: 3, blend: true, contact: 0.4 } }), null);
  const look = resolveZhudaFilmLook({
    ...base,
    lightFalloff: 'physical',
    shadows: { spread: 3, blend: true, contact: 0.4 },
  });
  assert.deepEqual(zhudaLookLighting(zhudaLookForQuality(look, 3)), zhudaLookLighting(look));
  assert.deepEqual(zhudaLookLighting(zhudaLookForQuality(look, 2)), zhudaLookLighting(look));
  assert.deepEqual(zhudaLookLighting(zhudaLookForQuality(look, 1)), {
    falloff: 'physical',
    shadowSpread: 1,
    cascadeBlend: true,
    contactShadows: 0,
  });
  // How bright a lamp is does not change with the level.
  assert.deepEqual(zhudaLookLighting(zhudaLookForQuality(look, 0)), {
    falloff: 'physical',
    shadowSpread: 1,
    cascadeBlend: false,
    contactShadows: 0,
  });
});
