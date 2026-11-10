import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AssetProviderError,
  DirectoryAssetProvider,
  ChunkedAssetProvider,
  createProviderAssetCache,
  normalizeAssetId,
  validateAssetManifest,
} from '../packages/core/runtime3d/index.ts';

test('asset IDs are portable logical paths', () => {
  assert.equal(normalizeAssetId(' ./vehicles\\s800.glb '), 'vehicles/s800.glb');
  assert.throws(
    () => normalizeAssetId('../secret.dat'),
    (error) => error.code === 'invalid-id',
  );
  assert.throws(
    () => normalizeAssetId('https://cdn.example/game.dat'),
    (error) => error.code === 'invalid-id',
  );
  assert.throws(
    () => normalizeAssetId('ui/title.txt?cache=1'),
    (error) => error.code === 'invalid-id',
  );
  assert.throws(
    () =>
      validateAssetManifest({
        schemaVersion: 1,
        entries: [{ id: 'ui/title.txt' }, { id: 'ui/title.txt' }],
      }),
    /Duplicate/,
  );
});

test('directory provider reports progress and verifies a manifest', async () => {
  const source = new TextEncoder().encode('hello asset');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', source))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const progress = [];
  const provider = new DirectoryAssetProvider({
    baseUrl: 'https://example.test/assets/',
    manifest: {
      schemaVersion: 1,
      entries: [{ id: 'ui/title.txt', kind: 'text', bytes: source.byteLength, sha256: digest }],
    },
    fetch: async (url, options) => {
      assert.equal(String(url), 'https://example.test/assets/ui/title.txt');
      assert.ok(options.signal);
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(source.slice(0, 5));
            controller.enqueue(source.slice(5));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-length': String(source.byteLength) } },
      );
    },
  });
  const result = await provider.load('./ui\\title.txt', {
    onProgress: (value) => progress.push(value),
  });
  assert.equal(new TextDecoder().decode(result.bytes), 'hello asset');
  assert.equal(result.manifest?.kind, 'text');
  assert.equal(progress.at(0).phase, 'downloading');
  assert.equal(progress.at(-1).phase, 'ready');
  provider.dispose();
  await assert.rejects(provider.load('ui/title.txt'), (error) => error.code === 'disposed');
});

test('directory provider lazily loads and applies a remote manifest', async () => {
  const source = new TextEncoder().encode('packed later');
  let manifestLoads = 0;
  const provider = new DirectoryAssetProvider({
    baseUrl: 'https://example.test/assets/',
    manifestUrl: 'manifest.json',
    fetch: async (url) => {
      if (String(url).endsWith('/manifest.json')) {
        manifestLoads++;
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            entries: [{ id: 'ui/title.txt', kind: 'text', bytes: source.byteLength }],
          }),
          { status: 200 },
        );
      }
      return new Response(source, { status: 200 });
    },
  });
  const result = await provider.load('ui/title.txt');
  assert.equal(result.manifest?.kind, 'text');
  assert.equal(manifestLoads, 1);
});

test('directory provider rejects oversized responses and aborts stalled requests', async () => {
  const provider = new DirectoryAssetProvider({
    baseUrl: 'https://example.test/assets/',
    maxBytes: 4,
    timeoutMs: 15,
    fetch: async (_url, { signal }) => {
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      throw new Error('unreachable');
    },
  });
  await assert.rejects(provider.load('large.bin'), (error) => error.code === 'timeout');
  const oversized = new DirectoryAssetProvider({
    baseUrl: 'https://example.test/assets/',
    maxBytes: 4,
    fetch: async () => new Response(new Uint8Array(5), { status: 200 }),
  });
  await assert.rejects(oversized.load('large.bin'), (error) => error.code === 'too-large');
});

test('provider cache releases packed decoder leases after decoding', async () => {
  let released = 0;
  const cache = createProviderAssetCache(
    {
      name: 'fixture-packed',
      load: async (id) => ({ id, bytes: new Uint8Array([7]), release: () => released++ }),
    },
    (asset) => asset.bytes[0],
    () => {},
  );
  const lease = await cache.acquire('effects/coin.bin');
  assert.equal(lease.value, 7);
  assert.equal(released, 1);
  lease.release();
  cache.dispose();
});

test('chunked provider verifies bounded chunks, ranges and lifecycle', async () => {
  const source = new TextEncoder().encode('prefix-heavy-scene-suffix');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', source.slice(7, 18)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  let loads = 0;
  const provider = new ChunkedAssetProvider({
    baseUrl: 'https://example.test/assets/',
    manifest: {
      schemaVersion: 1,
      chunks: [{ id: 'scene-1', url: 'chunks/scene-1.bin', bytes: source.byteLength }],
      assets: [
        {
          id: 'scene/model.bin',
          kind: 'model',
          chunk: 'scene-1',
          offset: 7,
          length: 11,
          bytes: 11,
          sha256: digest,
        },
      ],
    },
    fetch: async (url) => {
      loads++;
      assert.equal(String(url), 'https://example.test/assets/chunks/scene-1.bin');
      return new Response(source, {
        status: 200,
        headers: { 'content-length': String(source.byteLength) },
      });
    },
  });
  const progress = [];
  const result = await provider.load('scene/model.bin', {
    onProgress: (value) => progress.push(value),
  });
  assert.equal(new TextDecoder().decode(result.bytes), 'heavy-scene');
  assert.equal(loads, 1);
  assert.equal(progress.at(-1).phase, 'ready');
  const cached = await provider.load('scene/model.bin');
  assert.equal(new TextDecoder().decode(cached.bytes), 'heavy-scene');
  assert.equal(loads, 1);
  provider.dispose();
  await assert.rejects(provider.load('scene/model.bin'), (error) => error.code === 'disposed');
});

