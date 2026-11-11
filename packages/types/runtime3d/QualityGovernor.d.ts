// Generated from TypeScript source; run npm run types:generate.
/**
 * Keeps a game inside its frame budget by moving between quality levels.
 *
 * Feed it the time of every frame. When frames run over the budget it steps
 * down at once; when they have fitted for a while it tries the next level up,
 * and if that level fails it comes back down and waits twice as long before
 * trying again, so it settles instead of flickering between two levels.
 * Pure: it decides, the caller applies the level (see `zhudaLookForQuality`).
 */
export interface ZhudaQualityGovernorOptions {
    /** Levels 0..levels-1; the highest is the best picture (default 4). */
    levels?: number;
    /** Level to start at (default: the highest). */
    start?: number;
    /** Frame budget in milliseconds (default 16.7). */
    budgetMs?: number;
    /** Frames averaged for one decision (default 30). */
    window?: number;
    /** Step down when the average exceeds the budget by this factor (default 1.12). */
    overFactor?: number;
    /** Seconds inside the budget before the next level up is tried (default 4). */
    calmSeconds?: number;
    /** The longest wait before trying a level that failed again (default 120 seconds). */
    maxCalmSeconds?: number;
}
export declare class ZhudaQualityGovernor {
    readonly levels: number;
    readonly budgetMs: number;
    private current;
    private readonly window;
    private readonly overFactor;
    private readonly calmSeconds;
    private readonly maxCalmSeconds;
    private sum;
    private count;
    private calm;
    /** Seconds to wait before trying each level again; grows when a level fails. */
    private readonly wait;
    /** The level just stepped up to is on trial for a few windows. */
    private trial;
    constructor(options?: ZhudaQualityGovernorOptions);
    get level(): number;
    /**
     * One frame took `frameMs`. Returns the new level when it changed, else
     * undefined. Frames longer than a quarter second (a tab switch, a load) are
     * not the renderer's fault and are ignored.
     */
    sample(frameMs: number): number | undefined;
    /** Forget the history, for example after a scene change. */
    reset(level?: number): void;
}
