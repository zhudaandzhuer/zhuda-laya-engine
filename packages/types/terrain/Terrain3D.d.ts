// Generated from TypeScript source; run npm run types:generate.
export type Terrain3DOptions = {
    parent?: any;
    material: any;
    chunkCells?: number;
    maxResidentChunks?: number;
    uvScale?: [number, number];
    /**
     * Gives every vertex a tangent, which a material with a normal map needs:
     * without it the map has no effect on the ground. Vertices then hold 12
     * floats instead of 8 (see `chunkSnapshot().stride`). The tangent follows
     * the ground along the direction u grows, so it is the same on both sides
     * of a chunk border.
     */
    tangents?: boolean;
    /** Optional closed volume, extruded along local -Y. Material is borrowed. */
    solid?: {
        depth: number;
        material?: any;
    };
};
import { ZhudaHeightfield, type HeightRegion } from './Heightfield.js';
import { type Vec3 } from '../runtime3d/Math3D.js';
import type { QueryRay, QueryProvider } from '../runtime3d/SceneQueries.js';
/** Resident heightfield chunks. The supplied material is borrowed; dispose releases only terrain meshes/nodes. */
export declare class ZhudaTerrain3D {
    readonly field: ZhudaHeightfield;
    readonly options: Terrain3DOptions;
    readonly root: any;
    private chunks;
    private unsubscribe;
    private disposed;
    private stride;
    /** Which way the tangent runs along X and its handedness, taken from the mesh helper's own convention. */
    private readonly tangentSign;
    constructor(field: ZhudaHeightfield, options: Terrain3DOptions);
    /** Local x/z bounds; uniform stride avoids neighboring chunks with incompatible edge LODs. */
    setRegion(region: HeightRegion, stride?: 1 | 2 | 4): void;
    private vertex;
    private rebuildShell;
    flush(): void;
    sampleLocal(x: number, z: number): {
        height: number;
        normal: Vec3;
        cellX: number;
        cellZ: number;
    } | null;
    private chunkKeyForCell;
    private raycastLocal;
    raycast(ray: QueryRay, maxDistance?: number): {
        distance: number;
        position: Vec3;
        normal: Vec3;
        cellX: number;
        cellZ: number;
    } | null;
    queryProvider(entityId: string, layer?: number): QueryProvider;
    report(): {
        residentChunks: number;
        renderMeshes: number;
        solidDepth: number;
        stride: 4 | 1 | 2;
        vertices: number;
        estimatedBufferBytes: number;
    };
    /** Diagnostic copy prevents callers from accidentally bypassing edits/dirty propagation. */
    chunkSnapshot(key: string): {
        xs: number[];
        zs: number[];
        vertices: Float32Array<ArrayBuffer>;
        /** Floats per vertex: position 3, normal 3, UV 2, and a tangent 4 when the terrain has them. */
        stride: number;
        bounds: any;
        shell: {
            vertices: Float32Array<ArrayBuffer>;
            indices: Uint16Array<ArrayBuffer>;
            bounds: any;
        } | null;
    } | null;
    dispose(): void;
}
