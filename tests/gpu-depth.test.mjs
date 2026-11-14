import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZHUDA_COMPUTE_COUNT,
  ZhudaComputePass,
  ZhudaComputedInstances,
  validateZhudaComputeSpec,
  zhudaComputeSource,
  zhudaComputeSupported,
} from '../packages/core/runtime3d/ComputePass.ts';
import {
  ZHUDA_COMMON_GLSL,
  ZHUDA_FBM_OCTAVES,
  registerZhudaCommon,
  zhudaFbm2D,
  zhudaHash2D,
  zhudaNoise2D,
  zhudaTriplanarWeights,
} from '../packages/core/shaders/ZhudaCommon.ts';
import { validateShaderSpec } from '../packages/core/shaders/ShaderMaterials.ts';
import { ZhudaLitSurfaceMaterial } from '../packages/core/shaders/LitSurfaceMaterial.ts';
import {
  installLaya342SurfaceBuffer,
  zhudaSurfaceBufferInstalled,
  zhudaSurfaceBufferSupported,
} from '../packages/core/runtime3d/SurfaceBuffer.ts';
import {
  ZHUDA_OBJECT_MOTION_DEFINE,
  ZHUDA_OBJECT_MOTION_UNIFORM,
  ZhudaObjectMotion,
  installLaya342ObjectMotion,
  zhudaMotionMatrix,
  zhudaObjectMotionInstalled,
} from '../packages/core/runtime3d/ObjectMotion.ts';
import {
  resolveZhudaScreenReflections,
  validateZhudaScreenReflections,
} from '../packages/core/runtime3d/ScreenReflections.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

/** The text LayaAir 3.4.2 registers for an include, read from a vendored library. */
function vendoredInclude(name, library = 'laya.d3.js') {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../vendor/laya-3.4.2/libs', library),
    'utf8',
  );
  const start = source.indexOf(`addInclude("${name}",`);
  assert.ok(start > 0, `${name} is registered by ${library}`);
  const at = start + `addInclude("${name}",`.length;
  const quote = source[at];
  assert.ok(quote === '"' || quote === "'", 'a string follows');
  let end = at + 1;
  while (source[end] !== quote) end += source[end] === '\\' ? 2 : 1;
  return Function(`return ${source.slice(at, end + 1)}`)();
}

// --- A compute pass ---------------------------------------------------------------
const particles = (extra = {}) => ({
  name: 'ZhudaTestFall',
  code: 'void zhudaStep(uint index){zhudaPlaces[index].y-=u_ZhudaDrop*float(u_ZhudaTimes);}',
  buffers: {
    zhudaPlaces: { type: 'vec4', length: 4 },
    zhudaSeeds: { type: 'float', length: 4, access: 'read' },
  },
  uniforms: { u_ZhudaDrop: { type: 'float', value: 0.5 }, u_ZhudaTimes: { type: 'int', value: 2 } },
  ...extra,
});

