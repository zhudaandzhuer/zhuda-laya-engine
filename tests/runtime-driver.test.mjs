import test from "node:test";
import assert from "node:assert/strict";
import { ZhudaRuntimeSession } from "../packages/core/runtime3d/Runtime.ts";
import { ZhudaWorkerFrameDriver } from "../packages/core/runtime3d/RuntimeDriver.ts";
function environment() {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.window = new EventTarget();
  return () => Object.assign(globalThis, saved);
}
class Driver {
  time = 0;
  callback;
  starts = 0;
  disposed = 0;
  now() {
    return this.time;
  }
  start(callback) {
    this.callback = callback;
    this.starts++;
  }
  stop() {
    this.callback = undefined;
  }
  setBackground(v) {
    this.background = v;
  }
  dispose() {
    this.disposed++;
    this.stop();
  }
  tick(time) {
    this.time = time;
    this.callback?.(time);
  }
}
test("default background pause discards long gaps, preserves manual pause and owns one driver", () => {
  const restore = environment(),
    driver = new Driver(),
    reports = [];
  try {
    const runtime = new ZhudaRuntimeSession(new EventTarget(), {
      driver,
      onResume: (r) => reports.push(r),
    });
    let ticks = 0;
    runtime.start(() => ticks++);
    runtime.start(() => ticks++);
    assert.equal(driver.starts, 1);
    driver.tick(100);
    driver.tick(120);
    window.dispatchEvent(new Event("blur"));
    driver.tick(600120);
    assert.equal(ticks, 2);
    window.dispatchEvent(new Event("focus"));
    driver.tick(600130);
    assert.equal(runtime.clock.unscaledTime, 0.02);
    assert.equal(reports[0].advancedSec, 0);
    assert.equal(reports[0].elapsedSec, 600);
    runtime.setPaused(true);
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    driver.tick(600150);
    assert.equal(ticks, 3);
    const stale = driver.callback;
    runtime.dispose();
    stale(700000);
    assert.equal(ticks, 3);
    assert.equal(driver.disposed, 1);
  } finally {
    restore();
  }
});
test("bounded recovery advances one capped delta and cannot replay the suspended interval", () => {
  const restore = environment(),
    driver = new Driver(),
    reports = [];
  try {
    const runtime = new ZhudaRuntimeSession(new EventTarget(), {
      driver,
      recoveryPolicy: "bounded",
      maxFrameDeltaSec: 0.1,
      onResume: (r) => reports.push(r),
    });
    let fires = 0;
    runtime.timers.scheduleLoop(0.02, () => fires++);
    runtime.start(() => {});
    driver.tick(0);
    driver.tick(20);
    window.dispatchEvent(new Event("blur"));
    driver.tick(1000020);
    window.dispatchEvent(new Event("focus"));
    driver.tick(1000030);
    assert.ok(Math.abs(runtime.clock.unscaledTime - 0.12) < 1e-9);
    assert.equal(fires, 6);
    assert.equal(reports[0].advancedSec, 0.1);
    driver.tick(1000030);
    assert.equal(fires, 6);
    driver.tick(1000050);
    assert.equal(fires, 7);
    runtime.dispose();
  } finally {
    restore();
  }
});
test("continue policy uses the same layer deltas in background and avoids double-counting on resume", () => {
  const restore = environment(),
    driver = new Driver();
  try {
    const runtime = new ZhudaRuntimeSession(new EventTarget(), {
      driver,
      backgroundPolicy: "continue",
      recoveryPolicy: "bounded",
    });
    let fired = 0;
    runtime.layers.setPaused("enemy", true);
    runtime.timers.scheduleLoop(0.1, () => fired++, { layer: "enemy" });
    runtime.start(() => {});
    driver.tick(100);
    window.dispatchEvent(new Event("blur"));
    driver.tick(200);
    driver.tick(300);
    assert.equal(runtime.clock.unscaledTime, 0.2);
    assert.equal(fired, 0);
    window.dispatchEvent(new Event("focus"));
    driver.tick(310);
    assert.equal(runtime.clock.unscaledTime, 0.2);
    runtime.dispose();
  } finally {
    restore();
  }
});
test("worker adapter rejects stale generation messages, switches RAF source and terminates its worker", () => {
  const saved = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let raf,
    frames = 0;
  const worker = {
    messages: [],
    postMessage(m) {
      this.messages.push(m);
    },
    terminate() {
      this.terminated = true;
    },
  };
  try {
    globalThis.requestAnimationFrame = (fn) => {
      raf = fn;
      return 1;
    };
    globalThis.cancelAnimationFrame = () => {};
    const driver = new ZhudaWorkerFrameDriver({ workerFactory: () => worker });
    driver.start(() => frames++);
    const oldRaf = raf;
    driver.setBackground(true);
    const token = worker.messages.at(-1).generation;
    oldRaf(100);
    assert.equal(frames, 0);
    worker.onmessage({ data: { generation: token } });
    assert.equal(frames, 1);
    driver.setBackground(false);
    worker.onmessage({ data: { generation: token } });
    assert.equal(frames, 1);
    raf(200);
    assert.equal(frames, 2);
    driver.dispose();
    assert.equal(worker.terminated, true);
    assert.equal(worker.onmessage, null);
  } finally {
    Object.assign(globalThis, saved);
  }
});
