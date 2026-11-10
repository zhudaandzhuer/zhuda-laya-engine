import { ZhudaSnapshotBuffer } from './Clocks.ts';
import type { TimedSnapshot } from './Clocks.ts';

export type CrowdAnimationMode = 'full' | 'low' | 'paused';
export interface CrowdPresentationTier {
  /** Ascending outer distance, last tier must be Infinity. */
  maxDistance: number;
  updateHz: number;
  animation: CrowdAnimationMode;
  /** Native Laya frame divisor, not a promised Hz rate. Default 2. */
  animationInterval?: number;
}
export interface CrowdPresentationState {
  visible: boolean;
  distance: number;
  priority?: number;
}
export interface CrowdPresentationBinding {
  /** Presentation only. Never advance authoritative movement/damage here. */
  update(deltaSeconds: number): void;
  setTier?(tier: Readonly<CrowdPresentationTier> | null): void;
}
export interface CrowdSchedulerOptions {
  tiers: readonly CrowdPresentationTier[];
  maxUpdatesPerFrame: number;
  hysteresis?: number;
  maxDeltaSeconds?: number;
}
interface CrowdEntry {
  id: string;
  binding: CrowdPresentationBinding;
  state: CrowdPresentationState;
  tier: number;
  elapsed: number;
  initial: boolean;
  active: boolean;
}
/** One shared presentation schedule driven by the session's scaled delta. No private timer. */
export class ZhudaCrowdScheduler {
  private readonly tiers: readonly Readonly<CrowdPresentationTier>[];
  private readonly maxUpdates: number;
  private readonly hysteresis: number;
  private readonly maxDelta: number;
  private readonly entries = new Map<string, CrowdEntry>();
  private readonly due: CrowdEntry[] = [];
  private disposed = false;
  private dropped = 0;
  constructor(options: CrowdSchedulerOptions) {
    if (
      !options.tiers.length ||
      options.tiers[options.tiers.length - 1]?.maxDistance !== Infinity ||
      !Number.isInteger(options.maxUpdatesPerFrame) ||
      options.maxUpdatesPerFrame < 1
    )
      throw Error('Invalid crowd presentation budget.');
    let previous = -1;
    for (const tier of options.tiers) {
      if (
        !(tier.maxDistance > previous) ||
        !Number.isFinite(tier.updateHz) ||
        tier.updateHz <= 0 ||
        tier.updateHz > 240 ||
        !['full', 'low', 'paused'].includes(tier.animation) ||
        !Number.isInteger(tier.animationInterval ?? 2) ||
        (tier.animationInterval ?? 2) < 1 ||
        (tier.animationInterval ?? 2) > 60
      )
        throw Error('Invalid crowd tier.');
      previous = tier.maxDistance;
    }
    this.hysteresis = options.hysteresis ?? 1;
    this.maxDelta = options.maxDeltaSeconds ?? 0.25;
    if (
      !Number.isFinite(this.hysteresis) ||
      this.hysteresis < 0 ||
      !Number.isFinite(this.maxDelta) ||
      this.maxDelta <= 0
    )
      throw Error('Invalid crowd time/distance bounds.');
    this.tiers = options.tiers.map((t) => Object.freeze({ ...t }));
    this.maxUpdates = options.maxUpdatesPerFrame;
  }
  private check(): void {
    if (this.disposed) throw Error('Disposed crowd scheduler.');
  }
  register(id: string, binding: CrowdPresentationBinding, state: CrowdPresentationState): void {
    this.check();
    if (!id || this.entries.has(id)) throw Error('Duplicate or empty crowd ID.');
    this.validate(state);
    const entry: CrowdEntry = {
      id,
      binding,
      state: { ...state },
      tier: -2,
      elapsed: 0,
      initial: true,
      active: true,
    };
    this.entries.set(id, entry);
    try {
      this.selectTier(entry);
    } catch (error) {
      this.entries.delete(id);
      throw error;
    }
  }
  private validate(s: CrowdPresentationState): void {
    if (
      typeof s.visible !== 'boolean' ||
      !Number.isFinite(s.distance) ||
      s.distance < 0 ||
      !Number.isFinite(s.priority ?? 0)
    )
      throw Error('Invalid crowd presentation state.');
  }
  setState(id: string, state: CrowdPresentationState): void {
    this.check();
    this.validate(state);
    const e = this.entries.get(id);
    if (!e) throw Error(`Unknown crowd ID: ${id}`);
    e.state = { ...state };
    this.selectTier(e);
  }
  private selectTier(e: CrowdEntry): void {
    let next = e.tier;
    if (!e.state.visible) next = -1;
    else if (next < 0) next = this.tiers.findIndex((t) => e.state.distance <= t.maxDistance);
    else {
      while (
        next < this.tiers.length - 1 &&
        e.state.distance > this.tiers[next].maxDistance + this.hysteresis
      )
        next++;
      while (next > 0 && e.state.distance < this.tiers[next - 1].maxDistance - this.hysteresis)
        next--;
    }
    if (next !== e.tier) {
      e.tier = next;
      e.elapsed = 0;
      e.initial = true;
      e.binding.setTier?.(next < 0 ? null : this.tiers[next]);
    }
  }
  update(deltaSeconds: number): {
    updated: number;
    deferred: number;
    hidden: number;
    droppedSeconds: number;
  } {
    this.check();
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw Error('Invalid crowd delta.');
    this.due.length = 0;
    let hidden = 0;
    for (const e of this.entries.values()) {
      if (e.tier < 0) {
        hidden++;
        continue;
      }
      e.elapsed += deltaSeconds;
      if (e.initial || e.elapsed + 1e-10 >= 1 / this.tiers[e.tier].updateHz) this.due.push(e);
    }
    // Oldest overdue work first, priority breaks equal debt; bounded work cannot starve peers.
    this.due.sort(
      (a, b) =>
        b.elapsed * this.tiers[b.tier].updateHz - a.elapsed * this.tiers[a.tier].updateHz ||
        (b.state.priority ?? 0) - (a.state.priority ?? 0) ||
        a.id.localeCompare(b.id),
    );
    let updated = 0;
    for (const e of this.due) {
      if (updated >= this.maxUpdates) break;
      if (!e.active || e.tier < 0) continue;
      const dt = Math.min(e.elapsed, this.maxDelta);
      this.dropped += e.elapsed - dt;
      e.elapsed = 0;
      e.initial = false;
      updated++;
      e.binding.update(dt);
    }
    return {
      updated,
      deferred: this.due.filter((e) => e.active && (e.initial || e.elapsed > 0)).length,
      hidden,
      droppedSeconds: this.dropped,
    };
  }
  remove(id: string): boolean {
    const e = this.entries.get(id);
    if (!e) return false;
    e.active = false;
    this.entries.delete(id);
    return true;
  }
  get size(): number {
    return this.entries.size;
  }
  dispose(): void {
    this.disposed = true;
    for (const e of this.entries.values()) e.active = false;
    this.entries.clear();
    this.due.length = 0;
  }
}

