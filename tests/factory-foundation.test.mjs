import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ZhudaThemeAssetProvider,
  ZhudaThemeController,
  validateThemeManifest,
} from '../packages/core/runtime3d/Themes.ts';
import { ZhudaResultPlayback } from '../packages/core/runtime3d/ResultPlayback.ts';
const bytes = new TextEncoder().encode('theme fixture'),
  sha256 = createHash('sha256').update(bytes).digest('hex');
const contract = {
  id: 'grid-v1',
  required: [{ id: 'symbol', kind: 'image' }],
  maxDownloadBytes: 100,
  maxEstimatedDecodedBytes: 1000,
};
const theme = (id = 'a') => ({
  schemaVersion: 1,
  id,
  revision: 'r1',
  contractId: 'grid-v1',
  estimatedDecodedBytes: 64,
  assets: [
    { id: 'symbol', source: id + '/symbol.png', kind: 'image', bytes: bytes.length, sha256 },
  ],
});
const tick = () => new Promise((r) => setTimeout(r, 5));
const scope = { gameId: 'fixture', sessionId: 'session1', epoch: 'e1' };
const result = (sequence = 1, extra = {}) => ({
  schemaVersion: 1,
  ...scope,
  sequence,
  roundId: 'round' + sequence,
  resultVersion: 'v1',
  payload: { symbols: [1, 2, 3] },
  ...extra,
});
const store = () => {
  const values = new Map();
  return {
    read: (key) => values.get(key),
    write: (key, value) => values.set(key, structuredClone(value)),
    values,
  };
};
const player = (storage) =>
  new ZhudaResultPlayback({
    scope,
    store: storage,
    validate: (r) => {
      if (r.resultVersion !== 'v1' || r.payload.symbols.length !== 3)
        throw Error('Invalid result payload');
    },
    validateCursor: (_r, c, done) => {
      if (c > 3 || (done && c !== 3)) throw Error('Invalid cursor');
    },
  });

test('theme contract snapshots, integrity and logical IDs compose with borrowed provider', async () => {
  let released = 0,
    disposed = 0;
  const source = {
    name: 'fixture',
    load: async (id, options) => {
      assert.equal(id, 'a/symbol.png');
      options.onProgress?.({ id, phase: 'ready' });
      return { id, bytes, release: () => released++ };
    },
    dispose: () => disposed++,
  };
  const input = theme(),
    p = new ZhudaThemeAssetProvider(source, input, contract);
  input.assets[0].source = 'changed';
  const progress = [];
  const loaded = await p.load('symbol', { onProgress: (v) => progress.push(v.id) });
  assert.equal(loaded.id, 'symbol');
  assert.equal(loaded.manifest.sha256, sha256);
  assert.deepEqual(progress, ['symbol']);
  assert.notEqual(
    p.cacheKey('symbol'),
    new ZhudaThemeAssetProvider(source, theme('b'), contract).cacheKey('symbol'),
  );
  loaded.release();
  loaded.release();
  p.dispose();
  assert.equal(released, 1);
  assert.equal(disposed, 0);
  await assert.rejects(p.load('symbol'), /Disposed/);
  assert.throws(
    () => validateThemeManifest({ ...theme(), contractId: 'other' }, contract),
    /contract/,
  );
  assert.throws(() => validateThemeManifest({ ...theme(), assets: [] }, contract), /Missing/);
  assert.throws(
    () =>
      validateThemeManifest(
        { ...theme(), assets: [...theme().assets, ...theme().assets] },
        contract,
      ),
    /Duplicate/,
  );
  assert.throws(
    () => validateThemeManifest(theme(), { ...contract, maxDownloadBytes: 0 }),
    /budget/,
  );
  const corrupt = new ZhudaThemeAssetProvider(
    {
      name: 'bad',
      load: async () => ({
        id: 'x',
        bytes: new Uint8Array(bytes.length),
        release: () => released++,
      }),
    },
    theme(),
    contract,
  );
  await assert.rejects(corrupt.load('symbol'), /integrity/);
  assert.equal(released, 2);
  corrupt.dispose();
});

