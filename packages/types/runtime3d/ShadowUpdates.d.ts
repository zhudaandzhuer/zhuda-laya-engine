// Generated from TypeScript source; run npm run types:generate.
/**
 * How often a scene's sun and spot light draw their shadow maps: every frame
 * (LayaAir's default), every few frames, or only when asked. Between two
 * drawings the receivers keep the last maps, so a still caster keeps its
 * shadow and a moving one leaves it behind until the next drawing.
 *
 * LayaAir 3.4.2 has the skipping (`Scene3D.shadowMapFrequency`), but used as
 * it is it breaks frames: on a frame that skips the maps it also takes the
 * shadow uniforms out of the scene's uniform set. On WebGPU every draw of a
 * shadowed material then fails pipeline validation and the frame is lost (the
 * canvas keeps the frame before it); on WebGL a material whose shader is first
 * compiled on such a frame reads its shadow uniforms from the wrong place for
 * good. `installLaya342SkippedShadowFrames` keeps the uniforms on those frames.
 * Its count also runs off by every hand-drawn view (a mirror, a capture), so
 * this class decides each frame itself instead of using the native count.
 *
 * Point lights draw their shadows on demand already (`ZhudaPointShadow`).
 */
export type ZhudaShadowUpdateMode = 'every' | 'interval' | 'manual';
export interface ZhudaShadowUpdateOptions {
    /** 'every' frame (default), every `interval` frames, or 'manual': on `redraw()` only. */
    mode?: ZhudaShadowUpdateMode;
    /** Frames from one drawing to the next with mode 'interval', 2..30 (default 3). */
    interval?: number;
}
/** Checked options with every default filled in. */
export declare function zhudaShadowUpdateOptions(options?: ZhudaShadowUpdateOptions): Required<ZhudaShadowUpdateOptions>;
/**
 * Whether a frame draws the shadow maps: `since` frames were drawn without
 * them since the last drawing, `requested` is a pending `redraw()`. Pure.
 */
export declare function zhudaShadowFrameDraws(options: Required<ZhudaShadowUpdateOptions>, since: number, requested: boolean): boolean;
/**
 * Keeps the shadow uniforms in the scene's uniform set on a frame that skips
 * the shadow maps while shadows are on (`Stat.enableShadow`) and the maps
 * of an earlier frame are in use; see the class comment. A frame that draws
 * the maps, and a view drawn with shadows switched off, are left as LayaAir
 * has them. Returns false where the render process is not LayaAir 3.4.2's.
 */
export declare function installLaya342SkippedShadowFrames(runtime?: any): boolean;
/**
 * The shadow update rule of one `Scene3D`. One at a time per scene; dispose
 * gives the scene back LayaAir's own every-frame drawing.
 */
export declare class ZhudaShadowUpdates {
    private options;
    private readonly scene3D;
    private readonly l;
    private native;
    private installed;
    private disposed;
    private requested;
    private since;
    private frame;
    private drawsNow;
    /** Frames this scene was drawn with shadows on, and how many of them drew the maps. */
    private counts;
    constructor(scene3D: any, options?: ZhudaShadowUpdateOptions);
    get mode(): ZhudaShadowUpdateMode;
    get interval(): number;
    /** Frames drawn with shadows on since the rule was made, and how many drew the maps. */
    get stats(): {
        frames: number;
        drawn: number;
    };
    /** Changes the rule in place; the next frame draws the maps. */
    set(options: ZhudaShadowUpdateOptions): void;
    /**
     * The next frame draws the maps (a caster or the sun moved, the camera
     * went somewhere else). Several calls before that frame draw once.
     */
    redraw(): void;
    dispose(): void;
    /** 'every' is LayaAir's own path; the others answer LayaAir's frame test themselves. */
    private apply;
    private uninstall;
    /** One answer a frame: every view drawn in it (a mirror, the camera) sees the same maps. */
    private decide;
}
