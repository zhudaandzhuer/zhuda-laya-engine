const patched = new WeakSet<object>();
/** Version-specific sizing seam. Native retinal sizing preserves design units
 * and scales the stage transform, including pointer conversion and text caches.
 * Override the browser ratio only during the synchronous resize so a render
 * quality cap never changes the browser/device measurement seen by consumers. */
export function resizeLaya342Stage(
  runtime: {
    Browser: object;
    systemTimer?: { clearCallLater(caller: object, method: (...args: never[]) => unknown): void };
    stage: {
      size(width: number, height: number): unknown;
      setScreenSize(width: number, height: number): void;
      updateCanvasSize?: (...args: never[]) => unknown;
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
    // size/alignment can enqueue a native window-sized callLater even after
    // screenAdaptationEnabled=false. Retire only that queued resize before our
    // container-owned sizing; otherwise a later frame overwrites DPR/input.
    if (runtime.stage.updateCanvasSize)
      runtime.systemTimer?.clearCallLater(runtime.stage, runtime.stage.updateCanvasSize);
    runtime.stage.setScreenSize(width * dpr, height * dpr);
    // Laya 3.4.2's retinal path updates the canvas backing buffer and, in
    // some browser builds, also writes the backing dimensions into the CSS
    // width/height attributes.  Those are different coordinate spaces: a
    // DPR-2 canvas must expose 390 CSS px while retaining a 780 px backing
    // buffer.  Keep the browser box owned by the responsive container so
    // pointer coordinates and DOM overlays remain in CSS pixels.
    if (canvas?.style) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.display = "block";
      canvas.style.touchAction = "none";
    }
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

/** Model ownership seam: native Node.destroy queues component teardown for the
 * next frame. Finish only this tree's queued components before releasing its
 * cache lease; otherwise zero-reference clips/meshes survive resource disposal.
 * Never drain the global driver (which could destroy unrelated consumer nodes).
 */
export function destroyLaya342ModelTree(node: any, runtime: any = (globalThis as any).Laya): void {
  const pending: { component: any; queue: Set<any> | undefined }[] = [];
  const collect = (n: any) => {
    for (const component of n._components ?? [])
      pending.push({ component, queue: (component._driver || runtime?.stage?._componentDriver)?._toDestroys });
    for (let i = 0; i < (n.numChildren || 0); i++) collect(n.getChildAt(i));
  };
  collect(node);
  node.destroy(true);
  for (const { component, queue } of pending)
    if (component._status === 4 && queue?.delete(component)) component._destroy(true);
}
