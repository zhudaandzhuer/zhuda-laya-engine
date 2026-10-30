export class ZhudaSimulationClock {
  readonly step: number;
  readonly maxCatchup: number;
  tick = 0;
  renderTime = 0;
  paused = false;
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
    if (this.paused) return 0;
    this.renderTime += dt;
    this.accumulator = Math.min(
      this.accumulator + dt,
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
    this.accumulator = 0;
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
