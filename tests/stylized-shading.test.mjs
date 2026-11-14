import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_TOON_DEFAULT_RAMP,
  ZhudaToonMaterial,
  buildZhudaToonOutlinePass,
  validateZhudaToonRamp,
  validateZhudaToonSpec,
  zhudaToonBand,
  zhudaToonRamp,
} from '../packages/core/shaders/ToonMaterial.ts';
import { buildZhudaLitVertexShaders } from '../packages/core/shaders/LitSurfaceMaterial.ts';
import { litShadowVertex } from '../packages/core/shaders/LitSurfaceTemplates.ts';
import { shaderRecipes, validateShaderSpec } from '../packages/core/shaders/ShaderMaterials.ts';
import {
  validateZhudaSelectionOutline,
  zhudaOutlinePulse,
} from '../packages/core/runtime3d/SelectionOutline.ts';
import { zhudaSrgbToLinear } from '../packages/core/runtime3d/Surfaces.ts';

test('a toon ramp is checked: edges ascending inside 0..1, a level for each band', () => {
  assert.deepEqual(validateZhudaToonRamp(ZHUDA_TOON_DEFAULT_RAMP), []);
  assert.deepEqual(validateZhudaToonRamp({ edges: [0.2, 0.5, 0.8], levels: [0, 0.3, 0.6, 1] }), []);
  const refused = (ramp, pattern) =>
    assert.ok(
      validateZhudaToonRamp(ramp).some((problem) => pattern.test(problem)),
      `${JSON.stringify(ramp)}: ${validateZhudaToonRamp(ramp)}`,
    );
  refused(null, /expected/);
  refused({ edges: [], levels: [1] }, /one to four/);
  refused({ edges: [0.1, 0.2, 0.3, 0.4, 0.5], levels: [0, 0, 0, 0, 0, 1] }, /one to four/);
  refused({ edges: [0.5, 0.4], levels: [0, 0.5, 1] }, /ascending/);
  refused({ edges: [0.4, 0.4], levels: [0, 0.5, 1] }, /ascending/);
  refused({ edges: [0, 0.5], levels: [0, 0.5, 1] }, /inside 0\.\.1/);
  refused({ edges: [0.5, 1], levels: [0, 0.5, 1] }, /inside 0\.\.1/);
  refused({ edges: [0.5], levels: [0.2] }, /one more value/);
  refused({ edges: [0.5], levels: [0.8, 0.2] }, /not decreasing/);
  refused({ edges: [0.5], levels: [0, 5] }, /0\.\.4/);
  refused({ edges: [0.5], levels: [0, NaN] }, /0\.\.4/);
  refused({ edges: [0.5], levels: [0, 1], softness: 2 }, /softness/);
});

test('the band of a point is the level of the edges it has passed', () => {
  const hard = { edges: [0.3, 0.7], levels: [0.15, 0.5, 1], softness: 0 };
  assert.equal(zhudaToonBand(hard, 0), 0.15);
  assert.equal(zhudaToonBand(hard, 0.29), 0.15);
  assert.equal(zhudaToonBand(hard, 0.31), 0.5);
  assert.equal(zhudaToonBand(hard, 0.69), 0.5);
  assert.equal(zhudaToonBand(hard, 0.71), 1);
  assert.equal(zhudaToonBand(hard, 1), 1);
  // A soft edge is half way at the edge itself and flat outside its width.
  const soft = { ...hard, softness: 0.2 };
  assert.ok(Math.abs(zhudaToonBand(soft, 0.3) - (0.15 + 0.5) / 2) < 1e-9);
  assert.equal(zhudaToonBand(soft, 0.19), 0.15);
  assert.equal(zhudaToonBand(soft, 0.41), 0.5);
  let previous = 0;
  for (let lit = 0; lit <= 1; lit += 0.01) {
    const value = zhudaToonBand(soft, lit);
    assert.ok(value >= previous - 1e-12, `not decreasing at ${lit}`);
    previous = value;
  }
  // Left out, the softness is 0.02.
  assert.equal(
    zhudaToonBand({ edges: [0.5], levels: [0, 1] }, 0.5),
    zhudaToonBand({ edges: [0.5], levels: [0, 1], softness: 0.02 }, 0.5),
  );
});

