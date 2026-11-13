// Defaults that decide how a scene looks before anyone tunes it, and the two
// defects found by drawing the same scene again (see docs/plans/records/
// quality-defaults). Pure checks; the real draws are in verify:film-remount.
import { zhudaDecodeColor } from '../packages/core/film/ColorValues.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_FILM_LOOK_PRESETS,
  resolveZhudaFilmLook,
  validateZhudaFilmScene,
  zhudaFilmLookRebuildReason,
} from '../packages/core/film/FilmScene.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';
import {
  ZHUDA_DEFAULT_ANISO,
  applyZhudaAnisotropy,
  createSurfaceTexture,
} from '../packages/core/runtime3d/Surfaces.ts';
import {
  ZhudaFilmicPipeline,
  createPrefilteredEnvironment,
} from '../packages/core/runtime3d/Filmic.ts';
import { ZHUDA_FOG_MAX_LIGHTS, ZhudaLightFog } from '../packages/core/runtime3d/LightFog.ts';

const context = { props: [], recipes: ['asphalt'] };
const scene = (extra = {}) => ({
  schemaVersion: 1,
  id: 'defaults',
  camera: { eye: [0, 2, 8], target: [0, 1, 0] },
  nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'asphalt' }],
  ...extra,
});
const withLaya = (laya, run) => {
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    return run();
  } finally {
    globalThis.Laya = saved;
  }
};
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('ground fog takes the colour of the sky it meets, not one fixed dark blue', () => {
  const fog = (look) => resolveZhudaFilmLook({ grade: {}, lightFog: {}, ...look }).lightFog.color;
  for (const preset of Object.keys(ZHUDA_FILM_LOOK_PRESETS))
    assert.deepEqual(fog({ preset }), ZHUDA_FILM_LOOK_PRESETS[preset].horizon, preset);
  // By day the fog is as bright as the horizon; at night it stays dark (in light:
  // the colours are display values).
  const light = (rgb) => luminance(zhudaDecodeColor(rgb));
  assert.ok(light(fog({ preset: 'day' })) > 0.4);
  assert.ok(light(fog({ preset: 'overcast' })) > 0.4);
  assert.ok(light(fog({ preset: 'night' })) < 0.05);
  // A flat or panoramic sky has no measured horizon: the fog takes the sky colour.
  assert.deepEqual(
    fog({ preset: 'day', atmosphere: false, sky: [0.2, 0.3, 0.4] }),
    [0.2, 0.3, 0.4],
  );
  assert.deepEqual(fog({ preset: 'day', panorama: { asset: 'sky/day.jpg' } }), [0.5, 0.66, 0.9]);
  assert.deepEqual(fog({}), [0.55, 0.65, 0.78]);
  // An authored colour always wins, and a resolved colour is a copy.
  assert.deepEqual(fog({ preset: 'day', lightFog: { color: [0.1, 0.1, 0.2] } }), [0.1, 0.1, 0.2]);
  fog({ preset: 'day' })[0] = 9;
  assert.equal(ZHUDA_FILM_LOOK_PRESETS.day.horizon[0], 0.642);
});

test('a graded look multisamples unless told otherwise, and quality levels drop it', () => {
  const look = resolveZhudaFilmLook({ preset: 'day', grade: {} });
  assert.equal(look.grade.antialias, 'msaa');
  assert.equal(resolveZhudaFilmLook({ grade: { antialias: 'none' } }).grade.antialias, 'none');
  assert.deepEqual(
    validateZhudaFilmScene(scene({ look: { grade: { antialias: 'fxaa' } } }), context),
    ['scene.look.grade.antialias: use msaa or none'],
  );
  assert.equal(zhudaLookForQuality(look, 3).grade.antialias, 'msaa');
  assert.equal(zhudaLookForQuality(look, 2).grade.antialias, 'msaa');
  assert.equal(zhudaLookForQuality(look, 1).grade.antialias, 'none');
  assert.equal(zhudaLookForQuality(look, 0).grade, false);
  assert.equal(zhudaLookForQuality(look, 0, { keepGrade: true }).grade.antialias, 'none');
  // Multisampling is switched on the camera in place: no rebuild of the look.
  const plain = resolveZhudaFilmLook({ preset: 'day', grade: { antialias: 'none' } });
  assert.equal(zhudaFilmLookRebuildReason(look, plain), null);
});

