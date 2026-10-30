export type Terrain3DOptions = {
    parent?: any;
    material: any;
    chunkCells?: number;
    maxResidentChunks?: number;
    uvScale?: [number, number];
    /** Optional closed volume, extruded along local -Y. Material is borrowed. */
    solid?: {
        depth: number;
        material?: any;
    };
};
import { ZhudaHeightfield, type HeightRegion } from "./Heightfield";
import { type Vec3 } from "../runtime3d/Math3D";
import type { QueryRay, QueryProvider } from "../runtime3d/SceneQueries";
/** Resident heightfield chunks. The supplied material is borrowed; dispose releases only terrain meshes/nodes. */
export declare class ZhudaTerrain3D {
    readonly field: ZhudaHeightfield;
    readonly options: Terrain3DOptions;
    readonly root: any;
    private chunks;
    private unsubscribe;
    private disposed;
    private stride;
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
        bounds: any;
        shell: {
            vertices: Float32Array<ArrayBuffer>;
            indices: Uint16Array<ArrayBuffer>;
            bounds: any;
        } | null;
    } | null;
    dispose(): void;
}
