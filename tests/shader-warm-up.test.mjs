// The shader variant list and the warm-up that compiles it (record
// shader-warm-up). The real compiles and draws are checked by
// verify:shader-warm-up; these are the rules, on a LayaAir stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_SHADER_VARIANT_LIMIT,
  ZhudaShaderVariantRecorder,
  validateZhudaShaderVariantList,
  zhudaMergeShaderVariants,
  zhudaShaderBackend,
  zhudaShaderVariantKey,
  zhudaSortShaderVariants,
  zhudaWarmUpShaders,
} from '../packages/core/runtime3d/ShaderWarmUp.ts';
import {
  registerZhudaEffectShaders,
  zhudaShaderRegistrar,
} from '../packages/core/runtime3d/ShaderRegistry.ts';

const variant = (over = {}) => ({
  shader: 'PBR',
  subShader: 0,
  pass: 0,
  defines: ['FOG', 'DIRECTIONLIGHT'],
  nodeCommonMap: ['Sprite3D'],
  additionMap: ['ReflectionProbe'],
  attributeLocations: [3, 0, 2],
  is2D: false,
  preDrawMaps: ['Scene3D', 'Global'],
  ...over,
});
const list = (variants, backend = 'webgl') => ({ version: 1, backend, variants });

/**
 * A LayaAir 3.4.2 stand-in: shaders with passes that cache an instance for
 * each set of defines, a variant collection as LayaAir's, and the scene's
 * uniform sets of a frame.
 */
function fakeRuntime({ webgpu = false, shaders = ['PBR', 'Unlit'] } = {}) {
  const log = [];
  const preDraw = new Set(['Scene3D', 'Global']);
  class ShaderPass {
    constructor(owner) {
      this._owner = owner;
      this.moduleData = { cache: new Map() };
      this.nodeCommonMap = ['Before'];
      this.additionShaderData = ['BeforeAddition'];
      this.attributeLocations = new Set([9]);
    }
    static createShaderInstance(pass, is2D, defines) {
      log.push({
        shader: pass._owner._owner._name,
        defines: [...defines].sort().join(','),
        node: [...pass.nodeCommonMap],
        addition: [...pass.additionShaderData],
        attributes: [...pass.attributeLocations],
        preDraw: [...preDraw],
      });
      if (defines.has('BROKEN')) throw Error('does not compile');
      return { is2D };
    }
  }
  const registered = new Map();
  const add = (name) => {
    const shader = { _name: name, _subShaders: [] };
    const sub = { _owner: shader, _passes: [] };
    shader._subShaders.push(sub);
    sub._passes.push(new ShaderPass(sub), new ShaderPass(sub));
    shader.getSubShaderAt = (index) => shader._subShaders[index];
    registered.set(name, shader);
    return shader;
  };
  shaders.forEach(add);
  const Shader3D = {
    debugMode: false,
    add,
    find: (name) => registered.get(name),
    compileShaderByDefineNames(name, sub, passIndex, defines, node, addition, is2D, attributes) {
      const pass = registered.get(name)?.getSubShaderAt(sub)?._passes[passIndex];
      if (!pass) return false;
      pass.nodeCommonMap = node;
      pass.additionShaderData = addition;
      pass.attributeLocations = new Set(attributes);
      const key = [...defines].sort().join(',');
      if (!pass.moduleData.cache.has(key))
        pass.moduleData.cache.set(
          key,
          ShaderPass.createShaderInstance(pass, is2D, new Set(defines)),
        );
      return true;
    },
  };
  class ShaderVariantCollection {
    constructor() {
      this.items = {};
    }
    // As LayaAir's: the node's maps are kept sorted, and a repeat is not added.
    add(pass, defines, is2D) {
      const shader = pass._owner._owner;
      const entry = {
        is2D,
        subShaderIndex: shader._subShaders.indexOf(pass._owner),
        passIndex: pass._owner._passes.indexOf(pass),
        defines: defines.slice().sort(),
        nodeCommonMap: pass.nodeCommonMap.slice().sort(),
        additionMap: pass.additionShaderData.slice().sort(),
        attributeLocations: [...pass.attributeLocations],
      };
      const entries = (this.items[shader._name] ??= []);
      // LayaAir compares these fields and no others.
      const same = (e) =>
        ['is2D', 'subShaderIndex', 'passIndex', 'defines', 'nodeCommonMap', 'additionMap']
          .concat('attributeLocations')
          .every((field) => JSON.stringify(e[field]) === JSON.stringify(entry[field]));
      if (!entries.some(same)) entries.push(entry);
    }
  }
  ShaderVariantCollection.active = new ShaderVariantCollection();
  class WebGPURenderEngine {}
  const context = { _instance: { preDrawUniformMaps: preDraw } };
  const runtime = {
    Shader3D,
    ShaderPass,
    ShaderVariantCollection,
    LayaGL: { renderEngine: webgpu ? new WebGPURenderEngine() : {} },
    ...(webgpu
      ? { WebGPURenderEngine, WebGPURenderContext3D: context }
      : { WebGLRenderContext3D: context }),
  };
  /** What LayaAir does when a draw compiles a pass. */
  const draw = (name, passIndex, defines, node, addition, attributes) => {
    const pass = registered.get(name)._subShaders[0]._passes[passIndex];
    pass.nodeCommonMap = node;
    pass.additionShaderData = addition;
    pass.attributeLocations = new Set(attributes);
    if (Shader3D.debugMode) ShaderVariantCollection.active.add(pass, defines, false);
  };
  return { runtime, log, preDraw, registered, draw };
}
/** A clock that moves by `step` at every reading, and a wait that counts. */
const clock = (step) => {
  let t = 0;
  return () => (t += step);
};

