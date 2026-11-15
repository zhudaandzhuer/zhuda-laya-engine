// What a lit surface's hook writes beyond its colour: alpha, the normal in
// the surface's own frame, and the cut by chance. Pure checks of the programs
// that are generated; the draw is verify:lit-surface.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_LIT_SHEEN_UNIFORM,
  ZHUDA_LIT_STRANDS_UNIFORM,
  ZHUDA_LIT_STRAND_COLOR_UNIFORM,
  ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM,
  ZHUDA_LIT_SUBSURFACE_UNIFORM,
  ZhudaLitSurfaceMaterial,
  buildZhudaLitFragmentShaders,
  buildZhudaLitVertexShaders,
  resolveZhudaLitSheen,
  resolveZhudaLitStrands,
  resolveZhudaLitSubsurface,
  zhudaLitSurfaceWrites,
} from '../packages/core/shaders/LitSurfaceMaterial.ts';
import { ZhudaDynamicMesh } from '../packages/core/runtime3d/Surfaces.ts';
import { buildZhudaToonOutlinePass } from '../packages/core/shaders/ToonMaterial.ts';
import {
  litVertex,
  litShadowVertex,
  litDepthVertex,
  litShadowFragment,
  litDepthFragment,
} from '../packages/core/shaders/LitSurfaceTemplates.ts';

const head = 'void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 p,vec3 n){';
const plain = `${head}s.baseColor*=0.5;}`;
const cut = `${head}s.alpha=step(0.5,fract(p.x));}`;
const bent = `${head}s.normalTS=vec3(0.3,0.0,1.0);}`;
const main = (program) => program.slice(program.lastIndexOf('void main(){'));
const before = (text, first, second) => {
  const a = text.indexOf(first),
    b = text.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
};

test('what a surface writes is read off its text, comments aside', () => {
  assert.deepEqual(zhudaLitSurfaceWrites(plain), { alpha: false, normal: false });
  assert.deepEqual(zhudaLitSurfaceWrites(cut), { alpha: true, normal: false });
  assert.deepEqual(zhudaLitSurfaceWrites(bent), { alpha: false, normal: true });
  assert.deepEqual(
    zhudaLitSurfaceWrites(`${head}s . alpha=0.5;surface.normalTS.x+=0.1;}`),
    { alpha: true, normal: true },
    'whatever the parameter is called',
  );
  assert.deepEqual(
    zhudaLitSurfaceWrites(`${head}/* s.alpha=0.0; */ // s.normalTS=n;\ns.metallic=1.0;}`),
    { alpha: false, normal: false },
  );
  // A colour's fourth part is not the surface's alpha.
  assert.deepEqual(zhudaLitSurfaceWrites(`${head}vec4 c=vec4(1.0);s.occlusion=c.a;}`), {
    alpha: false,
    normal: false,
  });
});

test('a surface that writes neither is drawn by the templates as before', () => {
  const made = buildZhudaLitFragmentShaders({ surface: plain });
  assert.equal(made.shadowHook, false);
  assert.equal(made.depthHook, false);
  assert.equal(made.shadow, litShadowFragment);
  assert.equal(made.depth, litDepthFragment);
  // The fields are there to read, and nothing is written back from them.
  assert.ok(
    made.forward.includes('float alpha;vec3 normalTS;vec3 viewDirection;vec4 vertexColor;};'),
  );
  assert.ok(!made.forward.includes('sheenColor'), 'no sheen unless it is asked for');
  assert.ok(made.forward.includes('s.alpha=inputs.alpha;s.normalTS=inputs.normalTS;'));
  assert.ok(!made.forward.includes('inputs.alpha=clamp'));
  assert.ok(!made.forward.includes('inputs.normalTS=zhudaN'));
  assert.ok(!made.forward.includes('ZhudaCommon.glsl'));
  // And the vertex programs are the templates.
  assert.deepEqual(buildZhudaLitVertexShaders(), {
    forward: litVertex,
    shadow: litShadowVertex,
    depth: litDepthVertex,
  });
});

