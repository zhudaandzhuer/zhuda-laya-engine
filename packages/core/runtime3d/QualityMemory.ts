/**
 * The quality a game settled on, kept for its next visit, and a sign that a
 * load never reached its first frame.
 *
 * `ZhudaQualityMemory` keeps the governor's level (and the render scale and
 * detail it was drawn at) in a storage the game passes, `localStorage` for
 * example, under a key the game names; the engine keeps no store of its own.
 * The next visit starts from it instead of from the top and settling again.
 *
 * The load sentinel: `beginLoad()` before the heavy build, `endLoad()` when
 * the first frame has drawn or the page is hidden. Still set on the next
 * start means that load ended the tab (out of memory, a lost GPU), and
 * `startLevel` starts one level lower, keeping that lower level, so a load
 * that fails again goes lower again. The engine adds no page listener: the
 * game calls `endLoad` from its own first frame and `visibilitychange`.
 *
 * Every read and write is guarded: a storage that throws (private browsing,
 * blocked site data), is empty, holds a record of another version or of a
 * ladder of another length, or holds anything malformed, reads as nothing
 * kept, and the game starts from its default.
 */

/** What `ZhudaQualityMemory` needs of a storage; `localStorage` and `sessionStorage` have it. */
export interface ZhudaQualityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A kept quality: the governor's level, on a ladder of `levels` rungs. */
export interface ZhudaQualityRecord {
  level: number;
  levels: number;
  /** The render scale the level was drawn at, for a game that applies it before the look exists. */
  renderScale?: number;
  /** The detail the level was drawn at. */
  detail?: number;
}

export interface ZhudaQualityMemoryOptions {
  /** The game's name for its record: 1..64 of letters, digits and `._:-`. */
  key: string;
  /** Where the record lives; `null` or undefined keeps nothing (every read is empty). */
  storage: ZhudaQualityStorage | null | undefined;
  /** The length of the ladder the levels belong to (`steps.length`), 1..64. */
  levels: number;
}

/** The format of the kept record; a record of another version is ignored. */
export const ZHUDA_QUALITY_MEMORY_VERSION = 1;

export class ZhudaQualityMemory {
  readonly key: string;
  readonly levels: number;
  private readonly storage: ZhudaQualityStorage | null;
  private readonly recordKey: string;
  private readonly loadingKey: string;

  constructor(options: ZhudaQualityMemoryOptions) {
    const { key, storage, levels } = options ?? ({} as ZhudaQualityMemoryOptions);
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(key))
      throw Error('Quality memory: key is 1..64 of letters, digits and ._:-');
    if (!Number.isInteger(levels) || levels < 1 || levels > 64)
      throw Error('Quality memory: levels is the ladder length, 1..64');
    if (
      storage != null &&
      !['getItem', 'setItem', 'removeItem'].every(
        (name) => typeof (storage as any)[name] === 'function',
      )
    )
      throw Error('Quality memory: storage needs getItem, setItem and removeItem');
    this.key = key;
    this.levels = levels;
    this.storage = storage ?? null;
    // The version is in the key: a record of another format is never read.
    this.recordKey = `zhuda-quality-v${ZHUDA_QUALITY_MEMORY_VERSION}:${key}`;
    this.loadingKey = this.recordKey + ':loading';
  }

  /** The kept record, or undefined when there is none that fits this ladder. */
  read(): ZhudaQualityRecord | undefined {
    const text = this.get(this.recordKey);
    if (!text) return undefined;
    let value: any;
    try {
      value = JSON.parse(text);
    } catch {
      return undefined;
    }
    if (
      !value ||
      typeof value !== 'object' ||
      value.v !== ZHUDA_QUALITY_MEMORY_VERSION ||
      value.levels !== this.levels ||
      !Number.isInteger(value.level) ||
      value.level < 0 ||
      value.level >= this.levels
    )
      return undefined;
    const record: ZhudaQualityRecord = { level: value.level, levels: value.levels };
    if (typeof value.renderScale === 'number' && value.renderScale >= 0.5 && value.renderScale <= 1)
      record.renderScale = value.renderScale;
    if (typeof value.detail === 'number' && value.detail >= 0.4 && value.detail <= 1)
      record.detail = value.detail;
    return record;
  }

  /**
   * Keeps a level (and what it is drawn at). Call it when the governor
   * changes level, not every frame. False when nothing could be kept.
   */
  write(record: { level: number; renderScale?: number; detail?: number }): boolean {
    const level = record?.level;
    if (!Number.isInteger(level) || level < 0 || level >= this.levels)
      throw Error('Quality memory: level is 0..levels-1');
    const value: Record<string, number> = {
      v: ZHUDA_QUALITY_MEMORY_VERSION,
      level,
      levels: this.levels,
    };
    if (record.renderScale !== undefined) {
      if (!(record.renderScale >= 0.5 && record.renderScale <= 1))
        throw Error('Quality memory: renderScale is 0.5..1');
      value.renderScale = record.renderScale;
    }
    if (record.detail !== undefined) {
      if (!(record.detail >= 0.4 && record.detail <= 1))
        throw Error('Quality memory: detail is 0.4..1');
      value.detail = record.detail;
    }
    return this.set(this.recordKey, JSON.stringify(value));
  }

  /** Whether a load was begun and never ended (by this visit or an earlier one). */
  get loadUnfinished(): boolean {
    return this.get(this.loadingKey) === '1';
  }

  /**
   * The level to start at: the kept one, else `fallback`; one lower (kept as
   * the new level) when the last load never reached its first frame. Call it
   * before `beginLoad`.
   */
  startLevel(fallback: number): number {
    if (!Number.isInteger(fallback) || fallback < 0 || fallback >= this.levels)
      throw Error('Quality memory: fallback is a level 0..levels-1');
    const kept = this.read();
    let level = kept?.level ?? fallback;
    if (this.loadUnfinished && level > 0) {
      level--;
      this.write({ level });
    }
    return level;
  }

  /** Before the heavy build: sets the sentinel. False when the storage refused. */
  beginLoad(): boolean {
    return this.set(this.loadingKey, '1');
  }

  /** The first frame drew, or the page was hidden: clears the sentinel. */
  endLoad(): boolean {
    return this.remove(this.loadingKey);
  }

  /** Forgets the record and the sentinel. */
  clear(): void {
    this.remove(this.recordKey);
    this.remove(this.loadingKey);
  }

  private get(key: string): string | null {
    try {
      const value = this.storage?.getItem(key);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  private set(key: string, value: string): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private remove(key: string): boolean {
    if (!this.storage) return false;
    try {
      this.storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}
