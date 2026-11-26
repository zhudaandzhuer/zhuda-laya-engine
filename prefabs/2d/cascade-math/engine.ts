// The cascade engine in TypeScript: the same algorithm, draw order and JSON as the Go
// authority (prefabs/server/slotmath/engine.go), so a client can play rounds locally
// (demos, LocalSession) or replay a server round from its seed. Pure TypeScript.
// Cut from the grid strips → every paying symbol with minMatch+ anywhere pays by tier → remove,
// fall, refill → repeat; multipliers sum (base) or accumulate (free spins); scatters pay and
// trigger free spins; the cap stops the round.
import type { Orb } from '../slot-client/protocol.ts';
import type { ServerAward, ServerRound, ServerStep } from '../slot-client/server-round.ts';
import { cost, pay, scatterPay, symbolName, validateConfig, type CascadeConfig, type SpinRequest, type Weighted } from './config.ts';
import type { IntSource } from './rng.ts';

export const STEP_INITIAL = 'INITIAL_GRID';
export const STEP_PAY = 'PAY_ANYWHERE_EVAL';
export const STEP_DROP = 'TUMBLE_DROP';
export const STEP_CAP = 'MAX_WIN_CAP';

/** Awards and winning cells of a grid (scatters and multipliers never count). */
export function evaluate(cfg: CascadeConfig, grid: number[], singleBet: number): { awards: ServerAward[]; winning: Set<number> } {
  const positions = new Map<number, number[]>();
  grid.forEach((sym, idx) => {
    if (sym === cfg.scatterSymbol || sym === cfg.multiplierSymbol) return;
    let list = positions.get(sym);
    if (!list) positions.set(sym, (list = []));
    list.push(idx);
  });
  const awards: ServerAward[] = [];
  const winning = new Set<number>();
  for (const sym of cfg.paySymbols) {
    const cells = positions.get(sym) ?? [];
    if (cells.length < cfg.minMatch) continue;
    const amount = pay(cfg, sym, cells.length, singleBet);
    if (amount <= 0) continue;
    for (const c of cells) winning.add(c);
    awards.push({
      id: `win-sym${sym}-${cells.length}`,
      kind: 'scatter-pay',
      symbol: sym,
      count: cells.length,
      amount,
      label: cfg.winLabel ? cfg.winLabel(sym, cells.length, symbolName(cfg, sym)) : `${symbolName(cfg, sym)} ×${cells.length}`,
      gridIndices: cells,
    });
  }
  return { awards, winning };
}

/** Values on the grid ordered by cell (0 left out). */
export function orbList(orbs: Map<number, number>): Orb[] {
  return [...orbs].filter(([, v]) => v > 0).map(([cell, value]) => ({ cell, value })).sort((a, b) => a.cell - b.cell);
}

export interface CascadeEngineOptions {
  /** Stamps rounds (default Date.now). */
  now?: () => number;
}

export class CascadeEngine {
  readonly config: CascadeConfig;
  rng: IntSource;
  private now: () => number;

  constructor(config: CascadeConfig, rng: IntSource, { now = () => Date.now() }: CascadeEngineOptions = {}) {
    this.config = validateConfig(config);
    this.rng = rng;
    this.now = now;
  }

  draw(weights: Weighted[]): number {
    const total = weights.reduce((n, w) => n + w.weight, 0);
    const r = this.rng.intN(total);
    let cur = 0;
    for (const w of weights) {
      cur += w.weight;
      if (r < cur) return w.value;
    }
    return weights[0].value;
  }

  private drawMultiplier(free: boolean): number {
    return this.draw(free ? this.config.freeMultiplierWeights : this.config.multiplierWeights);
  }

  private drawRefillMultiplier(): number {
    const refill = this.config.refillMultiplierWeights;
    return this.draw(refill?.length ? refill : this.config.multiplierWeights);
  }