test('a surface that writes alpha is asked again where its shadow and depth are drawn', () => {
  const made = buildZhudaLitFragmentShaders({ surface: cut });
  assert.equal(made.shadowHook, true);
  assert.equal(made.depthHook, true);
  assert.ok(made.forward.includes('inputs.alpha=clamp(s.alpha,0.0,1.0);'));
  // The shadow: the hook runs only where the material is a cut-out, with the
  // place the vertex program handed over, and cuts at the material's value.
  const shadow = main(made.shadow);
  assert.ok(
    before(shadow, '#ifdef ALPHATEST', 'zhudaSurface(s,v_ZhudaShadowUV,v_ZhudaShadowPositionWS,'),
  );
  assert.ok(shadow.includes('if(clamp(s.alpha,0.0,1.0)<u_AlphaTestValue)discard;'));
  assert.ok(before(shadow, 'discard;', 'gl_FragColor=getDepthColor();'));
  for (const include of ['Color.glsl', 'Scene.glsl', 'Camera.glsl'])
    assert.ok(made.shadow.includes(`#include "${include}";`), `${include} for what a hook may use`);
  // It has no frame to turn a normal with.
  assert.ok(!made.shadow.includes('zhudaSurfaceNormal'));
  // The depth and normal the camera keeps: cut the same way, the normal the template's own.
  const depth = main(made.depth);
  assert.ok(before(depth, '#ifdef ALPHATEST', 'zhudaSurface(s,zhudaUV,pixel.positionWS,'));
  assert.ok(depth.includes('if(clamp(s.alpha,0.0,1.0)<u_AlphaTestValue)discard;'));
  assert.ok(depth.includes('normalWS=normalize(pixel.TBN*normalTS);'), 'the normal map as before');
  assert.ok(!depth.includes('float alpha=u_AlbedoColor.a;'), "the template's own cut is replaced");
  // The vertex program of the shadow hands over what the hook is given.
  const vertex = buildZhudaLitVertexShaders(undefined, { shadowSurface: true });
  assert.ok(vertex.shadow.includes('varying vec3 v_ZhudaShadowPositionWS;'));
  assert.ok(
    before(
      vertex.shadow,
      'v_ZhudaShadowPositionWS=positionWS;',
      'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
    ),
  );
  assert.equal(vertex.forward, litVertex);
  assert.equal(vertex.depth, litDepthVertex);
  // With a vertex hook the surface is asked about the place the vertex moved to.
  const moved = buildZhudaLitVertexShaders(
    'void zhudaVertex(inout vec3 p,inout vec3 n,vec2 uv,vec3 o){p.y+=1.0;}',
    { shadowSurface: true },
  );
  assert.ok(before(moved.shadow, 'zhudaVertex(positionWS,', 'v_ZhudaShadowPositionWS=positionWS;'));
});

test('a surface that writes its normal is lit by it, with tangents or without', () => {
  const made = buildZhudaLitFragmentShaders({ surface: bent });
  assert.equal(made.shadowHook, false, 'a shadow has no normal');
  assert.equal(made.shadow, litShadowFragment);
  assert.equal(made.depthHook, true);
  const forward = main(made.forward);
  // A normal of no length is the surface's own.
  assert.ok(
    forward.includes('zhudaN=dot(zhudaN,zhudaN)>1.0e-8?normalize(zhudaN):vec3(0.0,0.0,1.0);'),
  );
  assert.ok(forward.includes('inputs.normalTS=zhudaN;'));
  // Without tangents LayaAir lights by the mesh's normal: that is the one turned.
  assert.ok(
    before(
      forward,
      '#ifndef TANGENT\npixel.normalWS=zhudaSurfaceNormal(pixel,zhudaN,zhudaUV);\n#endif',
      'PBR_Metallic_Flow(inputs,pixel)',
    ),
  );
  // The frame without tangents comes from how the place and the texture coordinates change.
  assert.ok(made.forward.includes('vec3 zhudaSurfaceNormal(in PixelParams p,vec3 n,vec2 uv){'));
  assert.ok(made.forward.includes('dFdx(p.positionWS)'));
  // The camera's own normal follows the hook everywhere, cut-out or not.
  const depth = main(made.depth);
  assert.ok(!before(depth, '#ifdef ALPHATEST', 'zhudaSurface(s,zhudaUV,'), 'asked everywhere');
  assert.ok(depth.includes('vec3 normalWS=zhudaSurfaceNormal(pixel,zhudaN,zhudaUV);'));
  // The normal map is what the hook starts from, in the map's own convention.
  assert.ok(
    depth.includes('normalSampler.y*=-1.0;s.normalTS=normalScale(normalSampler,u_NormalScale);'),
  );
  const gl = buildZhudaLitFragmentShaders({ surface: bent, normalConvention: 'opengl' });
  assert.ok(!gl.depth.includes('normalSampler.y*=-1.0;'));
});

test('a surface cut by chance takes its threshold from its place on the object, in every pass', () => {
  const made = buildZhudaLitFragmentShaders({ surface: cut, alphaHash: true });
  assert.equal(made.shadowHook, true);
  for (const [name, program] of Object.entries({
    forward: made.forward,
    shadow: made.shadow,
    depth: made.depth,
  })) {
    assert.ok(program.includes('#include "ZhudaCommon.glsl";'), `${name}: the hash`);
    assert.ok(program.includes('varying vec3 v_ZhudaObjectPosition;'), name);
    // First thing: a derivative is taken before anything is discarded.
    assert.ok(
      before(
        main(program),
        'float zhudaThreshold=zhudaAlphaHash(v_ZhudaObjectPosition);',
        'zhudaSurface(s,',
      ),
      name,
    );
  }
  assert.ok(main(made.forward).includes('inputs.alphaTest=zhudaThreshold;'));
  assert.ok(main(made.shadow).includes('<zhudaThreshold)discard;'));
  assert.ok(main(made.depth).includes('<zhudaThreshold)discard;'));
  // A surface that writes no alpha is still cut, by the material's own alpha.
  assert.equal(buildZhudaLitFragmentShaders({ surface: plain, alphaHash: true }).shadowHook, true);
  // Each vertex program hands over the vertex's place in its own mesh.
  const vertex = buildZhudaLitVertexShaders(undefined, { objectPosition: true });
  for (const program of Object.values(vertex))
    assert.ok(program.includes('getVertexParams(vertex);v_ZhudaObjectPosition=vertex.positionOS;'));
  // The toon outline is made from the shadow's vertex program: it still finds its place in one
  // that hands the surface its place and the object's.
  const hull = buildZhudaToonOutlinePass(
    buildZhudaLitVertexShaders(undefined, { objectPosition: true, shadowSurface: true }).shadow,
  );
  assert.ok(hull.vertex.includes('v_ZhudaShadowPositionWS=positionWS;'));
  assert.ok(hull.vertex.includes('gl_Position=remapPositionZ(zhudaClip);'));
  // The common functions alone, for a surface that asks.
  const noisy = buildZhudaLitFragmentShaders({ surface: plain, common: true });
  assert.ok(noisy.forward.includes('#include "ZhudaCommon.glsl";'));
  assert.equal(noisy.shadow, litShadowFragment);
});