test('a variant list is checked field by field', () => {
  assert.deepEqual(validateZhudaShaderVariantList(list([variant()])), []);
  assert.deepEqual(validateZhudaShaderVariantList(list([])), []);
  assert.deepEqual(validateZhudaShaderVariantList(null), ['a variant list is an object']);
  assert.deepEqual(validateZhudaShaderVariantList({ version: 2, backend: 'gl', variants: 1 }), [
    'version must be 1',
    "backend must be 'webgl' or 'webgpu'",
    'variants must be an array',
  ]);
  const bad = list([
    variant({ shader: '' }),
    variant({ subShader: -1, pass: 1.5 }),
    variant({ defines: ['A', 3], nodeCommonMap: 'Sprite3D', additionMap: [''] }),
    variant({ attributeLocations: [0, -2], is2D: 'no', preDrawMaps: [7] }),
    null,
  ]);
  assert.deepEqual(validateZhudaShaderVariantList(bad), [
    'variants[0].shader must be a shader name',
    'variants[1].subShader must be an index',
    'variants[1].pass must be an index',
    'variants[2].defines must be define names',
    'variants[2].nodeCommonMap must be uniform map names',
    'variants[2].additionMap must be uniform map names',
    'variants[3].attributeLocations must be attribute locations',
    'variants[3].is2D must be true or false',
    'variants[3].preDrawMaps must be uniform map names',
    'variants[4] must be an object',
  ]);
  const many = list(Array.from({ length: ZHUDA_SHADER_VARIANT_LIMIT + 1 }, () => variant()));
  assert.match(validateZhudaShaderVariantList(many)[0], /at most 4096 variants \(4097\)/);
  // A list without the scene's sets is a list (a 2D shader has none); the warm-up says what it skips.
  const { preDrawMaps: _, ...bare } = variant();
  assert.deepEqual(validateZhudaShaderVariantList(list([bare])), []);
});

