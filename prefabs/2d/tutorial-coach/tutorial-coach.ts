import {
  TutorialRunner,
  type TutorialGestureKind,
  type TutorialHighlightTone,
  type TutorialPoint,
  type TutorialRect,
  type TutorialRunnerOptions,
  type TutorialSnapshot,
  type TutorialStep,
} from '../../systems/tutorial/tutorial.ts';

/**
 * Pure Laya 2D Stage tutorial coach overlay (shared module: 2d/tutorial-coach).
 * Zero browser DOM dependencies — works identically across desktop/mobile browsers and WeChat Mini Games.
 * Renders:
 * - 4-panel spotlight dim scrim leaving the target hole natively interactive (clicks & drags pass right through)
 * - Pulsing focus ring + optional secondary highlights (safe / blocked / accent)
 * - Animated vector coach hand cursor ('tap' | 'double-tap' | 'drag' | 'hold') or custom hand texture
 * - Collision-free instruction bubble card with step dots, nudge banner, Next & Skip controls
 */

export interface TutorialButtonSpec {
  id: 'next' | 'skip';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variant: 'primary' | 'secondary';
}

export interface TutorialTheme {
  scrimColor?: string;
  spotlightColor?: string;
  cardBg?: string;
  cardBorder?: string;
  titleColor?: string;
  bodyColor?: string;
  badgeBg?: string;
  badgeText?: string;
  nudgeBg?: string;
  nudgeText?: string;
  primaryBtnBg?: string;
  primaryBtnBorder?: string;
  primaryBtnText?: string;
  skipBtnBg?: string;
  skipBtnBorder?: string;
  skipBtnText?: string;
  handFill?: string;
  handStroke?: string;
  rippleColor?: string;
  fontFamily?: string;
  highlightColors?: Record<TutorialHighlightTone, { fill: string; border: string }>;
  handTexture?: Laya.Texture | null;
  /** Optional custom card painter so games can plug in 9-slice parchment/wood panels. */
  drawCard?: (layer: Laya.Sprite, rect: TutorialRect) => void;
  /** Optional custom button painter for primary/skip buttons. */
  drawButton?: (layer: Laya.Sprite, spec: TutorialButtonSpec) => void;
}

export interface StageTutorialCoachOptions<Ctx = unknown> extends TutorialRunnerOptions<Ctx> {
  width: number;
  height: number;
  topInset?: number;
  bottomInset?: number;
  safeMargin?: number;
  skipLabel?: string;
  tapOutsideText?: string;
  theme?: TutorialTheme;
  onSound?: (cue: 'step' | 'nudge' | 'complete' | 'skip') => void;
}

export interface StageTutorialReport {
  active: boolean;
  stepId: string | null;
  stepIndex: number;
  stepCount: number;
  hole: TutorialRect | null;
  cardRect: TutorialRect | null;
  nextButton: [number, number] | null;
  skipButton: [number, number] | null;
}

const DEFAULT_HIGHLIGHTS: Record<TutorialHighlightTone, { fill: string; border: string }> = {
  safe: { fill: 'rgba(67, 179, 106, 0.20)', border: '#2E9A54' },
  blocked: { fill: 'rgba(223, 95, 76, 0.22)', border: '#D94336' },
  accent: { fill: 'rgba(245, 189, 65, 0.26)', border: '#E7A83E' },
};

