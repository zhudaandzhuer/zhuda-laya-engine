// Scripted rounds as a plug pipeline: a fixture (a fixed grid, multiplier values and bonus
// rows) or a seeded random grid goes through
//   reel → scatter-pays evaluation → tumble (one wave per award, deterministic filler)
//   → multiplier sum → win cap
// and a target-match bonus. Every number is configuration. Use it for showcase rounds,
// attract mode and deterministic UI tests; real play uses engine.ts (the server's algorithm).
// Pure TypeScript.
// Split from <original-cascade-slot>/client/src/plugs/math/ (the math pipeline) (the
// client's whole local math): the same plugs in the same order with the game's constants
// turned into FixtureMathConfig. Fed the source's own constants it gives the source's
// outcomes (proved in the dissolving workspace, see README). Not carried: the source's
// MathEngine.present(), a second evaluator only its gate script used, whose 30-cell tiers
// disagreed with this pipeline's (9 of a kind paid the second tier there, the first here).
import { PipelineExecutor, type PlugFn } from '../slot-client/pipeline.ts';
import { createSeededRng } from './rng.ts';

export interface FixtureDefinition {
  key: string;
  label?: string;
  /** The short board kept for receipts (boardSize cells). */
  board: number[];
  /** cols × rows, row-major. */
  grid: number[];
  /** Multiplier values on this round. */
  orbs: number[];
  /** Bonus rows: [target, slot1..slotN]. */
  bonus: number[][];
}

export interface FixtureAward {
  id: string;
  kind: string;
  symbol: number | null;
  count: number;
  amount: number;
  baseAmount?: number;
  label: string;
  path?: number[];
  gridIndices?: number[];
  multiplier?: number;
  tumbleWave?: number;
}

export interface FixtureTumbleFrame {
  waveIndex: number;
  gridBefore: number[];
  winningIndices: number[];
  awards: FixtureAward[];
  waveBaseWin: number;
  gridAfter: number[];
}

export interface FixtureStep {
  stepIndex: number;
  type: 'INITIAL_GRID' | 'PAY_ANYWHERE_EVAL' | 'TUMBLE_DROP' | 'MULTIPLIER_ORB_HIT' | 'MAX_WIN_CAP';
  grid: number[];
  board: number[];
  awards: FixtureAward[];
  stepWin: number;
  orbMultipliers: number[];
  cumulativeMultiplier: number;
  isTerminated?: boolean;
}

export interface BonusBeat {
  id: string;
  target: number;
  slots: number[];
  amount: number;
  isFull: boolean;
  hitIndices: number[];
  before: number;
  remaining: number;
  cumulative: number;
}

export interface FixtureContext {
  fixtureKey: string;
  singleBet: number;
  totalBet: number;
  seed: number;
  grid: number[];
  board: number[];
  tumbleWaves: number[][];
  tumbleFrames: FixtureTumbleFrame[];
  orbValues: number[];
  steps: FixtureStep[];
  awards: FixtureAward[];
  baseWin: number;
  totalMultiplier: number;
  mainWin: number;
  opportunities: number;
  bonusBeats: BonusBeat[];
  bonusWin: number;
  totalWin: number;
  cue: string;
  isMaxWinCapped: boolean;
}

/** A bonus target's value: hits × match (+ full when all slots hit); the cost target spends chances instead. */
export interface BonusTarget {
  cost: number;
  match: number;
  full: number;
}

export interface FixtureMathConfig {
  cols: number;
  rows: number;
  /** Length of the short board (cells kept for receipts and award paths). */
  boardSize: number;
  paySymbols: number[];
  scatterSymbol: number;
  minMatch: number;
  /** Ascending counts where tiers start, e.g. [8, 10, 12]. */
  tierMins: number[];
  /** Symbol → amount per tier, in points per payScale unit. */
  paytable: Record<number, number[]>;
  /** Points multiplier for a bet unit (e.g. floor(bet / 10)). */
  payScale: (singleBet: number) => number;
  /** What a bet unit costs (e.g. bet × lines). */
  totalBet: (singleBet: number) => number;
  bets: number[];
  /** Bonus chances from the scatters on the grid (0: none). */
  opportunities: (scatterCount: number) => number;
  /** A seeded random grid uses symbols randomMin .. randomMin + randomCount − 1. */
  randomMin: number;
  randomCount: number;
  /** Symbols that drop in after a wave: pool[fillerIndex(col, row, seed) % pool.length]. */
  fillerPool: number[];
  fillerIndex: (col: number, row: number, seed: number) => number;
  /** Removed when an award's symbol is no longer on the grid and it has no cells. */
  fallbackWinIndices: number[];
  /** Award path when none of its cells is on the short board. */
  fallbackPath: number[];
  /** Wave n's filler seed is seed + n × waveSeedStep. */
  waveSeedStep: number;
  multiplierMin: number;
  multiplierMax: number;
  /** Cap: totalBet × this. */
  maxWinMultiplier: number;
  defaultSeed: number;
  fixtures: Record<string, FixtureDefinition>;
  /** Used for unknown fixture keys. */
  defaultFixture: string;
  awardLabel: (count: number, symbol: number) => string;
  multipliedLabel: (label: string, multiplier: number) => string;
  capLabel: (maxWinMultiplier: number) => string;
  /** Presentation hint from the outcome (default: defaultCue). */
  cue?: (ctx: FixtureContext, cfg: FixtureMathConfig) => string;
  bonusTable: BonusTarget[];
  /** Target used when a row has none or an unknown one. */
  bonusFallbackTarget: number;
  /** Slots per bonus row. */
  bonusSlots: number;
  /** The target that costs chances instead of paying hits. */
  bonusCostTarget: number;
}

