// Generated from TypeScript source; run npm run types:generate.
import type { Vec3 } from './Math3D.js';
import type { QueryProvider } from './SceneQueries.js';
/** A solid thing on the ground: an axis-aligned box, or an upright cylinder. World units. */
export type ZhudaSolid = {
    kind: 'box';
    min: Vec3;
    max: Vec3;
} | {
    kind: 'cylinder';
    center: {
        x: number;
        z: number;
    };
    radius: number;
    minY: number;
    maxY: number;
};
export interface ZhudaGroundPoint {
    x: number;
    z: number;
}
export interface ZhudaWalkGridOptions {
    /** The rectangle of ground the grid covers. */
    min: ZhudaGroundPoint;
    max: ZhudaGroundPoint;
    /** Cell size in metres. A quarter to a half of the walker's width is usual. */
    cell: number;
    /** The ground's height at a point, or null where there is none. Default: flat at 0. */
    ground?: (x: number, z: number) => number | null;
    solids?: readonly ZhudaSolid[];
    /** The walker: how wide (radius), how tall, and how high a step it takes. */
    radius?: number;
    height?: number;
    maxStep?: number;
    /** One more rule of the game's: true where nobody may stand. */
    blocked?: (x: number, z: number) => boolean;
}
export interface ZhudaWalkGrid {
    readonly columns: number;
    readonly rows: number;
    readonly cell: number;
    readonly min: ZhudaGroundPoint;
    readonly maxStep: number;
    /** How many cells can be stood in. */
    readonly walkableCells: number;
    cellOf(x: number, z: number): {
        column: number;
        row: number;
    } | null;
    centerOf(column: number, row: number): ZhudaGroundPoint;
    walkable(column: number, row: number): boolean;
    /** The ground's height at a cell's middle (NaN where there is no ground). */
    heightOf(column: number, row: number): number;
    isWalkable(x: number, z: number): boolean;
    /** The middle of the nearest cell that can be stood in, within `maxDistance` metres, or null. */
    nearestWalkable(x: number, z: number, maxDistance?: number): ZhudaGroundPoint | null;
}
export interface ZhudaPathOptions {
    /** Take out the corners a straight run can skip (default true). */
    smooth?: boolean;
    /** Give up after visiting this many cells (default: every cell). */
    maxVisited?: number;
}
export interface ZhudaPath {
    found: boolean;
    /** From the start to the goal, both as given; empty when not found. */
    points: ZhudaGroundPoint[];
    /** Metres along the points. */
    length: number;
    /** Cells looked at: what the search cost. */
    visited: number;
}
/** How far a point on the ground plane is from a solid's footprint (0 inside it). */
export declare function zhudaSolidDistance(solid: ZhudaSolid, x: number, z: number): number;
/**
 * Whether a solid stands in the way of something whose feet are at `feet` and whose top is
 * `height` above them: it must rise above a step from the feet and start below the top.
 */
export declare function zhudaSolidBlocks(solid: ZhudaSolid, feet: number, height: number, maxStep: number): boolean;
export declare function createZhudaWalkGrid(options: ZhudaWalkGridOptions): ZhudaWalkGrid;
/** Whether a straight run from `a` to `b` stays on cells that can be stood in, with no step too high. */
export declare function zhudaWalkLineClear(grid: ZhudaWalkGrid, a: ZhudaGroundPoint, b: ZhudaGroundPoint): boolean;
/**
 * The shortest way over the grid from `from` to `to` (A* over eight neighbours, no cutting of
 * corners), with the corners a straight run can skip taken out. Both ends must be in cells that
 * can be stood in: use `grid.nearestWalkable` first for a point that may not be.
 */
export declare function findZhudaPath(grid: ZhudaWalkGrid, from: ZhudaGroundPoint, to: ZhudaGroundPoint, options?: ZhudaPathOptions): ZhudaPath;
/**
 * The same solids as something a ray can hit, for `ZhudaSceneQueries` (and so for
 * `resolveCameraBoom`): the camera then keeps clear of what the character cannot walk through.
 */
export declare function zhudaSolidQueryProvider(solids: readonly ZhudaSolid[], entityId?: string, layer?: number): QueryProvider;