/** Compute card box position that never collides with the primary spotlight cutout. */
export function computeCoachCardRect(
  stageW: number,
  stageH: number,
  hole: TutorialRect | null,
  cardW: number,
  cardH: number,
  placement: 'top' | 'bottom' | 'center',
  topInset = 18,
  bottomInset = 20,
  dock: 'near' | 'edge' = 'near',
): TutorialRect {
  const x = Math.round((stageW - cardW) / 2);
  const minY = Math.round(topInset + 10);
  const maxY = Math.max(minY, Math.round(stageH - bottomInset - cardH - 12));
  if (!hole || placement === 'center') {
    const cy = Math.round((stageH - cardH) / 2);
    return { x, y: Math.max(minY, Math.min(maxY, cy)), width: cardW, height: cardH };
  }
  const gap = 22;
  if (placement === 'bottom') {
    if (dock === 'edge') {
      return { x, y: maxY >= hole.y + hole.height + 8 ? maxY : minY, width: cardW, height: cardH };
    }
    const belowY = Math.round(hole.y + hole.height + gap);
    if (belowY + cardH <= stageH - bottomInset - 8) {
      return { x, y: belowY, width: cardW, height: cardH };
    }
    return { x, y: Math.max(minY, Math.round(hole.y - cardH - gap)), width: cardW, height: cardH };
  }
  if (dock === 'edge') {
    return { x, y: minY + cardH + 8 <= hole.y ? minY : maxY, width: cardW, height: cardH };
  }
  const aboveY = Math.round(hole.y - cardH - gap);
  if (aboveY >= minY) {
    return { x, y: aboveY, width: cardW, height: cardH };
  }
  return { x, y: Math.min(maxY, Math.round(hole.y + hole.height + gap)), width: cardW, height: cardH };
}

/** Draw an animated Laya vector coach hand cursor (`tap`, `double-tap`, `drag`, `hold`). */
export function drawCoachHand(
  g: Laya.Graphics,
  kind: TutorialGestureKind,
  clockSec: number,
  from: TutorialPoint,
  to: TutorialPoint,
  theme: Pick<TutorialTheme, 'handFill' | 'handStroke' | 'rippleColor' | 'handTexture'> = {},
): void {
  const fill = theme.handFill ?? '#FFFDF8';
  const stroke = theme.handStroke ?? '#3B2318';
  const ripple = theme.rippleColor ?? '#FFD166';

  let hx = from.x;
  let hy = from.y;
  let pressScale = 1;
  let ringRadius = 0;
  let ringAlpha = 0;

  if (kind === 'double-tap') {
    const cycle = clockSec % 1.45;
    const hit1 = cycle >= 0.12 && cycle <= 0.3;
    const hit2 = cycle >= 0.42 && cycle <= 0.6;
    const lift = hit1 || hit2 ? 0 : Math.sin(clockSec * 5) * 3;
    hy += lift;
    pressScale = hit1 || hit2 ? 0.86 : 1;
    if (cycle >= 0.14 && cycle < 0.72) {
      const p = (cycle - 0.14) / 0.58;
      ringRadius = 14 + p * 34;
      ringAlpha = (1 - p) * 0.85;
    }
    if (cycle >= 0.44 && cycle < 1.1) {
      const p2 = (cycle - 0.44) / 0.66;
      const r2 = 12 + p2 * 40;
      const a2 = (1 - p2) * 0.75;
      g.drawCircle(from.x, from.y, r2, null as unknown as string, `rgba(255, 209, 102, ${a2.toFixed(2)})`, 3.5);
    }
  } else if (kind === 'drag') {
    const cycle = (clockSec % 1.8) / 1.8;
    const moveT = cycle < 0.15 ? 0 : cycle > 0.78 ? 1 : (cycle - 0.15) / 0.63;
    const smooth = moveT * moveT * (3 - 2 * moveT);
    hx = from.x + (to.x - from.x) * smooth;
    hy = from.y + (to.y - from.y) * smooth;
    pressScale = cycle >= 0.1 && cycle <= 0.82 ? 0.9 : 1;
    // Guide rail from start to destination
    g.drawLine(from.x, from.y, to.x, to.y, 'rgba(255, 241, 180, 0.78)', 5);
    g.drawCircle(from.x, from.y, 9, ripple);
    g.drawCircle(to.x, to.y, 11, null as unknown as string, ripple, 2.5);
  } else if (kind === 'hold') {
    const cycle = (clockSec % 1.4) / 1.4;
    pressScale = cycle < 0.7 ? 0.88 : 1;
    ringRadius = 16 + cycle * 26;
    ringAlpha = (1 - cycle * 0.6) * 0.8;
  } else {
    // tap
    const cycle = clockSec % 1.15;
    const pressed = cycle >= 0.2 && cycle <= 0.42;
    hy += pressed ? 4 : -Math.abs(Math.sin(clockSec * 4.2)) * 6;
    pressScale = pressed ? 0.88 : 1;
    if (cycle >= 0.24 && cycle < 0.95) {
      const p = (cycle - 0.24) / 0.71;
      ringRadius = 14 + p * 34;
      ringAlpha = (1 - p) * 0.85;
    }
  }

  if (ringAlpha > 0.02) {
    g.drawCircle(from.x, from.y, ringRadius, null as unknown as string, `rgba(255, 209, 102, ${ringAlpha.toFixed(2)})`, 4);
  }

  if (theme.handTexture && theme.handTexture.bitmap && !theme.handTexture.bitmap.destroyed) {
    const sz = 58 * pressScale;
    g.drawTexture(theme.handTexture, hx - 8, hy - 4, sz, sz);
    return;
  }

  // Stylized cartoon pointer hand (tip anchored near hx, hy + 4)
  const s = pressScale;
  const px = hx + 4;
  const py = hy + 6;
  const pts: number[] = [
    0, 0,
    10 * s, 26 * s,
    17 * s, 21 * s,
    24 * s, 38 * s,
    33 * s, 34 * s,
    25 * s, 17 * s,
    35 * s, 14 * s,
  ];
  const shadowPts = pts.map((v, idx) => (idx % 2 === 0 ? v + 3 : v + 4));
  g.drawPoly(px, py, shadowPts, 'rgba(30, 18, 12, 0.34)');
  g.drawPoly(px, py, pts, fill, stroke, 3);
  g.drawCircle(hx, hy, 5.5, ripple);
}

