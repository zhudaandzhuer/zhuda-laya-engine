// Slot dialogs drawn by code (neutral skin) on one modal base: a dimming mask (tap closes),
// a box, a title and ✕. AutoPlayDialog picks a round count; BuyFeatureDialog asks to buy the
// feature and refuses when the balance is short; ReceiptDialog shows a settled round: the
// first grid with the first wave's cells lit, every award by wave, base × multiplier,
// free spins and the tier. Needs the engine (Laya 2D).
// Behaviour from <original-cascade-slot>/client/src/ui/dialogs/ (AutoAdvanceDialog,
// BuyBonusConfirmDialog, RoundReceiptDialog); their texts and art were not carried.
import type { CascadeSnapshot } from '../slot-client/protocol.ts';
import { shapePainter, type SymbolPainter } from './symbols.ts';
import { DEFAULT_WIN_TIERS, winTier, type WinTier } from './win-tiers.ts';

function text(size: number, color: string, align: 'left' | 'center' = 'left', width = 0, bold = true): Laya.Text {
  const t = new Laya.Text();
  t.fontSize = size;
  t.color = color;
  t.bold = bold;
  t.align = align;
  if (width) t.width = width;
  return t;
}

function pill(w: number, h: number, fill: string, edge: string, label: string, size = 20): { root: Laya.Sprite; label: Laya.Text; redraw(fill: string, edge: string): void } {
  const root = new Laya.Sprite();
  root.size(w, h);
  root.mouseEnabled = true;
  const t = text(size, '#ffffff', 'center', w);
  t.text = label;
  t.pos(0, (h - size) / 2 - 1);
  root.addChild(t);
  const redraw = (f: string, e: string) => {
    root.graphics.clear();
    root.graphics.drawRoundRect(0, 0, w, h, 10, 10, 10, 10, f, e, 2);
  };
  redraw(fill, edge);
  return { root, label: t, redraw };
}

export class ModalDialog {
  readonly root = new Laya.Sprite();
  readonly box = new Laya.Sprite();
  onClose: (() => void) | null = null;
  protected title: Laya.Text;
  readonly boxWidth: number;
  readonly boxHeight: number;

  constructor(stageWidth: number, stageHeight: number, boxWidth: number, boxHeight: number, title: string) {
    this.boxWidth = boxWidth;
    this.boxHeight = boxHeight;
    this.root.size(stageWidth, stageHeight);
    const mask = new Laya.Sprite();
    mask.size(stageWidth, stageHeight);
    mask.graphics.drawRect(0, 0, stageWidth, stageHeight, 'rgba(0,0,0,0.72)');
    mask.on(Laya.Event.CLICK, this, () => this.hide());
    this.root.addChild(mask);
    this.box.size(boxWidth, boxHeight);
    this.box.mouseEnabled = true; // taps on the box do not reach the mask
    this.box.pos((stageWidth - boxWidth) / 2, (stageHeight - boxHeight) / 2);
    this.box.graphics.drawRoundRect(0, 0, boxWidth, boxHeight, 18, 18, 18, 18, '#0f172a', '#38bdf8', 2);
    this.root.addChild(this.box);
    this.title = text(26, '#f8fafc');
    this.title.text = title;
    this.title.pos(30, 24);
    this.box.addChild(this.title);
    const close = text(28, '#94a3b8');
    close.text = '✕';
    close.size(40, 40);
    close.pos(boxWidth - 54, 20);
    close.mouseEnabled = true;
    close.on(Laya.Event.CLICK, this, () => this.hide());
    this.box.addChild(close);
    this.root.visible = false;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.root.visible = true;
  }

  hide(): void {
    if (!this.root.visible) return;
    this.root.visible = false;
    this.onClose?.();
  }
}

export class AutoPlayDialog extends ModalDialog {
  onConfirm: ((count: number) => void) | null = null;
  selected: number;
  private choices: Array<{ count: number; redraw(fill: string, edge: string): void }> = [];