test('the hook is given the view direction and the vertex colour, in every pass', () => {
  const colour = '#ifdef COLOR\ns.vertexColor=PLACE;\n#else\ns.vertexColor=vec4(1.0);\n#endif\n';
  const made = buildZhudaLitFragmentShaders({ surface: cut });
  // Where the colours are drawn: toward the eye, and the colour LayaAir carried to the pixel.
  const forward = main(made.forward);
  assert.ok(forward.includes('s.viewDirection=normalize(u_CameraPos-pixel.positionWS);'));
  assert.ok(forward.includes(colour.replace('PLACE', 'pixel.vertexColor')));
  assert.ok(before(forward, 's.vertexColor=vec4(1.0);', 'zhudaSurface(s,'), 'before the hook runs');
  // Where a shadow is written LayaAir gives a view and no eye: read from the view.
  assert.ok(made.shadow.includes('vec3 zhudaPassViewDirection(vec3 positionWS){'));
  assert.ok(
    before(made.shadow, 'vec3 zhudaPassViewDirection(', 'void zhudaSurface('),
    'declared before the hook',
  );
  const shadow = main(made.shadow);
  assert.ok(shadow.includes('s.viewDirection=zhudaPassViewDirection(v_ZhudaShadowPositionWS);'));
  assert.ok(!shadow.includes('u_CameraPos'), 'that pass is given no eye');
  assert.ok(shadow.includes(colour.replace('PLACE', 'v_ZhudaShadowVertexColor')));
  assert.ok(made.shadow.includes('varying vec4 v_ZhudaShadowVertexColor;'));
  // Where the camera keeps depth and normal: the eye again.
  const depth = main(made.depth);
  assert.ok(depth.includes('s.viewDirection=normalize(u_CameraPos-pixel.positionWS);'));
  assert.ok(depth.includes(colour.replace('PLACE', 'pixel.vertexColor')));
  // The shadow's vertex program hands the colour over, white where the mesh has none.
  const vertex = buildZhudaLitVertexShaders(undefined, { shadowSurface: true });
  assert.ok(vertex.shadow.includes('varying vec4 v_ZhudaShadowVertexColor;'));
  assert.ok(
    vertex.shadow.includes(
      '#ifdef COLOR\nv_ZhudaShadowVertexColor=vertex.vertexColor;\n#else\nv_ZhudaShadowVertexColor=vec4(1.0);\n#endif',
    ),
  );
});

test("sheen is LayaAir's own lobe, fed by the material and then by the hook", () => {
  assert.equal(resolveZhudaLitSheen(undefined), null);
  assert.equal(resolveZhudaLitSheen(false), null);
  assert.deepEqual(resolveZhudaLitSheen(true), { color: [1, 1, 1], roughness: 0.5 });
  assert.deepEqual(resolveZhudaLitSheen({ color: [0.2, 0.3, 0.4] }), {
    color: [0.2, 0.3, 0.4],
    roughness: 0.5,
  });
  assert.throws(() => resolveZhudaLitSheen('yes'), /Invalid sheen: true, or/);
  assert.throws(() => resolveZhudaLitSheen({ color: [1, 2] }), /Invalid sheen.color/);
  assert.throws(() => resolveZhudaLitSheen({ color: [-1, 0, 0] }), /Invalid sheen.color/);
  assert.throws(() => resolveZhudaLitSheen({ roughness: 2 }), /Invalid sheen.roughness/);

  const made = buildZhudaLitFragmentShaders({ surface: cut, sheen: true });
  assert.ok(made.forward.includes('vec4 vertexColor;vec3 sheenColor;float sheenRoughness;};'));
  assert.ok(before(made.forward, 'vec4 zhudaLitSheenFlow(', 'void main(){'));
  const forward = main(made.forward);
  const fed = `s.sheenColor=${ZHUDA_LIT_SHEEN_UNIFORM}.rgb;s.sheenRoughness=${ZHUDA_LIT_SHEEN_UNIFORM}.a;`;
  assert.ok(before(forward, fed, 'zhudaSurface(s,'), 'the material first, then the hook');
  assert.ok(
    forward.includes(
      'zhudaLitSheenFlow(inputs,pixel,max(s.sheenColor,vec3(0.0)),clamp(s.sheenRoughness,0.0,1.0))',
    ),
  );
  assert.ok(!forward.includes('PBR_Metallic_Flow(inputs,pixel)'), "in place of LayaAir's flow");
  // The fields are in the other passes too: a hook that reads them compiles there.
  for (const pass of [made.shadow, made.depth]) {
    assert.ok(pass.includes('vec3 sheenColor;float sheenRoughness;};'));
    assert.ok(main(pass).includes(fed));
  }
  // The lobe is LayaAir's lighting: a shading of one's own has none.
  assert.throws(
    () => buildZhudaLitFragmentShaders({ surface: plain, sheen: true }, {}),
    /not with a ZhudaLitShading/,
  );
});

