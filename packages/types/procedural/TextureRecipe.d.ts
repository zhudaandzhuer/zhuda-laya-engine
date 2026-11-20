// Generated from TypeScript source; run npm run types:generate.
export type ZhudaLinearColor = [number, number, number];
type Range = [number, number];
type Frequency = number | [number, number];
export type ZhudaTextureMask = {
    type: 'constant';
    value?: number;
} | {
    type: 'fbm';
    frequency: Frequency;
    octaves?: number;
    seed?: number;
    range?: Range;
} | {
    type: 'cells';
    frequency: Frequency;
    /** distance: 0 at a cell centre; edge: 0 on cell borders; id: one random value per cell. */
    mode?: 'distance' | 'edge' | 'id';
    seed?: number;
    range?: Range;
} | {
    type: 'stripes';
    axis: 'u' | 'v';
    count: number;
    /** sine: smooth ridge per stripe; square: 1 for the first `duty` of each stripe. */
    profile?: 'sine' | 'square';
    duty?: number;
    range?: Range;
} | {
    type: 'bricks';
    columns: number;
    rows: number;
    mortar: number;
    /**
     * mortar (default): 1 on the joints. id: one random value per brick, for
     * tone, tilt or wear that differs from slab to slab. edge: 0 on the
     * joint rising to 1 at the brick's middle, for worn or bevelled edges.
     */
    mode?: 'mortar' | 'id' | 'edge';
    seed?: number;
    range?: Range;
} | {
    /**
     * One shape filling the tile, for a card that is cut out (a leaf, a
     * blade of grass, a petal, a puff): 1 inside, falling to 0 over
     * `softness` of the tile (default 0.04) at its outline. It does not
     * repeat: use it with a material whose card spans one tile.
     * disc: an ellipse touching the tile's edges. leaf: pointed at both
     * ends along v. blade: full width at v = 0, a point at v = 1.
     * petal: round at v = 1 with a notch, narrowing to v = 0.
     */
    type: 'shape';
    shape: 'disc' | 'leaf' | 'blade' | 'petal';
    softness?: number;
    range?: Range;
};
export interface ZhudaTextureLayer {
    name?: string;
    mask: ZhudaTextureMask;
    /** Optional second mask multiplied into the first, e.g. rust only inside grooves. */
    within?: ZhudaTextureMask;
    opacity?: number;
    /** Linear RGB, 0..1. */
    color?: ZhudaLinearColor;
    roughness?: number;
    metallic?: number;
    /** Signed relief in millimetres where the mask is 1. */
    heightMm?: number;
    /**
     * How solid the surface is where the mask is 1, 0..1: the albedo map's
     * alpha. With a material that is cut out (`blend: 'cutout'`) or blended,
     * a base `alpha` of 0 and a layer with a `shape` mask and `alpha: 1` is a
     * card with an outline.
     */
    alpha?: number;
}
export interface ZhudaTextureRecipe {
    schemaVersion: 1;
    id: string;
    /** Real size of one tile in metres along u and v. */
    tileMeters: [number, number];
    seed?: number;
    /** `alpha` (default 1): how solid the surface is before the layers; the albedo map's alpha. */
    base: {
        color: ZhudaLinearColor;
        roughness: number;
        metallic: number;
        alpha?: number;
    };
    layers?: ZhudaTextureLayer[];
}
export interface ZhudaTextureBakeOptions {
    /** Power of two, 16..2048. CPU cost grows with size squared times layer count. */
    size?: number;
    /** Laya's native normal maps use -Y ('directx'). */
    normalConvention?: 'directx' | 'opengl';
}
export interface ZhudaBakedTextureSet {
    readonly id: string;
    readonly size: number;
    readonly tileMeters: [number, number];
    readonly normalConvention: 'directx' | 'opengl';
    /** RGBA8, sRGB-encoded colour. Row 0 is v = 0. */
    readonly albedo: Uint8Array;
    /** RGBA8 tangent-space normal. */
    readonly normal: Uint8Array;
    /** RGBA8 in Laya packing: R = metallic, A = smoothness (1 - roughness). */
    readonly metallicGloss: Uint8Array;
    /** Relief in metres, row-major, same resolution. */
    readonly height: Float32Array;
    /** Bytes held by the three RGBA maps. */
    readonly bytes: number;
}
/** Returns every problem found; an empty list means the recipe can be baked. */
export declare function validateZhudaTextureRecipe(recipe: unknown): string[];
/**
 * Evaluates one mask at a tile coordinate; the result is in 0..1 and repeats
 * with period 1 in both u and v.
 */
export declare function evaluateZhudaTextureMask(mask: ZhudaTextureMask, u: number, v: number, seed?: number): number;
/** Bakes a validated recipe on the CPU. Throws with every validation issue listed. */
export declare function bakeZhudaTextureSet(recipe: ZhudaTextureRecipe, options?: ZhudaTextureBakeOptions): ZhudaBakedTextureSet;
/** Short stable fingerprint (FNV-1a) of the three maps, for determinism evidence. */
export declare function fingerprintZhudaTextureSet(set: ZhudaBakedTextureSet): string;
export {};