/** Public structural Animator properties. Native manager owns evaluation; this never manually ticks it. */
export interface CrowdAnimatorTarget {
  speed: number;
  updateMode: number;
  lowUpdateDelty: number;
}
export class ZhudaAnimatorLOD {
  private static readonly owners = new WeakSet<object>();
  private readonly target: CrowdAnimatorTarget;
  private readonly speed: number;
  private readonly restoreMode: number;
  private readonly restoreInterval: number;
  private disposed = false;
  /** Native updateMode/interval are write-only in 3.4.2. Pass original settings if non-default. */
  constructor(
    target: CrowdAnimatorTarget,
    restore: { updateMode?: number; lowUpdateInterval?: number } = {},
  ) {
    if (ZhudaAnimatorLOD.owners.has(target)) throw Error('Animator already has a LOD owner.');
    if (
      !Number.isFinite(target.speed) ||
      ![0, 1, 2].includes(restore.updateMode ?? 0) ||
      !Number.isInteger(restore.lowUpdateInterval ?? 1) ||
      (restore.lowUpdateInterval ?? 1) < 1 ||
      (restore.lowUpdateInterval ?? 1) > 60
    )
      throw Error('Invalid animator restoration settings.');
    ZhudaAnimatorLOD.owners.add(target);
    this.target = target;
    this.speed = target.speed;
    this.restoreMode = restore.updateMode ?? 0;
    this.restoreInterval = restore.lowUpdateInterval ?? 1;
  }
  set(mode: CrowdAnimationMode, frameInterval = 2): void {
    if (this.disposed) throw Error('Disposed animator LOD.');
    if (
      !['full', 'low', 'paused'].includes(mode) ||
      !Number.isInteger(frameInterval) ||
      frameInterval < 1 ||
      frameInterval > 60
    )
      throw Error('Invalid animation LOD.');
    this.target.speed = mode === 'paused' ? 0 : this.speed;
    this.target.lowUpdateDelty = frameInterval;
    this.target.updateMode = mode === 'low' ? 1 : 0;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ZhudaAnimatorLOD.owners.delete(this.target);
    this.target.speed = this.speed;
    this.target.updateMode = this.restoreMode;
    this.target.lowUpdateDelty = this.restoreInterval;
  }
}

