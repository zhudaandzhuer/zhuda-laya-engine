export class ZhudaSimulationClock {
  readonly step: number;
  readonly maxCatchup: number;
  tick = 0;
  renderTime = 0;
  paused = false;
  timeScale = 1;
  unscaledTime = 0;
  scaledTime = 0;
  unscaledDeltaTime = 0;
  scaledDeltaTime = 0;
  private accumulator = 0;
  constructor(step = 1 / 60, maxCatchup = 8) {
    this.step = step;
    this.maxCatchup = maxCatchup;
    if (
      !(
        step > 0 &&
        Number.isFinite(step) &&
        Number.isInteger(maxCatchup) &&
        maxCatchup > 0
      )
    )
      throw Error("Invalid fixed clock");
  }
  advance(dt: number, simulate: (dt: number, tick: number) => void) {
    if (!Number.isFinite(dt) || dt < 0) throw Error("Invalid clock delta");
    if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
      throw Error("Invalid clock time scale");
    this.unscaledDeltaTime = this.paused ? 0 : dt;
    this.scaledDeltaTime = this.paused ? 0 : dt * this.timeScale;
    if (this.paused) return 0;
    this.unscaledTime += dt;
    this.scaledTime += dt * this.timeScale;
    this.renderTime += dt;
    this.accumulator = Math.min(
      this.accumulator + dt * this.timeScale,
      this.step * this.maxCatchup,
    );
    let n = 0;
    while (this.accumulator + 1e-10 >= this.step) {
      this.accumulator -= this.step;
      simulate(this.step, ++this.tick);
      n++;
    }
    return n;
  }
  get simulationTime() {
    return this.tick * this.step;
  }
  get alpha() {
    return Math.max(0, this.accumulator / this.step);
  }
  reset(tick = 0) {
    if (!Number.isSafeInteger(tick) || tick < 0) throw Error("Invalid tick");
    this.tick = tick;
    this.renderTime = tick * this.step;
    this.unscaledTime = this.renderTime;
    this.scaledTime = this.renderTime;
    this.unscaledDeltaTime = 0;
    this.scaledDeltaTime = 0;
    this.accumulator = 0;
  }
}

export interface ZhudaClockSample {
  unscaledDeltaTime: number;
  scaledDeltaTime: number;
  unscaledTime: number;
  scaledTime: number;
  timeScale: number;
}

/** A real-time clock that exposes both gameplay and presentation time channels. */
export class ZhudaRealtimeClock {
  timeScale = 1;
  unscaledTime = 0;
  scaledTime = 0;
  unscaledDeltaTime = 0;
  scaledDeltaTime = 0;
  paused = false;

  advance(unscaledDeltaTime: number): ZhudaClockSample {
    if (!Number.isFinite(unscaledDeltaTime) || unscaledDeltaTime < 0)
      throw Error("Invalid real-time delta");
    if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
      throw Error("Invalid clock time scale");
    const unscaled = this.paused ? 0 : unscaledDeltaTime;
    const scaled = unscaled * this.timeScale;
    this.unscaledDeltaTime = unscaled;
    this.scaledDeltaTime = scaled;
    this.unscaledTime += unscaled;
    this.scaledTime += scaled;
    return this.sample();
  }

  sample(): ZhudaClockSample {
    return {
      unscaledDeltaTime: this.unscaledDeltaTime,
      scaledDeltaTime: this.scaledDeltaTime,
      unscaledTime: this.unscaledTime,
      scaledTime: this.scaledTime,
      timeScale: this.timeScale,
    };
  }

  reset(): void {
    this.unscaledTime = 0;
    this.scaledTime = 0;
    this.unscaledDeltaTime = 0;
    this.scaledDeltaTime = 0;
  }
}

export type ZhudaTimerChannel = "scaled" | "unscaled";
export interface ZhudaTimerOptions {
  channel?: ZhudaTimerChannel;
  owner?: object;
}
export interface ZhudaTimerHandle {
  readonly id: number;
  readonly cancelled: boolean;
  cancel(): boolean;
}

