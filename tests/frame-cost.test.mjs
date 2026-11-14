// Shadow update rules, the render scale and its upscale, and the quality
// ladder that walks both (record frame-cost). The draws are checked by
// verify:shadow-updates and verify:render-scale; these are the rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaShadowUpdates,
  installLaya342SkippedShadowFrames,
  zhudaShadowBorrower,
  zhudaShadowFrameDraws,
  zhudaShadowUpdateOptions,
} from '../packages/core/runtime3d/ShadowUpdates.ts';
import { ZhudaPlanarReflection } from '../packages/core/runtime3d/Filmic.ts';
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
  const l = { Stat: { loopCount: 0, enableShadow: true }, mark: 7 };
  class Process {
    constructor() {
      this._renderPass = {};
    }
    _initRenderPass(camera, context) {
      // LayaAir's own: the frame test, once per camera drawn; the uniform set
      // loses Shadow on a frame that keeps the maps.
      const cast = l.mark % camera.scene._ShadowMapupdateFrequency === 0 && l.Stat.enableShadow;
      this._renderPass.shadowCastPass = cast;
      if (cast) {
        this._renderPass.enableDirectLightShadow = true;
        context.preDrawUniformMaps.add('Shadow');
      } else context.preDrawUniformMaps.delete('Shadow');
      return 'drawn';
    }
  }
  l.WebRender3DProcess = Process;
  return l;
}
const fakeScene = () => ({
  _ShadowMapupdateFrequency: 1,
  get shadowMapFrequency() {
    return this._ShadowMapupdateFrequency;
  },
  set shadowMapFrequency(value) {
    this._ShadowMapupdateFrequency = value;
  },
});
/** A camera of the scene; one with a `renderTarget` does not draw to the canvas. */
const fakeCamera = (scene, renderTarget) => ({ scene, renderTarget });
/** One camera drawn, as LayaAir draws it: does it draw the shadow maps first? */
function drawing(l) {
  const process = new l.WebRender3DProcess();
  const context = { preDrawUniformMaps: new Set() };
  return (camera) => {
    process._initRenderPass(camera, context);
    return process._renderPass.shadowCastPass;
  };
}

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

test('the rule answers LayaAir once a frame for the view it keeps the maps for', () => {
  const l = fakeShadowLaya();
  globalThis.Laya = l;
  const scene = fakeScene();
  const view = fakeCamera(scene);
  const rule = new ZhudaShadowUpdates(scene, { mode: 'interval', interval: 3 }, view);
  const draws = drawing(l);
  const seen = [];
  for (let frame = 1; frame <= 6; frame++) {
    l.Stat.loopCount = frame;
    // LayaAir's own mark runs on with every camera drawn: it does not matter.
    l.mark += 5;
    seen.push(draws(view) ? 1 : 0);
  }
  assert.equal(seen.join(''), '100100');
  assert.deepEqual(rule.stats, { frames: 6, drawn: 2, taken: 0 });
  // A view drawn with shadows off neither draws nor counts.
  l.Stat.enableShadow = false;
  l.Stat.loopCount = 7;
  assert.equal(draws(view), false);
  l.Stat.enableShadow = true;
  assert.deepEqual(rule.stats, { frames: 6, drawn: 2, taken: 0 });
  l.Stat.loopCount = 8;
  assert.equal(draws(view), true, 'the third frame drawn with shadows on');
  // Asked within a frame that keeps the maps (a capture's next sample): drawn from there on.
  l.Stat.loopCount = 9;
  assert.equal(draws(view), false);
  rule.redraw();
  assert.equal(draws(view), true);
  assert.equal(draws(view), true);
  assert.deepEqual(rule.stats, { frames: 8, drawn: 4, taken: 0 });
  // Manual: nothing until asked.
  rule.set({ mode: 'manual' });
  l.Stat.loopCount = 10;
  assert.equal(draws(view), true, 'a changed rule draws once');
  for (const frame of [11, 12, 13]) {
    l.Stat.loopCount = frame;
    assert.equal(draws(view), false);
  }
  rule.redraw();
  rule.redraw();
  l.Stat.loopCount = 14;
  assert.equal(draws(view), true);
  l.Stat.loopCount = 15;
  assert.equal(draws(view), false, 'two requests before a frame draw once');
  // Read by the game, the frequency is what the game set; it uses up no frame.
  const before = rule.stats;
  assert.equal(scene.shadowMapFrequency, 1);
  scene.shadowMapFrequency = 4;
  assert.equal(scene.shadowMapFrequency, 4);
  assert.deepEqual(rule.stats, before);
  // Every frame is LayaAir's own path: no accessor on the scene.
  rule.set({ mode: 'every' });
  assert.equal(Object.getOwnPropertyDescriptor(scene, '_ShadowMapupdateFrequency').get, undefined);
  assert.equal(scene.shadowMapFrequency, 4);
  rule.set({ mode: 'interval', interval: 2 });
  // A frequency the game sets itself is kept for when the rule goes.
  scene.shadowMapFrequency = 5;
  rule.dispose();
  rule.dispose();
  assert.equal(Object.getOwnPropertyDescriptor(scene, '_ShadowMapupdateFrequency').value, 5);
  assert.throws(() => rule.redraw(), /Disposed/);
  assert.throws(() => rule.set({ mode: 'manual' }), /Disposed/);
  delete globalThis.Laya;
});

