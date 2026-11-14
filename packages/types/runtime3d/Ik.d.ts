// Generated from TypeScript source; run npm run types:generate.
/**
 * Bones bent to reach a point, after the animation has posed them: a foot
 * set on sloping ground, a hand on a rail, a head turned to what it looks
 * at. Three solvers, each plain arithmetic on points (so each can be
 * checked without a runtime), and one class a solver that applies it to
 * LayaAir nodes:
 *
 * - two bones (hip, knee, foot): the exact answer, with a pole the knee
 *   bends toward;
 * - a chain of any length (FABRIK): reached by steps, the root fixed;
 * - an aim: a bone turned to point at something, by at most an angle.
 *
 * Each is blended with the animated pose by a weight, 0..1. They change
 * world rotations only; bone lengths are never changed.
 */
/** A point or a direction in the world: x, y, z. */
export type ZhudaIkPoint = readonly [number, number, number];
/** A turn as a quaternion: x, y, z, w. */
export type ZhudaIkTurn = readonly [number, number, number, number];
/** `a * b`: the turn `b`, then the turn `a`. */
export declare function zhudaQuatMultiply(a: ZhudaIkTurn, b: ZhudaIkTurn): [number, number, number, number];
/** A direction turned by a quaternion. */
export declare function zhudaQuatRotate(q: ZhudaIkTurn, v: ZhudaIkPoint): [number, number, number];
/** The shortest turn that takes direction `from` to direction `to` (neither need be a unit). */
export declare function zhudaQuatFromTo(from: ZhudaIkPoint, to: ZhudaIkPoint): [number, number, number, number];
/** Part of a turn: `weight` 0 is no turn, 1 the whole of it. */
export declare function zhudaQuatScale(q: ZhudaIkTurn, weight: number): [number, number, number, number];
export interface ZhudaTwoBoneSolution {
    /** Where the middle joint goes. */
    mid: [number, number, number];
    /** Where the end goes: the target, or as near as the bones reach. */
    end: [number, number, number];
    /** False when the target is further than the two bones are long, or nearer than their difference. */
    reached: boolean;
    /** The turn of the first bone, in the world: its new rotation is this times its old one. */
    rootTurn: [number, number, number, number];
    /** The turn of the second bone, in the world, after it has gone with the first. */
    midTurn: [number, number, number, number];
}
/**
 * Two bones, `root` to `mid` to `end`, bent so that `end` is at `target`.
 * The middle joint bends toward `pole` (a point; default: the way it is
 * bent now, so an animated knee keeps its side). Bone lengths are kept: a
 * target out of reach is pointed at with the bones almost straight.
 */
export declare function zhudaSolveTwoBone(root: ZhudaIkPoint, mid: ZhudaIkPoint, end: ZhudaIkPoint, target: ZhudaIkPoint, pole?: ZhudaIkPoint): ZhudaTwoBoneSolution;
/**
 * A chain of joints reaching for `target` with its first joint fixed
 * (FABRIK): from the end back and from the root forward, until the end is
 * within `tolerance` or `iterations` are used up. Lengths are kept. Returns
 * the joints' new places; the input is not changed.
 */
export declare function zhudaSolveChain(joints: readonly ZhudaIkPoint[], target: ZhudaIkPoint, iterations?: number, tolerance?: number): {
    joints: [number, number, number][];
    reached: boolean;
    error: number;
};
/**
 * The turn that points a bone at something: `forward` is the way the bone
 * faces now, in the world; `from` where it is; `target` what it should face.
 * The turn is at most `maxDeg` (default 180) and `weight` of the way.
 */
export declare function zhudaAimTurn(forward: ZhudaIkPoint, from: ZhudaIkPoint, target: ZhudaIkPoint, maxDeg?: number, weight?: number): [number, number, number, number];
/**
 * A limb of two bones on LayaAir nodes: `root` (a hip), `mid` (a knee,
 * below `root`) and `end` (a foot, below `mid`). Call `solve` after the
 * animation has posed the frame; the next frame's animation starts from
 * its own pose again.
 */
export declare class ZhudaTwoBoneIK {
    private readonly nodes;
    constructor(root: any, mid: any, end: any);
    /**
     * Bends the limb so its end is at `target` (world). `pole`: a world point
     * the middle joint bends toward. `weight` 0..1: how far from the animated
     * pose toward the target (default 1). Returns whether the target was
     * within reach and where the end went.
     */
    solve(target: ZhudaIkPoint, options?: {
        pole?: ZhudaIkPoint;
        weight?: number;
    }): {
        reached: boolean;
        end: [number, number, number];
    };
}
/** A chain of nodes, each below the one before, reaching for a point with the first fixed. */
export declare class ZhudaChainIK {
    private readonly nodes;
    constructor(nodes: readonly any[]);
    solve(target: ZhudaIkPoint, options?: {
        weight?: number;
        iterations?: number;
        tolerance?: number;
    }): {
        reached: boolean;
        error: number;
    };
}
/** A node turned to face a point: a head, an eye, a turret. */
export declare class ZhudaAimIK {
    private readonly node;
    private readonly forward;
    /** @param forward the way the node faces, in its own space (default -Z, LayaAir's forward). */
    constructor(node: any, forward?: ZhudaIkPoint);
    /** Turns the node toward `target` (world), by at most `maxDeg` from the animated pose and `weight` of the way. */
    solve(target: ZhudaIkPoint, options?: {
        maxDeg?: number;
        weight?: number;
    }): void;
}
/**
 * Calls `solve` every frame once LayaAir's own animation has posed the
 * scene and before the skin is worked out: the place for a solver while a
 * clip plays by itself. LayaAir poses the bones again every frame, after
 * scripts' `onUpdate` and `onLateUpdate` (a solve made there is undone),
 * and works out the skin before `onPreRender` (a solve made there moves
 * the bones but not the mesh). Returns a function that stops it; it also
 * stops when `node` is destroyed. With `ZhudaModelAnimationSampler` or
 * `ZhudaAnimationBlend` posing the model, solve right after them instead.
 */
export declare function runZhudaAfterAnimation(node: any, solve: () => void): () => void;
