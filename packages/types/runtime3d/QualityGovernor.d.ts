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
     * not the renderer's fault and are ignored, as are frames of no time.
     */
    sample(frameMs: number): number | undefined;
    /** Forget the history, for example after a scene change. */
    reset(level?: number): void;
}
/**
 * One rung of a quality ladder: a look quality level (see
 * `zhudaLookForQuality`, 3 as authored) and the size the 3D picture is
 * drawn at (see `ZhudaRenderScale`).
 */
export interface ZhudaQualityStep {
    look: 0 | 1 | 2 | 3;
    renderScale: number;
}
export interface ZhudaQualityStepsOptions {
    /**
     * Render scales tried at the authored look before any effect is dropped,
     * from the largest, each 0.5..1 (default [1, 0.85, 0.7]). The look levels
     * below are drawn at the last of them.
     */
    scales?: readonly number[];
    /** A last rung at look level 0 drawn smaller still, 0.5..1 (default 0.5); `false` for none. */
    lowest?: number | false;
}
/**
 * A ladder for `ZhudaQualityGovernor`: index 0 is the cheapest rung and the
 * last is the authored look at full size, so a governor made with
 * `levels: steps.length` walks it (`steps[governor.level]`). Each rung down
 * draws less than the one above it: first the picture gets smaller, then
 * effects go at the smallest of those sizes, last the picture shrinks again.
 * The default rungs are a proposal: no phone has measured them yet.
 */
export declare function zhudaQualitySteps(options?: ZhudaQualityStepsOptions): ZhudaQualityStep[];
