import {withDeadline} from './AsyncDeadline.ts';
export type ZhudaJsonValue = null | boolean | number | string | readonly ZhudaJsonValue[] | {readonly [key: string]: ZhudaJsonValue};
export interface ZhudaResultScope {readonly gameId: string; readonly sessionId: string; readonly epoch: string;}
export interface ZhudaResultEnvelope<T extends ZhudaJsonValue = ZhudaJsonValue> extends ZhudaResultScope {
  readonly schemaVersion: 1;
  readonly roundId: string;
  readonly sequence: number;
  readonly resultVersion: string;
  readonly payload: T;
}
export interface ZhudaPlaybackCheckpoint<T extends ZhudaJsonValue = ZhudaJsonValue> extends ZhudaResultScope {
  readonly schemaVersion: 1;
  readonly result: ZhudaResultEnvelope<T> | null;
  readonly cursor: number;
  readonly completed: boolean;
}
/** One exclusively owned key per scope. write must be synchronous and atomic or throw.
 * An async/backend store must reconcile through recover; do not acknowledge before durable write. */
export interface ZhudaPlaybackStore {
  read(key: string): unknown;
  write(key: string, checkpoint: ZhudaPlaybackCheckpoint): void;
}
/** Backend authenticates/authorizes results. Engine only coordinates presentation. */
export interface ZhudaResultRecovery<T extends ZhudaJsonValue> {
  reconcile(checkpoint: ZhudaPlaybackCheckpoint<T>, signal: AbortSignal): Promise<ZhudaResultEnvelope<T> | null>;
}
function identity(value: unknown): void {
  if (typeof value !== 'string' || !value || value.length > 256) throw Error('Invalid result identity');
}
function canonical(value: unknown, depth = 0): string {
  if (depth > 64) throw Error('Result exceeds JSON depth');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, v => canonical(v, depth + 1)).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k], depth + 1)).join(',') + '}';
  throw Error('Result must contain finite JSON values');
}
const clone = <T>(value: T): T => JSON.parse(canonical(value)) as T;
/** Bounded last-result checkpoint, not a transaction journal or TTL event gate.
 * New instances start locked until authoritative recovery. No timer drives presentation. */
