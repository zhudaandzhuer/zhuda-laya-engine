// systems/minigame-host: the bridge reads `wx` when the module is first loaded, so each case
// loads its own copy (a query string makes a fresh module) with the host it wants in place.
import test from 'node:test';
import assert from 'node:assert/strict';

let copy = 0;
const load = (file) => import(`../systems/minigame-host/${file}?copy=${++copy}`);
const withGlobals = async (values, run) => {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(values)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  try {
    return await run();
  } finally {
    for (const [k, d] of Object.entries(saved)) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k];
  }
};

/** A WeChat mini-game host as far as the bridge touches it. */
function fakeWx(overrides = {}) {
  const store = new Map();
  const calls = [];
  const wx = {
    calls,
    store,
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, statusBarHeight: 44, safeArea: { left: 0, right: 375 } }),
    getMenuButtonBoundingClientRect: () => ({ left: 281, bottom: 80 }),
    getStorageSync: (k) => store.get(k) ?? '',
    setStorageSync: (k, v) => void store.set(k, v),
    vibrateShort: (o) => void calls.push(['vibrate', o.type]),
    loadSubpackage: (o) => (calls.push(['subpackage', o.name]), o.name === 'missing' ? o.fail({ errMsg: 'not found' }) : o.success()),
    showShareMenu: (o) => void calls.push(['shareMenu', o.menus.join()]),
    onShareAppMessage: (f) => void calls.push(['onShare', f().title]),
    shareAppMessage: (o) => void calls.push(['share', o.title]),
    onHide: (f) => void calls.push(['onHide', typeof f]),
    ...overrides,
  };
  return wx;
}

test('in a browser: numbers go to localStorage, host calls do nothing, a subpackage is already there', async () => {
  const items = new Map();
  const localStorage = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) };
  await withGlobals({ wx: undefined, localStorage }, async () => {
    const host = await load('host.ts');
    assert.equal(host.isWeChat, false);
    assert.equal(host.loadNumber('best', 7), 7);
    host.saveNumber('best', 42);
    assert.equal(items.get('best'), '42');
    assert.equal(host.loadNumber('best'), 42);
    items.set('bad', 'abc');
    assert.equal(host.loadNumber('bad', 3), 3);
    host.vibrate();
    host.enableShare(() => 'title');
    host.shareNow('title');
    assert.equal(host.topInset(750), 24);
    assert.deepEqual(host.safeArea(750, 1624), { left: 0, right: 0, capsuleLeft: 1624, capsuleBottom: 0 });
    await host.loadSubpackage('models');
    host.initAds({ rewarded: 'unit', interstitial: 'unit' });
    assert.equal(host.hasRewarded(), false);
    assert.equal(await host.showRewarded(), false);
    host.roundEnded();
  });
});

test('in WeChat: storage, vibration, insets in design pixels, subpackages, share', async () => {
  const wx = fakeWx();
  await withGlobals({ wx }, async () => {
    const host = await load('host.ts');
    assert.equal(host.isWeChat, true);
    host.saveNumber('day', 5);
    assert.equal(wx.store.get('day'), '5');
    assert.equal(host.loadNumber('day'), 5);
    assert.equal(host.loadNumber('never', 9), 9);
    host.vibrate();
    host.vibrate(true);
    // the capsule's bottom (80) plus 8, scaled from 375 window pixels to a 750 design
    assert.equal(host.topInset(750), 176);
    const area = host.safeArea(812, 375);
    assert.equal(area.capsuleLeft, 281);
    assert.equal(area.capsuleBottom, 80);
    await host.loadSubpackage('models');
    await assert.rejects(host.loadSubpackage('missing'), /subpackage missing: not found/);
    host.enableShare(() => 'my title');
    host.shareNow('now');
    host.onHide(() => {});
    assert.deepEqual(wx.calls, [
      ['vibrate', 'light'],
      ['vibrate', 'medium'],
      ['subpackage', 'models'],
      ['subpackage', 'missing'],
      ['shareMenu', 'shareAppMessage,shareTimeline'],
      ['onShare', 'my title'],
      ['share', 'now'],
      ['onHide', 'function'],
    ]);
  });
});

test('a rewarded video counts only when it was watched to the end, and is offered only once loaded', async () => {
  let onLoad, onClose;
  const shown = [];
  const ad = {
    onLoad: (f) => (onLoad = f),
    onError: () => {},
    onClose: (f) => (onClose = f),
    offClose: () => (onClose = undefined),
    load: () => Promise.resolve(),
    show: () => (shown.push('rewarded'), Promise.resolve()),
  };
  const wx = fakeWx({ createRewardedVideoAd: (o) => (assert.equal(o.adUnitId, 'unit-r'), ad) });
  await withGlobals({ wx }, async () => {
    const host = await load('host.ts');
    host.initAds({ rewarded: 'unit-r', interstitial: '' });
    assert.equal(host.hasRewarded(), false, 'not offered before it has loaded');
    onLoad();
    assert.equal(host.hasRewarded(), true);
    let result = host.showRewarded();
    onClose({ isEnded: false });
    assert.equal(await result, false, 'closed early: no reward');
    assert.equal(host.hasRewarded(), false, 'the next one has to load again');
    onLoad();
    result = host.showRewarded();
    onClose({ isEnded: true });
    assert.equal(await result, true);
    assert.deepEqual(shown, ['rewarded', 'rewarded']);
  });
});

