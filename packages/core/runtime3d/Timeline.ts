export type TimelineValue = number | boolean | string | readonly number[];
export type TimelineTrackKind = 'number' | 'boolean' | 'vector' | 'event';
export interface TimelineKey<T extends TimelineValue = TimelineValue> { time: number; value: T; }
export interface TimelineTrack {
  id: string;
  target: string;
  kind: TimelineTrackKind;
  interpolation?: 'step' | 'linear';
  keys: readonly TimelineKey[];
}
export interface ZhudaTimelineSpec {
  schemaVersion: 1;
  duration: number;
  tracks: readonly TimelineTrack[];
}
export interface ZhudaTimelineBinding {
  set?(value: TimelineValue, time: number, track: Readonly<TimelineTrack>): void;
  cue?(value: string, time: number, track: Readonly<TimelineTrack>): void;
}
export interface ZhudaTimelineSeekOptions { emitEvents?: boolean; }

export interface ZhudaOfflineFrame {
  readonly index: number;
  readonly time: number;
  readonly deltaSeconds: number;
}

export interface ZhudaOfflineFrameCapture {
  readonly ready: true;
  readonly imagePath: string;
  readonly imageSha256?: string;
  readonly referenceSha256?: string;
  readonly metrics?: Readonly<Record<string, number>>;
}

export interface ZhudaOfflineFrameRecorderOptions {
  /** Total duration, including the frame at t=0. */
  readonly durationSeconds: number;
  /** Fixed output rate. durationSeconds * fps must be an integer. */
  readonly fps: number;
  readonly maxFrames?: number;
  readonly signal?: AbortSignal;
  /** Advance the consumer timeline by the supplied fixed frame. */
  readonly advance: (frame: ZhudaOfflineFrame) => void | Promise<void>;
  /** Capture one frame after advance has completed. */
  readonly capture: (frame: ZhudaOfflineFrame) => ZhudaOfflineFrameCapture | Promise<ZhudaOfflineFrameCapture>;
}

const abortOffline = () => new DOMException('Offline frame recording cancelled', 'AbortError');

function validateFrameCapture(value: ZhudaOfflineFrameCapture): ZhudaOfflineFrameCapture {
  if (!value || value.ready !== true || typeof value.imagePath !== 'string' || !value.imagePath)
    throw Error('Offline frame capture must provide ready:true and imagePath.');
  if (value.metrics !== undefined) {
    if (!value.metrics || typeof value.metrics !== 'object' || Array.isArray(value.metrics))
      throw Error('Offline frame metrics must be an object.');
    for (const [key, metric] of Object.entries(value.metrics))
      if (!Number.isFinite(metric)) throw Error(`Offline frame metric ${key} must be finite.`);
  }
  return Object.freeze({ ...value, metrics: value.metrics ? Object.freeze({ ...value.metrics }) : undefined });
}

function sameShape(a: TimelineValue, b: TimelineValue, kind: TimelineTrackKind): boolean {
  if (kind === 'number') return typeof a === 'number' && typeof b === 'number';
  if (kind === 'boolean') return typeof a === 'boolean' && typeof b === 'boolean';
  if (kind === 'event') return typeof a === 'string' && typeof b === 'string';
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(Number.isFinite) && b.every(Number.isFinite);
}

export function validateTimelineSpec(spec: unknown): string[] {
  const errors: string[] = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return ['Timeline spec must be an object.'];
  const value = spec as Partial<ZhudaTimelineSpec>;
  if (value.schemaVersion !== 1) errors.push('Timeline schemaVersion must be 1.');
  if (!Number.isFinite(value.duration) || (value.duration ?? 0) <= 0) errors.push('Timeline duration must be positive.');
  if (!Array.isArray(value.tracks) || !value.tracks.length) errors.push('Timeline requires at least one track.');
  const ids = new Set<string>();
  for (const [index, track] of (value.tracks ?? []).entries()) {
    if (!track || typeof track !== 'object') { errors.push(`Track ${index} must be an object.`); continue; }
    const t = track as TimelineTrack;
    if (!t.id || ids.has(t.id)) errors.push(`Track ${index} has a duplicate or empty id.`); else ids.add(t.id);
    if (!t.target) errors.push(`Track ${index} target is required.`);
    if (!['number', 'boolean', 'vector', 'event'].includes(t.kind)) errors.push(`Track ${index} kind is invalid.`);
    if (!Array.isArray(t.keys) || !t.keys.length) { errors.push(`Track ${index} requires keys.`); continue; }
    let previous = -Infinity;
    for (const [keyIndex, key] of t.keys.entries()) {
      if (!key || !Number.isFinite(key.time) || key.time < 0 || key.time > (value.duration ?? 0) || key.time <= previous) errors.push(`Track ${index} key ${keyIndex} time is invalid or not increasing.`);
      previous = key?.time ?? previous;
      if (!key || !sameShape(key.value, key.value, t.kind)) errors.push(`Track ${index} key ${keyIndex} value does not match ${t.kind}.`);
      if (t.kind === 'vector' && Array.isArray(key?.value) && key.value.length === 0) errors.push(`Track ${index} vector cannot be empty.`);
    }
    if (t.kind === 'event' && t.interpolation === 'linear') errors.push(`Track ${index} event interpolation must be step.`);
  }
  return errors;
}

