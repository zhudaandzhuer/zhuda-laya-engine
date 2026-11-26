// Auto-advance: plays up to 999 rounds in a row with a pause between them, and audits each
// result (a new round id, safe non-negative bet and win) before counting it. stop() ends the
// batch after the round being shown; a presentation error ends it too.
// From games/dungeon-spin (AutoAdvance.ts), unchanged but for the imports.
import type { AutoState } from './contracts.ts';

export interface AutoAdvanceOptions {
  play: () => Promise<any>;
  onChange?: (state: AutoState) => void;
  delayMs?: number | (() => number);
  timer?: (fn: () => void, ms: number) => any;
  cancelTimer?: (id: any) => void;
}

export class AutoAdvance {
  private play: () => Promise<any>;
  private onChange: (state: AutoState) => void;
  private delayMs: number | (() => number);
  private timer: (fn: () => void, ms: number) => any;
  private cancelTimer: (id: any) => void;

  public running: boolean = false;
  public stopping: boolean = false;
  public remaining: number = 0;
  public completed: number = 0;
  public total: number = 0;
  public reason: string = 'idle';
  public error: Error | null = null;
  private releaseGap: (() => void) | null = null;
  public totalBet: number = 0;
  public totalWin: number = 0;
  private roundIds: Set<string> = new Set();

  constructor({
    play,
    onChange = () => {},
    delayMs = 450,
    timer = setTimeout,
    cancelTimer = clearTimeout
  }: AutoAdvanceOptions) {
    this.play = play;
    this.onChange = onChange;
    this.delayMs = delayMs;
    this.timer = (fn, ms) => timer(fn, ms);
    this.cancelTimer = (id) => cancelTimer(id);
  }

  get state(): AutoState {
    return {
      running: this.running,
      stopping: this.stopping,
      remaining: this.remaining,
      completed: this.completed,
      total: this.total,
      reason: this.reason,
      error: this.error,
      totalBet: this.totalBet,
      totalWin: this.totalWin,
      net: this.totalWin - this.totalBet
    };
  }

  private emit(): void {
    this.onChange(this.state);
  }

  public stop(): void {
    if (!this.running || this.stopping) return;
    this.stopping = true;
    this.emit();
    this.releaseGap?.();
  }

  public async start(count: number): Promise<boolean> {
    if (this.running) return false;
    if (!Number.isSafeInteger(count) || count < 1 || count > 999) {
      throw new Error('請輸入 1–999 局');
    }
    this.running = true;
    this.stopping = false;
    this.remaining = count;
    this.completed = 0;
    this.total = count;
    this.reason = 'running';
    this.error = null;
    this.totalBet = 0;
    this.totalWin = 0;
    this.roundIds.clear();
    this.emit();

    try {
      while (this.remaining > 0 && !this.stopping) {
        const result = await this.play();
        if (result === false) throw new Error('本局未完成，自動前進已停止');

        if (result && typeof result === 'object' && !result.replay) {
          const { id, bet, win } = result;
          if (
            typeof id !== 'string' ||
            !id ||
            ![bet, win, this.totalBet + bet, this.totalWin + win].every(
              (n) => Number.isSafeInteger(n) && n >= 0
            )
          ) {
            throw new Error('自動回合結算資料不完整');
          }
          if (this.roundIds.has(id)) {
            throw new Error('重複回合，自動前進已停止');
          }
          this.roundIds.add(id);
          this.totalBet += bet;
          this.totalWin += win;
        } else {
          throw new Error('本局沒有可核對的結算資料');
        }

        this.completed++;
        this.remaining--;
        this.emit();

        if (result.presentationError) {
          this.error = result.presentationError;
          this.reason = 'presentation-error';
          break;
        }

        if (this.remaining > 0 && !this.stopping) {
          await new Promise<void>((resolve) => {
            const done = () => {
              this.cancelTimer(timerId);
              this.releaseGap = null;
              resolve();
            };
            const delay = typeof this.delayMs === 'function' ? this.delayMs() : this.delayMs;
            const timerId = this.timer(done, delay);
            this.releaseGap = done;
          });
        }
      }
      if (this.reason !== 'presentation-error') {
        this.reason = this.stopping ? 'stopped' : 'complete';
      }
    } catch (err: any) {
      this.error = err;
      this.reason = 'error';
    } finally {
      this.running = false;
      this.stopping = false;
      this.remaining = 0;
      this.releaseGap = null;
      this.emit();
    }
    return this.reason === 'complete';
  }
}
