import {
  ZhudaLayeredClock,
  ZhudaRealtimeClock,
  ZhudaTimerScheduler,
  type ZhudaClockSample,
} from './Clocks.ts';
import { ZhudaSceneMutationQueue } from './SceneMutation.ts';
import { resizeLaya342Stage } from './Laya342Adapters.ts';
import { ZhudaRafDriver, type ZhudaRuntimeDriver } from './RuntimeDriver.ts';

/** Wake the same session clock from the platform's existing Laya frame loop. */
class LayaPlatformDriver implements ZhudaRuntimeDriver {
  private tick?: () => void;
  now() {
    return Laya.Browser.now();
  }
  start(callback: (nowMs: number) => void) {
    this.stop();
    const tick = () => {
      if (this.tick === tick) callback(this.now());
    };
    this.tick = tick;
    Laya.systemTimer.frameLoop(1, this, tick);
  }
  setBackground(_background: boolean) {}
  stop() {
    if (this.tick) Laya.systemTimer.clear(this, this.tick);
    this.tick = undefined;
  }
  dispose() {
    this.stop();
  }
}

export interface ManagedRuntimeOptions {
  container?: HTMLElement;
  /**
   * The container's layout size in CSS pixels, for a container whose rectangle on screen is not
   * its layout: one turned a quarter by a CSS transform (a landscape game filling an upright
   * phone) reports its width and height exchanged, and the stage would be sized on its side.
   * Read on every `resize()`. Omit to measure the container, or the window without one.
   */
  layoutSize?: () => { width: number; height: number };
  dprCap?: number;
  /** Omit for responsive CSS-pixel units. A fixed design is fitted into the container. */
  designSize?: { width: number; height: number };
  scaleMode?: string;
  /** Owned by this session; defaults to RAF. */
  driver?: ZhudaRuntimeDriver;
  backgroundPolicy?: 'pause' | 'continue';
  /** Foreground recovery never replays an unbounded suspended interval. */
  recoveryPolicy?: 'discard' | 'bounded';
  maxFrameDeltaSec?: number;
  /**
   * A fixed clock: every frame advances the session's clock by exactly this many seconds,
   * whatever time really passed. Timers, waits, tweens, time layers and `update(dt)` then go
   * through the same values on every run, frame for frame, so two builds can be compared after
   * the same number of frames. It does not touch what does not go through this clock (`Date`,
   * `performance.now()` read by a game, audio, CSS animation). Omit for real time.
   */
  fixedDeltaSec?: number;
  onResume?: (report: { elapsedSec: number; advancedSec: number; discardedSec: number }) => void;
  targetFPS?: 30 | 60;
  timeScale?: number;
  clearInput?: () => void;
  onPause?: (paused: boolean) => void;
  onContextLost?: () => void;
  /**
   * Called whenever the stage is sized, **the first time while the runtime is
   * still being made**: before `ZhudaEngine.boot` has returned its context.
   * A handler must not read what is made after boot (declare it first, or
   * return early until it exists).
   */
  onResize?: (size: { width: number; height: number; dpr: number }) => void;
}
/** Opaque-origin frames cannot access origin storage. Provide realm-local memory
 * so Laya initialization can proceed. Durable saves belong to the trusted host. */