interface TimerTask {
  id: number;
  remaining: number;
  interval: number;
  repeat: boolean;
  channel: ZhudaTimerChannel;
  owner?: object;
  callback: () => void;
  cancelled: boolean;
}

/** Frame-driven timer scheduler. It never creates a browser timer or outlives its owner. */
export class ZhudaTimerScheduler {
  readonly maxCallbacksPerAdvance: number;
  private nextId = 1;
  private tasks = new Map<number, TimerTask>();
  private owners = new Map<object, Set<number>>();
  private disposed = false;

  constructor(maxCallbacksPerAdvance = 64) {
    if (!Number.isSafeInteger(maxCallbacksPerAdvance) || maxCallbacksPerAdvance <= 0)
      throw Error("Invalid timer callback bound");
    this.maxCallbacksPerAdvance = maxCallbacksPerAdvance;
  }

  scheduleOnce(delay: number, callback: () => void, options: ZhudaTimerOptions = {}): ZhudaTimerHandle {
    return this.schedule(delay, callback, { ...options, repeat: false });
  }

  scheduleLoop(interval: number, callback: () => void, options: ZhudaTimerOptions = {}): ZhudaTimerHandle {
    return this.schedule(interval, callback, { ...options, repeat: true });
  }

  private schedule(delay: number, callback: () => void, options: ZhudaTimerOptions & { repeat: boolean }): ZhudaTimerHandle {
    if (this.disposed) throw Error("Disposed timer scheduler");
    if (!Number.isFinite(delay) || delay < 0 || (options.repeat && delay <= 0))
      throw Error("Invalid timer delay");
    if (typeof callback !== "function") throw Error("Invalid timer callback");
    const task: TimerTask = {
      id: this.nextId++,
      remaining: delay,
      interval: delay,
      repeat: options.repeat,
      channel: options.channel ?? "scaled",
      owner: options.owner,
      callback,
      cancelled: false,
    };
    this.tasks.set(task.id, task);
    if (task.owner) {
      let ids = this.owners.get(task.owner);
      if (!ids) this.owners.set(task.owner, (ids = new Set()));
      ids.add(task.id);
    }
    return this.handle(task);
  }

  private handle(task: TimerTask): ZhudaTimerHandle {
    return {
      id: task.id,
      get cancelled() { return task.cancelled; },
      cancel: () => this.cancel(task.id),
    };
  }

  private cancel(id: number): boolean {
    const task = this.tasks.get(id);
    if (!task || task.cancelled) return false;
    task.cancelled = true;
    this.tasks.delete(id);
    if (task.owner) {
      const ids = this.owners.get(task.owner);
      ids?.delete(id);
      if (ids && !ids.size) this.owners.delete(task.owner);
    }
    return true;
  }

  cancelOwner(owner: object): number {
    const ids = [...(this.owners.get(owner) ?? [])];
    for (const id of ids) this.cancel(id);
    return ids.length;
  }

  advance(unscaledDeltaTime: number, scaledDeltaTime = unscaledDeltaTime): number {
    if (this.disposed) return 0;
    if (![unscaledDeltaTime, scaledDeltaTime].every(v => Number.isFinite(v) && v >= 0))
      throw Error("Invalid timer delta");
    let callbacks = 0;
    const snapshot = [...this.tasks.values()];
    for (const task of snapshot) {
      if (callbacks >= this.maxCallbacksPerAdvance) break;
      if (task.cancelled || !this.tasks.has(task.id)) continue;
      task.remaining -= task.channel === "scaled" ? scaledDeltaTime : unscaledDeltaTime;
      while (task.remaining <= 1e-10 && !task.cancelled && this.tasks.has(task.id) && callbacks < this.maxCallbacksPerAdvance) {
        task.callback();
        callbacks++;
        if (!task.repeat) {
          this.cancel(task.id);
          break;
        }
        task.remaining += task.interval;
      }
      if (callbacks >= this.maxCallbacksPerAdvance && task.repeat && !task.cancelled && task.remaining <= 1e-10)
        task.remaining = task.interval;
    }
    return callbacks;
  }