test('theme deadlines and disposal release non-cooperative late byte results', async () => {
  let finish,
    released = 0;
  const p = new ZhudaThemeAssetProvider(
    { name: 'late', load: () => new Promise((r) => (finish = r)) },
    theme(),
    contract,
    10,
  );
  await assert.rejects(p.load('symbol'), (e) => e.name === 'TimeoutError');
  finish({ id: 'x', bytes, release: () => released++ });
  await tick();
  assert.equal(released, 1);
  const waiting = p.load('symbol');
  await tick();
  p.dispose();
  await assert.rejects(waiting, /cancel/i);
  finish({ id: 'x', bytes, release: () => released++ });
  await tick();
  assert.equal(released, 2);
});

test('theme replacement preserves old on failure, discards stale and bounds transition ownership', async () => {
  const source = { name: 'fixture', load: async (id) => ({ id, bytes }) };
  let released = 0,
    late;
  const controller = new ZhudaThemeController(source, contract, 128);
  const prepare = async (p) => {
    const a = await p.load('symbol');
    return {
      value: p.manifest.id,
      dispose() {
        a.release();
        released++;
      },
    };
  };
  assert.equal(await controller.replace(theme(), prepare), true);
  await assert.rejects(
    controller.replace(theme('bad'), async () => {
      throw Error('Missing decoded animation');
    }),
    /animation/,
  );
  assert.equal(controller.current.value, 'a');
  await assert.rejects(
    controller.replace({ ...theme(), estimatedDecodedBytes: 65 }, prepare),
    /transition/,
  );
  const stale = controller.replace(theme('b'), () => new Promise((r) => (late = r)));
  await tick();
  assert.equal(await controller.replace(theme('c'), prepare), true);
  assert.equal(await stale, false);
  late({ value: 'b', dispose: () => released++ });
  await tick();
  assert.equal(controller.current.value, 'c');
  assert.equal(released, 2);
  for (let i = 0; i < 100; i++) await controller.replace(theme(i % 2 ? 'a' : 'b'), prepare);
  controller.dispose();
  assert.equal(released, 103);
  await assert.rejects(controller.replace(theme(), prepare), /Disposed/);
});

test('theme external abort and timeout leave active usable; late prepared owner is released', async () => {
  const controller = new ZhudaThemeController(
    { name: 'fixture', load: async (id) => ({ id, bytes }) },
    contract,
  );
  await controller.replace(theme(), async () => ({ value: 'a', dispose() {} }));
  let late,
    released = 0;
  await assert.rejects(
    controller.replace(theme('b'), () => new Promise((r) => (late = r)), { timeoutMs: 5 }),
    (e) => e.name === 'TimeoutError',
  );
  late({
    value: 'b',
    dispose() {
      released++;
    },
  });
  await tick();
  assert.equal(released, 1);
  assert.equal(controller.current.value, 'a');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    controller.replace(
      theme('c'),
      async () => {
        throw Error('must not start');
      },
      { signal: abort.signal },
    ),
    (e) => e.name === 'AbortError',
  );
  controller.dispose();
});

test('results require reconciliation, persist cursor across reload and reject gaps/conflicts', async () => {
  const storage = store(),
    p = player(storage);
  assert.equal(p.inputLocked, true);
  assert.throws(() => p.accept(result()), /locked/);
  await p.recover({ reconcile: async () => null });
  assert.equal(p.accept(result()), 'accepted');
  p.advance(1, 1);
  assert.equal(p.accept(result()), 'duplicate');
  assert.throws(() => p.accept(result(1, { payload: { symbols: [3, 2, 1] } })), /Conflicting/);
  assert.throws(() => p.accept(result(3)), /gap/);
  assert.throws(() => p.accept(result(2)), /incomplete/);
  p.dispose();
  const restored = player(storage);
  await restored.recover({ reconcile: async () => result() });
  assert.equal(restored.snapshot().cursor, 1);
  restored.advance(1, 3, true);
  assert.equal(restored.accept(result(2)), 'accepted');
  assert.equal(restored.accept(result()), 'stale');
  assert.throws(() => restored.advance(1, 2), /Stale/);
  assert.throws(() => restored.advance(2, 9), /cursor/);
  const copy = restored.snapshot();
  copy.result.payload.symbols[0] = 99;
  assert.equal(restored.snapshot().result.payload.symbols[0], 1);
  restored.suspend();
  assert.equal(restored.inputLocked, true);
  await restored.recover({ reconcile: async () => result(5) });
  assert.equal(restored.snapshot().cursor, 0);
  await assert.rejects(restored.recover({ reconcile: async () => result(4) }), /regressed/);
  assert.equal(restored.inputLocked, true);
  restored.dispose();
});

