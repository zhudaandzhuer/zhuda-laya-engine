// A slot's bottom control bar drawn by code (neutral skin): balance, bet with − / +, the round
// win, an auto pill (shows rounds left), a turbo pill, an info button and the big five-way
// button (spin / stop / accelerate / collect / wait; a long press opens auto settings).
// Its rules are ControlModel's; it also serves as the HUD (setWin, setTitle) for the step
// player. MeterPanel shows the multiplier and the free-spin count. Needs the engine (Laya 2D).
// Layout and behaviour follow <original-cascade-slot>/client/src/ui/ControlBar.ts; its art
// and its textures were not carried.
import type { PrimaryAction } from '../../systems/slot-round/contracts.ts';
import { ControlModel, LONG_PRESS_MS, type ButtonFace } from './control-model.ts';
import type { FrameClock } from './frame-clock.ts';
import type { HudPort } from './step-player.ts';

export interface ControlTexts {
  balance: string;
  bet: string;
  win: string;
  auto: string;
  turboOn: string;
  turboOff: string;
}

export const DEFAULT_CONTROL_TEXTS: ControlTexts = { balance: '餘額', bet: '下注', win: '本局贏分', auto: '自動', turboOn: '極速 開', turboOff: '極速 關' };

export interface ControlBarOptions {
  width: number;
  height?: number;
  bets: number[];
  clock: FrameClock;
  texts?: Partial<ControlTexts>;
  faces?: Record<PrimaryAction, ButtonFace>;
  formatMoney?: (n: number) => string;
  /** Shown bet: what a bet unit costs (default the unit). */
  betCost?: (bet: number) => number;
}

function text(size: number, color: string, align: 'left' | 'center' | 'right' = 'left', width = 0): Laya.Text {
  const t = new Laya.Text();
  t.fontSize = size;
  t.color = color;
  t.bold = true;
  t.align = align;
  if (width) t.width = width;
  t.stroke = 3;
  t.strokeColor = '#070b16';
  return t;
}

function button(w: number, h: number, draw: (g: Laya.Graphics) => void): Laya.Sprite {
  const b = new Laya.Sprite();
  b.size(w, h);
  b.mouseEnabled = true;
  draw(b.graphics);
  return b;
}

export class ControlBar implements HudPort {
  readonly root = new Laya.Sprite();
  readonly model: ControlModel;
  onAdvance: (() => void) | null = null;
  onLongPress: (() => void) | null = null;
  onBetChange: ((bet: number) => void) | null = null;
  onBurstToggle: ((on: boolean) => void) | null = null;
  onInfo: (() => void) | null = null;
  private texts: ControlTexts;
  private format: (n: number) => string;
  private betCost: (bet: number) => number;
  private clock: FrameClock;
  private balanceValue: Laya.Text;
  private betValue: Laya.Text;
  private winTitle: Laya.Text;
  private winValue: Laya.Text;
  private autoLabel: Laya.Text;
  private turboLabel: Laya.Text;
  private spin: Laya.Sprite;
  private spinFace: Laya.Sprite;
  private spinIcon: Laya.Text;
  private spinLabel: Laya.Text;
  private minus: Laya.Sprite;
  private plus: Laya.Sprite;
  private auto: Laya.Sprite;
  private pressSerial = 0;
  private pressing = false;
  private longFired = false;

