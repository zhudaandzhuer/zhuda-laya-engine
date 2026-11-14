// Generated from TypeScript source; run npm run types:generate.
/** The renderer define and uniform the patched include reads. */
export declare const ZHUDA_OBJECT_MOTION_DEFINE = "ZHUDA_OBJECT_MOTION";
export declare const ZHUDA_OBJECT_MOTION_UNIFORM = "u_ZhudaMotion";
/**
 * Teaches LayaAir's velocity picture that a thing can move. Must run before
 * `Laya.init` (`ZhudaEngine.boot` does it). Compiles to LayaAir's own code
 * for every renderer that is not tracked. Returns false when there is no
 * runtime to patch.
 */
export declare function installLaya342ObjectMotion(runtime?: any): boolean;
/** Whether a tracked thing's motion reaches the velocity picture in this runtime (after `Laya.init`). */
export declare function zhudaObjectMotionInstalled(runtime?: any): boolean;
/**
 * The matrix that takes a point of this frame to where it was a frame ago:
 * the earlier world matrix times the inverse of this one. Identity for a
 * thing that did not move, and for one whose matrix cannot be inverted.
 */
export declare function zhudaMotionMatrix(before: ArrayLike<number>, now: ArrayLike<number>): Float32Array;
export declare class ZhudaObjectMotion {
    private readonly tracked;
    private disposed;
    constructor();
    /**
     * A node that moves, with everything under it that draws. Call
     * `refresh()` on what comes back after adding or removing parts of it.
     */
    track(node: any): {
        refresh(): void;
        remove(): void;
    };
    private find;
    private clear;
    private release;
    /**
     * Once a frame, after everything has moved and before the frame is drawn:
     * tells each tracked renderer where its node was the frame before.
     */
    update(): void;
    /** After a cut or a teleport: the next frame has no motion. */
    reset(): void;
    dispose(): void;
}
