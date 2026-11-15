// Generated from TypeScript source; run npm run types:generate.
/**
 * Cloth: particles held apart by distance constraints, moved by Verlet
 * integration in fixed steps, kept out of bodies, hung from pins and pulled
 * by a hand. A game's cloth, not a measured fabric.
 *
 * Plain arithmetic: no LayaAir, no timer, no random numbers. Time comes in
 * as deltas of the engine's clock (`ZhudaRuntimeSession.layers`); the same
 * deltas give the same cloth to the last bit. `ZhudaCloth` (runtime3d)
 * draws one through a `ZhudaDynamicMesh`.
 */
import { type ZhudaCollider, type ZhudaSimVec3 } from './ParticleCore.js';
/** What a constraint holds: the weave (0), the weave's diagonals (1), or the cloth flat (2). */
export declare const ZHUDA_CLOTH_STRUCTURAL = 0;
export declare const ZHUDA_CLOTH_SHEAR = 1;
export declare const ZHUDA_CLOTH_BEND = 2;
/**
 * A span (3): two particles of one thread, several apart, that may come
 * nearer but get no farther apart than the thread between them is long.
 * It stretches nothing and holds nothing in shape; it passes a pull along
 * a thread several particles at a time, where the weave's own constraints
 * pass it one particle a round and leave a heavy cloth stretched.
 */
export declare const ZHUDA_CLOTH_SPAN = 3;
/** A cloth at rest: its particles, how they are held together, and the mesh that is drawn. */
export interface ZhudaClothShape {
    /** Three numbers a particle, metres. */
    particles: Float32Array;
    /** Pairs of particles kept a distance apart: `a[i]` and `b[i]` at `rest[i]` metres, of `kind[i]`. */
    constraints: {
        a: Uint32Array;
        b: Uint32Array;
        rest: Float32Array;
        kind: Uint8Array;
    };
    /** The drawn mesh: which particle each vertex is. A seam has two vertices for one particle. */
    particleOf: Uint32Array;
    /** Two numbers a vertex. */
    uvs: Float32Array;
    /** Triangles of vertices, front faces wound as `ZhudaDynamicMesh` draws them. */
    indices: Uint16Array;
    /** A grid's or a tube's particles across and down; absent for a cloth made from a mesh. */
    columns?: number;
    rows?: number;
}
export interface ZhudaClothGridOptions {
    /** Particles across, 2 to 256. */
    columns: number;
    /** Particles down, 2 to 256. */
    rows: number;
    /** Metres across and down. */
    width: number;
    height: number;
    /** Where the first particle (the top left corner) is. Default: the sheet's top edge centred on the origin. */
    origin?: ZhudaSimVec3;
    /** Which way the columns run (default +x) and which way the rows run (default -y: a sheet hanging down). */
    right?: ZhudaSimVec3;
    down?: ZhudaSimVec3;
}
/**
 * A flat sheet. Particle `row * columns + column`; row 0 is the top edge.
 * Its front faces `cross(right, -down)` (+z for a sheet hanging in x and y).
 */
export declare function createZhudaClothGrid(options: ZhudaClothGridOptions): ZhudaClothShape;
export interface ZhudaClothTubeOptions {
    /** Particles round, 4 to 256. */
    columns: number;
    /** Rings, 2 to 256. */
    rows: number;
    /** The middle of the first ring (a skirt's waist). */
    center: ZhudaSimVec3;
    /** Which way the rings follow one another (default -y: down). */
    axis?: ZhudaSimVec3;
    /** Where a ring's first particle is, seen from its middle (default +z). */
    forward?: ZhudaSimVec3;
    /** The first ring's radius and the last ring's, metres. */
    topRadius: number;
    bottomRadius: number;
    /** Metres from the first ring to the last, along the axis. */
    length: number;
}
/**
 * A tube closed round: a skirt, a sleeve, a lampshade. Particle `row *
 * columns + column`; its mesh has one more column of vertices, for the
 * seam. Its front faces outward.
 */
