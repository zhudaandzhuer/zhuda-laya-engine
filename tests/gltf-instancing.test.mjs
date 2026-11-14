// The rest of the glTF intake: a mesh drawn many times
// (EXT_mesh_gpu_instancing), occlusion and emissive textures on the second
// set of texture coordinates, and Meshopt decoding in workers. Pure checks;
// the draw is verify:gltf-instancing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import {
  readZhudaGltfBytes,
  readZhudaGltfInstancing,
  readZhudaGltfNodeData,
  zhudaGltfInstanceMatrices,
  ZHUDA_GLTF_MAX_INSTANCES,
} from '../packages/core/runtime3d/GltfIntake.ts';
import {
  gltfExtensionCapabilities,
  inspectGltfAsset,
  inspectGltfDocument,
} from '../packages/core/runtime3d/ModelCompatibility.ts';
import {
  installLaya342SecondUv,
  zhudaGltfTexCoord,
  zhudaPatchSecondUvCommon,
  zhudaPatchSecondUvGltf,
  zhudaPatchSecondUvVertex,
  zhudaSecondUvStatus,
} from '../packages/core/runtime3d/GltfSecondUv.ts';
import {
  laya342GltfInstances,
  laya342GltfRefusedSecondUv,
  prepareLaya342GltfResource,
} from '../packages/core/runtime3d/Laya342GltfAdapter.ts';
import { ZhudaMeshoptModelDecoder } from '../packages/core/runtime3d/MeshoptModelDecoder.ts';
import { instancedYard, twoSetPlate, YARD } from './fixtures/gltf-instancing.mjs';
import { compressFixture, embeddedGlb } from './fixtures/meshopt.mjs';

const documentOf = (bytes) => readZhudaGltfBytes(new Uint8Array(bytes)).document;
const codes = (report) => report.diagnostics.map((d) => `${d.code}:${d.severity}`);

// --- A mesh drawn many times --------------------------------------------------------
test('a node that asks for copies is read with the accessors that place them', () => {
  const yard = documentOf(instancedYard());
  assert.deepEqual(readZhudaGltfInstancing(yard), {
    instancing: [{ index: 1, count: 12, translation: 4, rotation: 5, scale: 6 }],
    problems: [],
  });
  // The node is among those a model hands on, with what it asks for.
  const nodes = readZhudaGltfNodeData(yard);
  assert.deepEqual(
    nodes.map((node) => [node.index, node.name, node.instancing?.count]),
    [[1, 'Crates', 12]],
  );
  // Turns as normalized shorts are a layout the file may use.
  assert.equal(
    readZhudaGltfInstancing(documentOf(instancedYard({ rotation: 'short' }))).instancing.length,
    1,
  );
  // What cannot be drawn is named and left out.
  const problem = (change) => {
    const document = documentOf(instancedYard());
    change(document);
    const { instancing, problems } = readZhudaGltfInstancing(document);
    assert.equal(instancing.length, 0);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].index, 1);
    return problems[0].message;
  };
  assert.match(
    readZhudaGltfInstancing(documentOf(instancedYard({ mismatch: true }))).problems[0].message,
    /SCALE has 11 values where another attribute has 12/,
  );
  assert.match(
    problem((d) => delete d.nodes[1].mesh),
    /no mesh/,
  );
  assert.match(
    problem((d) => (d.nodes[1].skin = 0)),
    /skinned/,
  );
  assert.match(
    problem((d) => (d.accessors[4].type = 'VEC4')),
    /TRANSLATION must be VEC3 of floats/,
  );
  assert.match(
    problem((d) => (d.accessors[5].componentType = 5122)),
    /ROTATION of integers must be normalized/,
  );
  assert.match(
    problem((d) => (d.accessors[6].componentType = 5122)),
    /SCALE must be VEC3 of floats/,
  );
  assert.match(
    problem((d) => (d.nodes[1].extensions.EXT_mesh_gpu_instancing.attributes = { _ID: 4 })),
    /no TRANSLATION, ROTATION or SCALE/,
  );
  assert.match(
    problem((d) => (d.nodes[1].extensions.EXT_mesh_gpu_instancing.attributes.ROTATION = 99)),
    /ROTATION names no accessor/,
  );
  assert.match(
    problem((d) => {
      for (const i of [4, 5, 6]) d.accessors[i].count = ZHUDA_GLTF_MAX_INSTANCES + 1;
    }),
    /more than one node may have/,
  );
  // A move alone is enough.
  const moved = documentOf(instancedYard());
  moved.nodes[1].extensions.EXT_mesh_gpu_instancing.attributes = { TRANSLATION: 4 };
  assert.deepEqual(readZhudaGltfInstancing(moved).instancing[0], {
    index: 1,
    count: 12,
    translation: 4,
    rotation: null,
    scale: null,
  });
});

