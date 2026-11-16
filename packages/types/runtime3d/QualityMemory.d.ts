// Generated from TypeScript source; run npm run types:generate.
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
export declare const ZHUDA_QUALITY_MEMORY_VERSION = 1;
export declare class ZhudaQualityMemory {
    readonly key: string;
    readonly levels: number;
    private readonly storage;
    private readonly recordKey;
    private readonly loadingKey;
    constructor(options: ZhudaQualityMemoryOptions);
    /** The kept record, or undefined when there is none that fits this ladder. */
    read(): ZhudaQualityRecord | undefined;
    /**
     * Keeps a level (and what it is drawn at). Call it when the governor
     * changes level, not every frame. False when nothing could be kept.
     */
    write(record: {
        level: number;
        renderScale?: number;
        detail?: number;
    }): boolean;
    /** Whether a load was begun and never ended (by this visit or an earlier one). */
    get loadUnfinished(): boolean;
    /**
     * The level to start at: the kept one, else `fallback`; one lower (kept as
     * the new level) when the last load never reached its first frame. Call it
     * before `beginLoad`.
     */
    startLevel(fallback: number): number;
    /** Before the heavy build: sets the sentinel. False when the storage refused. */
    beginLoad(): boolean;
    /** The first frame drew, or the page was hidden: clears the sentinel. */
    endLoad(): boolean;
    /** Forgets the record and the sentinel. */
    clear(): void;
    private get;
    private set;
    private remove;
}