test('zhudaToonRamp makes even bands', () => {
  for (let bands = 2; bands <= 5; bands++) {
    const ramp = zhudaToonRamp(bands);
    assert.deepEqual(validateZhudaToonRamp(ramp), []);
    assert.equal(ramp.levels.length, bands);
    assert.equal(ramp.levels[0], 0.3);
    assert.ok(Math.abs(ramp.levels[bands - 1] - 1) < 1e-12);
  }
  const five = zhudaToonRamp(5, { darkest: 0, from: 0.2, to: 0.8, softness: 0 });
  assert.deepEqual(
    five.edges.map((edge) => +edge.toFixed(6)),
    [0.2, 0.4, 0.6, 0.8],
  );
  assert.deepEqual(
    five.levels.map((level) => +level.toFixed(6)),
    [0, 0.25, 0.5, 0.75, 1],
  );
  assert.deepEqual(zhudaToonRamp(2, { from: 0.2, to: 0.6 }).edges, [0.4]);
  assert.throws(() => zhudaToonRamp(1), /2 to 5/);
  assert.throws(() => zhudaToonRamp(6), /2 to 5/);
  assert.throws(() => zhudaToonRamp(2.5), /2 to 5/);
  assert.throws(() => zhudaToonRamp(3, { darkest: 2 }), /darkest/);
  assert.throws(() => zhudaToonRamp(3, { from: 0.8, to: 0.2 }), /from <= to/);
});

test('a toon spec is checked', () => {
  const good = {
    name: 'ZhudaToonGood',
    highlight: { color: [1, 1, 1], sizeDeg: 12 },
    rim: { color: [0, 0.5, 1], width: 0.3 },
    outline: { color: [0, 0, 0], width: 2 },
    ambient: { strength: 1, flat: 1 },
  };
  assert.deepEqual(validateZhudaToonSpec(good), []);
  const refused = (patch, pattern) => {
    const problems = validateZhudaToonSpec({ ...good, ...patch });
    assert.ok(
      problems.some((problem) => pattern.test(problem)),
      `${JSON.stringify(patch)}: ${problems}`,
    );
  };
  refused({ name: 'Toon' }, /name/);
  refused({ ramp: { edges: [2], levels: [0, 1] } }, /ramp\.edges/);
  refused({ highlight: { color: [1, 1], sizeDeg: 12 } }, /highlight\.color/);
  refused({ highlight: { color: [1, 1, 1], sizeDeg: 0 } }, /highlight\.sizeDeg/);
  refused({ highlight: { color: [1, 1, 1], sizeDeg: 120 } }, /highlight\.sizeDeg/);
  refused({ highlight: { color: [1, 1, 1], sizeDeg: 10, strength: 99 } }, /highlight\.strength/);
  refused({ rim: { color: [0, 0, 2], width: 0.3 } }, /rim\.color/);
  refused({ rim: { color: [0, 0, 1], width: 0 } }, /rim\.width/);
  refused({ outline: { color: [0, 0, 0], width: 40 } }, /outline\.width/);
  refused({ outline: { color: [0, 0, 0], width: 12, space: 'world' } }, /outline\.width/);
  refused({ outline: { color: [0, 0, 0], width: 1, space: 'view' } }, /outline\.space/);
  refused({ ambient: { strength: -1 } }, /ambient\.strength/);
  refused({ ambient: { flat: 2 } }, /ambient\.flat/);
  refused({ uniforms: { u_ZhudaToonEdges: { type: 'vec4' } } }, /are taken/);
  refused({ uniforms: { u_ZhudaOutline: { type: 'vec4' } } }, /are taken/);
  assert.deepEqual(validateZhudaToonSpec(null), ['Expected a toon spec']);
  // A width in scene units may be small where a pixel width may be large.
  assert.deepEqual(
    validateZhudaToonSpec({
      name: 'ZhudaToonWorld',
      outline: { color: [0, 0, 0], width: 0.05, space: 'world' },
    }),
    [],
  );
});