test('result write failure, malformed stored data, scope isolation, abort and stale reconcile', async () => {
  const storage = store(),
    p = player(storage);
  await p.recover({ reconcile: async () => null });
  const write = storage.write;
  storage.write = () => {
    throw Error('quota');
  };
  assert.throws(() => p.accept(result()), /quota/);
  assert.equal(p.snapshot().result, null);
  storage.write = write;
  assert.throws(() => p.accept(result(1, { sessionId: 'other' })), /scope/);
  assert.throws(() => p.accept(result(1, { payload: { symbols: [Infinity, 1, 2] } })), /finite/);
  let late;
  const waiting = p.recover({ reconcile: () => new Promise((r) => (late = r)) });
  const rejection = assert.rejects(waiting, (e) => e.name === 'AbortError');
  await tick();
  await p.recover({ reconcile: async () => result(2) });
  await rejection;
  late(result());
  await tick();
  assert.equal(p.snapshot().result.sequence, 2);
  await assert.rejects(
    p.recover({ reconcile: () => new Promise(() => {}) }, { timeoutMs: 5 }),
    (e) => e.name === 'TimeoutError',
  );
  assert.equal(p.inputLocked, true);
  const abort = new AbortController();
  const pending = p.recover({ reconcile: () => new Promise(() => {}) }, { signal: abort.signal });
  abort.abort();
  await assert.rejects(pending, (e) => e.name === 'AbortError');
  p.dispose();
  await assert.rejects(p.recover({ reconcile: async () => null }), /Disposed/);
  const key = [...storage.values.keys()][0];
  storage.values.get(key).cursor = -1;
  assert.throws(() => player(storage), /checkpoint/);
});

test('1000 deterministic result presentations retain one checkpoint and no TTL dependency', async () => {
  const storage = store(),
    p = player(storage);
  await p.recover({ reconcile: async () => null });
  for (let i = 1; i <= 1000; i++) {
    assert.equal(p.accept(result(i)), 'accepted');
    p.advance(i, 1);
    p.advance(i, 3, true);
    assert.equal(p.accept(result(i)), 'duplicate');
  }
  assert.equal(storage.values.size, 1);
  assert.equal(p.snapshot().result.sequence, 1000);
  assert.equal(p.snapshot().completed, true);
  p.dispose();
});

test('abort before IO starts does not call provider; retirement failures keep new owner valid', async () => {
  let loads = 0;
  const source = {
    name: 'fixture',
    load: async (id) => {
      loads++;
      return { id, bytes };
    },
  };
  const provider = new ZhudaThemeAssetProvider(source, theme(), contract),
    abort = new AbortController();
  const waiting = provider.load('symbol', { signal: abort.signal });
  abort.abort();
  await assert.rejects(waiting, (e) => e.name === 'AbortError');
  assert.equal(loads, 0);
  provider.dispose();
  const controller = new ZhudaThemeController(source, contract);
  let retired = 0;
  await controller.replace(theme(), async () => ({
    value: 'a',
    dispose() {
      throw Error('retirement error');
    },
  }));
  await assert.rejects(
    controller.replace(theme('b'), async () => ({
      value: 'b',
      dispose() {
        retired++;
      },
    })),
    /retirement error/,
  );
  assert.equal(controller.current.value, 'b');
  assert.equal(retired, 0);
  controller.dispose();
  assert.equal(retired, 1);
});
