// Generated from TypeScript source; run npm run types:generate.
/**
 * What cloth and spring bones share: a fixed step fed by the engine's clock,
 * and bodies a particle is kept out of. Plain arithmetic on numbers and typed
 * arrays: no LayaAir, no timer of its own, no random numbers. The same
 * deltas give the same result, to the last bit.
 */
export type ZhudaSimVec3 = readonly [number, number, number];
/** A ball. */
export interface ZhudaSphereCollider {
    type: 'sphere';
    center: [number, number, number];
    radius: number;
}
/** A rod with round ends: every point within `radius` of the line from `a` to `b`. */
export interface ZhudaCapsuleCollider {
    type: 'capsule';
    a: [number, number, number];
    b: [number, number, number];
    radius: number;
}
/**
 * A body turned about an axis whose radius is looked up by height and by
 * angle: a leg, a torso, a vase. `radii` holds `rows` rings of `columns`
 * radii, the ring at the foot of the axis first; a ring's first radius is in
 * the direction `forward` and the rest go round toward `cross(axis,
 * forward)`. Between the table's values the radius is interpolated. The two
 * ends are closed flat.
 */
export interface ZhudaTableCollider {
    type: 'table';
    /** The foot of the axis. */
    origin: [number, number, number];
    /** Along the body, a unit. */
    axis: [number, number, number];
    /** Where the angle is zero: a unit, square to the axis. */
    forward: [number, number, number];
    /** How far along the axis the table reaches, metres. */
    height: number;
    /** Rings, two or more, evenly from the foot to `height`. */
    rows: number;
    /** Radii a ring, three or more, evenly round (the last meets the first). */
    columns: number;
    /** `rows` times `columns` radii, metres. */
    radii: ArrayLike<number>;
}
/** A flat floor or wall without end: everything behind `point`, seen along `normal`, is inside. */
export interface ZhudaPlaneCollider {
    type: 'plane';
    /** Any point of the surface. */
    point: [number, number, number];
    /** Out of the body, a unit. */
    normal: [number, number, number];
}
export type ZhudaCollider = ZhudaSphereCollider | ZhudaCapsuleCollider | ZhudaTableCollider | ZhudaPlaneCollider;
/** What is wrong with a collider, in words; empty when nothing is. Pure. */
export declare function validateZhudaCollider(collider: unknown, path?: string): string[];
/**
 * A collider's radius at a height and an angle, as the collision reads it:
 * for drawing the same body, or for checking a table. `height` is clamped
 * to the table, `angle` (radians, from `forward` toward `cross(axis,
 * forward)`) goes round.
 */
export declare function zhudaTableRadius(table: ZhudaTableCollider, height: number, angle: number): number;
/**
 * What is worked out once about a table for asking about many points: its
 * widest radius, and how its radius changes with height and round the body
 * at each of its own values.
 */
export interface ZhudaTablePrepared {
    reach: number;
    byHeight: Float32Array;
    byAngle: Float32Array;
}
/**
 * Works a table out for `zhudaColliderDepth`. `into` is filled again when
 * it is the right size (a body that moves or changes every frame makes no
 * garbage). The answer for a point is the same with it and without.
 */
export declare function prepareZhudaTable(table: ZhudaTableCollider, into?: ZhudaTablePrepared): ZhudaTablePrepared;
/**
 * How deep a point is inside a collider grown by `margin` (more than 0:
 * inside), and the way out. A table is grown square to its surface, as a
 * ball is: on a shoulder the margin is upward as much as outward; its depth
 * by its side is measured square to its surface, to the first order (the
 * surface is curved; whether a point is inside is exact). `out` receives
 * where the point is put (0..2: on the grown surface, or a hair outside a
 * table's) and the direction it was pushed in, a unit (3..5); it is written
 * only when the point is inside. No allocation. `prepared` is a table
 * worked out beforehand (`prepareZhudaTable`), for callers that ask about
 * many points; the answer is the same without it.
 */
export declare function zhudaColliderDepth(collider: ZhudaCollider, margin: number, x: number, y: number, z: number, out?: Float32Array | Float64Array | number[], prepared?: ZhudaTablePrepared): number;
/** A table's widest radius. */
export declare function zhudaTableReach(table: ZhudaTableCollider): number;
export interface ZhudaFixedStepOptions {
    /** Seconds a step. */
    step: number;
    /** The most steps one call may ask for; time over that is dropped. */
    maxSteps: number;
}
/**
 * Gathers the clock's deltas and hands them out in whole steps. What is
 * left of a delta waits for the next one. A delta that holds more steps
 * than `maxSteps` is not caught up with: the steps over the cap are
 * dropped, so a long gap (a lost focus, a breakpoint) moves the simulation
 * by the cap and no further.
 */
export declare class ZhudaFixedStep {
    readonly step: number;
    readonly maxSteps: number;
    /** Steps handed out in all. */
    steps: number;
    /** Steps dropped in all. */
    dropped: number;
    private pending;
    constructor(options: ZhudaFixedStepOptions);
    /** Takes a delta in seconds; returns how many steps to run now. */
    take(deltaSeconds: number): number;
    /** How far into the next step the gathered time is, 0..1. */
    get alpha(): number;
    /** Seconds gathered and not yet spent. */
    get pendingSeconds(): number;
    reset(): void;
}
