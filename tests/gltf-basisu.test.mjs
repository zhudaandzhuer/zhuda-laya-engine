// KHR_texture_basisu in the model intake (record basis-textures): which image
// a texture loads, what the report says, and the embedded KTX 2 image made
// into a texture by the adapter. The transcoder itself is checked in
// tests/basis-texture.test.mjs, the draw by verify:basis-textures.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveZhudaGltfTextureSource } from '../packages/core/runtime3d/GltfIntake.ts';
import {
  inspectGltfAsset,
  gltfAssetCapabilities,
  gltfExtensionCapabilities,
} from '../packages/core/runtime3d/ModelCompatibility.ts';
import { prepareLaya342GltfResource } from '../packages/core/runtime3d/Laya342GltfAdapter.ts';
import { ZhudaBasisTranscoder } from '../packages/core/runtime3d/BasisTexture.ts';
import { loadBasisFactory, makeUastcKtx2 } from './helpers/ktx2-fixture.mjs';
import { picturePlane } from './fixtures/gltf-intake.mjs';

const { factory, wasm } = await loadBasisFactory(
  path.resolve(import.meta.dirname, '../vendor/basis'),
);
const transcoder = await ZhudaBasisTranscoder.create({ factory, wasm });
const ktx2 = makeUastcKtx2({ width: 16, height: 16 }).file;
// A PNG is not needed to inspect a file: any bytes stand for the fallback picture.
const fallbackBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const only = picturePlane({
  images: [['image/ktx2', ktx2]],
  texture: { extensions: { KHR_texture_basisu: { source: 0 } } },
  extension: 'KHR_texture_basisu',
  required: true,
});
const withFallback = picturePlane({
  images: [
    ['image/ktx2', ktx2],
    ['image/png', fallbackBytes],
  ],
  texture: { source: 1, extensions: { KHR_texture_basisu: { source: 0 } } },
  extension: 'KHR_texture_basisu',
});
const buffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test('a texture loads its KTX 2 image when a transcoder is at hand', () => {
  const texture = {
    source: 3,
    extensions: {
      KHR_texture_basisu: { source: 0 },
      EXT_texture_avif: { source: 1 },
      EXT_texture_webp: { source: 2 },
    },
  };
  const all = { webp: true, avif: true, basis: true };
  assert.deepEqual(resolveZhudaGltfTextureSource(texture, all), {
    image: 0,
    extension: 'KHR_texture_basisu',
    unavailable: [],
  });
  // Without a transcoder the next best the device decodes, and the KTX 2 image is named.
  assert.deepEqual(resolveZhudaGltfTextureSource(texture, { ...all, basis: false }), {
    image: 1,
    extension: 'EXT_texture_avif',
    unavailable: ['KHR_texture_basisu'],
  });
  assert.deepEqual(resolveZhudaGltfTextureSource(texture, { webp: false, avif: false }), {
    image: 3,
    extension: null,
    unavailable: ['KHR_texture_basisu', 'EXT_texture_avif', 'EXT_texture_webp'],
  });
  // Nothing known of the device: the core source when there is one, else the KTX 2 image.
  assert.equal(resolveZhudaGltfTextureSource(texture).image, 3);
  assert.deepEqual(
    resolveZhudaGltfTextureSource({ extensions: { KHR_texture_basisu: { source: 0 } } }),
    { image: 0, extension: 'KHR_texture_basisu', unavailable: [] },
  );
});

test('the report says what a KTX 2 texture will do', () => {
  assert.equal(
    gltfAssetCapabilities.find((c) => c.name === 'KHR_texture_basisu').status,
    'supported',
  );
  assert.equal(
    gltfExtensionCapabilities.find((c) => c.name === 'KHR_texture_basisu').implementation,
    'engine',
  );
  const codes = (report) => report.diagnostics.map((d) => `${d.severity}:${d.code}`);

  // With a transcoder: nothing to say, required or not.
  const ready = { webp: false, avif: false, basis: true };
  for (const file of [only, withFallback]) {
    const report = inspectGltfAsset(buffer(file), { imageDecode: ready });
    assert.notEqual(report.status, 'unsupported');
    assert.deepEqual(
      codes(report).filter((c) => /IMAGE|BASIS/.test(c)),
      [],
    );
    assert.equal(report.inventory.textures[0].basisu, 0);
  }
  // Without one and without a fallback: refused, with the reason and the way out.
  const none = { webp: false, avif: false, basis: false };
  const refused = inspectGltfAsset(buffer(only), { imageDecode: none });
  assert.equal(refused.status, 'unsupported');
  const missing = refused.diagnostics.find((d) => d.code === 'BASIS_TRANSCODER_MISSING');
  assert.deepEqual(
    [missing.severity, missing.extension, missing.path],
    ['error', 'KHR_texture_basisu', '$.textures[0]'],
  );
  assert.match(missing.message, /No Basis transcoder was given.*no fallback source/);
  assert.match(missing.hint, /basisTranscoder/);
  // With a fallback: the fallback loads and the report says the KTX 2 image is not used.
  const degraded = inspectGltfAsset(buffer(withFallback), { imageDecode: none });
  assert.notEqual(degraded.status, 'unsupported');
  const warning = degraded.diagnostics.find((d) => d.code === 'BASIS_TRANSCODER_MISSING');
  assert.equal(warning.severity, 'warning');
  assert.match(warning.message, /the fallback image 1 loads/);
  // Inspected without an answer: said to be unchecked, as for WebP and AVIF.
  assert.ok(codes(inspectGltfAsset(buffer(only))).includes('warning:IMAGE_DECODE_UNCHECKED'));
});

