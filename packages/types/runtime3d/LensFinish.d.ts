// Generated from TypeScript source; run npm run types:generate.
/**
 * The marks a real camera leaves on a picture, as one post-process effect at
 * the end of the chain (after tone mapping): film grain, a vignette and a
 * little colour fringing toward the corners. A rendered frame without them
 * looks cleaner than any photograph, which reads as computer-made.
 *
 * Grain is a function of the pixel and a frame seed, so a frame is the same
 * however often it is rendered. Only the class needs the Laya runtime.
 */
export interface ZhudaLensFinishOptions {
    /** Grain strength, 0..1 (default 0.25): 1 is about ±6 % of full scale in the mid-tones. */
    grain?: number;
    /** How much the corners darken, 0..1 (default 0.3). */
    vignette?: number;
    /** Colour fringing at the corners, 0..1 (default 0.15): 1 shifts red and blue by 0.4 % of the frame. */
    fringe?: number;
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaLensFinish(options: ZhudaLensFinishOptions): string[];
/**
 * How much darker a point is than the centre: `x` and `y` are -1..1 across
 * the frame. The same curve as the shader.
 */
export declare function zhudaVignette(strength: number, x: number, y: number): number;
export declare class ZhudaLensFinish {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` adds it last (`finishEffects`). */
    readonly effect: any;
    private readonly material;
    private disposed;
    constructor(options?: ZhudaLensFinishOptions);
    /** Output size in pixels and the frame number that seeds the grain. */
    setFrame(width: number, height: number, frame: number): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