/** A point through a move, a turn (quaternion) and a scale, the long way. */
function placed(point, { translation, rotation, scale }) {
  const [x, y, z, w] = rotation,
    v = point.map((p, k) => p * scale[k]);
  // v' = v + 2 q × (q × v + w v)
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const q = [x, y, z],
    inner = cross(q, v).map((c, k) => c + w * v[k]),
    turned = cross(q, inner).map((c, k) => v[k] + 2 * c);
  return turned.map((c, k) => c + translation[k]);
}
const through = (m, at, p) =>
  [0, 1, 2].map(
    (row) =>
      m[at + row] * p[0] + m[at + 4 + row] * p[1] + m[at + 8 + row] * p[2] + m[at + 12 + row],
  );

test('the matrix of each copy is its move, its turn and its scale', () => {
  const copies = YARD.copies;
  const { matrices, mirrored } = zhudaGltfInstanceMatrices(
    copies.length,
    copies.flatMap((copy) => copy.translation),
    copies.flatMap((copy) => copy.rotation),
    copies.flatMap((copy) => copy.scale),
  );
  assert.equal(matrices.length, 12 * 16);
  assert.deepEqual(mirrored, []);
  const point = [0.3, -0.2, 0.5];
  copies.forEach((copy, i) => {
    const got = through(matrices, i * 16, point),
      want = placed(point, copy);
    for (let k = 0; k < 3; k++)
      assert.ok(Math.abs(got[k] - want[k]) < 1e-5, `copy ${i}: ${got} against ${want}`);
    assert.deepEqual([...matrices.subarray(i * 16 + 12, i * 16 + 16)].map(Math.fround), [
      ...copy.translation.map(Math.fround),
      1,
    ]);
  });
  // Shorts read as -1..1 give the same turns.
  const shorts = zhudaGltfInstanceMatrices(
    12,
    copies.flatMap((copy) => copy.translation),
    copies.flatMap((copy) => copy.rotation).map((value) => Math.round(value * 32767)),
    copies.flatMap((copy) => copy.scale),
    1 / 32767,
  ).matrices;
  for (let i = 0; i < shorts.length; i++) assert.ok(Math.abs(shorts[i] - matrices[i]) < 1e-4);
  // Nothing given is nothing done; a turn of no length is no turn; a turn is made a unit.
  assert.deepEqual(
    [...zhudaGltfInstanceMatrices(1).matrices],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  );
  assert.deepEqual(
    [...zhudaGltfInstanceMatrices(1, null, [0, 0, 0, 0]).matrices],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  );
  const half = zhudaGltfInstanceMatrices(1, null, [0, 2, 0, 0]).matrices;
  assert.deepEqual(
    [...half].map((v) => Math.round(v * 1e6) / 1e6 + 0),
    [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1],
    'half a turn about the upright',
  );
  // A scale that turns the mesh inside out is said: one or three of its numbers below zero.
  assert.deepEqual(
    zhudaGltfInstanceMatrices(4, null, null, [1, 1, 1, -1, 1, 1, -1, -2, 1, -1, -1, -1]).mirrored,
    [1, 3],
  );
  assert.throws(() => zhudaGltfInstanceMatrices(0), /count/);
  assert.throws(() => zhudaGltfInstanceMatrices(2, [0, 0, 0]), /translation holds fewer/);
  assert.throws(() => zhudaGltfInstanceMatrices(1, [NaN, 0, 0]), /Instance 0 is not finite/);
});

