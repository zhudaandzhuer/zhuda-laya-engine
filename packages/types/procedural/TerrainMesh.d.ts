// Generated from TypeScript source; run npm run types:generate.
/**
 * A piece of ground with heights, as plain mesh data: a grid over a
 * rectangle, each corner at its own height, from numbers given or from
 * fractal noise. Texture coordinates are in metres seen from above (lay a
 * recipe with `projection: 'triplanar'` where the ground is steep). Pure.
 *
 * It is one mesh of at most 255 by 255 corners; for streamed ground that
 * can be edited use `ZhudaTerrain3D`. No caves or overhangs: those are
 * meshes of their own.
 */
import type { MeshData } from '../runtime3d/Surfaces.js';
export interface ZhudaTerrainMeshOptions {
    /** Width (X) and depth (Z) in metres; the piece is centred on its origin. */
    size: [number, number];
    /** Cells along X and Z, 1..254 each. */
    cells: [number, number];
    /**
     * Heights in metres, a corner each: `(cells[0] + 1) * (cells[1] + 1)`
     * numbers, row by row from -Z to +Z, each row from -X to +X.
     */
    heights?: ArrayLike<number>;
    /**
     * Or heights from fractal noise: up to `heightM` high, hills about
     * `scaleM` across, the same for the same `seed`. `ridged` folds the noise
     * into ridges; `flatten` are rectangles pressed level (a building plot, a
     * road), each `{minX, maxX, minZ, maxZ, y, marginM}` in the piece's own
     * metres, eased in over `marginM` (default 4).
     */
    noise?: {
        seed?: number;
        heightM: number;
        scaleM: number;
        ridged?: boolean;
        flatten?: {
            minX: number;
            maxX: number;
            minZ: number;
            maxZ: number;
            y: number;
            marginM?: number;
        }[];
    };
}
/** What is wrong with the options, each issue a line; empty when they are sound. */
export declare function validateZhudaTerrainMesh(options: ZhudaTerrainMeshOptions): string[];
/** The heights of every corner, row by row from -Z, as the mesh uses them. Pure. */
export declare function zhudaTerrainHeights(options: ZhudaTerrainMeshOptions): Float32Array;
/**
 * The height of the ground at a place of the piece's own metres, between the
 * corners as the mesh's two triangles a cell lie; null outside the piece.
 */
export declare function zhudaTerrainHeightAt(heights: ArrayLike<number>, size: readonly [number, number], cells: readonly [number, number], x: number, z: number): number | null;
/** The mesh: positions, smooth normals, texture coordinates in metres, clockwise fronts facing up. */
export declare function createZhudaTerrainMesh(options: ZhudaTerrainMeshOptions): MeshData;
