// A cascade slot's whole math as data (the same fields as slotmath.Config in Go, JSON names).
// Money is integer units of the bet. Pure TypeScript.

/** A count of `min` or more pays `pay` hundredths of the bet unit. */
export interface Tier {
  min: number;
  pay: number;
}

export interface Weighted {
  value: number;
  weight: number;
}

export interface CascadeConfig {
  gameId: string;
  cols: number;
  rows: number;
  /** Evaluated in this order. */
  paySymbols: number[];
  /** Symbol → tiers ascending by min. */
  paytable: Record<number, Tier[]>;
  /** Smallest count anywhere that pays. */
  minMatch: number;
  scatterSymbol: number;
  multiplierSymbol: number;
  scatterPays: Tier[];
  freeSpinsTrigger: number;
  freeSpinsAward: number;
  retriggerScatters: number;
  retriggerAward: number;
  /** A round pays at most bet unit × this. */
  maxWinMultiplier: number;
  defaultBet: number;
  /** An ante bet costs bet × this / 100 and changes nothing else. */
  anteCostPercent: number;
  buyCostMultiplier: number;
  buyScatterCells: number[];
  baseReels: number[][];
  freeReels: number[][];
  refillReels: number[][];
  multiplierWeights: Weighted[];
  freeMultiplierWeights: Weighted[];
  /** Multipliers that drop in during cascades; empty: multiplierWeights (also in free spins). */
  refillMultiplierWeights?: Weighted[];
  names: Record<number, string>;
  winLabel?: (symbol: number, count: number, name: string) => string;
  scatterLabel?: (count: number, name: string) => string;
}

export interface SpinRequest {
  betAmount: number;
  anteBet?: boolean;
  buyFeature?: boolean;
}

export function symbolName(cfg: CascadeConfig, symbol: number): string {
  return cfg.names[symbol] ?? `#${symbol}`;
}

function tierPay(tiers: Tier[], count: number, unit: number): number {
  let pay = -1;
  for (const t of tiers) if (count >= t.min) pay = t.pay;
  return pay < 0 ? 0 : Math.floor((unit * pay) / 100);
}

export function pay(cfg: CascadeConfig, symbol: number, count: number, singleBet: number): number {
  const tiers = cfg.paytable[symbol];
  if (!tiers || count < cfg.minMatch) return 0;
  return tierPay(tiers, count, singleBet);
}

export function scatterPay(cfg: CascadeConfig, count: number, singleBet: number): number {
  return tierPay(cfg.scatterPays, count, singleBet);
}

/** [bet unit, what the request costs]: ante first, then buy, else the bet. */
export function cost(cfg: CascadeConfig, req: SpinRequest): [number, number] {
  const single = req.betAmount > 0 ? req.betAmount : cfg.defaultBet;
  if (req.anteBet) return [single, Math.floor((single * cfg.anteCostPercent) / 100)];
  if (req.buyFeature) return [single, single * cfg.buyCostMultiplier];
  return [single, single];
}

/** Throws on the first thing that would make the engine misbehave. */
export function validateConfig(cfg: CascadeConfig): CascadeConfig {
  const fail = (m: string): never => {
    throw new Error(`cascade-math: ${m}`);
  };
  if (!(cfg.cols > 0 && cfg.rows > 0)) fail('cols and rows must be positive');
  if (!(cfg.minMatch > 0)) fail('minMatch must be positive');
  if (!(cfg.defaultBet > 0)) fail('defaultBet must be positive');
  if (!(cfg.maxWinMultiplier > 0)) fail('maxWinMultiplier must be positive');
  for (const [name, reels] of [['baseReels', cfg.baseReels], ['freeReels', cfg.freeReels], ['refillReels', cfg.refillReels]] as const) {
    if (reels.length !== cfg.cols) fail(`${name} has ${reels.length} strips, want ${cfg.cols}`);
    reels.forEach((strip, i) => strip.length < cfg.rows && fail(`${name}[${i}] is shorter than a column`));
  }
  for (const s of cfg.paySymbols) {
    const tiers = cfg.paytable[s];
    if (!tiers?.length) fail(`symbol ${s} has no paytable`);
    if (tiers.some((t, i) => i && t.min < tiers[i - 1].min)) fail(`symbol ${s} tiers are not ascending`);
    if (s === cfg.scatterSymbol || s === cfg.multiplierSymbol) fail(`symbol ${s} cannot both pay and be scatter/multiplier`);
  }
  for (const w of [cfg.multiplierWeights, cfg.freeMultiplierWeights]) {
    if (w.some((x) => x.weight < 0)) fail('negative multiplier weight');
    if (!(w.reduce((n, x) => n + x.weight, 0) > 0)) fail('multiplier weights must add up to more than 0');
  }
  for (const c of cfg.buyScatterCells) if (c < 0 || c >= cfg.cols * cfg.rows) fail(`buy scatter cell ${c} is off the grid`);
  return cfg;
}
