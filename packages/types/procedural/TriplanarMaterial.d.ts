// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaBakedTextureSet } from './TextureRecipe.js';
export interface ZhudaTriplanarMaterialOptions {
    /** Multiplies the base colour, as `createZhudaProceduralMaterial`'s tint; default white. */
    tint?: readonly [number, number, number, number];
    /**
     * A second set where the surface faces up. `from` and `to` are the
     * upward share of the surface normal (1 = level, 0 = a wall) between which
     * it comes in: defaults 0.55 and 0.8.
     */
    top?: {
        set: ZhudaBakedTextureSet;
        from?: number;
        to?: number;
    };
    mipmap?: boolean;
}
export interface ZhudaTriplanarMaterial {
    readonly material: any;
    dispose(): void;
}
/** Checked options: `from` below `to`, both 0..1. Pure. */
export declare function zhudaTriplanarTopRange(top: {
    from?: number;
    to?: number;
}): [number, number];
export declare function createZhudaTriplanarMaterial(set: ZhudaBakedTextureSet, options?: ZhudaTriplanarMaterialOptions): ZhudaTriplanarMaterial;