test('an interstitial waits for the third round, 30 s after launch and 60 s after the last one', async () => {
  const shown = [];
  let now = 1_000_000;
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const wx = fakeWx({ createInterstitialAd: (o) => ({ show: () => (shown.push(o.adUnitId), Promise.resolve()) }) });
    await withGlobals({ wx }, async () => {
      const host = await load('host.ts');
      host.initAds({ rewarded: '', interstitial: 'unit-i' });
      host.roundEnded();
      host.roundEnded();
      host.roundEnded(); // third round, but only just launched
      assert.deepEqual(shown, []);
      now += 31_000;
      host.roundEnded();
      host.roundEnded();
      host.roundEnded(); // sixth round, 31 s in
      assert.deepEqual(shown, ['unit-i']);
      now += 10_000;
      host.roundEnded();
      host.roundEnded();
      host.roundEnded(); // ninth round, only 10 s after the last
      assert.deepEqual(shown, ['unit-i']);
      now += 60_000;
      host.roundEnded();
      host.roundEnded();
      host.roundEnded();
      assert.deepEqual(shown, ['unit-i', 'unit-i']);
    });
  } finally {
    Date.now = realNow;
  }
});

test('polyfills: a UTF-8 decoder and a deep copy are installed only where the host has none', async () => {
  const native = { TextDecoder: globalThis.TextDecoder, structuredClone: globalThis.structuredClone };
  await load('polyfills.ts');
  assert.equal(globalThis.TextDecoder, native.TextDecoder, 'a host that has them keeps its own');
  assert.equal(globalThis.structuredClone, native.structuredClone);
  await withGlobals({ TextDecoder: undefined, structuredClone: undefined }, async () => {
    await load('polyfills.ts');
    assert.notEqual(globalThis.TextDecoder, undefined);
    const text = '豬大 raft 🐷 ñ';
    const bytes = new native.TextDecoder().constructor === native.TextDecoder ? new TextEncoder().encode(text) : null;
    const decoder = new globalThis.TextDecoder();
    assert.equal(decoder.decode(bytes), text);
    assert.equal(decoder.decode(bytes.buffer), text, 'an ArrayBuffer as well as a view');
    assert.equal(decoder.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])), 'a', 'a byte-order mark is dropped');
    assert.equal(decoder.decode(), '');
    const long = 'é'.repeat(20000);
    assert.equal(decoder.decode(new TextEncoder().encode(long)), long, 'longer than one chunk');
    const source = { n: 1, list: [1, { deep: true }], when: new Date(5), bytes: new Uint8Array([1, 2]), map: new Map([['k', { v: 1 }]]), set: new Set([1]) };
    source.self = source;
    const cloned = globalThis.structuredClone(source);
    assert.notEqual(cloned, source);
    assert.equal(cloned.self, cloned, 'a cycle stays a cycle');
    assert.deepEqual(cloned.list, source.list);
    assert.notEqual(cloned.list[1], source.list[1]);
    assert.equal(cloned.when.getTime(), 5);
    assert.notEqual(cloned.bytes, source.bytes);
    assert.deepEqual([...cloned.bytes], [1, 2]);
    assert.notEqual(cloned.map.get('k'), source.map.get('k'));
    assert.deepEqual(cloned.map.get('k'), { v: 1 });
    assert.ok(cloned.set.has(1));
  });
});

test('package assets: read from the package in WeChat, fetched in a browser, refused over the size asked', async () => {
  const read = [];
  const wx = { getFileSystemManager: () => ({ readFile: (o) => (read.push(o.filePath), o.filePath.endsWith('missing.glb') ? o.fail({ errMsg: 'no such file' }) : o.success({ data: new Uint8Array([1, 2, 3]).buffer })) }) };
  await withGlobals({ wx }, async () => {
    const { PlatformAssetProvider } = await load('package-assets.ts');
    const provider = new PlatformAssetProvider('sub/assets/');
    const phases = [];
    const loaded = await provider.load('pig.glb', { onProgress: (p) => phases.push(p.phase) });
    assert.equal(loaded.id, 'pig.glb');
    assert.deepEqual([...loaded.bytes], [1, 2, 3]);
    assert.deepEqual(read, ['sub/assets/pig.glb']);
    assert.deepEqual(phases, ['downloading', 'ready']);
    await assert.rejects(provider.load('missing.glb'), /readFile sub\/assets\/missing\.glb: no such file/);
    await assert.rejects(provider.load('pig.glb', { maxBytes: 2 }), /larger than 2 bytes/);
  });
  const fetched = [];
  const fetch = async (url) => (fetched.push(url), url.endsWith('gone.glb') ? { ok: false, status: 404 } : { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer });
  await withGlobals({ wx: undefined, fetch }, async () => {
    const { PlatformAssetProvider } = await load('package-assets.ts');
    const provider = new PlatformAssetProvider();
    assert.deepEqual([...(await provider.load('a.glb')).bytes], [9]);
    assert.deepEqual(fetched, ['assets/a.glb']);
    await assert.rejects(provider.load('gone.glb'), /fetch assets\/gone\.glb: 404/);
  });
});