export function installSandboxStorageFallback() {
  const modes: Record<string, 'persistent' | 'memory'> = {};
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      void window[name];
      modes[name] = 'persistent';
    } catch {
      const values = new Map<string, string>();
      const memory = {
        get length() {
          return values.size;
        },
        key: (i: number) => [...values.keys()][i] ?? null,
        getItem: (k: string) => values.get(String(k)) ?? null,
        setItem: (k: string, v: string) => {
          values.set(String(k), String(v));
        },
        removeItem: (k: string) => {
          values.delete(String(k));
        },
        clear: () => values.clear(),
      };
      Object.defineProperty(window, name, {
        configurable: true,
        value: memory,
      });
      modes[name] = 'memory';
    }
  }
  return modes;
}
/** Owns one update task and its listeners. Laya rendering remains on the engine scheduler. */
export class ZhudaRuntimeSession {
  readonly canvas: HTMLCanvasElement;
  readonly options: ManagedRuntimeOptions;
  paused = false;
  contextLost = false;
  disposed = false;
  readonly clock = new ZhudaRealtimeClock();
  /** Named channels driven by the same RAF clock as `clock` and `timers`. */
  readonly layers = new ZhudaLayeredClock();
  readonly timers = new ZhudaTimerScheduler();
  readonly mutations = new ZhudaSceneMutationQueue();
  private cleanups: (() => void)[] = [];
  private started = false;
  private previous: number | undefined;
  private readonly driver: ZhudaRuntimeDriver;
  private background = false;
  private manuallyPaused = false;
  private suspendedAt?: number;
  private recoveryDelta = 0;
  private task: ((dt: number, sample?: ZhudaClockSample) => void) | null = null;
  private observer?: ResizeObserver;
  constructor(canvas: HTMLCanvasElement, options: ManagedRuntimeOptions = {}) {
    this.canvas = canvas;
    this.options = options;
    if (
      !['pause', 'continue'].includes(options.backgroundPolicy ?? 'pause') ||
      !['discard', 'bounded'].includes(options.recoveryPolicy ?? 'discard') ||
      !Number.isFinite(options.maxFrameDeltaSec ?? 0.1) ||
      (options.maxFrameDeltaSec ?? 0.1) <= 0 ||
      (options.maxFrameDeltaSec ?? 0.1) > 1
    )
      throw Error('Invalid runtime background/recovery policy');
    if (
      options.fixedDeltaSec !== undefined &&
      (!Number.isFinite(options.fixedDeltaSec) ||
        options.fixedDeltaSec <= 0 ||
        options.fixedDeltaSec > 1)
    )
      throw Error('Invalid fixedDeltaSec: seconds per frame, above 0 and at most 1');
    if (options.timeScale !== undefined) {
      if (!Number.isFinite(options.timeScale) || options.timeScale < 0)
        throw Error('Invalid runtime time scale');
      this.clock.timeScale = options.timeScale;
    }
    const native = (globalThis as unknown as { Laya?: typeof Laya }).Laya;
    const platform = native?.Browser?.isDomSupported === false ? native.PAL?.browser : undefined;
    this.driver = options.driver ?? (platform ? new LayaPlatformDriver() : new ZhudaRafDriver());
    this.layers.setGlobalTimeScale(this.clock.timeScale);
    const listen = (target: EventTarget, event: string, fn: EventListener, capture = false) => {
      target.addEventListener(event, fn, capture);
      this.cleanups.push(() => target.removeEventListener(event, fn, capture));
    };
    if (platform) {
      if (options.container) throw Error('Mini-game runtime cannot use a DOM container');
      const visibility = (visible: boolean) => this.setBackground(!visible);
      const focus = () => this.setBackground(false);
      const blur = () => this.setBackground(true);
      const resize = () => this.resize();
      for (const [event, callback] of [
        [Laya.Event.VISIBILITY_CHANGE, visibility],
        [Laya.Event.FOCUS, focus],
        [Laya.Event.BLUR, blur],
        [Laya.Event.RESIZE, resize],
      ] as const) {
        platform.on(event, this, callback);
        this.cleanups.push(() => platform.off(event, this, callback));
      }
      try {
        this.resize();
        if (!platform.getVisibility()) this.setBackground(true);
      } catch (error) {
        this.dispose();
        throw error;
      }
      return;
    }
    listen(document, 'visibilitychange', () => this.setBackground(document.hidden));
    // A phone sends `blur` when its address bar, keyboard or a system sheet
    // takes focus, and often never sends `focus` back: the game then stays
    // paused on a visible page. There, leaving the page is told by visibility
    // and pagehide alone; a desktop window still pauses on blur.
    const media = (query: string) =>
      typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(query).matches;
    const touchOnly = media('(pointer: coarse)') && !media('(pointer: fine)');
    listen(window, 'blur', () => {
      if (!touchOnly) this.setBackground(true);
    });
    const back = () => {
      if (!document.hidden && !this.contextLost) this.setBackground(false);
    };
    listen(window, 'focus', back);
    // Input on a visible page means the player is here, whatever focus said.
    listen(window, 'pointerdown', back, true);
    listen(window, 'keydown', back, true);
    listen(window, 'pagehide', () => this.setBackground(true));
    listen(window, 'pageshow', () => {
      if (!document.hidden) this.setBackground(false);
    });
    listen(window, 'scroll', () => this.resize(), true);
    listen(canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.notifyContextLost();
    });
    try {
      if (options.container) {
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(options.container);
      } else listen(window, 'resize', () => this.resize());
      this.resize();
      if (document.hidden) this.setBackground(true);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  /** Shared WebGL context/WebGPU device-loss path; a new realm owns recovery. */
  notifyContextLost() {
    if (this.disposed || this.contextLost) return;
    this.contextLost = true;
    this.setPaused(true);
    this.options.onContextLost?.();
  }
  setPaused(value: boolean) {
    this.manuallyPaused = value;
    this.options.clearInput?.();
    this.paused =
      value ||
      this.contextLost ||
      (this.background && this.options.backgroundPolicy !== 'continue');
    this.previous = undefined;
    this.recoveryDelta = 0;
    this.options.onPause?.(this.paused);
  }
  private setBackground(background: boolean) {
    if (this.disposed || this.background === background) return;
    this.options.clearInput?.();
    const now = this.driver.now();
    this.background = background;
    this.driver.setBackground(background);
    if (background) {
      this.suspendedAt = now;
    } else {
      const elapsedSec = Math.max(0, (now - (this.suspendedAt ?? now)) / 1000);
      const missed =
        this.options.backgroundPolicy === 'continue' && this.previous !== undefined
          ? Math.max(0, (now - this.previous) / 1000)
          : elapsedSec;
      this.recoveryDelta =
        !this.manuallyPaused && this.options.recoveryPolicy === 'bounded'
          ? Math.min(missed, this.options.maxFrameDeltaSec ?? 0.1)
          : 0;
      this.options.onResume?.({
        elapsedSec,
        advancedSec: this.recoveryDelta,
        discardedSec: Math.max(0, missed - this.recoveryDelta),
      });
      this.previous = undefined;
      this.suspendedAt = undefined;
    }
    this.paused =
      this.manuallyPaused ||
      this.contextLost ||
      (background && this.options.backgroundPolicy !== 'continue');
    this.options.onPause?.(this.paused);
  }
  resize() {
    if (this.disposed) return;
    const l = (globalThis as any).Laya,
      c = this.options.container;
    if (!c && !this.options.dprCap && !this.options.layoutSize) return;
    const platform = l.Browser?.isDomSupported === false ? l.PAL?.browser : undefined;
    const laid = platform ? undefined : this.options.layoutSize?.();
    if (laid && ![laid.width, laid.height].every((value) => Number.isFinite(value) && value >= 0))
      throw Error('Invalid runtime layout size');
    const rect = laid ? undefined : c?.getBoundingClientRect(),
      width = platform ? platform.getClientWidth() : (laid?.width ?? (rect?.width || innerWidth)),
      height = platform
        ? platform.getClientHeight()
        : (laid?.height ?? (rect?.height || innerHeight)),
      dpr = Math.min(
        platform ? platform.getPixelRatio() : devicePixelRatio || 1,
        this.options.dprCap ?? 2,
      );
    if (width < 2 || height < 2) return;
    const design = this.options.designSize ?? { width, height };
    if (![design.width, design.height, dpr].every((value) => Number.isFinite(value) && value > 0))
      throw Error('Invalid runtime design size or DPR');
    // Design units must not grow with backing resolution. Native retinal mode
    // supplies the stage scale used by both drawing and Laya input conversion.
    l.Config.useRetinalCanvas = true;
    l.stage.screenAdaptationEnabled = false;
    l.stage.scaleMode = this.options.scaleMode ?? l.Stage.SCALE_SHOWALL;
    l.stage.alignH = l.Stage.ALIGN_LEFT;
    l.stage.alignV = l.Stage.ALIGN_TOP;
    resizeLaya342Stage(
      l,
      width,
      height,
      design.width,
      design.height,
      dpr,
      platform ? undefined : this.canvas,
    );
    this.options.onResize?.({ width, height, dpr });
  }
  start(update: (dt: number, sample?: ZhudaClockSample) => void) {
    if (this.disposed) throw Error('Disposed runtime');
    this.task = update;
    if (this.started) return;
    this.started = true;
    const tick = (now: number) => {
      if (this.disposed) return;
      if (!Number.isFinite(now) || (this.previous !== undefined && now <= this.previous)) return;
      if (!this.paused) {
        const elapsed =
          this.previous !== undefined ? now - this.previous : this.recoveryDelta * 1000;
        if (this.previous === undefined || elapsed >= 1000 / (this.options.targetFPS || 60) - 2) {
          this.previous = now;
          this.recoveryDelta = 0;
          const sample = this.clock.advance(
            this.options.fixedDeltaSec ??
              Math.min(this.options.maxFrameDeltaSec ?? 0.1, elapsed / 1000),
          );
          this.layers.setGlobalTimeScale(this.clock.timeScale);
          this.layers.advance(sample.unscaledDeltaTime);
          this.timers.advance(
            sample.unscaledDeltaTime,
            sample.scaledDeltaTime,
            this.layers.scaledDeltas,
          );
          this.task?.(sample.unscaledDeltaTime, sample);
          this.mutations.flush();
        }
      }
    };
    try {
      this.driver.start(tick);
    } catch (error) {
      this.started = false;
      this.driver.stop();
      throw error;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.driver.dispose();
    this.started = false;
    this.task = null;
    this.timers.dispose();
    this.mutations.dispose();
    this.observer?.disconnect();
    for (const f of this.cleanups) f();
    this.cleanups = [];
    this.options.clearInput?.();
  }
}
/** Separate JavaScript/WebGL realm; replacing a failed frame releases its engine, tasks and listeners. */
export class ZhudaRuntimeHost {
  readonly container: HTMLElement;
  readonly url: string;
  readonly options: {
    sandbox?: string;
    onReady?: (generation: number) => void;
    onMessage?: (value: any) => void;
  };
  frame: HTMLIFrameElement | null = null;
  generation = 0;
  restarts = 0;
  private disposed = false;
  private cleanup: () => void;
  private state: unknown = null;
  constructor(
    container: HTMLElement,
    url: string,
    options: {
      sandbox?: string;
      onReady?: (generation: number) => void;
      onMessage?: (value: any) => void;
    } = {},
  ) {
    this.container = container;
    this.url = url;
    this.options = options;
    const receive = (e: MessageEvent) => {
      if (e.source !== this.frame?.contentWindow || !e.data || typeof e.data !== 'object') return;
      const message = e.data;
      if (message.type === 'zhuda:ready') {
        this.send('zhuda:restore', this.state);
        options.onReady?.(this.generation);
      } else if (message.type === 'zhuda:snapshot') this.state = message.state;
      else if (message.type === 'zhuda:context-lost') {
        this.state = message.state;
        this.restarts++;
        this.restart(this.state);
      }
      options.onMessage?.(message);
    };
    window.addEventListener('message', receive);
    this.cleanup = () => window.removeEventListener('message', receive);
    this.restart();
  }
  send(type: string, state?: unknown) {
    this.frame?.contentWindow?.postMessage({ type, state }, '*');
  }
  restart(state: unknown = this.state) {
    if (this.disposed) throw Error('Disposed host');
    this.state = state;
    this.generation++;
    this.frame?.remove();
    const f = document.createElement('iframe');
    f.title = '3D runtime';
    f.style.cssText = 'display:block;width:100%;height:100%;border:0';
    if (this.options.sandbox) f.setAttribute('sandbox', this.options.sandbox);
    f.src = this.url;
    this.container.appendChild(f);
    this.frame = f;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanup();
    this.frame?.remove();
    this.frame = null;
  }
}
export interface PointerRoleState {
  pointerId: number;
  role: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
}
/** Pointer IDs own independent roles. DOM UI can be excluded before capture; cancel/blur always release. */
export class ZhudaPointerInput {
  readonly element: HTMLElement;
  readonly chooseRole: (e: PointerEvent) => string | null;
  readonly changed: (state: ReadonlyMap<number, PointerRoleState>) => void;
  readonly pointers = new Map<number, PointerRoleState>();
  private cleanup: (() => void)[] = [];
  constructor(
    element: HTMLElement,
    chooseRole: (e: PointerEvent) => string | null,
    changed: (state: ReadonlyMap<number, PointerRoleState>) => void,
  ) {
    this.element = element;
    this.chooseRole = chooseRole;
    this.changed = changed;
    const on = (target: EventTarget, name: string, fn: EventListener) => {
      target.addEventListener(name, fn);
      this.cleanup.push(() => target.removeEventListener(name, fn));
    };
    on(element, 'pointerdown', ((e: PointerEvent) => {
      const role = chooseRole(e);
      if (!role || [...this.pointers.values()].some((p) => p.role === role)) return;
      this.pointers.set(e.pointerId, {
        pointerId: e.pointerId,
        role,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        dy: 0,
      });
      element.setPointerCapture(e.pointerId);
      e.preventDefault();
      changed(this.pointers);
    }) as EventListener);
    on(element, 'pointermove', ((e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.dx = e.clientX - p.x;
      p.dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      changed(this.pointers);
    }) as EventListener);
    const up = ((e: PointerEvent) => {
      if (this.pointers.delete(e.pointerId)) changed(this.pointers);
    }) as EventListener;
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) on(element, name, up);
    on(window, 'blur', () => this.clear());
    on(document, 'visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }
  clear() {
    for (const id of this.pointers.keys())
      if (this.element.hasPointerCapture(id)) this.element.releasePointerCapture(id);
    this.pointers.clear();
    this.changed(this.pointers);
  }
  dispose() {
    this.clear();
    for (const f of this.cleanup) f();
    this.cleanup = [];
  }
}
