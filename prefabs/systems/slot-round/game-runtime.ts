// The round runtime of a slot-style game: one big button (advance / accelerate / collect /
// stop), rounds that are accepted by the session before they are shown, auto-advance
// batches, and an event stream for the UI. No DOM, no engine.
//
//   const runtime = new GameRuntime({ presentation, initial: { fixture: 'multi', singleBet: 10, mode: 'normal' } });
//   runtime.attachSession(session);            // a LocalSession, or a server-backed session
//   runtime.subscribe((event) => ui.update(event.state));
//   button.onclick = () => runtime.advance();  // does what state.primary says
//
// From games/dungeon-spin (GameRuntime.ts). Changes: the bets and the first selection are
// options (dungeon-spin passes 10/20/50 and fixture 'multi', which were fixed before).
// Added from <original-cascade-slot> (core/runtime/GameRuntime.ts, the same runtime plus a
// formal state machine): option fsm (IDLE → BET_COMMITTED → REVEALING → RESOLVING → BONUS →
// CELEBRATING, REPLAYING; state.fsmState, fsm.warning on an unexpected step), option
// beforeRound (pick each round's fixture or seed, also in auto play), and the round type as a
// parameter. Without those options every event, state and save is what dungeon-spin's was.
import { freeze, primaryAction } from './contracts.ts';
import type { AnyRoundView, FSMState, RoundView, Selection, RuntimeState, RuntimeEvent, PresentationPort, PresentationContext } from './contracts.ts';
import { AutoAdvance } from './auto-advance.ts';
import { runRound } from './round-runner.ts';
import { Diagnostics } from './diagnostics.ts';

const VALID_FSM_TRANSITIONS: Record<FSMState, FSMState[]> = {
  IDLE: ['BET_COMMITTED', 'REPLAYING', 'IDLE'],
  BET_COMMITTED: ['REVEALING', 'IDLE'],
  REVEALING: ['RESOLVING', 'BONUS', 'CELEBRATING', 'IDLE'],
  RESOLVING: ['BONUS', 'CELEBRATING', 'IDLE'],
  BONUS: ['CELEBRATING', 'IDLE'],
  CELEBRATING: ['IDLE'],
  REPLAYING: ['REVEALING', 'RESOLVING', 'BONUS', 'CELEBRATING', 'IDLE']
};

export interface GameRuntimeOptions<R extends AnyRoundView = RoundView> {
  presentation: PresentationPort<R>;
  diagnostics?: Diagnostics;
  preferences?: any;
  /** Pause between auto rounds, ms (default 450). */
  delayMs?: number | ((sel: Selection) => number);
  timer?: (fn: () => void, ms: number) => any;
  cancelTimer?: (id: any) => void;
  /** Single bets configure() accepts (default 10, 20, 50). */
  bets?: readonly number[];
  /** The selection before any round (default: fixture 'default', the first bet, normal). */
  initial?: Partial<Selection>;
  /** Track the formal round state (state.fsmState; phases 'walking'/'revealing', 'resolving', 'bonus', 'celebration', 'idle' move it). */
  fsm?: boolean;
  /** Called before every new round (manual and auto); a returned patch changes that round's selection, e.g. the next seed. */
  beforeRound?: (selection: Readonly<Selection>, info: { fromAuto: boolean }) => Partial<Selection> | void;
}

export class GameRuntime<R extends AnyRoundView = RoundView> {
  public presentation: PresentationPort<R>;
  public diagnostics: Diagnostics;
  public preferences: any;
  public session: any = null;
  public ready: boolean = false;
  public phase: string = 'idle';
  public activity: string | null = null;
  public batchActive: boolean = false;
  public last: Readonly<R> | null = null;
  public fsmState: FSMState = 'IDLE';
  public readonly fsm: boolean;
  private beforeRound?: GameRuntimeOptions<R>['beforeRound'];
  public pending: { type: string } | null = null;
  private listeners: Set<(event: RuntimeEvent) => void> = new Set();
  public activeTask: Promise<any> | null = null;
  public selection: Readonly<Selection>;
  public lastAutoCount: number = 10;
  public auto: AutoAdvance;
  public readonly bets: readonly number[];