test('chunked provider rejects malformed ranges and checksum failures', async () => {
  assert.throws(
    () =>
      new ChunkedAssetProvider({
        baseUrl: 'https://example.test/',
        manifest: {
          schemaVersion: 1,
          chunks: [{ id: 'x', url: 'x' }],
          assets: [{ id: 'a', chunk: 'x', offset: 0, length: 2, bytes: 3 }],
        },
        fetch: async () => new Response(new Uint8Array([1, 2])),
      }),
    /range mismatch/,
  );
  const provider = new ChunkedAssetProvider({
    baseUrl: 'https://example.test/',
    manifest: {
      schemaVersion: 1,
      chunks: [{ id: 'x', url: 'x' }],
      assets: [{ id: 'a', chunk: 'x', offset: 0, length: 2, sha256: '00'.repeat(32) }],
    },
    fetch: async () => new Response(new Uint8Array([1, 2])),
  });
  await assert.rejects(provider.load('a'), (error) => error.code === 'integrity');
  provider.dispose();
});

const chunkManifest = {
  schemaVersion: 1,
  chunks: [{ id: 'c', url: 'chunks/c', bytes: 3 }],
  assets: [{ id: 'a', chunk: 'c', offset: 0, length: 3 }],
};
test('chunk requests share existing cache with isolated cancellation and immutable manifest', async () => {
  let done,
    loads = 0;
  const manifest = structuredClone(chunkManifest),
    abort = new AbortController();
  const p = new ChunkedAssetProvider({
    baseUrl: 'https://example.test/assets',
    manifest,
    fetch: async () => {
      loads++;
      return new Promise(
        (resolve) => (done = () => resolve(new Response(new Uint8Array([1, 2, 3])))),
      );
    },
  });
  manifest.assets[0].offset = 2;
  manifest.chunks[0].url = '../escape';
  const first = p.load('a', { signal: abort.signal }),
    second = p.load('a');
  abort.abort();
  await assert.rejects(first, (e) => e.code === 'aborted');
  done();
  assert.deepEqual((await second).bytes, new Uint8Array([1, 2, 3]));
  assert.equal(loads, 1);
  for (let i = 0; i < 30; i++) {
    const a = await p.load('a');
    a.bytes[0] = 9;
    assert.equal((await p.load('a')).bytes[0], 1);
  }
  p.dispose();
  await assert.rejects(p.getManifest(), (e) => e.code === 'disposed');
});
test('chunk deadline/disposal settles ignoring fetch and never accepts a late result', async () => {
  let finish,
    cancelled = 0;
  const p = new ChunkedAssetProvider({
    baseUrl: 'https://example.test/assets/',
    manifest: chunkManifest,
    timeoutMs: 10,
    fetch: () =>
      new Promise(
        (resolve) =>
          (finish = () =>
            resolve(
              new Response(
                new ReadableStream({
                  cancel() {
                    cancelled++;
                  },
                }),
              ),
            )),
      ),
  });
  await assert.rejects(p.load('a'), (e) => e.code === 'timeout');
  p.dispose();
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, 1);
  let finish2;
  const p2 = new ChunkedAssetProvider({
    baseUrl: 'https://example.test/assets/',
    manifest: chunkManifest,
    fetch: () => new Promise((resolve) => (finish2 = resolve)),
  });
  const pending = p2.load('a');
  p2.dispose();
  await assert.rejects(pending, (e) => e.code === 'disposed');
  finish2(new Response(new Uint8Array([1, 2, 3])));
});
test('chunk read bounds work without content-length and reject ranges before IO', async () => {
  let cancelled = 0,
    calls = 0;
  const p = new ChunkedAssetProvider({
    baseUrl: 'https://example.test/assets/',
    manifest: chunkManifest,
    maxChunkBytes: 3,
    fetch: async () => {
      calls++;
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array(4));
          },
          cancel() {
            cancelled++;
          },
        }),
      );
    },
  });
  await assert.rejects(p.load('a', { maxBytes: 2 }), (e) => e.code === 'too-large');
  assert.equal(calls, 0);
  await assert.rejects(p.load('a'), (e) => e.code === 'too-large');
  assert.equal(cancelled, 1);
  p.dispose();
  assert.throws(
    () =>
      new ChunkedAssetProvider({
        baseUrl: 'https://example.test/assets',
        manifest: { ...chunkManifest, chunks: [{ id: 'c', url: '../assets-evil/c' }] },
      }),
    /escapes/,
  );
  assert.throws(
    () =>
      new ChunkedAssetProvider({
        baseUrl: 'https://example.test/',
        manifest: { ...chunkManifest, assets: [{ ...chunkManifest.assets[0], sha256: 'bad' }] },
      }),
    /checksum/,
  );
});
