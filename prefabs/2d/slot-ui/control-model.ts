// The control bar's rules without drawing: what the big button shows for each primary action,
// which controls are usable, bet stepping (clamped or looping), auto count, turbo.
// Pure TypeScript; control-bar.ts draws it.
// Split from <original-cascade-slot>/client/src/ui/ControlBar.ts (the five-way button, the
// 360 ms long press, bet buttons off while a round runs, auto pill usable to stop).
import type { PrimaryAction } from '../../systems/slot-round/contracts.ts';

export interface ButtonFace {
  icon: string;
  label: string;
  color: string;
  /** The big button takes clicks. */
  enabled: boolean;
}

export const DEFAULT_FACES: Record<PrimaryAction, ButtonFace> = {
  advance: { icon: '↻', label: '旋轉', color: '#ffffff', enabled: true },
  stop: { icon: '■', label: '停止', color: '#f87171', enabled: true },
  'collect-next': { icon: '✓', label: '收下', color: '#facc15', enabled: true },
  accelerate: { icon: '▶▶', label: '快轉', color: '#38bdf8', enabled: true },
  wait: { icon: '…', label: '稍候', color: '#94a3b8', enabled: false },
};

/** A long press of the big button (ms) opens auto settings instead of spinning. */
export const LONG_PRESS_MS = 360;

export function stepBet(bets: number[], current: number, direction: number, loop = false): number {
  const i = Math.max(0, bets.indexOf(current));
  let next = i + direction;
  if (loop) next = ((next % bets.length) + bets.length) % bets.length;
  else next = Math.min(bets.length - 1, Math.max(0, next));
  return bets[next];
}

export class ControlModel {
  action: PrimaryAction = 'advance';
  bet: number;
  burst = false;
  autoRemaining = 0;
  readonly bets: number[];
  faces: Record<PrimaryAction, ButtonFace>;

  constructor(bets: number[], { bet = bets[0], faces = DEFAULT_FACES }: { bet?: number; faces?: Record<PrimaryAction, ButtonFace> } = {}) {
    this.bets = [...bets];
    this.bet = bet;
    this.faces = faces;
  }

  get face(): ButtonFace {
    return this.faces[this.action];
  }

  /** Bets change only between rounds. */
  get betEnabled(): boolean {
    return this.action === 'advance';
  }

  /** The auto pill opens settings between rounds and stops a running auto. */
  get autoEnabled(): boolean {
    return this.action === 'advance' || this.autoRemaining > 0;
  }

  /** Returns the new bet, or null when nothing changed (or bets are locked). */
  step(direction: number, loop = false): number | null {
    if (!this.betEnabled) return null;
    const next = stepBet(this.bets, this.bet, direction, loop);
    if (next === this.bet) return null;
    this.bet = next;
    return next;
  }

  toggleBurst(): boolean {
    this.burst = !this.burst;
    return this.burst;
  }
}