test('the outline pass is the shadow program projected as a hull in one colour', () => {
  const { vertex, fragment } = buildZhudaToonOutlinePass(litShadowVertex);
  // Its own includes: the depth include only declares its projection in a depth or shadow pass.
  assert.ok(!vertex.includes('DepthVertex.glsl'));
  assert.ok(!vertex.includes('DepthPositionCS'));
  for (const include of ['Camera.glsl', 'Sprite3DVertex.glsl', 'VertexCommon.glsl'])
    assert.ok(vertex.includes(`#include "${include}";`), include);
  assert.ok(vertex.includes('u_ZhudaOutline.a'));
  assert.ok(vertex.includes('u_Viewport.zw'), 'a width in pixels of the picture');
  assert.ok(vertex.includes('u_ZhudaOutlineShape.x>0.5'), 'or in scene units');
  assert.ok(vertex.includes('FogHandle'));
  assert.ok(fragment.includes('u_ZhudaOutline.rgb'));
  assert.ok(fragment.includes('outputTransform'));
  assert.ok(fragment.includes('sceneLitFog'));
  assert.ok(fragment.includes('if(alpha<u_AlphaTestValue)discard;'), 'a cut-out stays cut out');
  assert.ok(!fragment.includes('getDepthColor'));
  // With a vertex hook the hull is made from the moved position.
  const hook =
    'void zhudaVertex(inout vec3 positionWS, inout vec3 normalWS, vec2 uv, vec3 originWS){positionWS.y+=1.0;}';
  const hooked = buildZhudaToonOutlinePass(buildZhudaLitVertexShaders(hook).shadow).vertex;
  assert.ok(hooked.indexOf('zhudaVertex(positionWS') < hooked.indexOf('zhudaClip='));
  assert.throws(() => buildZhudaToonOutlinePass('void main(){}'), /Lit template changed/);
});

test('the matcap and normal-view recipes are valid shader specs', () => {
  for (const name of ['matcap3D', 'normalView3D'])
    assert.deepEqual(validateShaderSpec(shaderRecipes[name]), [], name);
  assert.equal(shaderRecipes.matcap3D.uniforms.u_ZhudaMatcap.type, 'texture2D');
  assert.equal(shaderRecipes.normalView3D.fog, false);
  const names = Object.values(shaderRecipes).map((recipe) => recipe.name);
  assert.equal(new Set(names).size, names.length, 'no two recipes share a shader name');
});

test('selection outline options are checked and the pulse swings between low and 1', () => {
  assert.deepEqual(validateZhudaSelectionOutline({}), []);
  assert.deepEqual(
    validateZhudaSelectionOutline({
      visibleColor: [1, 0.7, 0.1],
      hiddenColor: null,
      hiddenStrength: 0.5,
      hiddenFill: 0.2,
      width: 4,
      occlusion: false,
    }),
    [],
  );
  const problems = validateZhudaSelectionOutline({
    visibleColor: [1, 2, 3],
    hiddenColor: 'red',
    hiddenStrength: 2,
    hiddenFill: -1,
    width: 20,
    occlusion: 1,
  });
  for (const key of [
    'visibleColor',
    'hiddenColor',
    'hiddenStrength',
    'hiddenFill',
    'width',
    'occlusion',
  ])
    assert.ok(
      problems.some((problem) => problem.startsWith(key + ':')),
      key,
    );
  assert.equal(zhudaOutlinePulse(0), 1);
  assert.ok(Math.abs(zhudaOutlinePulse(0.6, 1.2, 0.35) - 0.35) < 1e-12);
  assert.ok(Math.abs(zhudaOutlinePulse(1.2, 1.2, 0.35) - 1) < 1e-12);
  assert.ok(Math.abs(zhudaOutlinePulse(0.3, 1.2, 0.35) - 0.675) < 1e-12);
  // The same time gives the same strength: it keeps no clock.
  assert.equal(zhudaOutlinePulse(7.31), zhudaOutlinePulse(7.31));
  assert.throws(() => zhudaOutlinePulse(NaN), /finite/);
  assert.throws(() => zhudaOutlinePulse(1, 0), /period/);
  assert.throws(() => zhudaOutlinePulse(1, 1, 2), /low/);
});