/** Intensity of an outcome: feature > epic > multi > large > medium > small > none. */
export function defaultCue(ctx: FixtureContext, cfg: FixtureMathConfig): string {
  if (ctx.opportunities > 0) return 'feature';
  if (ctx.isMaxWinCapped || ctx.totalMultiplier >= 100) return 'epic';
  if (ctx.totalMultiplier >= 10 || ctx.awards.length >= 2) return 'multi';
  const maxCount = ctx.awards.reduce((m, a) => Math.max(m, a.count), 0);
  const [low, mid, high] = cfg.tierMins;
  if (high !== undefined && maxCount >= high) return 'large';
  if (mid !== undefined && maxCount >= mid) return 'medium';
  if (maxCount >= low) return 'small';
  return 'none';
}

const stepOf = (ctx: FixtureContext, type: FixtureStep['type'], extra: Partial<FixtureStep>): FixtureStep => ({
  stepIndex: ctx.steps.length,
  type,
  grid: [...ctx.grid],
  board: [...ctx.board],
  awards: [],
  stepWin: 0,
  orbMultipliers: [...ctx.orbValues],
  cumulativeMultiplier: 1,
  ...extra,
});

/** Removes cells, lets columns fall and fills the top with the deterministic filler. */
export function applyColumnGravity(cfg: FixtureMathConfig, grid: number[], removed: number[], seed: number): number[] {
  const { cols, rows, fillerPool } = cfg;
  const gone = new Set(removed);
  const next = new Array<number>(cols * rows).fill(fillerPool[0]);
  for (let col = 0; col < cols; col++) {
    const surviving: number[] = [];
    for (let row = rows - 1; row >= 0; row--) if (!gone.has(row * cols + col)) surviving.push(grid[row * cols + col]);
    for (let row = rows - 1; row >= 0; row--) {
      const k = rows - 1 - row;
      next[row * cols + col] = k < surviving.length ? surviving[k] : fillerPool[cfg.fillerIndex(col, row, seed) % fillerPool.length];
    }
  }
  return next;
}

export function createReelPlug(cfg: FixtureMathConfig): PlugFn<FixtureContext> {
  return async function ReelPlug(ctx, next) {
    const fix = cfg.fixtures[ctx.fixtureKey];
    if (fix) {
      ctx.grid = [...fix.grid];
      ctx.board = [...fix.board];
      ctx.orbValues = [...fix.orbs];
    } else if (ctx.grid.length === 0) {
      const rng = createSeededRng(ctx.seed || cfg.defaultSeed);
      for (let i = 0; i < cfg.cols * cfg.rows; i++) ctx.grid.push(Math.floor(rng() * cfg.randomCount) + cfg.randomMin);
      ctx.board = ctx.grid.slice(0, cfg.boardSize);
    }
    ctx.steps.push(stepOf(ctx, 'INITIAL_GRID', {}));
    await next();
  };
}

