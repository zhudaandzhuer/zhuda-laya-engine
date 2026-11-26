/**
 * Declarative tutorial flow state machine & persistence helpers (zero DOM / zero engine imports).
 * Shared module: systems/tutorial
 */

export interface TutorialRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TutorialPoint {
  x: number;
  y: number;
}

export type TutorialGestureKind = 'tap' | 'double-tap' | 'drag' | 'hold';

export interface TutorialGesture {
  type: TutorialGestureKind;
  from?: TutorialPoint | (() => TutorialPoint | null);
  to?: TutorialPoint | (() => TutorialPoint | null);
}

export type TutorialHighlightTone = 'safe' | 'blocked' | 'accent';

export interface TutorialHighlight {
  rect: TutorialRect;
  tone?: TutorialHighlightTone;
  label?: string;
}

export type TutorialPlacement = 'auto' | 'top' | 'bottom' | 'center';
export type TutorialAdvanceMode = 'next' | 'tap-anywhere' | 'event';

export type TutorialAcceptResult =
  | boolean
  | {
      ok: boolean;
      rejectText?: string;
    };

export interface TutorialStep<Ctx = unknown> {
  id: string;
  title: string;
  body: string;
  badge?: string;
  /** Primary spotlight rectangle (or getter returning null when target is temporarily unavailable). */
  target?: TutorialRect | (() => TutorialRect | null);
  /** Extra padding around spotlight cutout in stage/design px (default 10). */
  pad?: number;
  /** Corner radius for spotlight frame (default 16). */
  radius?: number;
  /** Block pointer clicks outside the spotlight hole (default true on event steps with a target). */
  strictTarget?: boolean;
  /** Secondary highlight boxes (e.g. excluded zones, combo targets). */
  highlights?: readonly TutorialHighlight[] | (() => readonly TutorialHighlight[]);
  /** Hand animation hint; omit on an event step with a target to auto-use 'tap'; set null to hide hand. */
  gesture?: TutorialGesture | null;
  /** How this step advances: 'next' button, tapping anywhere, or matching an emitted event. */
  advance?: TutorialAdvanceMode;
  /** Event name(s) that can complete this step when advance === 'event'. */
  waitFor?: string | readonly string[];
  /** Optional predicate on emitted events; may return { ok: false, rejectText } to coach without failing. */
  accept?: (payload: unknown, ctx: Ctx, eventName: string) => TutorialAcceptResult;
  /** Optional label for the action button when shown. */
  nextLabel?: string;
  /** Also display the Next button during event steps so returning/expert players can step forward. */
  showNextWithEvent?: boolean;
  /** Allow skipping the tutorial from this step (default true). */
  canSkip?: boolean;
  /** Preferred bubble placement relative to the spotlight hole (default 'auto'). */
  placement?: TutorialPlacement;
  /** 'near' places card close to hole; 'edge' docks cleanly at top/bottom edge to keep full boards clear. */
  dock?: 'near' | 'edge';
  onEnter?: (ctx: Ctx) => void;
  onExit?: (ctx: Ctx, reason: 'advance' | 'back' | 'skip' | 'complete' | 'abort') => void;
}

export interface ResolvedTutorialGesture {
  type: TutorialGestureKind;
  from: TutorialPoint;
  to: TutorialPoint;
}

export interface ResolvedTutorialStep {
  id: string;
  title: string;
  body: string;
  badge: string;
  advance: TutorialAdvanceMode;
  strictTarget: boolean;
  hole: TutorialRect | null;
  radius: number;
  highlights: readonly TutorialHighlight[];
  gesture: ResolvedTutorialGesture | null;
  nextLabel: string | null;
  canSkip: boolean;
  placement: Exclude<TutorialPlacement, 'auto'>;
  dock: 'near' | 'edge';
}

export interface TutorialSnapshot {
  active: boolean;
  flowId: string;
  stepIndex: number;
  stepCount: number;
  stepId: string | null;
  title: string;
  body: string;
  badge: string;
  advance: TutorialAdvanceMode;
  strictTarget: boolean;
  hole: TutorialRect | null;
  highlights: readonly TutorialHighlight[];
  gesture: ResolvedTutorialGesture | null;
  nudgeText: string | null;
  nextLabel: string | null;
  canSkip: boolean;
  placement: Exclude<TutorialPlacement, 'auto'>;
  dock: 'near' | 'edge';
  completed: boolean;
  skipped: boolean;
}

