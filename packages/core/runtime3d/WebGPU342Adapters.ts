const patched = new WeakSet<object>();
/** Laya 3.4.2 WebGPU skips culling on two of three frames. Scene mutations
 * outside Stage.render record the previous loopCount, so the next frame can
 * reuse render elements whose materials/geometry have already been destroyed.
 * Consume pending structural changes at the actual cull, for all camera/light
 * passes in that frame. The same holds for a camera or shadow light that
 * moved: its cull runs in the frame of the move. Unchanged scenes retain the
 * upstream optimization. */
export function installLaya342WebGPUFix(native: any): void {
  const prototype = native.WebGPUMeshRenderBatchAgent?.prototype;
  if (!prototype || patched.has(prototype)) return;
  const append = prototype.appendRenderElement;
  prototype.appendRenderElement = function (...args: unknown[]) {
    const now = native.Stat.loopCount;
    // A camera or shadow light that moved this frame must be culled this
    // frame: upstream defers it by up to two frames, so a turned camera (a
    // probe face, a cut, a mirror) would draw the previous view's objects.
    if (
      this._cameraChangeMask === now ||
      this._dirCullChangeMask === now ||
      this._spotCullChangeMask === now
    )
      this._canKipCull = now;
    if (this._checkCPUCullList?.length || this._changeElementBatchMark?.length) {
      this._canKipCull = native.Stat.loopCount;
      this._cameraChangeMask =
        this._dirCullChangeMask =
        this._spotCullChangeMask =
          native.Stat.loopCount;
    }
    return append.apply(this, args);
  };
  patched.add(prototype);
  fixMergedIndices(native);
}

/**
 * Laya 3.4.2 merges the meshes of a batch into one buffer and reads every
 * index buffer as 16-bit (`IndexFormat.UInt16 ? ... : ...` tests the enum
 * constant, not the buffer). A mesh with more than 65 535 vertices drawn more
 * than once comes out as a fan of shards. The indices of 32-bit buffers are
 * copied again here, correctly, right after the upstream merge.
 */
function fixMergedIndices(native: any): void {
  const prototype = native.BatchMergeVertexInfo?.prototype;
  if (!prototype || patched.has(prototype) || typeof prototype.addMesh !== 'function') return;
  const addMesh = prototype.addMesh;
  prototype.addMesh = function (vertexBuffer: any, indexBuffer: any, ...rest: unknown[]) {
    const fresh =
      indexBuffer?.indexType === native.IndexFormat?.UInt32 &&
      !this._cacheIndexInfo.has(indexBuffer.globalId);
    const result = addMesh.call(this, vertexBuffer, indexBuffer, ...rest);
    if (fresh) {
      const start = this._cacheIndexInfo.get(indexBuffer.globalId);
      const base = this._cacheVertexInfo.get(vertexBuffer.globalId);
      const count = indexBuffer.getNativeBuffer()._byteLength / 4;
      const source = new Uint32Array(indexBuffer.buffer, indexBuffer.bufferoffset ?? 0, count);
      for (let i = 0; i < count; i++) this._indexData[start + i] = source[i] + base;
      this.indexBuffer.setData(this._indexData.buffer, start * 4, start * 4, count * 4);
    }
    return result;
  };
  patched.add(prototype);
}

/**
 * The glTF PBR depth-normal pass (drawn for ambient occlusion and other depth
 * effects) includes the fog code in its fragment stage, but its vertex stage
 * writes no fog factor. WebGL links that; the WebGPU compiler rejects it and
 * the frame is lost as soon as a fogged scene draws a glTF model with ambient
 * occlusion. Depth and normals need no fog: the pass stops accepting the define.
 */
/** Call once the native engine has initialized (shaders are registered by then). */
export function fixLaya342WebGPUShaders(native: any): void {
  const shader = native.Shader3D?.find?.('glTFPBR');
  const fog = native.Shader3D?.getDefineByName?.('FOG');
  if (!shader || !fog) return;
  for (const sub of shader._subShaders ?? [])
    for (const pass of sub._passes ?? [])
      if (pass.pipelineMode === 'DepthNormal') pass._validDefine?.remove?.(fog);
}

const halfToFloat = (h: number): number => {
  const exponent = (h >> 10) & 31,
    mantissa = h & 1023,
    sign = h & 0x8000 ? -1 : 1;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 31) return mantissa ? NaN : sign * Infinity;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
};

/**
 * Reads an R16G16B16A16 render target as floats, rows from the top of the
 * picture. On WebGL this is the native read-back. Laya 3.4.2's WebGPU read-back
 * indexes 16-bit data with byte offsets and returns every other row, so there
 * the texture is copied out and decoded here.
 */
export async function readLaya342FloatTarget(
  native: any,
  target: any,
  width: number,
  height: number,
): Promise<Float32Array> {
  const out = new Float32Array(width * height * 4);
  const engine = native.LayaGL?.renderEngine;
  const device = typeof engine?.getDevice === 'function' ? engine.getDevice() : null;
  if (!device) {
    await target.getDataAsync(0, 0, width, height, out);
    return out;
  }
  const texture = target._renderTarget?._textures?.[0]?.resource;
  if (!texture) throw Error('Render target has no WebGPU colour texture to read');
  const gpu = globalThis as any;
  const bytesPerRow = Math.ceil((width * 8) / 256) * 256;
  const buffer = device.createBuffer({
    size: bytesPerRow * height,
    usage: gpu.GPUBufferUsage.COPY_DST | gpu.GPUBufferUsage.MAP_READ,
  });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture, origin: [0, 0] },
      { buffer, bytesPerRow },
      { width, height, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(gpu.GPUMapMode.READ);
    const data = new Uint16Array(buffer.getMappedRange());
    const stride = bytesPerRow / 2;
    for (let j = 0; j < height; j++)
      for (let i = 0; i < width * 4; i++)
        out[j * width * 4 + i] = halfToFloat(data[j * stride + i]);
    buffer.unmap();
  } finally {
    buffer.destroy();
  }
  return out;
}