export declare function createZhudaClothTube(options: ZhudaClothTubeOptions): ZhudaClothShape;
export interface ZhudaClothMeshSource {
    /** Three numbers a vertex. */
    positions: ArrayLike<number>;
    /** Triangles. */
    indices: ArrayLike<number>;
    /** Two numbers a vertex; zeros when left out. */
    uvs?: ArrayLike<number>;
    /** Vertices nearer than this are one particle (a seam, a hard edge), metres. Default 1e-5. */
    weld?: number;
}
/**
 * A cloth from a mesh of one's own: every edge of a triangle is held at its
 * length, and across every edge two triangles share, the two far corners
 * are held apart (so the cloth resists folding). Vertices in one place
 * become one particle.
 */
export declare function createZhudaClothFromMesh(source: ZhudaClothMeshSource): ZhudaClothShape;
/** What is wrong with a shape, in words; empty when nothing is. Pure. */
export declare function validateZhudaClothShape(shape: unknown): string[];
export interface ZhudaClothOptions {
    /** Seconds a step (default 1/240: four steps a frame at sixty frames a second; 1/1000 to 1/10). */
    step?: number;
    /** How many times a step goes over the constraints (default 2; 1 to 32). Smaller steps do more for a stiff cloth than more rounds. */
    rounds?: number;
    /** The most steps one `advance` runs; time over that is dropped (default 8, a thirtieth of a second; 1 to 64). */
    maxSteps?: number;
    /** Metres a second a second (default 0, -9.81, 0). */
    gravity?: ZhudaSimVec3;
    /** How fast a particle loses its speed whichever way it moves: the share it keeps after a second is `exp(-drag)` (default 1; 0 to 20). */
    drag?: number;
    /**
     * How much each kind of constraint gives: 0 is as stiff as the rounds
     * make it, more is softer. Defaults: structural 0, shear 3e-4, bend 2e-4
     * (0 to 1). A woven cloth gives little along its threads and much across
     * them: with a stiff shear a sheet behaves like a sheet of paper.
     */
    compliance?: {
        structural?: number;
        shear?: number;
        bend?: number;
    };
    /** How far outside a body the cloth is kept, metres (default 0.01; 0 to 0.5). */
    thickness?: number;
    /**
     * How well the cloth grips a body it lies on (default 0.5; 0 to 4): it
     * stays on a slope whose rise over its run is less than this, and slides
     * on a steeper one.
     */
    friction?: number;
    /** The fastest a particle moves, metres a second (default 6; 0.1 to 100). See `ZhudaClothSolver` on thin bodies. */
    maxSpeed?: number;
    /** The air's velocity, metres a second (default none). */
    wind?: ZhudaSimVec3;
    /**
     * How hard the air that meets the cloth face on pushes it, a second
     * (default 2; 0 for no air; 0 to 50). It is what a wind blows a cloth
     * with, and what stops a cloth swinging: still air resists a cloth that
     * moves face on, and lets it slide edge on.
     */
    windDrag?: number;
    /**
     * How much farther from the pin it hangs from a particle may get than
     * the cloth between them is long, as a share (default 0.02; 0 to 1; false
     * for no such limit). Without it a cloth hung from few pins stretches
     * like rubber where it hangs: the rounds of a step pass a pull along
     * only a few particles at a time.
     */
    tether?: number | false;
    /** The fastest a hand that holds a particle moves, metres a second (default 10; 0.1 to 100). */
    grabSpeed?: number;
    /**
     * How far ahead of the cloth a hand may get, as a share of the weave's
     * spacing at the particle it holds (default 0.1; 0.01 to 2). A hand
     * pulls the particle to itself outright; held back to this, it cannot
     * tear the particle away from its neighbours faster than the weave
     * passes the pull on. Where the threads at the particle are stretched by
     * more than a twentieth (the cloth is taut) the hand's lead is cut, step
     * by step, to a sixty-fourth of this: a hand asked to go where the cloth
     * cannot reach waits at the cloth.
     */
    grabStretch?: number;
}
export interface ZhudaClothResolved {
    step: number;
    rounds: number;
    maxSteps: number;
    gravity: [number, number, number];
    drag: number;
    compliance: {
        structural: number;
        shear: number;
        bend: number;
    };
    thickness: number;
    friction: number;
    maxSpeed: number;
    wind: [number, number, number];
    windDrag: number;
    tether: number | false;
    grabSpeed: number;
    grabStretch: number;
}
/** A cloth's options with their defaults. Throws, with the name, on one out of range or unknown. Pure. */
export declare function resolveZhudaClothOptions(options?: ZhudaClothOptions): ZhudaClothResolved;
export interface ZhudaClothReport {
    particles: number;
    constraints: number;
    triangles: number;
    colliders: number;
    pinned: number;
    grabbed: number;
    /** Steps run and steps dropped since the cloth was made or reset. */
    steps: number;
    dropped: number;
    /** Seconds of the clock gathered and not yet spent. */
    pendingSeconds: number;
    /** Particles deeper inside a body than a tenth of a millimetre. Pins are counted too. */
    inside: number;
    /** The most any weave constraint is longer than its rest length, as a share of it. */
    maxStretch: number;
    /** Half the sum of the squares of the particles' speeds (masses of one). */
    kineticEnergy: number;
    /** The smallest body radius a particle cannot cross in one step: `maxSpeed * step`. */
    safeRadius: number;
}
/**
 * A cloth in motion.
 *
 * Each step: every free particle keeps its motion (less the air's drag),
 * takes gravity and the wind, and moves, no faster than `maxSpeed`; then
 * `rounds` times the constraints pull particles back to their distances
 * and the bodies push them out; the bodies have the last word, so a step
 * ends with no particle inside one. A particle is tested where it is, not
 * along its path: it cannot cross a body whose radius is more than
 * `maxSpeed * step` (2.5 cm by default); a thinner body may be crossed by a
 * fast cloth, and `inspect().safeRadius` says where the line is.
 *
 * Positions are in one space, the world's unless the cloth's owner says
 * otherwise; bodies and pins are given in the same space and may be moved
 * between steps.
 */
