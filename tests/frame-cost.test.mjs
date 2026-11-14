// Shadow update rules, the render scale and its upscale, and the quality
// ladder that walks both (record frame-cost). The draws are checked by
// verify:shadow-updates and verify:render-scale; these are the rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaShadowUpdates,
  installLaya342SkippedShadowFrames,
  zhudaShadowFrameDraws,
  zhudaShadowUpdateOptions,
} from '../packages/core/runtime3d/ShadowUpdates.ts';
import {
  ZhudaRenderScale,
  zhudaRenderScaleOptions,
  zhudaRenderScaleSize,
} from '../packages/core/runtime3d/RenderScale.ts';
import {
  ZhudaQualityGovernor,
  zhudaQualitySteps,
} from '../packages/core/runtime3d/QualityGovernor.ts';
import {
  parseZhudaFilmScene,
  resolveZhudaFilmLook,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { updateZhudaLookInPlace } from '../packages/core/film/LiveLook.ts';

/** A LayaAir 3.4.2 stand-in with what the shadow rule touches. */
function fakeShadowLaya() {
  class Process {
    _initRenderPass(camera, context) {
      // LayaAir's own: the uniform set loses Shadow on a frame that keeps the maps.
      if (this._renderPass.shadowCastPass) context.preDrawUniformMaps.add('Shadow');
      else context.preDrawUniformMaps.delete('Shadow');
      return 'drawn';
    }
  }
  return { Stat: { loopCount: 0, enableShadow: true }, WebRender3DProcess: Process };
}
const fakeScene = () => ({
  _ShadowMapupdateFrequency: 1,
  get shadowMapFrequency() {
    return this._ShadowMapupdateFrequency;
  },
});
/** LayaAir's frame test for one camera drawn: does this frame draw the maps? */
const draws = (scene, mark = 7) => mark % scene._ShadowMapupdateFrequency === 0;

test('shadow update options are checked and filled in', () => {
  assert.deepEqual(zhudaShadowUpdateOptions(), { mode: 'every', interval: 3 });
  assert.deepEqual(zhudaShadowUpdateOptions({ mode: 'interval', interval: 5 }), {
    mode: 'interval',
    interval: 5,
  });
  for (const bad of [{ mode: 'sometimes' }, { interval: 1 }, { interval: 31 }, { interval: 2.5 }])
    assert.throws(() => zhudaShadowUpdateOptions(bad), /Shadow update/);
});

test('which frames draw the maps: every one, every third, or when asked', () => {
  const run = (options, frames, asked = []) => {
    const out = [];
    let since = 0;
    for (let i = 0; i < frames; i++) {
      const d = zhudaShadowFrameDraws(options, since, asked.includes(i));
      out.push(d ? 1 : 0);
      since = d ? 0 : since + 1;
    }
    return out.join('');
  };
  assert.equal(run({ mode: 'every', interval: 3 }, 6), '111111');
  assert.equal(run({ mode: 'interval', interval: 3 }, 9, [0]), '100100100');
  assert.equal(run({ mode: 'interval', interval: 2 }, 6, [0]), '101010');
  // A request draws at once and the count starts again from it.
  assert.equal(run({ mode: 'interval', interval: 3 }, 9, [0, 4]), '100110010');
  assert.equal(run({ mode: 'manual', interval: 3 }, 6, [0, 3]), '100100');
});

test('the rule answers LayaAir once a frame, the same for every view in it', () => {
  const l = fakeShadowLaya();
  globalThis.Laya = l;
  const scene = fakeScene();
  const rule = new ZhudaShadowUpdates(scene, { mode: 'interval', interval: 3 });
  const seen = [];
  for (let frame = 1; frame <= 6; frame++) {
    l.Stat.loopCount = frame;
    // Two views of one frame (a mirror, then the camera) get one answer.
    const first = draws(scene, 10 + frame),
      second = draws(scene, 11 + frame);
    assert.equal(first, second);
    seen.push(first ? 1 : 0);
  }
  assert.equal(seen.join(''), '100100');
  assert.deepEqual(rule.stats, { frames: 6, drawn: 2 });
  // A view drawn with shadows off neither draws nor counts.
  l.Stat.enableShadow = false;
  l.Stat.loopCount = 7;
  draws(scene);
  l.Stat.enableShadow = true;
  assert.deepEqual(rule.stats, { frames: 6, drawn: 2 });
  l.Stat.loopCount = 8;
  assert.equal(draws(scene), true, 'the third frame drawn with shadows on');
  // Asked within a frame that keeps the maps (a capture's next sample): drawn from there on.
  l.Stat.loopCount = 9;
  assert.equal(draws(scene), false);
  rule.redraw();
  assert.equal(draws(scene), true);
  assert.equal(draws(scene), true);
  assert.deepEqual(rule.stats, { frames: 8, drawn: 4 });
  // Manual: nothing until asked.
  rule.set({ mode: 'manual' });
  l.Stat.loopCount = 10;
  assert.equal(draws(scene), true, 'a changed rule draws once');
  for (const frame of [11, 12, 13]) {
    l.Stat.loopCount = frame;
    assert.equal(draws(scene), false);
  }
  rule.redraw();
  rule.redraw();
  l.Stat.loopCount = 14;
  assert.equal(draws(scene), true);
  l.Stat.loopCount = 15;
  assert.equal(draws(scene), false, 'two requests before a frame draw once');
  // Every frame is LayaAir's own path: no accessor on the scene.
  rule.set({ mode: 'every' });
  assert.equal(Object.getOwnPropertyDescriptor(scene, '_ShadowMapupdateFrequency').get, undefined);
  assert.equal(scene.shadowMapFrequency, 1);
  rule.set({ mode: 'interval', interval: 2 });
  // A frequency the game sets itself is kept for when the rule goes.
  scene._ShadowMapupdateFrequency = 4;
  rule.dispose();
  rule.dispose();
  assert.equal(Object.getOwnPropertyDescriptor(scene, '_ShadowMapupdateFrequency').value, 4);
  assert.throws(() => rule.redraw(), /Disposed/);
  assert.throws(() => rule.set({ mode: 'manual' }), /Disposed/);
  delete globalThis.Laya;
});

test('one rule a scene, and only on a LayaAir 3.4.2 scene and render process', () => {
  globalThis.Laya = fakeShadowLaya();
  const scene = fakeScene();
  const rule = new ZhudaShadowUpdates(scene, { mode: 'manual' });
  assert.throws(() => new ZhudaShadowUpdates(scene), /has one already/);
  rule.dispose();
  new ZhudaShadowUpdates(scene).dispose();
  assert.throws(() => new ZhudaShadowUpdates({}), /3\.4\.2 Scene3D/);
  assert.throws(() => new ZhudaShadowUpdates(fakeScene(), { mode: 'x' }), /mode is every/);
  globalThis.Laya = { Stat: { loopCount: 0, enableShadow: true } };
  assert.throws(() => new ZhudaShadowUpdates(fakeScene()), /no 3\.4\.2 render process/);
  delete globalThis.Laya;
});

test('a frame that keeps the maps keeps the shadow uniforms', () => {
  const l = fakeShadowLaya();
  assert.equal(installLaya342SkippedShadowFrames(l), true);
  assert.equal(installLaya342SkippedShadowFrames(l), true, 'installed once');
  assert.equal(installLaya342SkippedShadowFrames({}), false);
  const process = new l.WebRender3DProcess();
  const context = { preDrawUniformMaps: new Set(['Scene3D', 'Shadow']) };
  const frame = (pass) => {
    process._renderPass = pass;
    assert.equal(process._initRenderPass({}, context), 'drawn');
    return context.preDrawUniformMaps.has('Shadow');
  };
  assert.equal(frame({ shadowCastPass: true, enableDirectLightShadow: true }), true);
  // The maps of an earlier frame are in use: the uniforms stay.
  assert.equal(frame({ shadowCastPass: false, enableDirectLightShadow: true }), true);
  assert.equal(frame({ shadowCastPass: false, enableSpotLightShadowPass: true }), true);
  // No shadow pass in use, or a view drawn with shadows off: LayaAir's own.
  assert.equal(frame({ shadowCastPass: false }), false);
  l.Stat.enableShadow = false;
  assert.equal(frame({ shadowCastPass: false, enableDirectLightShadow: true }), false);
});

test('the look takes shadows.update and interval, checked, set in place between rules', () => {
  const look = (shadows) =>
    parseZhudaFilmScene({
      schemaVersion: 1,
      id: 'look',
      camera: { eye: [0, 1, 5], target: [0, 0, 0] },
      look: { preset: 'day', shadows },
      nodes: [],
    }).look;
  assert.equal(resolveZhudaFilmLook({ preset: 'day' }).shadows.update, 'every');
  assert.equal(resolveZhudaFilmLook({ preset: 'day' }).shadows.interval, 3);
  assert.equal(resolveZhudaFilmLook({ shadows: {} }).shadows.update, 'every');
  assert.deepEqual(look({ update: 'interval', interval: 4 }).shadows, {
    update: 'interval',
    interval: 4,
  });
  assert.throws(() => look({ update: 'often' }), /shadows\.update: use every, interval or manual/);
  assert.throws(
    () => look({ interval: 1 }),
    /shadows\.interval: use a whole number of frames 2\.\.30/,
  );
  assert.throws(() => look({ interval: 3.5 }), /shadows\.interval/);
  const reason = (a, b) =>
    zhudaFilmLookRebuildReason(
      resolveZhudaFilmLook({ preset: 'day', shadows: a }),
      resolveZhudaFilmLook({ preset: 'day', shadows: b }),
    );
  // Every frame is LayaAir's own path: taking a rule on or off rebuilds the shadows.
  assert.equal(reason({}, { update: 'interval' }), 'shadows');
  assert.equal(reason({ update: 'manual' }, {}), 'shadows');
  assert.equal(reason({ update: 'interval' }, { update: 'manual' }), null);
  assert.equal(
    reason({ update: 'interval', interval: 2 }, { update: 'interval', interval: 6 }),
    null,
  );
});

test('a look updated in place sets the rule and draws the maps again when the sun moves', () => {
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  class Color {
    constructor(...rgba) {
      this.rgba = rgba;
    }
  }
  const l = {
    Vector3,
    Color,
    ShadowMode: { Hard: 1, SoftHigh: 2 },
    ShadowCascadesMode: { NoCascades: 0, TwoCascades: 1, FourCascades: 2 },
  };
  const calls = [];
  const rule = {
    mode: 'interval',
    interval: 3,
    set: (options) => calls.push(['set', options]),
    redraw: () => calls.push(['redraw']),
  };
  const target = {
    scene3D: {},
    camera: {},
    sun: { owner: { transform: {} } },
    parts: { shadowUpdates: rule },
  };
  const at = (shadows, sun = {}) =>
    resolveZhudaFilmLook({ preset: 'day', shadows: { update: 'interval', ...shadows }, sun });
  updateZhudaLookInPlace(l, target, at({}));
  assert.deepEqual(calls, [['redraw']], 'the first look draws');
  calls.length = 0;
  updateZhudaLookInPlace(l, target, at({}));
  assert.deepEqual(calls, [], 'the same look keeps the maps');
  updateZhudaLookInPlace(l, target, at({}, { azimuthDeg: 200 }));
  assert.deepEqual(calls, [['redraw']], 'the sun moved');
  calls.length = 0;
  updateZhudaLookInPlace(l, target, at({ distance: 30 }, { azimuthDeg: 200 }));
  assert.deepEqual(calls, [['redraw']], 'the shadow settings changed');
  calls.length = 0;
  updateZhudaLookInPlace(l, target, at({ update: 'manual', distance: 30 }, { azimuthDeg: 200 }));
  assert.deepEqual(calls, [['set', { mode: 'manual', interval: 3 }]], 'a new rule, same maps');
});

test('render scale options are checked; the picture size follows LayaAir rounding', () => {
  assert.deepEqual(zhudaRenderScaleOptions(), { scale: 1, upscale: 'fsr', sharpness: 0.8 });
  for (const bad of [
    { scale: 0.4 },
    { scale: 1.2 },
    { scale: Number.NaN },
    { upscale: 'lanczos' },
    { sharpness: -0.1 },
    { sharpness: 1.5 },
  ])
    assert.throws(() => zhudaRenderScaleOptions(bad), /Render scale/);
  assert.deepEqual(zhudaRenderScaleSize(617, 1200, 0.67), { width: 413, height: 804 });
  assert.deepEqual(zhudaRenderScaleSize(600, 360, 0.67), { width: 402, height: 241 });
});

/** A LayaAir stand-in with what the render scale touches; `log` records the passes. */
function fakeScaleLaya(invertY = false) {
  const log = [];
  class Vector4 {
    constructor(x = 0, y = 0, z = 0, w = 0) {
      this.setValue(x, y, z, w);
    }
    setValue(x, y, z, w) {
      Object.assign(this, { x, y, z, w });
    }
  }
  class Viewport {
    constructor(x, y, width, height) {
      Object.assign(this, { x, y, width, height });
    }
  }
  class RenderTexture {
    constructor(width, height) {
      Object.assign(this, { width, height, destroyed: false });
      log.push(['target', width, height]);
    }
    destroy() {
      this.destroyed = true;
      log.push(['destroy', this.width, this.height]);
    }
  }
  const shaders = new Map();
  const l = {
    Config3D: { pixelRatio: 1 },
    RenderContext3D: { clientWidth: 600, clientHeight: 360 },
    Vector4,
    Viewport,
    RenderTexture,
    RenderTexture2D: { _clear: true },
    FilterMode: { Bilinear: 1, Point: 0 },
    WrapMode: { Clamp: 1 },
    RenderTargetFormat: { R8G8B8A8: 1, None: 0 },
    ShaderFeatureType: { PostProcess: 1 },
    ShaderDataType: { Vector4: 1, Texture2D: 2 },
    VertexMesh: { MESH_POSITION0: 0 },
    RenderState: { DEPTHTEST_ALWAYS: 1, CULL_NONE: 0, BLEND_DISABLE: 0 },
    SubShader: class {
      addShaderPass(vs, fs) {
        this.fragment = fs;
        return { renderState: {} };
      }
    },
    Shader3D: {
      add: (name) => {
        const shader = { name, addSubShader: (sub) => (shader.sub = sub) };
        shaders.set(name, shader);
        return shader;
      },
      find: (name) => shaders.get(name),
      propertyNameToID: () => 7,
    },
    LayaGL: {
      renderEngine: { _screenInvertY: invertY },
      renderDeviceFactory: {
        createShaderData: () => ({ setVector() {}, destroy: () => log.push(['data destroyed']) }),
      },
    },
    BlitFrameBufferCMD: {
      create: (from, to, at, offsetScale, shader) => ({
        run: () =>
          log.push([
            shader.name,
            from.name ?? `${from.width}x${from.height}`,
            to ? `${to.width}x${to.height}` : 'canvas',
            [at.x, at.y, at.width, at.height],
            offsetScale ? [offsetScale.x, offsetScale.y, offsetScale.z, offsetScale.w] : null,
          ]),
        recover() {},
      }),
    },
  };
  return { l, log, shaders };
}
function fakeScaleScene(log) {
  class Scene {
    blitMainCanvas(source) {
      log.push(['native', source.name]);
    }
  }
  return new Scene();
}
const full = { x: 0, y: 0, width: 1, height: 1 };

test('the render scale draws FSR in two passes at canvas size, and gives everything back', () => {
  const { l, log, shaders } = fakeScaleLaya();
  globalThis.Laya = l;
  const scene = fakeScaleScene(log);
  const source = { name: 'camera' };
  const scaled = new ZhudaRenderScale(scene, { scale: 0.67 });
  assert.equal(l.Config3D.pixelRatio, 0.67);
  assert.ok(shaders.get('ZhudaUpscaleEasu').sub.fragment.includes('zhudaEdge'));
  assert.ok(shaders.get('ZhudaUpscaleRcas').sub.fragment.includes('outputTransform'));
  scene.blitMainCanvas(source, full, {});
  scene.blitMainCanvas(source, full, {});
  assert.deepEqual(log, [
    ['target', 600, 360],
    ['ZhudaUpscaleEasu', 'camera', '600x360', [0, 0, 600, 360], null],
    ['ZhudaUpscaleRcas', '600x360', 'canvas', [0, 0, 600, 360], null],
    // The next frame reuses the target.
    ['ZhudaUpscaleEasu', 'camera', '600x360', [0, 0, 600, 360], null],
    ['ZhudaUpscaleRcas', '600x360', 'canvas', [0, 0, 600, 360], null],
  ]);
  assert.equal(l.RenderTexture2D._clear, false);
  assert.equal(source.filterMode, l.FilterMode.Bilinear);
  log.length = 0;
  // A half-height view at the top of the canvas: its target is filled from the corner.
  scene.blitMainCanvas(source, { x: 0, y: 0, width: 1, height: 0.5 }, {});
  assert.deepEqual(log.slice(0, 3), [
    ['destroy', 600, 360],
    ['target', 600, 180],
    ['ZhudaUpscaleEasu', 'camera', '600x180', [0, 180, 600, 180], null],
  ]);
  log.length = 0;
  scaled.set({ upscale: 'bilinear' });
  assert.deepEqual(log, [['destroy', 600, 180]], 'one pass needs no target');
  log.length = 0;
  scene.blitMainCanvas(source, full, {});
  assert.deepEqual(log, [['ZhudaUpscaleBilinear', 'camera', 'canvas', [0, 0, 600, 360], null]]);
  log.length = 0;
  for (const options of [{ upscale: 'plain' }, { upscale: 'fsr', scale: 1 }]) {
    scaled.set(options);
    scene.blitMainCanvas(source, full, {});
  }
  scaled.set({ scale: 0.8 });
  scene.blitMainCanvas(source, full, { fxaa: true });
  assert.deepEqual(
    log.filter((entry) => entry[0] === 'native'),
    [
      ['native', 'camera'],
      ['native', 'camera'],
      ['native', 'camera'],
    ],
    'plain, full size and LayaAir edge smoothing use LayaAir stretch',
  );
  assert.equal(l.Config3D.pixelRatio, 0.8);
  assert.throws(() => new ZhudaRenderScale(fakeScaleScene(log)), /stage has one already/);
  assert.throws(() => scaled.set({ scale: 0.3 }), /use 0\.5\.\.1/);
  scaled.dispose();
  scaled.dispose();
  assert.equal(l.Config3D.pixelRatio, 1);
  assert.equal(Object.hasOwn(scene, 'blitMainCanvas'), false);
  assert.equal(log.filter((entry) => entry[0] === 'data destroyed').length, 3);
  assert.throws(() => scaled.set({ scale: 0.7 }), /Disposed/);
  // Free again for another.
  new ZhudaRenderScale(scene, { scale: 0.5 }).dispose();
  assert.throws(() => new ZhudaRenderScale({}), /3\.4\.2 Scene3D/);
  delete globalThis.Laya;
});

test('on WebGPU the first pass is turned over so that the second turns it back', () => {
  const { l, log } = fakeScaleLaya(true);
  globalThis.Laya = l;
  const scene = fakeScaleScene(log);
  const scaled = new ZhudaRenderScale(scene, { scale: 0.5 });
  scene.blitMainCanvas({ name: 'camera' }, { x: 0, y: 0, width: 1, height: 0.5 }, {});
  assert.deepEqual(log[1], [
    'ZhudaUpscaleEasu',
    'camera',
    '600x180',
    [0, 0, 600, 180],
    [0, 1, 1, -1],
  ]);
  scaled.dispose();
  delete globalThis.Laya;
});

test('the quality ladder: smaller first, then effects, then smaller again', () => {
  const steps = zhudaQualitySteps();
  assert.deepEqual(
    steps.map((s) => [s.look, s.renderScale]),
    [
      [0, 0.5],
      [0, 0.7],
      [1, 0.7],
      [2, 0.7],
      [3, 0.7],
      [3, 0.85],
      [3, 1],
    ],
  );
  assert.deepEqual(
    zhudaQualitySteps({ scales: [1], lowest: false }).map((s) => [s.look, s.renderScale]),
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    'without scales the ladder is the look levels',
  );
  for (const bad of [
    { scales: [] },
    { scales: [1, 1] },
    { scales: [0.7, 1] },
    { scales: [1, 0.4] },
    { scales: [1, 0.7], lowest: 0.8 },
    { lowest: 0.3 },
  ])
    assert.throws(() => zhudaQualitySteps(bad), /Quality steps/);
});

test('a governor over the ladder steps through the render scales before any effect goes', () => {
  const steps = zhudaQualitySteps();
  const governor = new ZhudaQualityGovernor({ levels: steps.length, budgetMs: 16.7, window: 30 });
  const walked = [steps[governor.level]];
  // Frames of 30 ms: one rung down a window, to the bottom.
  for (let i = 0; i < 30 * 10; i++) {
    const level = governor.sample(30);
    if (level !== undefined) walked.push(steps[level]);
  }
  assert.deepEqual(
    walked.map((s) => `${s.look}@${s.renderScale}`),
    ['3@1', '3@0.85', '3@0.7', '2@0.7', '1@0.7', '0@0.7', '0@0.5'],
  );
  // Calm frames walk it back up, one rung at a time.
  const up = [];
  for (let i = 0; i < 60 * 60; i++) {
    const level = governor.sample(8);
    if (level !== undefined) up.push(level);
  }
  assert.deepEqual(up, [1, 2, 3, 4, 5, 6]);
});
