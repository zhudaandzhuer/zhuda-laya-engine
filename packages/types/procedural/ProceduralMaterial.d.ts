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
}
export interface ZhudaProceduralMaterial {
    readonly material: any;
    readonly textures: readonly any[];
    /** Destroys the material and the textures it owns. */
    dispose(): void;
}
export declare function createZhudaProceduralMaterial(set: ZhudaBakedTextureSet, options?: ZhudaProceduralMaterialOptions): ZhudaProceduralMaterial;