function cloneValue(value: TimelineValue): TimelineValue { return Array.isArray(value) ? [...value] : value; }
function valueAt(track: TimelineTrack, time: number): TimelineValue {
  const keys = track.keys;
  if (time <= keys[0].time) return cloneValue(keys[0].value);
  const last = keys[keys.length - 1];
  if (time >= last.time) return cloneValue(last.value);
  let next = 1; while (next < keys.length && keys[next].time < time) next++;
  const a = keys[next - 1], b = keys[next];
  if (track.kind !== 'number' && track.kind !== 'vector' || track.interpolation === 'step') return cloneValue(a.value);
  const t = (time - a.time) / (b.time - a.time);
  if (track.kind === 'number') return (a.value as number) + ((b.value as number) - (a.value as number)) * t;
  return (a.value as readonly number[]).map((v, i) => v + ((b.value as readonly number[])[i] - v) * t);
}

/** Deterministic presentation timeline. The consumer supplies the clock and bindings. */
export class ZhudaTimelineSequencer {
  readonly spec: Readonly<ZhudaTimelineSpec>;
  private readonly bindings: Readonly<Record<string, ZhudaTimelineBinding>>;
  private time = 0;
  private disposed = false;
  constructor(spec: ZhudaTimelineSpec, bindings: Record<string, ZhudaTimelineBinding>) {
    const errors = validateTimelineSpec(spec);
    if (errors.length) throw Error(errors.join(' '));
    this.spec = Object.freeze({ schemaVersion: 1 as const, duration: spec.duration, tracks: spec.tracks.map(track => Object.freeze({ ...track, keys: track.keys.map(key => Object.freeze({ time: key.time, value: cloneValue(key.value) })) })) });
    this.bindings = Object.freeze({ ...bindings });
    for (const track of this.spec.tracks) if (!this.bindings[track.target]) throw Error(`Missing timeline binding: ${track.target}`);
    this.apply(this.time, false);
  }
  private check() { if (this.disposed) throw Error('Disposed timeline sequencer.'); }
  private apply(time: number, emitEvents: boolean, from = this.time) {
    for (const track of this.spec.tracks) {
      const binding = this.bindings[track.target];
      if (track.kind === 'event') {
        if (emitEvents && time >= from) for (const key of track.keys) if (key.time > from && key.time <= time) binding.cue?.(key.value as string, key.time, track);
      } else binding.set?.(valueAt(track, time), time, track);
    }
  }
  sample(time: number): Readonly<Record<string, TimelineValue>> {
    this.check(); if (!Number.isFinite(time) || time < 0 || time > this.spec.duration) throw Error('Timeline sample is outside duration.');
    return Object.freeze(Object.fromEntries(this.spec.tracks.filter(track => track.kind !== 'event').map(track => [track.target, valueAt(track, time)])));
  }
  seek(time: number, options: ZhudaTimelineSeekOptions = {}): void {
    this.check(); if (!Number.isFinite(time) || time < 0 || time > this.spec.duration) throw Error('Timeline seek is outside duration.');
    const from = this.time; this.time = time; this.apply(time, options.emitEvents === true, from);
  }
  update(deltaSeconds: number): number {
    this.check(); if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || deltaSeconds > 10) throw Error('Timeline delta must be 0..10 seconds.');
    const from = this.time; this.time = Math.min(this.spec.duration, this.time + deltaSeconds); this.apply(this.time, true, from); return this.time;
  }
  reset(): void { this.seek(0); }
  get currentTime(): number { return this.time; }
  get complete(): boolean { return this.time >= this.spec.duration; }
  dispose(): void { this.disposed = true; }
}

/**
 * Fixed-step capture driver for cinematic evidence and offline producers.
 * It advances a consumer callback; it does not own a renderer, clock, file
 * system or encoder. The caller remains responsible for real pixel capture.
 */
export class ZhudaOfflineFrameRecorder {
  private readonly options: ZhudaOfflineFrameRecorderOptions;
  private readonly frameCount: number;
  private disposed = false;
  private recording = false;
  constructor(options: ZhudaOfflineFrameRecorderOptions) {
    if (!options || !Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0)
      throw Error('Offline duration must be positive.');
    if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 1000)
      throw Error('Offline fps must be 0..1000.');
    const exactFrames = options.durationSeconds * options.fps;
    if (!Number.isSafeInteger(Math.round(exactFrames)) || Math.abs(exactFrames - Math.round(exactFrames)) > 1e-7)
      throw Error('Offline durationSeconds * fps must be an integer.');
    this.frameCount = Math.round(exactFrames) + 1;
    const maxFrames = options.maxFrames ?? 100_000;
    if (!Number.isSafeInteger(maxFrames) || maxFrames <= 0 || this.frameCount > maxFrames)
      throw Error('Offline frame count exceeds maxFrames.');
    if (typeof options.advance !== 'function' || typeof options.capture !== 'function')
      throw Error('Offline recorder requires advance and capture callbacks.');
    this.options = options;
  }
  private check() {
    if (this.disposed) throw Error('Disposed offline frame recorder.');
    if (this.options.signal?.aborted) throw abortOffline();
  }
  async record(): Promise<readonly (ZhudaOfflineFrame & { readonly capture: ZhudaOfflineFrameCapture })[]> {
    this.check();
    if (this.recording) throw Error('Offline frame recorder is already recording.');
    this.recording = true;
    const frames: (ZhudaOfflineFrame & { readonly capture: ZhudaOfflineFrameCapture })[] = [];
    const deltaSeconds = 1 / this.options.fps;
    try {
      for (let index = 0; index < this.frameCount; index++) {
        this.check();
        const frame = Object.freeze({ index, time: index * deltaSeconds, deltaSeconds: index === 0 ? 0 : deltaSeconds });
        await this.options.advance(frame);
        this.check();
        const capture = validateFrameCapture(await this.options.capture(frame));
        this.check();
        frames.push(Object.freeze({ ...frame, capture }));
      }
      return Object.freeze(frames);
    } finally {
      this.recording = false;
    }
  }
  dispose(): void { this.disposed = true; }
}
