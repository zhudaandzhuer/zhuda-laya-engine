// The contracts between a slot round runtime, its session (the ledger that accepts a
// round before it is shown) and its presentation (whatever draws the round).
// No engine, no DOM: node can run and test all of systems/slot-round.
// From games/dungeon-spin (src/domain/dungeon-slot/core/Contracts.ts); the only change is
// that a bet is any number the game allows (dungeon-spin: 10, 20, 50), not the type 10 | 20 | 50.
// Added from <original-cascade-slot> (core/contracts/SpinProtocol.ts, same lineage): FSMState
// (GameRuntime's fsm option), and type parameters for the round's p and b so a game with
// another payload (a cascade slot) types its presentation; the defaults are dungeon-spin's.

export type Mode = 'normal' | 'burst';
export type PrimaryAction = 'advance' | 'stop' | 'accelerate' | 'collect-next' | 'wait';
/** Formal round states (GameRuntime option fsm). */
export type FSMState = 'IDLE' | 'BET_COMMITTED' | 'REVEALING' | 'RESOLVING' | 'BONUS' | 'CELEBRATING' | 'REPLAYING';

/** What the next round plays: a fixture (or rule set) key, the single bet, normal or burst presentation. */
export interface Selection {
  fixture: string;
  singleBet: number;
  mode: Mode;
}

export interface Award {
  id: string;
  kind: string;
  symbol: number | null;
  count: number;
  amount: number;
  label: string;
  path?: number[];
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

/** dungeon-spin's main-game payload (the default p). */
export interface BoardPayload {
  board: number[];
  singleBet: number;
  totalBet: number;
  mainWin: number;
  opportunities: number;
  awards: Award[];
  attack: string;
}

/** dungeon-spin's bonus payload (the default b). */
export interface BeatsPayload {
  beats: BonusBeat[];
  total: number;
}

/** p needs totalBet and mainWin, b needs total: LocalSession checks every saved round with them. */
export interface RoundView<P extends { totalBet: number; mainWin: number } = BoardPayload, B extends { total: number } = BeatsPayload> {
  readonly contractVersion: 1;
  readonly id: string;
  readonly sequence: number;
  readonly fixture: string;
  readonly singleBet: number;
  readonly bet: number;
  readonly win: number;
  readonly mainWin: number;
  readonly bonusWin: number;
  readonly pointsAfter: number;
  readonly presented: boolean;
  readonly acceptedAt: number;
  readonly burst: boolean;
  readonly p: P;
  readonly b: B;
}

/** Any round view, whatever its payloads. */
export type AnyRoundView = RoundView<{ totalBet: number; mainWin: number }, { total: number }>;

export interface AutoState {
  running: boolean;
  stopping: boolean;
  remaining: number;
  completed: number;
  total: number;
  reason: string;
  error: Error | null;
  totalBet: number;
  totalWin: number;
  net: number;
}

export interface PresentationContext {
  readonly replay: boolean;
  readonly mode: Mode;
  phase(value: string): void;
  getAuto(): AutoState;
  shouldFinish(): boolean;
}

/** What draws a round. Only play() is required; the runtime calls the rest when present. */
export interface PresentationPort<R = RoundView> {
  play(round: Readonly<R>, context: PresentationContext): void | Promise<void>;
  accepted?(round: Readonly<R>, context: PresentationContext): void | Promise<void>;
  complete?(round: Readonly<R>, context: PresentationContext): void | Promise<void>;
  recover?(round: Readonly<R>, error: Error, context: PresentationContext): void | Promise<void>;
  finishBatch?(round: Readonly<R>, context: PresentationContext): void | Promise<void>;
  preview?(tier: string, context: PresentationContext): void | Promise<void>;
  accelerate?(): void;
  collect?(): void;
  interrupt?(reason?: string): void;
  finalize?(): void;
}

export interface SessionPort {
  readonly points: number;
  readonly last: unknown;
  readonly state: { generation: string; [key: string]: unknown };
  accept(fixture: string, singleBet: number, options: { burst: boolean }): Promise<unknown>;
  replay(round?: unknown): unknown;
  refresh(): unknown;
  markPresented(id: string, generation: string): Promise<boolean>;
}

export interface RuntimeState {
  ready: boolean;
  busy: boolean;
  roundBusy: boolean;
  finalizing: boolean;
  phase: string;
  /** Only with GameRuntime's fsm option. */
  fsmState?: FSMState;
  last: Readonly<AnyRoundView> | null;
  selection: Readonly<Selection>;
  auto: AutoState;
  points: number | null;
  lastAutoCount: number;
  pending: string | null;
  primary: PrimaryAction;
}

export interface RuntimeEvent {
  type: string;
  state: Readonly<RuntimeState>;
  [key: string]: unknown;
}

export function freeze<T>(obj: T): Readonly<T> {
  return Object.freeze(obj);
}

/**
 * What the one big button does now: wait (not ready, finishing a batch, auto stopping),
 * stop (auto running), collect-next (a celebration or preview is showing), accelerate
 * (a round is being shown) or advance (play a round).
 */
export function primaryAction(state: {
  ready: boolean;
  busy: boolean;
  roundBusy: boolean;
  finalizing: boolean;
  phase: string;
  auto: { running: boolean; stopping: boolean };
}): PrimaryAction {
  if (!state.ready) return 'wait';
  if (state.auto.running) return state.auto.stopping ? 'wait' : 'stop';
  if (state.finalizing) return 'wait';
  if (state.roundBusy) {
    if (['celebration', 'preview'].includes(state.phase)) return 'collect-next';
    return 'accelerate';
  }
  return 'advance';
}