export function createScatterPayPlug(cfg: FixtureMathConfig): PlugFn<FixtureContext> {
  return async function ScatterPayPlug(ctx, next) {
    const scale = cfg.payScale(ctx.singleBet);
    const counts = new Map<number, number[]>();
    ctx.grid.forEach((sym, idx) => {
      if (!counts.has(sym)) counts.set(sym, []);
      counts.get(sym)!.push(idx);
    });
    const chances = cfg.opportunities((counts.get(cfg.scatterSymbol) ?? []).length);
    if (chances > 0) ctx.opportunities = chances;
    let baseWin = 0;
    for (const sym of cfg.paySymbols) {
      const indices = counts.get(sym) ?? [];
      const row = cfg.paytable[sym];
      if (indices.length < cfg.minMatch || !row) continue;
      let tier = 0;
      cfg.tierMins.forEach((min, i) => {
        if (indices.length >= min) tier = i;
      });
      const amount = row[tier] * scale;
      baseWin += amount;
      const path = indices.filter((i) => i < cfg.boardSize);
      ctx.awards.push({
        id: `award-sym-${sym}`,
        kind: 'scatter-pay',
        symbol: sym,
        count: indices.length,
        amount,
        baseAmount: amount,
        label: cfg.awardLabel(indices.length, sym),
        path: path.length > 0 ? path : [...cfg.fallbackPath],
        gridIndices: [...indices],
        tumbleWave: ctx.awards.length + 1,
      });
    }
    ctx.baseWin = baseWin;
    ctx.steps.push(stepOf(ctx, 'PAY_ANYWHERE_EVAL', { awards: [...ctx.awards], stepWin: baseWin }));
    await next();
  };
}

export function createTumblePlug(cfg: FixtureMathConfig): PlugFn<FixtureContext> {
  return async function TumblePlug(ctx, next) {
    ctx.tumbleFrames = [];
    if (ctx.awards.length > 0) {
      let working = [...ctx.grid];
      ctx.awards.forEach((award, waveIdx) => {
        const current: number[] = [];
        working.forEach((s, i) => s === award.symbol && current.push(i));
        const win = current.length >= cfg.minMatch ? current : award.gridIndices?.length ? award.gridIndices : cfg.fallbackWinIndices;
        const after = applyColumnGravity(cfg, working, win, ctx.seed + waveIdx * cfg.waveSeedStep);
        ctx.tumbleWaves.push(after);
        ctx.tumbleFrames.push({ waveIndex: waveIdx + 1, gridBefore: [...working], winningIndices: [...win], awards: [award], waveBaseWin: award.baseAmount ?? award.amount, gridAfter: [...after] });
        working = after;
      });
      ctx.steps.push(stepOf(ctx, 'TUMBLE_DROP', { grid: working, awards: [...ctx.awards], stepWin: ctx.baseWin }));
    }
    await next();
  };
}

export function createMultiplierPlug(cfg: FixtureMathConfig): PlugFn<FixtureContext> {
  return async function MultiplierPlug(ctx, next) {
    const valid = ctx.orbValues.filter((v) => v >= cfg.multiplierMin && v <= cfg.multiplierMax);
    const sum = valid.reduce((n, v) => n + v, 0);
    ctx.totalMultiplier = sum > 0 ? sum : 1;
    if (ctx.baseWin > 0 && sum > 0) {
      ctx.mainWin = ctx.baseWin * ctx.totalMultiplier;
      ctx.awards = ctx.awards.map((a) => ({ ...a, amount: a.amount * ctx.totalMultiplier, multiplier: ctx.totalMultiplier, label: cfg.multipliedLabel(a.label, ctx.totalMultiplier) }));
      ctx.steps.push(stepOf(ctx, 'MULTIPLIER_ORB_HIT', { awards: [...ctx.awards], stepWin: ctx.mainWin, orbMultipliers: valid, cumulativeMultiplier: ctx.totalMultiplier }));
    } else {
      ctx.mainWin = ctx.baseWin;
    }
    await next();
  };
}

export function createWinCapPlug(cfg: FixtureMathConfig): PlugFn<FixtureContext> {
  return async function WinCapPlug(ctx, next) {
    const cap = ctx.totalBet * cfg.maxWinMultiplier;
    if (ctx.mainWin > cap) {
      ctx.mainWin = cap;
      ctx.isMaxWinCapped = true;
      if (ctx.awards.length > 0) ctx.awards[0] = { ...ctx.awards[0], amount: cap, label: cfg.capLabel(cfg.maxWinMultiplier) };
      ctx.steps.push(stepOf(ctx, 'MAX_WIN_CAP', { awards: [...ctx.awards], stepWin: cap, cumulativeMultiplier: ctx.totalMultiplier, isTerminated: true }));
    }
    await next();
  };
}

/** The five plugs in order. Run it with executeSync (every plug finishes before next()). */
export function createFixturePipeline(cfg: FixtureMathConfig): PipelineExecutor<FixtureContext> {
  return new PipelineExecutor<FixtureContext>()
    .use('ReelPlug', createReelPlug(cfg))
    .use(`ScatterPayPlug(${cfg.minMatch})`, createScatterPayPlug(cfg))
    .use('TumblePlug', createTumblePlug(cfg))
    .use(`MultiplierPlug(${cfg.multiplierMin}..${cfg.multiplierMax})`, createMultiplierPlug(cfg))
    .use(`WinCapPlug(${cfg.maxWinMultiplier})`, createWinCapPlug(cfg));
}

