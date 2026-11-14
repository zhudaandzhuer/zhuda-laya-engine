// Specular anti-aliasing (installLaya342SpecularAA): the anchors in the
// vendored LayaAir 3.4.2 text, the patched shader text, the installer, the
// watch on materials' normal maps and the scene switch. Pure checks; the draw
// is verify:specular-aa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ZHUDA_NORMAL_NOMIPMAP_DEFINE,
  ZHUDA_SPECULAR_AA_DEFINE,
  installLaya342SpecularAA,
  setZhudaSpecularAA,
  zhudaPatchNormalLength,
  zhudaPatchSpecularAA,
  zhudaPatchSpecularLobe,
  zhudaSpecularAAStatus,
} from '../packages/core/runtime3d/Laya342Adapters.ts';
import { litFragment } from '../packages/core/shaders/LitSurfaceTemplates.ts';

const libs = path.join(import.meta.dirname, '../vendor/laya-3.4.2/libs');
const d3 = fs.readFileSync(path.join(libs, 'laya.d3.js'), 'utf8');
const gltf = fs.readFileSync(path.join(libs, 'laya.gltf.js'), 'utf8');

/** The JavaScript string literal that holds `needle` (or starts at `from`), evaluated. */
function literalAround(source, needle, from = source.indexOf(needle)) {
  const at = from;
  assert.ok(at >= 0, `the vendored text holds ${needle}`);
  let start = at;
  while (!(source[start] === "'" || source[start] === '"') || source[start - 1] === '\\') start--;
  const quote = source[start];
  let end = start + 1;
  while (source[end] !== quote || source[end - 1] === '\\') end++;
  return vm.runInNewContext(source.slice(start, end + 1));
}
/** The text LayaAir registers as include `name`. */
const include = (source, name) => {
  const head = `addInclude("${name}",`;
  const at = source.indexOf(head);
  assert.ok(at >= 0, `the vendored text registers ${name}`);
  return literalAround(source, name, at + head.length);
};
const count = (text, part) => text.split(part).length - 1;
/** No directive after other text on its line: LayaAir's preprocessor reads them by line. */
const directivesAtLineStarts = (text, name) => {
  for (const line of text.split('\n'))
    assert.ok(
      !/.#(if|ifdef|else|endif)/.test(line),
      `${name}: directive inside a line: ${line.slice(0, 60)}`,
    );
};
/** `text` without what sits behind the define: every `#ifdef ZHUDA_SPECULAR_AA` block, nested ones and all. */
function withoutDefine(text) {
  const kept = [];
  let depth = 0;
  for (const line of text.split('\n')) {
    if (depth) {
      if (/^#if/.test(line)) depth++;
      else if (/^#endif/.test(line)) depth--;
      continue;
    }
    if (line === `#ifdef ${ZHUDA_SPECULAR_AA_DEFINE}`) depth = 1;
    else kept.push(line);
  }
  return kept.join('\n');
}
const sameLines = (a, b) => a.replace(/\n+/g, '\n') === b.replace(/\n+/g, '\n');

const pbrFrag = include(d3, 'PBRFrag.glsl');
const pbrLighting = include(d3, 'PBRLighting.glsl');
const pbrMetallicFrag = include(d3, 'PBRMetallicFrag.glsl');
const gltfMetallic = include(gltf, 'glTFMetallicRoughness.glsl');
const pbrForward = literalAround(d3, '#define SHADER_NAME PBRStandardFS');
const gltfForward = literalAround(gltf, '#define SHADER_NAME glTFPBRFS');
const blinnForward = literalAround(d3, '#define SHADER_NAME BlinnPhongFS');
const pbrDepthNormal = literalAround(d3, '#define SHADER_NAME PBRStandardDepthNormalFS');
const SIGNATURE =
  'void getPixelInfo(inout PixelInfo info,const in PixelParams pixel,const in Surface surface){';
const ENERGY = 'info.energyCompensation=(1.0+surface.f0*(1.0/info.dfg.y-1.0));\n#endif\n';
const LOBE =
  'vec3 specularLobe(const in Surface surface,const in PixelInfo pixel,const in LightParams lightParams){float roughness=surface.roughness;float D=distribution(roughness,lightParams.NoH,lightParams.h,pixel.normalWS);float V=visibility(roughness,pixel.NoV,lightParams.NoL);';
const STORE = 'inputs.normalTS=normalScale(normalSampler,u_NormalScale);';

test('the vendored text holds every anchor exactly once', () => {
  assert.equal(count(pbrFrag, SIGNATURE), 1, 'PBRFrag.glsl: the getPixelInfo signature');
  assert.equal(count(pbrFrag, ENERGY), 1, 'PBRFrag.glsl: the line that sets the energy gain');
  assert.equal(
    count(pbrLighting, 'float specularAA(float roughness,in vec3 normalWS){'),
    1,
    "PBRLighting.glsl: Laya's specularAA",
  );
  assert.equal(count(pbrLighting, LOBE), 1, 'PBRLighting.glsl: the head of specularLobe');
  // Nothing upstream calls it; once patched, PBRFrag.glsl does.
  assert.equal(count(d3, 'specularAA('), 1, 'defined, never called');
  assert.equal(count(gltf, 'specularAA('), 0);
  // What the patch leans on is there to lean on.
  for (const name of ['vertexNormalWS', 'normalWS', 'NoV'])
    assert.ok(new RegExp(`struct PixelInfo\\{[^}]*\\b${name}\\b`).test(pbrLighting), name);
  for (const name of ['h', 'NoL', 'VoH'])
    assert.ok(new RegExp(`struct LightParams\\{[^}]*\\b${name};`).test(pbrLighting), name);
  assert.ok(
    pbrFrag.includes('#ifdef TANGENT\ninfo.normalWS=normalize(pixel.TBN*surface.normalTS);'),
  );
  assert.ok(
    include(d3, 'BRDF.glsl').includes('float visibility(float roughness,float NoV,float NoL)'),
  );
  const sample =
    /vec3 normalSampler=texture2D\(u_NormalTexture,(\w+)\)\.(rgb|xyz);normalSampler=normalize\(normalSampler\*2\.0-1\.0\);/g;
  for (const [name, text, uv] of [
    ['PBR', pbrForward, 'uv'],
    ['glTFPBR', gltfForward, 'normalUV'],
    ['ZhudaLitSurface', litFragment, 'uv'],
  ]) {
    const found = [...text.matchAll(sample)];
    assert.equal(found.length, 1, `${name}: the normal map is read once`);
    assert.equal(found[0][1], uv, `${name}: at ${uv}`);
    assert.equal(count(text, STORE), 1, `${name}: and stored once`);
  }
});

test('every PBR caller of getPixelInfo hands it a surface of its own', () => {
  // `inout` needs a variable: a `const in` surface passed on would not compile.
  const local =
    'Surface surface;initSurface(surface,inputs,pixel);PixelInfo info;getPixelInfo(info,pixel,surface);';
  assert.equal(count(pbrMetallicFrag, 'getPixelInfo('), 1);
  assert.equal(count(pbrMetallicFrag, local), 1);
  // The glTF flow and its debug view.
  assert.equal(count(gltf, 'getPixelInfo(info,pixel,surface)'), 2);
  assert.equal(count(gltfMetallic, local), 1);
  assert.equal(count(gltf, local), 2);
  // Blinn-Phong has a getPixelInfo of its own, and does not include PBRFrag.glsl.
  const blinn = include(d3, 'BlinnPhongFrag.glsl');
  assert.ok(!blinn.includes('PBRFrag.glsl') && blinn.includes('void getPixelInfo('));
  assert.equal(count(d3, 'getPixelInfo(info,pixel,surface)'), 2, 'PBR flow and Blinn-Phong');
  // Every other PBR shader goes through one of these flows.
  assert.ok(pbrForward.includes('#include "PBRMetallicFrag.glsl"'));
  assert.ok(litFragment.includes('#include "PBRMetallicFrag.glsl"'));
  assert.ok(gltfForward.includes('#include "glTFMetallicRoughness.glsl"'));
});

test('PBRFrag.glsl is patched behind the define, at line starts, without #else', () => {
  const { text, reason } = zhudaPatchSpecularAA(pbrFrag);
  assert.equal(reason, undefined);
  assert.ok(text.includes(SIGNATURE.replace('const in Surface surface', 'inout Surface surface')));
  // The helper comes before getPixelInfo and calls Laya's own function.
  const helper = text.indexOf('float zhudaSpecularAA(');
  assert.ok(helper > text.indexOf('#include "PBRLighting.glsl"'));
  assert.ok(helper < text.indexOf('void getPixelInfo('));
  assert.match(text, /float r=specularAA\(roughness,normalWS\);/);
  // Called on the mesh's own normal, once the gain for light scattered more
  // than once is worked out from the material's roughness, before anything
  // else reads the roughness.
  const call = text.indexOf('surface.roughness=zhudaSpecularAA(surface.roughness,');
  assert.ok(text.includes('zhudaSpecularAA(surface.roughness,info.vertexNormalWS,zhudaNormalTS)'));
  assert.ok(call > text.indexOf('info.energyCompensation=(1.0+surface.f0'));
  assert.ok(call > text.indexOf('info.dfg=prefilteredDFG_LUT('));
  for (const later of ['#ifdef IRIDESCENCE', '#ifdef CLEARCOAT', 'info.ab=surface.roughness;'])
    assert.ok(call < text.indexOf(later), `before ${later}`);
  assert.ok(text.includes('surface.perceptualRoughness=sqrt(surface.roughness);'));
  // A mesh without tangents does not apply the normal map: it widens nothing.
  assert.ok(
    text.includes(
      'vec3 zhudaNormalTS=vec3(0.0,0.0,1.0);\n#ifdef TANGENT\nzhudaNormalTS=surface.normalTS;\n#endif\n',
    ),
  );
  directivesAtLineStarts(text, 'PBRFrag.glsl');
  // LayaAir's preprocessor drops an #else branch: none is added.
  assert.equal(count(text, '#else'), count(pbrFrag, '#else'));
  // Everything new sits behind the define.
  assert.ok(
    sameLines(
      withoutDefine(text).replace('inout Surface surface', 'const in Surface surface'),
      pbrFrag,
    ),
  );
  // Twice changes nothing more.
  assert.deepEqual(zhudaPatchSpecularAA(text), { text });
});

test('PBRLighting.glsl draws the widened highlight behind the define', () => {
  const { text, reason } = zhudaPatchSpecularLobe(pbrLighting);
  assert.equal(reason, undefined);
  const helper = text.indexOf('float zhudaLobe(');
  assert.ok(helper > text.indexOf('#include "BRDF.glsl"'), 'after visibility and INVERT_PI');
  assert.ok(helper < text.indexOf('vec3 specularLobe('));
  // Both shares start at nothing, for a shader that sets up its pixel elsewhere.
  assert.ok(text.includes('float zhudaWidened=0.0;\nfloat zhudaBumps=0.0;\n'));
  // Used once the lobe and the visibility are known, before they are multiplied.
  const use = text.indexOf('D=zhudaLobe(D,roughness,lightParams.h,pixel.normalWS);');
  assert.ok(text.includes('V=zhudaFacets(V,roughness,lightParams.VoH,lightParams.NoL);'));
  assert.ok(use > text.indexOf(LOBE));
  assert.ok(
    use < text.indexOf('vec3 F=fresnel(surface.f0,surface.f90,lightParams.LoH);return(D*V)*F;}'),
  );
  // The iridescent lobe keeps Laya's shape: it is not the one patched.
  assert.equal(count(text, 'D=zhudaLobe('), 1);
  directivesAtLineStarts(text, 'PBRLighting.glsl');
  assert.equal(count(text, '#else'), count(pbrLighting, '#else'));
  // Without the define: Laya's text, with line breaks where the blocks were
  // (the lobe's one line is now three).
  assert.equal(withoutDefine(text).replace(/\n/g, ''), pbrLighting.replace(/\n/g, ''));
  assert.equal(count(withoutDefine(text), 'zhuda'), 0);
  assert.deepEqual(zhudaPatchSpecularLobe(text), { text });
  // The two patches meet: what one declares the other sets.
  const frag = zhudaPatchSpecularAA(pbrFrag).text;
  assert.ok(frag.includes('zhudaWidened=saturate(') && frag.includes('zhudaBumps=saturate('));
});

test('a changed include is left alone, with the reason', () => {
  const missing = pbrFrag.replace('info.energyCompensation=(1.0+', 'info.energyCompensation=(2.0+');
  const result = zhudaPatchSpecularAA(missing);
  assert.equal(result.text, missing);
  assert.match(result.reason, /the line that sets info\.energyCompensation 0 times/);
  const twice = pbrFrag + pbrFrag;
  assert.match(zhudaPatchSpecularAA(twice).reason, /getPixelInfo signature 2 times/);
  assert.equal(zhudaPatchSpecularAA('').text, '');
  const noFunction = pbrLighting.replace('float specularAA(', 'float specularAB(');
  assert.deepEqual(zhudaPatchSpecularLobe(noFunction), {
    text: noFunction,
    reason: 'PBRLighting.glsl holds specularAA(roughness, normalWS) 0 times, not once',
  });
  const noLobe = pbrLighting.replace('float V=visibility(roughness,pixel.NoV,', 'float V=vis(');
  assert.match(zhudaPatchSpecularLobe(noLobe).reason, /the head of specularLobe 0 times/);
  assert.equal(zhudaPatchSpecularLobe(noLobe).text, noLobe);
});

test('the forward passes keep the spread of the normals, only where a mipmapped map is minified', () => {
  for (const [name, text, uv, swizzle] of [
    ['PBR', pbrForward, 'uv', 'rgb'],
    ['glTFPBR', gltfForward, 'normalUV', 'xyz'],
    ['ZhudaLitSurface', litFragment, 'uv', 'rgb'],
    // A lit material with OpenGL-convention maps drops the y flip.
    [
      'ZhudaLitSurface opengl',
      litFragment.replace(/\bnormalSampler\.y\*=-1\.0;/g, ''),
      'uv',
      'rgb',
    ],
  ]) {
    const { text: patched, reason } = zhudaPatchNormalLength(text);
    assert.equal(reason, undefined, name);
    assert.notEqual(patched, text, name);
    assert.ok(patched.includes('vec3 zhudaFine=normalSampler*2.0-1.0;'), name);
    assert.ok(
      patched.includes(
        `\n#if defined(${ZHUDA_SPECULAR_AA_DEFINE}) && defined(GRAPHICS_API_GLES3) && !defined(DETAILNORMAL) && !defined(${ZHUDA_NORMAL_NOMIPMAP_DEFINE})\n`,
      ),
      name,
    );
    assert.ok(patched.includes(`vec2 zhudaX=dFdx(${uv})*zhudaSize;`), `${name}: at ${uv}`);
    // One mipmap level up, by the bias a fragment shader's lookup takes.
    assert.ok(
      patched.includes(`vec3 zhudaCoarse=texture2D(u_NormalTexture,${uv},1.0).${swizzle}*2.0-1.0;`),
      name,
    );
    // From two texels to a pixel to four, by the square of the larger rate.
    assert.ok(patched.includes('smoothstep(4.0,16.0,max(dot(zhudaX,zhudaX),dot(zhudaY,zhudaY)))'));
    // 8-bit rounding is not spread; the normal scale is; no mipmaps, no spread.
    assert.ok(
      patched.includes('max(1.0-length(zhudaCoarse)-0.004,0.0)*u_NormalScale*u_NormalScale'),
    );
    assert.ok(patched.includes('smoothstep(0.0,0.0001,dot(zhudaStep,zhudaStep))'), name);
    // The block comes after the normal is stored, and only shortens it.
    assert.ok(
      patched.indexOf('inputs.normalTS*=1.0-min(zhudaShort,0.9);') > patched.indexOf(STORE),
    );
    assert.deepEqual(zhudaPatchNormalLength(patched), { text: patched }, `${name}: twice`);
    directivesAtLineStarts(patched, name);
    // Behind the define: without it, one local more and nothing else.
    const bare = patched
      .replace(/\n#if defined\(ZHUDA_SPECULAR_AA\)[^\n]*\n[^\n]*\n#endif\n/, '')
      .replace('vec3 zhudaFine=normalSampler*2.0-1.0;', '');
    assert.equal(bare, text, name);
  }
  // Not a PBR forward pass, or one without a normal map: the same text, no reason.
  for (const other of [blinnForward, pbrDepthNormal, 'void main(){}'])
    assert.deepEqual(zhudaPatchNormalLength(other), { text: other });
  const unmapped = '#include "PBRMetallicFrag.glsl";\nvoid main(){}';
  assert.deepEqual(zhudaPatchNormalLength(unmapped), { text: unmapped });
});

test('a PBR forward pass that reads its normal map another way is left alone, with the reason', () => {
  // One space more in the store: an upstream change, or a shader of a game's own.
  const spaced = pbrForward.replace(STORE, STORE.replace(',u_NormalScale', ', u_NormalScale'));
  assert.deepEqual(zhudaPatchNormalLength(spaced), {
    text: spaced,
    reason: 'PBRStandardFS stores its normal 0 times in the known way, not once',
  });
  const twice = gltfForward.replace(
    'vec3 normalSampler=texture2D(u_NormalTexture,normalUV).xyz;',
    'vec3 normalSampler=texture2D(u_NormalTexture,normalUV).xyz*vec3(1.0);',
  );
  assert.match(
    zhudaPatchNormalLength(twice).reason,
    /^glTFPBRFS reads its normal map 0 times in the known way, not once$/,
  );
  const unnamed = '#include "PBRMetallicFrag.glsl";\nuniform sampler2D u_NormalTexture;';
  assert.match(zhudaPatchNormalLength(unnamed).reason, /^a PBR pass reads its normal map 0 times/);
});

/**
 * The helper's arithmetic, as the GLSL writes it: the roughness squared a
 * filtered normal of length `l` adds, with no curvature term.
 */
const spread = (l) => {
  const x = Math.min(Math.max(l, 0.05), 1);
  return Math.min((2 * (1 - x * x)) / (x * (3 - x * x)), 0.5);
};

test('the normal-map term: none for a full-length normal, the spread of the normals as it shortens, capped', () => {
  assert.equal(spread(1), 0);
  assert.equal(spread(1.3), 0, 'a longer normal adds nothing');
  let before = 0;
  for (let l = 0.99; l > 0; l -= 0.01) {
    const now = spread(l);
    assert.ok(now >= before, `at ${l.toFixed(2)}`);
    before = now;
  }
  assert.equal(spread(0.5), 0.5, 'never fully matte');
  // Normals spread as a narrow Gaussian of variance v to each side average
  // to a length of about 1 - v, and widen a lobe to alpha squared + 2 v.
  for (const variance of [0.001, 0.01, 0.03]) {
    const added = spread(1 - variance);
    assert.ok(Math.abs(added / (2 * variance) - 1) < 0.05, `variance ${variance}: ${added}`);
  }
  // A smooth surface stays as smooth as its normals say: alpha 0.04 and l = 1.
  assert.equal(Math.sqrt(0.04 * 0.04 + spread(1)), 0.04);
});

/** `zhudaLobe` at full share, as the GLSL writes it: Beckmann's lobe at `sine` squared = s. */
const gaussianLobe = (s, roughness) => {
  const c = Math.max(1 - s, 0.0001),
    q = Math.min(Math.sqrt(s) / roughness, 100),
    k = 1 / (roughness * c);
  return (Math.exp((-q * q) / c) * k * k) / Math.PI;
};

test('the Gaussian lobe holds as much light as GGX and none far from the peak', () => {
  for (const roughness of [0.05, 0.2, 0.5]) {
    // Over the hemisphere, weighted by the cosine: a distribution of normals sums to one.
    let sum = 0;
    const steps = 200000;
    for (let i = 0; i < steps; i++) {
      const theta = ((i + 0.5) / steps) * (Math.PI / 2);
      sum +=
        gaussianLobe(Math.sin(theta) ** 2, roughness) *
        Math.cos(theta) *
        Math.sin(theta) *
        2 *
        Math.PI *
        (Math.PI / 2 / steps);
    }
    assert.ok(Math.abs(sum - 1) < 0.02, `roughness ${roughness}: ${sum}`);
    // The same peak as GGX, and next to nothing at eighty degrees, where GGX
    // still holds a share that grows with the roughness squared.
    assert.ok(Math.abs(gaussianLobe(0, roughness) * Math.PI * roughness * roughness - 1) < 1e-9);
    const s = Math.sin((80 * Math.PI) / 180) ** 2;
    const ggx = roughness ** 2 / (Math.PI * ((1 - s) * (roughness ** 2 - 1) + 1) ** 2);
    assert.ok(gaussianLobe(s, roughness) < ggx * 1e-3, `roughness ${roughness}: no tail`);
  }
});

function fakeRuntime({ configDefines = true, materials = true } = {}) {
  const included = {};
  const config = new Set();
  const passes = [];
  class SubShader {
    addShaderPass(vertex, fragment) {
      passes.push(fragment);
    }
  }
  class Material {
    constructor() {
      this.defines = new Set();
      this.textures = {};
    }
    setTextureByIndex(index, texture) {
      this.textures[index] = texture;
      return 'set';
    }
    addDefine(define) {
      this.defines.add(define);
    }
    removeDefine(define) {
      this.defines.delete(define);
    }
  }
  const runtime = {
    Shader3D: {
      addInclude(name, text) {
        included[name] = text;
      },
      getDefineByName: (name) => `define:${name}`,
      propertyNameToID: (name) => (name === 'u_NormalTexture' ? 7 : 3),
      ...(configDefines ? { _configDefineValues: { add: (d) => config.add(d) } } : {}),
    },
    SubShader,
    ...(materials ? { Material } : {}),
  };
  return { runtime, included, config, passes };
}
const fakeScene = () => {
  const defines = new Set();
  return {
    defines,
    _shaderValues: {
      addDefine: (d) => defines.add(d),
      removeDefine: (d) => defines.delete(d),
    },
  };
};
const NOT_INSTALLED = {
  patched: false,
  defaultOn: false,
  reason: 'not installed',
  normalMapPasses: 0,
  normalMapSkipped: [],
  watchesNormalMaps: false,
};

test('the installer patches as LayaAir registers, in either order; the define is a default only when asked', () => {
  assert.equal(installLaya342SpecularAA({}), false);
  assert.equal(installLaya342SpecularAA(null), false);
  for (const order of [
    ['PBRLighting.glsl', 'PBRFrag.glsl'],
    ['PBRFrag.glsl', 'PBRLighting.glsl'],
  ]) {
    const { runtime, included, config, passes } = fakeRuntime();
    assert.deepEqual(zhudaSpecularAAStatus(runtime), NOT_INSTALLED);
    assert.equal(installLaya342SpecularAA(runtime, { defaultOn: true }), true);
    const wrapped = runtime.Shader3D.addInclude;
    assert.equal(installLaya342SpecularAA(runtime), true);
    assert.equal(runtime.Shader3D.addInclude, wrapped, 'installed once');
    assert.match(zhudaSpecularAAStatus(runtime).reason, /before Laya\.init/);
    runtime.Shader3D.addInclude('Other.glsl', pbrFrag);
    assert.equal(included['Other.glsl'], pbrFrag, 'other includes are untouched');
    const text = (name) => (name === 'PBRFrag.glsl' ? pbrFrag : pbrLighting);
    runtime.Shader3D.addInclude(order[0], text(order[0]));
    assert.equal(config.size, 0, 'not before both are seen');
    runtime.Shader3D.addInclude(order[1], text(order[1]));
    assert.equal(included['PBRFrag.glsl'], zhudaPatchSpecularAA(pbrFrag).text);
    assert.equal(included['PBRLighting.glsl'], zhudaPatchSpecularLobe(pbrLighting).text);
    assert.deepEqual([...config], [`define:${ZHUDA_SPECULAR_AA_DEFINE}`]);
    new runtime.SubShader().addShaderPass('vs', pbrForward);
    new runtime.SubShader().addShaderPass('vs', blinnForward);
    assert.equal(passes[0], zhudaPatchNormalLength(pbrForward).text);
    assert.equal(passes[1], blinnForward);
    assert.deepEqual(zhudaSpecularAAStatus(runtime), {
      patched: true,
      defaultOn: true,
      normalMapPasses: 1,
      normalMapSkipped: [],
      watchesNormalMaps: true,
    });
    const scene = fakeScene();
    assert.equal(setZhudaSpecularAA(scene, true, runtime), true);
    assert.ok(scene.defines.has(`define:${ZHUDA_SPECULAR_AA_DEFINE}`));
    assert.equal(setZhudaSpecularAA(scene, false, runtime), false);
    assert.equal(scene.defines.size, 0);
  }
});

test('a forward pass the patch does not know is named once, in the status and on the console', (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(message));
  const { runtime, passes } = fakeRuntime();
  installLaya342SpecularAA(runtime);
  runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
  runtime.Shader3D.addInclude('PBRLighting.glsl', pbrLighting);
  const spaced = pbrForward.replace(STORE, STORE.replace(',u_NormalScale', ', u_NormalScale'));
  new runtime.SubShader().addShaderPass('vs', spaced);
  new runtime.SubShader().addShaderPass('vs', spaced);
  new runtime.SubShader().addShaderPass('vs', gltfForward);
  assert.equal(passes[0], spaced, 'passed on as it was');
  const status = zhudaSpecularAAStatus(runtime);
  // Still in place: the curvature term needs no forward pass. But the pass is named.
  assert.equal(status.patched, true);
  assert.equal(status.defaultOn, false, 'nobody asked for it to be a default');
  assert.equal(status.normalMapPasses, 1, 'the glTF pass alone');
  assert.deepEqual(status.normalMapSkipped, [
    'PBRStandardFS stores its normal 0 times in the known way, not once',
  ]);
  assert.deepEqual(warnings, [
    '[zhuda] specular anti-aliasing leaves a normal map unfiltered: PBRStandardFS stores its normal 0 times in the known way, not once',
  ]);
  // The list handed out is a copy.
  status.normalMapSkipped.push('x');
  assert.equal(zhudaSpecularAAStatus(runtime).normalMapSkipped.length, 1);
});

test('a material is told when its normal map has no mipmaps', () => {
  const { runtime } = fakeRuntime();
  installLaya342SpecularAA(runtime);
  const define = `define:${ZHUDA_NORMAL_NOMIPMAP_DEFINE}`;
  const material = new runtime.Material();
  assert.equal(material.setTextureByIndex(7, { mipmap: false }), 'set', 'the result is passed on');
  assert.deepEqual(material.textures[7], { mipmap: false }, 'the texture is set as before');
  assert.ok(material.defines.has(define));
  // Another slot does not touch it.
  material.setTextureByIndex(3, { mipmap: true });
  assert.ok(material.defines.has(define));
  material.setTextureByIndex(7, { mipmap: true });
  assert.equal(material.defines.size, 0, 'cleared by a mipmapped map');
  material.setTextureByIndex(7, { mipmap: false });
  material.setTextureByIndex(7, null);
  assert.equal(material.defines.size, 0, 'cleared when the map is taken away');
  // A texture that cannot say (not ready, destroyed) is taken to have mipmaps.
  material.setTextureByIndex(7, {
    get mipmap() {
      throw Error('destroyed');
    },
  });
  material.setTextureByIndex(7, {});
  assert.equal(material.defines.size, 0);
  assert.equal(zhudaSpecularAAStatus(runtime).watchesNormalMaps, true);
  // A runtime without materials to watch says so.
  const bare = fakeRuntime({ materials: false });
  installLaya342SpecularAA(bare.runtime);
  assert.equal(zhudaSpecularAAStatus(bare.runtime).watchesNormalMaps, false);
});

test('a missing anchor or function leaves it off, says why once, and refuses to turn it on', (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(message));
  {
    const { runtime, included, config } = fakeRuntime();
    installLaya342SpecularAA(runtime);
    const changed = pbrFrag.replace('const in Surface surface', 'Surface surface');
    runtime.Shader3D.addInclude('PBRFrag.glsl', changed);
    runtime.Shader3D.addInclude('PBRLighting.glsl', pbrLighting);
    runtime.Shader3D.addInclude('PBRLighting.glsl', pbrLighting);
    assert.equal(included['PBRFrag.glsl'], changed, 'passed on as it was');
    assert.equal(config.size, 0);
    const status = zhudaSpecularAAStatus(runtime);
    assert.equal(status.patched, false);
    assert.match(status.reason, /getPixelInfo signature 0 times/);
    const scene = fakeScene();
    scene._shaderValues.addDefine(`define:${ZHUDA_SPECULAR_AA_DEFINE}`);
    assert.equal(setZhudaSpecularAA(scene, true, runtime), false);
    assert.equal(scene.defines.size, 0, 'the define is taken off, not left to fail to compile');
  }
  {
    const { runtime, included, config } = fakeRuntime();
    installLaya342SpecularAA(runtime);
    runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
    const other = 'float other(){return 1.0;}';
    runtime.Shader3D.addInclude('PBRLighting.glsl', other);
    assert.equal(included['PBRLighting.glsl'], other, 'passed on as it was');
    assert.equal(config.size, 0);
    const status = zhudaSpecularAAStatus(runtime);
    assert.equal(status.patched, false, 'half a patch is no patch');
    assert.match(
      status.reason,
      /PBRLighting\.glsl holds specularAA\(roughness, normalWS\) 0 times/,
    );
    assert.equal(setZhudaSpecularAA(fakeScene(), true, runtime), false);
  }
  {
    const { runtime, config } = fakeRuntime();
    installLaya342SpecularAA(runtime);
    runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
    runtime.Shader3D.addInclude(
      'PBRLighting.glsl',
      pbrLighting.replace('vec3 specularLobe(', 'vec3 specularLobe2('),
    );
    assert.equal(config.size, 0);
    assert.match(zhudaSpecularAAStatus(runtime).reason, /the head of specularLobe 0 times/);
  }
  {
    const { runtime } = fakeRuntime({ configDefines: false });
    installLaya342SpecularAA(runtime, { defaultOn: true });
    runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
    runtime.Shader3D.addInclude('PBRLighting.glsl', pbrLighting);
    const status = zhudaSpecularAAStatus(runtime);
    assert.equal(status.patched, true);
    assert.equal(status.defaultOn, false);
    assert.match(status.reason, /_configDefineValues is missing/);
  }
  assert.equal(warnings.length, 4, 'one warning for each runtime');
  assert.ok(warnings.every((w) => w.startsWith('[zhuda] specular anti-aliasing is off: ')));
  assert.throws(() => setZhudaSpecularAA({}, true), /pass a Laya Scene3D/);
  assert.throws(() => setZhudaSpecularAA(null, false), /pass a Laya Scene3D/);
  // No LayaAir to ask for the define: said, not a TypeError.
  assert.throws(() => setZhudaSpecularAA(fakeScene(), true, undefined), {
    message: 'setZhudaSpecularAA: LayaAir is not loaded',
  });
  assert.throws(() => setZhudaSpecularAA(fakeScene(), false, {}), /LayaAir is not loaded/);
});

test('off until asked: a plain install leaves new scenes alone, and a later call can make it the default', () => {
  const { runtime, config } = fakeRuntime();
  assert.equal(installLaya342SpecularAA(runtime), true);
  runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
  runtime.Shader3D.addInclude('PBRLighting.glsl', pbrLighting);
  let status = zhudaSpecularAAStatus(runtime);
  assert.equal(status.patched, true);
  assert.equal(status.defaultOn, false);
  assert.equal(status.reason, undefined, 'in place, not broken');
  assert.equal(config.size, 0, 'no define a new scene would copy');
  // A scene asks for itself.
  const scene = fakeScene();
  assert.equal(setZhudaSpecularAA(scene, true, runtime), true);
  assert.ok(scene.defines.has(`define:${ZHUDA_SPECULAR_AA_DEFINE}`));
  // Asked later, after the includes were registered: new scenes get it from then on.
  assert.equal(installLaya342SpecularAA(runtime, { defaultOn: true }), true);
  status = zhudaSpecularAAStatus(runtime);
  assert.equal(status.defaultOn, true);
  assert.deepEqual([...config], [`define:${ZHUDA_SPECULAR_AA_DEFINE}`]);
  // Asking again adds nothing; a plain call takes nothing back.
  installLaya342SpecularAA(runtime, { defaultOn: true });
  installLaya342SpecularAA(runtime);
  assert.equal(config.size, 1);
  assert.equal(zhudaSpecularAAStatus(runtime).defaultOn, true);
});
