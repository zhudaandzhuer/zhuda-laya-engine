import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import {
  ZhudaMeshoptModelDecoder,
  ZhudaModelDecoderRegistry,
  ZhudaModelLibrary,
  ZhudaModelCompatibilityError,
  inspectGltfAsset,
  inspectGltfDocument,
  gltfAssetCapabilities,
  gltfExtensionCapabilities,
  applyZhudaGltfCamera,
  dequantizeZhudaGltf,
  probeZhudaImageDecode,
  quantizedZhudaGltfAccessors,
  readZhudaGltfCameras,
  readZhudaGltfLights,
  readZhudaGltfNodeData,
  resolveZhudaGltfTextureSource,
  zhudaGltfLightToLaya,
} from '../packages/core/runtime3d/index.ts';
import { readZhudaGltfBytes, writeZhudaGlb } from '../packages/core/runtime3d/GltfIntake.ts';
import {
  prepareLaya342GltfResource,
  laya342GltfNodes,
} from '../packages/core/runtime3d/Laya342GltfAdapter.ts';
import { quantizedTorus, picturePlane, litRoom, ROOM, pack } from './fixtures/gltf-intake.mjs';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
);
const ring = await quantizedTorus(png);
const registry = () => {
  const r = new ZhudaModelDecoderRegistry();
  r.register(new ZhudaMeshoptModelDecoder());
  return r;
};
const documentOf = (bytes) => readZhudaGltfBytes(new Uint8Array(bytes)).document;
/** An accessor's values as floats, read as glTF lays them out. */
const values = (bytes, index) => {
  const { document, bin } = readZhudaGltfBytes(new Uint8Array(bytes));
  const a = document.accessors[index],
    view = document.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const reader = {
    5120: ['getInt8', 1],
    5121: ['getUint8', 1],
    5122: ['getInt16', 2],
    5123: ['getUint16', 2],
    5126: ['getFloat32', 4],
  }[a.componentType];
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength),
    stride = view.byteStride ?? reader[1] * n,
    start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < a.count; i++)
    for (let k = 0; k < n; k++) out.push(dv[reader[0]](start + i * stride + k * reader[1], true));
  return { values: out, accessor: a };
};
const codes = (report) => report.diagnostics.map((d) => `${d.code}:${d.severity}`);

test('KHR_meshopt_compression and its COLOR filter decode to the bytes the encoder was given', async () => {
  const r = registry();
  const decoded = await r.decode('meshopt', 'ring.glb', new Uint8Array(ring.quantized));
  const d = documentOf(decoded.data);
  assert.deepEqual(d.extensionsUsed, ['KHR_mesh_quantization']);
  assert.ok(d.bufferViews.every((v) => !v.extensions));
  // Positions and texture coordinates are stored without a filter: the bytes match exactly.
  assert.deepEqual(values(decoded.data, 0).values, values(ring.quantizedRaw, 0).values);
  assert.deepEqual(values(decoded.data, 2).values, values(ring.quantizedRaw, 2).values);
  // The COLOR filter reproduces 8-bit colours to within a step.
  const colors = values(decoded.data, 3).values,
    plain = values(ring.quantizedRaw, 3).values;
  assert.equal(colors.length, plain.length);
  assert.ok(colors.every((c, i) => Math.abs(c - plain[i]) <= 1));
  // So does OCTAHEDRAL with unit normals.
  const normals = values(decoded.data, 1).values,
    reference = values(ring.reference, 1).values;
  for (let i = 0; i < reference.length; i++)
    assert.ok(Math.abs(Math.max(normals[i] / 127, -1) - reference[i]) < 0.02);
  decoded.release();
  r.dispose();
});

test('Meshopt layouts are checked per name: COLOR only under KHR, 4- or 8-byte strides, one name a view', async () => {
  const r = registry();
  const json = documentOf(ring.quantized),
    bin = readZhudaGltfBytes(new Uint8Array(ring.quantized)).bin;
  const variant = (mutate) => {
    const d = structuredClone(json);
    mutate(d);
    return writeZhudaGlb(d, bin);
  };
  const colorView = json.bufferViews.findIndex(
    (v) => v.extensions?.KHR_meshopt_compression?.filter === 'COLOR',
  );
  for (const [why, mutate] of [
    [
      'COLOR under the EXT name',
      (d) => {
        for (const v of d.bufferViews)
          if (v.extensions) {
            v.extensions.EXT_meshopt_compression = v.extensions.KHR_meshopt_compression;
            delete v.extensions.KHR_meshopt_compression;
          }
        d.extensionsUsed = ['KHR_mesh_quantization', 'EXT_meshopt_compression'];
        d.extensionsRequired = d.extensionsUsed;
        d.buffers[1].extensions = { EXT_meshopt_compression: { fallback: true } };
      },
    ],
    [
      'COLOR with a 12-byte stride',
      (d) => {
        d.bufferViews[colorView].extensions.KHR_meshopt_compression.byteStride = 12;
      },
    ],
    [
      'both names on one view',
      (d) => {
        d.extensionsUsed.push('EXT_meshopt_compression');
        d.bufferViews[colorView].extensions.EXT_meshopt_compression =
          d.bufferViews[colorView].extensions.KHR_meshopt_compression;
      },
    ],
    [
      'an unknown filter',
      (d) => (d.bufferViews[colorView].extensions.KHR_meshopt_compression.filter = 'SRGB'),
    ],
  ])
    await assert.rejects(r.decode('meshopt', 'bad.glb', variant(mutate)), Error, why);
  r.dispose();
});

