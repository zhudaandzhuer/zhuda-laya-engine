// Generated from TypeScript source; run npm run types:generate.
/**
 * Several clips of one model at once: a walk and a run mixed by how fast
 * the character goes, kept in step so the same foot comes down together;
 * and one clip laid over the rest on some of the bones (a wave over a
 * walk). LayaAir's animator plays one clip, or fades from one to another;
 * this poses the bones itself from as many clips as it is given, with
 * LayaAir's own evaluation of each.
 *
 * Only positions, rotations and scales of nodes are mixed (what a skeleton
 * is made of). Anything else a clip animates (a material's number, a morph
 * weight) is left alone. Nothing here keeps time: the caller says where in
 * the round the blend is.
 */
import type { ModelInstance } from './Assets.js';
export declare class ZhudaAnimationBlend {
    /** The clips, in the order their weights are given in. */
    readonly clips: readonly {
        name: string;
        seconds: number;
    }[];
    private readonly animator;
    private readonly layer;
    private readonly slots;
    private readonly evaluator;
    private readonly mixed;
    private readonly previousSpeed;
    private stamp;
    private disposed;
    /**
     * @param path the node that carries the animator (`$` is the model's root).
     * @param clips names of the clips to mix, at least one.
     */
    constructor(instance: ModelInstance, path: string, clips: readonly string[], layerIndex?: number);
    private evaluate;
    private kind;
    /** Adds `weight` of a clip's evaluated values into the mix; `inside` limits it to some nodes. */
    private gather;
    /** Writes the mix to the nodes; what a clip left out is made up with the node's own rest value. */
    private write;
    private alive;
    /**
     * Poses the model from every clip at once. `weights` is one number a clip
     * (made to add up to 1). `phase` is where in the round the blend is,
     * 0..1: each clip is read at that share of its own length, so clips of
     * different lengths stay in step. A clip with no weight is not read.
     */
    apply(weights: readonly number[], phase: number): void;
    /**
     * Lays one clip over the pose the model has now, on the nodes named in
     * `under` and everything below them (an arm, the spine upward), by
     * `weight` 0..1. Call after `apply`. The clip is read at `seconds`.
     */
    overlay(clip: string, seconds: number, weight: number, under: readonly string[]): void;
    /** Gives the animator back to LayaAir's own playback. The last pose stays until it plays. */
    dispose(): void;
}
