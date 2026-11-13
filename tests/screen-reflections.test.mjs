// Screen-space reflections: the options, their place in a film look and the
// uniforms the effect writes. Pure checks; the draw is verify:film-reflections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaScreenReflections,
  resolveZhudaScreenReflections,
  validateZhudaScreenReflections,
} from '../packages/core/runtime3d/ScreenReflections.ts';
import {
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';

test('options have defaults and refuse values out of range', () => {
  assert.deepEqual(resolveZhudaScreenReflections(), {
    strength: 1,
    wetness: 0.5,
    distance: 30,
    steps: 32,
    sky: 0,
    skyColor: [0, 0, 0],
  });
  assert.deepEqual(
    validateZhudaScreenReflections({ sky: 2, skyColor: [1, 1] }),
    ['sky: use 0..1', 'skyColor: use [r, g, b] of 0 or more'],
    'the sky that shows where a ray finds nothing',
  );
  assert.deepEqual(validateZhudaScreenReflections({ strength: 2, wetness: 1, steps: 64 }), []);
  assert.deepEqual(
    validateZhudaScreenReflections({ strength: 5, wetness: -1, distance: 0, steps: 12.5 }),
    [
      'strength: use 0..4',
      'wetness: use 0..1',
      'distance: use 1..200',
      'steps: use a whole number 8..64',
    ],
  );
});

test('a look takes screen reflections with a grade, and quality levels thin them out', () => {
  const scene = (look) => ({
    schemaVersion: 1,
    id: 'reflections',
    camera: { eye: [0, 2, 8], target: [0, 1, 0] },
    look,
    nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'asphalt' }],
  });
  const issues = (look) => validateZhudaFilmScene(scene(look), { props: [], recipes: ['asphalt'] });
  assert.deepEqual(issues({ preset: 'night', grade: {}, screenReflections: { wetness: 0.8 } }), []);
  assert.deepEqual(issues({ preset: 'night', screenReflections: {} }), [
    'scene.look.screenReflections: needs grade (the reflections are part of the HDR chain)',
  ]);
  assert.deepEqual(issues({ grade: {}, screenReflections: { steps: 4, strenght: 1 } }), [
    'scene.look.screenReflections.strenght: unknown field (did you mean strength?)',
    'scene.look.screenReflections.steps: use a whole number 8..64',
  ]);
  const off = resolveZhudaFilmLook({ preset: 'night', grade: {} });
  assert.equal(off.screenReflections, false);
  const on = resolveZhudaFilmLook({ preset: 'night', grade: {}, screenReflections: {} });
  // Off unless asked for; its colour is the sky's near the horizon unless given.
  assert.deepEqual(on.screenReflections, {
    strength: 1,
    wetness: 0.5,
    distance: 30,
    steps: 32,
    sky: 0,
    skyColor: [0.156, 0.203, 0.306],
  });
  assert.deepEqual(
    resolveZhudaFilmLook({
      preset: 'night',
      grade: {},
      screenReflections: { sky: 1, skyColor: [1, 0, 0] },
    }).screenReflections.skyColor,
    [1, 0, 0],
  );
  assert.equal(zhudaLookForQuality(on, 3).screenReflections.steps, 32);
  assert.equal(zhudaLookForQuality(on, 2).screenReflections.steps, 16);
  assert.equal(zhudaLookForQuality(on, 1).screenReflections, false);
  assert.equal(zhudaLookForQuality(on, 0).screenReflections, false);
  // Built or not is a rebuild; its values are set in place.
  assert.equal(zhudaFilmLookRebuildReason(off, on), 'screenReflections');
  const stronger = resolveZhudaFilmLook({
    preset: 'night',
    grade: {},
    screenReflections: { strength: 2 },
  });
  assert.equal(zhudaFilmLookRebuildReason(on, stronger), null);
});

