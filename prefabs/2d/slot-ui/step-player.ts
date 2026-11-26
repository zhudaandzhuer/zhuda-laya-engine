// The stateless presentation of a cascade round (a PresentationPort): it reads a saved,
// already-settled snapshot and sequences the board, the HUD, the sound and the celebration:
//   drop the grid → each paying wave (highlight, remove, fall) → multipliers → coins
//   → free spins (each one the same way, the multiplier meter carried) → celebration.
// It never computes money and never calls Math.random. Views are ports, time is an injected
// wait (use FrameClock), so it runs in node tests with fakes. Pure TypeScript.
// Split from <original-cascade-slot>/client/src/renderer/StepPlayer.ts: the order and the
// timings are the source's; its hero poses, dialogue lines and themed views are not, and its
// free spins are played from the round's real spins (the source invented a 15-spin script to
// add up to the bonus total).
import type { PresentationContext, PresentationPort } from '../../systems/slot-round/contracts.ts';
import type { CascadePlay, CascadeSnapshot, Orb, TumbleFrame } from '../slot-client/protocol.ts';
import { DEFAULT_WIN_TIERS, winTier, type WinTier } from './win-tiers.ts';

export interface BoardPort {
  /** Shows a grid at rest. */
  show(grid: number[], orbs: Orb[]): void;
  /** The grid drops in over ms. */
  drop(grid: number[], orbs: Orb[], ms: number): Promise<void>;
  /** One wave: highlight frame.winning, remove, the rest falls, new symbols drop. */
  tumble(frame: TumbleFrame, fast: boolean): Promise<void>;
  /** Multipliers join the win: baseWin × multiplier = win. */
  multiply(orbs: Orb[], baseWin: number, multiplier: number, win: number, fast: boolean): Promise<void>;
  /** Nothing paid (optional). */
  noWin?(fast: boolean): Promise<void> | void;
  /** Back to rest; clears highlights. */
  idle(): void;
}

export interface CelebrationPort {
  /** Counts the win up and holds; resolves when done or collected. */
  play(win: number, bet: number, tier: WinTier, options?: { title?: string }): Promise<void>;
  /** Jumps to the end and closes. */
  collect(): void;
}

export interface HudPort {
  setWin(amount: number): void;
  setTitle?(text: string): void;
  setMultiplier?(multiplier: number): void;
  setFreeSpins?(spin: number, total: number): void;
}

export interface SoundPort {
  play(cue: string): unknown;
}

export interface StepTimings {
  dropMs: number;
  dropFastMs: number;
  waveGapMs: number;
  freeWaveGapMs: number;
  multiplierPauseMs: number;
  noWinMs: number;
  noWinFastMs: number;
  coinMs: number;
  coinFastMs: number;
  spinGapMs: number;
  spinGapFastMs: number;
}

/** The source's measured rhythm (normal / turbo). */
export const DEFAULT_TIMINGS: StepTimings = {
  dropMs: 700,
  dropFastMs: 90,
  waveGapMs: 240,
  freeWaveGapMs: 120,
  multiplierPauseMs: 360,
  noWinMs: 380,
  noWinFastMs: 60,
  coinMs: 80,
  coinFastMs: 45,
  spinGapMs: 280,
  spinGapFastMs: 50,
};

/** Texts the player shows (translate before passing). */
export interface StepTexts {
  roundWin: string;
  feature: string;
  featureWin: string;
}

export const DEFAULT_TEXTS: StepTexts = { roundWin: '本局贏分', feature: '免費遊戲', featureWin: '免費遊戲總贏分' };

export interface CascadeStepPlayerOptions {
  board: BoardPort;
  celebration: CelebrationPort;
  hud?: HudPort;
  sound?: SoundPort;
  /** Frame-driven wait (FrameClock.wait); default setTimeout. */
  wait?: (ms: number) => Promise<void>;
  timings?: Partial<StepTimings>;
  tiers?: WinTier[];
  texts?: Partial<StepTexts>;
  /** Called with true on accelerate and false when the round ends (e.g. clock.speed). */
  onAccelerate?: (on: boolean) => void;
}

export class CascadeStepPlayer implements PresentationPort<CascadeSnapshot> {
  readonly timings: StepTimings;
  readonly texts: StepTexts;
  private o: CascadeStepPlayerOptions;
  private wait: (ms: number) => Promise<void>;
  private tiers: WinTier[];
  accelerated = false;
  /** What was played last, for checks: 'drop', 'wave:1', 'multiply', 'free:3', 'celebrate:big'… */
  readonly trace: string[] = [];

