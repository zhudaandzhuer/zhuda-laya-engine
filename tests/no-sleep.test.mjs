import test from 'node:test';
import assert from 'node:assert/strict';
import { NoSleepAdapter } from '../packages/core/NoSleepAdapter.ts';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((candidate) => candidate !== listener),
    );
  }
  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener({ type, ...event });
  }
}

class FakeSentinel extends FakeEventTarget {
  constructor() {
    super();
    this.released = false;
    this.releaseCount = 0;
    this.rejectRelease = false;
  }
  release() {
    this.releaseCount++;
    this.released = true;
    if (this.rejectRelease) return Promise.reject(new Error('release failed'));
    return Promise.resolve();
  }
  externalRelease() {
    this.released = true;
    this.dispatch('release');
  }
}

function installFakeDom() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  const fakeWindow = Object.assign(windowTarget, { self: windowTarget, top: windowTarget });
  const fakeDocument = Object.assign(documentTarget, { visibilityState: 'visible' });
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  return {
    window: fakeWindow,
    document: fakeDocument,
    restore() {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    },
  };
}

function deferredProvider() {
  const requests = [];
  return {
    requests,
    provider: {
      request() {
        return new Promise((resolve, reject) => requests.push({ resolve, reject }));
      },
    },
  };
}

test('NoSleepAdapter acquires, releases and reports the native sentinel', async () => {
  const sentinel = new FakeSentinel();
  let calls = 0;
  const adapter = new NoSleepAdapter({
    autoEnableOnGesture: false,
    wakeLockProvider: () => ({
      request(type) {
        assert.equal(type, 'screen');
        calls++;
        return Promise.resolve(sentinel);
      },
    }),
  });
  assert.equal(await adapter.enable(), true);
  assert.equal(adapter.isEnabled(), true);
  assert.equal(calls, 1);
  assert.equal(adapter.getDiagnostics().state, 'enabled');
  adapter.disable();
  assert.equal(adapter.isEnabled(), false);
  assert.equal(sentinel.releaseCount, 1);
  assert.equal(adapter.getDiagnostics().releaseCount, 1);
  adapter.dispose();
});

test('NoSleepAdapter handles unsupported and denied providers without claiming a lock', async () => {
  const unsupported = new NoSleepAdapter({
    autoEnableOnGesture: false,
    wakeLockProvider: () => null,
  });
  assert.equal(await unsupported.enable(), false);
  assert.equal(unsupported.isEnabled(), false);
  assert.equal(unsupported.getDiagnostics().state, 'unsupported');
  assert.equal(unsupported.getDiagnostics().supported, false);
  unsupported.dispose();

  const denied = new NoSleepAdapter({
    autoEnableOnGesture: false,
    wakeLockProvider: () => ({
      request() {
        const error = new Error('permission denied');
        error.name = 'NotAllowedError';
        return Promise.reject(error);
      },
    }),
  });
  assert.equal(await denied.enable(), false);
  assert.equal(denied.getDiagnostics().state, 'denied');
  assert.match(denied.getDiagnostics().lastError, /permission denied/);
  denied.dispose();
});

test('visibility and blur release then reacquire an enabled owner', async () => {
  const dom = installFakeDom();
  try {
    const first = new FakeSentinel();
    const second = new FakeSentinel();
    const sentinels = [first, second];
    const adapter = new NoSleepAdapter({
      autoEnableOnGesture: false,
      wakeLockProvider: () => ({ request: () => Promise.resolve(sentinels.shift()) }),
    });
    assert.equal(await adapter.enable(), true);
    dom.document.visibilityState = 'hidden';
    dom.document.dispatch('visibilitychange');
    assert.equal(adapter.getDiagnostics().state, 'suspended');
    assert.equal(adapter.isEnabled(), false);
    assert.equal(first.releaseCount, 1);

    dom.document.visibilityState = 'visible';
    dom.document.dispatch('visibilitychange');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(adapter.isEnabled(), true);
    assert.equal(adapter.getDiagnostics().requestCount, 2);
    adapter.dispose();
  } finally {
    dom.restore();
  }
});

test('stale request results are released after disable and gesture auto-enable is explicit', async () => {
  const dom = installFakeDom();
  try {
    const deferred = deferredProvider();
    const adapter = new NoSleepAdapter({
      autoEnableOnGesture: false,
      wakeLockProvider: () => deferred.provider,
    });
    const pending = adapter.enable();
    assert.equal(adapter.getDiagnostics().state, 'requesting');
    adapter.disable();
    const stale = new FakeSentinel();
    deferred.requests[0].resolve(stale);
    assert.equal(await pending, false);
    assert.equal(stale.releaseCount, 1);
    assert.equal(adapter.getDiagnostics().staleRequestCount, 1);
    adapter.dispose();

    const gestureSentinel = new FakeSentinel();
    const gestureAdapter = new NoSleepAdapter({
      wakeLockProvider: () => ({ request: () => Promise.resolve(gestureSentinel) }),
    });
    dom.window.dispatch('pointerdown');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(gestureAdapter.isEnabled(), true);
    gestureAdapter.dispose();
  } finally {
    dom.restore();
  }
});

test('sentinel release events reacquire while the owner remains visible and enabled', async () => {
  const first = new FakeSentinel();
  const sentinels = [first, new FakeSentinel()];
  const adapter = new NoSleepAdapter({
    autoEnableOnGesture: false,
    wakeLockProvider: () => ({ request: () => Promise.resolve(sentinels.shift()) }),
  });
  assert.equal(await adapter.enable(), true);
  first.externalRelease();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(adapter.getDiagnostics().requestCount, 2);
  assert.equal(adapter.isEnabled(), true);
  adapter.dispose();
});

test('sentinel release failures are reported without an unhandled rejection', async () => {
  const sentinel = new FakeSentinel();
  sentinel.rejectRelease = true;
  const adapter = new NoSleepAdapter({
    autoEnableOnGesture: false,
    wakeLockProvider: () => ({ request: () => Promise.resolve(sentinel) }),
  });
  assert.equal(await adapter.enable(), true);
  adapter.disable();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(adapter.getDiagnostics().lastError, /release failed/);
  adapter.dispose();
});