test('the effect writes every uniform it declares, and the same time gives the same noise', () => {
  class Material {
    values = {};
    shaderData = { name: 'data' };
    setShaderName(name) {
      this.shader = name;
    }
    setVector4(name, vector) {
      this.values[name] = vector.values;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  // The uniforms each shader declares, in the order the shaders are made.
  const declared = [];
  const saved = globalThis.Laya;
  globalThis.Laya = {
    Material,
    PostProcessEffect: class {},
    RenderTexture: {
      createFromPool: (width, height) => ({ width, height, pooled: true }),
    },
    RenderTargetFormat: { R16G16B16A16: 'rgba16f', None: 'none' },
    DepthTextureMode: { Depth: 1 },
    Vector4: class {
      constructor(...values) {
        this.values = values;
      }
    },
    Shader3D: { add: () => ({ addSubShader() {} }), propertyNameToID: (name) => name },
    SubShader: class {
      constructor(attributes, uniforms) {
        declared.push(Object.keys(uniforms));
      }
      addShaderPass() {
        return { renderState: {} };
      }
    },
    VertexMesh: { MESH_POSITION0: 0 },
    ShaderDataType: { Vector4: 1, Texture2D: 3 },
    ShaderFeatureType: { PostProcess: 1 },
    RenderState: { CULL_NONE: 0 },
  };
  try {
    const reflections = new ZhudaScreenReflections({ wetness: 1 });
    const trace = reflections.material;
    const { values } = trace;
    assert.equal(declared.length, 3, 'trace, blur and composite');
    // u_MainTex is the picture each pass is drawn from; the rest of the trace's are ours.
    assert.deepEqual(
      Object.keys(values).sort(),
      declared[0].filter((name) => name !== 'u_MainTex').sort(),
    );
    // strength, reflection seen head-on, reach, steps
    assert.deepEqual(values.u_ZhudaSsrShape, [1, 0.27, 30, 32]);
    reflections.setReflections({ strength: 2, wetness: 0, distance: 10, steps: 16 });
    assert.deepEqual(values.u_ZhudaSsrShape, [2, 0.02, 10, 16]);
    reflections.update([0, 2, 8], [0, 2, 0], 90, 2);
    assert.deepEqual(values.u_ZhudaSsrForward, [0, 0, -1, 0]);
    // Right and up carry the half field of view: tan(45 degrees) is 1, twice as wide as high.
    assert.deepEqual(
      [values.u_ZhudaSsrRight, values.u_ZhudaSsrUp].map((v) => v.map((n) => +n.toFixed(6) + 0)),
      [
        [2, 0, 0, 0],
        [0, 1, 0, 0],
      ],
    );
    reflections.setPhase(0.5);
    reflections.update([0, 2, 8], [0, 2, 0], 90, 2);
    const phase = values.u_ZhudaSsrForward[3];
    assert.ok(phase >= 0 && phase < 1);
    reflections.setPhase(0.5);
    reflections.update([0, 2, 8], [0, 2, 0], 90, 2);
    assert.equal(values.u_ZhudaSsrForward[3], phase);
    reflections.setPhase(0.5007);
    reflections.update([0, 2, 8], [0, 2, 0], 90, 2);
    assert.notEqual(values.u_ZhudaSsrForward[3], phase);

    // One frame: rays at half size, blurred across and down, added to the scene.
    const drawn = [],
      textures = [];
    const context = {
      indirectTarget: { width: 801, height: 450 },
      destination: { name: 'destination' },
      deferredReleaseTextures: [],
      command: {
        blitScreenTriangle: (source, dest, offset, shader) => drawn.push([source, dest, shader]),
        setShaderDataTexture: (data, name, texture) => textures.push([name, texture]),
      },
    };
    reflections.effect.render(context);
    assert.deepEqual(
      drawn.map(([, , shader]) => shader),
      [
        'ZhudaScreenReflections',
        'ZhudaScreenReflectionsBlur',
        'ZhudaScreenReflectionsBlur',
        'ZhudaScreenReflectionsComposite',
      ],
    );
    const [traced, blurred] = context.deferredReleaseTextures;
    assert.deepEqual([traced.width, traced.height], [400, 225]);
    assert.deepEqual(
      drawn.map(([source, dest]) => [source, dest]),
      [
        [context.indirectTarget, traced],
        [traced, blurred],
        [blurred, traced],
        [context.indirectTarget, context.destination],
      ],
    );
    assert.deepEqual(textures, [['u_ZhudaSsrReflection', traced]]);
    assert.equal(reflections.effect.getCameraDepthTextureModeFlag(), 1);

    assert.throws(() => reflections.update([0, 0, 0], [0, 0, 0], 40, 1), /Invalid/);
    assert.throws(() => reflections.setReflections({ steps: 3 }), /steps/);
    reflections.dispose();
    assert.ok(trace.destroyed);
    assert.throws(() => reflections.update([0, 0, 0], [0, 0, -1], 40, 1), /Disposed/);
  } finally {
    globalThis.Laya = saved;
  }
});
