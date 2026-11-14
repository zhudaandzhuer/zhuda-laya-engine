// Generated from TypeScript source; run npm run types:generate.
/**
 * Edge smoothing that finds the shape of each edge (SMAA 1x): where the
 * picture steps, it follows the step to both ends, works out how much of
 * each pixel the true edge would have covered, and mixes each pixel with
 * its neighbour by that much. A slanted line comes out as a ramp of the
 * right length, where `ZhudaEdgeSmoothing` (FXAA) only blurs along it; flat
 * areas and texture inside a surface are left exactly as they were.
 *
 * Three passes over the picture and two pictures of its size, eight bits a
 * channel, for the frame. It runs after tone mapping (`finishEffects`): an
 * edge is judged as the eye sees it and mixed as light. It cannot recover a
 * line thinner than a pixel, and it does not look for diagonal patterns
 * (one of the reference's "high" and "ultra" extras): edges near 30 and 60
 * degrees keep more of their steps than level and upright ones.
 *
 * The method is SMAA 2.8 by Jimenez, Echevarria, Masia, Navarro and
 * Gutierrez (MIT); the passes follow the WebGL port in three.js 0.187.0
 * (MIT) and the two lookup tables are theirs: `vendor/threejs-post/README.md`.
 * Only the class needs the Laya runtime.
 */
export type ZhudaSmaaQuality = 'low' | 'medium' | 'high' | 'ultra';
/**
 * What each quality stands for: the step in brightness that counts as an
 * edge (on a curve close to the screen's, 0..1), and how far an edge is
 * followed to each side, in steps of two pixels.
 */
export declare const ZHUDA_SMAA_QUALITIES: Record<ZhudaSmaaQuality, {
    threshold: number;
    steps: number;
}>;
export interface ZhudaSmaaOptions {
    /** Default `high`: an edge is followed 32 pixels to each side. */
    quality?: ZhudaSmaaQuality;
    /**
     * How much a sharp corner (of a box, a window, a panel) is rounded, 0..1
     * (default 0). A level or upright edge that ends in a corner looks to the
     * method like the last step of a slanted line: at 0 such an edge is left
     * as it is, at 1 it is smoothed like any step, a faint ramp along the
     * edge as far as an edge is followed. The reference uses 0.25. Slanted
     * edges come out the same at any value.
     */
    cornerRounding?: number;
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaSmaa(options: ZhudaSmaaOptions): string[];
export declare class ZhudaSmaa {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `finishEffects`, before the lens finish. */
    readonly effect: any;
    private readonly materials;
    private readonly tables;
    private quality;
    private disposed;
    private shape;
    constructor(options?: ZhudaSmaaOptions);
    /** Another quality or corner rounding in place. */
    set(options: ZhudaSmaaOptions): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