  /** One uniform stop per column, rows symbols down from it. */
  slice(reels: number[][]): { grid: number[]; stops: number[] } {
    const { cols, rows } = this.config;
    const grid = new Array<number>(cols * rows);
    const stops = new Array<number>(cols);
    for (let c = 0; c < cols; c++) {
      const strip = reels[c];
      const stop = this.rng.intN(strip.length);
      stops[c] = stop;
      for (let r = 0; r < rows; r++) grid[r * cols + c] = strip[(stop + r) % strip.length];
    }
    return { grid, stops };
  }

  /** Remove, fall (column order kept), refill from the top (bottom-most new symbol drawn first). */
  tumble(grid: number[], winning: Set<number>, orbs: Map<number, number>, refill: number[][]): { grid: number[]; orbs: Map<number, number> } {
    const { cols, rows, multiplierSymbol } = this.config;
    const next = new Array<number>(cols * rows);
    const nextOrbs = new Map<number, number>();
    for (let c = 0; c < cols; c++) {
      const survivors: Array<[number, number]> = [];
      for (let r = rows - 1; r >= 0; r--) {
        const idx = r * cols + c;
        if (winning.has(idx)) continue;
        const sym = grid[idx];
        let v = 0;
        if (sym === multiplierSymbol) {
          v = orbs.get(idx) ?? 0;
          if (v === 0) v = this.drawRefillMultiplier();
        }
        survivors.push([sym, v]);
      }
      const needed = rows - survivors.length;
      const strip = refill[c];
      const fresh: Array<[number, number]> = [];
      for (let i = 0; i < needed; i++) {
        const sym = strip[this.rng.intN(strip.length)];
        fresh.push([sym, sym === multiplierSymbol ? this.drawRefillMultiplier() : 0]);
      }
      for (let r = 0; r < needed; r++) {
        const [sym, v] = fresh[needed - 1 - r];
        next[r * cols + c] = sym;
        if (sym === multiplierSymbol) nextOrbs.set(r * cols + c, v);
      }
      for (let r = needed; r < rows; r++) {
        const [sym, v] = survivors[survivors.length - 1 - (r - needed)];
        next[r * cols + c] = sym;
        if (sym === multiplierSymbol) nextOrbs.set(r * cols + c, v);
      }
    }
    return { grid: next, orbs: nextOrbs };
  }