/** As much of LayaAir as a lit material touches; passes and uniform values are kept to look at. */
function fakeLaya() {
  const shaders = new Map();
  class Vector {
    constructor(...v) {
      [this.x, this.y, this.z, this.w] = v;
    }
  }
  class Material {
    values = {};
    destroyed = false;
    setShaderName(name) {
      this.shaderName = name;
    }
    setVector2(k, v) {
      this.values[k] = v;
    }
    setVector3(k, v) {
      this.values[k] = v;
    }
    setVector4(k, v) {
      this.values[k] = v;
    }
    setFloat(k, v) {
      this.values[k] = v;
    }
    setTexture() {}
    destroy() {
      this.destroyed = true;
    }
  }
  return {
    shaders,
    Vector2: Vector,
    Vector3: Vector,
    Vector4: Vector,
    Color: Vector,
    RenderState: { CULL_NONE: 0, CULL_FRONT: 1, CULL_BACK: 2 },
    ShaderDataType: new Proxy({}, { get: (_, k) => k }),
    ShaderFeatureType: { D3: 1 },
    SubShader: class {
      static DefaultAttributeMap = {};
      passes = [];
      constructor(attributes, uniforms) {
        this.uniforms = uniforms;
      }
      addShaderPass(vertex, fragment, mode = 'Forward') {
        const pass = { vertex, fragment, mode, statefirst: false, renderState: {} };
        this.passes.push(pass);
        return pass;
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
  };
}

test('a toon material replaces the lighting of the lit template and sets its bands', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const toon = new ZhudaToonMaterial({
      name: 'ZhudaToonUnit',
      ramp: { edges: [0.3, 0.7], levels: [0.15, 0.5, 1], softness: 0.1 },
    });
    const passes = laya.shaders.get('ZhudaToonUnit').subs[0].passes;
    assert.deepEqual(
      passes.map((pass) => pass.mode),
      ['Forward', 'ShadowCaster', 'DepthNormal'],
      'no outline pass unless one is asked for',
    );
    const lit = passes[0].fragment;
    assert.ok(lit.includes('zhudaToonFlow(inputs,pixel)'));
    assert.ok(!lit.includes('PBR_Metallic_Flow(inputs,pixel)'));
    // LayaAir's own light loop: every kind of light, and its shadow inside the band.
    for (const kind of ['DIRECTIONLIGHT', 'POINTLIGHT', 'SPOTLIGHT'])
      assert.ok(lit.includes(`#ifdef ${kind}`), kind);
    assert.ok(lit.includes('getClusterInfo('));
    assert.ok(lit.includes('saturate(dot(info.normalWS,l))*light.attenuation'));
    // The shadow and depth passes are the lit template's own.
    assert.ok(!passes[1].fragment.includes('zhudaToon'));
    const values = toon.material.values;
    const list = (v) => [v.x, v.y, v.z, v.w];
    // Edges that are not used can never be passed; their levels repeat the last.
    assert.deepEqual(list(values.u_ZhudaToonEdges), [0.3, 0.7, 2, 2]);
    assert.deepEqual(list(values.u_ZhudaToonLevels), [0.5, 1, 1, 1]);
    assert.deepEqual(list(values.u_ZhudaToonBase), [0.15, 0.1, 1, 1]);
    assert.equal(values.u_ZhudaToonHighlight.w, 2, 'no highlight: a threshold never reached');
    assert.equal(values.u_ZhudaToonShape.y, 2, 'no rim');
    toon.setHighlight({ color: [1, 0.5, 0], sizeDeg: 60, strength: 2 });
    assert.ok(Math.abs(values.u_ZhudaToonHighlight.w - 0.5) < 1e-12, 'cos 60');
    assert.ok(Math.abs(values.u_ZhudaToonHighlight.y - zhudaSrgbToLinear(0.5) * 2) < 1e-12);
    toon.setRim({ color: [0, 0, 1], width: 0.25 });
    assert.equal(values.u_ZhudaToonShape.y, 0.75);
    toon.setAmbient({ strength: 0.5, flat: 0 });
    assert.deepEqual(list(values.u_ZhudaToonBase), [0.15, 0.1, 0.5, 0]);
    toon.setRamp(zhudaToonRamp(5));
    assert.equal(values.u_ZhudaToonEdges.w, 0.75);
    assert.throws(() => toon.setRamp({ edges: [0.9, 0.1], levels: [0, 0.5, 1] }), /ascending/);
    assert.throws(() => toon.setOutline({ color: [0, 0, 0], width: 2 }), /made without an outline/);
    assert.throws(() => toon.set('u_ZhudaToonEdges', [0, 0, 0, 0]), /use setRamp/);
    // One shader name cannot mean both with and without the outline pass.
    assert.throws(
      () =>
        new ZhudaToonMaterial({ name: 'ZhudaToonUnit', outline: { color: [0, 0, 0], width: 2 } }),
      /different contract/,
    );
    // Another ramp under the same name is the same shader.
    new ZhudaToonMaterial({ name: 'ZhudaToonUnit', ramp: zhudaToonRamp(3) }).dispose();
    toon.dispose();
    toon.dispose();
    assert.equal(toon.material.destroyed, true);
    assert.throws(() => toon.setRamp(ZHUDA_TOON_DEFAULT_RAMP), /Disposed/);
  } finally {
    globalThis.Laya = before;
  }
});

