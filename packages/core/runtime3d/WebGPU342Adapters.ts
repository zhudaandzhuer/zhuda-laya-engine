const patched = new WeakSet<object>();
/** Laya 3.4.2 WebGPU skips culling on two of three frames. Scene mutations
 * outside Stage.render record the previous loopCount, so the next frame can
 * reuse render elements whose materials/geometry have already been destroyed.
 * Consume pending structural changes at the actual cull, for all camera/light
 * passes in that frame. Unchanged scenes retain the upstream optimization. */
export function installLaya342WebGPUFix(native: any): void {
  const prototype = native.WebGPUMeshRenderBatchAgent?.prototype;
  if (!prototype || patched.has(prototype)) return;
  const append = prototype.appendRenderElement;
  prototype.appendRenderElement = function(...args: unknown[]) {
    if (this._checkCPUCullList?.length || this._changeElementBatchMark?.length) {
      this._canKipCull = native.Stat.loopCount;
      this._cameraChangeMask = this._dirCullChangeMask = this._spotCullChangeMask = native.Stat.loopCount;
    }
    return append.apply(this,args);
  };
  patched.add(prototype);
}