test('another camera draws maps of its own and the view draws its maps again', () => {
  const l = fakeShadowLaya();
  globalThis.Laya = l;
  const scene = fakeScene();
  const view = fakeCamera(scene),
    mirror = fakeCamera(scene, {}),
    probe = fakeCamera(scene, {});
  const rule = new ZhudaShadowUpdates(scene, { mode: 'interval', interval: 3 }, view);
  const draws = drawing(l);
  assert.equal(rule.lends, false, 'nothing drawn yet');
  // A game: the view is drawn, then the tick draws a mirror, in the same LayaAir frame.
  const frames = (count, other) => {
    const seen = [];
    for (let i = 0; i < count; i++) {
      l.Stat.loopCount++;
      seen.push([draws(view), draws(other)].map(Number).join(''));
    }
    return seen.join(' ');
  };
  // The mirror draws its own maps every frame, so the view has to as well.
  assert.equal(frames(4, mirror), '11 11 11 11');
  assert.deepEqual(rule.stats, { frames: 4, drawn: 4, taken: 3 });
  // A mirror that borrows reads the view's maps: only the rule's frames draw.
  zhudaShadowBorrower(mirror);
  assert.equal(frames(6, mirror), '10 00 00 10 00 00');
  assert.deepEqual(rule.stats, { frames: 10, drawn: 6, taken: 4 });
  assert.equal(rule.lends, true);
  // While a drawing is pending it draws its own (a film still asks before its mirror).
  rule.redraw();
  assert.equal(rule.lends, false);
  l.Stat.loopCount++;
  assert.equal(draws(mirror), true);
  assert.equal(draws(view), true);
  assert.equal(draws(mirror), false, 'the maps are those of the view again');
  // A probe: six views by another camera, each a LayaAir frame of its own.
  for (let face = 0; face < 6; face++) {
    l.Stat.loopCount++;
    assert.equal(draws(probe), true, 'every view of a capture has its own maps');
  }
  assert.equal(rule.lends, false, 'the maps in place are those of the probe');
  l.Stat.loopCount++;
  assert.equal(draws(mirror), true, 'no maps of the view to borrow');
  assert.equal(draws(view), true, 'the view draws its maps again');
  l.Stat.loopCount++;
  assert.equal(draws(view), false);
  assert.equal(draws(mirror), false);
  // Taken within a frame that kept them: drawn when the view is drawn again in it.
  assert.equal(draws(probe), true);
  assert.equal(draws(view), true);
  // On request only: the same, and a probe does not wait to be asked.
  rule.set({ mode: 'manual' });
  l.Stat.loopCount++;
  assert.equal(draws(view), true);
  l.Stat.loopCount++;
  assert.equal([draws(view), draws(mirror), draws(probe)].join(), 'false,false,true');
  l.Stat.loopCount++;
  assert.equal(draws(view), true);
  l.Stat.loopCount++;
  assert.equal(draws(view), false);
  // The name can be taken away again.
  zhudaShadowBorrower(mirror, false);
  assert.equal(draws(mirror), true);
  assert.throws(() => zhudaShadowBorrower(null), /a camera is required/);
  rule.dispose();
  assert.equal(rule.lends, false);
  delete globalThis.Laya;
});