test('the report takes the extension, and says what will not reach the screen', () => {
  assert.ok(
    gltfExtensionCapabilities.some(
      (c) => c.name === 'EXT_mesh_gpu_instancing' && c.implementation === 'engine',
    ),
  );
  // Required by the file and read by the engine: nothing to say.
  const fine = inspectGltfAsset(instancedYard());
  assert.equal(fine.status, 'supported');
  assert.deepEqual(codes(fine), []);
  assert.deepEqual(fine.extensions, [
    { name: 'EXT_mesh_gpu_instancing', required: true, implemented: true },
  ]);
  const broken = inspectGltfAsset(instancedYard({ mismatch: true }));
  assert.equal(broken.status, 'degraded');
  assert.deepEqual(codes(broken), ['INVALID_INSTANCING:warning']);
  assert.equal(broken.diagnostics[0].path, '$.nodes[1].extensions.EXT_mesh_gpu_instancing');
  assert.match(broken.diagnostics[0].message, /drawn once/);
});

// --- The second set of texture coordinates -------------------------------------------
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
test('occlusion and emissive textures may ask for the second set; the others are said to be ignored', () => {
  const plate = (texCoord) =>
    inspectGltfAsset(twoSetPlate({ occlusionPng: png, emissivePng: png, texCoord }));
  assert.deepEqual(codes(plate(0)), []);
  assert.deepEqual(codes(plate(1)), []);
  assert.equal(plate(1).status, 'supported');
  // A third set is not read by anything.
  const third = plate(2);
  assert.deepEqual(codes(third), ['TEXCOORD_IGNORED:warning', 'TEXCOORD_IGNORED:warning']);
  assert.equal(third.status, 'degraded');
  assert.deepEqual(
    third.diagnostics.map((d) => d.path),
    ['$.materials[0].occlusion', '$.materials[0].emissive'],
  );
  // The colour, the normal and the roughness are read by the first set only.
  const document = documentOf(twoSetPlate({ occlusionPng: png, emissivePng: png, texCoord: 1 }));
  document.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0, texCoord: 1 };
  document.materials[0].normalTexture = { index: 0 };
  const colour = inspectGltfDocument(document);
  assert.deepEqual(codes(colour), ['TEXCOORD_IGNORED:warning']);
  assert.equal(colour.diagnostics[0].path, '$.materials[0].baseColor');
  assert.match(colour.diagnostics[0].message, /drawn with the first set/);
  // KHR_texture_transform may name another set than the texture reference does.
  assert.equal(zhudaGltfTexCoord({ index: 0 }), 0);
  assert.equal(zhudaGltfTexCoord({ index: 0, texCoord: 1 }), 1);
  assert.equal(
    zhudaGltfTexCoord({
      index: 0,
      texCoord: 1,
      extensions: { KHR_texture_transform: { texCoord: 0 } },
    }),
    0,
  );
  assert.equal(zhudaGltfTexCoord({ index: 0, texCoord: -1 }), 0);
  assert.equal(zhudaGltfTexCoord(null), 0);
});

/** The text LayaAir 3.4.2 registers for an include, read from a vendored library. */
function vendoredInclude(name) {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../vendor/laya-3.4.2/libs/laya.d3.js'),
    'utf8',
  );
  const start = source.indexOf(`addInclude("${name}",`);
  assert.ok(start > 0, `${name} is registered`);
  const at = start + `addInclude("${name}",`.length;
  const quote = source[at];
  let end = at + 1;
  while (source[end] !== quote) end += source[end] === '\\' ? 2 : 1;
  return Function(`return ${source.slice(at, end + 1)}`)();
}
/** The glTF shader's lit fragment program, as laya.gltf.js registers it. */
function vendoredGltfFragment() {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../vendor/laya-3.4.2/libs/laya.gltf.js'),
    'utf8',
  );
  const start = source.indexOf("'#define SHADER_NAME glTFPBRFS");
  assert.ok(start > 0, 'the glTF shader is registered');
  let end = start + 1;
  while (source[end] !== "'") end += source[end] === '\\' ? 2 : 1;
  return Function(`return ${source.slice(start, end + 1)}`)();
}