  constructor(stageWidth: number, stageHeight: number, { counts = [10, 25, 50, 100], title = '自動旋轉', hint = '選擇局數（隨時可以停止）', start = '開始自動旋轉' } = {}) {
    super(stageWidth, stageHeight, 520, 330, title);
    this.selected = counts[0];
    const h = text(18, '#94a3b8', 'left', 0, false);
    h.text = hint;
    h.pos(30, 70);
    this.box.addChild(h);
    const gap = 14;
    const w = (520 - 60 - gap * (counts.length - 1)) / counts.length;
    counts.forEach((count, i) => {
      const p = pill(w, 60, '#1e293b', '#475569', String(count), 24);
      p.root.pos(30 + i * (w + gap), 118);
      p.root.on(Laya.Event.CLICK, this, () => this.select(count));
      this.box.addChild(p.root);
      this.choices.push({ count, redraw: p.redraw });
    });
    const go = pill(460, 64, '#059669', '#34d399', start, 22);
    go.root.pos(30, 222);
    go.root.on(Laya.Event.CLICK, this, () => {
      const n = this.selected;
      this.hide();
      this.onConfirm?.(n);
    });
    this.box.addChild(go.root);
    this.select(this.selected);
  }

  select(count: number): void {
    this.selected = count;
    for (const c of this.choices) c.redraw(c.count === count ? '#0284c7' : '#1e293b', c.count === count ? '#38bdf8' : '#475569');
  }

  showWith(count: number): void {
    if (this.choices.some((c) => c.count === count)) this.select(count);
    this.show();
  }
}

export class BuyFeatureDialog extends ModalDialog {
  cost = 0;
  balance = 0;
  private prompt: Laya.Text;
  private balanceLine: Laya.Text;
  private warning: Laya.Text;
  private confirm: ReturnType<typeof pill>;
  private onConfirm: (() => void) | null = null;
  private format: (n: number) => string;

  constructor(stageWidth: number, stageHeight: number, { title = '購買免費遊戲', confirm = '✓ 購買', cancel = '✕ 取消', short = '餘額不足', format = (n: number) => n.toLocaleString('en-US') } = {}) {
    super(stageWidth, stageHeight, 480, 280, title);
    this.format = format;
    this.prompt = text(22, '#ffffff', 'center', 480);
    this.prompt.pos(0, 84);
    this.box.addChild(this.prompt);
    this.balanceLine = text(17, '#94a3b8', 'center', 480, false);
    this.balanceLine.pos(0, 122);
    this.box.addChild(this.balanceLine);
    this.warning = text(17, '#ef4444', 'center', 480);
    this.warning.text = short;
    this.warning.pos(0, 150);
    this.box.addChild(this.warning);
    const no = pill(180, 56, '#273549', '#64748b', cancel);
    no.root.pos(50, 196);
    no.root.on(Laya.Event.CLICK, this, () => this.hide());
    this.box.addChild(no.root);
    this.confirm = pill(180, 56, '#059669', '#34d399', confirm);
    this.confirm.root.pos(250, 196);
    this.confirm.root.on(Laya.Event.CLICK, this, () => {
      if (this.balance < this.cost) return;
      const cb = this.onConfirm;
      this.hide();
      cb?.();
    });
    this.box.addChild(this.confirm.root);
  }

  get affordable(): boolean {
    return this.balance >= this.cost;
  }

  /** Opens with a price and the balance; onConfirm runs only when affordable. */
  open(cost: number, balance: number, onConfirm: () => void, prompt = `用 ${this.format(cost)} 購買免費遊戲？`): void {
    this.cost = cost;
    this.balance = balance;
    this.onConfirm = onConfirm;
    this.prompt.text = prompt;
    this.balanceLine.text = `目前餘額 ${this.format(balance)}`;
    this.warning.visible = !this.affordable;
    this.confirm.root.mouseEnabled = this.affordable;
    this.confirm.redraw(this.affordable ? '#059669' : '#1e293b', this.affordable ? '#34d399' : '#475569');
    this.confirm.label.color = this.affordable ? '#ffffff' : '#64748b';
    this.show();
  }
}