test('a Meshopt file reports DECODER_REQUIRED: an error when required, a lost feature when optional', () => {
  let report = inspectGltfAsset(ring.quantized);
  assert.equal(report.status, 'unsupported');
  assert.deepEqual(
    report.diagnostics
      .filter((d) => d.code === 'DECODER_REQUIRED')
      .map((d) => [d.severity, d.extension, d.path]),
    [['error', 'KHR_meshopt_compression', '$.extensionsRequired[1]']],
  );
  assert.match(report.diagnostics[0].hint, /ZhudaMeshoptModelDecoder/);
  const d = documentOf(ring.quantized);
  d.extensionsRequired = ['KHR_mesh_quantization'];
  report = inspectGltfDocument(d);
  assert.equal(report.status, 'degraded');
  assert.ok(codes(report).includes('DECODER_REQUIRED:warning'));
  const byName = new Map(gltfAssetCapabilities.map((c) => [c.name, c]));
  assert.equal(byName.get('KHR_meshopt_compression').status, 'adapter-required');
  assert.equal(byName.get('KHR_mesh_quantization').status, 'supported');
  assert.equal(byName.get('EXT_texture_avif').status, 'supported');
  assert.equal(byName.get('EXT_texture_webp').status, 'supported');
  const ext = new Map(gltfExtensionCapabilities.map((c) => [c.name, c]));
  for (const name of [
    'KHR_mesh_quantization',
    'EXT_texture_webp',
    'EXT_texture_avif',
    'KHR_lights_punctual',
  ])
    assert.equal(ext.get(name).implementation, 'engine', name);
  assert.equal(ext.get('KHR_materials_sheen').implementation, 'native');
  assert.equal(ext.has('KHR_meshopt_compression'), false);
});

test('dequantizing gives the float values, keeps node transforms and drops the extension', async () => {
  assert.deepEqual(quantizedZhudaGltfAccessors(documentOf(ring.quantizedRaw)), [0, 1, 2]);
  const report = inspectGltfAsset(ring.quantizedRaw);
  assert.equal(report.status, 'supported');
  const note = report.diagnostics.find((d) => d.code === 'DEQUANTIZED_ATTRIBUTES');
  assert.equal(note.severity, 'warning');
  assert.equal(note.extension, 'KHR_mesh_quantization');
  assert.match(note.message, /3 integer vertex attribute accessor\(s\) become 68640 bytes/);
  const out = dequantizeZhudaGltf(new Uint8Array(ring.quantizedRaw));
  assert.equal(out.accessors, 3);
  assert.equal(out.floatBytes, 68640);
  const d = documentOf(out.bytes),
    source = documentOf(ring.quantizedRaw);
  assert.equal(d.extensionsUsed, undefined);
  assert.equal(d.extensionsRequired, undefined);
  assert.deepEqual(d.nodes, source.nodes);
  assert.equal(d.buffers.length, 1);
  assert.equal(inspectGltfAsset(out.bytes).status, 'supported');
  assert.deepEqual(inspectGltfAsset(out.bytes).diagnostics, []);
  // The picture still reads from its view.
  assert.deepEqual(
    [
      ...out.bytes
        .subarray(28 + new DataView(out.bytes.buffer).getUint32(12, true))
        .subarray(
          d.bufferViews[d.images[0].bufferView].byteOffset,
          d.bufferViews[d.images[0].bufferView].byteOffset + png.length,
        ),
    ],
    [...png],
  );
  // Positions through the node's scale and offset, normals and texture coordinates.
  const node = d.nodes[1],
    positions = values(out.bytes, 0),
    reference = values(ring.reference, 0).values;
  assert.equal(positions.accessor.componentType, 5126);
  assert.equal(positions.accessor.normalized, undefined);
  for (let i = 0; i < reference.length; i++)
    assert.ok(
      Math.abs(positions.values[i] * node.scale[i % 3] + node.translation[i % 3] - reference[i]) <
        2e-5,
    );
  // POSITION bounds are the float ones (LayaAir takes a mesh's bounds from them).
  assert.deepEqual(positions.accessor.max, documentOf(ring.quantizedRaw).accessors[0].max);
  const normals = values(out.bytes, 1).values,
    normalRef = values(ring.reference, 1).values;
  assert.ok(normals.every((n, i) => Math.abs(n - normalRef[i]) < 0.01));
  const uvs = values(out.bytes, 2).values,
    uvRef = values(ring.reference, 2).values;
  assert.ok(uvs.every((u, i) => Math.abs(u - uvRef[i]) < 1e-5));
  // The 8-bit colours are left to the parse-time repair (zhudaGltfColors).
  assert.equal(values(out.bytes, 3).accessor.componentType, 5121);
  // Meshopt first, then the same pass: the same floats.
  const r = registry();
  const decoded = await r.decode('meshopt', 'ring.glb', new Uint8Array(ring.quantized));
  const both = dequantizeZhudaGltf(decoded.data);
  assert.deepEqual(values(both.bytes, 0).values, positions.values);
  assert.deepEqual(values(both.bytes, 2).values, uvs);
  decoded.release();
  r.dispose();
  // A file with nothing quantized is left alone.
  assert.equal(dequantizeZhudaGltf(new Uint8Array(ring.reference)), null);
});