test('the vendored shader text still holds the lines the second set is added at', () => {
  const common = zhudaPatchSecondUvCommon(vendoredInclude('ShadingCommon.glsl'));
  assert.equal(common.reason, undefined);
  // The varying is declared for a mesh that has the set, on a material that asks.
  assert.ok(
    common.text.includes(
      '#ifdef UV1\n#ifdef ZHUDA_UV1\nvarying vec2 v_ZhudaTexcoord1;\n#endif\n#endif\n#ifdef COLOR\nvarying vec4 v_VertexColor;',
    ),
  );
  const vertex = zhudaPatchSecondUvVertex(vendoredInclude('ShadingVertex.glsl'));
  assert.equal(vertex.reason, undefined);
  assert.ok(
    vertex.text.includes(
      'params.uv0=vertex.texCoord0;\n#endif\n#ifdef UV1\n#ifdef ZHUDA_UV1\nv_ZhudaTexcoord1=vertex.texCoord1;\n#endif\n#endif\n',
    ),
  );
  const fragment = vendoredGltfFragment();
  const gltf = zhudaPatchSecondUvGltf(fragment);
  assert.equal(gltf.reason, undefined);
  assert.ok(
    gltf.text.includes(
      'vec2 occlusionUV=uv;\n#ifdef UV1\n#ifdef ZHUDA_OCCLUSION_UV1\nocclusionUV=v_ZhudaTexcoord1;\n#endif\n#endif\n#ifdef OCCLUSIONMAP_TRANSFORM',
    ),
    'before the texture transform, as the first set is',
  );
  assert.ok(
    gltf.text.includes(
      'vec2 emissionUV=uv;\n#ifdef UV1\n#ifdef ZHUDA_EMISSION_UV1\nemissionUV=v_ZhudaTexcoord1;\n#endif\n#endif\n',
    ),
  );
  // Only lines are added: taken out again, the program is LayaAir's.
  assert.equal(
    gltf.text
      .replace(
        '#ifdef UV1\n#ifdef ZHUDA_OCCLUSION_UV1\nocclusionUV=v_ZhudaTexcoord1;\n#endif\n#endif\n',
        '',
      )
      .replace(
        '#ifdef UV1\n#ifdef ZHUDA_EMISSION_UV1\nemissionUV=v_ZhudaTexcoord1;\n#endif\n#endif\n',
        '',
      ),
    fragment,
  );
  // A program without those lines is left alone; one that has lost a line is not half changed.
  assert.deepEqual(zhudaPatchSecondUvGltf('void main(){}'), { text: 'void main(){}' });
  const lost = fragment.replace('vec2 emissionUV=uv;\n', 'vec2 emissionUV=uv2;\n');
  assert.equal(zhudaPatchSecondUvGltf(lost).text, lost);
  assert.match(zhudaPatchSecondUvGltf(lost).reason, /glTF shader no longer holds/);
  assert.match(zhudaPatchSecondUvCommon('struct PixelParams{};').reason, /ShadingCommon/);
  assert.match(zhudaPatchSecondUvVertex('void main(){}').reason, /ShadingVertex/);
});

/** Enough of LayaAir to register includes and shader passes through. */
function shaderRuntime() {
  const includes = new Map(),
    passes = [];
  class SubShader {
    addShaderPass(vertex, fragment) {
      passes.push({ vertex, fragment });
    }
  }
  return {
    includes,
    passes,
    SubShader,
    Shader3D: {
      addInclude: (name, text) => includes.set(name, text),
      getDefineByName: (name) => name,
    },
  };
}