test('the same variants give the same list whatever was drawn first', () => {
  const a = variant(),
    b = variant({ shader: 'Unlit', defines: [] }),
    c = variant({ pass: 1 }),
    d = variant({ defines: ['DIRECTIONLIGHT', 'FOG', 'FOG'], attributeLocations: [0, 2, 3, 3] });
  const one = zhudaSortShaderVariants([a, b, c]),
    other = zhudaSortShaderVariants([c, d, b, a, b]);
  assert.deepEqual(one, other, 'order and repeats do not matter; d is a again');
  assert.equal(one.length, 3);
  assert.deepEqual(one[0].defines, ['DIRECTIONLIGHT', 'FOG'], 'defines are sorted');
  assert.deepEqual(one[0].attributeLocations, [0, 2, 3]);
  assert.deepEqual(
    one.map(zhudaShaderVariantKey),
    [...one.map(zhudaShaderVariantKey)].sort(),
    'in the order of their keys',
  );
  // The input is not changed.
  assert.deepEqual(a.defines, ['FOG', 'DIRECTIONLIGHT']);
  // A node's uniform maps keep their order: it is part of what is compiled.
  const sky = variant({ shader: 'Sky', nodeCommonMap: ['Sprite3D', 'SkyRenderer'] }),
    turned = variant({ shader: 'Sky', nodeCommonMap: ['SkyRenderer', 'Sprite3D'] });
  const kept = zhudaSortShaderVariants([sky, turned]);
  assert.equal(kept.length, 2, 'two orders are two variants');
  assert.deepEqual(kept.map((v) => v.nodeCommonMap).sort(), [
    ['SkyRenderer', 'Sprite3D'],
    ['Sprite3D', 'SkyRenderer'],
  ]);
  // So are the scene's sets: with and without the shadow maps are two compiles.
  const shadowed = variant({ preDrawMaps: ['Shadow', 'Scene3D', 'Global'] });
  assert.notEqual(zhudaShaderVariantKey(shadowed), zhudaShaderVariantKey(a));
  assert.deepEqual(zhudaSortShaderVariants([shadowed])[0].preDrawMaps, [
    'Global',
    'Scene3D',
    'Shadow',
  ]);
});

test('lists of one backend merge into one; another backend is refused', () => {
  const town = list([variant(), variant({ pass: 1 })]),
    night = list([variant({ pass: 1 }), variant({ defines: ['POINTLIGHT'] })]);
  const merged = zhudaMergeShaderVariants(town, night);
  assert.equal(merged.variants.length, 3);
  assert.deepEqual(merged, zhudaMergeShaderVariants(night, town), 'in either order');
  assert.deepEqual(validateZhudaShaderVariantList(merged), []);
  assert.throws(() => zhudaMergeShaderVariants(), /at least one list/);
  assert.throws(
    () => zhudaMergeShaderVariants(town, list([], 'webgpu')),
    /a webgpu list among webgl/,
  );
});

test('the recorder lists what is compiled while it runs, with what LayaAir leaves out', () => {
  const { runtime, draw, preDraw } = fakeRuntime();
  const own = runtime.ShaderVariantCollection.active;
  assert.equal(zhudaShaderBackend(runtime), 'webgl');
  draw('PBR', 0, ['EARLY'], ['Sprite3D'], [], [0]);
  const recorder = new ZhudaShaderVariantRecorder(runtime);
  assert.equal(runtime.Shader3D.debugMode, true);
  assert.notEqual(runtime.ShaderVariantCollection.active, own, 'a collection of its own');
  assert.throws(() => new ZhudaShaderVariantRecorder(runtime), /one recorder at a time/);
  draw('Unlit', 1, ['B', 'A'], ['Sprite3D', 'SkyRenderer'], ['Probe', 'Extra'], [2, 0]);
  preDraw.add('Shadow');
  draw('PBR', 0, ['SHADOW'], ['Sprite3D'], ['ReflectionProbe'], [0, 3]);
  draw('PBR', 0, ['SHADOW'], ['Sprite3D'], ['ReflectionProbe'], [0, 3]);
  assert.equal(recorder.count, 2, 'a repeat is listed once; what came before the recorder is not');
  const recorded = recorder.list();
  assert.equal(recorded.backend, 'webgl');
  assert.deepEqual(validateZhudaShaderVariantList(recorded), []);
  assert.deepEqual(recorded.variants, [
    {
      shader: 'PBR',
      subShader: 0,
      pass: 0,
      defines: ['SHADOW'],
      nodeCommonMap: ['Sprite3D'],
      additionMap: ['ReflectionProbe'],
      attributeLocations: [0, 3],
      is2D: false,
      preDrawMaps: ['Global', 'Scene3D', 'Shadow'],
    },
    {
      shader: 'Unlit',
      subShader: 0,
      pass: 1,
      defines: ['A', 'B'],
      // The node's own order, not LayaAir's sorted copy.
      nodeCommonMap: ['Sprite3D', 'SkyRenderer'],
      additionMap: ['Probe', 'Extra'],
      attributeLocations: [0, 2],
      is2D: false,
      preDrawMaps: ['Global', 'Scene3D'],
    },
  ]);
  recorder.stop();
  recorder.stop();
  assert.equal(runtime.Shader3D.debugMode, false, 'the debug switch is as it was');
  assert.equal(runtime.ShaderVariantCollection.active, own, "LayaAir's own collection is back");
  assert.equal(recorder.list().variants.length, 2, 'the list stays readable');
  const again = new ZhudaShaderVariantRecorder(runtime);
  again.stop();
  assert.throws(() => new ZhudaShaderVariantRecorder({}), /LayaAir is not loaded/);
  assert.equal(zhudaShaderBackend(fakeRuntime({ webgpu: true }).runtime), 'webgpu');
});

