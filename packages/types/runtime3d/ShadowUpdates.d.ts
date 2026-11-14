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
 * The maps belong to the light, not to a camera: LayaAir has one set, fitted
 * to the camera that drew them last, and every camera reads that set. So the
 * rule keeps them for one camera, the view. Any other camera that draws the
 * scene with shadows on (a probe or a capture camera, a mirror told to draw
 * shadows of its own) draws maps of its own as it does without the rule, and
 * the view draws its maps again the next time it is drawn: it never reads
 * maps fitted to another camera. A camera named with `zhudaShadowBorrower`
 * (the engine's mirrors, unless told otherwise) reads the view's kept maps
 * instead, so a water surface costs no shadow drawing and takes nothing
 * from the view.
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
 * has them. It also tells the rule which camera LayaAir's frame test is
 * for. Returns false where the render process is not LayaAir 3.4.2's.
 */
export declare function installLaya342SkippedShadowFrames(runtime?: any): boolean;
/**
 * Names a camera that reads the maps a rule keeps for its view instead of
 * drawing maps of its own: a mirror of that view, whose picture shows the
 * same part of the world. It borrows only while the kept maps are the
 * view's and no drawing is pending (`ZhudaShadowUpdates.lends`); otherwise,
 * and in a scene without a rule, it draws its own like any camera. The
 * engine's mirrors (`ZhudaPlanarReflection`, the water and wet surfaces) are
 * named unless their `shadows` / `mirrorShadows` option says otherwise.
 * `borrows: false` takes the name away.
 */
export declare function zhudaShadowBorrower(camera: any, borrows?: boolean): void;
/**
 * The shadow update rule of one `Scene3D`. One at a time per scene; dispose
 * gives the scene back LayaAir's own every-frame drawing.
 */
export declare class ZhudaShadowUpdates {
    private options;
    private readonly scene3D;
    private readonly view;
    private readonly l;
    private native;
    private installed;
    private disposed;
    private requested;
    private since;
    private frame;
    private drawsNow;
    /** The camera the maps in place were drawn for. */
    private mapsFor;
    private counts;
    /**
     * `camera` is the view the maps are kept for (a look gives its own).
     * Without one, every camera that draws to the canvas is a view; two of
     * them take the maps from each other and nothing is saved.
     */
    constructor(scene3D: any, options?: ZhudaShadowUpdateOptions, camera?: any);
    get mode(): ZhudaShadowUpdateMode;
    get interval(): number;
    /**
     * Since the rule was made: `frames` the view was drawn in with shadows on,
     * `drawn` how many of them drew the maps, and `taken` how many of those
     * only because another camera had drawn maps of its own since (a mirror
     * with shadows of its own, a probe, a capture). `taken` rising with
     * `frames` means the rule saves nothing in this scene.
     */
    get stats(): {
        frames: number;
        drawn: number;
        taken: number;
    };
    /**
     * Whether a borrowing camera (`zhudaShadowBorrower`) drawn now reads the
     * kept maps: the rule keeps maps, those in place are the view's, and no
     * drawing is pending.
     */
    get lends(): boolean;
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
    /** The camera the maps are kept for; without one, any camera drawing to the canvas. */
    private isView;
    /** Whether the camera LayaAir is about to draw draws the maps first. */
    private decide;
}
