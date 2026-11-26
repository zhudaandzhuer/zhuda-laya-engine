// Waits and tweens on the scheduler's clock, a fixed clock for the session, and the three small
// additions made with them: a model copy's shadow switch is tested with the model library; here
// are the splash signal and text without TextDecoder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaTimerScheduler, zhudaEase } from '../packages/core/runtime3d/Clocks.ts';
import { ZhudaRuntimeSession } from '../packages/core/runtime3d/Runtime.ts';
import { zhudaUtf8Decode, zhudaUtf8Encode } from '../packages/core/runtime3d/Utf8.ts';
import { whenZhudaSplashGone, zhudaSplashState } from '../packages/core/SplashSignal.ts';

test('a wait follows the clock it is on: scaled time, a pause, a layer', async () => {
  const timers = new ZhudaTimerScheduler();
  const seen = [];
  timers.wait(1).then((done) => seen.push(['scaled', done]));
  timers.wait(1, { channel: 'unscaled' }).then((done) => seen.push(['unscaled', done]));
  timers.wait(0.5, { layer: 'world' }).then((done) => seen.push(['world', done]));
  // Half speed: one real second is half a scaled one. The world layer stands still.
  timers.advance(1, 0.5, new Map([['world', 0]]));
  await Promise.resolve();
  assert.deepEqual(seen, [['unscaled', true]]);
  // A paused clock advances by nothing.
  timers.advance(0, 0, new Map([['world', 0]]));
  await Promise.resolve();
  assert.equal(seen.length, 1);
  timers.advance(1, 0.5, new Map([['world', 0.5]]));
  await Promise.resolve();
  assert.deepEqual(seen, [
    ['unscaled', true],
    ['scaled', true],
    ['world', true],
  ]);
  assert.equal(timers.size, 0);
});

test('a cancelled wait resolves false and never rejects', async () => {
  const timers = new ZhudaTimerScheduler();
  const owner = {};
  const a = timers.wait(5, { owner }),
    b = timers.wait(5);
  assert.equal(timers.cancelOwner(owner), 1);
  assert.equal(await a, false);
  timers.dispose();
  assert.equal(await b, false);
  assert.throws(() => timers.tween({ duration: 1, update() {} }), /Disposed/);
});

test('a tween steps on every advance, ends at exactly 1, and can be finished or cancelled', async () => {
  const timers = new ZhudaTimerScheduler();
  const steps = [];
  const tween = timers.tween({
    duration: 1,
    ease: zhudaEase.outQuad,
    update: (eased, t) => steps.push([+eased.toFixed(4), +t.toFixed(4)]),
  });
  assert.equal(timers.tweenCount, 1);
  timers.advance(0.25);
  timers.advance(0.25);
  timers.advance(0.6); // past the end: the last step is 1, not 1.1
  assert.deepEqual(steps, [
    [0.4375, 0.25],
    [0.75, 0.5],
    [1, 1],
  ]);
  assert.equal(await tween.done, true);
  assert.equal(tween.active, false);
  assert.equal(tween.finish(), false);

  const jumped = [];
  const second = timers.tween({ duration: 10, update: (e) => jumped.push(e) });
  timers.advance(1);
  assert.equal(second.finish(), true);
  assert.deepEqual(jumped, [0.1, 1]);
  assert.equal(await second.done, true);

  const owner = {},
    third = timers.tween({ duration: 10, owner, update: (e) => jumped.push(e) });
  assert.equal(timers.cancelOwner(owner), 1);
  assert.equal(await third.done, false);
  assert.equal(jumped.length, 2, 'a cancelled tween takes no last step');
  assert.equal(timers.tweenCount, 0);

  // A tween of no length ends on the next advance; a layer's tween waits for its layer.
  const zero = [];
  timers.tween({ duration: 0, update: (e) => zero.push(e) });
  const layered = timers.tween({ duration: 1, layer: 'ui', update: (e) => zero.push(e) });
  timers.advance(0.5, 0.5, new Map([['ui', 0]]));
  assert.deepEqual(zero, [1, 0]);
  layered.cancel();
  assert.throws(() => timers.tween({ duration: -1, update() {} }), /duration/);
  assert.throws(() => timers.tween({ duration: 1 }), /update/);
  assert.throws(
    () => timers.tween({ duration: 1, update() {}, layer: 'ui', channel: 'scaled' }),
    /layer/,
  );
  for (const ease of Object.values(zhudaEase)) {
    assert.ok(Math.abs(ease(0)) < 1e-12);
    assert.ok(Math.abs(ease(1) - 1) < 1e-12);
  }
});