test('without a view of its own the rule keeps the maps for a camera on the canvas', () => {
  const l = fakeShadowLaya();
  globalThis.Laya = l;
  const scene = fakeScene();
  const left = fakeCamera(scene),
    right = fakeCamera(scene),
    capture = fakeCamera(scene, {});
  const rule = new ZhudaShadowUpdates(scene, { mode: 'interval', interval: 2 });
  const draws = drawing(l);
  const seen = [];
  for (let frame = 1; frame <= 4; frame++) {
    l.Stat.loopCount = frame;
    seen.push(draws(left) ? 1 : 0);
  }
  assert.equal(seen.join(''), '1010');
  // A camera drawing to a target is not a view: it draws its own.
  assert.equal(draws(capture), true);
  l.Stat.loopCount = 5;
  assert.equal(draws(left), true);
  // Two cameras on the canvas take the maps from each other: once the second
  // is drawn, every frame draws for both.
  l.Stat.loopCount = 6;
  assert.equal([draws(left), draws(right)].join(), 'false,true');
  for (let frame = 7; frame <= 9; frame++) {
    l.Stat.loopCount = frame;
    assert.equal([draws(left), draws(right)].join(), 'true,true');
  }
  assert.equal(rule.stats.taken, 4);
  rule.dispose();
  delete globalThis.Laya;
});