test('the warm-up compiles each variant as it was drawn, and leaves LayaAir as it found it', async () => {
  for (const webgpu of [false, true]) {
    const { runtime, log, preDraw, registered } = fakeRuntime({ webgpu });
    const backend = webgpu ? 'webgpu' : 'webgl';
    const variants = [
      variant({ defines: ['SHADOW'], preDrawMaps: ['Global', 'Scene3D', 'Shadow'] }),
      variant({ shader: 'Unlit', pass: 1, nodeCommonMap: ['Sprite3D', 'SkyRenderer'] }),
    ];
    const report = await zhudaWarmUpShaders(list(variants, backend), {}, runtime);
    assert.deepEqual(
      { ...report, ms: 0, longestMs: 0 },
      {
        total: 2,
        compiled: 2,
        cached: 0,
        missing: [],
        failed: [],
        ms: 0,
        longestMs: 0,
        slices: 1,
      },
    );
    assert.deepEqual(log, [
      {
        shader: 'PBR',
        defines: 'SHADOW',
        node: ['Sprite3D'],
        addition: ['ReflectionProbe'],
        attributes: [0, 2, 3],
        // The scene's sets as they were when the variant was drawn.
        preDraw: ['Global', 'Scene3D', 'Shadow'],
      },
      {
        shader: 'Unlit',
        defines: 'DIRECTIONLIGHT,FOG',
        node: ['Sprite3D', 'SkyRenderer'],
        addition: ['ReflectionProbe'],
        attributes: [0, 2, 3],
        preDraw: ['Global', 'Scene3D'],
      },
    ]);
    // Afterwards: the scene's sets and each pass are as before.
    assert.deepEqual([...preDraw], ['Scene3D', 'Global']);
    const pass = registered.get('PBR')._subShaders[0]._passes[0];
    assert.deepEqual(pass.nodeCommonMap, ['Before']);
    assert.deepEqual(pass.additionShaderData, ['BeforeAddition']);
    assert.deepEqual([...pass.attributeLocations], [9]);
    // Asked again, nothing is compiled.
    const again = await zhudaWarmUpShaders(list(variants, backend), {}, runtime);
    assert.deepEqual([again.compiled, again.cached], [0, 2]);
    assert.equal(log.length, 2);
  }
});

test('a warm-up is spread over frames by its budget and can be cancelled', async () => {
  const { runtime } = fakeRuntime();
  const variants = Array.from({ length: 10 }, (_, i) => variant({ defines: [`D${i}`] }));
  // Every reading of the clock is 1 ms later: a compile is 2 readings.
  let waits = 0;
  const progress = [];
  const report = await zhudaWarmUpShaders(
    list(variants),
    {
      budgetMs: 6,
      now: clock(1),
      wait: async () => void waits++,
      onProgress: (done, total) => progress.push([done, total]),
    },
    runtime,
  );
  assert.equal(report.compiled, 10);
  assert.ok(report.slices > 1, `more than one slice (${report.slices})`);
  assert.equal(waits, report.slices - 1, 'a wait between slices, none after the last');
  assert.deepEqual(progress.at(-1), [10, 10]);
  assert.equal(progress.length, report.slices);
  assert.equal(report.longestMs, 1, 'the longest single compile');
  // The counter of real compiles is in place only while a slice runs.
  const create = runtime.ShaderPass.createShaderInstance;
  let seen;
  await zhudaWarmUpShaders(
    list([variant({ defines: ['X1'] }), variant({ defines: ['X2'] })]),
    {
      budgetMs: 1,
      now: clock(1),
      wait: async () => {
        seen = runtime.ShaderPass.createShaderInstance;
      },
    },
    runtime,
  );
  assert.equal(seen, create, 'between slices LayaAir has its own function');
  assert.equal(runtime.ShaderPass.createShaderInstance, create);

  // Cancelled before it starts, and between two slices.
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    zhudaWarmUpShaders(list(variants), { signal: before.signal }, fakeRuntime().runtime),
    { name: 'AbortError' },
  );
  const during = new AbortController();
  const fresh = fakeRuntime();
  const freshCreate = fresh.runtime.ShaderPass.createShaderInstance;
  await assert.rejects(
    zhudaWarmUpShaders(
      list(variants),
      { budgetMs: 1, now: clock(1), signal: during.signal, wait: async () => during.abort() },
      fresh.runtime,
    ),
    { name: 'AbortError' },
  );
  assert.equal(fresh.log.length, 1, 'one slice ran, then it stopped');
  assert.equal(
    fresh.runtime.ShaderPass.createShaderInstance,
    freshCreate,
    'a cancelled warm-up leaves LayaAir its own function',
  );
  for (const budgetMs of [0, 1001, NaN, '8'])
    await assert.rejects(
      zhudaWarmUpShaders(list([]), { budgetMs }, runtime),
      /budgetMs must be 1\.\.1000/,
    );
});