/**
 * One-triangle file whose POSITION is `data` of `componentType`, optionally
 * sparse. `uri`: a .gltf whose buffer is that URI, or `'embed'` for a data URI.
 */
function triangle(componentType, data, { normalized, sparse, uri, n = 3 } = {}) {
  const extra = sparse ? [{ data: sparse.indices }, { data: sparse.values }] : [];
  const packed = pack([{ data }, ...extra]);
  if (uri === 'embed')
    uri = 'data:application/octet-stream;base64,' + packed.bin.toString('base64');
  const json = {
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_mesh_quantization'],
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType,
        count: data.length / n,
        type: n === 3 ? 'VEC3' : 'VEC2',
        ...(normalized ? { normalized: true } : {}),
        ...(sparse
          ? {
              sparse: {
                count: sparse.indices.length,
                indices: { bufferView: 1, componentType: 5121 },
                values: { bufferView: 2 },
              },
            }
          : {}),
      },
    ],
    bufferViews: packed.views,
    buffers: [uri ? { byteLength: packed.bin.length, uri } : { byteLength: packed.bin.length }],
  };
  return uri ? new TextEncoder().encode(JSON.stringify(json)) : writeZhudaGlb(json, packed.bin);
}

test('normalized and integer components follow glTF: signed values clamp at -1, integers stay whole', () => {
  const read = (bytes) => values(dequantizeZhudaGltf(bytes).bytes, 0).values;
  const floats = (list) => list.map(Math.fround);
  assert.deepEqual(
    read(triangle(5120, new Int8Array([-128, -127, 0, 127, 64, 1, 0, 0, 0]), { normalized: true })),
    floats([-1, -1, 0, 1, 64 / 127, 1 / 127, 0, 0, 0]),
  );
  assert.deepEqual(
    read(triangle(5121, new Uint8Array([255, 0, 51, 0, 0, 0, 1, 2, 3]), { normalized: true })),
    floats([1, 0, 0.2, 0, 0, 0, 1 / 255, 2 / 255, 3 / 255]),
  );
  assert.deepEqual(
    read(
      triangle(5122, new Int16Array([-32768, 32767, 3, 0, 0, 0, 7, 8, 9]), { normalized: true }),
    ).slice(0, 2),
    [-1, 1],
  );
  assert.deepEqual(
    read(triangle(5123, new Uint16Array([65535, 3, 7, 0, 0, 0, 1, 1, 1]))),
    [65535, 3, 7, 0, 0, 0, 1, 1, 1],
  );
  // Sparse values replace the base, then become floats too.
  assert.deepEqual(
    read(
      triangle(5122, new Int16Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), {
        sparse: {
          indices: new Uint8Array([0, 2]),
          values: new Int16Array([10, 11, 12, 13, 14, 15]),
        },
      }),
    ),
    [10, 11, 12, 4, 5, 6, 13, 14, 15],
  );
  // Embedded base64 buffers of a .gltf file come out as a GLB.
  const gltf = triangle(5123, new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), { uri: 'embed' });
  assert.equal(new TextDecoder().decode(gltf.subarray(0, 1)), '{');
  assert.deepEqual(read(gltf), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('dequantizing refuses what it cannot read correctly, before allocating its output', () => {
  // A vertex attribute type glTF does not allow (unsigned 32-bit POSITION).
  const bad = triangle(5125, new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  assert.throws(() => dequantizeZhudaGltf(bad), /layout no vertex attribute may have/);
  assert.equal(inspectGltfAsset(bad).status, 'unsupported');
  assert.ok(codes(inspectGltfAsset(bad)).includes('INVALID_DOCUMENT:error'));
  // TEXCOORD_0 must be two components.
  const d = documentOf(ring.quantizedRaw);
  d.accessors[2].type = 'VEC3';
  assert.throws(() => quantizedZhudaGltfAccessors(d), /TEXCOORD_0/);
  // External buffers: no bytes to rewrite.
  assert.throws(
    () => dequantizeZhudaGltf(triangle(5123, new Uint16Array(9), { uri: 'mesh.bin' })),
    /needs embedded buffers/,
  );
  // An accessor reading past its view, a sparse index out of order.
  const past = documentOf(triangle(5123, new Uint16Array(9)));
  past.accessors[0].count = 4;
  assert.throws(
    () =>
      dequantizeZhudaGltf(
        writeZhudaGlb(past, readZhudaGltfBytes(triangle(5123, new Uint16Array(9))).bin),
      ),
    /reads past its buffer view/,
  );
  assert.throws(
    () =>
      dequantizeZhudaGltf(
        triangle(5122, new Int16Array(9), {
          sparse: { indices: new Uint8Array([2, 1]), values: new Int16Array(6) },
        }),
      ),
    /must rise/,
  );
  // The output budget.
  assert.throws(
    () => dequantizeZhudaGltf(new Uint8Array(ring.quantizedRaw), { maxOutputBytes: 50_000 }),
    /budget/,
  );
  assert.throws(
    () => dequantizeZhudaGltf(new Uint8Array(ring.quantizedRaw), { maxOutputBytes: 0 }),
    /limit/,
  );
});

test('a texture loads its AVIF, then WebP image when the device decodes it, else its fallback', () => {
  const texture = {
    source: 2,
    extensions: { EXT_texture_webp: { source: 1 }, EXT_texture_avif: { source: 0 } },
  };
  const pick = (support) => resolveZhudaGltfTextureSource(texture, support);
  assert.deepEqual(pick({ webp: true, avif: true }), {
    image: 0,
    extension: 'EXT_texture_avif',
    unavailable: [],
  });
  assert.deepEqual(pick({ webp: true, avif: false }), {
    image: 1,
    extension: 'EXT_texture_webp',
    unavailable: ['EXT_texture_avif'],
  });
  assert.deepEqual(pick({ webp: false, avif: false }), {
    image: 2,
    extension: null,
    unavailable: ['EXT_texture_avif', 'EXT_texture_webp'],
  });
  // Without a device answer the fallback is preferred, and an extension image used only alone.
  assert.equal(pick(undefined).image, 2);
  assert.deepEqual(
    resolveZhudaGltfTextureSource({ extensions: { EXT_texture_webp: { source: 4 } } }),
    {
      image: 4,
      extension: 'EXT_texture_webp',
      unavailable: [],
    },
  );
  assert.equal(resolveZhudaGltfTextureSource({}, { webp: true, avif: true }).image, null);
});

test('WebP/AVIF report codes: unavailable with and without a fallback, unchecked, and the inventory', () => {
  const webpOnly = picturePlane({
    images: [['image/webp', png]],
    texture: { extensions: { EXT_texture_webp: { source: 0 } } },
    extension: 'EXT_texture_webp',
    required: true,
  });
  const withFallback = picturePlane({
    images: [
      ['image/webp', png],
      ['image/png', png],
    ],
    texture: { source: 1, extensions: { EXT_texture_webp: { source: 0 } } },
    extension: 'EXT_texture_webp',
  });
  const none = { webp: false, avif: false },
    all = { webp: true, avif: true };
  let report = inspectGltfAsset(webpOnly, { imageDecode: none });
  assert.equal(report.status, 'unsupported');
  const issue = report.diagnostics.find((d) => d.code === 'IMAGE_DECODE_UNAVAILABLE');
  assert.equal(issue.severity, 'error');
  assert.equal(issue.path, '$.textures[0]');
  assert.equal(issue.extension, 'EXT_texture_webp');
  report = inspectGltfAsset(withFallback, { imageDecode: none });
  assert.equal(report.status, 'degraded');
  assert.match(
    report.diagnostics.find((d) => d.code === 'IMAGE_DECODE_UNAVAILABLE').message,
    /fallback image 1 loads/,
  );
  assert.deepEqual(inspectGltfAsset(webpOnly, { imageDecode: all }).diagnostics, []);
  assert.deepEqual(inspectGltfAsset(withFallback, { imageDecode: all }).diagnostics, []);
  // No device answer: a picture without a fallback is named, nothing fails.
  report = inspectGltfAsset(webpOnly);
  assert.equal(report.status, 'supported');
  assert.deepEqual(codes(report), ['IMAGE_DECODE_UNCHECKED:warning']);
  assert.deepEqual(inspectGltfAsset(withFallback).diagnostics, []);
  assert.deepEqual(
    inspectGltfAsset(withFallback).inventory.textures.map((t) => [t.image, t.webp, t.avif]),
    [[1, 0, null]],
  );
});

test('the resource loads the chosen image, embedded pictures go through a revoked Blob URL', async () => {
  const loads = [];
  let fail = false;
  const runtime = {
    Loader: { TEXTURE2D: 'TEXTURE2D' },
    ILaya: {
      loader: {
        async load(item, type) {
          const blob = resolveObjectURL(item.url);
          loads.push({
            item,
            type,
            mime: blob?.type,
            bytes: blob && Buffer.from(await blob.arrayBuffer()),
          });
          if (fail) throw Error('decode failed');
          return { texture: loads.length };
        },
      },
    },
  };
  const textures = [
    { source: 2, extensions: { EXT_texture_webp: { source: 1 } } },
    { extensions: { EXT_texture_avif: { source: 0 } } },
  ];
  const resource = {
    _data: { textures },
    loadTextures() {
      return this._data.textures.map((t) => t.source);
    },
    loadTextureFromBuffer() {
      throw Error('native path used');
    },
    loadNodes(nodes) {
      this._nodes = nodes.map((n) => ({ name: n }));
    },
  };
  prepareLaya342GltfResource(resource, runtime, { imageDecode: { webp: false, avif: true } });
  assert.deepEqual(resource.loadTextures(), [2, 0]);
  const progress = { createCallback: () => 'progress' };
  const texture = await resource.loadTextureFromBuffer(
    new Uint8Array([1, 2, 3]).buffer,
    'image/avif',
    [0, 0, 1],
    { filterMode: 1 },
    progress,
  );
  assert.deepEqual(texture, { texture: 1 });
  assert.equal(loads[0].type, 'TEXTURE2D');
  assert.equal(loads[0].mime, 'image/avif');
  assert.deepEqual([...loads[0].bytes], [1, 2, 3]);
  assert.deepEqual(loads[0].item.constructParams, [0, 0, 1]);
  assert.match(loads[0].item.url, /^blob:/);
  assert.equal(resolveObjectURL(loads[0].item.url), undefined, 'revoked once loaded');
  fail = true;
  await assert.rejects(
    resource.loadTextureFromBuffer(new Uint8Array([4]).buffer, 'image/png', [], null),
    /decode failed/,
  );
  assert.equal(resolveObjectURL(loads[1].item.url), undefined, 'revoked when the load fails');
  // A texture with nothing this device decodes is refused before loading.
  const strict = {
    _data: { textures: [{ extensions: { EXT_texture_avif: { source: 0 } } }] },
    loadTextures() {},
  };
  prepareLaya342GltfResource(strict, runtime, { imageDecode: { webp: true, avif: false } });
  assert.throws(() => strict.loadTextures(), /textures\[0\] has no image this device can decode/);
  // The nodes the last create() made are remembered per resource.
  resource.loadNodes(['a', 'b']);
  assert.deepEqual(
    laya342GltfNodes(resource).map((n) => n.name),
    ['a', 'b'],
  );
  assert.deepEqual(laya342GltfNodes({}), []);
});

test('the image probe answers once per page, and no in Node (no image decoder)', async () => {
  const first = probeZhudaImageDecode();
  assert.equal(probeZhudaImageDecode(), first);
  const answer = await first;
  assert.deepEqual(answer, { webp: false, avif: false });
  assert.ok(Object.isFrozen(answer));
});

test('punctual lights: the file values, invalid lights named, and the LayaAir mapping', () => {
  const room = documentOf(litRoom({ lights: true }));
  const { lights, problems } = readZhudaGltfLights(room);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    lights.map((l) => [l.type, l.range]),
    [
      ['point', 5],
      ['spot', null],
      ['directional', null],
    ],
  );
  assert.ok(Object.isFrozen(lights[0]) && Object.isFrozen(lights[0].color));
  const bad = structuredClone(room);
  bad.extensions.KHR_lights_punctual.lights.push(
    { type: 'area' },
    { type: 'point', intensity: -1 },
    { type: 'point', range: 0 },
    { type: 'spot' },
    { type: 'spot', spot: { innerConeAngle: 0.5, outerConeAngle: 0.4 } },
    { type: 'point', color: [2, 0, 0] },
  );
  const read = readZhudaGltfLights(bad);
  assert.deepEqual(read.lights.slice(3), [null, null, null, null, null, null]);
  assert.deepEqual(
    read.problems.map((p) => p.index),
    [3, 4, 5, 6, 7, 8],
  );
  const report = inspectGltfDocument(bad);
  assert.equal(report.status, 'degraded');
  assert.equal(report.diagnostics.filter((d) => d.code === 'INVALID_LIGHT').length, 6);
  assert.equal(report.diagnostics.filter((d) => d.code === 'LIGHT_APPROXIMATED').length, 2);
  assert.match(
    report.diagnostics.find((d) => d.path === '$.extensions.KHR_lights_punctual.lights[1]').message,
    /range is derived.*inner edge/,
  );

  // Directional: lux / π (LayaAir's diffuse term has no 1/π).
  const sun = zhudaGltfLightToLaya(lights[2], { scale: 2 });
  assert.equal(sun.kind, 'directional');
  assert.ok(Math.abs(sun.intensity - (2 * 0.9) / Math.PI) < 1e-12);
  // Colours: LayaAir decodes Light.color as sRGB; the encoded value decodes to glTF's linear one.
  const decode = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(decode(sun.color[k]) - lights[2].color[k]) < 1e-9);
  // Point with a range: LayaAir's curve meets glTF's windowed inverse square at half the range.
  const lamp = zhudaGltfLightToLaya(lights[0]);
  assert.equal(lamp.range, 5);
  const laya = (settings, d) => {
    const f = Math.min(1, d / settings.range) ** 2;
    return (settings.intensity / (1 + 25 * f)) * Math.min(1, Math.max(0, 4 * (1 - f)));
  };
  const gltf = (light, d) =>
    (light.intensity / (Math.PI * d * d)) *
    (light.range === null ? 1 : Math.max(0, 1 - (d / light.range) ** 4) ** 2);
  assert.ok(Math.abs(laya(lamp, 2.5) / gltf(lights[0], 2.5) - 1) < 1e-9);
  // Without a file range: within about 30 % from a quarter to nine tenths of it.
  const free = zhudaGltfLightToLaya(lights[1]);
  for (let f = 0.25; f <= 0.9; f += 0.05) {
    const ratio = laya(free, f * free.range) / gltf(lights[1], f * free.range);
    assert.ok(ratio > 0.68 && ratio < 1.32, `spot at ${f.toFixed(2)}: ${ratio}`);
  }
  // With one, glTF's window closes faster: about 0.63 at a quarter, about 2 at three quarters.
  const ratioAt = (f) => laya(lamp, f * 5) / gltf(lights[0], f * 5);
  assert.ok(Math.abs(ratioAt(0.25) - 0.63) < 0.02, String(ratioAt(0.25)));
  assert.ok(Math.abs(ratioAt(0.75) - 2.04) < 0.05, String(ratioAt(0.75)));
  // Without a range: four times the distance where the light makes white white.
  const spot = zhudaGltfLightToLaya(lights[1]);
  assert.ok(Math.abs(spot.range - 4 * Math.sqrt(40 / Math.PI)) < 1e-9);
  assert.ok(Math.abs(spot.spotAngleDeg - (2 * 0.42 * 180) / Math.PI) < 1e-9);
  assert.equal(
    zhudaGltfLightToLaya({ ...lights[1], outerConeAngle: Math.PI / 2 }).spotAngleDeg,
    179,
  );
  assert.equal(zhudaGltfLightToLaya({ ...lights[0], intensity: 0, range: null }).intensity, 0);
  for (const scale of [-1, NaN, Infinity])
    assert.throws(() => zhudaGltfLightToLaya(lights[0], { scale }), /scale/);
});

