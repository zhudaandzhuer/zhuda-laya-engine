// Generated from TypeScript source; run npm run types:generate.
/**
 * The distance to a surface, kept only near it: a camera or a character asks
 * how far the rock is, which way is out, where a ray or a moving sphere
 * first meets it. What it does then (slide, stop, take damage) is the
 * consumer's rule.
 *
 * The region `min..max` is cut into bricks of 4 × 4 × 4 samples `cellSize`
 * apart (three cells a side; neighbouring bricks share their border
 * samples, so the field is continuous). A brick the surface comes within
 * `band` of keeps its 64 distances as signed bytes, `band / 127` a step; any
 * other brick keeps only whether it is inside or outside. A query between
 * samples is trilinear. Beyond `band` from the surface a query says `band`
 * (or `-band` inside): at least that far. Outside the region there is no
 * data and a query says `band` (empty).
 *
 * The field is a distance (negative inside, growing no faster than the way
 * travelled), or a density volume (`computeZhudaDensityVolume`).
 */
import type { ZhudaDensityVolume } from '../procedural/Isosurface.js';
import type { QueryProvider } from './SceneQueries.js';
type V3 = [number, number, number];
export interface ZhudaDistanceBricksOptions {
    /** The distance at a point, negative inside. */
    distance?: (x: number, y: number, z: number) => number;
    /** Or values on a grid, interpolated. */
    volume?: ZhudaDensityVolume;
    /** The region kept. */
    min: V3;
    max: V3;
    /** Metres between samples. */
    cellSize: number;
    /** How far from the surface distances are kept, in metres (default 4 cells). */
    band?: number;
}
export interface ZhudaBrickHit {
    /** Along the ray, or along the sweep from `from`, in metres. */
    distance: number;
    /** Where the ray meets the surface, or where the sphere's centre is at contact. */
    position: V3;
    /** Out of the surface there. */
    normal: V3;
}
/** Lists what is wrong with the options; empty when they can be used. */
export declare function validateZhudaDistanceBricks(options: ZhudaDistanceBricksOptions): string[];
export declare class ZhudaDistanceBricks {
    readonly min: V3;
    readonly max: V3;
    readonly cellSize: number;
    readonly band: number;
    /** Bricks along x, y and z. */
    readonly bricks: [number, number, number];
    /** For each brick: its slot in `data`, or -1 (all outside), -2 (all inside). */
    private readonly directory;
    /** 64 signed bytes a kept brick. */
    private readonly data;
    private readonly scale;
    private constructor();
    /** Samples the field near its surface and keeps it as bricks. Synchronous. */
    static build(options: ZhudaDistanceBricksOptions): ZhudaDistanceBricks;
    /** Bricks kept with distances, and all bricks. */
    get stats(): {
        kept: number;
        total: number;
        bytes: number;
        denseBytes: number;
    };
    /** Whether a point is inside the region the bricks cover. */
    contains(x: number, y: number, z: number): boolean;
    /** The distance to the surface (negative inside), within `band`; `±band` beyond it; `band` outside the region. */
    distance(x: number, y: number, z: number): number;
    /** Out of the surface at a point: the slope of the kept distance, unit length (up where it is flat). */
    normal(x: number, y: number, z: number): V3;
    /**
     * Where a ray from `origin` along `direction` (any length; it is made unit)
     * first meets the surface, within `maxDistance`; null if it does not. A
     * ray that starts inside meets it at 0.
     */
    raycast(origin: V3, direction: V3, maxDistance?: number): ZhudaBrickHit | null;
    /**
     * Where a sphere of `radius` moving from `from` to `to` first touches the
     * surface: its centre then, the distance travelled, the normal at the
     * nearest surface point. Null if it reaches `to` untouched; distance 0
     * when it already touches at `from`. `radius` must be below `band`.
     */
    sweepSphere(from: V3, to: V3, radius: number): ZhudaBrickHit | null;
    private march;
    /**
     * A provider for `ZhudaSceneQueries`: its rays and sweeps answered by these
     * bricks, so `resolveCameraBoom` and the game's own queries see the
     * surface. The consumer registers it, and decides what a hit means.
     */
    queryProvider(entityId: string, options?: {
        layer?: number;
    }): QueryProvider;
}
export {};