test('what a warm-up cannot use is refused or reported, and never throws', async () => {
  const { runtime, log } = fakeRuntime();
  const refused = async (value, options, on = runtime) =>
    (await zhudaWarmUpShaders(value, options, on)).refused;
  assert.match(await refused({ version: 2 }), /not a variant list: version must be 1/);
  assert.match(await refused(null), /not a variant list/);
  assert.match(await refused(list([variant()], 'webgpu')), /recorded on webgpu, this is webgl/);
  assert.match(await refused(list([variant()]), {}, {}), /LayaAir is not loaded/);
  assert.equal(log.length, 0, 'nothing was compiled');

  // A shader that is not registered, a compile that throws, a 3D variant without the scene's sets.
  const { preDrawMaps: _, ...bare } = variant({ defines: ['BARE'] });
  const report = await zhudaWarmUpShaders(
    list([
      variant({ shader: 'NoSuchShader' }),
      variant({ pass: 7 }),
      variant({ defines: ['BROKEN'] }),
      bare,
      { ...bare, is2D: true },
      variant(),
    ]),
    {},
    runtime,
  );
  assert.equal(report.refused, undefined);
  assert.deepEqual([report.total, report.compiled, report.cached], [6, 2, 0]);
  assert.equal(report.missing.length, 2);
  assert.ok(report.missing[0].startsWith('NoSuchShader/0/0/'));
  assert.equal(report.failed.length, 2);
  assert.ok(report.failed.some((line) => /BROKEN.*: does not compile/.test(line)));
  assert.ok(
    report.failed.some((line) => /BARE.*recorded without the scene's uniform sets/.test(line)),
  );
  // The one that threw is not in LayaAir's cache: a later draw compiles it itself.
  const again = await zhudaWarmUpShaders(list([variant({ defines: ['BROKEN'] })]), {}, runtime);
  assert.equal(again.failed.length, 1);
});

test('an effect of the engine that nothing has made is registered when its name is met', async () => {
  const { runtime, registered } = fakeRuntime();
  let calls = 0;
  zhudaShaderRegistrar((l) => {
    calls++;
    if (!l.Shader3D.find('TestEffectOfTheEngine')) l.Shader3D.add('TestEffectOfTheEngine');
  });
  zhudaShaderRegistrar(() => {
    throw Error('a module this runtime was built without');
  });
  const effect = variant({ shader: 'TestEffectOfTheEngine', nodeCommonMap: [], additionMap: [] });
  // Nothing is registered while every name is known.
  await zhudaWarmUpShaders(list([variant()]), {}, runtime);
  assert.equal(calls, 0);
  const report = await zhudaWarmUpShaders(
    list([effect, variant({ shader: 'StillUnknown' }), variant({ shader: 'AlsoUnknown' })]),
    {},
    runtime,
  );
  assert.equal(calls, 1, 'once for the whole warm-up');
  assert.ok(registered.has('TestEffectOfTheEngine'));
  assert.equal(report.compiled, 1);
  assert.equal(report.missing.length, 2);
  // Asked for directly: every registration that does not throw counts.
  assert.ok(registerZhudaEffectShaders(runtime) >= 1);
  assert.equal(registerZhudaEffectShaders({}), 0);
  assert.equal(registerZhudaEffectShaders(null), 0);
});