test('cameras and extras: read, frozen, invalid ones named, and a LayaAir camera aimed', () => {
  const room = documentOf(litRoom({ lights: true }));
  const data = readZhudaGltfNodeData(room);
  assert.deepEqual(
    data.map((n) => n.name),
    ['Crate', 'Lamp', 'Spot', 'Sun', 'ShotCamera'],
  );
  const lamp = data.find((n) => n.name === 'Lamp');
  assert.deepEqual(lamp.extras, ROOM.lamp.extras);
  assert.ok(Object.isFrozen(lamp.extras.tags));
  assert.notEqual(lamp.extras, room.nodes[4].extras, 'a copy, not the document');
  const shot = data.find((n) => n.name === 'ShotCamera');
  assert.equal(shot.camera.type, 'perspective');
  assert.ok(Math.abs(shot.camera.yfovDeg - (0.68 * 180) / Math.PI) < 1e-9);
  assert.equal(shot.camera.aspectRatio, 4 / 3);
  const inventory = inspectGltfDocument(room).inventory.nodes;
  assert.deepEqual(
    inventory
      .map((n) => [n.name, n.camera, n.light])
      .filter(([, c, l]) => c !== null || l !== null),
    [
      ['Lamp', null, 0],
      ['Spot', null, 1],
      ['Sun', null, 2],
      ['ShotCamera', 0, null],
    ],
  );
  // Unnamed nodes keep a null name; a node with nothing to carry is left out.
  const unnamed = { asset: { version: '2.0' }, nodes: [{ extras: 1 }, {}], cameras: [] };
  assert.deepEqual(readZhudaGltfNodeData(unnamed), [{ index: 0, name: null, extras: 1 }]);
  const cams = readZhudaGltfCameras({
    cameras: [
      { type: 'orthographic', orthographic: { xmag: 2, ymag: 1.5, znear: 0, zfar: 10 } },
      { type: 'perspective', perspective: { yfov: 0, znear: 0.1 } },
      { type: 'perspective', perspective: { yfov: 1, znear: 1, zfar: 0.5 } },
      { type: 'orthographic', orthographic: { xmag: 0, ymag: 1, znear: 0, zfar: 1 } },
      { type: 'fisheye' },
    ],
  });
  assert.equal(cams.cameras[0].type, 'orthographic');
  assert.deepEqual(
    cams.problems.map((p) => p.index),
    [1, 2, 3, 4],
  );
  const bad = structuredClone(room);
  bad.cameras[0].perspective.znear = -1;
  const report = inspectGltfDocument(bad);
  assert.equal(report.status, 'degraded');
  assert.equal(report.diagnostics.find((d) => d.code === 'INVALID_CAMERA').path, '$.cameras[0]');
  assert.equal(readZhudaGltfNodeData(bad).find((n) => n.name === 'ShotCamera').camera, undefined);

  // A LayaAir camera takes the lens and the node's world pose.
  const vector = (x, y, z) => ({ x, y, z, clone: () => vector(x, y, z) });
  const camera = { transform: {}, farPlane: 1000 };
  const node = {
    transform: {
      position: vector(1, 2, 3),
      rotation: { x: 0, y: 0, z: 0, w: 1, clone: () => 'q' },
    },
  };
  applyZhudaGltfCamera(camera, shot.camera, node);
  assert.equal(camera.orthographic, false);
  assert.ok(Math.abs(camera.fieldOfView - shot.camera.yfovDeg) < 1e-12);
  assert.equal(camera.nearPlane, 0.1);
  assert.equal(camera.farPlane, 60);
  assert.equal(camera.transform.rotation, 'q');
  assert.deepEqual([camera.transform.position.x, camera.transform.position.z], [1, 3]);
  applyZhudaGltfCamera(camera, cams.cameras[0]);
  assert.equal(camera.orthographic, true);
  assert.equal(camera.orthographicVerticalSize, 3);
  // An infinite perspective keeps the camera's own far plane.
  camera.farPlane = 77;
  applyZhudaGltfCamera(camera, { ...shot.camera, zfar: null });
  assert.equal(camera.farPlane, 77);
});