test('the text is changed as LayaAir registers it, and the status says whether a material may ask', () => {
  const runtime = shaderRuntime();
  assert.deepEqual(zhudaSecondUvStatus(runtime), {
    ready: false,
    reason: 'installLaya342SecondUv was not called',
  });
  assert.equal(installLaya342SecondUv(runtime), true);
  assert.equal(installLaya342SecondUv(runtime), true, 'once');
  assert.equal(zhudaSecondUvStatus(runtime).ready, false, 'nothing registered yet');
  runtime.Shader3D.addInclude('ShadingCommon.glsl', vendoredInclude('ShadingCommon.glsl'));
  runtime.Shader3D.addInclude('ShadingVertex.glsl', vendoredInclude('ShadingVertex.glsl'));
  runtime.Shader3D.addInclude('Other.glsl', 'float other(){return 1.0;}');
  assert.equal(runtime.includes.get('Other.glsl'), 'float other(){return 1.0;}');
  assert.ok(runtime.includes.get('ShadingCommon.glsl').includes('v_ZhudaTexcoord1'));
  assert.ok(runtime.includes.get('ShadingVertex.glsl').includes('v_ZhudaTexcoord1'));
  assert.equal(zhudaSecondUvStatus(runtime).ready, false, 'the glTF shader is not there yet');
  const sub = new runtime.SubShader();
  sub.addShaderPass('void main(){}', 'void main(){gl_FragColor=vec4(1.0);}');
  sub.addShaderPass('void main(){}', vendoredGltfFragment());
  assert.equal(runtime.passes[0].fragment, 'void main(){gl_FragColor=vec4(1.0);}');
  assert.ok(runtime.passes[1].fragment.includes('occlusionUV=v_ZhudaTexcoord1;'));
  assert.deepEqual(zhudaSecondUvStatus(runtime), { ready: true, reason: null });
  // Text that has changed: nothing of it is touched and the reason is kept.
  const changed = shaderRuntime();
  installLaya342SecondUv(changed);
  changed.Shader3D.addInclude('ShadingCommon.glsl', 'struct PixelParams{};');
  assert.equal(changed.includes.get('ShadingCommon.glsl'), 'struct PixelParams{};');
  assert.match(zhudaSecondUvStatus(changed).reason, /ShadingCommon\.glsl no longer holds/);
  assert.equal(installLaya342SecondUv({}), false);
});

/** A glTF resource as the adapter sees it: enough to make materials and nodes. */
function fakeResource(document, buffers = {}) {
  const warned = [];
  return {
    warned,
    _data: document,
    _textures: ['texture0', 'texture1'],
    _nodes: [],
    getTextureWithInfo(info) {
      if (info.texCoord) warned.push(info);
      return this._textures[info.index];
    },
    createMaterial(definition) {
      const defines = [];
      // As LayaAir: every texture slot is asked for through getTextureWithInfo.
      for (const info of [definition.occlusionTexture, definition.emissiveTexture])
        if (info) this.getTextureWithInfo(info);
      return { defines, addDefine: (define) => defines.push(define), extensions: {} };
    },
    loadNodes(nodes) {
      this._nodes = nodes.map((node) => ({ name: node.name }));
    },
    getBufferwithAccessorIndex: (index) => buffers[index] ?? null,
  };
}

test('a glTF material is marked for the second set, or reported when it cannot be', () => {
  const document = documentOf(twoSetPlate({ occlusionPng: png, emissivePng: png, texCoord: 1 }));
  // Ready: the material carries the defines and LayaAir's warning is not raised.
  const ready = shaderRuntime();
  installLaya342SecondUv(ready);
  ready.Shader3D.addInclude('ShadingCommon.glsl', vendoredInclude('ShadingCommon.glsl'));
  ready.Shader3D.addInclude('ShadingVertex.glsl', vendoredInclude('ShadingVertex.glsl'));
  new ready.SubShader().addShaderPass('', vendoredGltfFragment());
  const resource = fakeResource(document);
  prepareLaya342GltfResource(resource, ready);
  const material = resource.createMaterial(document.materials[0]);
  assert.deepEqual(material.defines, ['ZHUDA_UV1', 'ZHUDA_OCCLUSION_UV1', 'ZHUDA_EMISSION_UV1']);
  assert.deepEqual(resource.warned, []);
  assert.deepEqual(laya342GltfRefusedSecondUv(resource), []);
  // The first set: nothing is added.
  const plain = documentOf(twoSetPlate({ occlusionPng: png, emissivePng: png, texCoord: 0 }));
  const first = fakeResource(plain);
  prepareLaya342GltfResource(first, ready);
  assert.deepEqual(first.createMaterial(plain.materials[0]).defines, []);
  // Occlusion alone.
  const one = documentOf(twoSetPlate({ occlusionPng: png, emissivePng: png, texCoord: 1 }));
  delete one.materials[0].emissiveTexture.texCoord;
  const single = fakeResource(one);
  prepareLaya342GltfResource(single, ready);
  assert.deepEqual(single.createMaterial(one.materials[0]).defines, [
    'ZHUDA_UV1',
    'ZHUDA_OCCLUSION_UV1',
  ]);
  // Not ready: LayaAir draws by the first set (and warns); the model's report will say so.
  const bare = shaderRuntime();
  const refused = fakeResource(document);
  prepareLaya342GltfResource(refused, bare);
  assert.deepEqual(refused.createMaterial(document.materials[0]).defines, []);
  assert.equal(refused.warned.length, 2);
  assert.deepEqual(
    laya342GltfRefusedSecondUv(refused).map((item) => [item.material, item.slot]),
    [
      [0, 'occlusion'],
      [0, 'emissive'],
    ],
  );
});