  constructor(o: ControlBarOptions) {
    const w = o.width;
    const h = o.height ?? 120;
    this.model = new ControlModel(o.bets, { faces: o.faces });
    this.texts = { ...DEFAULT_CONTROL_TEXTS, ...o.texts };
    this.format = o.formatMoney ?? ((n) => n.toLocaleString('en-US'));
    this.betCost = o.betCost ?? ((b) => b);
    this.clock = o.clock;
    this.root.name = 'ControlBar';
    this.root.size(w, h);
    this.root.graphics.drawRect(0, 0, w, h, 'rgba(8,11,22,0.94)');
    this.root.graphics.drawLine(0, 1, w, 1, '#3b4a6b', 2);

    const info = button(44, 44, (g) => g.drawCircle(22, 22, 20, 'rgba(255,255,255,0.08)', '#94a3b8', 2));
    const i = text(24, '#e2e8f0', 'center', 44);
    i.text = 'i';
    i.pos(0, 8);
    info.addChild(i);
    info.pos(28, h / 2 - 22);
    info.on(Laya.Event.CLICK, this, () => this.onInfo?.());
    this.root.addChild(info);

    const cap = (s: string, x: number, y: number) => {
      const t = text(16, '#fbbf24');
      t.text = s;
      t.pos(x, y);
      this.root.addChild(t);
    };
    cap(this.texts.balance, 96, h / 2 - 34);
    this.balanceValue = text(26, '#ffffff');
    this.balanceValue.pos(96, h / 2 - 10);
    this.root.addChild(this.balanceValue);

    cap(this.texts.bet, 330, h / 2 - 34);
    this.minus = button(40, 40, (g) => g.drawCircle(20, 20, 18, 'rgba(255,255,255,0.08)', '#cbd5e1', 2));
    this.plus = button(40, 40, (g) => g.drawCircle(20, 20, 18, 'rgba(255,255,255,0.08)', '#cbd5e1', 2));
    for (const [b, s] of [[this.minus, '−'], [this.plus, '+']] as const) {
      const t = text(24, '#ffffff', 'center', 40);
      t.text = s;
      t.pos(0, 6);
      b.addChild(t);
      this.root.addChild(b);
    }
    this.minus.pos(330, h / 2 - 12);
    this.betValue = text(26, '#ffffff', 'center', 100);
    this.betValue.pos(372, h / 2 - 8);
    this.root.addChild(this.betValue);
    this.plus.pos(474, h / 2 - 12);
    this.minus.on(Laya.Event.CLICK, this, () => this.step(-1));
    this.plus.on(Laya.Event.CLICK, this, () => this.step(1));

    this.winTitle = text(16, '#fbbf24', 'center', 320);
    this.winTitle.text = this.texts.win;
    this.winTitle.pos(w / 2 - 160, h / 2 - 34);
    this.root.addChild(this.winTitle);
    this.winValue = text(36, '#fde047', 'center', 320);
    this.winValue.text = '—';
    this.winValue.pos(w / 2 - 160, h / 2 - 12);
    this.root.addChild(this.winValue);

    this.auto = button(120, 36, (g) => g.drawRoundRect(0, 0, 120, 36, 18, 18, 18, 18, 'rgba(255,255,255,0.06)', '#94a3b8', 2));
    this.autoLabel = text(17, '#e2e8f0', 'center', 120);
    this.autoLabel.pos(0, 8);
    this.auto.addChild(this.autoLabel);
    this.auto.pos(w - 400, h / 2 - 18);
    this.auto.on(Laya.Event.CLICK, this, () => this.model.autoEnabled && this.onLongPress?.());
    this.root.addChild(this.auto);

    const turbo = button(120, 36, (g) => g.drawRoundRect(0, 0, 120, 36, 18, 18, 18, 18, 'rgba(255,255,255,0.06)', '#94a3b8', 2));
    this.turboLabel = text(17, '#e2e8f0', 'center', 120);
    this.turboLabel.pos(0, 8);
    turbo.addChild(this.turboLabel);
    turbo.pos(w - 270, h / 2 - 18);
    turbo.on(Laya.Event.CLICK, this, () => {
      const on = this.model.toggleBurst();
      this.refresh();
      this.onBurstToggle?.(on);
    });
    this.root.addChild(turbo);

    this.spin = new Laya.Sprite();
    this.spin.size(104, 104);
    this.spin.pivot(52, 52);
    this.spin.pos(w - 86, h / 2);
    this.spin.mouseEnabled = true;
    this.spinFace = new Laya.Sprite();
    this.spin.addChild(this.spinFace);
    this.spinIcon = text(38, '#ffffff', 'center', 104);
    this.spinIcon.pos(0, 18);
    this.spin.addChild(this.spinIcon);
    this.spinLabel = text(16, '#ffffff', 'center', 104);
    this.spinLabel.pos(0, 64);
    this.spin.addChild(this.spinLabel);
    this.root.addChild(this.spin);
    this.spin.on(Laya.Event.MOUSE_DOWN, this, () => this.press());
    this.spin.on(Laya.Event.MOUSE_UP, this, () => this.release(true));
    this.spin.on(Laya.Event.MOUSE_OUT, this, () => this.release(false));
    this.refresh();
  }

