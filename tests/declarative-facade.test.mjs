import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaEngine, ZhudaUI } from '../packages/core/DeclarativeSDK.ts';
import { ZHUDA_LAYA_REALM_MARKER } from '../packages/core/RealmGuards.ts';

// Boot is exercised in real browsers by the consumer/browser gates. These checks
// cover the facade's preflight and failure-cleanup contract, which must hold
// before any WebGL/WebGPU context exists.
function withGlobals(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, globalThis[k]]));
  Object.assign(globalThis, values);
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  };
  return Promise.resolve().then(run).finally(restore);
}

test('boot preflight rejects cancellation, foreign realms, missing containers and bad DPR caps', async () => {
  const controller = new AbortController();
  const reason = new Error('caller cancelled');
  controller.abort(reason);
  await assert.rejects(ZhudaEngine.boot({ signal: controller.signal }), (e) => e === reason);

  await withGlobals({ Laya: { stage: {} }, [ZHUDA_LAYA_REALM_MARKER]: undefined }, () =>
    assert.rejects(ZhudaEngine.boot(), /ZHUDA_FOREIGN_LAYA_REALM/),
  );

  await withGlobals({ Laya: undefined, document: { querySelector: () => null } }, async () => {
    await assert.rejects(ZhudaEngine.boot({ container: '#missing' }), /container not found/);
    for (const dprCap of [0.25, 5, NaN])
      await assert.rejects(ZhudaEngine.boot({ dprCap }), /DPR cap/);
  });
  assert.equal(ZhudaEngine.getContext(), null, 'preflight failures never publish a context');
});

test('a failed or timed-out Laya.init releases the session so the next boot can run', async () => {
  const marks = [];
  const laya = {
    Config: {},
    init: () => Promise.reject(new Error('init failed')),
  };
  await withGlobals({ Laya: laya, __ZHUDA_ENGINE_BOOTED__: undefined }, async () => {
    await assert.rejects(
      ZhudaEngine.boot({
        features: ['core', '2d'],
        antialias: true,
        preserveDrawingBuffer: false,
        beforeInit: () => marks.push('beforeInit'),
      }),
      /init failed/,
    );
    assert.deepEqual(marks, ['beforeInit']);
    assert.equal(laya.Config.isAntialias, true, 'explicit options reach Laya.Config before init');
    assert.equal(laya.Config.preserveDrawingBuffer, false);
    assert.equal(globalThis.__ZHUDA_ENGINE_BOOTED__, false);
    assert.equal(ZhudaEngine.getContext(), null);

    laya.init = () => new Promise(() => {});
    await assert.rejects(
      ZhudaEngine.boot({ features: ['core', '2d'], bootTimeoutMs: 20 }),
      (e) => e.name === 'TimeoutError',
      'a hung init times out instead of leaving the facade marked as booting',
    );
    laya.init = () => Promise.reject(new Error('second init failed'));
    await assert.rejects(ZhudaEngine.boot({ features: ['core', '2d'] }), /second init failed/);
    assert.equal(ZhudaEngine.getContext(), null);
  });
});

test('flushRenderFrames advances the render loop with monotonic timestamps and tolerates absence', async () => {
  const times = [];
  const Render = {
    loop(t) {
      assert.equal(this, Render);
      times.push(t);
    },
  };
  await withGlobals({ Laya: { Render } }, () => ZhudaEngine.flushRenderFrames(4));
  assert.equal(times.length, 4);
  for (let i = 1; i < times.length; i++)
    assert.ok(Math.abs(times[i] - times[i - 1] - 16.67) < 1e-6);
  await withGlobals({ Laya: {} }, () => ZhudaEngine.flushRenderFrames());
});

test('nine-slice grids normalize partial arrays and malformed strings to the 5-tuple contract', () => {
  assert.deepEqual(ZhudaUI.parseSizeGrid([8, 9]), [8, 9, 16, 16, 0]);
  assert.deepEqual(ZhudaUI.parseSizeGrid('4, x, 6,,1'), [4, 16, 6, 0, 1]);
  assert.deepEqual(ZhudaUI.parseSizeGrid(''), [16, 16, 16, 16, 0]);
  assert.equal(ZhudaUI.formatSizeGrid([1, 2, 3, 4, 1]), '1,2,3,4,1');
});
