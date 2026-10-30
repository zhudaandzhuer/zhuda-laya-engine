import test from "node:test";
import assert from "node:assert/strict";
import {
  ZhudaAssetCache,
  ZhudaRequestSlot,
  ZhudaSimulationClock,
  ZhudaSnapshotBuffer,
  ZhudaEventGate,
  compose4,
  multiply4,
  inverse4,
  transformPoint,
  ZhudaSceneQueries,
  rayBox,
  ZhudaSceneRegions,
  ZhudaResourceScope,
  ZhudaDistanceLOD,
  packMetallicRoughness,
} from "../packages/core/runtime3d/index.ts";
import {
  ZhudaEffectDirector,
  validateEffectTimeline,
} from "../packages/core/effects/EffectDirector.ts";
import {
  ZhudaRuntimeSession,
  installLaya342LifecycleFix,
} from "../packages/core/runtime3d/index.ts";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test("runtime frame pacing tolerates integer 16/17ms Safari timestamps and releases listeners/tasks", () => {
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let callback,
    clears = 0;
  try {
    globalThis.document = Object.assign(new EventTarget(), { hidden: false });
    globalThis.window = new EventTarget();
    globalThis.requestAnimationFrame = (fn) => {
      callback = fn;
      return 1;
    };
    globalThis.cancelAnimationFrame = () => (callback = null);
    const session = new ZhudaRuntimeSession(new EventTarget(), {
      targetFPS: 60,
      clearInput: () => clears++,
    });
    let ticks = 0;
    session.start(() => ticks++);
    let now = 1000;
    for (let i = 0; i < 120; i++) {
      now += i % 2 ? 17 : 16;
      callback(now);
    }
    assert.equal(ticks, 120);
    window.dispatchEvent(new Event("blur"));
    const count = ticks;
    callback(now + 17);
    assert.equal(ticks, count);
    assert.ok(clears);
    session.dispose();
    assert.equal(callback, null);
  } finally {
    Object.assign(globalThis, saved);
  }
});
test("3.4.2 process cleanup releases its fallback shadow map exactly once", () => {
  let depth = 0,
    shadow = 0;
  class Process {
    constructor() {
      this._defaultShadowMap = {
        destroy() {
          shadow++;
        },
        destroyed: false,
      };
    }
    destroy() {
      depth++;
    }
  }
  installLaya342LifecycleFix({ WebRender3DProcess: Process });
  installLaya342LifecycleFix({ WebRender3DProcess: Process });
  const p = new Process();
  p.destroy();
  p.destroy();
  assert.equal(depth, 1);
  assert.equal(shadow, 1);
});
test("shared assets: independent abort, retry, falsy values and bounded warm ownership", async () => {
  const d = deferred(),
    dead = [];
  let loads = 0;
  const cache = new ZhudaAssetCache(
    async () => {
      loads++;
      return d.promise;
    },
    (v) => dead.push(v),
    1,
  );
  const c = new AbortController(),
    a = cache.acquire("skin", { signal: c.signal }),
    b = cache.acquire("skin");
  c.abort();
  await assert.rejects(a, { name: "AbortError" });
  d.resolve(0);
  const lease = await b;
  assert.equal(loads, 1);
  assert.equal(lease.value, 0);
  lease.release();
  lease.release();
  const again = await cache.acquire("skin");
  assert.equal(loads, 1);
  again.release();
  cache.dispose();
  assert.deepEqual(dead, [0]);
  let tries = 0;
  const retry = new ZhudaAssetCache(
    async () => {
      if (++tries < 3) throw Error("network");
      return {};
    },
    () => {},
  );
  const r = await retry.acquire("retry", { retries: 2 });
  assert.equal(tries, 3);
  assert.throws(() => retry.dispose());
  r.release();
  retry.dispose();
});
test("retired loads cannot commit or leak when their loader ignores cancellation", async () => {
  const d = deferred(),
    dead = [];
  const cache = new ZhudaAssetCache(
    () => d.promise,
    (v) => dead.push(v),
  );
  const c = new AbortController(),
    p = cache.acquire("late", { signal: c.signal });
  c.abort();
  await assert.rejects(p);
  d.resolve("late");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(dead, ["late"]);
  assert.equal(cache.report().entries, 0);
  const slot = new ZhudaRequestSlot(),
    old = deferred(),
    commits = [],
    discard = [];
  const stale = slot.replace(
    () => old.promise,
    (v) => commits.push(v),
    (v) => discard.push(v),
  );
  await slot.replace(
    async () => 2,
    (v) => commits.push(v),
    (v) => discard.push(v),
  );
  old.resolve(1);
  assert.equal(await stale, false);
  assert.deepEqual(commits, [2]);
  assert.deepEqual(discard, [1]);
});
test("10 Hz snapshots and fixed simulation agree at 30/60/120 FPS; repeats never rewind playback", () => {
  for (const fps of [30, 60, 120]) {
    const clock = new ZhudaSimulationClock(),
      buffer = new ZhudaSnapshotBuffer(
        "round-1",
        (a, b, t) => a + (b - a) * t,
        0.15,
        8,
      ),
      events = new ZhudaEventGate("round-1");
    let effects = 0,
      last = -Infinity;
    for (let frame = 0; frame < fps * 3; frame++) {
      const now = frame / fps;
      clock.advance(1 / fps, () => {});
      if (frame % Math.round(fps / 10) === 0) {
        const sequence = Math.round(now * 10);
        const snapshot = {
          epoch: "round-1",
          sequence,
          time: now,
          value: now * 5,
        };
        assert.ok(buffer.push(snapshot));
        assert.equal(buffer.push(snapshot), false);
        buffer.push({ ...snapshot, sequence: sequence - 1, time: now - 0.1 });
        events.dispatch("attack-" + sequence, now, () => effects++);
        events.dispatch("attack-" + sequence, now, () => effects++);
      }
      const s = buffer.sample(Math.max(0, now - 0.12));
      if (s) {
        assert.ok(s.time >= last);
        last = s.time;
        near(s.value, s.time * 5);
      }
    }
    assert.equal(clock.tick, 180);
    assert.equal(effects, 30);
    assert.ok(buffer.size <= 8);
    near(buffer.sample(100).time, 3.05);
    events.dispatch("reconnect", 4, () => effects++, { replay: true });
    assert.equal(effects, 30);
    buffer.reset("round-2");
    assert.equal(buffer.sample(0), null);
  }
});
test("3D attachments preserve rotated non-uniform parent matrices and stop after target destruction", () => {
  const q = { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) },
    parent = compose4({ x: 3, y: 5, z: 7 }, q, { x: 2, y: 3, z: 4 }),
    offset = { x: 1, y: 2, z: 3 };
  let alive = true,
    result,
    stops = 0;
  const director = new ZhudaEffectDirector(
    {
      version: 1,
      duration: 1,
      attachments: [{ source: "boat", target: "hook", anchor: "hand", offset }],
    },
    {
      boat: {
        reset() {},
        resolveAnchor: () =>
          alive ? { x: 0, y: 0, worldMatrix: parent } : null,
      },
      hook: {
        reset() {},
        setTransform: (v) => (result = v),
        stop: () => stops++,
      },
    },
  );
  director.update(0);
  const expected = transformPoint(parent, offset);
  for (const k of ["x", "y", "z"]) near(result[k], expected[k]);
  const local = transformPoint(inverse4(parent), result);
  for (const k of ["x", "y", "z"]) near(local[k], offset[k]);
  alive = false;
  director.update(0);
  assert.equal(stops, 1);
  assert.ok(
    validateEffectTimeline({
      version: 1,
      duration: 1,
      attachments: [
        {
          source: "a",
          target: "b",
          anchor: "c",
          offset: { x: 0, y: 0, worldMatrix: [1] },
        },
      ],
    }).length,
  );
});
test("queries select nearest occluder with stable instance IDs and layers; sweep uses supplied geometry", () => {
  const q = new ZhudaSceneQueries();
  for (const [id, z, layer] of [
    ["rock", 2, 1],
    ["enemy", 5, 2],
  ])
    q.register({
      entityId: id,
      instanceId: "stable-" + id,
      layer,
      raycast: (ray, d) =>
        rayBox(ray, { x: -1, y: -1, z }, { x: 1, y: 1, z: z + 1 }, d),
      sweepSphere: () => ({
        distance: z,
        position: { x: 0, y: 0, z },
        normal: { x: 0, y: 0, z: -1 },
      }),
    });
  const ray = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 2 } };
  assert.equal(q.raycast(ray).entityId, "rock");
  assert.equal(q.raycast(ray, 10, 2).instanceId, "stable-enemy");
  assert.equal(
    q.sweepSphere(ray.origin, { x: 0, y: 0, z: 10 }, 0.2).entityId,
    "rock",
  );
  assert.equal(q.raycast(ray, 1), null);
});
test("region unload retires pending creation; ownership releases in reverse order after a failure", async () => {
  const regions = new ZhudaSceneRegions(),
    d = deferred();
  let disposed = 0;
  const p = regions.enter("island", () => d.promise);
  regions.leave("island");
  d.resolve({
    dispose() {
      disposed++;
    },
  });
  assert.equal(await p, false);
  assert.equal(disposed, 1);
  assert.equal(regions.size, 0);
  const scope = new ZhudaResourceScope(),
    order = [];
  scope.defer(() => order.push(1));
  scope.defer(() => {
    order.push(2);
    throw Error("release");
  });
  scope.defer(() => order.push(3));
  assert.throws(() => scope.dispose());
  scope.dispose();
  assert.deepEqual(order, [3, 2, 1]);
  const lod = new ZhudaDistanceLOD(10, 2);
  assert.equal(lod.update({ x: 11, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), true);
  assert.equal(lod.update({ x: 13, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), false);
  assert.equal(lod.update({ x: 9, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), false);
  assert.deepEqual(
    [...packMetallicRoughness(new Uint8Array([0, 64, 190, 255]))],
    [190, 0, 0, 191],
  );
});
test("opaque sandbox storage is realm-local and preserves normal origin storage", async () => {
  const { installSandboxStorageFallback } = await import(
    "../packages/core/runtime3d/index.ts"
  );
  const saved = globalThis.window;
  try {
    const persistent = {};
    globalThis.window = { sessionStorage: persistent };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    assert.deepEqual(installSandboxStorageFallback(), {
      localStorage: "memory",
      sessionStorage: "persistent",
    });
    window.localStorage.setItem("round", "12");
    assert.equal(window.localStorage.getItem("round"), "12");
    assert.equal(window.localStorage.length, 1);
    window.localStorage.removeItem("round");
    assert.equal(window.localStorage.getItem("round"), null);
    assert.equal(window.sessionStorage, persistent);
  } finally {
    globalThis.window = saved;
  }
});
test("failed initial resize releases observer and event handlers", () => {
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
    devicePixelRatio: globalThis.devicePixelRatio,
    Laya: globalThis.Laya,
    innerWidth: globalThis.innerWidth,
    innerHeight: globalThis.innerHeight,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let disconnected = 0,
    cleared = 0;
  try {
    globalThis.document = new EventTarget();
    globalThis.window = new EventTarget();
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {
        disconnected++;
      }
    };
    Object.assign(globalThis, {
      devicePixelRatio: 1,
      innerWidth: 390,
      innerHeight: 844,
      cancelAnimationFrame() {},
      Laya: {
        Config: {},
        Stage: {},
        Browser: { pixelRatio: 1 },
        stage: { size() {}, setScreenSize() {} },
      },
    });
    assert.throws(
      () =>
        new ZhudaRuntimeSession(new EventTarget(), {
          container: {
            getBoundingClientRect: () => ({ width: 390, height: 844 }),
          },
          clearInput: () => cleared++,
          onResize() {
            throw Error("consumer resize");
          },
        }),
      /consumer resize/,
    );
    assert.equal(disconnected, 1);
    assert.equal(cleared, 1);
    window.dispatchEvent(new Event("blur"));
    assert.equal(cleared, 1);
  } finally {
    Object.assign(globalThis, saved);
  }
});