test('a mistyped field names the one that was meant', () => {
  const issues = (look) => validateZhudaFilmScene(scene({ look }), context);
  assert.deepEqual(issues({ shadow: { distance: 50 } }), [
    'scene.look.shadow: unknown field (did you mean shadows?)',
  ]);
  assert.deepEqual(issues({ lightfog: {} }), [
    'scene.look.lightfog: unknown field (did you mean lightFog?)',
  ]);
  assert.deepEqual(issues({ grade: { expozure: 1 } }), [
    'scene.look.grade.expozure: unknown field (did you mean exposure?)',
  ]);
  // Nothing close: the message stays as it was.
  assert.deepEqual(issues({ grade: { glow: 1 } }), ['scene.look.grade.glow: unknown field']);
});

test('film materials bake up to 2048', () => {
  const sized = (size) =>
    validateZhudaFilmScene(
      scene({
        materials: { road: { recipe: 'asphalt', size } },
        nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'road' }],
      }),
      context,
    );
  for (const size of [128, 256, 512, 1024, 2048]) assert.deepEqual(sized(size), [], String(size));
  assert.deepEqual(sized(300), ['scene.materials.road.size: use 128, 256, 512, 1024 or 2048']);
});

test('mipmapped surface textures are filtered anisotropically by default', () => {
  class Texture2D {
    setPixelsData() {}
  }
  withLaya({ Texture2D, TextureFormat: { R8G8B8A8: 1 } }, () => {
    const pixels = new Uint8Array(16);
    assert.equal(createSurfaceTexture(2, 2, pixels, 'color', { mipmap: true }).anisoLevel, 8);
    assert.equal(ZHUDA_DEFAULT_ANISO, 8);
    assert.equal(createSurfaceTexture(2, 2, pixels, 'color').anisoLevel, undefined);
    assert.equal(
      createSurfaceTexture(2, 2, pixels, 'normal', { mipmap: true, anisoLevel: 16 }).anisoLevel,
      16,
    );
    assert.equal(
      createSurfaceTexture(2, 2, pixels, 'data', { mipmap: true, anisoLevel: 1 }).anisoLevel,
      undefined,
    );
    for (const anisoLevel of [0, 17, 1.5, NaN])
      assert.throws(
        () => createSurfaceTexture(2, 2, pixels, 'color', { mipmap: true, anisoLevel }),
        /anisoLevel/,
      );
  });
});

test('a loaded model gets anisotropic filtering on its mipmapped textures once', () => {
  class BaseTexture {
    constructor(mipmapCount, anisoLevel = 1) {
      Object.assign(this, { mipmapCount, anisoLevel });
    }
  }
  class RenderTexture extends BaseTexture {}
  const shared = new BaseTexture(10),
    flat = new BaseTexture(1),
    sharper = new BaseTexture(10, 16),
    target = new RenderTexture(10);
  const material = (values) => ({ shaderData: { getData: () => values } });
  const node = (materials, children = []) => ({
    meshRenderer: { sharedMaterials: materials },
    numChildren: children.length,
    getChildAt: (i) => children[i],
  });
  const root = node(
    [material({ 1: shared, 2: 0.5, 3: flat })],
    [node([material({ 1: shared, 4: sharper, 5: target }), null])],
  );
  withLaya({ BaseTexture, RenderTexture }, () => {
    assert.equal(applyZhudaAnisotropy(root), 1);
    assert.deepEqual(
      [shared, flat, sharper, target].map((texture) => texture.anisoLevel),
      [8, 1, 16, 1],
    );
    assert.equal(applyZhudaAnisotropy(root), 0, 'already applied');
    assert.throws(() => applyZhudaAnisotropy(root, 32), /anisoLevel/);
  });
  // Without the 3D runtime there is nothing to do.
  withLaya({}, () => assert.equal(applyZhudaAnisotropy(root), 0));
});

function filmicLaya() {
  class Color {
    constructor(r, g, b, a) {
      Object.assign(this, { r, g, b, a });
    }
  }
  class PostProcess {
    effects = [];
    _context = { command: { clear() {} }, camera: null };
    addEffect(effect) {
      this.effects.push(effect);
    }
    clearEffect() {
      this.effects.length = 0;
    }
  }
  class Effect {
    active = true;
  }
  return {
    Color,
    PostProcess,
    ScalableAO: Effect,
    BloomEffect: Effect,
    ColorGradEffect: Effect,
    AOQUALITY: { High: 0 },
    ToneMappingType: { ACES: 1 },
    DepthTextureMode: { Depth: 1 },
    TemporalAAQuality: { High: 1 },
    RenderCapable: { RenderTextureFormat_R16G16B16A16: 1 },
    LayaGL: { renderEngine: { getCapable: () => true } },
  };
}

