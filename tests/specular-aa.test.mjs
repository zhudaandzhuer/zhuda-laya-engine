// Specular anti-aliasing (installLaya342SpecularAA): the anchors in the
// vendored LayaAir 3.4.2 text, the patched shader text, the installer and the
// scene switch. Pure checks; the draw is verify:specular-aa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ZHUDA_SPECULAR_AA_DEFINE,
  installLaya342SpecularAA,
  setZhudaSpecularAA,
  zhudaPatchNormalLength,
  zhudaPatchSpecularAA,
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

const pbrFrag = include(d3, 'PBRFrag.glsl');
const pbrLighting = include(d3, 'PBRLighting.glsl');
const pbrMetallicFrag = include(d3, 'PBRMetallicFrag.glsl');
const gltfMetallic = include(gltf, 'glTFMetallicRoughness.glsl');
const pbrForward = literalAround(d3, '#define SHADER_NAME PBRStandardFS');
const gltfForward = literalAround(gltf, '#define SHADER_NAME glTFPBRFS');
const blinnForward = literalAround(d3, '#define SHADER_NAME BlinnPhongFS');
const pbrDepthNormal = literalAround(d3, '#define SHADER_NAME PBRStandardDepthNormalFS');

test('the vendored text holds every anchor exactly once', () => {
  assert.equal(
    count(
      pbrFrag,
      'void getPixelInfo(inout PixelInfo info,const in PixelParams pixel,const in Surface surface){',
    ),
    1,
    'PBRFrag.glsl: the getPixelInfo signature',
  );
  assert.equal(
    count(pbrFrag, 'info.normalWS=pixel.normalWS;\n#endif\ninfo.tangentWS=pixel.tangentWS;'),
    1,
    'PBRFrag.glsl: the line after the shading normal',
  );
  assert.equal(
    count(pbrLighting, 'float specularAA(float roughness,in vec3 normalWS){'),
    1,
    "PBRLighting.glsl: Laya's specularAA",
  );
  // Nothing upstream calls it; once patched, PBRFrag.glsl does.
  assert.equal(count(d3, 'specularAA('), 1, 'defined, never called');
  assert.equal(count(gltf, 'specularAA('), 0);
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
    assert.equal(
      count(text, 'inputs.normalTS=normalScale(normalSampler,u_NormalScale);'),
      1,
      `${name}: and stored once`,
    );
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
  assert.ok(
    text.includes(
      'void getPixelInfo(inout PixelInfo info,const in PixelParams pixel,inout Surface surface){',
    ),
  );
  // The helper comes before getPixelInfo and calls Laya's own function.
  const helper = text.indexOf('float zhudaSpecularAA(');
  assert.ok(helper > text.indexOf('#include "PBRLighting.glsl"'));
  assert.ok(helper < text.indexOf('void getPixelInfo('));
  assert.match(text, /float r=specularAA\(roughness,normalWS\);/);
  // Called once the shading normal is set, before anything reads the roughness.
  const call = text.indexOf('surface.roughness=zhudaSpecularAA(');
  assert.ok(call > text.indexOf('info.normalWS=normalize(pixel.TBN*surface.normalTS);'));
  assert.ok(call < text.indexOf('info.dfg=prefilteredDFG_LUT('));
  assert.ok(text.includes('surface.perceptualRoughness=sqrt(surface.roughness);'));
  for (const line of text.split('\n'))
    assert.ok(
      !/.#(if|ifdef|else|endif)/.test(line),
      `directive inside a line: ${line.slice(0, 60)}`,
    );
  // LayaAir's preprocessor drops an #else branch: none is added.
  assert.equal(count(text, '#else'), count(pbrFrag, '#else'));
  // Everything new sits behind the define.
  const added = text
    .replace(/\n#ifdef ZHUDA_SPECULAR_AA\n[^\n]*\n#endif/g, '')
    .replace('inout Surface surface', 'const in Surface surface');
  assert.equal(added.replace(/\n+/g, '\n'), pbrFrag.replace(/\n+/g, '\n'));
  // Twice changes nothing more.
  assert.deepEqual(zhudaPatchSpecularAA(text), { text });
});

test('a changed PBRFrag.glsl is left alone, with the reason', () => {
  const missing = pbrFrag.replace('info.tangentWS=pixel.tangentWS;', 'info.tangentWS=t;');
  const result = zhudaPatchSpecularAA(missing);
  assert.equal(result.text, missing);
  assert.match(result.reason, /the line after the shading normal 0 times/);
  const twice = pbrFrag + pbrFrag;
  assert.match(zhudaPatchSpecularAA(twice).reason, /getPixelInfo signature 2 times/);
  assert.equal(zhudaPatchSpecularAA('').text, '');
});

test('the forward passes keep the filtered normal length, only where the map is minified', () => {
  for (const [name, text, uv] of [
    ['PBR', pbrForward, 'uv'],
    ['glTFPBR', gltfForward, 'normalUV'],
    ['ZhudaLitSurface', litFragment, 'uv'],
    // A lit material with OpenGL-convention maps drops the y flip.
    ['ZhudaLitSurface opengl', litFragment.replace(/\bnormalSampler\.y\*=-1\.0;/g, ''), 'uv'],
  ]) {
    const patched = zhudaPatchNormalLength(text);
    assert.notEqual(patched, text, name);
    assert.ok(patched.includes('float zhudaNormalLength=length(normalSampler*2.0-1.0);'), name);
    assert.ok(
      patched.includes(
        '\n#if defined(ZHUDA_SPECULAR_AA) && defined(GRAPHICS_API_GLES3) && !defined(DETAILNORMAL)\n',
      ),
      name,
    );
    assert.ok(patched.includes(`vec2 zhudaX=dFdx(${uv})*zhudaSize;`), `${name}: at ${uv}`);
    assert.ok(patched.includes('smoothstep(1.0,4.0,'), name);
    assert.equal(zhudaPatchNormalLength(patched), patched, `${name}: twice`);
    for (const line of patched.split('\n'))
      assert.ok(!/.#(if|ifdef|else|endif)/.test(line), `${name}: ${line.slice(0, 60)}`);
  }
  // Not a PBR forward pass: the same text comes back.
  for (const other of [blinnForward, pbrDepthNormal, 'void main(){}'])
    assert.equal(zhudaPatchNormalLength(other), other);
});

/**
 * The added roughness as the helper computes it (alpha squared), for a
 * filtered normal of length `l` and no derivative term.
 */
const spread = (l) => {
  const x = Math.min(Math.max(l + 0.004, 0.05), 1);
  return Math.min((1 - x * x) / (2 * x * (3 - x * x)), 0.12);
};

test('the normal-map term: none for a full-length normal, more as it shortens, capped', () => {
  assert.equal(spread(1), 0);
  assert.equal(spread(0.996), 0, '8-bit rounding is not spread');
  assert.ok(spread(0.99) > 0 && spread(0.99) < 0.003);
  let before = 0;
  for (let l = 0.99; l > 0; l -= 0.01) {
    const now = spread(l);
    assert.ok(now >= before, `at ${l.toFixed(2)}`);
    before = now;
  }
  assert.equal(spread(0.5), 0.12, 'never fully matte');
  // A smooth surface stays as smooth as its normals say: alpha 0.04 and l = 1.
  assert.equal(Math.sqrt(0.04 * 0.04 + spread(1)), 0.04);
});

function fakeRuntime({ configDefines = true } = {}) {
  const included = {};
  const config = new Set();
  const passes = [];
  class SubShader {
    addShaderPass(vertex, fragment) {
      passes.push(fragment);
    }
  }
  const runtime = {
    Shader3D: {
      addInclude(name, text) {
        included[name] = text;
      },
      getDefineByName: (name) => `define:${name}`,
      ...(configDefines ? { _configDefineValues: { add: (d) => config.add(d) } } : {}),
    },
    SubShader,
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

test('the installer patches as LayaAir registers, in either order, and makes the define a default', () => {
  assert.equal(installLaya342SpecularAA({}), false);
  assert.equal(installLaya342SpecularAA(null), false);
  for (const order of [
    ['PBRLighting.glsl', 'PBRFrag.glsl'],
    ['PBRFrag.glsl', 'PBRLighting.glsl'],
  ]) {
    const { runtime, included, config, passes } = fakeRuntime();
    assert.deepEqual(zhudaSpecularAAStatus(runtime), {
      patched: false,
      defaultOn: false,
      reason: 'not installed',
      normalMapPasses: 0,
    });
    assert.equal(installLaya342SpecularAA(runtime), true);
    const wrapped = runtime.Shader3D.addInclude;
    assert.equal(installLaya342SpecularAA(runtime), true);
    assert.equal(runtime.Shader3D.addInclude, wrapped, 'installed once');
    assert.match(zhudaSpecularAAStatus(runtime).reason, /before Laya\.init/);
    runtime.Shader3D.addInclude('Other.glsl', pbrFrag);
    assert.equal(included['Other.glsl'], pbrFrag, 'other includes are untouched');
    runtime.Shader3D.addInclude(order[0], order[0] === 'PBRFrag.glsl' ? pbrFrag : pbrLighting);
    assert.equal(config.size, 0, 'not before both are seen');
    runtime.Shader3D.addInclude(order[1], order[1] === 'PBRFrag.glsl' ? pbrFrag : pbrLighting);
    assert.equal(included['PBRFrag.glsl'], zhudaPatchSpecularAA(pbrFrag).text);
    assert.equal(included['PBRLighting.glsl'], pbrLighting, 'read, not changed');
    assert.deepEqual([...config], [`define:${ZHUDA_SPECULAR_AA_DEFINE}`]);
    new runtime.SubShader().addShaderPass('vs', pbrForward);
    new runtime.SubShader().addShaderPass('vs', blinnForward);
    assert.equal(passes[0], zhudaPatchNormalLength(pbrForward));
    assert.equal(passes[1], blinnForward);
    assert.deepEqual(zhudaSpecularAAStatus(runtime), {
      patched: true,
      defaultOn: true,
      normalMapPasses: 1,
    });
    const scene = fakeScene();
    assert.equal(setZhudaSpecularAA(scene, true, runtime), true);
    assert.ok(scene.defines.has(`define:${ZHUDA_SPECULAR_AA_DEFINE}`));
    assert.equal(setZhudaSpecularAA(scene, false, runtime), false);
    assert.equal(scene.defines.size, 0);
  }
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
    const { runtime, config } = fakeRuntime();
    installLaya342SpecularAA(runtime);
    runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
    runtime.Shader3D.addInclude('PBRLighting.glsl', 'float other(){return 1.0;}');
    assert.equal(config.size, 0);
    assert.match(zhudaSpecularAAStatus(runtime).reason, /does not define specularAA/);
    assert.equal(setZhudaSpecularAA(fakeScene(), true, runtime), false);
  }
  {
    const { runtime } = fakeRuntime({ configDefines: false });
    installLaya342SpecularAA(runtime);
    runtime.Shader3D.addInclude('PBRFrag.glsl', pbrFrag);
    runtime.Shader3D.addInclude('PBRLighting.glsl', pbrLighting);
    const status = zhudaSpecularAAStatus(runtime);
    assert.equal(status.patched, true);
    assert.equal(status.defaultOn, false);
    assert.match(status.reason, /_configDefineValues is missing/);
  }
  assert.equal(warnings.length, 3, 'one warning for each runtime');
  assert.ok(warnings.every((w) => w.startsWith('[zhuda] specular anti-aliasing is off: ')));
  assert.throws(() => setZhudaSpecularAA({}, true), /pass a Laya Scene3D/);
  assert.throws(() => setZhudaSpecularAA(null, false), /pass a Laya Scene3D/);
});