  private press(): void {
    const id = ++this.pressSerial;
    this.pressing = true;
    this.longFired = false;
    this.spin.scale(0.93, 0.93);
    if (this.model.action !== 'advance') return;
    void this.clock.wait(LONG_PRESS_MS).then(() => {
      if (id !== this.pressSerial) return;
      this.longFired = true;
      this.onLongPress?.();
    });
  }

  private release(click: boolean): void {
    if (!this.pressing) return;
    this.pressing = false;
    this.pressSerial++; // cancels a pending long press
    this.spin.scale(1, 1);
    if (!click || this.longFired) return;
    if (this.model.face.enabled) this.onAdvance?.();
  }

  private step(direction: number): void {
    const bet = this.model.step(direction);
    if (bet === null) return;
    this.refresh();
    this.onBetChange?.(bet);
  }

  /** Redraws everything from the model. */
  refresh(): void {
    const m = this.model;
    const face = m.face;
    this.spinFace.graphics.clear();
    this.spinFace.graphics.drawCircle(52, 52, 50, 'rgba(30,41,82,0.98)', face.color, 4);
    this.spinFace.graphics.drawCircle(52, 52, 40, 'rgba(255,255,255,0.06)');
    this.spinIcon.text = face.icon;
    this.spinIcon.color = face.color;
    this.spinLabel.text = face.label;
    this.spin.alpha = face.enabled ? 1 : 0.55;
    for (const b of [this.minus, this.plus]) {
      b.mouseEnabled = m.betEnabled;
      b.alpha = m.betEnabled ? 1 : 0.38;
    }
    this.auto.mouseEnabled = m.autoEnabled;
    this.auto.alpha = m.autoEnabled ? 1 : 0.45;
    this.autoLabel.text = m.autoRemaining > 0 ? `${this.texts.auto} ${m.autoRemaining}` : this.texts.auto;
    this.autoLabel.color = m.autoRemaining > 0 ? '#4ade80' : '#e2e8f0';
    this.turboLabel.text = m.burst ? this.texts.turboOn : this.texts.turboOff;
    this.turboLabel.color = m.burst ? '#fde047' : '#e2e8f0';
    this.betValue.text = this.format(this.betCost(m.bet));
  }

  updateAction(action: PrimaryAction): void {
    this.model.action = action;
    this.refresh();
  }

  updateAutoCount(remaining: number): void {
    this.model.autoRemaining = remaining;
    this.refresh();
  }

  setBet(bet: number): void {
    this.model.bet = bet;
    this.refresh();
  }

  setBalance(points: number): void {
    this.balanceValue.text = this.format(points);
  }

  setWin(amount: number): void {
    this.winValue.text = amount > 0 ? this.format(amount) : '—';
  }

  setTitle(title: string): void {
    this.winTitle.text = title;
  }
}

/** Multiplier meter and free-spin counter (the rest of HudPort). */
export class MeterPanel implements HudPort {
  readonly root = new Laya.Sprite();
  multiplier = 1;
  private freeSpinsText: string;
  private value: Laya.Text;
  private spins: Laya.Text;
  private caption: Laya.Text;

  constructor({ width = 240, title = '倍數', freeSpins = '免費遊戲' }: { width?: number; title?: string; freeSpins?: string } = {}) {
    this.root.name = 'MeterPanel';
    this.root.graphics.drawRoundRect(0, 0, width, 220, 18, 18, 18, 18, 'rgba(10,14,28,0.88)', '#3b4a6b', 2);
    this.caption = text(20, '#fbbf24', 'center', width);
    this.caption.text = title;
    this.caption.pos(0, 18);
    this.root.addChild(this.caption);
    this.value = text(64, '#ffffff', 'center', width);
    this.value.pos(0, 52);
    this.root.addChild(this.value);
    this.spins = text(20, '#93c5fd', 'center', width);
    this.spins.pos(0, 150);
    this.root.addChild(this.spins);
    this.freeSpinsText = freeSpins;
    this.setMultiplier(1);
    this.setFreeSpins(0, 0);
  }

  setWin(): void {}

  setMultiplier(m: number): void {
    this.multiplier = m;
    this.value.text = `×${m}`;
    this.value.color = m > 1 ? '#fde047' : '#ffffff';
  }

  setFreeSpins(spin: number, total: number): void {
    this.spins.text = total > 0 ? `${this.freeSpinsText} ${spin} / ${total}` : '';
  }
}
