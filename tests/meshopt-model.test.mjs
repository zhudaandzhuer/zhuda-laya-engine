import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  ZhudaMeshoptModelDecoder,
  ZhudaModelDecoderRegistry,
  inspectGltfAsset,
} from '../packages/core/runtime3d/index.ts';
import { readGltfAssetDocument } from '../packages/core/runtime3d/ModelCompatibility.ts';
import { compressFixture, embeddedGlb } from './fixtures/meshopt.mjs';
const source = JSON.parse(
  fs.readFileSync(new URL('./fixtures/gltf-review/node-weights.gltf', import.meta.url)),
);
const compressed = await compressFixture(source),
  encoded = (d) => new TextEncoder().encode(JSON.stringify(d));
const registry = () => {
  const r = new ZhudaModelDecoderRegistry();
  r.register(new ZhudaMeshoptModelDecoder());
  return r;
};
test('pinned Meshopt decoder restores real attribute/index/morph bytes for JSON and GLB', async () => {
  const r = registry();
  for (const bytes of [encoded(compressed), embeddedGlb(compressed)]) {
    const decoded = await r.decode('meshopt', 'model.glb', bytes),
      data = decoded.data;
    assert.equal(inspectGltfAsset(data).status, 'supported');
    const d = readGltfAssetDocument(data).document,
      jsonLength = new DataView(data.buffer).getUint32(12, true),
      bin = data.subarray(28 + jsonLength),
      original = Buffer.from(source.buffers[0].uri.split(',')[1], 'base64');
    for (let i = 0; i < source.bufferViews.length; i++) {
      const a = source.bufferViews[i],
        b = d.bufferViews[i];
      assert.deepEqual(
        [...bin.subarray(b.byteOffset, b.byteOffset + b.byteLength)],
        [...original.subarray(a.byteOffset, a.byteOffset + a.byteLength)],
      );
    }
    assert.deepEqual(d.nodes, source.nodes);
    assert.deepEqual(d.meshes, source.meshes);
    decoded.release();
  }
  const decoder = new ZhudaMeshoptModelDecoder();
  const sha = crypto
    .createHash('sha256')
    .update(
      fs.readFileSync(
        new URL('../node_modules/meshoptimizer/meshopt_decoder.mjs', import.meta.url),
      ),
    )
    .digest('hex');
  assert.equal(sha, decoder.descriptor.integritySha256);
  r.dispose();
});
test('Meshopt rejects corrupt streams, oversized decode and malformed layouts before native allocation', async () => {
  const r = registry();
  for (const mutate of [
    (d) => (d.bufferViews[0].extensions.EXT_meshopt_compression.byteStride = 3),
    (d) => (d.bufferViews[0].extensions.EXT_meshopt_compression.byteOffset = 999999),
    (d) => (d.buffers[0].uri = 'https://example.test/not-allowed'),
    (d) => d.extensionsRequired.push('UNKNOWN_required'),
  ]) {
    const d = structuredClone(compressed);
    mutate(d);
    await assert.rejects(r.decode('meshopt', 'bad.glb', encoded(d)));
  }
  const corrupt = structuredClone(compressed);
  corrupt.buffers[0].uri =
    'data:application/octet-stream;base64,' +
    Buffer.alloc(Buffer.from(compressed.buffers[0].uri.split(',')[1], 'base64').length).toString(
      'base64',
    );
  await assert.rejects(r.decode('meshopt', 'bad.glb', encoded(corrupt)));
  await assert.rejects(
    r.decode('meshopt', 'too-big.glb', encoded(compressed), { maxOutputBytes: 32 }),
    /budget|oversized/,
  );
  r.dispose();
});
test('Meshopt leases release over 30 decode cycles and cancelled requests do not decode', async () => {
  const r = registry();
  for (let i = 0; i < 30; i++) {
    const p = await r.decode('meshopt', 'model.glb', embeddedGlb(compressed));
    assert.ok(p.byteLength > 0);
    p.release();
  }
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    r.decode('meshopt', 'model.glb', embeddedGlb(compressed), { signal: c.signal }),
    (e) => e.code === 'aborted',
  );
  r.dispose();
});