/**
 * Turnkey Laya 2D Stage tutorial coach layer backed by TutorialRunner.
 * Usage:
 *   const coach = new StageTutorialCoach(overlayLayer, { width: 720, height: stageH });
 *   coach.show(steps);
 *   // every frame: coach.update(dt);
 *   // on gameplay action: coach.emit('cell_tap', cell);
 */
export class StageTutorialCoach<Ctx = unknown> {
  readonly root = new Laya.Sprite();
  private readonly scrimTop = new Laya.Sprite();
  private readonly scrimBottom = new Laya.Sprite();
  private readonly scrimLeft = new Laya.Sprite();
  private readonly scrimRight = new Laya.Sprite();
  private readonly highlightLayer = new Laya.Sprite();
  private readonly cardLayer = new Laya.Sprite();
  private readonly handLayer = new Laya.Sprite();

  private readonly theme: TutorialTheme;
  private readonly skipLabel: string;
  private readonly tapOutsideText?: string;
  private readonly onSound?: (cue: 'step' | 'nudge' | 'complete' | 'skip') => void;
  private readonly onStateChange?: (snapshot: TutorialSnapshot) => void;
  private readonly baseOptions: StageTutorialCoachOptions<Ctx>;

  private runner: TutorialRunner<Ctx> | null = null;
  private width: number;
  private height: number;
  private topInset: number;
  private bottomInset: number;
  private safeMargin: number;

  private clock = 0;
  private pulseBonus = 0;
  private lastLayoutKey = '';
  private cardRect: TutorialRect | null = null;
  private nextBtnRect: TutorialRect | null = null;
  private skipBtnRect: TutorialRect | null = null;

  constructor(parent: Laya.Sprite, options: StageTutorialCoachOptions<Ctx>) {
    this.baseOptions = options;
    this.width = options.width;
    this.height = options.height;
    this.topInset = options.topInset ?? 18;
    this.bottomInset = options.bottomInset ?? 20;
    this.safeMargin = options.safeMargin ?? 28;
    this.skipLabel = options.skipLabel ?? '跳過教學';
    this.tapOutsideText = options.tapOutsideText;
    this.theme = options.theme ?? {};
    this.onSound = options.onSound;
    this.onStateChange = options.onChange;

    this.root.size(this.width, this.height);
    this.root.mouseThrough = true;
    this.root.visible = false;
    this.highlightLayer.mouseThrough = true;
    this.cardLayer.mouseThrough = true;
    this.handLayer.mouseThrough = true;

    for (const seg of [this.scrimTop, this.scrimBottom, this.scrimLeft, this.scrimRight]) {
      seg.on(Laya.Event.MOUSE_DOWN, null, (e: Laya.Event) => {
        if (!this.runner?.isActive) return;
        const snap = this.runner.snapshot();
        if (snap.advance === 'tap-anywhere') {
          e.stopPropagation();
          this.next();
          return;
        }
        if (snap.strictTarget) {
          e.stopPropagation();
          this.pulseBonus = 1;
          this.onSound?.('nudge');
          if (this.tapOutsideText && !snap.nudgeText) {
            this.runner.nudge(this.tapOutsideText, 2.0);
          }
        }
      });
      this.root.addChild(seg);
    }

    this.root.addChild(this.highlightLayer);
    this.root.addChild(this.cardLayer);
    this.root.addChild(this.handLayer);
    parent.addChild(this.root);
  }

