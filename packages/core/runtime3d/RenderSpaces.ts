export type ZhudaRenderPass = "local" | "world" | "overlay";
export type ZhudaRenderCoordinates = "local" | "world" | "camera-overlay";
export type ZhudaRenderMatrix = ReadonlyArray<number>;

export interface ZhudaRenderPoint {
  x: number;
  y: number;
  z?: number;
}

export interface ZhudaRenderPassContext {
  readonly pass: ZhudaRenderPass;
  readonly coordinates: ZhudaRenderCoordinates;
  /** Matrix supplied by the consumer render bridge; no transform is applied here. */
  readonly transform: ZhudaRenderMatrix | null;
  /** Optional zero-allocation conversions supplied by the owning scene/node. */
  readonly localToWorld?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
  readonly worldToLocal?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
}

export interface ZhudaRenderSpaceFrame {
  localTransform?: ZhudaRenderMatrix | null;
  worldTransform?: ZhudaRenderMatrix | null;
  overlayTransform?: ZhudaRenderMatrix | null;
  localToWorld?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
  worldToLocal?: (point: ZhudaRenderPoint, out: ZhudaRenderPoint) => void;
}

export interface ZhudaRenderSpaceCallbacks {
  onRenderLocal?: (context: ZhudaRenderPassContext) => void;
  onRenderWorld?: (context: ZhudaRenderPassContext) => void;
  onRenderOverlay?: (context: ZhudaRenderPassContext) => void;
}

export interface ZhudaRenderRegistration {
  readonly cancelled: boolean;
  cancel(): boolean;
}

/** Dispatches explicit local/world/overlay passes without mutating a Laya matrix. */
export class ZhudaRenderSpace {
  private registrations = new Set<ZhudaRenderSpaceCallbacks>();
  private disposed = false;

  register(callbacks: ZhudaRenderSpaceCallbacks): ZhudaRenderRegistration {
    if (this.disposed) throw Error("Disposed render space");
    if (!callbacks || (!callbacks.onRenderLocal && !callbacks.onRenderWorld && !callbacks.onRenderOverlay))
      throw Error("Render space needs at least one pass callback");
    this.registrations.add(callbacks);
    let cancelled = false;
    return {
      get cancelled() { return cancelled; },
      cancel: () => {
        if (cancelled) return false;
        cancelled = true;
        return this.registrations.delete(callbacks);
      },
    };
  }

  render(frame: ZhudaRenderSpaceFrame): number {
    if (this.disposed) return 0;
    const snapshot = [...this.registrations];
    let calls = 0;
    const dispatch = (
      pass: ZhudaRenderPass,
      coordinates: ZhudaRenderCoordinates,
      transform: ZhudaRenderMatrix | null | undefined,
      callback: ((context: ZhudaRenderPassContext) => void) | undefined,
    ) => {
      if (!callback) return;
      callback({
        pass,
        coordinates,
        transform: transform ?? null,
        localToWorld: frame.localToWorld,
        worldToLocal: frame.worldToLocal,
      });
      calls++;
    };
    for (const registration of snapshot) {
      dispatch("local", "local", frame.localTransform, registration.onRenderLocal);
      dispatch("world", "world", frame.worldTransform, registration.onRenderWorld);
      dispatch("overlay", "camera-overlay", frame.overlayTransform, registration.onRenderOverlay);
    }
    return calls;
  }

  clear(): void { this.registrations.clear(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
  get size(): number { return this.registrations.size; }
}