/** Enough of LayaAir to make a lit surface material and see what it was told. */
function fakeLaya() {
  const shaders = new Map(),
    includes = [];
  class Vector {
    constructor(...v) {
      this.values = v;
    }
  }
  class Material {
    told = [];
    defines = [];
    vectors = {};
    setShaderName(name) {
      // As LayaAir: another shader clears the defines and the render state.
      this.shader = name;
      this.alphaTest = false;
      this.renderMode = 0;
      this.cull = 'back';
      this.depthWrite = true;
      this.defines = [];
      this.told.push('shader');
    }
    addDefine(define) {
      this.defines.push(define);
    }
    setVector2(name, value) {
      this.vectors[name] = value.values;
    }
    setVector3(name, value) {
      this.vectors[name] = value.values;
    }
    setVector4(name, value) {
      this.vectors[name] = value.values;
    }
    setFloat() {}
    setTexture() {}
    destroy() {}
  }
  return {
    shaders,
    includes,
    Vector2: Vector,
    Vector3: Vector,
    Vector4: Vector,
    Color: Vector,
    RenderState: { CULL_NONE: 'none' },
    ShaderDataType: new Proxy({}, { get: (_, k) => k }),
    ShaderFeatureType: { D3: 1 },
    SubShader: class {
      static DefaultAttributeMap = {};
      passes = [];
      constructor(attributes, uniforms) {
        this.uniforms = uniforms;
      }
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
      addInclude: (name) => includes.push(name),
      getDefineByName: (name) => name,
    },
    PBRStandardMaterial: Material,
    UnlitMaterial: Material,
    PBRRenderMode: { Opaque: 0, Fade: 2 },
  };
}

test('the material is cut or blended as it asked after its shader is put on', () => {
  const laya = fakeLaya();
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const opaque = new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestOpaque', surface: plain });
    assert.equal(opaque.material.alphaTest, false);
    assert.equal(opaque.material.cull, 'back');
    const sided = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestOpaque',
      surface: plain,
      material: { doubleSided: true },
    });
    assert.equal(sided.material.cull, 'none');
    // LayaAir cleared it with the shader: it is put back.
    const cutout = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestCut',
      surface: cut,
      material: { blend: 'cutout', alphaCutoff: 0.3, doubleSided: true },
    });
    assert.equal(cutout.material.alphaTest, true);
    assert.equal(cutout.material.alphaTestValue, 0.3);
    assert.equal(cutout.material.cull, 'none');
    assert.equal(cutout.material.depthWrite, true);
    const faded = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestCut',
      surface: cut,
      material: { blend: 'alpha' },
    });
    assert.equal(faded.material.renderMode, 2);
    assert.equal(faded.material.depthWrite, false);
    // Cut by chance: a cut-out whatever the material said, and the hash is there.
    const chance = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestChance',
      surface: cut,
      alphaHash: true,
    });
    assert.equal(chance.material.alphaTest, true);
    assert.deepEqual(laya.includes, ['ZhudaCommon.glsl']);
    const passes = laya.shaders.get('ZhudaTestChance').subs[0].passes;
    assert.deepEqual(
      passes.map((pass) => pass.mode),
      [undefined, 'ShadowCaster', 'DepthNormal'],
    );
    for (const pass of passes) {
      assert.ok(pass.vertex.includes('v_ZhudaObjectPosition=vertex.positionOS;'));
      assert.ok(pass.fragment.includes('zhudaAlphaHash(v_ZhudaObjectPosition)'));
    }
    assert.throws(
      () =>
        new ZhudaLitSurfaceMaterial({
          name: 'ZhudaTestChanceFade',
          surface: cut,
          alphaHash: true,
          material: { blend: 'alpha' },
        }),
      /alphaHash is a cut-out/,
    );
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestBad', surface: cut, alphaHash: 1 }),
      /alphaHash: true or false/,
    );
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestBad', surface: cut, common: 'yes' }),
      /common: true or false/,
    );
    // One shader name cannot mean both.
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestCut', surface: cut, alphaHash: true }),
      /different contract/,
    );
    for (const made of [opaque, sided, cutout, faded, chance]) made.dispose();
  } finally {
    globalThis.Laya = saved;
  }
});