  get active(): boolean {
    return !!this.runner?.isActive;
  }

  get snapshot(): TutorialSnapshot | null {
    return this.runner ? this.runner.snapshot() : null;
  }

  /** Start a tutorial sequence using this stage coach overlay. */
  show(steps: readonly TutorialStep<Ctx>[], override?: Partial<TutorialRunnerOptions<Ctx>>): boolean {
    this.runner?.stop('abort');
    this.clock = 0;
    this.pulseBonus = 0;
    this.lastLayoutKey = '';
    this.runner = new TutorialRunner(steps, {
      ...this.baseOptions,
      ...override,
      viewportWidth: this.width,
      viewportHeight: this.height,
      onComplete: (flowId) => {
        this.onSound?.('complete');
        override?.onComplete?.(flowId);
        this.baseOptions.onComplete?.(flowId);
      },
      onSkip: (flowId, stepId) => {
        this.onSound?.('skip');
        override?.onSkip?.(flowId, stepId);
        this.baseOptions.onSkip?.(flowId, stepId);
      },
      onChange: (snap) => {
        this.rebuildStaticUI(snap);
        this.onStateChange?.(snap);
        override?.onChange?.(snap);
      },
    });
    const ok = this.runner.start(0);
    this.root.visible = ok;
    if (ok) this.onSound?.('step');
    return ok;
  }

  next(): boolean {
    if (!this.runner?.isActive) return false;
    const moved = this.runner.next();
    if (moved) this.onSound?.('step');
    return moved;
  }

  skip(): void {
    this.runner?.skip();
  }

  stop(reason: 'complete' | 'skip' | 'abort' = 'abort'): void {
    this.runner?.stop(reason);
  }

  emit(eventName: string, payload?: unknown): { handled: boolean; advanced: boolean; rejectedText?: string } {
    if (!this.runner?.isActive) return { handled: false, advanced: false };
    const res = this.runner.emit(eventName, payload);
    if (res.advanced) this.onSound?.('step');
    else if (res.rejectedText) {
      this.pulseBonus = 1;
      this.onSound?.('nudge');
    }
    return res;
  }

  resize(width: number, height: number, topInset = this.topInset, bottomInset = this.bottomInset): void {
    this.width = width;
    this.height = height;
    this.topInset = topInset;
    this.bottomInset = bottomInset;
    this.root.size(width, height);
    this.lastLayoutKey = '';
    this.runner?.setViewport(width, height);
  }

  update(dt: number): void {
    if (!this.runner?.isActive) {
      if (this.root.visible) this.root.visible = false;
      return;
    }
    this.clock += dt;
    if (this.pulseBonus > 0) this.pulseBonus = Math.max(0, this.pulseBonus - dt * 2.4);
    this.runner.update(dt);

    const snap = this.runner.snapshot();
    if (!snap.active) {
      this.root.visible = false;
      return;
    }
    const key = JSON.stringify([snap.stepIndex, snap.hole, snap.nudgeText, snap.highlights.length]);
    if (key !== this.lastLayoutKey) {
      this.rebuildStaticUI(snap);
    }
    this.drawAnimatedOverlay(snap);
  }