export interface RemoteCharacterBinding<T> extends Omit<CrowdPresentationBinding, 'update'> {
  present(value: T, mode: 'held' | 'interpolated' | 'extrapolated', stale: boolean): void;
}
export interface RemoteCharacterPresenterOptions<T> extends CrowdSchedulerOptions {
  epoch: string;
  interpolate(a: T, b: T, t: number): T;
  maxExtrapolation?: number;
  snapshotCapacity?: number;
  staleAfterSeconds?: number;
}
/** Presentation composition only: transport, server time sync, AOI and combat authority are consumer-owned. */
export class ZhudaRemoteCharacterPresenter<T> {
  readonly scheduler: ZhudaCrowdScheduler;
  private readonly options: RemoteCharacterPresenterOptions<T>;
  private readonly entries = new Map<
    string,
    { buffer: ZhudaSnapshotBuffer<T>; latest: number; sequence: number }
  >();
  private epoch: string;
  private sampleTime = 0;
  constructor(options: RemoteCharacterPresenterOptions<T>) {
    if (
      !options.epoch ||
      !Number.isFinite(options.staleAfterSeconds ?? 0.5) ||
      (options.staleAfterSeconds ?? 0.5) < 0
    )
      throw Error('Invalid remote presentation bounds.');
    // Validate buffer bounds before any actors are registered.
    new ZhudaSnapshotBuffer(
      options.epoch,
      options.interpolate,
      options.maxExtrapolation,
      options.snapshotCapacity,
    );
    this.options = { ...options };
    this.epoch = options.epoch;
    this.scheduler = new ZhudaCrowdScheduler(options);
  }
  register(id: string, binding: RemoteCharacterBinding<T>, state: CrowdPresentationState): void {
    const entry = {
      buffer: new ZhudaSnapshotBuffer(
        this.epoch,
        this.options.interpolate,
        this.options.maxExtrapolation,
        this.options.snapshotCapacity,
      ),
      latest: -Infinity,
      sequence: -1,
    };
    this.scheduler.register(
      id,
      {
        setTier: binding.setTier?.bind(binding),
        update: () => {
          const sample = entry.buffer.sample(this.sampleTime);
          if (sample)
            binding.present(
              sample.value,
              sample.mode,
              this.sampleTime - entry.latest > (this.options.staleAfterSeconds ?? 0.5),
            );
        },
      },
      state,
    );
    this.entries.set(id, entry);
  }
  push(id: string, snapshot: TimedSnapshot<T>, teleport = false): boolean {
    const e = this.entries.get(id);
    // Validate before clearing a buffer: stale teleport packets must not reset newer state.
    if (
      !e ||
      snapshot.epoch !== this.epoch ||
      !Number.isInteger(snapshot.sequence) ||
      snapshot.sequence <= e.sequence ||
      !Number.isFinite(snapshot.time) ||
      snapshot.time <= e.latest
    )
      return false;
    if (teleport) e.buffer.reset(this.epoch);
    if (!e.buffer.push(snapshot)) return false;
    e.latest = snapshot.time;
    e.sequence = snapshot.sequence;
    return true;
  }
  update(deltaSeconds: number, serverSampleTime: number) {
    if (!Number.isFinite(serverSampleTime)) throw Error('Invalid server sample time.');
    this.sampleTime = serverSampleTime;
    return this.scheduler.update(deltaSeconds);
  }
  reset(epoch: string): void {
    if (!epoch) throw Error('Empty epoch.');
    this.epoch = epoch;
    for (const e of this.entries.values()) {
      e.buffer.reset(epoch);
      e.latest = -Infinity;
      e.sequence = -1;
    }
  }
  remove(id: string): boolean {
    this.entries.delete(id);
    return this.scheduler.remove(id);
  }
  dispose(): void {
    this.scheduler.dispose();
    this.entries.clear();
  }
}