  constructor({
    presentation,
    diagnostics = new Diagnostics(),
    preferences = null,
    delayMs = 450,
    timer = setTimeout,
    cancelTimer = clearTimeout,
    bets = [10, 20, 50],
    initial = {},
    fsm = false,
    beforeRound
  }: GameRuntimeOptions<R>) {
    if (typeof presentation?.play !== 'function') {
      throw new Error('PresentationPort.play is required');
    }
    this.presentation = presentation;
    this.fsm = fsm;
    this.beforeRound = beforeRound;
    this.diagnostics = diagnostics;
    this.preferences = preferences;
    this.bets = Object.freeze([...bets]);
    this.selection = freeze<Selection>({
      fixture: initial.fixture ?? 'default',
      singleBet: initial.singleBet ?? this.bets[0],
      mode: initial.mode ?? 'normal'
    });

    try {
      const count = preferences?.loadAutoCount?.();
      if (Number.isInteger(count) && count >= 1 && count <= 999) {
        this.lastAutoCount = count;
      }
    } catch (err: any) {
      this.record('preferences.error', { message: err.message });
    }

    this.auto = new AutoAdvance({
      play: () => this._round({ fromAuto: true }),
      delayMs: () => (typeof delayMs === 'function' ? delayMs(this.selection) : delayMs),
      timer,
      cancelTimer,
      onChange: () => this.emit('batch.changed')
    });
  }

  public transitionFSM(target: FSMState): void {
    if (!this.fsm) return;
    const allowed = VALID_FSM_TRANSITIONS[this.fsmState] || ['IDLE'];
    if (!allowed.includes(target) && target !== 'IDLE') {
      this.record('fsm.warning', { from: this.fsmState, to: target });
    }
    this.fsmState = target;
  }

  get state(): Readonly<RuntimeState> {
    const auto = this.auto.state;
    const roundBusy = this.activity !== null;
    const finalizing = this.batchActive && !auto.running;
    const baseState = {
      ready: this.ready,
      busy: roundBusy || this.batchActive,
      roundBusy,
      finalizing,
      ...(this.fsm ? { phase: this.phase, fsmState: this.fsmState } : { phase: this.phase }),
      last: this.last,
      selection: this.selection,
      auto,
      points: this.session?.points ?? null,
      lastAutoCount: this.lastAutoCount,
      pending: this.pending?.type ?? null
    };
    return freeze({
      ...baseState,
      primary: primaryAction(baseState)
    });
  }

  public record(type: string, data: Record<string, any> = {}): void {
    this.diagnostics.record(type, {
      ...(this.fsm ? { phase: this.phase, fsmState: this.fsmState } : { phase: this.phase }),
      activity: this.activity,
      batchActive: this.batchActive,
      roundId: this.last?.id ?? null,
      ...data
    });
  }