  /** Report active step + button centers in stage coordinates for UI tests / probes. */
  report(): StageTutorialReport {
    const snap = this.runner?.snapshot();
    if (!snap || !snap.active) {
      return {
        active: false,
        stepId: null,
        stepIndex: 0,
        stepCount: 0,
        hole: null,
        cardRect: null,
        nextButton: null,
        skipButton: null,
      };
    }
    const centerOf = (r: TutorialRect | null): [number, number] | null =>
      r ? [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] : null;
    return {
      active: true,
      stepId: snap.stepId,
      stepIndex: snap.stepIndex,
      stepCount: snap.stepCount,
      hole: snap.hole,
      cardRect: this.cardRect,
      nextButton: centerOf(this.nextBtnRect),
      skipButton: centerOf(this.skipBtnRect),
    };
  }

  dispose(): void {
    this.runner?.stop('abort');
    this.runner = null;
    if (!this.root.destroyed) this.root.destroy(true);
  }

  private drawScrimPanels(snap: TutorialSnapshot): void {
    const scrim = this.theme.scrimColor ?? 'rgba(18, 12, 8, 0.56)';
    const w = this.width;
    const h = this.height;
    const interactiveScrim = snap.strictTarget || snap.advance === 'tap-anywhere';

    const setSeg = (seg: Laya.Sprite, x: number, y: number, sw: number, sh: number) => {
      seg.graphics.clear();
      if (!interactiveScrim || sw <= 0 || sh <= 0) {
        seg.visible = false;
        seg.size(0, 0);
        seg.mouseEnabled = false;
        seg.mouseThrough = true;
        return;
      }
      seg.visible = true;
      seg.pos(x, y);
      seg.size(sw, sh);
      seg.mouseEnabled = true;
      seg.mouseThrough = false;
      seg.graphics.drawRect(0, 0, sw, sh, scrim);
    };

    if (!snap.hole) {
      setSeg(this.scrimTop, 0, 0, w, h);
      setSeg(this.scrimBottom, 0, 0, 0, 0);
      setSeg(this.scrimLeft, 0, 0, 0, 0);
      setSeg(this.scrimRight, 0, 0, 0, 0);
      return;
    }

    const hx = Math.max(0, snap.hole.x);
    const hy = Math.max(0, snap.hole.y);
    const hr = Math.min(w, hx + snap.hole.width);
    const hb = Math.min(h, hy + snap.hole.height);
    setSeg(this.scrimTop, 0, 0, w, hy);
    setSeg(this.scrimBottom, 0, hb, w, h - hb);
    setSeg(this.scrimLeft, 0, hy, hx, hb - hy);
    setSeg(this.scrimRight, hr, hy, w - hr, hb - hy);
  }

  private makeTextNode(str: string, x: number, y: number, w: number, size: number, color: string, bold = false): Laya.Text {
    const t = new Laya.Text();
    t.font = this.theme.fontFamily ?? 'PingFang TC, Microsoft JhengHei, sans-serif';
    t.fontSize = size;
    t.color = color;
    t.bold = bold;
    t.wordWrap = true;
    t.leading = 5;
    t.width = w;
    t.text = str;
    t.pos(x, y);
    return t;
  }