  clear(): void {
    for (const id of [...this.tasks.keys()]) this.cancel(id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.owners.clear();
  }

  get size(): number { return this.tasks.size; }
}
export interface TimedSnapshot<T> {
  epoch: string;
  sequence: number;
  time: number;
  value: T;
}
/** Caller supplies server/sample time. Arrival order never controls playback time. */
export class ZhudaSnapshotBuffer<T> {
  public epoch: string;
  readonly interpolate: (a: T, b: T, t: number) => T;
  readonly maxExtrapolation: number;
  readonly capacity: number;
  private items: TimedSnapshot<T>[] = [];
  private sequence = -1;
  constructor(
    epoch: string,
    interpolate: (a: T, b: T, t: number) => T,
    maxExtrapolation = 0.15,
    capacity = 32,
  ) {
    this.epoch = epoch;
    this.interpolate = interpolate;
    this.maxExtrapolation = maxExtrapolation;
    this.capacity = capacity;
    if (
      !Number.isFinite(maxExtrapolation) ||
      maxExtrapolation < 0 ||
      capacity < 2 ||
      !Number.isInteger(capacity)
    )
      throw Error("Invalid snapshot bounds");
  }
  push(s: TimedSnapshot<T>) {
    if (
      s.epoch !== this.epoch ||
      !Number.isSafeInteger(s.sequence) ||
      s.sequence <= this.sequence ||
      !Number.isFinite(s.time)
    )
      return false;
    if (this.items.length && s.time <= this.items[this.items.length - 1].time)
      return false;
    this.sequence = s.sequence;
    this.items.push(s);
    if (this.items.length > this.capacity) this.items.shift();
    return true;
  }
  sample(time: number) {
    if (!Number.isFinite(time)) throw Error("Invalid sample time");
    const a = this.items;
    if (!a.length) return null;
    if (a.length === 1 || time <= a[0].time)
      return { value: a[0].value, time: a[0].time, mode: "held" as const };
    for (let i = 1; i < a.length; i++)
      if (time <= a[i].time) {
        const x = a[i - 1],
          y = a[i];
        return {
          value: this.interpolate(
            x.value,
            y.value,
            (time - x.time) / (y.time - x.time),
          ),
          time,
          mode: "interpolated" as const,
        };
      }
    const x = a[a.length - 2],
      y = a[a.length - 1],
      t = Math.min(time, y.time + this.maxExtrapolation);
    return {
      value: this.interpolate(
        x.value,
        y.value,
        (t - x.time) / (y.time - x.time),
      ),
      time: t,
      mode: "extrapolated" as const,
    };
  }
  reset(epoch: string) {
    this.epoch = epoch;
    this.items = [];
    this.sequence = -1;
  }
  get size() {
    return this.items.length;
  }
}
/** Session-scoped, TTL + capacity bounded; seeking/replay suppresses side effects by default. */
export class ZhudaEventGate {
  public epoch: string;
  readonly ttl: number;
  readonly capacity: number;
  private seen = new Map<string, number>();
  constructor(epoch: string, ttl = 30, capacity = 2048) {
    this.epoch = epoch;
    this.ttl = ttl;
    this.capacity = capacity;
    if (
      !(
        ttl > 0 &&
        Number.isFinite(ttl) &&
        Number.isInteger(capacity) &&
        capacity > 0
      )
    )
      throw Error("Invalid event bounds");
  }
  dispatch(
    id: string,
    now: number,
    action: () => void,
    options: { epoch?: string; replay?: boolean } = {},
  ) {
    if (!id || !Number.isFinite(now)) throw Error("Invalid event");
    if (options.replay || (options.epoch && options.epoch !== this.epoch))
      return false;
    for (const [k, t] of this.seen) if (now - t > this.ttl) this.seen.delete(k);
    if (this.seen.has(id)) return false;
    this.seen.set(id, now);
    while (this.seen.size > this.capacity)
      this.seen.delete(this.seen.keys().next().value!);
    action();
    return true;
  }
  reset(epoch: string) {
    this.epoch = epoch;
    this.seen.clear();
  }
  get size() {
    return this.seen.size;
  }
}