/** A fresh context for a fixture (or an empty grid for a seeded random round). */
export function fixtureContext(cfg: FixtureMathConfig, fixtureKey: string, singleBet: number, seed = cfg.defaultSeed): FixtureContext {
  const fix = cfg.fixtures[fixtureKey];
  return {
    fixtureKey,
    singleBet,
    totalBet: cfg.totalBet(singleBet),
    seed,
    grid: fix ? [...fix.grid] : [],
    board: fix ? [...fix.board] : [],
    tumbleWaves: [],
    tumbleFrames: [],
    orbValues: fix ? [...fix.orbs] : [],
    steps: [],
    awards: [],
    baseWin: 0,
    totalMultiplier: 1,
    mainWin: 0,
    opportunities: 0,
    bonusBeats: [],
    bonusWin: 0,
    totalWin: 0,
    cue: '',
    isMaxWinCapped: false,
  };
}

/** Bonus rows played until the chances run out: hits × match, all hit adds full; the cost target spends chances. */
export function targetMatchBonus(cfg: FixtureMathConfig, rows: number[][], totalBet: number, opportunities: number): { beats: BonusBeat[]; total: number } {
  if (!rows || rows.length === 0 || opportunities <= 0) return { beats: [], total: 0 };
  let remaining = opportunities;
  let cumulative = 0;
  const beats: BonusBeat[] = [];
  for (let i = 0; i < rows.length && remaining > 0; i++) {
    const row = rows[i];
    const target = row[0] ?? cfg.bonusFallbackTarget;
    const slots = row.slice(1, 1 + cfg.bonusSlots);
    const before = remaining;
    const spec = cfg.bonusTable[target] || cfg.bonusTable[cfg.bonusFallbackTarget];
    const hitIndices: number[] = [];
    slots.forEach((s, idx) => s === target && hitIndices.push(idx));
    const isFull = slots.length === cfg.bonusSlots && slots.every((s) => s === target);
    let mult = 0;
    if (target === cfg.bonusCostTarget) {
      remaining = Math.max(0, remaining - spec.cost);
      if (isFull) mult = spec.full;
    } else {
      mult = hitIndices.length * spec.match + (isFull ? spec.full : 0);
    }
    const amount = mult * totalBet;
    cumulative += amount;
    beats.push({ id: `beat-${i + 1}`, target, slots, amount, isFull, hitIndices, before, remaining, cumulative });
  }
  return { beats, total: cumulative };
}

export interface FixtureRound {
  p: {
    board: number[];
    grid: number[];
    singleBet: number;
    totalBet: number;
    mainWin: number;
    opportunities: number;
    awards: FixtureAward[];
    cue: string;
    totalMultiplier: number;
    orbValues: number[];
    tumbleCount: number;
    tumbleFrames: FixtureTumbleFrame[];
    isMaxWinCapped: boolean;
    steps: FixtureStep[];
  };
  b: { beats: BonusBeat[]; total: number };
}

/** A whole scripted round (fixture or 'random' with a seed). Throws for a bet outside cfg.bets. */
export function resolveFixture(cfg: FixtureMathConfig, fixtureKey: string, singleBet: number, seed = cfg.defaultSeed): FixtureRound {
  if (!cfg.bets.includes(singleBet)) throw new Error(`非法單注金額: ${singleBet}`);
  const fix = cfg.fixtures[fixtureKey] || cfg.fixtures[cfg.defaultFixture];
  const ctx = fixtureContext(cfg, fix.key, singleBet, seed);
  createFixturePipeline(cfg).executeSync(ctx);
  const b = targetMatchBonus(cfg, fix.bonus, ctx.totalBet, ctx.opportunities);
  ctx.bonusBeats = b.beats;
  ctx.bonusWin = b.total;
  ctx.totalWin = ctx.mainWin + ctx.bonusWin;
  ctx.cue = (cfg.cue ?? defaultCue)(ctx, cfg);
  return {
    p: {
      board: ctx.board,
      grid: ctx.grid,
      singleBet: ctx.singleBet,
      totalBet: ctx.totalBet,
      mainWin: ctx.mainWin,
      opportunities: ctx.opportunities,
      awards: ctx.awards,
      cue: ctx.cue,
      totalMultiplier: ctx.totalMultiplier,
      orbValues: ctx.orbValues,
      tumbleCount: ctx.tumbleWaves.length,
      tumbleFrames: ctx.tumbleFrames,
      isMaxWinCapped: ctx.isMaxWinCapped,
      steps: ctx.steps,
    },
    b,
  };
}