  constructor(options: CascadeStepPlayerOptions) {
    this.o = options;
    this.wait = options.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.timings = { ...DEFAULT_TIMINGS, ...options.timings };
    this.texts = { ...DEFAULT_TEXTS, ...options.texts };
    this.tiers = options.tiers ?? DEFAULT_WIN_TIERS;
  }

  private sound(cue: string): void {
    this.o.sound?.play(cue);
  }

  accepted(): void {
    this.accelerated = false;
    this.trace.length = 0;
    this.o.board.idle();
  }

  private async playSpin(spin: CascadePlay, fast: () => boolean, waveGap: number): Promise<void> {
    const t = this.timings;
    this.sound('spin');
    this.trace.push('drop');
    await this.o.board.drop(spin.grid, spin.orbs, fast() ? t.dropFastMs : t.dropMs);
    if (spin.waves.length) {
      for (const frame of spin.waves) {
        this.sound('tumble');
        this.trace.push(`wave:${frame.wave}`);
        await this.o.board.tumble(frame, fast());
        if (!fast() && spin.waves.length > 1) await this.wait(waveGap);
      }
      if (spin.multiplier > 1 && spin.baseWin > 0) {
        this.sound('multiplier');
        if (!fast()) await this.wait(t.multiplierPauseMs);
        this.trace.push(`multiply:${spin.multiplier}`);
        await this.o.board.multiply(spin.finalOrbs, spin.baseWin, spin.multiplier, spin.win - spin.scatterWin, fast());
      }
    } else {
      this.trace.push('no-win');
      await this.o.board.noWin?.(fast());
      await this.wait(fast() ? t.noWinFastMs : t.noWinMs);
    }
  }

  async play(round: Readonly<CascadeSnapshot>, context: PresentationContext): Promise<void> {
    const t = this.timings;
    const fast = () => context.mode === 'burst' || this.accelerated;
    const hud = this.o.hud;
    context.phase('revealing');
    hud?.setTitle?.(this.texts.roundWin);
    hud?.setMultiplier?.(1);
    await this.playSpin(round.p.spin, fast, t.waveGapMs);
    if (round.p.spin.multiplier > 1) hud?.setMultiplier?.(round.p.spin.multiplier);
    context.phase('resolving');
    hud?.setWin(round.p.mainWin);
    if (round.p.mainWin > 0) {
      this.sound('coin');
      await this.wait(fast() ? t.coinFastMs : t.coinMs);
    }
    const spins = round.b.spins ?? [];
    if (spins.length) {
      context.phase('bonus');
      this.sound('feature');
      hud?.setTitle?.(this.texts.feature);
      let total = 0;
      for (let i = 0; i < spins.length; i++) {
        hud?.setFreeSpins?.(i + 1, spins.length);
        this.trace.push(`free:${i + 1}`);
        await this.playSpin(spins[i], fast, t.freeWaveGapMs);
        total += spins[i].win;
        hud?.setMultiplier?.(Math.max(1, spins[i].globalMultiplier));
        hud?.setWin(round.p.mainWin + total);
        await this.wait(fast() ? t.spinGapFastMs : t.spinGapMs);
      }
      hud?.setTitle?.(this.texts.featureWin);
      const tier = winTier(round.b.total, round.bet, this.tiers) ?? { ...this.tiers[0], id: 'feature', label: this.texts.featureWin };
      this.sound('win-feature');
      this.trace.push('feature-total');
      context.phase('celebration');
      await this.o.celebration.play(round.b.total, round.bet, tier, { title: this.texts.featureWin });
    }
    const tier = winTier(round.win, round.bet, this.tiers);
    if (!spins.length && tier && !fast()) {
      context.phase('celebration');
      this.sound(`win-${tier.id}`);
      this.trace.push(`celebrate:${tier.id}`);
      await this.o.celebration.play(round.win, round.bet, tier);
    }
  }

  complete(round: Readonly<CascadeSnapshot>, context: PresentationContext): void {
    this.o.board.idle();
    this.o.hud?.setWin(round.win);
    context.phase('idle');
  }

  recover(_round: Readonly<CascadeSnapshot>, _error: Error, context?: PresentationContext): void {
    this.o.board.idle();
    this.o.celebration.collect();
    context?.phase('idle');
  }

  accelerate(): void {
    this.accelerated = true;
    this.o.onAccelerate?.(true);
    this.o.celebration.collect();
  }

  collect(): void {
    this.sound('collect');
    this.o.celebration.collect();
  }

  interrupt(): void {
    this.o.celebration.collect();
  }

  finalize(): void {
    this.accelerated = false;
    this.o.onAccelerate?.(false);
  }
}