test('a compute spec is checked, and becomes the shader the engine wraps round it', () => {
  assert.deepEqual(validateZhudaComputeSpec(particles()), []);
  const bad = (change, wanted) => {
    const issues = validateZhudaComputeSpec({ ...particles(), ...change });
    assert.ok(
      issues.some((issue) => wanted.test(issue)),
      JSON.stringify(issues),
    );
  };
  bad({ name: 'Fall' }, /name: start with Zhuda/);
  bad({ code: 'void step(uint i){}' }, /zhudaStep/);
  // The frame round the step is the engine's: a spec cannot bring its own.
  for (const own of [
    'void main(){}',
    'layout(local_size_x=1)in;',
    'uniform float x;',
    'buffer B{float b[];};',
    '#include "Scene.glsl"',
  ])
    bad({ code: 'void zhudaStep(uint index){}\n' + own }, /belong to the engine/);
  // A word inside a comment is not a declaration.
  assert.deepEqual(
    validateZhudaComputeSpec(
      particles({ code: '// one buffer, one main\nvoid zhudaStep(uint index){}' }),
    ),
    [],
  );
  bad({ buffers: {} }, /buffers: one to eight/);
  bad({ buffers: { places: { type: 'vec4', length: 1 } } }, /name it zhuda and a capital/);
  bad({ buffers: { zhudaA: { type: 'mat4', length: 1 } } }, /float, vec4 or uint/);
  bad({ buffers: { zhudaA: { type: 'float', length: 0 } } }, /length/);
  bad({ buffers: { zhudaA: { type: 'float', length: 4, access: 'write' } } }, /access/);
  bad({ buffers: { zhudaA: { type: 'float', length: 4, vertex: true } } }, /vertex data is vec4/);
  bad({ uniforms: { u_Drop: { type: 'float' } } }, /name it u_Zhuda/);
  bad({ uniforms: { [ZHUDA_COMPUTE_COUNT]: { type: 'int' } } }, /the engine's/);
  bad({ uniforms: { u_ZhudaA: { type: 'vec3' } } }, /float, vec4 or int/);
  bad({ uniforms: { u_ZhudaA: { type: 'int', value: 1.5 } } }, /value: a int/);
  bad({ uniforms: { u_ZhudaA: { type: 'vec4', value: [1, 2, 3] } } }, /value: a vec4/);
  bad({ step: 'fall' }, /step: use a function/);

  const source = zhudaComputeSource(particles());
  assert.equal(
    source,
    'layout(local_size_x=64,local_size_y=1,local_size_z=1)in;\n' +
      'buffer ZhudaPlaces{vec4 zhudaPlaces[];};\n' +
      'readonly buffer ZhudaSeeds{float zhudaSeeds[];};\n' +
      'void zhudaStep(uint index){zhudaPlaces[index].y-=u_ZhudaDrop*float(u_ZhudaTimes);}\n' +
      'void main(){uint index=gl_GlobalInvocationID.x;if(index>=uint(u_ZhudaCount)){return;}zhudaStep(index);}',
  );
  assert.throws(() => zhudaComputeSource({ ...particles(), name: 'x' }), /Invalid compute pass/);
});

/** LayaAir without compute: what a WebGL realm has. */
function plainLaya() {
  const uploads = [];
  return {
    uploads,
    BufferUsage: { Dynamic: 'dynamic' },
    Laya3DRender: {
      renderOBJCreate: {
        createVertexBuffer3D: (bytes, usage) => ({
          bytes,
          usage,
          destroyed: false,
          setData(buffer, offset, start, length) {
            uploads.push(new Float32Array(buffer.slice(start, start + length)));
          },
          destroy() {
            this.destroyed = true;
          },
        }),
      },
    },
  };
}
/** Runs with `l` as the page's LayaAir, until what `run` returns has settled. */
async function withLaya(l, run) {
  const before = globalThis.Laya;
  globalThis.Laya = l;
  try {
    return await run(l);
  } finally {
    globalThis.Laya = before;
  }
}
const fall = (index, buffers, uniforms) => {
  buffers.zhudaPlaces[index * 4 + 1] -= uniforms.u_ZhudaDrop * uniforms.u_ZhudaTimes;
};

test('without compute a pass runs its JavaScript step, or says it cannot run', async () => {
  await withLaya(plainLaya(), async (l) => {
    assert.equal(zhudaComputeSupported(l), false);
    assert.throws(
      () => new ZhudaComputePass(particles()),
      (error) => error.code === 'COMPUTE_UNAVAILABLE' && /no compute shaders/.test(error.message),
    );
    const seen = [];
    const pass = new ZhudaComputePass(
      particles({
        step: (index, buffers, uniforms) => {
          seen.push(uniforms[ZHUDA_COMPUTE_COUNT]);
          fall(index, buffers, uniforms);
        },
      }),
    );
    assert.equal(pass.backend, 'cpu');
    pass.write(
      'zhudaPlaces',
      new Float32Array([0, 10, 0, 1, 0, 20, 0, 1, 0, 30, 0, 1, 0, 40, 0, 1]),
    );
    // From an element on, and from a view into a larger array.
    pass.write('zhudaPlaces', new Float32Array([9, 9, 0, 50, 0, 1]).subarray(2), 3);
    pass.dispatch(3);
    assert.deepEqual(seen, [3, 3, 3], 'the step is told how many indices there are');
    assert.deepEqual(
      Array.from(await pass.read('zhudaPlaces')).filter((_, i) => i % 4 === 1),
      [9, 19, 29, 50],
      'three fell by 0.5 twice; the fourth was not stepped',
    );
    pass.setUniform('u_ZhudaDrop', 2);
    pass.setUniform('u_ZhudaTimes', 3);
    pass.dispatch(1);
    const places = await pass.read('zhudaPlaces');
    assert.equal(places[1], 3);
    // What is read is a copy.
    places[1] = 99;
    assert.equal((await pass.read('zhudaPlaces'))[1], 3);
    // Values, names and sizes are checked.
    assert.throws(() => pass.setUniform('u_ZhudaTimes', 1.5), /is a int/);
    assert.throws(() => pass.setUniform('u_ZhudaWind', 1), /is unknown/);
    assert.throws(() => pass.write('zhudaPlaces', new Float32Array(5)), /whole elements that fits/);
    assert.throws(() => pass.write('zhudaPlaces', new Float32Array(4), 4), /fits/);
    assert.throws(() => pass.write('zhudaSeeds', new Uint32Array(4)), /Float32Array/);
    assert.throws(() => pass.write('zhudaNone', new Float32Array(4)), /no buffer zhudaNone/);
    assert.throws(() => pass.dispatch(0), /dispatch a whole number/);
    assert.throws(() => pass.vertexBuffer('zhudaPlaces'), /not declared with vertex: true/);
    pass.dispose();
    pass.dispose();
    assert.throws(() => pass.dispatch(1), /Disposed compute pass/);

    // A buffer that is also vertex data is handed to the GPU after each dispatch.
    const drawn = new ZhudaComputePass(
      particles({
        name: 'ZhudaTestDrawn',
        buffers: { zhudaPlaces: { type: 'vec4', length: 5, vertex: true } },
        uniforms: {},
        step: (index, buffers) => {
          buffers.zhudaPlaces[index * 4] += 1;
        },
      }),
    );
    const vertex = drawn.vertexBuffer('zhudaPlaces');
    assert.deepEqual([vertex.bytes, vertex.usage], [80, 'dynamic']);
    drawn.dispatch(2);
    assert.deepEqual(Array.from(l.uploads.at(-1)).slice(0, 8), [1, 0, 0, 0, 1, 0, 0, 0]);
    drawn.dispose();
    assert.equal(vertex.destroyed, true);
  });
});

/** LayaAir with compute: every call a pass makes is kept. */
function computeLaya() {
  const log = [];
  let ids = 0;
  const names = new Map();
  class ShaderData {
    values = new Map();
    setInt(id, v) {
      this.values.set(id, v);
    }
    setNumber(id, v) {
      this.values.set(id, v);
    }
    setVector(id, v) {
      this.values.set(id, v);
    }
    setDeviceBuffer(id, v) {
      this.values.set(id, v);
    }
    destroy() {
      log.push(['destroy', 'data']);
    }
  }
  const deviceBuffer = (usage) => ({
    usage,
    bytes: 0,
    data: new Float32Array(0),
    _destroyed: false,
    setDataLength(bytes) {
      this.bytes = bytes;
      this.data = new Float32Array(bytes / 4);
    },
    setData(array, offset, start, bytes) {
      this.data.set(new Float32Array(array.buffer, array.byteOffset, bytes / 4), offset / 4);
    },
    copyToBuffer(target, from, to, bytes) {
      target.data.set(this.data.subarray(from / 4, (from + bytes) / 4), to / 4);
    },
    async readData(out, at, from, bytes) {
      new Float32Array(out).set(this.data.subarray(from / 4, (from + bytes) / 4), at / 4);
    },
    destroy() {
      assert.equal(this._destroyed, false, 'a buffer is destroyed once');
      this._destroyed = true;
      log.push(['destroy', 'buffer', usage]);
    },
  });
  const l = {
    log,
    ShaderDataType: {
      Float: 'f',
      Vector4: 'v4',
      Int: 'i',
      DeviceBuffer: 'rw',
      ReadOnlyDeviceBuffer: 'r',
    },
    EDeviceBufferUsage: { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, STORAGE: 16, VERTEX: 64 },
    Shader3D: {
      propertyNameToID: (name) => names.get(name) ?? names.set(name, ++ids).get(name),
    },
    Vector3: class {
      constructor(x, y, z) {
        Object.assign(this, { x, y, z });
      }
    },
    Vector4: class {
      constructor(x, y, z, w) {
        Object.assign(this, { x, y, z, w });
      }
    },
    ComputeShader: {
      createComputeShader: (name, code, maps) => {
        log.push(['shader', name]);
        return { name, code, maps };
      },
    },
    ComputeCommandBuffer: class {
      commands = [];
      addDispatchCommand(shader, defines, data, groups) {
        this.commands.push({ shader, data, groups });
      }
      executeCMDs() {
        for (const command of this.commands)
          log.push(['dispatch', command.shader.name, command.groups.x, command.data.length]);
      }
      clearCMDs() {
        this.commands = [];
      }
      destroy() {
        log.push(['destroy', 'commands']);
      }
    },
    // The pair LayaAir makes for a buffer that is also vertex data.
    DeviceBuffer: class {
      constructor(bytes, usage) {
        this.deviceBuffer = deviceBuffer(usage);
        this.deviceBuffer.setDataLength(bytes);
        const storage = this.deviceBuffer;
        this.vertexBuffer = { destroy: () => storage.destroy() };
      }
    },
    LayaGL: {
      renderEngine: { getDevice: () => ({}) },
      unitRenderModuleDataFactory: { createDefineDatas: () => ({}) },
      renderDeviceFactory: {
        createGlobalUniformMap: (name) => ({
          name,
          entries: [],
          addShaderUniform(id, uniform, type) {
            this.entries.push([uniform, type]);
          },
        }),
        createShaderData: () => new ShaderData(),
        createDeviceBuffer: (usage) => deviceBuffer(usage),
      },
    },
  };
  return l;
}

test('with compute a pass is one shader a name, a dispatch in groups of 64, and buffers of its own', async () => {
  await withLaya(computeLaya(), async (l) => {
    assert.equal(zhudaComputeSupported(l), true);
    const spec = particles({
      name: 'ZhudaTestGpu',
      buffers: {
        zhudaPlaces: { type: 'vec4', length: 200, vertex: true },
        zhudaSeeds: { type: 'float', length: 200, access: 'read' },
      },
    });
    const pass = new ZhudaComputePass(spec);
    assert.equal(pass.backend, 'webgpu');
    const shader = l.log.find(([what]) => what === 'shader');
    assert.deepEqual(shader, ['shader', 'ZhudaTestGpu']);
    pass.write('zhudaSeeds', new Float32Array(200).fill(7));
    pass.dispatch(130);
    // 130 indices are three groups of 64; the uniforms and the buffers travel apart.
    assert.deepEqual(l.log.at(-1), ['dispatch', 'ZhudaTestGpu', 3, 2]);
    assert.equal((await pass.read('zhudaSeeds'))[199], 7);
    // The buffer a draw reads is the one the step writes.
    assert.ok(pass.vertexBuffer('zhudaPlaces'));
    assert.throws(() => pass.vertexBuffer('zhudaSeeds'), /vertex: true/);
    // A second pass of the name shares the shader; other code under the name is refused.
    const twin = new ZhudaComputePass(spec);
    assert.equal(l.log.filter(([what]) => what === 'shader').length, 1);
    assert.throws(
      () => new ZhudaComputePass({ ...spec, code: 'void zhudaStep(uint index){}' }),
      /another pass named ZhudaTestGpu/,
    );
    twin.dispose();
    const before = l.log.length;
    pass.dispose();
    const destroyed = l.log.slice(before).filter(([what]) => what === 'destroy');
    // Two buffers (each once, the pair through its vertex buffer), the commands, two shader datas.
    assert.equal(destroyed.filter(([, kind]) => kind === 'buffer').length, 2);
    assert.equal(destroyed.filter(([, kind]) => kind === 'commands').length, 1);
    assert.equal(destroyed.filter(([, kind]) => kind === 'data').length, 2);
  });
});

test('copies drawn from a pass are checked before anything is made', () =>
  withLaya(
    {
      ...plainLaya(),
      MeshInstanceGeometry: class {},
      BufferState: class {},
      VertexMesh: { instanceWorldMatrixDeclaration: {} },
    },
    () => {
      const pass = new ZhudaComputePass(
        particles({
          name: 'ZhudaTestCopies',
          buffers: {
            zhudaPlaces: { type: 'vec4', length: 50, vertex: true },
            zhudaSeeds: { type: 'float', length: 10 },
          },
          step: fall,
        }),
      );
      const parent = { addChild() {} },
        mesh = { _bufferState: { _vertexBuffers: [] }, subMeshCount: 1 },
        material = {};
      const box = { bounds: { min: [0, 0, 0], max: [1, 1, 1] } };
      const make =
        (...args) =>
        () =>
          new ZhudaComputedInstances(...args);
      assert.throws(make({}, mesh, material, pass, 'zhudaPlaces', 10, box), /a parent node/);
      assert.throws(make(parent, {}, material, pass, 'zhudaPlaces', 10, box), /live LayaAir mesh/);
      assert.throws(make(parent, mesh, material, pass, 'zhudaSeeds', 10, box), /vertex: true/);
      // Five vec4 a copy: fifty hold ten.
      assert.throws(make(parent, mesh, material, pass, 'zhudaPlaces', 11, box), /must fit/);
      assert.throws(make(parent, mesh, material, pass, 'zhudaPlaces', 10, {}), /bounds are/);
      assert.throws(
        make(parent, mesh, material, pass, 'zhudaPlaces', 10, {
          bounds: { min: [1, 0, 0], max: [0, 1, 1] },
        }),
        /bounds are/,
      );
      assert.throws(make(parent, mesh, [], pass, 'zhudaPlaces', 10, box), /one live material/);
      pass.dispose();
    },
  ));

// --- Uniform types and the common functions -------------------------------------------
const surface = (uniforms, extra = {}) => ({
  schemaVersion: 1,
  name: 'ZhudaTestSurface',
  dimension: 3,
  surface: 'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){return vec4(1.0);}',
  uniforms,
  ...extra,
});

test('a shader takes an integer, a matrix, a cube map and arrays, each checked', () => {
  assert.deepEqual(
    validateShaderSpec(
      surface({
        u_ZhudaMode: { type: 'int', value: 3 },
        u_ZhudaTint: { type: 'mat4', value: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
        u_ZhudaSky: { type: 'textureCube' },
        u_ZhudaStops: { type: 'vec4', length: 2, value: [1, 0, 0, 1, 0, 1, 0, 1] },
        u_ZhudaLevels: { type: 'float', length: 64 },
        u_ZhudaOld: { type: 'vec3', value: [1, 2, 3] },
      }),
    ),
    [],
  );
  const bad = (uniform, wanted) =>
    assert.match(validateShaderSpec(surface({ u_ZhudaX: uniform })).join('; '), wanted);
  bad({ type: 'int', value: 1.5 }, /Invalid uniform value/);
  bad({ type: 'mat4', value: [1, 0, 0, 0] }, /Invalid uniform value/);
  bad({ type: 'bool' }, /Invalid uniform type/);
  bad({ type: 'textureCube', value: 1 }, /external texture bindings/);
  bad({ type: 'vec4', length: 2, value: [1, 0, 0, 1] }, /Invalid uniform value/);
  bad({ type: 'float', length: 1 }, /2\.\.64/);
  bad({ type: 'float', length: 65 }, /2\.\.64/);
  bad({ type: 'int', length: 4 }, /Only float and vector uniforms can be arrays/);
  bad({ type: 'mat4', length: 2 }, /Only float and vector/);
  assert.match(validateShaderSpec(surface({}, { common: 'yes' })).join(), /common must be boolean/);
  // The lit surface keeps to what it handles.
  assert.throws(
    () =>
      new ZhudaLitSurfaceMaterial({
        name: 'ZhudaTestLit',
        surface: 'void zhudaSurface(){}',
        uniforms: { u_ZhudaMode: { type: 'int' } },
      }),
    /lit surface's uniforms are float, vec2, vec3, vec4 or texture2D: u_ZhudaMode/,
  );
});

test('the common functions: a hash that is even, noise that is smooth, weights that sum to one', () => {
  // Even over many cells, the same every time, and not the same as its neighbour.
  let sum = 0,
    low = 1,
    high = 0,
    repeats = 0;
  const bins = new Array(10).fill(0);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 100; x++) {
      const h = zhudaHash2D(x, y);
      assert.ok(h >= 0 && h < 1, `hash(${x}, ${y}) = ${h}`);
      sum += h;
      low = Math.min(low, h);
      high = Math.max(high, h);
      bins[Math.floor(h * 10)]++;
      if (Math.abs(h - zhudaHash2D(x + 1, y)) < 1e-4) repeats++;
    }
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02, `mean ${sum / 10000}`);
  assert.ok(low < 0.01 && high > 0.99);
  assert.ok(
    bins.every((n) => n > 850 && n < 1150),
    JSON.stringify(bins),
  );
  assert.ok(repeats < 30, `${repeats} of 10000 neighbours alike`);
  assert.equal(zhudaHash2D(12, 34), zhudaHash2D(12, 34));
  // Noise is the hash at a cell's corner and smooth between corners.
  assert.equal(zhudaNoise2D(7, 3), zhudaHash2D(7, 3));
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.013,
      y = i * 0.007;
    const n = zhudaNoise2D(x, y);
    assert.ok(n >= 0 && n <= 1);
    worst = Math.max(worst, Math.abs(zhudaNoise2D(x + 0.001, y) - n));
  }
  assert.ok(worst < 0.003, `noise moves ${worst} in a thousandth of a cell`);
  // Five octaves, each half as strong: never above 31/32.
  for (let i = 0; i < 500; i++) {
    const f = zhudaFbm2D(i * 0.37, i * 0.11);
    assert.ok(f >= 0 && f <= 31 / 32, String(f));
  }
  assert.equal(ZHUDA_FBM_OCTAVES, 5);
  // Triplanar weights.
  assert.deepEqual(zhudaTriplanarWeights([0, 1, 0]), [0, 1, 0]);
  const tilted = zhudaTriplanarWeights([1, 2, 3].map((v) => v / Math.sqrt(14)));
  assert.ok(Math.abs(tilted[0] + tilted[1] + tilted[2] - 1) < 1e-12);
  assert.ok(tilted[2] > tilted[1] && tilted[1] > tilted[0]);
  assert.deepEqual(
    zhudaTriplanarWeights([-1, 1, 0].map((v) => v / Math.SQRT2)).map((v) => +v.toFixed(6)),
    [0.5, 0.5, 0],
  );

  // The include: guarded, no sine, nothing a game's shader may not hold.
  assert.match(ZHUDA_COMMON_GLSL, /^#if !defined\(ZhudaCommon_lib\)\n#define ZhudaCommon_lib\n/);
  for (const name of [
    'zhudaHash(vec2',
    'zhudaHash(vec3',
    'zhudaNoise(vec2',
    'zhudaNoise(vec3',
    'zhudaFbm(vec2',
    'zhudaFbm(vec3',
    'zhudaTriplanarWeights(vec3',
    '#define zhudaTriplanar(',
  ])
    assert.ok(ZHUDA_COMMON_GLSL.includes(name), name);
  assert.doesNotMatch(ZHUDA_COMMON_GLSL, /\bsin\s*\(|#include|\buniform\b/);
  // Registered once a runtime.
  const added = [];
  const runtime = { Shader3D: { addInclude: (name, text) => added.push([name, text.length]) } };
  registerZhudaCommon(runtime);
  registerZhudaCommon(runtime);
  assert.deepEqual(added, [['ZhudaCommon.glsl', ZHUDA_COMMON_GLSL.length]]);
  assert.throws(() => registerZhudaCommon({}), /needs LayaAir/);
});

// --- The surface pictures and the velocity picture --------------------------------------
/** A runtime that keeps the includes it is given. */
function includeRuntime() {
  const includes = new Map();
  const uniforms = [];
  const ids = new Map();
  return {
    includes,
    uniforms,
    ShaderDataType: { Matrix4x4: 'm4' },
    LayaGL: {
      renderDeviceFactory: {
        createGlobalUniformMap: (name) => ({
          addShaderUniform: (id, uniform, type) => uniforms.push([name, uniform, type]),
        }),
      },
    },
    Shader3D: {
      addInclude(name, text) {
        includes.set(name, text);
      },
      propertyNameToID: (name) => ids.get(name) ?? ids.set(name, ids.size + 1).get(name),
    },
  };
}

test('the glTF shader is taught to write the surface pictures as the standard material does', () => {
  const text = vendoredInclude('glTFMetallicRoughness.glsl', 'laya.gltf.js');
  assert.ok(!text.includes('writeGBuffer'), 'as shipped, glTF materials write none');
  const l = includeRuntime();
  assert.equal(installLaya342SurfaceBuffer({}), false);
  assert.equal(installLaya342SurfaceBuffer(l), true);
  assert.equal(installLaya342SurfaceBuffer(l), true, 'installing again changes nothing');
  assert.equal(zhudaSurfaceBufferInstalled(l), false, 'nothing registered yet');
  l.Shader3D.addInclude('Math.glsl', 'float one(){return 1.0;}');
  l.Shader3D.addInclude('glTFMetallicRoughness.glsl', text);
  assert.equal(zhudaSurfaceBufferInstalled(l), true);
  assert.equal(l.includes.get('Math.glsl'), 'float one(){return 1.0;}');
  const patched = l.includes.get('glTFMetallicRoughness.glsl');
  // The same default as LayaAir's own PBR include, and the same call.
  const standard = vendoredInclude('PBRMetallicFrag.glsl');
  const block =
    '#ifdef LAYA_MRT\n#if !defined(GBUFFER_OUTPUTS_CONFIGURED)\n#define GBUFFER_NORMAL\n#define GBUFFER_ALBEDO\n#define GBUFFER_SURFACE\n#endif\n#include "GBuffer.glsl";\n#endif';
  assert.ok(standard.includes(block), "LayaAir's own default is what is copied");
  assert.ok(patched.includes('#include "PBRFrag.glsl";\n' + block));
  const call =
    '#ifdef LAYA_MRT\nwriteGBuffer(info.normalWS,inputs.diffuseColor,inputs.metallic,surface.perceptualRoughness,surface.occlusion);\n#endif';
  assert.ok(standard.includes(call));
  assert.ok(patched.includes('getPixelInfo(info,pixel,surface);\n' + call + '\nvec3 surfaceColor'));
  assert.equal(patched.length, text.length + block.length + 1 + call.length + 2);
  // A release with other text is left as it is.
  const other = includeRuntime();
  installLaya342SurfaceBuffer(other);
  other.Shader3D.addInclude(
    'glTFMetallicRoughness.glsl',
    text.replace('getPixelInfo(', 'pixelInfo('),
  );
  assert.equal(zhudaSurfaceBufferInstalled(other), false);
  assert.ok(!other.includes.get('glTFMetallicRoughness.glsl').includes('GBuffer.glsl'));
  // What an effect needs of LayaAir to ask for the pictures.
  assert.equal(zhudaSurfaceBufferSupported({}), false);
  assert.equal(
    zhudaSurfaceBufferSupported({
      GBuffer: { Normal: {}, Surface: {} },
      Camera: { prototype: { getOpaqueAuxiliaryTexture() {} } },
    }),
    true,
  );
});

test('reflections can be told to read each surface, in a look as well', () => {
  assert.deepEqual(validateZhudaScreenReflections({ surfaces: true }), []);
  assert.deepEqual(validateZhudaScreenReflections({ surfaces: 1 }), [
    'surfaces: use true or false',
  ]);
  assert.equal(resolveZhudaScreenReflections({}).surfaces, false);
  assert.equal(resolveZhudaScreenReflections({ surfaces: true }).surfaces, true);
  const scene = (reflections) => ({
    schemaVersion: 1,
    id: 'surfaces',
    camera: { eye: [0, 1, 4], target: [0, 1, 0] },
    look: { grade: {}, screenReflections: reflections },
    nodes: [],
  });
  const issues = (reflections) =>
    validateZhudaFilmScene(scene(reflections), { materials: [] }).filter((issue) =>
      /screenReflections/.test(issue),
    );
  assert.deepEqual(issues({ surfaces: true }), []);
  assert.deepEqual(issues({ surfaces: 'yes' }), [
    'scene.look.screenReflections.surfaces: use true or false',
  ]);
});

test('the velocity picture is taught that a thing can move, and a skinned one with it', () => {
  const vertex = vendoredInclude('MotionVectorVertex.glsl'),
    common = vendoredInclude('MotionVectorCommon.glsl');
  const l = includeRuntime();
  assert.equal(installLaya342ObjectMotion({}), false);
  assert.equal(installLaya342ObjectMotion(l), true);
  assert.equal(zhudaObjectMotionInstalled(l), false);
  l.Shader3D.addInclude('MotionVectorCommon.glsl', common);
  assert.equal(zhudaObjectMotionInstalled(l), false, 'one of the two is not enough');
  l.Shader3D.addInclude('MotionVectorVertex.glsl', vertex);
  assert.equal(zhudaObjectMotionInstalled(l), true);
  const patched = l.includes.get('MotionVectorVertex.glsl');
  assert.ok(
    patched.includes(
      `vec4 zhudaBefore=vec4(positionWS,1.0);\n#ifdef ${ZHUDA_OBJECT_MOTION_DEFINE}\nzhudaBefore=${ZHUDA_OBJECT_MOTION_UNIFORM}*zhudaBefore;\n#endif\nv_TaaPreviousClip=u_TaaPreviousViewProjection*zhudaBefore;`,
    ),
  );
  assert.ok(
    patched.includes(
      `#ifdef ${ZHUDA_OBJECT_MOTION_DEFINE}\nuniform mat4 ${ZHUDA_OBJECT_MOTION_UNIFORM};\n#endif`,
    ),
  );
  // Where the thing is now is as LayaAir wrote it.
  assert.ok(patched.includes('v_TaaCurrentClip=u_TaaViewProjection*vec4(positionWS,1.0);'));
  // The renderer's own uniform, in the renderer's map.
  assert.deepEqual(l.uniforms, [['Sprite3D', ZHUDA_OBJECT_MOTION_UNIFORM, 'm4']]);
  assert.ok(
    l.includes
      .get('MotionVectorCommon.glsl')
      .includes(
        `#if (!defined(BONE) || defined(${ZHUDA_OBJECT_MOTION_DEFINE})) && !defined(GPU_INSTANCE)`,
      ),
  );
  // A release with other text is left as it is.
  const other = includeRuntime();
  installLaya342ObjectMotion(other);
  other.Shader3D.addInclude(
    'MotionVectorVertex.glsl',
    vertex.replace('v_TaaPreviousClip=', 'v_Before='),
  );
  other.Shader3D.addInclude('MotionVectorCommon.glsl', common);
  assert.equal(zhudaObjectMotionInstalled(other), false);
  assert.equal(other.includes.get('MotionVectorVertex.glsl').includes('zhudaBefore'), false);
});

test("a tracked node's renderers are told where it was the frame before", () => {
  const moved = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1],
    before = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1];
  // A point at x = 3 now was at x = 1.
  assert.deepEqual(Array.from(zhudaMotionMatrix(before, moved)).slice(12), [-2, 0, 0, 1]);
  assert.deepEqual(
    Array.from(zhudaMotionMatrix(moved, moved)),
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  );
  // A node scaled to nothing has no way back.
  assert.deepEqual(
    Array.from(zhudaMotionMatrix(before, new Array(16).fill(0))).slice(0, 4),
    [1, 0, 0, 0],
  );

  const vertex = vendoredInclude('MotionVectorVertex.glsl'),
    common = vendoredInclude('MotionVectorCommon.glsl');
  const l = includeRuntime();
  class BaseRender {}
  class Matrix4x4 {
    constructor(...elements) {
      this.elements = elements;
    }
  }
  const defines = new Map();
  Object.assign(l, { BaseRender, Matrix4x4 });
  l.Shader3D.getDefineByName = (name) => defines.get(name) ?? defines.set(name, { name }).get(name);
  const before0 = globalThis.Laya;
  globalThis.Laya = l;
  try {
    assert.throws(() => new ZhudaObjectMotion(), /needs installLaya342ObjectMotion/);
    installLaya342ObjectMotion(l);
    l.Shader3D.addInclude('MotionVectorCommon.glsl', common);
    l.Shader3D.addInclude('MotionVectorVertex.glsl', vertex);
    const part = (x) => {
      const data = {
        defines: new Set(),
        matrices: [],
        addDefine: (d) => data.defines.add(d.name),
        removeDefine: (d) => data.defines.delete(d.name),
        setMatrix4x4: (id, m) => data.matrices.push(m),
      };
      const renderer = Object.assign(new BaseRender(), { _baseRenderNode: { shaderData: data } });
      return {
        data,
        numChildren: 0,
        transform: { worldMatrix: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1] } },
        getComponent: (type) => (renderer instanceof type ? renderer : null),
      };
    };
    const wheel = part(5);
    const car = part(0);
    car.numChildren = 1;
    car.getChildAt = () => wheel;
    const motion = new ZhudaObjectMotion();
    assert.throws(() => motion.track({}), /3D node is required/);
    const handle = motion.track(car);
    motion.update();
    // The first frame it is seen it did not move.
    for (const each of [car, wheel]) {
      assert.deepEqual([...each.data.defines], [ZHUDA_OBJECT_MOTION_DEFINE]);
      assert.deepEqual(each.data.matrices[0].elements.slice(12), [0, 0, 0, 1]);
    }
    car.transform.worldMatrix.elements[12] = 2;
    wheel.transform.worldMatrix.elements[12] = 7;
    motion.update();
    assert.deepEqual(car.data.matrices[1].elements.slice(12), [-2, 0, 0, 1]);
    assert.deepEqual(wheel.data.matrices[1].elements.slice(12), [-2, 0, 0, 1]);
    assert.notEqual(car.data.matrices[1], car.data.matrices[0], 'a new matrix each frame');
    // Standing still: no motion.
    motion.update();
    assert.deepEqual(car.data.matrices[2].elements.slice(12), [0, 0, 0, 1]);
    // After a cut the frame before does not count.
    car.transform.worldMatrix.elements[12] = 50;
    motion.reset();
    motion.update();
    assert.deepEqual(car.data.matrices[3].elements.slice(12), [0, 0, 0, 1]);
    // A part taken off is let go of.
    car.numChildren = 0;
    handle.refresh();
    assert.deepEqual([...wheel.data.defines], []);
    handle.remove();
    assert.deepEqual([...car.data.defines], []);
    const again = motion.track(car);
    motion.update();
    motion.dispose();
    assert.deepEqual([...car.data.defines], []);
    again.remove();
    motion.update();
    assert.throws(() => motion.track(car), /Disposed object motion/);
  } finally {
    globalThis.Laya = before0;
  }
});