test('where the copies go is read when the nodes are made; a copy turned inside out is left out', () => {
  const copies = YARD.copies;
  const buffers = {
    4: new Float32Array(copies.flatMap((copy) => copy.translation)),
    5: new Float32Array(copies.flatMap((copy) => copy.rotation)),
    6: new Float32Array(copies.flatMap((copy) => copy.scale)),
  };
  const document = documentOf(instancedYard());
  const resource = fakeResource(document, buffers);
  prepareLaya342GltfResource(resource, shaderRuntime());
  assert.equal(laya342GltfInstances(resource).size, 0, 'before the nodes are made');
  resource.loadNodes(document.nodes);
  const read = laya342GltfInstances(resource);
  assert.deepEqual([...read.keys()], [1]);
  assert.equal(read.get(1).mirrored, 0);
  const want = zhudaGltfInstanceMatrices(12, buffers[4], buffers[5], buffers[6]).matrices;
  assert.deepEqual([...read.get(1).matrices], [...want]);
  // Normalized shorts, as LayaAir hands them over: raw integers.
  const short = documentOf(instancedYard({ rotation: 'short' }));
  const shorts = fakeResource(short, {
    ...buffers,
    5: new Int16Array(copies.flatMap((copy) => copy.rotation).map((v) => Math.round(v * 32767))),
  });
  prepareLaya342GltfResource(shorts, shaderRuntime());
  shorts.loadNodes(short.nodes);
  const fromShorts = laya342GltfInstances(shorts).get(1).matrices;
  for (let i = 0; i < want.length; i++) assert.ok(Math.abs(fromShorts[i] - want[i]) < 1e-4);
  // The fourth copy turned inside out: eleven are kept, in their order.
  const mirror = documentOf(instancedYard({ mirror: 3 }));
  const scale = new Float32Array(buffers[6]);
  scale[9] = -scale[9];
  const mirrored = fakeResource(mirror, { ...buffers, 6: scale });
  prepareLaya342GltfResource(mirrored, shaderRuntime());
  mirrored.loadNodes(mirror.nodes);
  const kept = laya342GltfInstances(mirrored).get(1);
  assert.equal(kept.mirrored, 1);
  assert.equal(kept.matrices.length, 11 * 16);
  assert.deepEqual([...kept.matrices.subarray(0, 48)], [...want.subarray(0, 48)]);
  assert.deepEqual([...kept.matrices.subarray(48, 64)], [...want.subarray(64, 80)]);
  // Numbers that are not numbers fail the model, naming the node.
  const broken = fakeResource(document, { ...buffers, 4: new Float32Array(36).fill(NaN) });
  prepareLaya342GltfResource(broken, shaderRuntime());
  assert.throws(() => broken.loadNodes(document.nodes), /glTF node 1 \(EXT_mesh_gpu_instancing\)/);
});