test('a material with sheen switches on the lobe, keeps its values and changes them in place', () => {
  const laya = fakeLaya();
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const cloth = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestSheen',
      surface: plain,
      sheen: { color: [0.75, 0.78, 1], roughness: 0.4 },
    });
    assert.deepEqual(cloth.material.defines, ['SHEEN'], 'after the shader was put on');
    assert.deepEqual(cloth.material.vectors[ZHUDA_LIT_SHEEN_UNIFORM], [0.75, 0.78, 1, 0.4]);
    const sub = laya.shaders.get('ZhudaTestSheen').subs[0];
    assert.equal(sub.uniforms[ZHUDA_LIT_SHEEN_UNIFORM], 'Vector4');
    assert.ok(sub.passes[0].fragment.includes('vec4 zhudaLitSheenFlow('));
    cloth.setSheen({ roughness: 0.2 });
    assert.deepEqual(cloth.material.vectors[ZHUDA_LIT_SHEEN_UNIFORM], [0.75, 0.78, 1, 0.2]);
    cloth.setSheen({ color: [1, 0, 0] });
    assert.deepEqual(cloth.material.vectors[ZHUDA_LIT_SHEEN_UNIFORM], [1, 0, 0, 0.2]);
    assert.throws(() => cloth.setSheen({ roughness: -1 }), /Invalid sheen.roughness/);
    assert.deepEqual(
      cloth.material.vectors[ZHUDA_LIT_SHEEN_UNIFORM],
      [1, 0, 0, 0.2],
      'left as it was',
    );
    // `true` is the defaults.
    const plainCloth = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestSheen',
      surface: plain,
      sheen: true,
    });
    assert.deepEqual(plainCloth.material.vectors[ZHUDA_LIT_SHEEN_UNIFORM], [1, 1, 1, 0.5]);
    // Without it nothing is switched on and there is nothing to change.
    const matt = new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestMatt', surface: plain });
    assert.deepEqual(matt.material.defines, []);
    assert.equal(matt.material.vectors[ZHUDA_LIT_SHEEN_UNIFORM], undefined);
    assert.throws(() => matt.setSheen({ roughness: 0.2 }), /made without sheen/);
    // One shader name cannot mean both; the uniform's name is the material's own.
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestMatt', surface: plain, sheen: true }),
      /different contract/,
    );
    assert.throws(
      () =>
        new ZhudaLitSurfaceMaterial({
          name: 'ZhudaTestTaken',
          surface: plain,
          uniforms: { [ZHUDA_LIT_SHEEN_UNIFORM]: { type: 'vec4', value: [0, 0, 0, 0] } },
        }),
      /the material's own/,
    );
    for (const made of [cloth, plainCloth, matt]) made.dispose();
    assert.throws(() => cloth.setSheen({ roughness: 0.2 }), /Disposed material/);
  } finally {
    globalThis.Laya = saved;
  }
});

test('a uniform takes an array or a LayaAir vector, and says what it wanted', () => {
  const laya = fakeLaya();
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const made = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestSet',
      surface: `${head}s.baseColor*=u_ZhudaTint;s.emission=u_ZhudaGlow.rgb;}`,
      uniforms: {
        u_ZhudaTint: { type: 'vec3', value: [1, 1, 1] },
        u_ZhudaGlow: { type: 'vec4', value: [0, 0, 0, 1] },
      },
    });
    made.set('u_ZhudaTint', [0.1, 0.2, 0.3]);
    assert.deepEqual(made.material.vectors.u_ZhudaTint, [0.1, 0.2, 0.3]);
    made.set('u_ZhudaTint', { x: 0.4, y: 0.5, z: 0.6, w: 9 });
    assert.deepEqual(
      made.material.vectors.u_ZhudaTint,
      [0.4, 0.5, 0.6],
      'as many as the uniform has',
    );
    made.set('u_ZhudaGlow', { r: 1, g: 0.5, b: 0.25, a: 1 });
    assert.deepEqual(made.material.vectors.u_ZhudaGlow, [1, 0.5, 0.25, 1]);
    for (const bad of [[1, 2], [1, 2, Number.NaN], { x: 1, y: 2 }, 'red', null, 3])
      assert.throws(
        () => made.set('u_ZhudaTint', bad),
        /Invalid value for u_ZhudaTint: 3 finite numbers \(an array, or a LayaAir vector\)/,
      );
    assert.deepEqual(made.material.vectors.u_ZhudaTint, [0.4, 0.5, 0.6], 'left as it was');
    made.dispose();
  } finally {
    globalThis.Laya = saved;
  }
});

/** Enough of LayaAir to make a dynamic mesh and see what it uploaded. */
function fakeMeshLaya() {
  const uploads = [];
  class Node {
    transform = {};
    meshRenderer = {};
    constructor(mesh) {
      this.mesh = mesh;
    }
    destroy() {}
  }
  return {
    uploads,
    MeshSprite3D: Node,
    Vector3: class {
      constructor(x, y, z) {
        Object.assign(this, { x, y, z });
      }
    },
    Bounds: class {
      constructor(min, max) {
        Object.assign(this, { min, max });
      }
    },
    VertexMesh: { getVertexDeclaration: (text) => text },
    PrimitiveMesh: {
      _createMesh: (declaration, vertices, indices) => ({
        declaration,
        vertices,
        indices,
        _vertexBuffer: {
          setData: (buffer, at, from, length) => uploads.push({ at, from, length }),
        },
        destroy() {},
      }),
    },
  };
}