export declare class ZhudaClothSolver {
    readonly shape: ZhudaClothShape;
    readonly options: ZhudaClothResolved;
    /** Where each particle is: three numbers each. Read it; write through `pin`, `movePin`, `reset`. */
    readonly positions: Float32Array;
    /** Where each particle was a step ago. */
    readonly previous: Float32Array;
    /** How far each particle's weave is stretched, as a share of its rest length; filled by `measureStrain`. */
    readonly strain: Float32Array;
    readonly count: number;
    private readonly clock;
    private readonly inverseMass;
    private readonly lambda;
    private readonly alpha;
    private readonly triangles;
    private readonly air;
    private readonly facing;
    private readonly touched;
    /** How far the bodies have pushed each particle back this step: how hard it presses on them. */
    private readonly pressed;
    private readonly normal;
    private readonly scratch;
    private readonly bodies;
    /** Each table worked out for the step: its slopes, its widest radius. */
    private readonly tables;
    private nextBody;
    /** A hand's hold on a particle: where the hand is, where it wants to be, and what its hold has done this step. */
    private readonly hands;
    private readonly structuralCount;
    /** For each particle: the pin it hangs from (-1: none) and how far from it it may get. */
    private readonly anchor;
    private readonly leash;
    private tethersStale;
    /** Rounds run in all: odd ones go over the constraints backwards. */
    private sweeps;
    /** The weave as a graph, for finding how much cloth lies between a particle and a pin. */
    private readonly neighbours;
    private disposed;
    constructor(shape: ZhudaClothShape, options?: ZhudaClothOptions);
    /**
     * For every particle, the pin with the least cloth between them and how
     * much that is: the shortest way along the weave and its diagonals, which
     * is never shorter than the cloth itself, so the limit never forbids a
     * shape the cloth could take. Worked out again when a pin is set or let
     * go, not when one is moved.
     */
    private tether;
    private alive;
    private particle;
    /** How much each kind of constraint gives, from now on. */
    setCompliance(compliance: {
        structural?: number;
        shear?: number;
        bend?: number;
    }): void;
    setGravity(x: number, y: number, z: number): void;
    /** The air's velocity and how hard it pushes, from now on. */
    setWind(x: number, y: number, z: number, windDrag?: number): void;
    /**
     * Holds a particle where it is, or at a place. It no longer falls, and
     * no body moves it.
     */
    pin(index: number, at?: ZhudaSimVec3): void;
    /**
     * Moves a pinned particle: with what it hangs from, each frame, a little
     * at a time. For a jump, `shift` the cloth.
     */
    movePin(index: number, x: number, y: number, z: number): void;
    unpin(index: number): void;
    isPinned(index: number): boolean;
    /**
     * A hand takes hold of a particle where it is. `dragTo` then says where
     * the hand wants to be; it goes there no faster than `grabSpeed`, and
     * the particle follows as far as the cloth lets it.
     */
    grab(index: number): void;
    dragTo(index: number, x: number, y: number, z: number): void;
    /** The hand lets go; the particle keeps the motion it had. */
    release(index: number): void;
    isGrabbed(index: number): boolean;
    /** Where the hand that holds a particle is now. */
    handOf(index: number): [number, number, number];
    /**
     * The particle a ray (a pointer's, from the camera) would touch: of the
     * layer of cloth it comes to first, the particle it passes closest to; -1
     * when none is within `reach` metres of it. `direction` need not be a
     * unit.
     */
    nearestToRay(origin: ZhudaSimVec3, direction: ZhudaSimVec3, reach?: number): number;
    /** Adds a body the cloth is kept out of; returns a number to move or remove it by. */
    addCollider(collider: ZhudaCollider): number;
    /** Puts another body in a body's place (it moved, it changed shape). */
    setCollider(id: number, collider: ZhudaCollider): void;
    removeCollider(id: number): void;
    get colliders(): ReadonlyMap<number, ZhudaCollider>;
    /**
     * Takes a delta of the clock, in seconds, and runs the whole steps it
     * holds with what was left over before. Zero changes nothing. Returns
     * how many steps ran and how many were dropped for being over the cap.
     */
    advance(deltaSeconds: number): {
        steps: number;
        dropped: number;
    };
    /**
     * Carries the whole cloth somewhere else as it is: every particle, pin
     * and hand moved by the same amount, its motion kept. For when what it
     * hangs from is put elsewhere at once (a character set down at another
     * place): pins moved far in one frame would throw the cloth after them.
     * The bodies are their owner's to move.
     */
    shift(x: number, y: number, z: number): void;
    /** Back to the shape it was made in, at rest; pins, hands and bodies stay. */
    reset(): void;
    private stepOnce;
    /**
     * No hand farther from the particle it holds than its lead. After a
     * step the lead is set for the next one: halved where the threads at the
     * particle are stretched by more than a twentieth (the cloth is taut:
     * pulling harder would only stretch the weave at the hand), grown again
     * where they are not. So a hand moves a slack cloth briskly and waits at
     * a taut one.
     */
    private leashHands;
    /**
     * Pushes every free particle out of every body; says whether any was
     * moved. A floor, a ball and a rod are worked out here, over all the
     * particles at once, by the arithmetic `zhudaColliderDepth` does a point
     * at a time (the two are held to each other by `countInside`, which asks
     * it); a table is asked there.
     */
    private pushOut;
    /** Each table worked out as it is now (a body may have been moved or changed since the last step). */
    private prepareTables;
    /**
     * How many particles are inside a body by more than `tolerance` metres
     * (default a tenth of a millimetre; single precision moves a particle put
     * on a surface by less). `margin` is how far outside the body the surface
     * counted from is: the cloth's thickness by default, 0 for the body
     * itself. Pins are counted.
     */
    countInside(tolerance?: number, margin?: number): number;
    /**
     * Fills `strain` with how far each particle's weave is stretched (the
     * mean over its structural constraints of how much longer than its rest
     * length each is, as a share; 0 where it is slack) and returns the most
     * any one constraint is stretched.
     */
    measureStrain(): number;
    inspect(): ZhudaClothReport;
    /** Lets go of everything; the cloth takes no more calls. */
    dispose(): void;
}
