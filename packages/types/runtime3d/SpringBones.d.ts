// Generated from TypeScript source; run npm run types:generate.
/**
 * Spring bones on a model: chains of LayaAir nodes (a model's bones, each a
 * child of the one before) turned by a `ZhudaSpringBoneSolver`. The first
 * node of a chain swings from where its parent holds it; the last node is
 * the chain's end and is not turned itself.
 *
 * It has no timer: each frame, once the animation has posed the model, it
 * is given the delta of a layer of the engine's clock (`update(seconds)` or
 * `updateFrom(session.layers)`). `runZhudaAfterAnimation` is the place to
 * call it from while a clip plays.
 */
import { ZhudaSpringBoneSolver, type ZhudaSpringBoneOptions, type ZhudaSpringChainOptions } from '../simulation/SpringBones.js';
import type { ZhudaCollider } from '../simulation/ParticleCore.js';
import type { ZhudaLayeredClock } from './Clocks.js';
export interface ZhudaSpringChainNodes extends ZhudaSpringChainOptions {
    /** Two or more nodes, each a child of the one before: the bones, and the chain's end last. */
    nodes: readonly any[];
}
/** A body that goes with a node: a ball or a rod given in the node's own space. */
export type ZhudaSpringBodyOnNode = {
    node: any;
    type: 'sphere';
    center?: readonly [number, number, number];
    radius: number;
} | {
    node: any;
    type: 'capsule';
    a: readonly [number, number, number];
    b: readonly [number, number, number];
    radius: number;
};
export interface ZhudaSpringBonesSpec extends ZhudaSpringBoneOptions {
    chains: readonly ZhudaSpringChainNodes[];
    /** Bodies the joints are kept out of: with a `node` they follow it; without, they stand in the world. */
    colliders?: readonly (ZhudaSpringBodyOnNode | ZhudaCollider)[];
}
export declare class ZhudaSpringBones {
    readonly solver: ZhudaSpringBoneSolver;
    private readonly chains;
    private readonly followers;
    private disposed;
    constructor(spec: ZhudaSpringBonesSpec);
    /** A body given in a node's space, where the node is now. */
    private inWorld;
    /** Tells the solver where each chain hangs from now. */
    private anchor;
    /**
     * Takes a delta in seconds, once the frame's animation has posed the
     * model: the chains are told where they hang from, the bodies where their
     * nodes are, the whole steps the delta holds are run, and the bones are
     * turned. Zero changes nothing.
     */
    update(deltaSeconds: number): {
        steps: number;
        dropped: number;
    };
    /** The same, with the delta a layer of the engine's clock has for this frame (default `world`). */
    updateFrom(layers: ZhudaLayeredClock, layer?: string): {
        steps: number;
        dropped: number;
    };
    /** The chains put back at rest where they hang now, still: after the model was put elsewhere at once. */
    reset(): void;
    /** Turns each bone to the solver's rotation, the one nearest the root first. */
    private turn;
    /** Lets go of the solver; the nodes are left as they are and are their owner's. */
    dispose(): void;
}
