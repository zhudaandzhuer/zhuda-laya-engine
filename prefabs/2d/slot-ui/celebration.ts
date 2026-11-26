// The big-win overlay: dims the stage, shows the tier name and counts the win up, holds, and
// closes by itself or on a tap (collect). Implements CelebrationPort. Runs on a FrameClock.
// Needs the engine (Laya 2D). Neutral look drawn by code.
import { easeOutQuad, type FrameClock } from './frame-clock.ts';
import type { CelebrationPort } from './step-player.ts';
import type { WinTier } from './win-tiers.ts';

export interface CelebrationOptions {
  width: number;
  height: number;
  clock: FrameClock;
  /** How long the final amount stays (ms, default 1400). */
  holdMs?: number;
  formatWin?: (amount: number) => string;
  colors?: Partial<{ dim: string; panel: string; edge: string; title: string; amount: string }>;
}

export class Celebration implements CelebrationPort {
  readonly root = new Laya.Sprite();
  /** Shown amount (for checks). */
  shown = 0;
  playing = false;
  private o: Required<Omit<CelebrationOptions, 'colors'>> & { colors: { dim: string; panel: string; edge: string; title: string; amount: string } };
  private title: Laya.Text;
  private amount: Laya.Text;
  private sub: Laya.Text;
  private done: (() => void) | null = null;
  private target = 0;
  private serial = 0;

  constructor(options: CelebrationOptions) {
    this.o = {
      holdMs: 1400,
      formatWin: (n: number) => n.toLocaleString('en-US'),
      ...options,
      colors: { dim: 'rgba(3,6,16,0.74)', panel: 'rgba(17,24,48,0.96)', edge: '#fbbf24', title: '#fde68a', amount: '#ffffff', ...options.colors },
    };
    const { width: w, height: h } = this.o;
    this.root.name = 'Celebration';
    this.root.size(w, h);
    this.root.graphics.drawRect(0, 0, w, h, this.o.colors.dim);
    const pw = Math.min(720, w - 80);
    const ph = 260;
    this.root.graphics.drawRoundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 28, 28, 28, 28, this.o.colors.panel, this.o.colors.edge, 4);
    const text = (size: number, color: string, y: number) => {
      const t = new Laya.Text();
      t.fontSize = size;
      t.color = color;
      t.bold = true;
      t.align = 'center';
      t.width = w;
      t.stroke = Math.max(2, size / 10);
      t.strokeColor = '#0b1020';
      t.pos(0, y);
      this.root.addChild(t);
      return t;
    };
    this.title = text(54, this.o.colors.title, h / 2 - 110);
    this.amount = text(84, this.o.colors.amount, h / 2 - 34);
    this.sub = text(22, '#94a3b8', h / 2 + 72);
    this.sub.text = '點一下收下';
    this.root.visible = false;
    this.root.on(Laya.Event.CLICK, this, () => this.collect());
  }

  async play(win: number, _bet: number, tier: WinTier, options: { title?: string } = {}): Promise<void> {
    this.collect();
    this.playing = true;
    this.target = win;
    this.shown = 0;
    this.title.text = options.title ?? tier.label;
    this.amount.text = this.o.formatWin(0);
    this.root.visible = true;
    this.root.alpha = 1;
    const finished = new Promise<void>((resolve) => (this.done = resolve));
    const id = ++this.serial; // a later play() or collect() wins over this one's timers
    void this.clock
      .tween(tier.countMs, (t) => id === this.serial && this.setShown(Math.floor(win * t)), easeOutQuad)
      .then(() => (id === this.serial && this.playing ? this.clock.wait(this.o.holdMs) : undefined))
      .then(() => id === this.serial && this.collect());
    return finished;
  }

  private get clock(): FrameClock {
    return this.o.clock;
  }

  private setShown(n: number): void {
    if (!this.playing) return;
    this.shown = n;
    this.amount.text = this.o.formatWin(n);
  }

  collect(): void {
    if (!this.done) return;
    this.shown = this.target;
    this.amount.text = this.o.formatWin(this.target);
    this.playing = false;
    this.root.visible = false;
    const done = this.done;
    this.done = null;
    done();
  }
}
