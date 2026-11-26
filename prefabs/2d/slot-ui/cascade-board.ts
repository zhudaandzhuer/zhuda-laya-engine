// A cascade board drawn by code: cols × rows cells, grids drop in column by column, winning
// cells light up, pop and the rest falls with new symbols from the top, multiplier balls show
// their values and fly into "base × multiplier = win". Implements BoardPort for
// CascadeStepPlayer; all motion runs on a FrameClock. Needs the engine (Laya 2D).
import type { Orb, TumbleFrame } from '../slot-client/protocol.ts';
import { easeInQuad, easeOutBack, easeOutQuad, type FrameClock } from './frame-clock.ts';
import type { BoardPort } from './step-player.ts';
import { shapePainter, type SymbolPainter } from './symbols.ts';

export interface CascadeBoardOptions {
  cols: number;
  rows: number;
  clock: FrameClock;
  /** Cell size and gap in design pixels. */
  cell?: number;
  gap?: number;
  multiplierSymbol: number;
  painter?: SymbolPainter;
  /** Frame and cell colours. */
  colors?: Partial<{ frame: string; frameEdge: string; cell: string; cellEdge: string; glow: string; text: string }>;
  /** Text of the "+win" label (default the number with separators). */
  formatWin?: (amount: number) => string;
}

const DEFAULT_COLORS = { frame: 'rgba(10,14,28,0.92)', frameEdge: '#3b4a6b', cell: '#18213a', cellEdge: '#26324f', glow: '#fde047', text: '#f8fafc' };

function label(size: number, color: string, bold = true): Laya.Text {
  const t = new Laya.Text();
  t.fontSize = size;
  t.color = color;
  t.bold = bold;
  t.align = 'center';
  t.stroke = Math.max(2, size / 9);
  t.strokeColor = '#0b1020';
  return t;
}

export class CascadeBoard implements BoardPort {
  readonly root = new Laya.Sprite();
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly pitch: number;
  readonly width: number;
  readonly height: number;
  grid: number[] = [];
  orbs = new Map<number, number>();
  private clock: FrameClock;
  private painter: SymbolPainter;
  private colors: typeof DEFAULT_COLORS;
  private multiplierSymbol: number;
  private formatWin: (n: number) => string;
  private layer = new Laya.Sprite();
  private sprites: Laya.Sprite[] = [];
  private values: Laya.Text[] = [];
  private glow = new Laya.Sprite();
  private banner: Laya.Text;
  private equation: Laya.Text;

  constructor(o: CascadeBoardOptions) {
    this.cols = o.cols;
    this.rows = o.rows;
    this.cell = o.cell ?? 92;
    const gap = o.gap ?? 6;
    this.pitch = this.cell + gap;
    this.width = this.cols * this.pitch - gap;
    this.height = this.rows * this.pitch - gap;
    this.clock = o.clock;
    this.painter = o.painter ?? shapePainter();
    this.colors = { ...DEFAULT_COLORS, ...o.colors };
    this.multiplierSymbol = o.multiplierSymbol;
    this.formatWin = o.formatWin ?? ((n) => n.toLocaleString('en-US'));
    this.root.name = 'CascadeBoard';
    const pad = 14;
    const back = new Laya.Sprite();
    back.graphics.drawRoundRect(-pad, -pad, this.width + pad * 2, this.height + pad * 2, 18, 18, 18, 18, this.colors.frame, this.colors.frameEdge, 3);
    for (let i = 0; i < this.cols * this.rows; i++) {
      const [x, y] = this.at(i);
      back.graphics.drawRoundRect(x, y, this.cell, this.cell, 10, 10, 10, 10, this.colors.cell, this.colors.cellEdge, 1.5);
    }
    this.root.addChild(back);
    this.root.addChild(this.glow);
    // cells are clipped to the board so new symbols can start above it
    this.layer.scrollRect = new Laya.Rectangle(-pad, -pad, this.width + pad * 2, this.height + pad * 2);
    this.layer.pos(-pad, -pad);
    this.root.addChild(this.layer);
    const inner = new Laya.Sprite(); // layer-local = board coordinates (the scrollRect starts at -pad)
    this.layer.addChild(inner);
    for (let i = 0; i < this.cols * this.rows; i++) {
      const s = new Laya.Sprite();
      s.pivot(this.cell / 2, this.cell / 2);
      const v = label(Math.round(this.cell * 0.26), '#ffffff');
      v.width = this.cell;
      v.pos(0, this.cell * 0.36);
      s.addChild(v);
      inner.addChild(s);
      this.sprites.push(s);
      this.values.push(v);
    }
    this.banner = label(40, '#fde047');
    this.banner.width = this.width;
    this.banner.pos(0, this.height / 2 - 26);
    this.banner.visible = false;
    this.root.addChild(this.banner);
    this.equation = label(46, '#ffffff');
    this.equation.width = this.width;
    this.equation.pos(0, this.height / 2 - 30);
    this.equation.visible = false;
    this.root.addChild(this.equation);
  }

  /** Top-left of cell i. */
  at(i: number): [number, number] {
    return [(i % this.cols) * this.pitch, Math.floor(i / this.cols) * this.pitch];
  }

