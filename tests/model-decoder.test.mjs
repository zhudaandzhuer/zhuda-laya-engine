import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaModelDecoderRegistry } from '../packages/core/runtime3d/index.ts';

const descriptor = {
  format: 'meshopt',
  name: 'fixture-meshopt',
  version: '1.0.0',
  integritySha256: 'ab'.repeat(32),
};

test('decoder registry pins adapters and releases payloads exactly once', async () => {
  let released = 0;
  let disposed = 0;
  const registry = new ZhudaModelDecoderRegistry({ timeoutMs: 50, maxInputBytes: 4 });
  const unregister = registry.register({
    descriptor,
    async decode({ assetId }) {
      return {
        assetId,
        format: 'meshopt',
        data: new Uint8Array([1, 2]),
        byteLength: 2,
        release: () => released++,
      };
    },
    dispose: () => disposed++,
  });
  assert.equal(registry.has('meshopt'), true);
  const payload = await registry.decode('meshopt', 'scene/model.glb', new Uint8Array([1, 2]));
  payload.release();
  payload.release();
  assert.equal(released, 1);
  unregister();
  assert.equal(disposed, 1);
  assert.equal(registry.has('meshopt'), false);
  registry.dispose();
});

test('decoder registry bounds input and rejects unregistered formats', async () => {
  const registry = new ZhudaModelDecoderRegistry({ maxInputBytes: 2 });
  await assert.rejects(
    registry.decode('draco', 'model.glb', new Uint8Array([1])),
    (error) => error.code === 'unsupported',
  );
  assert.throws(
    () =>
      registry.register({
        descriptor: { ...descriptor, integritySha256: 'bad' },
        decode: async () => {
          throw Error('unreachable');
        },
      }),
    (error) => error.code === 'invalid-adapter',
  );
  registry.register({
    descriptor,
    decode: async ({ assetId }) => ({
      assetId,
      format: 'meshopt',
      data: null,
      byteLength: 0,
      release() {},
    }),
  });
  await assert.rejects(
    registry.decode('meshopt', 'large', new Uint8Array([1, 2, 3])),
    (error) => error.code === 'invalid-input',
  );
  registry.dispose();
});

test('decoder registry releases a late result after timeout and reports cancellation', async () => {
  let released = 0;
  const registry = new ZhudaModelDecoderRegistry({ timeoutMs: 10 });
  registry.register({
    descriptor,
    decode: async ({ signal, assetId }) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(signal.aborted, true);
      return {
        assetId,
        format: 'meshopt',
        data: new Uint8Array(),
        byteLength: 0,
        release: () => released++,
      };
    },
  });
  await assert.rejects(
    registry.decode('meshopt', 'late', new Uint8Array()),
    (error) => error.code === 'timeout',
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(released, 1);
  registry.dispose();
});

test('decoder deadline settles before an uncooperative result, retirement releases once', async () => {
  let finish,
    releases = 0,
    disposed = 0;
  const registry = new ZhudaModelDecoderRegistry({ timeoutMs: 10 });
  const unregister = registry.register({
    descriptor,
    decode: ({ assetId }) =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            assetId,
            format: 'meshopt',
            data: null,
            byteLength: 0,
            release() {
              releases++;
            },
          });
      }),
    dispose() {
      disposed++;
    },
  });
  const pending = registry.decode('meshopt', 'late', new Uint8Array());
  await assert.rejects(pending, (error) => error.code === 'timeout');
  registry.dispose();
  unregister();
  assert.equal(disposed, 0);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(releases, 1);
  assert.equal(disposed, 1);
});

test('decoder preserves live leases through unregister and disposes invalid results', async () => {
  let released = 0,
    disposed = 0;
  const registry = new ZhudaModelDecoderRegistry();
  const unregister = registry.register({
    descriptor,
    async decode({ assetId }) {
      return {
        assetId,
        format: 'meshopt',
        data: null,
        byteLength: 1,
        release() {
          released++;
        },
      };
    },
    dispose() {
      disposed++;
    },
  });
  for (let i = 0; i < 30; i++) {
    const value = await registry.decode('meshopt', 'a', new Uint8Array());
    value.release();
    value.release();
  }
  const value = await registry.decode('meshopt', 'a', new Uint8Array());
  unregister();
  registry.dispose();
  assert.equal(disposed, 0);
  value.release();
  assert.equal(released, 31);
  assert.equal(disposed, 1);
  const invalid = new ZhudaModelDecoderRegistry();
  invalid.register({
    descriptor,
    async decode() {
      return {
        assetId: 'wrong',
        format: 'meshopt',
        data: null,
        byteLength: 0,
        release() {
          released++;
        },
      };
    },
  });
  await assert.rejects(
    invalid.decode('meshopt', 'a', new Uint8Array()),
    (error) => error.code === 'invalid-output',
  );
  assert.equal(released, 32);
  invalid.dispose();
});

test('decoder cancellation isolates requests and snapshots caller bytes', async () => {
  const registry = new ZhudaModelDecoderRegistry();
  const controller = new AbortController();
  let finish;
  registry.register({
    descriptor,
    decode: ({ assetId, bytes }) =>
      assetId === 'cancel'
        ? new Promise((resolve) => {
            finish = () =>
              resolve({ assetId, format: 'meshopt', data: bytes[0], byteLength: 1, release() {} });
          })
        : Promise.resolve({
            assetId,
            format: 'meshopt',
            data: bytes[0],
            byteLength: 1,
            release() {},
          }),
  });
  const input = new Uint8Array([7]);
  const pending = registry.decode('meshopt', 'cancel', input, { signal: controller.signal });
  input[0] = 9;
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, (e) => e.code === 'aborted');
  finish();
  const ok = await registry.decode('meshopt', 'ok', new Uint8Array([3]));
  assert.equal(ok.data, 3);
  ok.release();
  registry.dispose();
  for (const bad of [NaN, -1, 0, Infinity])
    await assert.rejects(
      new ZhudaModelDecoderRegistry().decode('meshopt', 'a', input, { maxInputBytes: bad }),
      (e) => e.code === 'invalid-input',
    );
});

test('MCP exposes actual model capabilities and rejects invalid timeline configuration', async () => {
  const { executeMcpTool } = await import('../packages/mcp-server/index.mjs');
  const capabilities = executeMcpTool('get_model_capabilities');
  assert.equal(
    capabilities.assets.find((a) => a.name === 'EXT_meshopt_compression').status,
    'adapter-required',
  );
  assert.equal(
    capabilities.assets.find((a) => a.name === 'KHR_texture_basisu').status,
    'unsupported',
  );
  const rejected = executeMcpTool('validate_timeline_spec', { timeline: { tracks: {} } });
  assert.equal(rejected.passed, false);
  assert.equal(rejected.rendering, 'requires-real-draw');
});
