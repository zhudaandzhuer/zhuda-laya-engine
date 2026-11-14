// Generated from TypeScript source; run npm run types:generate.
/**
 * Ambient occlusion by horizons (GTAO, after Jimenez and others, 2016):
 * round each pixel a few slices are cut through the depth picture, the
 * horizon is found on both sides of each, and the part of the sky's light
 * that still reaches the point is worked out exactly for that slice, with
 * the light weighted by the angle it falls at.
 *
 * Against LayaAir's own occlusion (`ScalableAO`):
 * - open, flat ground stays as it is: a plane's horizons lie in the plane,
 *   where the other method's samples darken it a little everywhere;
 * - the darkening in a crease is the share of the sky that the geometry
 *   within the radius hides, not a tuned amount, and the sky itself is
 *   never darkened;
 * - it reads the depth picture only. LayaAir's needs the scene drawn once
 *   more for normals; here the normal is taken from the depth itself.
 *
 * Two passes: the occlusion (full size, or half size for a phone), and one
 * that smooths it over four by four pixels without crossing a depth edge
 * and darkens the scene by it. As any occlusion laid over a finished
 * picture it darkens direct light as well as ambient light: keep it mild in
 * sunlit scenes. Only the class needs the Laya runtime.
 */
export interface ZhudaGroundTruthAOOptions {
    /**
     * How strongly the scene is darkened, 0..4 (default 1): the light that
     * reaches a point, raised to this power. 1 is what the geometry hides.
     */
    intensity?: number;
    /** How far occluders are looked for, in scene units, 0.05..10 (default 0.5). */
    radius?: number;
    /** Slices through each pixel, 1..4 (default 2). */
    slices?: number;
    /** Depth reads to each side of a slice, 2..8 (default 4). */
    steps?: number;
    /** Work the occlusion out at half size (default false): a quarter of the reads, softer contact. */
    halfSize?: boolean;
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaGroundTruthAO(options: ZhudaGroundTruthAOOptions): string[];
/**
 * The light that reaches a point through one slice, 0..1, for a sky lit
 * evenly and weighted by the angle it falls at. `low` and `high` are the
 * horizons to each side as angles from the direction to the eye, in radians
 * (-PI/2..0 and 0..PI/2 for an open plane seen head on), and `normal` is
 * the angle of the surface normal in the slice. The shader's arithmetic.
 */
export declare function zhudaHorizonVisibility(low: number, high: number, normal: number): number;
export declare class ZhudaGroundTruthAO {
    /**
     * The Laya post-process effect: first in a chain's linear part, before
     * anything is added to the scene's light. `ZhudaFilmicPipeline` puts it
     * there with `aoMethod: 'gtao'`.
     */
    readonly effect: any;
    private readonly materials;
    private readonly values;
    private disposed;
    constructor(options?: ZhudaGroundTruthAOOptions);
    /** New values in place; the same limits as the options. */
    set(options: ZhudaGroundTruthAOOptions): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
