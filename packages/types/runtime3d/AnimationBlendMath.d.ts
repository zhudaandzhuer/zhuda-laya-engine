// Generated from TypeScript source; run npm run types:generate.
/**
 * How much of each clip a blend takes, for a value on a line (a speed: idle,
 * walk, run) or a point on a plane (a direction and a speed). Plain
 * arithmetic: the weights are never negative and add up to 1.
 */
/**
 * Weights for clips placed along a line at `positions` (ascending): the two
 * neighbours of `value` share it by how near each is; outside the ends the
 * end clip has it all.
 */
export declare function zhudaBlend1D(positions: readonly number[], value: number): number[];
/**
 * Weights for clips placed on a plane at `points`, for the point `(x, y)`
 * (gradient bands: a clip's weight falls to nothing on the line through
 * each other clip square to the way to it). At a clip's own point the
 * clip has it all; between two clips they share it by distance.
 */
export declare function zhudaBlend2D(points: readonly (readonly [number, number])[], x: number, y: number): number[];
/** Weights as given, made to add up to 1; all nothing is refused. */
export declare function zhudaNormalizeWeights(weights: readonly number[]): number[];
/**
 * How long one round of a blend lasts: clips of different lengths are kept
 * in step (a walk and a run put the same foot down together), so the round
 * is the lengths weighed by the weights.
 */
export declare function zhudaBlendSeconds(weights: readonly number[], seconds: readonly number[]): number;