// --- Meshopt in workers --------------------------------------------------------------
const source = JSON.parse(
  fs.readFileSync(new URL('./fixtures/gltf-review/node-weights.gltf', import.meta.url)),
);
const compressed = await compressFixture(source);
/** A worker as the decoder library drives one, decoding on a later turn of this thread. */
function fakeWorkers() {
  const made = [];
  const modes = {
    meshopt_decodeVertexBuffer: 'ATTRIBUTES',
    meshopt_decodeIndexBuffer: 'TRIANGLES',
    meshopt_decodeIndexSequence: 'INDICES',
  };
  const filters = {
    meshopt_decodeFilterOct: 'OCTAHEDRAL',
    meshopt_decodeFilterQuat: 'QUATERNION',
    meshopt_decodeFilterExp: 'EXPONENTIAL',
    meshopt_decodeFilterColor: 'COLOR',
  };
  class Worker {
    jobs = 0;
    closed = false;
    constructor() {
      made.push(this);
    }
    postMessage(data) {
      if (!data.id) {
        this.closed = true;
        return;
      }
      this.jobs++;
      setTimeout(() => {
        try {
          const target = new Uint8Array(data.count * data.size);
          if (Worker.fail) throw Error('worker failed');
          MeshoptDecoder.decodeGltfBuffer(
            target,
            data.count,
            data.size,
            data.source,
            modes[data.mode],
            filters[data.filter] ?? 'NONE',
          );
          this.onmessage({
            data: { id: data.id, count: data.count, action: 'resolve', value: target },
          });
        } catch (error) {
          this.onmessage({
            data: { id: data.id, count: data.count, action: 'reject', value: error },
          });
        }
      }, 0);
    }
  }
  return { made, Worker };
}
const decodeWith = (decoder, bytes, signal = new AbortController().signal) =>
  decoder.decode({ assetId: 'model.glb', bytes, signal, maxOutputBytes: 64 * 1024 * 1024 });

test('Meshopt decodes in workers when asked, to the same bytes, and stops them when disposed', async () => {
  await MeshoptDecoder.ready;
  const bytes = embeddedGlb(compressed);
  const plain = new ZhudaMeshoptModelDecoder();
  assert.equal(plain.workers, 0);
  const want = (await decodeWith(plain, bytes)).data;
  // A host without workers: asked for, not there, said, and decoded as before.
  assert.equal(typeof globalThis.Worker, 'undefined', 'this test supplies the workers');
  const without = new ZhudaMeshoptModelDecoder({ workers: 2 });
  assert.equal(without.workers, 0);
  assert.match(without.workersUnavailable, /no web workers/);
  assert.deepEqual([...(await decodeWith(without, bytes)).data], [...want]);
  without.dispose();
  const { made, Worker } = fakeWorkers();
  globalThis.Worker = Worker;
  try {
    const decoder = new ZhudaMeshoptModelDecoder({ workers: 2 });
    assert.equal(decoder.workers, 2);
    assert.equal(decoder.workersUnavailable, null);
    assert.equal(made.length, 2);
    const decoded = await decodeWith(decoder, bytes);
    assert.deepEqual([...decoded.data], [...want], 'the same file either way');
    assert.ok(made[0].jobs + made[1].jobs > 1, 'the views went to the workers');
    assert.ok(made[0].jobs > 0 && made[1].jobs > 0, 'to both of them');
    // A second decoder that asks for more makes more; the set is as large as the largest request.
    const more = new ZhudaMeshoptModelDecoder({ workers: 3 });
    assert.equal(made.length, 3);
    more.dispose();
    assert.equal(made[2].closed, true, 'the third goes with the decoder that asked for it');
    assert.equal(made[0].closed, false);
    // A view that fails in a worker fails the model.
    Worker.fail = true;
    await assert.rejects(decodeWith(decoder, bytes), /worker failed/);
    Worker.fail = false;
    // Cancelled while the workers are busy: no bytes are handed over.
    const stop = new AbortController();
    const pending = decodeWith(decoder, bytes, stop.signal);
    stop.abort();
    await assert.rejects(pending, /cancelled/);
    decoder.dispose();
    decoder.dispose();
    assert.equal(decoder.workers, 0);
    assert.deepEqual(
      made.map((worker) => worker.closed),
      [true, true, true],
    );
    await assert.rejects(decodeWith(decoder, bytes), /cancelled/);
  } finally {
    delete globalThis.Worker;
  }
  for (const count of [-1, 1.5, 9, '2'])
    assert.throws(() => new ZhudaMeshoptModelDecoder({ workers: count }), /0\.\.8/);
  plain.dispose();
});