test('an outlined toon material has a second forward pass that draws the back faces', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const toon = new ZhudaToonMaterial({
      name: 'ZhudaToonLined',
      outline: { color: [0.2, 0.2, 0.2], width: 3 },
      vertex:
        'void zhudaVertex(inout vec3 positionWS, inout vec3 normalWS, vec2 uv, vec3 originWS){positionWS.x+=u_ZhudaSway;}',
      uniforms: { u_ZhudaSway: { type: 'float', value: 0.1 } },
    });
    const sub = laya.shaders.get('ZhudaToonLined').subs[0];
    assert.deepEqual(
      sub.passes.map((pass) => pass.mode),
      ['Forward', 'ShadowCaster', 'DepthNormal', 'Forward'],
    );
    const hull = sub.passes[3];
    assert.equal(hull.statefirst, true);
    assert.equal(hull.renderState.cull, laya.RenderState.CULL_FRONT);
    assert.equal(sub.passes[0].statefirst, false, "the lit pass keeps the material's side");
    assert.ok(
      hull.vertex.includes('zhudaVertex(positionWS'),
      'the hull moves with the vertex hook',
    );
    assert.ok('u_ZhudaOutline' in sub.uniforms && 'u_ZhudaSway' in sub.uniforms);
    const values = toon.material.values;
    assert.equal(values.u_ZhudaOutline.w, 3);
    assert.ok(Math.abs(values.u_ZhudaOutline.x - zhudaSrgbToLinear(0.2)) < 1e-12);
    assert.equal(values.u_ZhudaOutlineShape.x, 0, 'pixels of the picture');
    toon.setOutline({ color: [1, 0, 0], width: 0.05, space: 'world' });
    assert.equal(values.u_ZhudaOutlineShape.x, 1);
    assert.equal(values.u_ZhudaOutline.w, 0.05);
    assert.throws(() => toon.setOutline({ color: [1, 0, 0], width: 12, space: 'world' }), /width/);
    toon.set('u_ZhudaSway', 0.3);
    assert.equal(values.u_ZhudaSway, 0.3);
    toon.dispose();
  } finally {
    globalThis.Laya = before;
  }
});
