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

  constructor(options: ZhudaQualityGovernorOptions = {}) {
    const levels = options.levels ?? 4,
      budgetMs = options.budgetMs ?? 16.7,
      window = options.window ?? 30,
      overFactor = options.overFactor ?? 1.12,
      calmSeconds = options.calmSeconds ?? 4,
      maxCalmSeconds = options.maxCalmSeconds ?? 120,
      start = options.start ?? levels - 1;
    if (!Number.isInteger(levels) || levels < 1 || levels > 16) throw Error('levels: use 1..16');
    if (!Number.isInteger(start) || start < 0 || start >= levels)
      throw Error('start: use a level 0..levels-1');
    if (!(budgetMs > 0 && budgetMs <= 1000))
      throw Error('budgetMs: use a positive time up to 1000');
    if (!Number.isInteger(window) || window < 2 || window > 600) throw Error('window: use 2..600');
    if (!(overFactor >= 1 && overFactor <= 4)) throw Error('overFactor: use 1..4');
    if (!(calmSeconds > 0 && maxCalmSeconds >= calmSeconds))
      throw Error('calmSeconds must be positive and at most maxCalmSeconds');
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

  /**
   * One frame took `frameMs`. Returns the new level when it changed, else
   * undefined. Frames longer than a quarter second (a tab switch, a load) are
   * not the renderer's fault and are ignored, as are frames of no time.
   */
  sample(frameMs: number): number | undefined {
    if (!Number.isFinite(frameMs) || frameMs < 0) throw Error('Invalid frame time');
    // A first frame or a paused clock reports no time at all.
    if (frameMs === 0 || frameMs > 250) return undefined;
    this.sum += frameMs;
    if (++this.count < this.window) return undefined;
    const average = this.sum / this.count,
      seconds = this.sum / 1000;
    this.sum = this.count = 0;
    if (average > this.budgetMs * this.overFactor) {
      this.calm = 0;
      if (this.current === 0) return undefined;
      // A level that failed while on trial waits twice as long next time.
      if (this.trial > 0)
        this.wait[this.current] = Math.min(this.maxCalmSeconds, this.wait[this.current] * 2);
      this.trial = 0;
      return --this.current;
    }
    if (this.trial > 0) this.trial--;
    this.calm += seconds;
    if (this.current < this.levels - 1 && this.calm >= this.wait[this.current + 1]) {
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
    this.sum = this.count = this.calm = this.trial = 0;
    this.wait.fill(this.calmSeconds);
  }
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
export function zhudaQualitySteps(options: ZhudaQualityStepsOptions = {}): ZhudaQualityStep[] {
  const scales = options.scales ?? [1, 0.85, 0.7],
    lowest = options.lowest ?? 0.5;
  const valid = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 1;
  if (!Array.isArray(scales) || !scales.length || scales.length > 8 || !scales.every(valid))
    throw Error('Quality steps: scales are 1..8 render scales 0.5..1');
  if (scales.some((value, i) => i > 0 && value >= scales[i - 1]))
    throw Error('Quality steps: scales go from the largest down');
  const smallest = scales[scales.length - 1];
  if (lowest !== false && !(valid(lowest) && lowest < smallest))
    throw Error('Quality steps: lowest is a render scale 0.5..1 below the last of scales');
  const best: ZhudaQualityStep[] = scales.map((renderScale) => ({ look: 3, renderScale }));
  for (const look of [2, 1, 0] as const) best.push({ look, renderScale: smallest });
  if (lowest !== false) best.push({ look: 0, renderScale: lowest });
  return best.reverse();
}