  /** One spin on reels (see slotmath Engine.Cascade). */
  cascade(singleBet: number, reels: number[][], forceScatters: boolean, roundId: string, incomingGlobal: number, free: boolean): ServerRound {
    const cfg = this.config;
    let { grid, stops } = this.slice(reels);
    if (forceScatters) for (const idx of cfg.buyScatterCells) grid[idx] = cfg.scatterSymbol;
    let orbs = new Map<number, number>();
    grid.forEach((sym, idx) => {
      if (sym === cfg.multiplierSymbol) orbs.set(idx, this.drawMultiplier(free));
    });
    const steps: ServerStep[] = [{ stepIndex: 0, type: STEP_INITIAL, cascade: 0, grid: [...grid], awards: [], stepWin: 0, orbs: orbList(orbs), cumulativeMultiplier: incomingGlobal }];
    const awards: ServerAward[] = [];
    let baseWin = 0;
    let wave = 0;
    for (;;) {
      const { awards: wins, winning } = evaluate(cfg, grid, singleBet);
      if (!wins.length) break;
      wave++;
      const stepWin = wins.reduce((n, w) => n + w.amount, 0);
      awards.push(...wins);
      baseWin += stepWin;
      steps.push({ stepIndex: steps.length, type: STEP_PAY, cascade: wave, grid: [...grid], awards: wins, stepWin, orbs: orbList(orbs), cumulativeMultiplier: incomingGlobal });
      ({ grid, orbs } = this.tumble(grid, winning, orbs, cfg.refillReels));
      steps.push({ stepIndex: steps.length, type: STEP_DROP, cascade: wave, grid: [...grid], awards: [], stepWin: 0, orbs: orbList(orbs), cumulativeMultiplier: incomingGlobal });
    }
    const scatters = grid.filter((s) => s === cfg.scatterSymbol).length;
    const triggered = !free && scatters >= cfg.freeSpinsTrigger;
    let orbSum = 0;
    grid.forEach((sym, idx) => {
      if (sym !== cfg.multiplierSymbol) return;
      const v = orbs.get(idx);
      if (v !== undefined && v > 0) orbSum += v;
      else {
        const drawn = this.drawMultiplier(free);
        orbs.set(idx, drawn);
        orbSum += drawn;
      }
    });
    let applied = 1;
    let global = incomingGlobal;
    if (free) {
      if (baseWin > 0 && orbSum > 0) global += orbSum;
      if (global > 0) applied = global;
    } else if (orbSum > 0) applied = orbSum;
    let totalWin = baseWin > 0 ? baseWin * applied : 0;
    const sPay = scatterPay(cfg, scatters, singleBet);
    if (sPay > 0) {
      totalWin += sPay;
      const name = symbolName(cfg, cfg.scatterSymbol);
      awards.push({ id: `scatter-${scatters}`, kind: 'scatter-pay', symbol: cfg.scatterSymbol, count: scatters, amount: sPay, label: cfg.scatterLabel ? cfg.scatterLabel(scatters, name) : `${name} ×${scatters}`, gridIndices: null });
    }
    let capped = false;
    const limit = singleBet * cfg.maxWinMultiplier;
    if (totalWin > limit) {
      totalWin = limit;
      capped = true;
      steps.push({ stepIndex: steps.length, type: STEP_CAP, cascade: wave, grid: [...grid], awards: null, stepWin: totalWin, orbs: null, cumulativeMultiplier: cfg.maxWinMultiplier, isTerminated: true });
    }
    const round: ServerRound = {
      roundId,
      gameId: cfg.gameId,
      singleBet,
      totalBet: singleBet,
      initialStops: stops,
      grid,
      steps,
      awards,
      totalMultiplier: applied,
      baseWin,
      totalWin,
      freeSpinTriggered: triggered,
      scatterCount: scatters,
      isMaxWinCapped: capped,
      timestamp: this.now(),
    };
    if (global) round.globalMultiplier = global;
    return round;
  }

  /** The free-spin feature: [total, spins played, each spin]. */
  freeSpins(singleBet: number, parentRoundId: string): [number, number, ServerRound[]] {
    const cfg = this.config;
    let total = 0;
    let played = 0;
    let global = 0;
    let remaining = cfg.freeSpinsAward;
    const rounds: ServerRound[] = [];
    const limit = singleBet * cfg.maxWinMultiplier;
    while (remaining > 0) {
      remaining--;
      played++;
      const r = this.cascade(singleBet, cfg.freeReels, false, `${parentRoundId}_fs_${played}`, global, true);
      global = r.globalMultiplier ?? 0;
      total += r.totalWin;
      rounds.push(r);
      if (r.scatterCount >= cfg.retriggerScatters) remaining += cfg.retriggerAward;
      if (total >= limit) {
        total = limit;
        break;
      }
    }
    return [total, played, rounds];
  }

  /** A whole round: the base spin, then free spins if triggered, capped. Same JSON as the Go server. */
  spin(req: SpinRequest, roundId: string): ServerRound {
    const cfg = this.config;
    const [singleBet, totalBet] = cost(cfg, req);
    const round = this.cascade(singleBet, cfg.baseReels, Boolean(req.buyFeature), roundId, 0, false);
    round.singleBet = singleBet;
    round.totalBet = totalBet;
    if (round.freeSpinTriggered) {
      const [win, count, spins] = this.freeSpins(singleBet, roundId);
      if (count) round.freeSpinsCount = count;
      if (win) round.freeSpinsTotalWin = win;
      if (spins.length) round.freeSpins = spins;
      round.totalWin += win;
      const limit = singleBet * cfg.maxWinMultiplier;
      if (round.totalWin >= limit) {
        round.totalWin = limit;
        round.isMaxWinCapped = true;
      }
    }
    return round;
  }
}