  public subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(type: string, data: Record<string, any> = {}): void {
    this.record(type, data);
    const event: RuntimeEvent = freeze({ type, ...data, state: this.state });
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err: any) {
        this.record('observer.error', { message: err.message });
      }
    }
  }

  public attachSession(session: any): void {
    if (this.state.busy) throw new Error('Cannot replace SessionPort during a round');
    this.session = session;
    this.ready = true;
    this.restore();
  }

  public restore(): boolean {
    if (this.activity) return false;
    this.last = this.session?.last ? this.session.replay() : null;
    if (this.last) {
      this.selection = freeze({
        ...this.selection,
        fixture: this.last.fixture,
        singleBet: this.last.singleBet
      });
    }
    this.emit('session.restored');
    return true;
  }

  public setReady(ready: boolean): void {
    this.ready = Boolean(ready);
    if (!ready) this.stopAuto();
    this.emit('ready.changed');
  }

  public configure(patch: Partial<Selection>): boolean {
    if (this.state.busy && Object.keys(patch).some((key) => key !== 'mode')) {
      this.record('command.rejected', { command: 'configure', reason: 'busy' });
      return false;
    }
    const next: Selection = { ...this.selection, ...patch };
    if (
      typeof next.fixture !== 'string' ||
      !next.fixture ||
      !this.bets.includes(next.singleBet) ||
      !['normal', 'burst'].includes(next.mode)
    ) {
      throw new Error('回合設定不符');
    }
    this.selection = freeze(next);
    this.emit('selection.changed');
    return true;
  }

  public setPhase(phase: string): void {
    if (!this.activity) return;
    this.phase = phase;
    if (phase === 'walking' || phase === 'revealing') this.transitionFSM('REVEALING');
    else if (phase === 'resolving') this.transitionFSM('RESOLVING');
    else if (phase === 'bonus') this.transitionFSM('BONUS');
    else if (phase === 'celebration') this.transitionFSM('CELEBRATING');
    else if (phase === 'idle') this.transitionFSM('IDLE');
    this.emit('presentation.phase');
  }

  private _context({ replay = false, selection = this.selection } = {}): PresentationContext {
    return Object.freeze({
      replay,
      mode: selection.mode,
      phase: (phase: string) => this.setPhase(phase),
      getAuto: () => this.auto.state,
      shouldFinish: () =>
        !this.auto.running || this.auto.stopping || this.auto.remaining <= 1
    });
  }

  private _invoke(name: keyof PresentationPort<R>, ...args: any[]): any {
    return (this.presentation as any)[name]?.(...args);
  }

  private _safe(name: keyof PresentationPort<R>, ...args: any[]): any {
    try {
      return this._invoke(name, ...args);
    } catch (err: any) {
      this.record('presentation.control-error', { method: name, message: err.message });
      return false;
    }
  }

  private async _executeRound({
    replay,
    selection
  }: {
    replay: boolean;
    selection: Selection;
  }): Promise<any> {
    const context = this._context({ replay, selection });
    let result: any;
    try {
      this.transitionFSM(replay ? 'REPLAYING' : 'BET_COMMITTED');
      result = await runRound({
        session: this.session,
        replay,
        replayRound: this.last,
        fixture: selection.fixture,
        singleBet: selection.singleBet,
        burst: selection.mode === 'burst',
        onAccepted: async (snapshot: any) => {
          this.last = freeze(snapshot);
          this.emit('round.accepted', { replay });
          await this._invoke('accepted', this.last, context);
        },
        present: () => this._invoke('play', this.last, context),
        complete: () => this._invoke('complete', this.last, context),
        recover: async (snapshot: any, err: Error) => {
          this.pending = null;
          this.last = freeze(snapshot);
          this.emit('round.presentation-error', { message: err.message });
          await this._invoke('recover', this.last, err, context);
        }
      });
      if (!result.presentationError) {
        this.last = freeze({ ...this.last, presented: true } as any);
        this.emit('round.presented', { replay });
      }
      return result;
    } catch (err: any) {
      this.pending = null;
      this.emit('round.rejected', { message: err.message });
      throw err;
    } finally {
      this._release();
    }
  }

  private _release(): void {
    this._safe('finalize');
    this.activity = null;
    this.phase = 'idle';
    this.transitionFSM('IDLE');
    this.activeTask = null;
    this.emit('operation.finished');

    if (this.pending) {
      const command = this.pending;
      this.pending = null;
      queueMicrotask(() => {
        if (command.type === 'advance') void this.advance();
        else if (command.type === 'settings') this.requestAutoSettings();
      });
    }
  }

  private _round({ replay = false, fromAuto = false } = {}): Promise<any> {
    if (!this.ready || !this.session || this.activity || (this.batchActive && !fromAuto)) {
      this.record('command.rejected', {
        command: replay ? 'replay' : 'play',
        reason: 'not-ready-or-busy'
      });
      return Promise.resolve(false);
    }
    if (!replay && this.beforeRound) {
      try {
        const patch = this.beforeRound(this.selection, { fromAuto });
        if (patch) this.selection = freeze({ ...this.selection, ...patch });
      } catch (err: any) {
        this.record('beforeRound.error', { message: err.message });
        return Promise.resolve(false);
      }
    }
    this.activity = replay ? 'replay' : 'round';
    this.phase = 'accepting';
    this.emit('operation.started');
    this.activeTask = this._executeRound({ replay, selection: this.selection });
    return this.activeTask;
  }

  public async play(): Promise<any> {
    try {
      return await this._round();
    } catch {
      return false;
    }
  }

  public async replay(): Promise<any> {
    if (!this.last) return false;
    try {
      return await this._round({ replay: true });
    } catch {
      return false;
    }
  }

  public advance(): Promise<any> {
    const action = this.state.primary;
    this.record('command.advance', { action });
    if (action === 'stop') {
      this.collect();
      this.stopAuto();
      return Promise.resolve(false);
    }
    if (action === 'collect-next') {
      this.pending = { type: 'advance' };
      this.collect();
      return Promise.resolve(false);
    }
    if (action === 'accelerate') {
      this._safe('accelerate');
      this.emit('presentation.accelerated');
      return Promise.resolve(false);
    }
    if (action === 'wait') {
      this.record('command.rejected', { command: 'advance', reason: 'waiting' });
      return Promise.resolve(false);
    }
    return this.play();
  }

  public collect(): void {
    this._safe('collect');
    this.emit('presentation.collected');
  }

  public requestAutoSettings(): boolean {
    if (!this.ready || this.batchActive) return false;
    if (this.activity) {
      if (['celebration', 'preview'].includes(this.phase)) {
        this.pending = { type: 'settings' };
        this.collect();
        return true;
      }
      return false;
    }
    this.emit('auto.requested');
    return true;
  }

  public async startAuto(count: number): Promise<boolean> {
    if (!this.ready || this.activity || this.batchActive) return false;
    this.lastAutoCount = count;
    try {
      this.preferences?.saveAutoCount?.(count);
    } catch (err: any) {
      this.record('preferences.error', { message: err.message });
    }
    this.batchActive = true;
    this.emit('batch.started', { total: count });
    try {
      return await this.auto.start(count);
    } finally {
      this.batchActive = false;
      this.emit('batch.finished', { summary: this.auto.state });
    }
  }

  public stopAuto(): void {
    this.auto.stop();
  }
}