  private paint(i: number, symbol: number, orb?: number): void {
    const s = this.sprites[i];
    s.graphics.clear();
    this.painter(s.graphics, symbol, this.cell / 2, this.cell / 2, this.cell);
    const v = this.values[i];
    v.visible = symbol === this.multiplierSymbol && orb !== undefined;
    v.text = v.visible ? `×${orb}` : '';
    s.alpha = 1;
    s.scale(1, 1);
  }

  private place(i: number, yOffset = 0): void {
    const [x, y] = this.at(i);
    this.sprites[i].pos(x + this.cell / 2, y + this.cell / 2 + yOffset);
  }

  private setGrid(grid: number[], orbs: Orb[]): void {
    this.grid = [...grid];
    this.orbs = new Map(orbs.map((o) => [o.cell, o.value]));
    grid.forEach((sym, i) => this.paint(i, sym, this.orbs.get(i)));
  }

  show(grid: number[], orbs: Orb[]): void {
    this.setGrid(grid, orbs);
    grid.forEach((_, i) => this.place(i));
  }

  async drop(grid: number[], orbs: Orb[], ms: number): Promise<void> {
    this.idle();
    const from = this.grid.length ? [...this.grid] : null;
    const fall = this.height + this.pitch;
    if (from && ms > 120) {
      // the old grid falls out first
      await this.clock.tween(ms * 0.3, (t) => from.forEach((_, i) => this.place(i, fall * t)), easeInQuad);
    }
    this.setGrid(grid, orbs);
    const stagger = ms * 0.07;
    const each = Math.max(1, ms - stagger * (this.cols - 1));
    await this.clock.tween(ms, (t) => {
      const now = t * ms;
      grid.forEach((_, i) => {
        const col = i % this.cols;
        const row = Math.floor(i / this.cols);
        const k = Math.min(1, Math.max(0, (now - col * stagger) / each));
        this.place(i, -(fall + (this.rows - row) * 8) * (1 - easeOutBack(k)));
      });
    });
  }

  private highlight(cells: number[], on: boolean): void {
    this.glow.graphics.clear();
    if (!on) return;
    for (const i of cells) {
      const [x, y] = this.at(i);
      this.glow.graphics.drawRoundRect(x - 4, y - 4, this.cell + 8, this.cell + 8, 14, 14, 14, 14, 'rgba(253,224,71,0.22)', this.colors.glow, 3);
    }
  }

  async tumble(frame: TumbleFrame, fast: boolean): Promise<void> {
    const k = fast ? 0.3 : 1;
    const win = frame.winning;
    this.highlight(win, true);
    this.banner.text = `+${this.formatWin(frame.waveWin)}`;
    this.banner.visible = true;
    await this.clock.tween(320 * k, (t) => win.forEach((i) => this.sprites[i].scale(1 + 0.14 * Math.sin(t * Math.PI * 2), 1 + 0.14 * Math.sin(t * Math.PI * 2))));
    await this.clock.tween(180 * k, (t) => win.forEach((i) => {
      this.sprites[i].scale(1 + 0.3 * t, 1 + 0.3 * t);
      this.sprites[i].alpha = 1 - t;
    }), easeOutQuad);
    this.highlight(win, false);
    // where each cell of gridAfter comes from: survivors keep their order and fall, new ones drop from above
    const gone = new Set(win);
    const start = new Array<number>(this.cols * this.rows).fill(0);
    for (let c = 0; c < this.cols; c++) {
      const survivorsFrom: number[] = [];
      for (let r = this.rows - 1; r >= 0; r--) if (!gone.has(r * this.cols + c)) survivorsFrom.push(r);
      const needed = this.rows - survivorsFrom.length;
      for (let r = this.rows - 1; r >= 0; r--) {
        const k2 = this.rows - 1 - r;
        const fromRow = k2 < survivorsFrom.length ? survivorsFrom[k2] : r - needed;
        start[r * this.cols + c] = (fromRow - r) * this.pitch;
      }
    }
    this.setGrid(frame.gridAfter, frame.orbsAfter);
    frame.gridAfter.forEach((_, i) => this.place(i, start[i]));
    await this.clock.tween(320 * k, (t) => frame.gridAfter.forEach((_, i) => this.place(i, start[i] * (1 - t))), easeInQuad);
    this.banner.visible = false;
  }

  async multiply(orbs: Orb[], baseWin: number, multiplier: number, win: number, fast: boolean): Promise<void> {
    const k = fast ? 0.25 : 1;
    const cells = orbs.map((o) => o.cell).filter((i) => i < this.sprites.length);
    this.highlight(cells, true);
    await this.clock.tween(420 * k, (t) => cells.forEach((i) => this.sprites[i].scale(1 + 0.35 * Math.sin(t * Math.PI), 1 + 0.35 * Math.sin(t * Math.PI))));
    this.equation.text = `${this.formatWin(baseWin)} × ${multiplier} = ${this.formatWin(win)}`;
    this.equation.visible = true;
    this.equation.alpha = 0;
    await this.clock.tween(260 * k, (t) => (this.equation.alpha = t), easeOutQuad);
    await this.clock.wait(700 * k);
    this.highlight(cells, false);
  }

  idle(): void {
    this.highlight([], false);
    this.banner.visible = false;
    this.equation.visible = false;
    this.sprites.forEach((s, i) => {
      s.alpha = 1;
      s.scale(1, 1);
      if (this.grid.length) this.place(i);
    });
  }
}