export interface TutorialStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** Seen-state registry safe under restricted/private storage environments. */
export class TutorialSeenTracker {
  private readonly store: TutorialStorageAdapter | null;
  private readonly key: string;
  private seen: Set<string>;

  constructor(store?: TutorialStorageAdapter | null, key = 'zhuda_tutorials_seen') {
    this.store = store ?? null;
    this.key = key;
    this.seen = this.readSet();
  }

  private readSet(): Set<string> {
    if (!this.store) return new Set();
    try {
      const raw = this.store.get(this.key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
    } catch {
      return new Set();
    }
  }

  private writeSet(): void {
    if (!this.store) return;
    try {
      this.store.set(this.key, JSON.stringify([...this.seen]));
    } catch {
      /* ignore restricted storage */
    }
  }

  hasSeen(flowId: string): boolean {
    return this.seen.has(flowId);
  }

  markSeen(flowId: string): void {
    this.seen.add(flowId);
    this.writeSet();
  }

  reset(flowId?: string): void {
    if (flowId) this.seen.delete(flowId);
    else this.seen.clear();
    this.writeSet();
  }

  list(): string[] {
    return [...this.seen];
  }
}

/** Expand rectangle uniformly by `pad` pixels clamped inside viewport bounds. */
export function expandRect(rect: TutorialRect, pad = 10, boundsW = Infinity, boundsH = Infinity): TutorialRect {
  const x = Math.max(0, rect.x - pad);
  const y = Math.max(0, rect.y - pad);
  const maxW = Number.isFinite(boundsW) ? boundsW - x : rect.width + pad * 2;
  const maxH = Number.isFinite(boundsH) ? boundsH - y : rect.height + pad * 2;
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width + pad * 2, maxW)),
    height: Math.max(0, Math.min(rect.height + pad * 2, maxH)),
  };
}

