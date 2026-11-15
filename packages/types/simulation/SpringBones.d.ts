// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaCollider, type ZhudaSimVec3 } from './ParticleCore.js';
export type ZhudaSimQuat = readonly [number, number, number, number];
/** A chain as it is at rest, bone by bone from the one nearest what it hangs from. */
export interface ZhudaSpringChainRest {
    /** Each bone's rotation in its parent's space at rest (x, y, z, w). */
    rotations: readonly ZhudaSimQuat[];
    /** The way from each bone's joint to the next, in the bone's own space, a unit. */
    axes: readonly ZhudaSimVec3[];
    /** Each bone's length, metres. */
    lengths: readonly number[];
}
export interface ZhudaSpringChainOptions {
    /** How fast a bone comes back to where it points at rest, a second (default 10; 0 to 1000). 0: a rope. */
    stiffness?: number;
    /** How fast a joint loses its speed, a second (default 4; 0 to 100). */
    drag?: number;
    /** Metres a second a second (default 0, -9.81, 0). */
    gravity?: ZhudaSimVec3;
    /** How far outside a body a joint is kept, metres (default 0.02; 0 to 1). */
    radius?: number;
}
export interface ZhudaSpringBoneOptions {
    /** Seconds a step (default 1/120; 1/1000 to 1/10). */
    step?: number;
    /** The most steps one `advance` runs; time over that is dropped (default 8; 1 to 64). */
    maxSteps?: number;
}
export interface ZhudaSpringBoneReport {
    chains: number;
    bones: number;
    colliders: number;
    steps: number;
    dropped: number;
    pendingSeconds: number;
    /** Joints deeper inside a body than a tenth of a millimetre. */
    inside: number;
    /** Half the sum of the squares of the joints' speeds over the last step. */
    kineticEnergy: number;
}
/**
 * Chains of spring bones in motion. Each frame the owner says where each
 * chain hangs from (`setAnchor`), hands over the clock's delta (`advance`)
 * and reads each bone's rotation in the world (`rotations`).
 */
export declare class ZhudaSpringBoneSolver {
    readonly step: number;
    readonly maxSteps: number;
    private readonly clock;
    private readonly chains;
    private readonly bodies;
    private readonly tables;
    private readonly scratch;
    private next;
    private disposed;
    constructor(options?: ZhudaSpringBoneOptions);
    private alive;
    private chain;
    /** Adds a chain; returns a number to name it by. It is placed by its first `setAnchor`. */
    addChain(rest: ZhudaSpringChainRest, options?: ZhudaSpringChainOptions): number;
    removeChain(id: number): void;
    /**
     * Where a chain hangs from this frame: its first joint's place in the
     * world, and the rotation in the world of what that joint's bone is a
     * child of. The first time, the chain is laid out at rest there.
     */
    setAnchor(id: number, position: ZhudaSimVec3, parentRotation: ZhudaSimQuat): void;
    /** A chain put back at rest where it hangs now, still: after what it hangs from was put elsewhere at once. */
    reset(id?: number): void;
    private layOut;
    /** Each bone's rotation in the world (x, y, z, w), four numbers a bone, the first bone first. */
    rotations(id: number): Float64Array;
    /** Where each joint after the first is, three numbers each. */
    tails(id: number): Float64Array;
    addCollider(collider: ZhudaCollider): number;
    /** Puts another body in a body's place: it moved. */
    setCollider(id: number, collider: ZhudaCollider): void;
    removeCollider(id: number): void;
    /**
     * Takes a delta of the clock, in seconds, and runs the whole steps it
     * holds. Across those steps each chain's anchor goes evenly from where
     * it was at the last `advance` to where `setAnchor` put it. Zero changes
     * nothing.
     */
    advance(deltaSeconds: number): {
        steps: number;
        dropped: number;
    };
    private stepChain;
    /** How many joints are inside a body grown by their chain's radius by more than `tolerance` metres. */
    countInside(tolerance?: number): number;
    inspect(): ZhudaSpringBoneReport;
    dispose(): void;
}
