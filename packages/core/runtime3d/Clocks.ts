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
    if (!(step > 0 && Number.isFinite(step) && Number.isInteger(maxCatchup) && maxCatchup > 0))
      throw Error('Invalid fixed clock');
  }
  advance(dt: number, simulate: (dt: number, tick: number) => void) {
    if (!Number.isFinite(dt) || dt < 0) throw Error('Invalid clock delta');
    if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
      throw Error('Invalid clock time scale');
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
    if (!Number.isSafeInteger(tick) || tick < 0) throw Error('Invalid tick');
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

export interface ZhudaLayerClockSample extends ZhudaClockSample {
  /** The named simulation/presentation layer that produced this sample. */
  layer: string;
  /** Pausing a layer keeps its real-time clock visible while zeroing its scaled channel. */
  paused: boolean;
}

export interface ZhudaTimeLayerOptions {
  timeScale?: number;
  paused?: boolean;
}

interface TimeLayerState {
  name: string;
  timeScale: number;
  paused: boolean;
  scaledTime: number;
  scaledDeltaTime: number;
}

const DEFAULT_TIME_LAYERS = ['world', 'player', 'enemy', 'vfx', 'ui'] as const;

/**
 * A single real-time source with independently scaled named channels.
 *
 * The clock deliberately does not know anything about combat, rendering or
 * animation. A consumer can freeze `enemy` for hit-stop while continuing to
 * advance `player`, `vfx` and `ui`, then pass the exposed layer deltas to the
 * shared `ZhudaTimerScheduler`.
 */
export class ZhudaLayeredClock {
  private readonly layerStates = new Map<string, TimeLayerState>();
  private readonly layerDeltaValues = new Map<string, number>();
  /** Global scale inherited from the owning runtime session. */
  globalTimeScale = 1;
  unscaledTime = 0;
  unscaledDeltaTime = 0;

  constructor(
    layers: readonly string[] | Record<string, ZhudaTimeLayerOptions> = DEFAULT_TIME_LAYERS,
  ) {
    if (Array.isArray(layers)) {
      if (!layers.length) throw Error('At least one time layer is required');
      for (const name of layers) this.defineLayer(name);
    } else {
      const definitions = layers as Record<string, ZhudaTimeLayerOptions>;
      const names = Object.keys(definitions);
      if (!names.length) throw Error('At least one time layer is required');
      for (const name of names) this.defineLayer(name, definitions[name]);
    }
  }

  defineLayer(name: string, options: ZhudaTimeLayerOptions = {}): this {
    this.validateName(name);
    if (this.layerStates.has(name)) throw Error(`Time layer already exists: ${name}`);
    const timeScale = options.timeScale ?? 1;
    if (!Number.isFinite(timeScale) || timeScale < 0) throw Error('Invalid time layer scale');
    if (options.paused !== undefined && typeof options.paused !== 'boolean')
      throw Error('Invalid time layer pause state');
    this.layerStates.set(name, {
      name,
      timeScale,
      paused: options.paused ?? false,
      scaledTime: 0,
      scaledDeltaTime: 0,
    });
    this.layerDeltaValues.set(name, 0);
    return this;
  }

  removeLayer(name: string): boolean {
    this.validateName(name);
    this.layerDeltaValues.delete(name);
    return this.layerStates.delete(name);
  }

  setTimeScale(name: string, value: number): this {
    const layer = this.getLayer(name);
    if (!Number.isFinite(value) || value < 0) throw Error('Invalid time layer scale');
    layer.timeScale = value;
    return this;
  }

  setGlobalTimeScale(value: number): this {
    if (!Number.isFinite(value) || value < 0) throw Error('Invalid global time layer scale');
    this.globalTimeScale = value;
    return this;
  }

  setPaused(name: string, paused: boolean): this {
    const layer = this.getLayer(name);
    if (typeof paused !== 'boolean') throw Error('Invalid time layer pause state');
    layer.paused = paused;
    return this;
  }

  getTimeScale(name: string): number {
    return this.getLayer(name).timeScale;
  }

  isPaused(name: string): boolean {
    return this.getLayer(name).paused;
  }

  get layerNames(): readonly string[] {
    return [...this.layerStates.keys()];
  }

  /** Reusable layer deltas for `ZhudaTimerScheduler.advance`. */
  get scaledDeltas(): ReadonlyMap<string, number> {
    return this.layerDeltaValues;
  }

  advance(unscaledDeltaTime: number): void {
    if (!Number.isFinite(unscaledDeltaTime) || unscaledDeltaTime < 0)
      throw Error('Invalid layered clock delta');
    this.unscaledDeltaTime = unscaledDeltaTime;
    this.unscaledTime += unscaledDeltaTime;
    for (const layer of this.layerStates.values()) {
      const scaledDeltaTime = layer.paused
        ? 0
        : unscaledDeltaTime * this.globalTimeScale * layer.timeScale;
      layer.scaledDeltaTime = scaledDeltaTime;
      layer.scaledTime += scaledDeltaTime;
      this.layerDeltaValues.set(layer.name, scaledDeltaTime);
    }
  }

  sample(name: string): ZhudaLayerClockSample {
    const layer = this.getLayer(name);
    return {
      layer: layer.name,
      paused: layer.paused,
      unscaledDeltaTime: this.unscaledDeltaTime,
      scaledDeltaTime: layer.scaledDeltaTime,
      unscaledTime: this.unscaledTime,
      scaledTime: layer.scaledTime,
      timeScale: this.globalTimeScale * layer.timeScale,
    };
  }

  reset(): void {
    this.unscaledTime = 0;
    this.unscaledDeltaTime = 0;
    for (const layer of this.layerStates.values()) {
      layer.scaledTime = 0;
      layer.scaledDeltaTime = 0;
      this.layerDeltaValues.set(layer.name, 0);
    }
  }

  private getLayer(name: string): TimeLayerState {
    this.validateName(name);
    const layer = this.layerStates.get(name);
    if (!layer) throw Error(`Unknown time layer: ${name}`);
    return layer;
  }

  private validateName(name: string): void {
    if (typeof name !== 'string' || !name.trim()) throw Error('Invalid time layer name');
  }
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
      throw Error('Invalid real-time delta');
    if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
      throw Error('Invalid clock time scale');
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

export type ZhudaTimerChannel = 'scaled' | 'unscaled';
export interface ZhudaTimerOptions {
  channel?: ZhudaTimerChannel;
  /** When set, the timer consumes that named layer's scaled delta. */
  layer?: string;
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
  layer?: string;
  owner?: object;
  callback: () => void;
  cancelled: boolean;
}

/** A curve from 0 to 1 over a tween's time. */
export type ZhudaEase = (t: number) => number;
export const zhudaEase = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  /** Goes a little past the end and comes back. */
  outBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
} as const satisfies Record<string, ZhudaEase>;
export interface ZhudaTweenOptions extends ZhudaTimerOptions {
  /** Seconds on the tween's clock (its channel or layer). 0 ends on the next advance. */
  duration: number;
  /** Called on every advance with the eased value and the plain share of the time gone, both ending at exactly 1. */
  update: (eased: number, t: number) => void;
  ease?: ZhudaEase;
}
export interface ZhudaTweenHandle {
  readonly id: number;
  /** True once it has ended, false once cancelled; never rejects. */
  readonly done: Promise<boolean>;
  readonly active: boolean;
  cancel(): boolean;
  /** Jumps to the end now: one last `update(1, 1)`, and `done` is true. */
  finish(): boolean;
}
interface TweenTask {
  id: number;
  elapsed: number;
  duration: number;
  channel: ZhudaTimerChannel;
  layer?: string;
  owner?: object;
  update: (eased: number, t: number) => void;
  ease: ZhudaEase;
  settle: (done: boolean) => void;
}

/** Frame-driven timer scheduler. It never creates a browser timer or outlives its owner. */
export class ZhudaTimerScheduler {
  readonly maxCallbacksPerAdvance: number;
  private nextId = 1;
  private tasks = new Map<number, TimerTask>();
  private owners = new Map<object, Set<number>>();
  private disposed = false;
  private tweens = new Map<number, TweenTask>();
  private waits = new Map<number, (done: boolean) => void>();

  constructor(maxCallbacksPerAdvance = 64) {
    if (!Number.isSafeInteger(maxCallbacksPerAdvance) || maxCallbacksPerAdvance <= 0)
      throw Error('Invalid timer callback bound');
    this.maxCallbacksPerAdvance = maxCallbacksPerAdvance;
  }

  scheduleOnce(
    delay: number,
    callback: () => void,
    options: ZhudaTimerOptions = {},
  ): ZhudaTimerHandle {
    return this.schedule(delay, callback, { ...options, repeat: false });
  }

  scheduleLoop(
    interval: number,
    callback: () => void,
    options: ZhudaTimerOptions = {},
  ): ZhudaTimerHandle {
    return this.schedule(interval, callback, { ...options, repeat: true });
  }

  /**
   * A wait on this scheduler's clock: it stops while the clock is paused and runs at the clock's
   * speed, which `setTimeout` does not. Resolves true when the time has passed, false if it was
   * cancelled (by its owner being cancelled, `clear` or `dispose`); it never rejects.
   */
  wait(seconds: number, options: ZhudaTimerOptions = {}): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const handle = this.schedule(
        seconds,
        () => {
          this.waits.delete(handle.id);
          resolve(true);
        },
        { ...options, repeat: false },
      );
      this.waits.set(handle.id, resolve);
    });
  }

  /**
   * A value carried from 0 to 1 over `duration` seconds of this scheduler's clock, stepped on
   * every advance. The last step is exactly 1. Cancelled with its owner like a timer.
   */
  tween(options: ZhudaTweenOptions): ZhudaTweenHandle {
    if (this.disposed) throw Error('Disposed timer scheduler');
    if (!options || !Number.isFinite(options.duration) || options.duration < 0)
      throw Error('Invalid tween duration');
    if (typeof options.update !== 'function') throw Error('Invalid tween update');
    if (options.ease !== undefined && typeof options.ease !== 'function')
      throw Error('Invalid tween ease');
    if (options.layer !== undefined && (typeof options.layer !== 'string' || !options.layer.trim()))
      throw Error('Invalid timer layer');
    if (options.layer !== undefined && options.channel !== undefined)
      throw Error('Timer layer cannot be combined with a timer channel');
    // (The handle's getter below has its own `this`.)
    const self = this;
    let settle!: (done: boolean) => void;
    const done = new Promise<boolean>((resolve) => (settle = resolve));
    const task: TweenTask = {
      id: this.nextId++,
      elapsed: 0,
      duration: options.duration,
      channel: options.channel ?? 'scaled',
      layer: options.layer,
      owner: options.owner,
      update: options.update,
      ease: options.ease ?? zhudaEase.linear,
      settle,
    };
    this.tweens.set(task.id, task);
    if (task.owner) {
      let ids = this.owners.get(task.owner);
      if (!ids) this.owners.set(task.owner, (ids = new Set()));
      ids.add(task.id);
    }
    return {
      id: task.id,
      done,
      get active() {
        return self.tweens.has(task.id);
      },
      cancel: () => this.cancel(task.id),
      finish: () => {
        if (!this.tweens.has(task.id)) return false;
        this.endTween(task, true);
        return true;
      },
    };
  }

  private endTween(task: TweenTask, finished: boolean): void {
    this.tweens.delete(task.id);
    if (task.owner) {
      const ids = this.owners.get(task.owner);
      ids?.delete(task.id);
      if (ids && !ids.size) this.owners.delete(task.owner);
    }
    try {
      if (finished) task.update(task.ease(1), 1);
    } finally {
      task.settle(finished);
    }
  }

  private schedule(
    delay: number,
    callback: () => void,
    options: ZhudaTimerOptions & { repeat: boolean },
  ): ZhudaTimerHandle {
    if (this.disposed) throw Error('Disposed timer scheduler');
    if (!Number.isFinite(delay) || delay < 0 || (options.repeat && delay <= 0))
      throw Error('Invalid timer delay');
    if (typeof callback !== 'function') throw Error('Invalid timer callback');
    if (options.layer !== undefined && (typeof options.layer !== 'string' || !options.layer.trim()))
      throw Error('Invalid timer layer');
    if (options.layer !== undefined && options.channel !== undefined)
      throw Error('Timer layer cannot be combined with a timer channel');
    const task: TimerTask = {
      id: this.nextId++,
      remaining: delay,
      interval: delay,
      repeat: options.repeat,
      channel: options.channel ?? 'scaled',
      layer: options.layer,
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
      get cancelled() {
        return task.cancelled;
      },
      cancel: () => this.cancel(task.id),
    };
  }

  private cancel(id: number): boolean {
    const tween = this.tweens.get(id);
    if (tween) {
      this.endTween(tween, false);
      return true;
    }
    const task = this.tasks.get(id);
    if (!task || task.cancelled) return false;
    task.cancelled = true;
    this.tasks.delete(id);
    if (task.owner) {
      const ids = this.owners.get(task.owner);
      ids?.delete(id);
      if (ids && !ids.size) this.owners.delete(task.owner);
    }
    const waiting = this.waits.get(id);
    if (waiting) {
      this.waits.delete(id);
      waiting(false);
    }
    return true;
  }

  cancelOwner(owner: object): number {
    const ids = [...(this.owners.get(owner) ?? [])];
    for (const id of ids) this.cancel(id);
    return ids.length;
  }

  advance(
    unscaledDeltaTime: number,
    scaledDeltaTime = unscaledDeltaTime,
    layerDeltas?: ReadonlyMap<string, number>,
  ): number {
    if (this.disposed) return 0;
    if (![unscaledDeltaTime, scaledDeltaTime].every((v) => Number.isFinite(v) && v >= 0))
      throw Error('Invalid timer delta');
    if (layerDeltas) {
      for (const [name, delta] of layerDeltas) {
        if (typeof name !== 'string' || !name.trim() || !Number.isFinite(delta) || delta < 0)
          throw Error('Invalid timer layer delta');
      }
    }
    let callbacks = 0;
    const snapshot = [...this.tasks.values()];
    for (const task of snapshot) {
      if (callbacks >= this.maxCallbacksPerAdvance) break;
      if (task.cancelled || !this.tasks.has(task.id)) continue;
      const delta = task.layer
        ? (layerDeltas?.get(task.layer) ?? 0)
        : task.channel === 'scaled'
          ? scaledDeltaTime
          : unscaledDeltaTime;
      task.remaining -= delta;
      while (
        task.remaining <= 1e-10 &&
        !task.cancelled &&
        this.tasks.has(task.id) &&
        callbacks < this.maxCallbacksPerAdvance
      ) {
        task.callback();
        callbacks++;
        if (!task.repeat) {
          this.cancel(task.id);
          break;
        }
        task.remaining += task.interval;
      }
      if (
        callbacks >= this.maxCallbacksPerAdvance &&
        task.repeat &&
        !task.cancelled &&
        task.remaining <= 1e-10
      )
        task.remaining = task.interval;
    }
    // Tweens step on every advance; they are not counted against the callback bound.
    for (const tween of [...this.tweens.values()]) {
      if (!this.tweens.has(tween.id)) continue;
      const delta = tween.layer
        ? (layerDeltas?.get(tween.layer) ?? 0)
        : tween.channel === 'scaled'
          ? scaledDeltaTime
          : unscaledDeltaTime;
      tween.elapsed += delta;
      if (tween.duration <= 0 || tween.elapsed + 1e-10 >= tween.duration)
        this.endTween(tween, true);
      else {
        const t = tween.elapsed / tween.duration;
        tween.update(tween.ease(t), t);
      }
    }
    return callbacks;
  }

  clear(): void {
    for (const id of [...this.tasks.keys(), ...this.tweens.keys()]) this.cancel(id);
  }

  /** How many tweens are running (`size` counts timers and waits). */
  get tweenCount(): number {
    return this.tweens.size;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.owners.clear();
  }

  get size(): number {
    return this.tasks.size;
  }
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
      throw Error('Invalid snapshot bounds');
  }
  push(s: TimedSnapshot<T>) {
    if (
      s.epoch !== this.epoch ||
      !Number.isSafeInteger(s.sequence) ||
      s.sequence <= this.sequence ||
      !Number.isFinite(s.time)
    )
      return false;
    if (this.items.length && s.time <= this.items[this.items.length - 1].time) return false;
    this.sequence = s.sequence;
    this.items.push(s);
    if (this.items.length > this.capacity) this.items.shift();
    return true;
  }
  sample(time: number) {
    if (!Number.isFinite(time)) throw Error('Invalid sample time');
    const a = this.items;
    if (!a.length) return null;
    if (a.length === 1 || time <= a[0].time)
      return { value: a[0].value, time: a[0].time, mode: 'held' as const };
    for (let i = 1; i < a.length; i++)
      if (time <= a[i].time) {
        const x = a[i - 1],
          y = a[i];
        return {
          value: this.interpolate(x.value, y.value, (time - x.time) / (y.time - x.time)),
          time,
          mode: 'interpolated' as const,
        };
      }
    const x = a[a.length - 2],
      y = a[a.length - 1],
      t = Math.min(time, y.time + this.maxExtrapolation);
    return {
      value: this.interpolate(x.value, y.value, (t - x.time) / (y.time - x.time)),
      time: t,
      mode: 'extrapolated' as const,
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
    if (!(ttl > 0 && Number.isFinite(ttl) && Number.isInteger(capacity) && capacity > 0))
      throw Error('Invalid event bounds');
  }
  dispatch(
    id: string,
    now: number,
    action: () => void,
    options: { epoch?: string; replay?: boolean } = {},
  ) {
    if (!id || !Number.isFinite(now)) throw Error('Invalid event');
    if (options.replay || (options.epoch && options.epoch !== this.epoch)) return false;
    for (const [k, t] of this.seen) if (now - t > this.ttl) this.seen.delete(k);
    if (this.seen.has(id)) return false;
    this.seen.set(id, now);
    while (this.seen.size > this.capacity) this.seen.delete(this.seen.keys().next().value!);
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
