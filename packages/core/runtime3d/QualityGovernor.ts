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

export class ZhudaQualityGovernor {
  readonly levels: number;
  readonly budgetMs: number;
  private current: number;
  private readonly window: number;
  private readonly overFactor: number;
  private readonly calmSeconds: number;
  private readonly maxCalmSeconds: number;
  private sum = 0;
  private count = 0;
  private calm = 0;
  /** Seconds to wait before trying each level again; grows when a level fails. */
  private readonly wait: number[];
  /** The level just stepped up to is on trial for a few windows. */
  private trial = 0;
  private gpuSum = 0;
  private gpuCount = 0;
  private readonly band: readonly [number, number];
  private readonly warmWindow: number;
  private readonly warmCalmFactor: number;
  private warming = false;
  private lastBasis: ZhudaQualityBasis | undefined;

  constructor(options: ZhudaQualityGovernorOptions = {}) {
    const levels = options.levels ?? 4,
      budgetMs = options.budgetMs ?? 16.7,
      window = options.window ?? 30,
      overFactor = options.overFactor ?? 1.12,
      calmSeconds = options.calmSeconds ?? 4,
      maxCalmSeconds = options.maxCalmSeconds ?? 120,
      start = options.start ?? levels - 1,
      band = options.gpuBand ?? [0.84, 1.16],
      warmWindow = options.warmWindow ?? 12,
      warmCalmFactor = options.warmCalmFactor ?? 0.25;
    if (!Number.isInteger(levels) || levels < 1 || levels > 16) throw Error('levels: use 1..16');
    if (!Number.isInteger(start) || start < 0 || start >= levels)
      throw Error('start: use a level 0..levels-1');
    if (!(budgetMs > 0 && budgetMs <= 1000))
      throw Error('budgetMs: use a positive time up to 1000');
    if (!Number.isInteger(window) || window < 2 || window > 600) throw Error('window: use 2..600');
    if (!(overFactor >= 1 && overFactor <= 4)) throw Error('overFactor: use 1..4');
    if (!(calmSeconds > 0 && maxCalmSeconds >= calmSeconds))
      throw Error('calmSeconds must be positive and at most maxCalmSeconds');
    if (
      !Array.isArray(band) ||
      band.length !== 2 ||
      !(band[0] > 0 && band[0] < 1 && band[1] > 1 && band[1] <= 4)
    )
      throw Error('gpuBand: use [low, high] with 0 < low < 1 < high <= 4');
    if (!Number.isInteger(warmWindow) || warmWindow < 2 || warmWindow > 600)
      throw Error('warmWindow: use 2..600');
    if (!(warmCalmFactor > 0 && warmCalmFactor <= 1)) throw Error('warmCalmFactor: use 0..1');
    this.band = [band[0], band[1]];
    this.warmWindow = warmWindow;
    this.warmCalmFactor = warmCalmFactor;
    this.levels = levels;
    this.budgetMs = budgetMs;
    this.window = window;
    this.overFactor = overFactor;
    this.calmSeconds = calmSeconds;
    this.maxCalmSeconds = maxCalmSeconds;
    this.current = start;
    this.wait = Array(levels).fill(calmSeconds);
  }

  get level(): number {
    return this.current;
  }

  /** The rule of the last decision; undefined before the first window. */
  get basis(): ZhudaQualityBasis | undefined {
    return this.lastBasis;
  }

  /** Whether the governor is warming up (`warm()`). */
  get warmingUp(): boolean {
    return this.warming;
  }

  /**
   * Warming up behind a start screen or a loading picture: decides on
   * shorter windows (`warmWindow`) and tries a level up after a shorter calm
   * (`warmCalmFactor`), so the level is settled before play. Fed by the same
   * frames as ever; `warm(false)` when play starts goes back to the usual
   * pace from a fresh window.
   */
  warm(on = true): void {
    if (this.warming === on) return;
    this.warming = on;
    this.sum = this.count = this.gpuSum = this.gpuCount = this.calm = 0;
  }