  private rebuildStaticUI(snap: TutorialSnapshot): void {
    this.cardLayer.destroyChildren();
    this.cardLayer.graphics.clear();
    this.nextBtnRect = null;
    this.skipBtnRect = null;
    this.cardRect = null;

    if (!snap.active) {
      this.root.visible = false;
      this.lastLayoutKey = '';
      return;
    }

    this.root.visible = true;
    this.drawScrimPanels(snap);

    const cardW = Math.min(640, this.width - this.safeMargin * 2);
    const innerW = cardW - 44;

    const badgeText = this.makeTextNode(snap.badge, 22, 18, 120, 17, this.theme.badgeText ?? '#4E2B22', true);
    const titleNode = this.makeTextNode(
      snap.title,
      118,
      16,
      innerW - 104,
      24,
      this.theme.titleColor ?? '#4E2B22',
      true,
    );
    const bodyNode = this.makeTextNode(
      snap.body,
      22,
      54,
      innerW,
      20,
      this.theme.bodyColor ?? '#5E3829',
      false,
    );
    const bodyH = Math.max(28, bodyNode.textHeight || 52);

    let curY = 58 + bodyH + 10;
    let nudgeNode: Laya.Text | null = null;
    if (snap.nudgeText) {
      nudgeNode = this.makeTextNode(
        snap.nudgeText,
        32,
        curY + 8,
        innerW - 20,
        18,
        this.theme.nudgeText ?? '#B42318',
        true,
      );
      curY += Math.max(36, (nudgeNode.textHeight || 22) + 16) + 10;
    }

    const hasFooter = !!snap.nextLabel || snap.canSkip || snap.stepCount > 1;
    const footerH = hasFooter ? 56 : 8;
    const cardH = curY + footerH + 14;
    const rect = computeCoachCardRect(
      this.width,
      this.height,
      snap.hole,
      cardW,
      cardH,
      snap.placement,
      this.topInset,
      this.bottomInset,
      snap.dock,
    );
    this.cardRect = rect;

    const card = new Laya.Sprite();
    card.pos(rect.x, rect.y);
    card.size(cardW, cardH);
    card.mouseEnabled = true;
    card.on(Laya.Event.MOUSE_DOWN, null, (e: Laya.Event) => {
      e.stopPropagation();
      if (snap.advance === 'tap-anywhere') this.next();
    });

    if (this.theme.drawCard) {
      this.theme.drawCard(card, { x: 0, y: 0, width: cardW, height: cardH });
    } else {
      card.graphics.drawRoundRect(
        0,
        0,
        cardW,
        cardH,
        20,
        20,
        20,
        20,
        this.theme.cardBg ?? '#FFF9EE',
        this.theme.cardBorder ?? '#9A6342',
        3,
      );
    }

    const decor = new Laya.Sprite();
    decor.mouseEnabled = false;
    card.addChild(decor);

    // Badge pill
    decor.graphics.drawRoundRect(
      18,
      14,
      86,
      30,
      15,
      15,
      15,
      15,
      this.theme.badgeBg ?? '#FFD97D',
      this.theme.cardBorder ?? '#9A6342',
      1.5,
    );
    badgeText.align = 'center';
    badgeText.width = 86;
    badgeText.pos(18, 19);
    card.addChild(badgeText);
    card.addChild(titleNode);
    card.addChild(bodyNode);

    if (nudgeNode) {
      const nh = Math.max(36, (nudgeNode.textHeight || 22) + 14);
      decor.graphics.drawRoundRect(
        20,
        curY - nh - 8,
        innerW,
        nh,
        12,
        12,
        12,
        12,
        this.theme.nudgeBg ?? '#FDECE8',
        '#DF5F4C',
        1.5,
      );
      card.addChild(nudgeNode);
    }

    // Step indicator dots on the left of footer
    for (let i = 0; i < snap.stepCount; i++) {
      const activeDot = i === snap.stepIndex;
      const dx = 28 + i * 16;
      const dy = curY + 28;
      decor.graphics.drawCircle(
        dx,
        dy,
        activeDot ? 6 : 4,
        activeDot ? (this.theme.primaryBtnBg ?? '#DF644C') : 'rgba(130, 90, 68, 0.30)',
      );
    }

    let rightCursor = cardW - 18;
    if (snap.nextLabel) {
      const bw = Math.min(200, Math.max(128, snap.nextLabel.length * 22 + 38));
      const bh = 46;
      const bx = rightCursor - bw;
      const by = curY + 5;
      rightCursor = bx - 10;
      const spec: TutorialButtonSpec = { id: 'next', label: snap.nextLabel, x: bx, y: by, width: bw, height: bh, variant: 'primary' };
      const btn = this.createActionButton(spec, () => this.next());
      card.addChild(btn);
      this.nextBtnRect = { x: rect.x + bx, y: rect.y + by, width: bw, height: bh };
    }

    if (snap.canSkip) {
      const bw = Math.min(132, Math.max(96, this.skipLabel.length * 18 + 26));
      const bh = 42;
      const bx = rightCursor - bw;
      const by = curY + 7;
      const spec: TutorialButtonSpec = { id: 'skip', label: this.skipLabel, x: bx, y: by, width: bw, height: bh, variant: 'secondary' };
      const btn = this.createActionButton(spec, () => this.skip());
      card.addChild(btn);
      this.skipBtnRect = { x: rect.x + bx, y: rect.y + by, width: bw, height: bh };
    }

    this.cardLayer.addChild(card);
    this.lastLayoutKey = JSON.stringify([snap.stepIndex, snap.hole, snap.nudgeText, snap.highlights.length]);
    this.drawAnimatedOverlay(snap);
  }

