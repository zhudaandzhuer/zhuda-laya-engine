// Generated from TypeScript source; run npm run types:generate.
/**
 * The 3D picture drawn smaller than the canvas and brought up to it, for
 * devices that cannot fill every pixel: at 0.67 a frame has 45 % of the
 * pixels to light and grade. The 2D interface over it is drawn at the
 * canvas's own size and stays sharp.
 *
 * The scale is LayaAir's own `Config3D.pixelRatio` (every screen camera draws
 * its picture, and every effect of its chain, at that size); picking with
 * `Camera.viewportPointToRay` already takes it into account. Where LayaAir
 * stretches the picture over the canvas, this draws it instead:
 * - `'fsr'` (default): AMD FidelityFX Super Resolution 1 in two passes:
 *   EASU, an upscale that follows edges (12 reads a pixel), then RCAS, a
 *   sharpening that stops short of rings (5 reads), at canvas size;
 * - `'bilinear'`: one pass, RCAS on a plain filtered upscale;
 * - `'plain'`: LayaAir's own filtered stretch, no sharpening.
 * The upscale cannot be an effect inside the camera's chain: LayaAir sizes
 * every picture of the chain to the camera's (smaller) target.
 *
 * `Config3D.pixelRatio` is one value for the whole stage: one render scale
 * at a time. A scene destroyed while it holds the scale gives it back.
 * Only the class needs the Laya runtime.
 */
export type ZhudaUpscale = 'fsr' | 'bilinear' | 'plain';
export interface ZhudaRenderScaleOptions {
    /** Size of the 3D picture against the canvas, 0.5..1 (default 1). */
    scale?: number;
    /** How the smaller picture reaches the canvas (default 'fsr'). */
    upscale?: ZhudaUpscale;
    /**
     * Strength of the sharpening, 0..1 (default 0.8): 1 is the most RCAS
     * allows (FSR's 0 stops), 0.5 one stop less, 0 none.
     */
    sharpness?: number;
}
export declare const ZHUDA_RENDER_SCALE_MIN = 0.5;
/** Checked options with every default filled in. */
export declare function zhudaRenderScaleOptions(options?: ZhudaRenderScaleOptions): Required<ZhudaRenderScaleOptions>;
/** The size the 3D picture is drawn at for a canvas of `width` by `height` (LayaAir's rounding). */
export declare function zhudaRenderScaleSize(width: number, height: number, scale: number): {
    width: number;
    height: number;
};
export declare class ZhudaRenderScale {
    private options;
    private readonly l;
    private readonly scene3D;
    private readonly previousRatio;
    /** The scene's own `blitMainCanvas` and `destroy`, when it had its own before this. */
    private readonly ownBlit;
    private readonly ownDestroy;
    private readonly passes;
    private readonly data;
    /** EASU's picture at canvas size, kept from frame to frame. */
    private target;
    /** Kept from frame to frame: where the passes draw and what they are told. */
    private readonly places;
    private disposed;
    constructor(scene3D: any, options?: ZhudaRenderScaleOptions);
    get scale(): number;
    get upscale(): ZhudaUpscale;
    get sharpness(): number;
    /** Changes the scale (and, when given, the upscale and sharpness) from the next frame. */
    set(options: ZhudaRenderScaleOptions): void;
    dispose(): void;
    private apply;
    /** In place of LayaAir's `Scene3D.blitMainCanvas`, for each camera drawn to the canvas. */
    private blit;
}