test('a dynamic mesh carries a colour a vertex, laid out as LayaAir reads it', () => {
  const laya = fakeMeshLaya();
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const square = {
      positions: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    };
    const colors = new Float32Array([1, 0, 0, 0.1, 0, 1, 0, 0.2, 0, 0, 1, 0.3, 1, 1, 1, 0.4]);
    const tangents = new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
    // Without colours a mesh is as it always was.
    const bare = new ZhudaDynamicMesh(square);
    assert.equal(bare.mesh.declaration, 'POSITION,NORMAL,UV');
    assert.equal(bare.stride, 8);
    assert.deepEqual(bare.offsets, { position: 0, normal: 3, color: null, uv: 6, tangent: null });
    assert.throws(() => bare.setColor(0, 1, 1, 1, 1), /made without colours/);
    const old = new ZhudaDynamicMesh({ ...square, tangents });
    assert.equal(old.mesh.declaration, 'POSITION,NORMAL,UV,TANGENT');
    assert.deepEqual(old.offsets, { position: 0, normal: 3, color: null, uv: 6, tangent: 8 });
    // With them: after the normal, before the texture coordinates.
    const mesh = new ZhudaDynamicMesh({ ...square, colors, tangents });
    assert.equal(mesh.mesh.declaration, 'POSITION,NORMAL,COLOR,UV,TANGENT');
    assert.equal(mesh.stride, 16);
    assert.deepEqual(mesh.offsets, { position: 0, normal: 3, color: 6, uv: 10, tangent: 12 });
    const vertex = (i) => Array.from(mesh.vertices.subarray(i * 16, i * 16 + 16));
    const close = (got, want) =>
      got.forEach((value, k) => assert.ok(Math.abs(value - want[k]) < 1e-6, `${k}: ${value}`));
    close(vertex(2), [1, 0, 1, 0, 1, 0, 0, 0, 1, 0.3, 1, 1, 1, 0, 0, 1]);
    const plain = new ZhudaDynamicMesh({ ...square, colors });
    assert.equal(plain.mesh.declaration, 'POSITION,NORMAL,COLOR,UV');
    assert.equal(plain.stride, 12);
    assert.deepEqual(plain.offsets, { position: 0, normal: 3, color: 6, uv: 10, tangent: null });
    // One vertex's colour changed, and only its range uploaded.
    mesh.setColor(2, 0.5, 0.25, 0.125, 0.9);
    close(vertex(2).slice(6, 10), [0.5, 0.25, 0.125, 0.9]);
    close(vertex(1).slice(6, 10), [0, 1, 0, 0.2]);
    assert.equal(laya.uploads.length, 0, 'nothing is uploaded until a range is');
    mesh.updateRange(2, 1);
    assert.deepEqual(laya.uploads, [{ at: 2 * 16 * 4, from: 2 * 16 * 4, length: 16 * 4 }]);
    for (const bad of [
      [-1, 0, 0, 0, 1],
      [4, 0, 0, 0, 1],
      [0.5, 0, 0, 0, 1],
      [0, Number.NaN, 0, 0, 1],
    ])
      assert.throws(() => mesh.setColor(...bad), /Invalid vertex/);
    // As many colours as vertices.
    assert.throws(
      () => new ZhudaDynamicMesh({ ...square, colors: colors.subarray(0, 12) }),
      /Invalid mesh attributes or indices/,
    );
    assert.throws(
      () =>
        new ZhudaDynamicMesh({
          ...square,
          colors: new Float32Array([...colors.subarray(0, 15), Number.NaN]),
        }),
      /Non-finite mesh data/,
    );
  } finally {
    globalThis.Laya = saved;
  }
});

test("a hook that reads the surface's frame is given it where colours are drawn, and a fixed one elsewhere", () => {
  const reads = `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
    s.baseColor = s.tangent * 0.5 + s.bitangent * 0.25 + s.viewTS;
    s.alpha = 0.5;
  }`;
  const made = buildZhudaLitFragmentShaders({ surface: reads, alphaHash: true });
  assert.ok(made.forward.includes('vec4 vertexColor;vec3 tangent;vec3 bitangent;vec3 viewTS;};'));
  assert.ok(before(made.forward, 'void zhudaSurfaceFrame(', 'void zhudaSurface('));
  const forward = main(made.forward);
  assert.ok(
    before(
      forward,
      'zhudaSurfaceFrame(pixel,zhudaUV,s.tangent,s.bitangent);s.viewTS=vec3(dot(s.viewDirection,s.tangent),dot(s.viewDirection,s.bitangent),dot(s.viewDirection,normalize(pixel.normalWS)));',
      'zhudaSurface(s,',
    ),
    'the frame first, then the hook',
  );
  // The passes that draw no colour: the fields are there, with fixed values.
  const fixed =
    's.tangent=vec3(1.0,0.0,0.0);s.bitangent=vec3(0.0,0.0,1.0);s.viewTS=vec3(0.0,0.0,1.0);';
  assert.ok(made.shadowHook && made.depthHook);
  for (const pass of [made.shadow, made.depth]) {
    assert.ok(pass.includes('vec3 tangent;vec3 bitangent;vec3 viewTS;};'));
    assert.ok(main(pass).includes(fixed));
    assert.ok(!main(pass).includes('zhudaSurfaceFrame(pixel'));
  }
  assert.ok(
    !made.shadow.includes('void zhudaSurfaceFrame('),
    'the shadow pass has no pixel to ask',
  );
  // A hook that reads none of it costs nothing and is the program it was.
  const without = buildZhudaLitFragmentShaders({ surface: plain });
  assert.ok(!without.forward.includes('zhudaSurfaceFrame'));
  assert.ok(!without.forward.includes('vec3 tangent;'));
  // A name in a comment is not a read.
  const commented = buildZhudaLitFragmentShaders({ surface: plain + '// s.viewTS' });
  assert.ok(!commented.forward.includes('zhudaSurfaceFrame'));
});