test('a mirror borrows the kept maps unless it is told about its shadows', () => {
  const l = fakeShadowLaya();
  const shadowsOn = [];
  class Camera {
    constructor() {
      this.transform = {};
    }
    destroy() {}
    static drawRenderTextureByScene(camera) {
      shadowsOn.push(l.Stat.enableShadow);
      camera.cast = draws(camera);
    }
  }
  Object.assign(l, {
    Camera,
    RenderTexture: class {
      destroy() {}
    },
    RenderTargetFormat: { R16G16B16A16: 1, DEPTH_16: 2 },
    RenderCapable: { RenderTextureFormat_R16G16B16A16: 1 },
    LayaGL: { renderEngine: { getCapable: () => true } },
  });
  globalThis.Laya = l;
  const scene = { ...fakeScene(), addChild() {} };
  const view = fakeCamera(scene);
  const rule = new ZhudaShadowUpdates(scene, { mode: 'manual' }, view);
  const draws = drawing(l);
  const mirror = (shadows) => {
    const made = new ZhudaPlanarReflection(scene, {
      width: 64,
      height: 36,
      excludedLayer: 29,
      manual: true,
      ...(shadows === undefined ? {} : { shadows }),
    });
    made.camera.scene = scene;
    return made;
  };
  const left = mirror(),
    own = mirror(true),
    none = mirror(false);
  l.Stat.loopCount = 1;
  assert.equal(draws(view), true);
  // Left out: it reads the view's kept maps, with shadows on.
  left.draw();
  assert.equal(left.camera.cast, false);
  assert.equal(rule.lends, true);
  // False: drawn with shadows switched off, as before; nothing is taken.
  none.draw();
  assert.equal(none.camera.cast, false);
  assert.equal(rule.lends, true);
  assert.deepEqual(shadowsOn, [true, false]);
  assert.equal(l.Stat.enableShadow, true, 'switched back on after the draw');
  // True: maps of its own, and the view's are gone.
  own.draw();
  assert.equal(own.camera.cast, true);
  assert.equal(rule.lends, false);
  left.draw();
  assert.equal(left.camera.cast, true, 'nothing of the view to borrow: its own');
  l.Stat.loopCount = 2;
  assert.equal(draws(view), true, 'the view draws its maps again');
  assert.deepEqual(rule.stats, { frames: 2, drawn: 2, taken: 1 });
  // Without a rule every mirror but the one told not to draws its own, as before.
  rule.dispose();
  left.draw();
  own.draw();
  none.draw();
  assert.deepEqual([left.camera.cast, own.camera.cast, none.camera.cast], [true, true, false]);
  for (const made of [left, own, none]) made.dispose();
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
  assert.throws(() => new ZhudaShadowUpdates(fakeScene(), {}, 'camera'), /the view is a camera/);
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
  const context = { preDrawUniformMaps: new Set(['Scene3D']) };
  const scene = fakeScene();
  const frame = (frequency, flags = {}) => {
    scene._ShadowMapupdateFrequency = frequency;
    Object.assign(process._renderPass, {
      enableDirectLightShadow: false,
      enableSpotLightShadowPass: false,
      ...flags,
    });
    assert.equal(process._initRenderPass(fakeCamera(scene), context), 'drawn');
    return context.preDrawUniformMaps.has('Shadow');
  };
  assert.equal(frame(1), true, 'a frame that draws the maps');
  // The maps of an earlier frame are in use: the uniforms stay.
  assert.equal(frame(Infinity, { enableDirectLightShadow: true }), true);
  assert.equal(frame(Infinity, { enableSpotLightShadowPass: true }), true);
  // No shadow pass in use, or a view drawn with shadows off: LayaAir's own.
  assert.equal(frame(Infinity), false);
  l.Stat.enableShadow = false;
  assert.equal(frame(Infinity, { enableDirectLightShadow: true }), false);
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
    destroy(children) {
      this.destroyed = true;
      log.push(['scene destroyed', children]);
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

test('a scene destroyed while it holds the render scale gives it back', () => {
  const { l, log } = fakeScaleLaya();
  globalThis.Laya = l;
  const scene = fakeScaleScene(log);
  const scaled = new ZhudaRenderScale(scene, { scale: 0.67 });
  scene.blitMainCanvas({ name: 'camera' }, full, {});
  log.length = 0;
  // The look is never disposed: the scene's own destruction gives the scale back.
  scene.destroy(true);
  assert.deepEqual(log, [
    ['destroy', 600, 360],
    ...Array(3).fill(['data destroyed']),
    ['scene destroyed', true],
  ]);
  assert.equal(l.Config3D.pixelRatio, 1);
  assert.equal(Object.hasOwn(scene, 'destroy'), false);
  assert.equal(Object.hasOwn(scene, 'blitMainCanvas'), false);
  scaled.dispose();
  assert.throws(() => scaled.set({ scale: 0.7 }), /Disposed/);
  // The stage's scale is free for another scene, and a late dispose leaves that one alone.
  const next = fakeScaleScene(log);
  const other = new ZhudaRenderScale(next, { scale: 0.8 });
  scaled.dispose();
  assert.equal(l.Config3D.pixelRatio, 0.8);
  // Destroyed without `destroy()` being called on it (its flag only): the next one takes over.
  next.destroyed = true;
  const third = new ZhudaRenderScale(fakeScaleScene(log), { scale: 0.6 });
  assert.equal(l.Config3D.pixelRatio, 0.6);
  assert.throws(() => other.set({ scale: 0.7 }), /Disposed/);
  // A scene with a `destroy` of its own gets that one back.
  const own = fakeScaleScene(log);
  third.dispose();
  const mine = () => 'mine';
  own.destroy = mine;
  new ZhudaRenderScale(own, { scale: 0.9 }).dispose();
  assert.equal(own.destroy, mine);
  assert.equal(l.Config3D.pixelRatio, 1);
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
