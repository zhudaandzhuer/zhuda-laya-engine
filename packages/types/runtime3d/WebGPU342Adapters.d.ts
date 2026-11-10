// Generated from TypeScript source; run npm run types:generate.
/** Laya 3.4.2 WebGPU skips culling on two of three frames. Scene mutations
 * outside Stage.render record the previous loopCount, so the next frame can
 * reuse render elements whose materials/geometry have already been destroyed.
 * Consume pending structural changes at the actual cull, for all camera/light
 * passes in that frame. Unchanged scenes retain the upstream optimization. */
export declare function installLaya342WebGPUFix(native: any): void;
