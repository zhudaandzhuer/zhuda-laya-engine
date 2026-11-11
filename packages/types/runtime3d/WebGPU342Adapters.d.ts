// Generated from TypeScript source; run npm run types:generate.
/** Laya 3.4.2 WebGPU skips culling on two of three frames. Scene mutations
 * outside Stage.render record the previous loopCount, so the next frame can
 * reuse render elements whose materials/geometry have already been destroyed.
 * Consume pending structural changes at the actual cull, for all camera/light
 * passes in that frame. The same holds for a camera or shadow light that
 * moved: its cull runs in the frame of the move. Unchanged scenes retain the
 * upstream optimization. */
export declare function installLaya342WebGPUFix(native: any): void;
/**
 * The glTF PBR depth-normal pass (drawn for ambient occlusion and other depth
 * effects) includes the fog code in its fragment stage, but its vertex stage
 * writes no fog factor. WebGL links that; the WebGPU compiler rejects it and
 * the frame is lost as soon as a fogged scene draws a glTF model with ambient
 * occlusion. Depth and normals need no fog: the pass stops accepting the define.
 */
/** Call once the native engine has initialized (shaders are registered by then). */
export declare function fixLaya342WebGPUShaders(native: any): void;
/**
 * Reads an R16G16B16A16 render target as floats, rows from the top of the
 * picture. On WebGL this is the native read-back. Laya 3.4.2's WebGPU read-back
 * indexes 16-bit data with byte offsets and returns every other row, so there
 * the texture is copied out and decoded here.
 */
export declare function readLaya342FloatTarget(native: any, target: any, width: number, height: number): Promise<Float32Array>;
