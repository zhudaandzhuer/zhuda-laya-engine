import { type Vec3 } from "../runtime3d/Math3D";
import type { QueryRay } from "../runtime3d/SceneQueries";
export interface HeightfieldSpec {
    schemaVersion: 1;
    dimension: 3;
    cellsX: number;
    cellsZ: number;
    cellSize: number;
    origin?: [number, number];
    heights: number[];
}
export interface HeightRegion {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
}
export declare function validateHeightfield(spec: unknown): string[];
/** Integer hash-based smooth noise; no global random state. */
export declare function terrainNoise(seed: number, x: number, z: number): number;
export declare class ZhudaHeightfield {
    readonly cellsX: number;
    readonly cellsZ: number;
    readonly cellSize: number;
    readonly origin: readonly [number, number];
    private heights;
    private listeners;
    constructor(spec: HeightfieldSpec);
    static generate(options: {
        cellsX: number;
        cellsZ: number;
        cellSize: number;
        origin?: [number, number];
        seed: number;
        amplitude?: number;
        frequency?: number;
    }): ZhudaHeightfield;
    private index;
    heightAtVertex(x: number, z: number): number;
    normalAtVertex(x: number, z: number): Vec3;
    setHeight(x: number, z: number, height: number): void;
    applyPatch(x: number, z: number, width: number, depth: number, values: ArrayLike<number>): void;
    brush(x: number, z: number, radius: number, delta: number): void;
    private emit;
    onChange(f: (r: HeightRegion) => void): () => boolean;
    /** Exact same diagonal and barycentric interpolation as rendered triangles. */
    sample(x: number, z: number, stride?: 1 | 2 | 4): {
        height: number;
        normal: Vec3;
        cellX: number;
        cellZ: number;
    } | null;
    /** Local ray direction may be unnormalized, preserving world-distance parameter after inverse transform. */
    raycast(ray: QueryRay, maxDistance?: number, stride?: 1 | 2 | 4, acceptCell?: (x: number, z: number) => boolean): {
        distance: number;
        position: {
            x: number;
            y: number;
            z: number;
        };
        normal: Vec3;
        cellX: number;
        cellZ: number;
    } | null;
    toJSON(): HeightfieldSpec;
}