export interface ReceiptOptions {
  painter?: SymbolPainter;
  names?: Record<number, string>;
  tiers?: WinTier[];
  format?: (n: number) => string;
  title?: string;
}

export class ReceiptDialog extends ModalDialog {
  private board = new Laya.Sprite();
  private rows = new Laya.Sprite();
  private info: Laya.Text;
  private total: Laya.Text;
  private o: Required<ReceiptOptions>;
  /** The last summary line (for checks). */
  summary = '';

  constructor(stageWidth: number, stageHeight: number, options: ReceiptOptions = {}) {
    super(stageWidth, stageHeight, 940, 560, options.title ?? '本局明細');
    this.o = { painter: shapePainter(), names: {}, tiers: DEFAULT_WIN_TIERS, format: (n) => n.toLocaleString('en-US'), title: '本局明細', ...options };
    this.info = text(18, '#cbd5e1', 'left', 0, false);
    this.info.pos(30, 66);
    this.box.addChild(this.info);
    this.board.pos(30, 104);
    this.box.addChild(this.board);
    this.rows.pos(470, 104);
    this.box.addChild(this.rows);
    this.total = text(22, '#fde047', 'left', 880);
    this.total.pos(30, 500);
    this.box.addChild(this.total);
  }

  update(round: Readonly<CascadeSnapshot>): void {
    const { p, b } = round;
    const spin = p.spin;
    const f = this.o.format;
    this.info.text = `下注 ${f(round.bet)} · 倍數 ×${spin.multiplier} · ${spin.waves.length} 波消除${b.spins.length ? ` · 免費遊戲 ${b.spins.length} 局` : ''}`;
    const cell = Math.floor(Math.min(400 / spin.cols, 380 / spin.rows));
    const lit = new Set(spin.waves[0]?.winning ?? []);
    this.board.graphics.clear();
    spin.grid.forEach((sym, i) => {
      const x = (i % spin.cols) * cell;
      const y = Math.floor(i / spin.cols) * cell;
      this.board.graphics.drawRoundRect(x + 2, y + 2, cell - 4, cell - 4, 6, 6, 6, 6, lit.has(i) ? 'rgba(250,204,21,0.25)' : '#131e2d', lit.has(i) ? '#fbbf24' : '#223247', lit.has(i) ? 2 : 1);
      this.o.painter(this.board.graphics, sym, x + cell / 2, y + cell / 2, cell * 0.8);
    });
    this.rows.removeChildren();
    const all = [...spin.waves.flatMap((w) => w.awards.map((a) => ({ wave: `第 ${w.wave} 波`, a }))), ...(spin.scatterWin ? [{ wave: '分散', a: { label: `分散符號 ×${spin.scatterCount}`, amount: spin.scatterWin } }] : [])];
    all.slice(0, 12).forEach(({ wave, a }, i) => {
      const t = text(18, '#7dd3fc', 'left', 0, false);
      t.text = `${wave}  ${a.label}  ${f(a.amount)}`;
      t.pos(0, i * 30);
      this.rows.addChild(t);
    });
    if (!all.length) {
      const t = text(18, '#64748b', 'left', 0, false);
      t.text = '本局沒有消除';
      this.rows.addChild(t);
    }
    const tier = winTier(round.win, round.bet, this.o.tiers);
    this.summary = `${tier ? `【${tier.label}】` : ''}主遊戲 ${f(p.mainWin)}（${f(spin.baseWin)} × ${spin.multiplier}${spin.scatterWin ? ` ＋ ${f(spin.scatterWin)}` : ''}）＋ 免費遊戲 ${f(b.total)} ＝ 總贏分 ${f(round.win)}`;
    this.total.text = this.summary;
  }
}
