// Generated from TypeScript source; run npm run types:generate.
/**
 * Keeps a game inside its frame budget by moving between quality levels.
 *
 * Feed it the time of every frame. When frames run over the budget it steps
 * down at once; when they have fitted for a while it tries the next level up,
 * and if that level fails it comes back down and waits twice as long before
 * trying again, so it settles instead of flickering between two levels.
 * Pure: it decides, the caller applies the level (see `zhudaLookForQuality`).
 *
 * Given GPU frame times (`sample(frameMs, gpuMs)`, from
 * `ZhudaRuntimeProfiler.takeGpuMs()`), it holds the GPU time inside a band
 * round the budget instead: above the band it steps down, below it for a
 * calm stretch it tries a level up, inside it stays. A frame interval is
 * held at the display's refresh whatever the GPU does, so only the GPU time
 * says how much room there is. Without GPU times (WebGL here) the CPU rule
 * above decides; `basis` says which did.
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
    /**
     * The band GPU times are held in, as factors of the budget (default
     * [0.84, 1.16]): above it a level down, below it for a calm stretch a level
     * up. Used when at least half the frames of a window came with a GPU time.
     */
    gpuBand?: readonly [number, number];
    /** Frames averaged for one decision while warming up (`warm()`, default 12). */
    warmWindow?: number;
    /** While warming up, the calm needed before a level up, as a share of the usual wait (default 0.25). */
    warmCalmFactor?: number;
}
/** Which rule made a governor's last decision: GPU times in a band, or frame times over the budget. */
export type ZhudaQualityBasis = 'gpu' | 'cpu';
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
    private gpuSum;
    private gpuCount;
    private readonly band;
    private readonly warmWindow;
    private readonly warmCalmFactor;
    private warming;
    private lastBasis;
    constructor(options?: ZhudaQualityGovernorOptions);
    get level(): number;
    /** The rule of the last decision; undefined before the first window. */
    get basis(): ZhudaQualityBasis | undefined;
    /** Whether the governor is warming up (`warm()`). */
    get warmingUp(): boolean;
    /**
     * Warming up behind a start screen or a loading picture: decides on
     * shorter windows (`warmWindow`) and tries a level up after a shorter calm
     * (`warmCalmFactor`), so the level is settled before play. Fed by the same
     * frames as ever; `warm(false)` when play starts goes back to the usual
     * pace from a fresh window.
     */
    warm(on?: boolean): void;
    /**
     * One frame took `frameMs`; `gpuMs`, when there is one, is the GPU time of
     * a recent frame (it arrives a frame or more late). Returns the new level
     * when it changed, else undefined. Frames longer than a quarter second (a
     * tab switch, a load) are not the renderer's fault and are ignored, as are
     * frames of no time.
     */
    sample(frameMs: number, gpuMs?: number): number | undefined;
    /** Forget the history, for example after a scene change. */
    reset(level?: number): void;
}
/**
 * One rung of a quality ladder: a look quality level (see
 * `zhudaLookForQuality`, 3 as authored), the size the 3D picture is drawn
 * at (see `ZhudaRenderScale`) and `detail`, the share of its own distances a
 * scene keeps (draw distance, grass reach, culling of small things), 0.4..1,
 * absent meaning 1. The engine does not apply `detail`: the scene multiplies
 * it into the distances it owns.
 */
export interface ZhudaQualityStep {
    look: 0 | 1 | 2 | 3;
    renderScale: number;
    detail?: number;
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
    /**
     * Detail rungs below 1, from the largest, each 0.4..1 (default none): the
     * scene's distances are cut to these shares one rung at a time. The rungs
     * below keep the smallest of them.
     */
    details?: readonly number[];
    /**
     * The render scale (one of `scales`) at which the detail rungs come: the
     * picture shrinks to it, then the distances are cut, then the rest of the
     * scales and the look levels follow. Default: the middle of `scales`
     * (0.85 of the default), the order Abyssal Garden uses; the largest scale
     * cuts distances before any pixel goes, the smallest after every one.
     */
    detailAt?: number;
}
/**
 * A ladder for `ZhudaQualityGovernor`: index 0 is the cheapest rung and the
 * last is the authored look at full size, so a governor made with
 * `levels: steps.length` walks it (`steps[governor.level]`). Each rung down
 * draws less than the one above it: first the picture gets smaller, then
 * (with `details`) the scene's distances are cut, then the rest of the
 * picture sizes go, then effects go at the smallest of those sizes, last the
 * picture shrinks again. Every rung carries `detail` (1 without `details`).
 * The default rungs are a proposal. One phone has measured the scale in one
 * game (docs/plans/records/frame-cost): 0.67 took 25 to 30 % off a frame at
 * look levels 1 and 2 and under a tenth at level 0, where the frame is no
 * longer bound by its pixels; the rungs were not tuned from that.
 */
export declare function zhudaQualitySteps(options?: ZhudaQualityStepsOptions): ZhudaQualityStep[];
