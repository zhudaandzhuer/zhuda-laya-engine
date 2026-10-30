const patched = new WeakSet<object>();
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