test('a session with a fixed clock gives every frame the same time, whatever really passed', () => {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.window = new EventTarget();
  try {
    const driver = {
      time: 0,
      now() {
        return this.time;
      },
      start(cb) {
        this.callback = cb;
      },
      stop() {},
      setBackground() {},
      dispose() {},
    };
    const run = (frames) => {
      const session = new ZhudaRuntimeSession(new EventTarget(), { driver, fixedDeltaSec: 1 / 60 });
      const seen = [];
      let fired = 0;
      session.timers.scheduleOnce(0.05, () => (fired = seen.length));
      session.start((dt, sample) => seen.push([dt, sample.scaledTime]));
      for (const ms of frames) driver.callback((driver.time += ms));
      session.dispose();
      return { seen, fired };
    };
    // Two runs with different real frame times: an even 60 Hz, and one with a hitch of 400 ms.
    const even = run([16.7, 16.7, 16.7, 16.7, 16.7]);
    const hitched = run([16.7, 400, 20, 33, 16.7]);
    assert.deepEqual(even, hitched);
    assert.equal(even.seen.length, 5);
    assert.ok(even.seen.every(([dt]) => dt === 1 / 60));
    assert.equal(
      even.fired,
      2,
      'the 0.05 s timer fires in the third frame, before that frame is recorded',
    );
    for (const bad of [0, -1, 2, NaN])
      assert.throws(
        () => new ZhudaRuntimeSession(new EventTarget(), { driver, fixedDeltaSec: bad }),
        /fixedDeltaSec/,
      );
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('text and bytes on a host with no TextDecoder or TextEncoder', () => {
  const samples = [
    '',
    'plain',
    '{"name":"豬大","note":"café – 雨夜 😀"}',
    '\u0000\u007f\u0080߿ࠀ￿',
    '𝄞'.repeat(5000),
  ];
  for (const text of samples) {
    const own = zhudaUtf8Encode(text, {}),
      host = new TextEncoder().encode(text);
    assert.deepEqual([...own], [...host]);
    assert.equal(zhudaUtf8Decode(host, {}), text);
    assert.equal(zhudaUtf8Decode(host), text);
  }
  // Bad bytes become U+FFFD as the host's decoder makes them; a byte order mark is dropped.
  for (const bytes of [
    [0xff, 0x41],
    [0xc0, 0x80],
    [0xe2, 0x82],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xef, 0xbb, 0xbf, 0x41],
  ])
    assert.equal(
      zhudaUtf8Decode(Uint8Array.from(bytes), {}),
      new TextDecoder().decode(Uint8Array.from(bytes)),
      bytes.join(' '),
    );
  assert.deepEqual([...zhudaUtf8Encode('\ud800x', {})], [...new TextEncoder().encode('\ud800x')]);
});

test('the splash says when it has gone', async () => {
  assert.equal(zhudaSplashState({}), null);
  await whenZhudaSplashGone({ host: {} });
  await whenZhudaSplashGone({ host: { __ZHUDA_SPLASH__: { mode: 'none', completed: true } } });
  const host = Object.assign(new EventTarget(), {
    __ZHUDA_SPLASH__: {
      started: true,
      completed: false,
      loaded: true,
      gone: false,
      mode: 'engine',
      durationMs: 2180,
    },
    setTimeout,
    clearTimeout,
  });
  assert.deepEqual(zhudaSplashState(host), {
    started: true,
    completed: false,
    loaded: true,
    gone: false,
    mode: 'engine',
    durationMs: 2180,
  });
  let resolved = false;
  const waiting = whenZhudaSplashGone({ host }).then(() => (resolved = true));
  await Promise.resolve();
  assert.equal(resolved, false);
  host.__ZHUDA_SPLASH__.gone = true;
  host.dispatchEvent(new Event('zhuda:splash-gone'));
  await waiting;
  assert.equal(resolved, true);
  const stuck = Object.assign(new EventTarget(), {
    __ZHUDA_SPLASH__: { started: true, loaded: false, gone: false, mode: 'engine' },
    setTimeout,
    clearTimeout,
  });
  await assert.rejects(
    whenZhudaSplashGone({ host: stuck, timeoutMs: 20 }),
    /had not gone after 20 ms \(loaded: false\)/,
  );
  assert.throws(() => whenZhudaSplashGone({ timeoutMs: -1 }), /timeoutMs/);
});