/** Just enough of LayaAir for ZhudaModelLibrary: nodes, components, a glTF resource. */
function fakeLaya(parsed) {
  class Component {}
  class PointLightCom extends Component {}
  class SpotLightCom extends Component {}
  class DirectionLightCom extends Component {}
  class Sprite3D {
    constructor(name) {
      this.name = name;
      this.children = [];
      this._components = [];
      this.destroyed = false;
    }
    get numChildren() {
      return this.children.length;
    }
    addChild(child) {
      child.parent = this;
      this.children.push(child);
    }
    getChildAt(i) {
      return this.children[i];
    }
    getChildIndex(child) {
      return this.children.indexOf(child);
    }
    getComponent() {
      return null;
    }
    addComponent(type) {
      const component = new type();
      component.owner = this;
      this._components.push(component);
      return component;
    }
    clone() {
      const copy = new Sprite3D(this.name);
      for (const child of this.children) copy.addChild(child.clone());
      return copy;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class glTFResource {
    _nodes = [];
    _addReference() {}
    _removeReference() {}
    destroy() {
      this.destroyed = true;
    }
    async _parseglb(bytes) {
      this._data = readZhudaGltfBytes(new Uint8Array(bytes)).document;
      parsed.push(this._data);
      this.loadTextures();
    }
    loadTextures() {
      this.sources = (this._data.textures ?? []).map((t) => t.source);
    }
    loadNodes(nodes) {
      nodes.forEach((n, i) => (this._nodes[i] = new Sprite3D(n.name ?? `node_${i}`)));
    }
    create() {
      this.loadNodes(this._data.nodes);
      this._data.nodes.forEach((n, i) =>
        (n.children ?? []).forEach((c) => this._nodes[i].addChild(this._nodes[c])),
      );
      const scene = new Sprite3D('Scene');
      for (const i of this._data.scenes[0].nodes) scene.addChild(this._nodes[i]);
      this._nodes = [];
      return scene;
    }
  }
  return {
    glTFResource,
    Sprite3D,
    PointLightCom,
    SpotLightCom,
    DirectionLightCom,
    Color: class {
      constructor(r, g, b, a) {
        Object.assign(this, { r, g, b, a });
      }
    },
  };
}

test('ModelLibrary: dequantized bytes reach the parser, node data and asked-for lights land on each copy', async () => {
  const previous = globalThis.Laya,
    parsed = [];
  globalThis.Laya = fakeLaya(parsed);
  const files = {
    'ring.glb': ring.quantized,
    'room.glb': litRoom({ lights: true }),
    'webp.glb': picturePlane({
      images: [
        ['image/webp', png],
        ['image/png', png],
      ],
      texture: { source: 1, extensions: { EXT_texture_webp: { source: 0 } } },
      extension: 'EXT_texture_webp',
    }),
    'webp-only.glb': picturePlane({
      images: [['image/webp', png]],
      texture: { extensions: { EXT_texture_webp: { source: 0 } } },
      extension: 'EXT_texture_webp',
      required: true,
    }),
  };
  let released = 0;
  const provider = {
    name: 'memory',
    async load(id) {
      return {
        id,
        bytes: new Uint8Array(files[id]),
        release() {
          released++;
        },
      };
    },
  };
  const decoders = registry();
  const library = new ZhudaModelLibrary({ provider, decoders, maxIdle: 0 });
  try {
    // Meshopt, then floats: LayaAir never sees an integer vertex attribute.
    const model = await library.instantiate('ring.glb');
    const seen = parsed.at(-1);
    assert.equal(seen.extensionsUsed, undefined);
    assert.deepEqual(
      [0, 1, 2].map((i) => seen.accessors[i].componentType),
      [5126, 5126, 5126],
    );
    assert.deepEqual(codes(model.compatibility), ['DEQUANTIZED_ATTRIBUTES:warning']);
    assert.deepEqual(model.gltfNodes, []);
    model.dispose();

    // Lights only when asked; extras and the camera always; each copy its own nodes.
    const a = await library.instantiate('room.glb');
    const b = await library.instantiate('room.glb', { lights: { scale: 2 } });
    assert.deepEqual(
      a.gltfNodes.map((n) => n.node.name),
      ['Crate', 'Lamp', 'Spot', 'Sun', 'ShotCamera'],
    );
    assert.ok(a.gltfNodes.every((n) => n.lightComponent === null));
    assert.ok(a.gltfNodes.every((n, i) => n.node !== b.gltfNodes[i].node));
    assert.equal(a.gltfNodes[1].node.parent.name, 'Room');
    assert.deepEqual(a.gltfNodes[1].extras, ROOM.lamp.extras);
    const lamp = b.gltfNodes.find((n) => n.name === 'Lamp');
    assert.ok(lamp.lightComponent instanceof globalThis.Laya.PointLightCom);
    assert.equal(lamp.lightComponent.owner, lamp.node);
    assert.equal(lamp.lightComponent.range, 5);
    assert.ok(
      Math.abs(
        lamp.lightComponent.intensity - zhudaGltfLightToLaya(lamp.light, { scale: 2 }).intensity,
      ) < 1e-12,
    );
    assert.ok(
      b.gltfNodes.find((n) => n.name === 'Spot').lightComponent instanceof
        globalThis.Laya.SpotLightCom,
    );
    assert.ok(
      b.gltfNodes.find((n) => n.name === 'Sun').lightComponent instanceof
        globalThis.Laya.DirectionLightCom,
    );
    assert.ok(Object.isFrozen(b.gltfNodes) && Object.isFrozen(lamp));
    await assert.rejects(library.instantiate('room.glb', { lights: { scale: -1 } }), /light scale/);
    a.dispose();
    b.dispose();

    // In Node nothing decodes WebP: the fallback loads, or the model is refused by its code.
    const fallback = await library.instantiate('webp.glb');
    assert.equal(fallback.compatibility.status, 'degraded');
    assert.deepEqual(codes(fallback.compatibility), ['IMAGE_DECODE_UNAVAILABLE:warning']);
    fallback.dispose();
    await assert.rejects(
      library.instantiate('webp-only.glb'),
      (e) =>
        e instanceof ZhudaModelCompatibilityError &&
        e.report.diagnostics.some(
          (d) => d.code === 'IMAGE_DECODE_UNAVAILABLE' && d.severity === 'error',
        ),
    );
    assert.equal(library.report().entries, 0);
    assert.equal(library.report().instances, 0);
    // ring, room (both copies share one load), webp, webp-only.
    assert.equal(released, 4, 'every provider lease is released');
  } finally {
    library.dispose();
    decoders.dispose();
    globalThis.Laya = previous;
  }
});
