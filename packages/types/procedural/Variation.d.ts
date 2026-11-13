// Generated from TypeScript source; run npm run types:generate.
/**
 * A tileable picture of slow, soft changes in brightness around a neutral
 * grey. Laid over a tiled surface at a much larger scale (as the detail map
 * of its material), it makes every tile a little different from the next and
 * hides the repeat that a large floor or road otherwise shows as a grid.
 * Pure and deterministic.
 */
export interface ZhudaVariationOptions {
    /** How far the brightness strays, 0..1: at 1 from about 0.65 to 1.35 times. */
    amount: number;
    /** Edge of the square picture in pixels: 32, 64, 128 or 256 (default 256). */
    size?: number;
    /** Which pattern; the same seed always gives the same picture (default 1). */
    seed?: number;
}
export interface ZhudaBakedVariation {
    size: number;
    /** RGBA, 8 bits, sRGB-encoded; 128 is neutral for LayaAir's detail map. */
    pixels: Uint8Array;
}
export declare function validateZhudaVariation(options: ZhudaVariationOptions): string[];
export declare function bakeZhudaVariation(options: ZhudaVariationOptions): ZhudaBakedVariation;
