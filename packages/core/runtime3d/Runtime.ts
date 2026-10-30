export interface ManagedRuntimeOptions {
  container?: HTMLElement;
  dprCap?: number;
  targetFPS?: 30 | 60;
  clearInput?: () => void;
  onPause?: (paused: boolean) => void;
  onContextLost?: () => void;
  onResize?: (size: { width: number; height: number; dpr: number }) => void;
}
/** Opaque-origin frames cannot access origin storage. Provide realm-local memory
 * so Laya initialization can proceed. Durable saves belong to the trusted host. */
export function installSandboxStorageFallback() {
  const modes: Record<string, "persistent" | "memory"> = {};
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      void window[name];
      modes[name] = "persistent";
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
      modes[name] = "memory";
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
  private cleanups: (() => void)[] = [];
  private frame = 0;
  private previous = 0;
  private task: ((dt: number) => void) | null = null;
  private observer?: ResizeObserver;
  constructor(canvas: HTMLCanvasElement, options: ManagedRuntimeOptions = {}) {
    this.canvas = canvas;
    this.options = options;
    const listen = (target: EventTarget, event: string, fn: EventListener) => {
      target.addEventListener(event, fn);
      this.cleanups.push(() => target.removeEventListener(event, fn));
    };
    listen(document, "visibilitychange", () => this.setPaused(document.hidden));
    listen(window, "blur", () => this.setPaused(true));
    listen(window, "focus", () => {
      if (!document.hidden && !this.contextLost) this.setPaused(false);
    });
    listen(canvas, "webglcontextlost", (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.setPaused(true);
      options.onContextLost?.();
    });
    try {
      if (options.container) {
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(options.container);
      } else listen(window, "resize", () => this.resize());
      this.resize();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  setPaused(value: boolean) {
    this.options.clearInput?.();
    this.paused = value || this.contextLost;
    this.previous = 0;
    this.options.onPause?.(this.paused);
  }
  resize() {
    if (this.disposed) return;
    const l = (globalThis as any).Laya,
      c = this.options.container;
    if (!c && !this.options.dprCap) return;
    const rect = c?.getBoundingClientRect(),
      width = rect?.width || innerWidth,
      height = rect?.height || innerHeight,
      dpr = Math.min(devicePixelRatio || 1, this.options.dprCap ?? 2);
    if (width < 2 || height < 2) return;
    // In 3.4.2 retinal mode multiplies design dimensions by Browser.pixelRatio.
    // We already selected backing dimensions from the explicit DPR cap.
    l.Config.useRetinalCanvas = false;
    l.stage.screenAdaptationEnabled = false;
    l.stage.scaleMode = l.Stage.SCALE_SHOWALL;
    l.stage.alignH = l.Stage.ALIGN_LEFT;
    l.stage.alignV = l.Stage.ALIGN_TOP;
    l.stage.size(Math.round(width * dpr), Math.round(height * dpr));
    l.stage.setScreenSize(
      width * l.Browser.pixelRatio,
      height * l.Browser.pixelRatio,
    );
    this.options.onResize?.({ width, height, dpr });
  }
  start(update: (dt: number) => void) {
    if (this.disposed) throw Error("Disposed runtime");
    this.task = update;
    if (this.frame) return;
    const tick = (now: number) => {
      this.frame = 0;
      if (this.disposed) return;
      if (!this.paused) {
        const elapsed = this.previous ? now - this.previous : 0;
        if (
          !this.previous ||
          elapsed >= 1000 / (this.options.targetFPS || 60) - 2
        ) {
          this.previous = now;
          this.task?.(Math.min(0.1, elapsed / 1000));
        }
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.task = null;
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
      if (
        e.source !== this.frame?.contentWindow ||
        !e.data ||
        typeof e.data !== "object"
      )
        return;
      const message = e.data;
      if (message.type === "zhuda:ready") {
        this.send("zhuda:restore", this.state);
        options.onReady?.(this.generation);
      } else if (message.type === "zhuda:snapshot") this.state = message.state;
      else if (message.type === "zhuda:context-lost") {
        this.state = message.state;
        this.restarts++;
        this.restart(this.state);
      }
      options.onMessage?.(message);
    };
    window.addEventListener("message", receive);
    this.cleanup = () => window.removeEventListener("message", receive);
    this.restart();
  }
  send(type: string, state?: unknown) {
    this.frame?.contentWindow?.postMessage({ type, state }, "*");
  }
  restart(state: unknown = this.state) {
    if (this.disposed) throw Error("Disposed host");
    this.state = state;
    this.generation++;
    this.frame?.remove();
    const f = document.createElement("iframe");
    f.title = "3D runtime";
    f.style.cssText = "display:block;width:100%;height:100%;border:0";
    if (this.options.sandbox) f.setAttribute("sandbox", this.options.sandbox);
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
    on(element, "pointerdown", ((e: PointerEvent) => {
      const role = chooseRole(e);
      if (!role || [...this.pointers.values()].some((p) => p.role === role))
        return;
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
    on(element, "pointermove", ((e: PointerEvent) => {
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
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      on(element, name, up);
    on(window, "blur", () => this.clear());
    on(document, "visibilitychange", () => {
      if (document.hidden) this.clear();
    });
  }
  clear() {
    for (const id of this.pointers.keys())
      if (this.element.hasPointerCapture(id))
        this.element.releasePointerCapture(id);
    this.pointers.clear();
    this.changed(this.pointers);
  }
  dispose() {
    this.clear();
    for (const f of this.cleanup) f();
    this.cleanup = [];
  }
}
