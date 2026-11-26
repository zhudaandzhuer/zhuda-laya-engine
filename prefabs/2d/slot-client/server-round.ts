// The round JSON a cascade slot server sends (prefabs/server/slotmath.Round, also what
// 2d/cascade-math's engine returns) and its conversion to what the client plays
// (CascadePlay / a resolved round for LocalSession). Pure TypeScript.
// The mapping replaces the source's mapRsgToPresentation (<original-cascade-slot>/client/
// src/plugs/vendors/VendorAdapters.ts), which rebuilt the frames from its own field names.
import type { CascadeAward, CascadeBonusPayload, CascadePlay, CascadeRoundPayload, Orb, ResolvedRound, TumbleFrame } from './protocol.ts';

export interface ServerAward {
  id: string;
  kind: string;
  symbol: number;
  count: number;
  amount: number;
  label: string;
  gridIndices: number[] | null;
}

export interface ServerStep {
  stepIndex: number;
  type: 'INITIAL_GRID' | 'PAY_ANYWHERE_EVAL' | 'TUMBLE_DROP' | 'MAX_WIN_CAP';
  cascade: number;
  grid: number[];
  awards: ServerAward[] | null;
  stepWin: number;
  orbs: Orb[] | null;
  cumulativeMultiplier: number;
  isTerminated?: boolean;
}

export interface ServerRound {
  roundId: string;
  gameId: string;
  singleBet: number;
  totalBet: number;
  initialStops: number[];
  grid: number[];
  steps: ServerStep[];
  awards: ServerAward[];
  totalMultiplier: number;
  baseWin: number;
  totalWin: number;
  freeSpinTriggered: boolean;
  scatterCount: number;
  freeSpinsCount?: number;
  freeSpinsTotalWin?: number;
  freeSpins?: ServerRound[];
  globalMultiplier?: number;
  isMaxWinCapped: boolean;
  timestamp: number;
}

export interface ServerSpinRequest {
  betAmount: number;
  anteBet?: boolean;
  buyFeature?: boolean;
}

export interface ServerSpinResponse {
  success: boolean;
  data?: ServerRound;
  balance: number;
  error?: string;
}

const award = (a: ServerAward): CascadeAward => ({ id: a.id, kind: a.kind, symbol: a.symbol, count: a.count, amount: a.amount, label: a.label, cells: [...(a.gridIndices ?? [])] });

/** One spin (base or free) as the client plays it. `ownWin` overrides the spin's win (a base spin with free spins). */
export function toCascadePlay(round: ServerRound, cols: number, rows: number, ownWin = round.totalWin): CascadePlay {
  const steps = round.steps;
  const waves: TumbleFrame[] = [];
  let lastOrbs = steps[0]?.orbs ?? [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.type === 'TUMBLE_DROP') lastOrbs = s.orbs ?? [];
    if (s.type !== 'PAY_ANYWHERE_EVAL') continue;
    const after = steps[i + 1];
    const awards = (s.awards ?? []).map(award);
    waves.push({
      wave: s.cascade,
      gridBefore: [...s.grid],
      winning: [...new Set(awards.flatMap((a) => a.cells))].sort((a, b) => a - b),
      awards,
      waveWin: s.stepWin,
      gridAfter: [...(after?.grid ?? s.grid)],
      orbsAfter: [...(after?.orbs ?? [])],
    });
  }
  const scatter = round.awards.filter((a) => a.id.startsWith('scatter-'));
  return {
    cols,
    rows,
    grid: [...(steps[0]?.grid ?? round.grid)],
    orbs: [...(steps[0]?.orbs ?? [])],
    waves,
    finalGrid: [...round.grid],
    finalOrbs: [...lastOrbs],
    baseWin: round.baseWin,
    multiplier: round.totalMultiplier,
    scatterCount: round.scatterCount,
    scatterWin: scatter.reduce((n, a) => n + a.amount, 0),
    win: ownWin,
    capped: round.isMaxWinCapped,
    globalMultiplier: round.globalMultiplier ?? 0,
  };
}

/** A whole server round as { p, b }: p.mainWin is the base spin's part, b.total the free spins'. */
export function toResolvedRound(round: ServerRound, cols: number, rows: number): ResolvedRound<CascadeRoundPayload, CascadeBonusPayload> {
  const free = round.freeSpinsTotalWin ?? 0;
  const mainWin = round.totalWin - free;
  return {
    p: {
      totalBet: round.totalBet,
      singleBet: round.singleBet,
      mainWin,
      spin: toCascadePlay(round, cols, rows, mainWin),
      freeSpinTriggered: round.freeSpinTriggered,
      capped: round.isMaxWinCapped,
      roundId: round.roundId,
    },
    b: { total: free, spins: (round.freeSpins ?? []).map((r) => toCascadePlay(r, cols, rows)) },
  };
}
