// Generated from TypeScript source; run npm run types:generate.
/**
 * Dither where a picture is written in eight bits. A slow gradient (a night
 * sky, fog, the edge of a soft shadow, a vignette) has more shades than
 * eight bits hold, and rounding each pixel to the nearest one shows as
 * bands. A little noise added before the rounding, about one step, trades
 * the bands for grain too fine to see: over a few pixels the picture
 * averages to the shade that was meant.
 *
 * Where the rounding happens depends on the camera:
 *
 * - An HDR camera (a `ZhudaFilmicPipeline`, a look) keeps the picture in
 *   floats to the end of its chain; it is rounded once, where LayaAir turns
 *   it for the screen (`outputTransform` with `GAMMACORRECT`).
 * - A plain camera draws its materials into an eight-bit picture first
 *   (LayaAir's built-in target, in the sRGB curve) and copies that to the
 *   canvas: it is rounded as each material is written.
 *
 * The noise is added at the one or the other. The text of one include and
 * of the fragment programs that call it is changed as LayaAir registers
 * them, and compiles to LayaAir's own code until a scene asks. Vendor files
 * are not modified.
 */
/** On a scene's values: the picture is dithered where it is turned for the screen. */
export declare const ZHUDA_DITHER_DEFINE = "ZHUDA_DITHER";
/** On a scene's values: the picture is dithered as each material is written (a camera with an eight-bit target). */
export declare const ZHUDA_DITHER_LINEAR_DEFINE = "ZHUDA_DITHER_LINEAR";
/** `OutputTransform.glsl` with the noise function. Pure. */
export declare function zhudaPatchDitherInclude(text: string): {
    text: string;
    reason?: string;
};
/**
 * A fragment program with the noise added after each place it turns its
 * colour for the screen; a program that does not is returned as it was.
 * `calls` says how many places. Pure.
 */
export declare function zhudaPatchDitherPass(fragment: string): {
    text: string;
    calls: number;
};
/**
 * The noise the shader adds at a pixel, in steps of eight bits (-1..1), from
 * the same arithmetic in JavaScript; a GPU rounds a little differently.
 */
export declare function zhudaDitherNoise(x: number, y: number): number;
export interface ZhudaDitherStatus {
    /** The include was found and changed: a scene may ask. */
    ready: boolean;
    /** Why not, when it is not. */
    reason: string | null;
    /** How many fragment programs were given the noise as they were registered. */
    passes: number;
}
/**
 * Changes the include and the fragment programs as LayaAir registers them.
 * Must run before `Laya.init`; `ZhudaEngine.boot` calls it. If the vendored
 * include no longer holds its anchor nothing is changed and
 * `zhudaDitherStatus()` says why; `setZhudaDither` then refuses.
 */
export declare function installLaya342Dither(runtime?: any): boolean;
/** Whether a scene may ask for dither, and how many programs carry it. */
export declare function zhudaDitherStatus(runtime?: any): ZhudaDitherStatus;
/** Where a scene's picture is dithered. */
export type ZhudaDitherMode = 'off' | 'screen' | 'materials' | 'both';
/**
 * Switches dither on or off for what a scene draws. `true` looks at the
 * scene's cameras as they are now: `'screen'` when all of them are HDR (the
 * picture is rounded once, at the end of the chain), `'materials'` when
 * none is (each material is written into eight bits), `'both'` when they
 * differ. Call it again after a camera is given a pipeline or loses one; or
 * name the mode. Returns the mode that was set. The shaders in use compile
 * once more the first time. Throws when the shader text could not be put in
 * place (`zhudaDitherStatus()` says why).
 */
export declare function setZhudaDither(scene3D: any, on: boolean | ZhudaDitherMode): ZhudaDitherMode;
/** Where a scene's picture is dithered now. */
export declare function zhudaDitherMode(scene3D: any): ZhudaDitherMode;
