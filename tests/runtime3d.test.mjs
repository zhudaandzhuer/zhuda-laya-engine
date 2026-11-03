import test from "node:test";
import assert from "node:assert/strict";
import {
  ZhudaAssetCache,
  ZhudaRequestSlot,
  ZhudaSimulationClock,
  ZhudaRealtimeClock,
  ZhudaLayeredClock,
  ZhudaTimerScheduler,
  ZhudaActionStateMachine,
  validateActionFrameSpec,
  ZhudaInputBuffer,
  ZhudaSceneMutationQueue,
  ZhudaRenderSpace,
  ZhudaGraphicsGuard,
  ZhudaObjectPool,
  ZhudaCombatWorld,
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
test("runtime session drives scaled samples and frame timers from one loop", () => {
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let callback, fired = 0, sample, mutations = 0;
  try {
    globalThis.document = Object.assign(new EventTarget(), { hidden: false });
    globalThis.window = new EventTarget();
    globalThis.requestAnimationFrame = fn => { callback = fn; return 1; };
    globalThis.cancelAnimationFrame = () => { callback = null; };
    const session = new ZhudaRuntimeSession(new EventTarget(), { timeScale: 0.5 });
    session.timers.scheduleOnce(0.01, () => fired++);
    session.layers.setPaused("enemy", true);
    session.timers.scheduleOnce(0.01, () => fired += 10, { layer: "enemy" });
    session.mutations.deferAdd(() => mutations++);
    session.start((dt, value) => { sample = value; assert.equal(dt, value.unscaledDeltaTime); });
    callback(1000);
    callback(1020);
    assert.equal(sample.unscaledDeltaTime, 0.02);
    assert.equal(sample.scaledDeltaTime, 0.01);
    assert.equal(fired, 1);
    session.layers.setPaused("enemy", false);
    callback(1040);
    assert.equal(fired, 11);
    assert.equal(mutations, 1);
    session.dispose();
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
test("scaled and unscaled clocks plus timer ownership are deterministic", () => {
  const realtime = new ZhudaRealtimeClock();
  realtime.timeScale = 0.25;
  const first = realtime.advance(0.4);
  assert.equal(first.unscaledDeltaTime, 0.4);
  assert.equal(first.scaledDeltaTime, 0.1);
  assert.equal(first.unscaledTime, 0.4);
  assert.equal(first.scaledTime, 0.1);
  realtime.paused = true;
  const paused = realtime.advance(1);
  assert.equal(paused.unscaledDeltaTime, 0);
  assert.equal(paused.scaledTime, 0.1);

  const timers = new ZhudaTimerScheduler(8), owner = {}, calls = [];
  timers.scheduleOnce(0.2, () => calls.push("scaled"), { owner });
  timers.scheduleOnce(0.2, () => calls.push("real"), { owner, channel: "unscaled" });
  timers.scheduleLoop(0.1, () => calls.push("loop"), { channel: "scaled" });
  timers.advance(0.2, 0.05);
  assert.deepEqual(calls, ["real"]);
  timers.advance(0.2, 0.15);
  assert.deepEqual(calls, ["real", "scaled", "loop", "loop"]);
  assert.equal(timers.cancelOwner(owner), 0);
  timers.cancelOwner({});
  timers.dispose();
  assert.equal(timers.size, 0);
  const bounded = new ZhudaTimerScheduler(2), boundedCalls = [];
  bounded.scheduleLoop(0.1, () => boundedCalls.push(1));
  assert.equal(bounded.advance(0.5, 0.5), 2);
  assert.equal(boundedCalls.length, 2);
  bounded.dispose();
});
test("layered clock and layer timers keep hit-stop channels independent", () => {
  const clock = new ZhudaLayeredClock({
    world: { timeScale: 0.5 },
    enemy: { paused: true },
    ui: { timeScale: 1 },
  });
  clock.advance(0.2);
  assert.equal(clock.sample("world").scaledDeltaTime, 0.1);
  assert.equal(clock.sample("enemy").scaledDeltaTime, 0);
  assert.equal(clock.sample("enemy").unscaledDeltaTime, 0.2);
  assert.equal(clock.sample("ui").scaledTime, 0.2);
  clock.setGlobalTimeScale(0.5).advance(0.2);
  assert.equal(clock.sample("world").scaledDeltaTime, 0.05);
  assert.equal(clock.sample("ui").scaledDeltaTime, 0.1);
  const timers = new ZhudaTimerScheduler();
  const calls = [];
  timers.scheduleOnce(0.05, () => calls.push("world"), { layer: "world" });
  timers.scheduleOnce(0.05, () => calls.push("enemy"), { layer: "enemy" });
  timers.scheduleOnce(0.1, () => calls.push("ui"), { layer: "ui" });
  timers.advance(clock.unscaledDeltaTime, clock.unscaledDeltaTime, clock.scaledDeltas);
  assert.deepEqual(calls, ["world", "ui"]);
  clock.setPaused("enemy", false).setTimeScale("enemy", 0.5);
  clock.advance(0.2);
  timers.advance(clock.unscaledDeltaTime, clock.unscaledDeltaTime, clock.scaledDeltas);
  assert.deepEqual(calls, ["world", "ui", "enemy"]);
  assert.throws(() => timers.scheduleOnce(1, () => {}, { layer: "enemy", channel: "scaled" }), /cannot be combined/);
  timers.dispose();
});
test("action frame data validates phases, events, cancel windows and sockets", () => {
  const spec = {
    id: "light-1",
    frameRate: 10,
    frameCount: 10,
    startup: { from: 0, until: 2 },
    active: { from: 2, until: 5 },
    recovery: { from: 5, until: 10 },
    cancelWindows: [{ from: 3, until: 4, actions: ["dash"] }],
    events: [{ frame: 3, id: "hit" }, { frame: 6, id: "recover" }],
    sockets: [{ id: "rHand", bone: "hand_r", offset: { x: 0.1, y: 0, z: 0 } }],
  };
  assert.deepEqual(validateActionFrameSpec(spec), []);
  const machine = new ZhudaActionStateMachine(spec);
  machine.play();
  machine.advance(0.2);
  assert.equal(machine.phase, "active");
  assert.equal(machine.active, true);
  assert.equal(machine.canCancelInto("dash"), false);
  assert.deepEqual(machine.advance(0.1).map((event) => event.id), ["hit"]);
  assert.equal(machine.canCancelInto("dash"), true);
  assert.deepEqual(machine.getSocket("rHand"), { id: "rHand", bone: "hand_r", offset: { x: 0.1, y: 0, z: 0 } });
  machine.advance(0.7);
  assert.equal(machine.phase, "complete");
  assert.equal(machine.isPlaying, false);
  assert.throws(() => new ZhudaActionStateMachine({ ...spec, active: { from: 4, until: 5 } }), /startup must connect/);
});
test("input buffer bounds, expiry, one-shot consumption and combos", () => {
  const buffer = new ZhudaInputBuffer({ window: 0.12, capacity: 4 });
  assert.equal(buffer.push("down", 0), true);
  assert.equal(buffer.push("forward", 0.04), true);
  assert.equal(buffer.push("light", 0.08), true);
  assert.equal(buffer.consumeSequence(["down", "forward", "light"], 0.08), true);
  assert.equal(buffer.size, 0);
  assert.equal(buffer.push("heavy", 0.2), true);
  assert.equal(buffer.push("jump", 0.19), false);
  assert.equal(buffer.has("heavy", 0.2), true);
  assert.equal(buffer.consume("heavy", 0.2), true);
  assert.equal(buffer.consume("heavy", 0.2), false);
  for (const [action, time] of [["a", 0.3], ["b", 0.31], ["c", 0.32], ["d", 0.33], ["e", 0.34]])
    buffer.push(action, time);
  assert.equal(buffer.size, 4);
  assert.equal(buffer.snapshot(0.34)[0].action, "b");
  assert.throws(() => buffer.snapshot(0.1), /moved backwards/);
  buffer.dispose();
  assert.throws(() => buffer.push("light", 0.3), /Disposed/);
});
test("scene mutation queue defers nested writes and rejects work after disposal", () => {
  const queue = new ZhudaSceneMutationQueue(), events = [];
  queue.deferAdd(() => {
    events.push("add");
    queue.deferDestroy(() => events.push("nested-destroy"));
  });
  queue.deferRemove(() => events.push("remove"));
  assert.equal(queue.flush(), 2);
  assert.deepEqual(events, ["add", "remove"]);
  assert.equal(queue.flush(), 1);
  assert.deepEqual(events, ["add", "remove", "nested-destroy"]);
  const handle = queue.deferDestroy(() => events.push("cancelled"));
  assert.equal(handle.cancel(), true);
  assert.equal(queue.flush(), 0);
  queue.dispose();
  assert.throws(() => queue.deferAdd(() => {}), /Disposed/);
});
test("render passes and graphics guard keep coordinate and numeric policy explicit", () => {
  const space = new ZhudaRenderSpace(), passes = [], matrix = [1, 0, 0, 1];
  space.register({
    onRenderLocal: context => passes.push([context.pass, context.coordinates, context.transform]),
    onRenderWorld: context => passes.push([context.pass, context.coordinates, context.transform]),
    onRenderOverlay: context => passes.push([context.pass, context.coordinates, context.transform]),
  });
  assert.equal(space.render({ localTransform: matrix, worldTransform: null, overlayTransform: matrix }), 3);
  assert.deepEqual(passes, [
    ["local", "local", matrix],
    ["world", "world", null],
    ["overlay", "camera-overlay", matrix],
  ]);
  const calls = [], target = {
    clear: (...args) => calls.push(["clear", ...args]),
    drawRect: (...args) => calls.push(["rect", ...args]),
    drawRoundRect: (...args) => calls.push(["round", ...args]),
    drawCircle: (...args) => calls.push(["circle", ...args]),
    drawEllipse: (...args) => calls.push(["ellipse", ...args]),
  };
  const graphics = new ZhudaGraphicsGuard(target);
  graphics.drawCircle(1, 2, -3, "red");
  graphics.drawRoundRect(0, 0, 10, 4, 9, -1, 3, 2, "blue");
  graphics.drawRect(0, 0, -4, 5, "green");
  assert.equal(calls[0][3], 0);
  assert.equal(calls[1][5], 2);
  assert.throws(() => graphics.drawCircle(NaN, 0, 1, "red"), /Graphics x/);
});
test("object pool and combat world reset state and deduplicate one swing", () => {
  const lifecycle = [], created = [], disposed = [], pool = new ZhudaObjectPool({
    capacity: 1,
    create: () => { const item = { value: 0 }; created.push(item); return item; },
    onSpawn: item => { item.value++; lifecycle.push("spawn"); },
    onDespawn: () => lifecycle.push("despawn"),
    reset: item => { item.value = 0; lifecycle.push("reset"); },
    dispose: item => disposed.push(item),
  });
  const item = pool.acquire();
  assert.equal(item.value, 1);
  assert.equal(pool.acquire(), null);
  assert.equal(pool.release(item), true);
  assert.equal(pool.availableCount, 1);
  const reused = pool.acquire();
  assert.equal(reused, item);
  assert.equal(reused.value, 1);
  pool.dispose();
  assert.deepEqual(lifecycle, ["spawn", "despawn", "reset", "spawn", "despawn"]);
  assert.equal(created.length, 1);
  assert.deepEqual(disposed, [item]);

  const combat = new ZhudaCombatWorld();
  combat.registerHurtbox({ id: "hurt", ownerId: "enemy", layer: 2, rect: { x: 4, y: 0, width: 2, height: 2 } });
  combat.registerHitbox({ id: "hit", ownerId: "hero", layer: 1, mask: 2, swingId: "s1", activeFrom: 1, activeUntil: 2, rect: { x: 4, y: 0, width: 2, height: 2 } });
  assert.deepEqual(combat.queryHitbox("hit", 0), []);
  assert.equal(combat.queryHitbox("hit", 1).length, 1);
  assert.deepEqual(combat.queryHitbox("hit", 1), []);
  assert.deepEqual(combat.queryHitbox("hit", 2), []);
  combat.updateHitbox("hit", { swingId: "s2" });
  assert.equal(combat.queryHitbox("hit", 1.5).length, 1);
  combat.dispose();
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