test('subsurface and strands have defaults and ranges', () => {
  assert.equal(resolveZhudaLitSubsurface(undefined), null);
  assert.equal(resolveZhudaLitSubsurface(false), null);
  assert.deepEqual(resolveZhudaLitSubsurface(true), {
    color: [1, 0.35, 0.25],
    wrap: 0.5,
    back: 0,
    power: 6,
    distortion: 0.3,
  });
  assert.deepEqual(resolveZhudaLitSubsurface({ wrap: 0.2, back: 1 }).back, 1);
  assert.throws(() => resolveZhudaLitSubsurface('skin'), /Invalid subsurface: true, or/);
  assert.throws(() => resolveZhudaLitSubsurface({ wrap: 2 }), /Invalid subsurface.wrap: 0..1/);
  assert.throws(() => resolveZhudaLitSubsurface({ color: [1, 1] }), /Invalid subsurface.color/);
  assert.throws(() => resolveZhudaLitSubsurface({ power: 0 }), /Invalid subsurface.power/);
  assert.throws(() => resolveZhudaLitSubsurface({ back: NaN }), /Invalid subsurface.back/);
  assert.equal(resolveZhudaLitStrands(undefined), null);
  assert.deepEqual(resolveZhudaLitStrands(true), {
    along: 'v',
    color: [0.5, 0.4, 0.3],
    strength: 1,
    shift: [0.05, -0.1],
    exponent: [120, 24],
  });
  assert.equal(resolveZhudaLitStrands({ along: 'u' }).along, 'u');
  assert.throws(() => resolveZhudaLitStrands({ along: 'w' }), /Invalid strands.along/);
  assert.throws(() => resolveZhudaLitStrands({ shift: [0, 2] }), /Invalid strands.shift/);
  assert.throws(() => resolveZhudaLitStrands({ exponent: [8] }), /Invalid strands.exponent/);
  assert.throws(() => resolveZhudaLitStrands({ strength: -1 }), /Invalid strands.strength/);
});

test("subsurface and strands are added light by light after LayaAir's lighting; sheen alone is as it was", () => {
  const skin = buildZhudaLitFragmentShaders({ surface: plain, subsurface: true });
  assert.ok(skin.forward.includes('vec4 vertexColor;vec3 subsurfaceColor;float thickness;};'));
  assert.ok(before(skin.forward, 'vec4 zhudaLitLobesFlow(', 'void main(){'));
  assert.ok(before(skin.forward, 'vec3 zhudaLobeLight(', 'vec3 zhudaLobeLights('));
  const forward = main(skin.forward);
  assert.ok(
    before(
      forward,
      `s.subsurfaceColor=${ZHUDA_LIT_SUBSURFACE_UNIFORM}.rgb;s.thickness=1.0;`,
      'zhudaSurface(s,',
    ),
  );
  assert.ok(
    forward.includes(
      'zhudaLitLobesFlow(inputs,pixel,vec3(0.0),1.0,max(s.subsurfaceColor,vec3(0.0)),clamp(s.thickness,0.0,1.0),vec3(0.0,1.0,0.0),0.0)',
    ),
  );
  assert.ok(!forward.includes('PBR_Metallic_Flow(inputs,pixel)'));
  assert.ok(
    skin.forward.includes('surfaceColor+=PBRLighting(surface,info);surfaceColor+=zhudaLobeLights('),
    "LayaAir's own lighting, then the lobes",
  );
  assert.ok(skin.forward.includes(`${ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM}.x*zhudaThin`));
  assert.ok(!skin.forward.includes(ZHUDA_LIT_STRANDS_UNIFORM), 'no strands were asked for');
  assert.ok(!skin.forward.includes('zhudaSurfaceFrame'), 'and no frame');
  // Strands need the frame; they run along v unless told u.
  const hair = buildZhudaLitFragmentShaders({ surface: plain, strands: true });
  assert.ok(hair.forward.includes('float strandShift;vec3 tangent;vec3 bitangent;vec3 viewTS;};'));
  assert.ok(main(hair.forward).includes('vec3(0.0),0.0,s.bitangent,s.strandShift)'));
  assert.ok(hair.forward.includes(`${ZHUDA_LIT_STRAND_COLOR_UNIFORM}.rgb`));
  assert.ok(!hair.forward.includes(ZHUDA_LIT_SUBSURFACE_UNIFORM));
  const ribbon = buildZhudaLitFragmentShaders({ surface: plain, strands: { along: 'u' } });
  assert.ok(main(ribbon.forward).includes('s.tangent,s.strandShift)'));
  // All three together: the sheen is set as the sheen flow sets it.
  const all = buildZhudaLitFragmentShaders({
    surface: plain,
    sheen: true,
    subsurface: true,
    strands: true,
  });
  assert.ok(
    main(all.forward).includes(
      'zhudaLitLobesFlow(inputs,pixel,max(s.sheenColor,vec3(0.0)),clamp(s.sheenRoughness,0.0,1.0),max(s.subsurfaceColor,vec3(0.0)),clamp(s.thickness,0.0,1.0),s.bitangent,s.strandShift)',
    ),
  );
  assert.ok(!all.forward.includes('vec4 zhudaLitSheenFlow('));
  // Sheen alone keeps its own flow.
  const cloth = buildZhudaLitFragmentShaders({ surface: plain, sheen: true });
  assert.ok(cloth.forward.includes('vec4 zhudaLitSheenFlow('));
  assert.ok(!cloth.forward.includes('zhudaLitLobesFlow'));
  for (const spec of [{ subsurface: true }, { strands: true }])
    assert.throws(
      () => buildZhudaLitFragmentShaders({ surface: plain, ...spec }, {}),
      /not with a ZhudaLitShading/,
    );
});

