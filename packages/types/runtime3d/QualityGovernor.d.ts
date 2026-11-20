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
     * A rung at look level 1 drawn at `lowest`, between level 1 at the smallest
     * of `scales` and level 0 (default true; nothing without `lowest`): the
     * last rung that keeps the HDR chain. On a phone bound by its pixels it
     * holds 60 frames a second where level 1 at 0.7 does not
     * (docs/plans/records/quality-tiers).
     */
    effectsAtLowest?: boolean;
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
 * picture sizes go, then effects go at the smallest of those sizes, then
 * the picture shrinks once more with the HDR chain still on (level 1 at
 * `lowest`), then the chain goes, last the picture shrinks again. Every rung
 * carries `detail` (1 without `details`).
 *
 * Measured (docs/plans/records/quality-tiers, one synthetic scene): on a
 * vivo V40 the picture's size decides, level 1 at 0.7 reads 57 frames a
 * second and at 0.5 it reads 60, so the rung at `lowest` keeps bloom, fog
 * and the grade where the ladder used to drop to level 0. On an iPhone 14
 * the number of draws decides and a smaller picture gains less. One game on
 * one phone before that (docs/plans/records/frame-cost): 0.67 took 25 to
 * 30 % off a frame at look levels 1 and 2 and under a tenth at level 0.
 */
export declare function zhudaQualitySteps(options?: ZhudaQualityStepsOptions): ZhudaQualityStep[];
/**
 * The owner's three frame-rate tiers (docs/plans/records/quality-tiers), by
 * the frames a second a device holds: `low` is 60 and over on every target,
 * `high` is 45 to 60 with the picture as good as it can be made, `extreme`
 * is 10 to 45, the picture as perfect as possible, for taking pictures.
 */
export type ZhudaFrameTier = 'low' | 'high' | 'extreme';
/** Each tier's band: at least `minFps`, under `belowFps` (none for `low`). */
export declare const ZHUDA_FRAME_TIERS: Readonly<Record<ZhudaFrameTier, {
    readonly minFps: number;
    readonly belowFps?: number;
}>>;
/**
 * The tier a measured rate falls in, or null under 10 frames a second. A
 * display paces frames a little under its nominal rate (59.7 on a 60 Hz
 * screen): `tolerance` (default 1) is taken off each lower bound.
 */
export declare function zhudaFrameTier(fps: number, tolerance?: number): ZhudaFrameTier | null;
/**
 * The frame budget that holds a tier, for `ZhudaQualityGovernor`'s
 * `budgetMs`: the governor steps down while frames run over it, so the rate
 * stays at or over the tier's lower bound (16.7 ms, 22.2 ms, 100 ms).
 */
export declare function zhudaTierBudgetMs(tier: ZhudaFrameTier): number;
/** What a frame issued: its draws, and (WebGL) how often it went to another render target. */
export interface ZhudaFrameLoad {
    drawCalls: number;
    renderTargets?: number;
}
/** Draws a frame above which `zhudaFrameLoadAdvice` speaks, unless told otherwise. */
export declare const ZHUDA_DRAW_ADVICE_FROM = 500;
/**
 * What to do about a frame that issues many draws, as sentences; none when
 * it does not. Measured on an iPhone 14's Safari
 * (docs/plans/records/quality-tiers): issuing about 1100 draws took 10 to
 * 15 ms of a 16.7 ms frame and a smaller picture gained nothing; the same
 * houses as instanced copies, about 300 draws, took 4 ms. A phone's Chrome
 * and a desktop pay less a draw. One phone, one scene: a line to look at,
 * not a limit.
 */
export declare function zhudaFrameLoadAdvice(load: ZhudaFrameLoad, options?: {
    from?: number;
}): string[];