export class ZhudaResultPlayback<T extends ZhudaJsonValue> {
  private state: ZhudaPlaybackCheckpoint<T>;
  private readonly scope: ZhudaResultScope;
  private readonly key: string;
  private ready = false;
  private disposed = false;
  private pending: AbortController | null = null;
  constructor(options: {scope: ZhudaResultScope; store: ZhudaPlaybackStore; validate: (result: ZhudaResultEnvelope<T>) => void; validateCursor?: (result: ZhudaResultEnvelope<T>, cursor: number, completed: boolean) => void}) {
    this.scope = {...options.scope}; this.store = options.store; this.validate = options.validate; this.validateCursor = options.validateCursor;
    for (const field of ['gameId','sessionId','epoch'] as const) identity(this.scope[field]);
    this.key = 'zhuda:playback:' + JSON.stringify([this.scope.gameId, this.scope.sessionId, this.scope.epoch]);
    const stored = this.store.read(this.key);
    this.state = stored == null ? {schemaVersion:1, ...this.scope, result:null, cursor:0, completed:false} : this.checkpoint(stored);
  }
  private readonly store: ZhudaPlaybackStore;
  private readonly validate: (result: ZhudaResultEnvelope<T>) => void;
  private readonly validateCursor?: (result: ZhudaResultEnvelope<T>, cursor: number, completed: boolean) => void;
  private checkScope(value: ZhudaResultScope): void {
    for (const field of ['gameId','sessionId','epoch'] as const) if (value[field] !== this.scope[field]) throw Error('Result scope mismatch: ' + field);
  }
  private result(value: ZhudaResultEnvelope<T>): ZhudaResultEnvelope<T> {
    if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.sequence) || value.sequence < 1) throw Error('Invalid result envelope');
    this.checkScope(value); identity(value.roundId); identity(value.resultVersion);
    const copy = clone(value); this.validate(clone(copy)); return copy;
  }
  private checkpoint(value: unknown): ZhudaPlaybackCheckpoint<T> {
    const state = clone(value) as ZhudaPlaybackCheckpoint<T>;
    if (!state || state.schemaVersion !== 1 || !Number.isSafeInteger(state.cursor) || state.cursor < 0 || typeof state.completed !== 'boolean') throw Error('Invalid playback checkpoint');
    this.checkScope(state);
    if (state.result === null) {if (state.cursor !== 0 || state.completed) throw Error('Invalid empty checkpoint');}
    else {this.result(state.result); this.validateCursor?.(clone(state.result), state.cursor, state.completed);}
    return state;
  }
  private persist(state: ZhudaPlaybackCheckpoint<T>): void {
    const checked = this.checkpoint(state);
    this.store.write(this.key, clone(checked)); // Failure must preserve previous in-memory state.
    this.state = checked;
  }
  private alive(): void {if (this.disposed) throw Error('Disposed result playback');}
  private writable(): void {this.alive(); if (!this.ready || this.pending) throw Error('Playback locked; authoritative recovery required');}
  get inputLocked(): boolean {return !this.ready || this.pending !== null || this.disposed;}
  snapshot(): ZhudaPlaybackCheckpoint<T> {return clone(this.state);}
  accept(value: ZhudaResultEnvelope<T>): 'accepted' | 'duplicate' | 'stale' {
    this.writable(); const next = this.result(value), previous = this.state.result;
    if (previous && next.sequence < previous.sequence) return 'stale';
    if (previous && next.sequence === previous.sequence) {
      if (canonical(next) !== canonical(previous)) throw Error('Conflicting result for sequence');
      return 'duplicate';
    }
    if (next.sequence !== (previous?.sequence ?? 0) + 1) throw Error('Result sequence gap; reconcile with authority');
    if (previous && (!this.state.completed || previous.roundId === next.roundId)) throw Error('Previous presentation incomplete or round ID reused');
    this.persist({...this.state, result:next, cursor:0, completed:false}); return 'accepted';
  }
  /** Consumer applies idempotent visual state then checkpoints; crashes may replay that state.
   * Never attach wallet/payment side effects to this method. */
  advance(sequence: number, cursor: number, completed = false): void {
    this.writable();
    if (!this.state.result || this.state.result.sequence !== sequence || this.state.completed || cursor < this.state.cursor || (cursor === this.state.cursor && !completed)) throw Error('Stale or regressing presentation cursor');
    this.persist({...this.state, cursor, completed});
  }
  /** On blur/context loss call suspend, cancel visual work and pause the existing session. */
  suspend(): void {this.ready = false; this.pending?.abort(new DOMException('Playback suspended', 'AbortError')); this.pending = null;}
  async recover(adapter: ZhudaResultRecovery<T>, options: {signal?: AbortSignal; timeoutMs?: number} = {}): Promise<void> {
    this.alive(); this.suspend();
    const controller = new AbortController(); this.pending = controller;
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, {once:true}); if (options.signal?.aborted) abort();
    try {
      const value = await withDeadline(signal => adapter.reconcile(this.snapshot(), signal), {signal:controller.signal, timeoutMs:options.timeoutMs});
      if (controller.signal.aborted || this.pending !== controller || this.disposed) throw new DOMException('Stale result recovery', 'AbortError');
      const next = value === null ? null : this.result(value), previous = this.state.result;
      if (previous && (!next || next.sequence < previous.sequence)) throw Error('Authoritative recovery regressed; require a new epoch');
      if (previous && next && next.sequence === previous.sequence) {
        if (canonical(next) !== canonical(previous)) throw Error('Conflicting authoritative recovery');
        this.persist(this.state);
      } else {
        if (previous && next?.roundId === previous.roundId) throw Error('Recovered round ID reused');
        this.persist({...this.state, result:next, cursor:0, completed:false});
      }
      this.ready = true;
    } finally {options.signal?.removeEventListener('abort', abort); if (this.pending === controller) this.pending = null;}
  }
  dispose(): void {if (this.disposed) return; this.disposed = true; this.suspend();}
}
