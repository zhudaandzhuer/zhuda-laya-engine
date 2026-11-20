// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaBakedTextureSet } from './TextureRecipe.js';
export interface ZhudaProceduralMaterialOptions {
    /** Multiplies the baked colour, so one texture set can serve several paint colours. */
    tint?: [number, number, number, number];
    /**
     * 'meters' (default): mesh UVs are in metres and the material repeats every
     * `tileMeters`. 'tile': UVs already span 0..1 per tile.
     */
    uvUnit?: 'meters' | 'tile';
    /** Upload with mipmaps (default true); tiled surfaces shimmer without them. */
    mipmap?: boolean;
    /**
     * Slow changes of brightness over the surface, so that its tiles do not
     * read as a grid: how far the brightness strays (`amount`, 0..1) and how
     * large the changes are (`meters`: several tiles, and not a multiple of
     * one). Off unless given. It is the material's detail map.
     */
    variation?: {
        amount: number;
        meters: number;
        seed?: number;
    };
    /**
     * How the baked alpha is used (a recipe's `alpha`): 'cutout' draws where it
     * is above `alphaCutoff` (default 0.5) and keeps depth and shadows, 'alpha'
     * and 'additive' blend. Default 'opaque': the alpha is ignored.
     */
    blend?: 'opaque' | 'cutout' | 'alpha' | 'additive';
    alphaCutoff?: number;
    /** Both faces are drawn: one sheet for a leaf or a blade, not two back to back. */
    doubleSided?: boolean;
    /**
     * Fine detail for close range: a second baked set laid over the first,
     * repeating every `meters` (well under the base tile: grain, pores,
     * scratches). Its colour changes the base's brightness and tone by
     * `albedo` (0..1, default 0.5) about the set's own mean, so the surface
     * keeps its overall colour; its normal map is added at `normal` (0..2,
     * default 1). Far away its small mip levels are its mean, which changes
     * nothing: it fades by itself. It is the material's one detail map: not
     * together with `variation`.
     */
    detail?: {
        set: ZhudaBakedTextureSet;
        meters: number;
        albedo?: number;
        normal?: number;
    };
}
export interface ZhudaProceduralMaterial {
    readonly material: any;
    readonly textures: readonly any[];
    /** Destroys the material and the textures it owns. */
    dispose(): void;
}
/**
 * A baked albedo map as LayaAir's detail map: each channel as a share of its
 * mean, about the value that leaves the base unchanged, `strength` of the way
 * from it. LayaAir multiplies the base by the detail in linear light times
 * 4.5948 (2 to the power 2.2), so that value is 1 / 4.5948. Pure.
 */
export declare function zhudaDetailPixels(albedo: Uint8Array, strength: number): Uint8Array;
export declare function createZhudaProceduralMaterial(set: ZhudaBakedTextureSet, options?: ZhudaProceduralMaterialOptions): ZhudaProceduralMaterial;