/** Return center point of a rectangle. */
export function rectCenter(rect: TutorialRect): TutorialPoint {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Pick top or bottom bubble placement so the coach card never hides the spotlight hole. */
export function chooseBubblePlacement(
  hole: TutorialRect | null,
  viewportHeight: number,
  preferred: TutorialPlacement = 'auto',
): Exclude<TutorialPlacement, 'auto'> {
  if (preferred !== 'auto') return preferred;
  if (!hole) return 'center';
  const holeCy = hole.y + hole.height / 2;
  return holeCy < viewportHeight * 0.48 ? 'bottom' : 'top';
}

export interface TutorialRunnerOptions<Ctx = unknown> {
  flowId?: string;
  ctx?: Ctx;
  viewportWidth?: number;
  viewportHeight?: number;
  defaultNextLabel?: string;
  defaultDoneLabel?: string;
  seenTracker?: TutorialSeenTracker | null;
  markSeenOnSkip?: boolean;
  onComplete?: (flowId: string) => void;
  onSkip?: (flowId: string, stepId: string) => void;
  onChange?: (snapshot: TutorialSnapshot) => void;
}

/** Reusable multi-step tutorial controller supporting spotlight targeting, event predicates & nudges. */
export class TutorialRunner<Ctx = unknown> {
  private readonly steps: readonly TutorialStep<Ctx>[];
  private readonly flowId: string;
  private readonly ctx: Ctx;
  private readonly seenTracker: TutorialSeenTracker | null;
  private readonly markSeenOnSkip: boolean;
  private readonly defaultNextLabel: string;
  private readonly defaultDoneLabel: string;
  private readonly onComplete?: (flowId: string) => void;
  private readonly onSkip?: (flowId: string, stepId: string) => void;
  private readonly onChange?: (snapshot: TutorialSnapshot) => void;

  private viewportWidth: number;
  private viewportHeight: number;
  private active = false;
  private index = 0;
  private completed = false;
  private skipped = false;
  private nudgeMsg: string | null = null;
  private nudgeLeft = 0;

  constructor(steps: readonly TutorialStep<Ctx>[], options: TutorialRunnerOptions<Ctx> = {}) {
    this.steps = steps;
    this.flowId = options.flowId ?? 'default';
    this.ctx = options.ctx as Ctx;
    this.viewportWidth = options.viewportWidth ?? 720;
    this.viewportHeight = options.viewportHeight ?? 1280;
    this.defaultNextLabel = options.defaultNextLabel ?? '下一步';
    this.defaultDoneLabel = options.defaultDoneLabel ?? '開始遊玩';
    this.seenTracker = options.seenTracker ?? null;
    this.markSeenOnSkip = options.markSeenOnSkip ?? true;
    this.onComplete = options.onComplete;
    this.onSkip = options.onSkip;
    this.onChange = options.onChange;
  }

  get isActive(): boolean {
    return this.active;
  }

  get stepIndex(): number {
    return this.index;
  }

  get stepCount(): number {
    return this.steps.length;
  }

  get currentStep(): TutorialStep<Ctx> | null {
    return this.active ? (this.steps[this.index] ?? null) : null;
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    if (this.active) this.notify();
  }

  start(startIndex = 0): boolean {
    if (!this.steps.length) return false;
    const clamped = Math.max(0, Math.min(this.steps.length - 1, Math.floor(startIndex)));
    if (this.active) this.currentStep?.onExit?.(this.ctx, 'abort');
    this.active = true;
    this.completed = false;
    this.skipped = false;
    this.nudgeMsg = null;
    this.nudgeLeft = 0;
    this.index = clamped;
    this.currentStep?.onEnter?.(this.ctx);
    this.notify();
    return true;
  }

  next(): boolean {
    if (!this.active) return false;
    const prev = this.currentStep;
    const isLast = this.index + 1 >= this.steps.length;
    prev?.onExit?.(this.ctx, isLast ? 'complete' : 'advance');
    this.nudgeMsg = null;
    this.nudgeLeft = 0;
    if (isLast) {
      this.active = false;
      this.completed = true;
      this.seenTracker?.markSeen(this.flowId);
      this.onComplete?.(this.flowId);
      this.notify();
      return false;
    }
    this.index++;
    this.currentStep?.onEnter?.(this.ctx);
    this.notify();
    return true;
  }

  prev(): boolean {
    if (!this.active || this.index <= 0) return false;
    this.currentStep?.onExit?.(this.ctx, 'back');
    this.nudgeMsg = null;
    this.nudgeLeft = 0;
    this.index--;
    this.currentStep?.onEnter?.(this.ctx);
    this.notify();
    return true;
  }

  skip(): void {
    if (!this.active) return;
    const cur = this.currentStep;
    cur?.onExit?.(this.ctx, 'skip');
    this.active = false;
    this.skipped = true;
    this.nudgeMsg = null;
    this.nudgeLeft = 0;
    if (this.markSeenOnSkip) this.seenTracker?.markSeen(this.flowId);
    this.onSkip?.(this.flowId, cur?.id ?? '');
    this.notify();
  }

  stop(reason: 'complete' | 'skip' | 'abort' = 'abort'): void {
    if (!this.active) return;
    this.currentStep?.onExit?.(this.ctx, reason);
    this.active = false;
    this.nudgeMsg = null;
    this.nudgeLeft = 0;
    if (reason === 'complete') {
      this.completed = true;
      this.seenTracker?.markSeen(this.flowId);
      this.onComplete?.(this.flowId);
    } else if (reason === 'skip') {
      this.skipped = true;
      if (this.markSeenOnSkip) this.seenTracker?.markSeen(this.flowId);
    }
    this.notify();
  }

  /** Dispatch a gameplay/UI event into the active step. Advances if waitFor + accept match. */
  emit(eventName: string, payload?: unknown): { handled: boolean; advanced: boolean; rejectedText?: string } {
    if (!this.active) return { handled: false, advanced: false };
    const step = this.currentStep;
    if (!step || step.advance === 'next' || step.advance === 'tap-anywhere') {
      return { handled: false, advanced: false };
    }
    const waited = step.waitFor
      ? Array.isArray(step.waitFor)
        ? step.waitFor
        : [step.waitFor]
      : [];
    if (waited.length > 0 && !waited.includes(eventName)) {
      return { handled: false, advanced: false };
    }
    if (step.accept) {
      const verdict = step.accept(payload, this.ctx, eventName);
      if (verdict === false) return { handled: true, advanced: false };
      if (typeof verdict === 'object' && !verdict.ok) {
        if (verdict.rejectText) this.nudge(verdict.rejectText);
        return { handled: true, advanced: false, rejectedText: verdict.rejectText };
      }
    }
    this.next();
    return { handled: true, advanced: true };
  }

  /** Temporarily display a gentle guidance banner inside the tutorial card. */
  nudge(text: string, durationSec = 2.4): void {
    if (!this.active) return;
    this.nudgeMsg = text;
    this.nudgeLeft = Math.max(0.4, durationSec);
    this.notify();
  }

  update(dt: number): void {
    if (!this.active || this.nudgeLeft <= 0) return;
    this.nudgeLeft = Math.max(0, this.nudgeLeft - dt);
    if (this.nudgeLeft === 0 && this.nudgeMsg !== null) {
      this.nudgeMsg = null;
      this.notify();
    }
  }

  resolveStep(): ResolvedTutorialStep | null {
    const step = this.currentStep;
    if (!step) return null;

    const advance: TutorialAdvanceMode = step.advance ?? (step.waitFor ? 'event' : 'next');
    const rawTarget = typeof step.target === 'function' ? step.target() : (step.target ?? null);
    const hole = rawTarget
      ? expandRect(rawTarget, step.pad ?? 10, this.viewportWidth, this.viewportHeight)
      : null;
    const strictTarget = step.strictTarget ?? (advance === 'event' && hole !== null);
    const highlights = typeof step.highlights === 'function' ? step.highlights() : (step.highlights ?? []);

    let gesture: ResolvedTutorialGesture | null = null;
    const gSpec = step.gesture === undefined && hole && advance === 'event' ? { type: 'tap' as const } : step.gesture;
    if (gSpec) {
      const fallbackCenter = hole ? rectCenter(hole) : { x: this.viewportWidth / 2, y: this.viewportHeight / 2 };
      const fromPt = typeof gSpec.from === 'function' ? gSpec.from() : gSpec.from;
      const toPt = typeof gSpec.to === 'function' ? gSpec.to() : gSpec.to;
      gesture = {
        type: gSpec.type,
        from: fromPt ?? fallbackCenter,
        to: toPt ?? (fromPt ?? fallbackCenter),
      };
    }

    const isLast = this.index + 1 >= this.steps.length;
    const showBtn = advance === 'next' || !!step.showNextWithEvent;
    const nextLabel = showBtn ? (step.nextLabel ?? (isLast ? this.defaultDoneLabel : this.defaultNextLabel)) : null;

    return {
      id: step.id,
      title: step.title,
      body: step.body,
      badge: step.badge ?? `${this.index + 1}/${this.steps.length}`,
      advance,
      strictTarget,
      hole,
      radius: step.radius ?? 16,
      highlights,
      gesture,
      nextLabel,
      canSkip: step.canSkip ?? true,
      placement: chooseBubblePlacement(hole, this.viewportHeight, step.placement ?? 'auto'),
      dock: step.dock ?? 'near',
    };
  }

  snapshot(): TutorialSnapshot {
    const resolved = this.resolveStep();
    if (!resolved) {
      return {
        active: false,
        flowId: this.flowId,
        stepIndex: this.index,
        stepCount: this.steps.length,
        stepId: null,
        title: '',
        body: '',
        badge: '',
        advance: 'next',
        strictTarget: false,
        hole: null,
        highlights: [],
        gesture: null,
        nudgeText: null,
        nextLabel: null,
        canSkip: false,
        placement: 'center',
        dock: 'near',
        completed: this.completed,
        skipped: this.skipped,
      };
    }
    return {
      active: true,
      flowId: this.flowId,
      stepIndex: this.index,
      stepCount: this.steps.length,
      stepId: resolved.id,
      title: resolved.title,
      body: resolved.body,
      badge: resolved.badge,
      advance: resolved.advance,
      strictTarget: resolved.strictTarget,
      hole: resolved.hole,
      highlights: resolved.highlights,
      gesture: resolved.gesture,
      nudgeText: this.nudgeMsg,
      nextLabel: resolved.nextLabel,
      canSkip: resolved.canSkip,
      placement: resolved.placement,
      dock: resolved.dock,
      completed: this.completed,
      skipped: this.skipped,
    };
  }

  private notify(): void {
    this.onChange?.(this.snapshot());
  }
}