  private createActionButton(spec: TutorialButtonSpec, onTap: () => void): Laya.Sprite {
    const btn = new Laya.Sprite();
    btn.pos(spec.x, spec.y);
    btn.size(spec.width, spec.height);
    btn.mouseEnabled = true;
    const isPrimary = spec.variant === 'primary';
    if (this.theme.drawButton) {
      this.theme.drawButton(btn, spec);
    } else {
      btn.graphics.drawRoundRect(
        0,
        0,
        spec.width,
        spec.height,
        14,
        14,
        14,
        14,
        isPrimary ? (this.theme.primaryBtnBg ?? '#DF644C') : (this.theme.skipBtnBg ?? '#F7EBD7'),
        isPrimary ? (this.theme.primaryBtnBorder ?? '#9A3828') : (this.theme.skipBtnBorder ?? '#9A6342'),
        2,
      );
    }
    const label = this.makeTextNode(
      spec.label,
      0,
      Math.round((spec.height - 22) / 2),
      spec.width,
      19,
      isPrimary ? (this.theme.primaryBtnText ?? '#FFFFFF') : (this.theme.skipBtnText ?? '#5E3829'),
      true,
    );
    label.align = 'center';
    label.wordWrap = false;
    btn.addChild(label);
    btn.on(Laya.Event.MOUSE_DOWN, null, (e: Laya.Event) => {
      e.stopPropagation();
      onTap();
    });
    return btn;
  }

  private drawAnimatedOverlay(snap: TutorialSnapshot): void {
    const hg = this.highlightLayer.graphics;
    hg.clear();
    if (!snap.strictTarget && snap.advance !== 'tap-anywhere') {
      const scrim = this.theme.scrimColor ?? 'rgba(18, 12, 8, 0.56)';
      const w = this.width;
      const h = this.height;
      if (!snap.hole) {
        hg.drawRect(0, 0, w, h, scrim);
      } else {
        const hx = Math.max(0, snap.hole.x);
        const hy = Math.max(0, snap.hole.y);
        const hr = Math.min(w, hx + snap.hole.width);
        const hb = Math.min(h, hy + snap.hole.height);
        if (hy > 0) hg.drawRect(0, 0, w, hy, scrim);
        if (h - hb > 0) hg.drawRect(0, hb, w, h - hb, scrim);
        if (hx > 0 && hb > hy) hg.drawRect(0, hy, hx, hb - hy, scrim);
        if (w - hr > 0 && hb > hy) hg.drawRect(hr, hy, w - hr, hb - hy, scrim);
      }
    }
    const palette = this.theme.highlightColors ?? DEFAULT_HIGHLIGHTS;

    for (const h of snap.highlights) {
      const col = palette[h.tone ?? 'accent'];
      hg.drawRoundRect(
        h.rect.x,
        h.rect.y,
        h.rect.width,
        h.rect.height,
        10,
        10,
        10,
        10,
        col.fill,
        col.border,
        3,
      );
    }

    if (snap.hole) {
      const pulse = 0.55 + 0.45 * Math.sin(this.clock * 6);
      const grow = Math.round(this.pulseBonus * 6 + pulse * 3);
      const hx = snap.hole.x - grow;
      const hy = snap.hole.y - grow;
      const hw = snap.hole.width + grow * 2;
      const hh = snap.hole.height + grow * 2;
      const ringCol = this.theme.spotlightColor ?? '#FFD166';
      hg.drawRoundRect(hx, hy, hw, hh, 18, 18, 18, 18, null as unknown as string, ringCol, 4.5 + this.pulseBonus * 2);
    }

    const handG = this.handLayer.graphics;
    handG.clear();
    if (snap.gesture) {
      drawCoachHand(handG, snap.gesture.type, this.clock, snap.gesture.from, snap.gesture.to, this.theme);
    }
  }
}
