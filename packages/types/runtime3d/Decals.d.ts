// Generated from TypeScript source; run npm run types:generate.
export type ZhudaDecalShape = 'blob' | 'patch' | 'ring';
export interface ZhudaDecalOptions {
    /** Centre of the mark on the surface, world metres. */
    position: readonly number[];
    /** Width and length in metres. */
    size: readonly number[];
    /** The way the surface faces, a direction (default [0, 1, 0]: a floor). */
    normal?: readonly number[];
    /** Turns the mark about that direction, degrees (default 0). */
    angleDeg?: number;
    /** The mark's colour as LayaAir takes surface colours, RGB 0..1 (default [0.02, 0.02, 0.02]). */
    color?: readonly number[];
    /** How much of the surface it covers at its middle, 0..1 (default 0.8). */
    opacity?: number;
    /** Roughness of the mark, 0..1 (default 0.6); low is wet or glossy. */
    roughness?: number;
    /** `blob` (default), `patch` or `ring`. */
    shape?: ZhudaDecalShape;
    /** How wide the soft edge is, as a share of the mark, 0..1 (default 0.35). */
    edge?: number;
    /** How ragged a blob's outline is, 0..1 (default 0.5). */
    ragged?: number;
    /** Which outline: the same seed gives the same mark (default 1). */
    seed?: number;
    /** Side of the baked picture: 64, 128 or 256 (default 128). */
    resolution?: 64 | 128 | 256;
    /** Height off the surface in metres, 0.0005..0.05 (default 0.004). */
    lift?: number;
}
export declare function validateZhudaDecal(options: ZhudaDecalOptions): string[];
export declare function resolveZhudaDecal(options: ZhudaDecalOptions): Required<ZhudaDecalOptions>;
/**
 * How much of the mark there is at each texel, 0..255: `size * size` values,
 * row 0 first. Nothing reaches the border of the picture, so the rectangle's
 * own edge never shows.
 */
export declare function bakeZhudaDecalMask(options: {
    shape: ZhudaDecalShape;
    edge: number;
    ragged: number;
    seed: number;
    resolution: number;
}): Uint8Array;
/**
 * The rectangle of a decal: four corners `lift` off the surface, its width
 * along the first axis and its length along the second, both lying in the
 * surface and turned by `angleDeg` about its normal.
 */
export declare function zhudaDecalQuad(options: Required<ZhudaDecalOptions>): {
    positions: Float32Array<ArrayBuffer>;
    normals: Float32Array<ArrayBuffer>;
    uvs: Float32Array<ArrayBuffer>;
    indices: Uint16Array<ArrayBuffer>;
};
export declare class ZhudaDecal {
    /** The node that draws the mark (a `MeshSprite3D`). */
    readonly node: any;
    private readonly mesh;
    private readonly material;
    private readonly texture;
    private disposed;
    constructor(scene: any, options: ZhudaDecalOptions);
    dispose(): void;
}
