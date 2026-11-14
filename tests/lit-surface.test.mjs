// What a lit surface's hook writes beyond its colour: alpha, the normal in
// the surface's own frame, and the cut by chance. Pure checks of the programs
// that are generated; the draw is verify:lit-surface.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaLitSurfaceMaterial,
  buildZhudaLitFragmentShaders,
  buildZhudaLitVertexShaders,
  zhudaLitSurfaceWrites,
} from '../packages/core/shaders/LitSurfaceMaterial.ts';
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
  // The two new fields are there to read, and nothing is written back from them.
  assert.ok(made.forward.includes('float alpha;vec3 normalTS;};'));
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
    setShaderName(name) {
      // As LayaAir: another shader clears the defines and the render state.
      this.shader = name;
      this.alphaTest = false;
      this.renderMode = 0;
      this.cull = 'back';
      this.depthWrite = true;
      this.told.push('shader');
    }
    setVector2() {}
    setVector3() {}
    setVector4() {}
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