  /**
   * One frame took `frameMs`; `gpuMs`, when there is one, is the GPU time of
   * a recent frame (it arrives a frame or more late). Returns the new level
   * when it changed, else undefined. Frames longer than a quarter second (a
   * tab switch, a load) are not the renderer's fault and are ignored, as are
   * frames of no time.
   */
  sample(frameMs: number, gpuMs?: number): number | undefined {
    if (!Number.isFinite(frameMs) || frameMs < 0) throw Error('Invalid frame time');
    if (gpuMs !== undefined) {
      if (!Number.isFinite(gpuMs) || gpuMs < 0) throw Error('Invalid GPU time');
      if (gpuMs > 0 && gpuMs <= 250) {
        this.gpuSum += gpuMs;
        this.gpuCount++;
      }
    }
    // A first frame or a paused clock reports no time at all.
    if (frameMs === 0 || frameMs > 250) return undefined;
    this.sum += frameMs;
    const window = this.warming ? this.warmWindow : this.window;
    if (++this.count < window) return undefined;
    const average = this.sum / this.count,
      seconds = this.sum / 1000,
      gpu = this.gpuCount * 2 >= this.count ? this.gpuSum / this.gpuCount : undefined;
    this.sum = this.count = this.gpuSum = this.gpuCount = 0;
    this.lastBasis = gpu === undefined ? 'cpu' : 'gpu';
    const over =
      gpu === undefined
        ? average > this.budgetMs * this.overFactor
        : gpu > this.budgetMs * this.band[1];
    if (over) {
      this.calm = 0;
      if (this.current === 0) return undefined;
      // A level that failed while on trial waits twice as long next time.
      if (this.trial > 0)
        this.wait[this.current] = Math.min(this.maxCalmSeconds, this.wait[this.current] * 2);
      this.trial = 0;
      return --this.current;
    }
    if (this.trial > 0) this.trial--;
    // With GPU times only a frame below the band leaves room for more.
    if (gpu !== undefined && gpu >= this.budgetMs * this.band[0]) {
      this.calm = 0;
      return undefined;
    }
    this.calm += seconds;
    const needed = this.current < this.levels - 1 ? this.wait[this.current + 1] : Infinity;
    if (this.calm >= needed * (this.warming ? this.warmCalmFactor : 1)) {
      this.calm = 0;
      this.trial = 3;
      return ++this.current;
    }
    return undefined;
  }

