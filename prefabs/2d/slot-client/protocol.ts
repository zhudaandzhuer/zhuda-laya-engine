// What a cascade slot's client passes around, besides the round runtime's own contracts
// (systems/slot-round/contracts.ts: Selection, RoundView, PresentationPort, primaryAction…).
// Pure TypeScript: no DOM, no engine.
// From <original-cascade-slot>/client/src/core/contracts/SpinProtocol.ts: its runtime half is
// the same as dungeon-spin's and lives in systems/slot-round; what stays here is the currency
// mode and the cascade payload, rewritten from the source's 6×5-only fields.
import type { RoundView } from '../../systems/slot-round/contracts.ts';

export type CurrencyMode = 'FIAT' | 'CRYPTO' | 'SWEEPS_GC' | 'SWEEPS_SC' | 'DEMO';

/** The main-game part of a resolved round. LocalSession checks totalBet and mainWin. */
export interface RoundPayload {
  totalBet: number;
  mainWin: number;
}

/** The bonus part of a resolved round. LocalSession checks total. */
export interface BonusPayload {
  total: number;
}

/** What a resolver returns for (fixture, singleBet): always the same for the same input. */
export interface ResolvedRound<P extends RoundPayload = RoundPayload, B extends BonusPayload = BonusPayload> {
  p: P;
  b: B;
}

// ---------------------------------------------------------------------------
// Cascade (scatter-pays / tumble) presentation: what 2d/cascade-math produces and
// a cascade step player (2d/slot-ui) plays. Grids are row-major, cols × rows.

/** A multiplier symbol on the grid and its value. */
export interface Orb {
  cell: number;
  value: number;
}

export interface CascadeAward {
  id: string;
  kind: string;
  symbol: number;
  count: number;
  amount: number;
  label: string;
  /** Grid cells of the group (empty for scatter pays). */
  cells: number[];
}

/** One paying wave: the grid before, what paid, what was removed, the grid after the fall. */
export interface TumbleFrame {
  wave: number;
  gridBefore: number[];
  winning: number[];
  awards: CascadeAward[];
  /** This wave's pay before multipliers. */
  waveWin: number;
  gridAfter: number[];
  orbsAfter: Orb[];
}

/** One spin as the player sees it. */
export interface CascadePlay {
  cols: number;
  rows: number;
  grid: number[];
  orbs: Orb[];
  waves: TumbleFrame[];
  finalGrid: number[];
  finalOrbs: Orb[];
  /** Sum of the waves before multipliers. */
  baseWin: number;
  /** The multiplier applied to baseWin (1 when none). */
  multiplier: number;
  scatterCount: number;
  scatterWin: number;
  /** The spin's win after multipliers, scatter pay and cap. */
  win: number;
  capped: boolean;
  /** Free spins: the multiplier carried after this spin (0 in the base game). */
  globalMultiplier: number;
}

/** p of a cascade round. */
export interface CascadeRoundPayload extends RoundPayload {
  singleBet: number;
  spin: CascadePlay;
  freeSpinTriggered: boolean;
  capped: boolean;
  /** Server round id when the round came from a server. */
  roundId?: string;
}

/** b of a cascade round: the free spins. */
export interface CascadeBonusPayload extends BonusPayload {
  spins: CascadePlay[];
}

/** A saved cascade round as the runtime hands it to the presentation. */
export type CascadeSnapshot = RoundView<CascadeRoundPayload, CascadeBonusPayload>;
