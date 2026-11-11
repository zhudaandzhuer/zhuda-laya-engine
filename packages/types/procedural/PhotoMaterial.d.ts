// Generated from TypeScript source; run npm run types:generate.
/**
 * A full PBR texture set from one colour picture.
 *
 * A photograph (or a generated picture) of a flat surface gives colour only.
 * This derives the rest so the surface reacts to light: it makes the picture
 * wrap without a seam, takes relief from its fine light-and-dark detail
 * (joints and pits are dark, so they sit lower), builds the normal map from
 * that relief and makes low, dirty places rougher than raised, worn ones.
 *
 * Pure and deterministic. The result is a `ZhudaBakedTextureSet`, so it goes
 * wherever a baked recipe goes. The relief is a guess from brightness: it is
 * right for masonry, paving and timber, and wrong where a surface is dark
 * without being low (a stain, a painted mark).
 */
import type { ZhudaBakedTextureSet } from './TextureRecipe.js';
export interface ZhudaPhotoMaterialOptions {
    /** Id of the set (lowercase letters, digits, dot, dash, underscore). */
    id: string;
    /** Real size of the picture in metres along u and v. */
    tileMeters: [number, number];
    /** Output size, a power of two 16..2048 (default 1024). The picture is resampled. */
    size?: number;
    /** Depth between the lowest and highest point, 0..100 millimetres (default 8). */
    reliefMm?: number;
    /**
     * Width of the detail that counts as relief, as a share of the tile,
     * 0.002..0.25 (default 0.03). Tone changes broader than this are colour, not shape.
     */
    detail?: number;
    /** Roughness of raised, worn areas and of low, dirty ones, 0..1 (default 0.6 and 0.95). */
    roughness?: [number, number];
    /** Share of the edge blended to make the picture wrap, 0..0.25 (default 0.04). */
    seam?: number;
    /**
     * 0..1 (default 0.5): how far broad light-and-dark differences are evened
     * out, which removes uneven lighting baked into the picture.
     */
    flatten?: number;
    metallic?: number;
    normalConvention?: 'directx' | 'opengl';
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaPhotoMaterial(options: ZhudaPhotoMaterialOptions): string[];
/**
 * Derives the set. `rgba` is the picture as sRGB bytes, four per pixel, top
 * row first (alpha is ignored).
 */
export declare function deriveZhudaPhotoMaterial(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, options: ZhudaPhotoMaterialOptions): ZhudaBakedTextureSet;