  /** Forget the history, for example after a scene change. */
  reset(level = this.current): void {
    if (!Number.isInteger(level) || level < 0 || level >= this.levels) throw Error('Invalid level');
    this.current = level;
    this.sum = this.count = this.calm = this.trial = this.gpuSum = this.gpuCount = 0;
    this.wait.fill(this.calmSeconds);
    this.lastBasis = undefined;
  }
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
export function zhudaQualitySteps(options: ZhudaQualityStepsOptions = {}): ZhudaQualityStep[] {
  const scales = options.scales ?? [1, 0.85, 0.7],
    lowest = options.lowest ?? 0.5,
    details = options.details ?? [];
  const valid = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 1;
  if (!Array.isArray(scales) || !scales.length || scales.length > 8 || !scales.every(valid))
    throw Error('Quality steps: scales are 1..8 render scales 0.5..1');
  if (scales.some((value, i) => i > 0 && value >= scales[i - 1]))
    throw Error('Quality steps: scales go from the largest down');
  const smallest = scales[scales.length - 1];
  if (lowest !== false && !(valid(lowest) && lowest < smallest))
    throw Error('Quality steps: lowest is a render scale 0.5..1 below the last of scales');
  if (
    !Array.isArray(details) ||
    details.length > 8 ||
    !details.every(
      (value, i) =>
        typeof value === 'number' &&
        value >= 0.4 &&
        value < 1 &&
        (i === 0 || value < details[i - 1]),
    )
  )
    throw Error(
      'Quality steps: details are up to 8 shares 0.4..1 (below 1), from the largest down',
    );
  const at = options.detailAt ?? scales[Math.floor((scales.length - 1) / 2)];
  const atIndex = scales.indexOf(at);
  if (atIndex < 0) throw Error('Quality steps: detailAt is one of scales');
  const best: ZhudaQualityStep[] = [];
  let detail = 1;
  scales.forEach((renderScale, i) => {
    best.push({ look: 3, renderScale, detail });
    if (i === atIndex)
      for (const share of details) best.push({ look: 3, renderScale, detail: (detail = share) });
  });
  for (const look of [2, 1] as const) best.push({ look, renderScale: smallest, detail });
  if (lowest !== false && options.effectsAtLowest !== false)
    best.push({ look: 1, renderScale: lowest, detail });
  best.push({ look: 0, renderScale: smallest, detail });
  if (lowest !== false) best.push({ look: 0, renderScale: lowest, detail });
  return best.reverse();
}

/**
 * The owner's three frame-rate tiers (docs/plans/records/quality-tiers), by
 * the frames a second a device holds: `low` is 60 and over on every target,
 * `high` is 45 to 60 with the picture as good as it can be made, `extreme`
 * is 10 to 45, the picture as perfect as possible, for taking pictures.
 */
export type ZhudaFrameTier = 'low' | 'high' | 'extreme';
/** Each tier's band: at least `minFps`, under `belowFps` (none for `low`). */
export const ZHUDA_FRAME_TIERS: Readonly<
  Record<ZhudaFrameTier, { readonly minFps: number; readonly belowFps?: number }>
> = Object.freeze({
  low: Object.freeze({ minFps: 60 }),
  high: Object.freeze({ minFps: 45, belowFps: 60 }),
  extreme: Object.freeze({ minFps: 10, belowFps: 45 }),
});
/**
 * The tier a measured rate falls in, or null under 10 frames a second. A
 * display paces frames a little under its nominal rate (59.7 on a 60 Hz
 * screen): `tolerance` (default 1) is taken off each lower bound.
 */
export function zhudaFrameTier(fps: number, tolerance = 1): ZhudaFrameTier | null {
  if (!Number.isFinite(fps) || fps < 0) throw Error('Frame tier: frames a second, 0 or more');
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 5)
    throw Error('Frame tier: tolerance 0..5');
  if (fps >= ZHUDA_FRAME_TIERS.low.minFps - tolerance) return 'low';
  if (fps >= ZHUDA_FRAME_TIERS.high.minFps - tolerance) return 'high';
  if (fps >= ZHUDA_FRAME_TIERS.extreme.minFps - tolerance) return 'extreme';
  return null;
}
/**
 * The frame budget that holds a tier, for `ZhudaQualityGovernor`'s
 * `budgetMs`: the governor steps down while frames run over it, so the rate
 * stays at or over the tier's lower bound (16.7 ms, 22.2 ms, 100 ms).
 */
export function zhudaTierBudgetMs(tier: ZhudaFrameTier): number {
  const band = ZHUDA_FRAME_TIERS[tier];
  if (!band) throw Error("Frame tier: 'low', 'high' or 'extreme'");
  return 1000 / band.minFps;
}

/** What a frame issued: its draws, and (WebGL) how often it went to another render target. */
export interface ZhudaFrameLoad {
  drawCalls: number;
  renderTargets?: number;
}
/** Draws a frame above which `zhudaFrameLoadAdvice` speaks, unless told otherwise. */
export const ZHUDA_DRAW_ADVICE_FROM = 500;
/**
 * What to do about a frame that issues many draws, as sentences; none when
 * it does not. Measured on an iPhone 14's Safari
 * (docs/plans/records/quality-tiers): issuing about 1100 draws took 10 to
 * 15 ms of a 16.7 ms frame and a smaller picture gained nothing; the same
 * houses as instanced copies, about 300 draws, took 4 ms. A phone's Chrome
 * and a desktop pay less a draw. One phone, one scene: a line to look at,
 * not a limit.
 */
export function zhudaFrameLoadAdvice(
  load: ZhudaFrameLoad,
  options: { from?: number } = {},
): string[] {
  const from = options.from ?? ZHUDA_DRAW_ADVICE_FROM;
  if (!Number.isFinite(load?.drawCalls) || load.drawCalls < 0)
    throw Error('Frame load: drawCalls is a count');
  if (!Number.isInteger(from) || from < 1)
    throw Error('Frame load: from is a whole number, 1 or more');
  if (load.drawCalls <= from) return [];
  return [
    `${Math.round(load.drawCalls)} draws a frame (over ${from}): on an iPhone's Safari the frame is bound by issuing them, and a smaller render scale will not help. Draw repeated things as copies (ZhudaInstancedMesh, a model's instanced placements), merge what stands still, and let small things cast no shadow: every shadow cascade and the depth pass draw them again.`,
  ];
}