test('the HDR chain writes the occlusion colour LayaAir leaves unset', () => {
  withLaya(filmicLaya(), () => {
    const camera = { postProcess: null, enableHDR: false, msaa: false, depthTextureMode: 0 };
    const film = new ZhudaFilmicPipeline(camera);
    // Unset, the shader reads stale bytes of the uniform block's last owner.
    assert.deepEqual({ ...film.ao.aoColor }, { r: 0, g: 0, b: 0, a: 1 });
    film.dispose();
  });
});

test('the HDR chain multisamples on request and puts the camera back', () => {
  withLaya(filmicLaya(), () => {
    const camera = { postProcess: null, enableHDR: false, msaa: false, depthTextureMode: 0 };
    const untouched = new ZhudaFilmicPipeline(camera);
    assert.equal(camera.msaa, false, 'omitted: the camera keeps its own setting');
    untouched.dispose();
    const film = new ZhudaFilmicPipeline(camera, { msaa: true });
    assert.equal(camera.msaa, true);
    film.setAntialias(false);
    assert.equal(camera.msaa, false);
    film.setAntialias(true);
    film.dispose();
    assert.equal(camera.msaa, false, 'restored on disposal');
    assert.throws(() => film.setAntialias(true), /Disposed/);
  });
});

test('samples are drawn scene-linear and their average passes the display stage once', () => {
  const pictures = [];
  class Texture2D {
    uploads = 0;
    replacements = 0;
    constructor(width, height) {
      Object.assign(this, { width, height });
      pictures.push(this);
    }
    setPixelsData() {
      this.uploads++;
    }
    setSubPixelsData() {
      this.replacements++;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class Material {
    values = {};
    setShaderName(name) {
      this.shader = name;
    }
    setTexture(name, texture) {
      this.values[name] = texture;
    }
    setVector4(name, vector) {
      this.values[name] = vector.x;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  const laya = {
    ...filmicLaya(),
    Texture2D,
    Material,
    MaterialPostProcessEffect: class {
      active = true;
    },
    Vector4: class {
      constructor(x) {
        this.x = x;
      }
    },
    Shader3D: { add: () => ({ addSubShader() {} }) },
    SubShader: class {
      addShaderPass() {
        return { renderState: {} };
      }
    },
    VertexMesh: { MESH_POSITION0: 0 },
    ShaderDataType: { Vector4: 1, Texture2D: 3 },
    ShaderFeatureType: { PostProcess: 1 },
    RenderState: { CULL_NONE: 0 },
    TextureFormat: { R32G32B32A32: 1 },
    FilterMode: { Point: 0 },
    WrapMode: { Clamp: 0 },
  };
  laya.RenderCapable.TextureFormat_R32G32B32A32 = 2;
  withLaya(laya, () => {
    const camera = { postProcess: null, enableHDR: false, msaa: false, depthTextureMode: 0 };
    const fog = { active: true },
      finish = { active: true };
    const film = new ZhudaFilmicPipeline(camera, {
      sceneEffects: [fog],
      finishEffects: [finish],
      bloom: false,
    });
    const built = film.post.effects.slice();
    // In front of the grade: what reaches its lookup table is kept inside it.
    const range = built[built.indexOf(film.grade) - 1];
    assert.equal(range.material.shader, 'ZhudaGradeRange');
    assert.equal(range.material.values.u_ZhudaGradeRange, 56);
    film.setExposure(2);
    assert.equal(range.material.values.u_ZhudaGradeRange, 28, 'the limit moves with the exposure');
    film.setGrade({ exposure: 1 });
    assert.equal(range.material.values.u_ZhudaGradeRange, 56);
    const chain = film.linearChain();
    assert.equal(film.linearChain(), chain, 'one chain per pipeline');
    const [source, ...rest] = film.post.effects;
    assert.deepEqual(rest, built, 'the chain keeps its order behind the source');
    const material = source.material;
    assert.equal(material.shader, 'ZhudaLinearSource');
    assert.ok(material.values.u_ZhudaAverage, 'no uniform is left unset');
    const state = () => [
      source.active,
      material.values.u_ZhudaAverageUse,
      ...[film.ao, fog, film.bloom, film.grade, finish].map((effect) => effect.active),
    ];
    // Idle outside a capture: the look's own switches, bloom off as authored.
    assert.deepEqual(state(), [false, 0, true, true, false, true, true]);
    assert.throws(() => chain.beginResolve(new Float32Array(16), 2, 2), /follows the samples/);
    chain.beginSamples();
    // Scene-linear: tone mapping and lens finish off, the source passes the scene through.
    assert.deepEqual(state(), [true, 0, true, true, false, false, false]);
    assert.throws(() => chain.beginResolve(new Float32Array(8), 2, 2), /Invalid accumulated/);
    chain.beginResolve(new Float32Array(16).fill(0.5), 2, 2);
    // Resolve: the average replaces the scene and only the display stage runs.
    assert.deepEqual(state(), [true, 1, false, false, false, true, true]);
    const picture = material.values.u_ZhudaAverage;
    assert.deepEqual([picture.width, picture.height, picture.uploads], [2, 2, 1]);
    chain.beginResolve(new Float32Array(16).fill(0.25), 2, 2);
    assert.equal(picture.replacements, 1, 'the same size is replaced in place');
    chain.end();
    chain.end();
    assert.deepEqual(state(), [false, 0, true, true, false, true, true]);
    film.dispose();
    assert.ok(material.destroyed && picture.destroyed && range.material.destroyed);
    assert.ok(pictures[0].destroyed, 'the placeholder picture went when the first frame came');
    assert.throws(() => film.linearChain(), /Disposed/);
  });
});

test('an environment is allocated once and then updated in place', () => {
  const calls = [];
  class TextureCube {
    setPixelsData() {
      calls.push('allocate');
    }
    updateSubPixelsData(faces, x, y, width, height, level) {
      calls.push('level ' + level);
    }
    destroy() {
      this.destroyed = true;
    }
  }
  const laya = {
    TextureCube,
    TextureFormat: { R32G32B32A32: 1 },
    FilterMode: { Trilinear: 2 },
    RenderCapable: { TextureFormat_R32G32B32A32: 1, Texture_FloatLinearFiltering: 2 },
    LayaGL: { renderEngine: { getCapable: () => true } },
  };
  withLaya(laya, () => {
    const spec = {
      size: 2,
      ambientSH: Array(27).fill(0),
      levels: [
        { size: 2, offset: 0, elements: 96 },
        { size: 1, offset: 96, elements: 24 },
      ],
    };
    const environment = createPrefilteredEnvironment(spec, new Float32Array(120));
    assert.deepEqual(calls, ['allocate', 'level 1']);
    environment.update(new Float32Array(120).fill(0.5), Array(27).fill(0.1));
    environment.update(new Float32Array(120).fill(0.25), Array(27).fill(0.2));
    // A second allocation of the same texture is a WebGL error on every update.
    assert.deepEqual(calls.slice(2), ['level 0', 'level 1', 'level 0', 'level 1']);
    environment.dispose();
  });
});

test('fog lights are replaced in the table that was allocated once', () => {
  const textures = [];
  class Texture2D {
    allocations = 0;
    replacements = [];
    constructor() {
      textures.push(this);
    }
    setPixelsData() {
      this.allocations++;
    }
    setSubPixelsData(...args) {
      this.replacements.push(args);
    }
    destroy() {}
  }
  class Material {
    setShaderName() {}
    setTexture() {}
    setVector4() {}
    setVector3() {}
    destroy() {}
  }
  class Vector {
    constructor(...values) {
      this.values = values;
    }
  }
  const laya = {
    Texture2D,
    Material,
    MaterialPostProcessEffect: class {},
    Vector3: Vector,
    Vector4: Vector,
    Shader3D: { add: () => ({ addSubShader() {} }) },
    SubShader: class {
      addShaderPass() {
        return { renderState: {} };
      }
    },
    VertexMesh: { MESH_POSITION0: 0 },
    ShaderDataType: { Vector4: 1, Vector3: 2, Texture2D: 3 },
    ShaderFeatureType: { PostProcess: 1 },
    RenderState: { CULL_NONE: 0 },
    TextureFormat: { R32G32B32A32: 1 },
    FilterMode: { Point: 0 },
    WrapMode: { Clamp: 0 },
    RenderCapable: { TextureFormat_R32G32B32A32: 1 },
    LayaGL: { renderEngine: { getCapable: () => true } },
  };
  withLaya(laya, () => {
    const fog = new ZhudaLightFog({ density: 0.02 });
    const lamp = { position: [1, 2, 3], color: [1, 0.5, 0.25], intensity: 2 };
    fog.setLights([lamp]);
    fog.setLights([lamp, { ...lamp, position: [4, 2, 3] }]);
    const [table] = textures;
    assert.equal(table.allocations, 1, 'allocated by the constructor only');
    assert.equal(table.replacements.length, 2);
    const [x, y, width, height, data, level] = table.replacements[1];
    assert.deepEqual([x, y, width, height, level], [0, 0, ZHUDA_FOG_MAX_LIGHTS, 2, 0]);
    assert.deepEqual([...data.subarray(4, 8)], [4, 2, 3, 12], 'second lamp: position and range');
    fog.dispose();
  });
});