/** A LayaAir stand-in with what the adapter and `createZhudaBasisTexture` touch. */
function fakeRuntime(have = [17]) {
  const made = [];
  class Texture2D {
    constructor(kind, construct) {
      this.kind = kind;
      this.construct = construct;
      made.push(this);
    }
    setProperties(properties) {
      this.properties = properties;
    }
    static _parseKTX(bytes, properties, construct) {
      return new Texture2D('ktx', construct);
    }
    static _parseDDS(bytes, properties, construct) {
      return new Texture2D('dds', construct);
    }
  }
  const loads = [];
  return {
    made,
    loads,
    runtime: {
      Texture2D,
      TextureFormat: { R8G8B8A8: 1 },
      RenderCapable: {
        COMPRESS_TEXTURE_ASTC: 17,
        COMPRESS_TEXTURE_ETC: 16,
        COMPRESS_TEXTURE_S3TC: 12,
        COMPRESS_TEXTURE_S3TC_SRGB: 13,
      },
      LayaGL: { renderEngine: { getCapable: (id) => have.includes(id) } },
      Loader: { TEXTURE2D: 'TEXTURE2D' },
      loader: {
        load: async (request) => {
          loads.push(request);
          return { from: 'loader' };
        },
      },
    },
  };
}
const fakeResource = () => ({
  loadTextureFromBuffer() {
    throw Error("LayaAir's own loader was reached");
  },
});

test('an embedded KTX 2 image becomes one compressed texture', async (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(String(message)));
  const { runtime, made, loads } = fakeRuntime();
  const resource = fakeResource();
  prepareLaya342GltfResource(resource, runtime, { basis: transcoder });
  let progress = 0;
  const callbacks = { createCallback: () => (value) => (progress += value) };
  const sampler = { wrapModeU: 1, filterMode: 0 };
  // A colour slot: LayaAir's construct parameters say sRGB at index 5.
  const colour = await resource.loadTextureFromBuffer(
    ktx2,
    'image/ktx2',
    [0, 0, 0, true, false, true],
    sampler,
    callbacks,
  );
  assert.equal(colour.kind, 'ktx');
  assert.equal(colour.zhudaBasis.target, 'astc-4x4');
  assert.equal(colour.construct[5], true, 'read as sRGB');
  assert.deepEqual(colour.properties, sampler, "the texture's sampler is applied");
  assert.equal(progress, 1);
  assert.equal(loads.length, 0, "the browser's image loader is not asked");
  // The same bytes for another slot: the same texture, as LayaAir's own cache gives.
  const again = await resource.loadTextureFromBuffer(
    ktx2,
    'image/ktx2',
    [0, 0, 0, true, false, true],
    sampler,
  );
  assert.equal(again, colour);
  assert.equal(made.length, 1);
  // Recognised by its bytes when the file gives no MIME type; a data slot is read as it is.
  const other = makeUastcKtx2({ width: 8, height: 8, srgb: false }).file;
  const data = await resource.loadTextureFromBuffer(
    other.buffer,
    '',
    [0, 0, 0, true, false, false],
    null,
  );
  assert.equal(data.construct[5], false);
  // Another picture format still goes to LayaAir's loader.
  await resource.loadTextureFromBuffer(new Uint8Array([1, 2, 3]), 'image/png', null, null);
  assert.equal(loads.length, 1);
  assert.deepEqual(warnings, []);

  // No transcoder, or bytes the transcoder refuses: an empty slot and a warning, not a throw.
  const bare = fakeResource();
  prepareLaya342GltfResource(bare, fakeRuntime().runtime, {});
  assert.equal(await bare.loadTextureFromBuffer(ktx2, 'image/ktx2', null, null), null);
  assert.match(warnings.at(-1), /KTX 2 image did not load: no Basis transcoder was given/);
  const cut = fakeResource();
  prepareLaya342GltfResource(cut, fakeRuntime().runtime, { basis: transcoder });
  assert.equal(
    await cut.loadTextureFromBuffer(ktx2.subarray(0, 200), 'image/ktx2', null, null),
    null,
  );
  assert.match(warnings.at(-1), /KTX 2 image did not load: Invalid KTX 2 texture/);
});
