export interface ZhudaBufferedInput {
  action: string;
  time: number;
  sequence: number;
}

export interface ZhudaInputBufferOptions {
  /** Maximum age in the same clock units supplied to `push` and `consume`. */
  window?: number;
  capacity?: number;
}

/**
 * Bounded action-level input queue for fighting games.
 *
 * Platform adapters translate keyboard, touch or gamepad events into stable
 * action IDs and push them here. The buffer owns ordering and expiry only; it
 * does not decide whether an action is legal for the current game state.
 */
export class ZhudaInputBuffer {
  readonly window: number;
  readonly capacity: number;
  private entries: ZhudaBufferedInput[] = [];
  private nextSequence = 1;
  private lastTime = -Infinity;
  private disposed = false;

  constructor(options: ZhudaInputBufferOptions = {}) {
    this.window = options.window ?? 0.12;
    this.capacity = options.capacity ?? 32;
    if (!Number.isFinite(this.window) || this.window <= 0)
      throw Error('Invalid input buffer window');
    if (!Number.isSafeInteger(this.capacity) || this.capacity <= 0)
      throw Error('Invalid input buffer capacity');
  }

  push(action: string, time: number): boolean {
    this.ensureLive();
    if (typeof action !== 'string' || !action.trim() || !Number.isFinite(time))
      throw Error('Invalid buffered input');
    if (time < this.lastTime) return false;
    this.lastTime = time;
    this.entries.push({ action, time, sequence: this.nextSequence++ });
    this.prune(time);
    while (this.entries.length > this.capacity) this.entries.shift();
    return true;
  }

  has(action: string, time: number): boolean {
    this.ensureLive();
    this.validateRead(action, time);
    this.prune(time);
    return this.entries.some((entry) => entry.action === action);
  }

  /** Consumes the oldest matching action once. */
  consume(action: string, time: number): boolean {
    this.ensureLive();
    this.validateRead(action, time);
    this.prune(time);
    const index = this.entries.findIndex((entry) => entry.action === action);
    if (index < 0) return false;
    this.entries.splice(index, 1);
    return true;
  }

  /** Consumes the oldest matching action from a set of alternatives. */
  consumeAny(actions: readonly string[], time: number): string | null {
    this.ensureLive();
    this.validateActions(actions);
    this.validateTime(time);
    this.prune(time);
    const accepted = new Set(actions);
    const index = this.entries.findIndex((entry) => accepted.has(entry.action));
    if (index < 0) return null;
    const [entry] = this.entries.splice(index, 1);
    return entry.action;
  }

  /**
   * Consumes an ordered combo such as `down`, `forward`, `attack`.
   * Unrelated actions may occur between combo steps; each accepted step must
   * arrive within `maxGap` of the previous accepted step.
   */
  consumeSequence(actions: readonly string[], time: number, maxGap = this.window): boolean {
    this.ensureLive();
    this.validateActions(actions);
    this.validateTime(time);
    if (!Number.isFinite(maxGap) || maxGap < 0) throw Error('Invalid combo gap');
    this.prune(time);
    const indexes: number[] = [];
    let searchFrom = 0;
    let previousTime = -Infinity;
    for (const action of actions) {
      let found = -1;
      for (let i = searchFrom; i < this.entries.length; i++) {
        const entry = this.entries[i];
        if (entry.action !== action || entry.time > time) continue;
        if (previousTime !== -Infinity && entry.time - previousTime > maxGap) break;
        found = i;
        break;
      }
      if (found < 0) return false;
      indexes.push(found);
      previousTime = this.entries[found].time;
      searchFrom = found + 1;
    }
    for (let i = indexes.length - 1; i >= 0; i--) this.entries.splice(indexes[i], 1);
    return true;
  }

  snapshot(time: number): readonly ZhudaBufferedInput[] {
    this.ensureLive();
    this.validateTime(time);
    this.prune(time);
    return this.entries.map((entry) => ({ ...entry }));
  }

  clear(): void {
    this.entries = [];
    this.lastTime = -Infinity;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  get size(): number {
    return this.entries.length;
  }
  get isDisposed(): boolean {
    return this.disposed;
  }

  private prune(time: number): void {
    const cutoff = time - this.window;
    while (this.entries.length && this.entries[0].time < cutoff) this.entries.shift();
  }

  private validateRead(action: string, time: number): void {
    if (typeof action !== 'string' || !action.trim()) throw Error('Invalid buffered input action');
    this.validateTime(time);
  }

  private validateTime(time: number): void {
    if (!Number.isFinite(time)) throw Error('Invalid buffered input time');
    if (time < this.lastTime) throw Error('Buffered input time moved backwards');
    this.lastTime = time;
  }

  private validateActions(actions: readonly string[]): void {
    if (
      !Array.isArray(actions) ||
      !actions.length ||
      actions.some((action) => typeof action !== 'string' || !action.trim())
    )
      throw Error('Invalid input action sequence');
  }

  private ensureLive(): void {
    if (this.disposed) throw Error('Disposed input buffer');
  }
}
