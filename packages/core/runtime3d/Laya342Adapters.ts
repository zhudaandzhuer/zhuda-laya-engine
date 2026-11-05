const patched = new WeakSet<object>();
/** Version-specific sizing seam. Native retinal sizing preserves design units
 * and scales the stage transform, including pointer conversion and text caches.
 * Override the browser ratio only during the synchronous resize so a render
 * quality cap never changes the browser/device measurement seen by consumers. */
export function resizeLaya342Stage(
  runtime: {
    Browser: object;
    stage: {
      size(width: number, height: number): unknown;
      setScreenSize(width: number, height: number): void;
      _canvasTransform?: {
        a: number;
        b: number;
        c: number;
        d: number;
        tx: number;
        ty: number;
      };
    };
  },
  width: number,
  height: number,
  designWidth: number,
  designHeight: number,
  dpr: number,
  canvas?: HTMLCanvasElement,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    runtime.Browser,
    "pixelRatio",
  );
  try {
    Object.defineProperty(runtime.Browser, "pixelRatio", {
      configurable: true,
      get: () => dpr,
    });
    runtime.stage.size(designWidth, designHeight);
    runtime.stage.setScreenSize(width * dpr, height * dpr);
    // Laya's input consumes page coordinates, but native setScreenSize only
    // includes canvas.style.left/top. Account for an embedded container after
    // native CSS placement; do not move the rendered canvas a second time.
    const matrix = runtime.stage._canvasTransform;
    if (canvas?.getBoundingClientRect && matrix) {
      const rect = canvas.getBoundingClientRect();
      const x = [
        0,
        matrix.a * canvas.width,
        matrix.c * canvas.height,
        matrix.a * canvas.width + matrix.c * canvas.height,
      ];
      const y = [
        0,
        matrix.b * canvas.width,
        matrix.d * canvas.height,
        matrix.b * canvas.width + matrix.d * canvas.height,
      ];
      matrix.tx = rect.left + (globalThis.scrollX || 0) - Math.min(...x);
      matrix.ty = rect.top + (globalThis.scrollY || 0) - Math.min(...y);
    }
  } finally {
    if (descriptor)
      Object.defineProperty(runtime.Browser, "pixelRatio", descriptor);
    else Reflect.deleteProperty(runtime.Browser, "pixelRatio");
  }
}
/** Laya 3.4.2 allocates two process-owned fallback textures but releases only depth.
 * Keep this version-specific repair isolated from consumer scene code. */
export function installLaya342LifecycleFix(
  runtime: any = (globalThis as any).Laya,
) {
  const prototype = runtime?.WebRender3DProcess?.prototype;
  if (!prototype || patched.has(prototype)) return;
  const destroy = prototype.destroy;
  if (typeof destroy !== "function") return;
  const retired = new WeakSet<object>();
  prototype.destroy = function (...args: any[]) {
    if (retired.has(this)) return;
    retired.add(this);
    const shadow = this._defaultShadowMap;
    try {
      return destroy.apply(this, args);
    } finally {
      if (shadow && !shadow.destroyed) shadow.destroy();
      this._defaultShadowMap = null;
    }
  };
  patched.add(prototype);
}