test('a material with subsurface or strands keeps their values and changes them in place', () => {
  const laya = fakeLaya();
  const saved = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const skin = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestSkin',
      surface: plain,
      subsurface: { wrap: 0.4, back: 0.5 },
    });
    assert.deepEqual(skin.material.vectors[ZHUDA_LIT_SUBSURFACE_UNIFORM], [1, 0.35, 0.25, 0.4]);
    assert.deepEqual(skin.material.vectors[ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM], [0.5, 6, 0.3, 0]);
    const sub = laya.shaders.get('ZhudaTestSkin').subs[0];
    assert.equal(sub.uniforms[ZHUDA_LIT_SUBSURFACE_UNIFORM], 'Vector4');
    assert.equal(sub.uniforms[ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM], 'Vector4');
    assert.equal(sub.uniforms[ZHUDA_LIT_STRANDS_UNIFORM], undefined);
    skin.setSubsurface({ color: [1, 0.5, 0.4], power: 12 });
    assert.deepEqual(skin.material.vectors[ZHUDA_LIT_SUBSURFACE_UNIFORM], [1, 0.5, 0.4, 0.4]);
    assert.deepEqual(skin.material.vectors[ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM], [0.5, 12, 0.3, 0]);
    assert.throws(() => skin.setSubsurface({ wrap: 3 }), /Invalid subsurface.wrap/);
    assert.throws(() => skin.setStrands({ strength: 1 }), /made without strands/);
    const hair = new ZhudaLitSurfaceMaterial({
      name: 'ZhudaTestHair',
      surface: plain,
      strands: { color: [0.6, 0.3, 0.1], shift: [0.1, -0.2] },
    });
    assert.deepEqual(hair.material.vectors[ZHUDA_LIT_STRANDS_UNIFORM], [0.1, -0.2, 120, 24]);
    assert.deepEqual(hair.material.vectors[ZHUDA_LIT_STRAND_COLOR_UNIFORM], [0.6, 0.3, 0.1, 1]);
    hair.setStrands({ strength: 0.5, exponent: [200, 40] });
    assert.deepEqual(hair.material.vectors[ZHUDA_LIT_STRANDS_UNIFORM], [0.1, -0.2, 200, 40]);
    assert.deepEqual(hair.material.vectors[ZHUDA_LIT_STRAND_COLOR_UNIFORM], [0.6, 0.3, 0.1, 0.5]);
    assert.throws(() => hair.setStrands({ along: 'u' }), /part of the program/);
    assert.throws(() => hair.setSubsurface({ wrap: 0.1 }), /made without subsurface/);
    // The name is the contract: the same name with the strands the other way is refused.
    assert.throws(
      () =>
        new ZhudaLitSurfaceMaterial({
          name: 'ZhudaTestHair',
          surface: plain,
          strands: { along: 'u' },
        }),
      /different contract/,
    );
    assert.throws(
      () => new ZhudaLitSurfaceMaterial({ name: 'ZhudaTestSkin', surface: plain }),
      /different contract/,
    );
    for (const own of [ZHUDA_LIT_SUBSURFACE_UNIFORM, ZHUDA_LIT_STRAND_COLOR_UNIFORM])
      assert.throws(
        () =>
          new ZhudaLitSurfaceMaterial({
            name: 'ZhudaTestTakenLobe',
            surface: plain,
            uniforms: { [own]: { type: 'vec4', value: [0, 0, 0, 0] } },
          }),
        /the material's own/,
      );
    skin.dispose();
    hair.dispose();
    assert.throws(() => skin.setSubsurface({ wrap: 0.2 }), /Disposed material/);
  } finally {
    globalThis.Laya = saved;
  }
});
