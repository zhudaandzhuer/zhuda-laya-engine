// Generated from TypeScript source; run npm run types:generate.
/**
 * Triangle-exact picking without a physics engine.
 *
 * `ZhudaTriangleBvh` keeps a mesh's triangles in a bounding volume hierarchy
 * (binned surface-area split) in the mesh's own space. A ray is carried into
 * that space through the inverse of the world matrix, so moving the mesh is
 * `setMatrix`, not a rebuild. `createZhudaMeshQueryProvider` registers it with
 * `ZhudaSceneQueries`. Pure data: no LayaAir, no GPU read-back.
 */
import { type Matrix4, type Vec3 } from './Math3D.js';
import type { QueryProvider, QueryRay } from './SceneQueries.js';
export interface ZhudaMeshHit {
    /** Metres from the ray's origin, along its direction. */
    distance: number;
    /** Where the ray meets the triangle, in world space. */
    position: Vec3;
    /** The triangle's own unit normal in world space, out of its front face. */
    normal: Vec3;
    /** Which triangle: its corners are `indices[3 * triangle .. 3 * triangle + 2]`. */
    triangle: number;
    /** Weights of the triangle's three corners at the hit (they sum to 1): interpolate UVs or normals with them. */
    barycentric: [number, number, number];
    /** Whether the ray met the triangle's front. */
    frontFace: boolean;
}
export interface ZhudaTriangleBvhOptions {
    /** x, y, z per vertex in the mesh's own space. */
    positions: ArrayLike<number>;
    /** Three corners per triangle; omitted, every three vertices are one triangle. */
    indices?: ArrayLike<number>;
    /** The mesh's world matrix, column-major (`transform.worldMatrix.elements`); identity when omitted. */
    matrix?: Matrix4;
    /** Triangles in a leaf, 1..32 (default 4). */
    maxLeafTriangles?: number;
    /**
     * How a front face is wound seen from the front: 'cw' (default: LayaAir and
     * the engine's geometry builders) or 'ccw' (glTF and three.js source data).
     */
    winding?: 'cw' | 'ccw';
}
export interface ZhudaMeshRaycastOptions {
    /** Which faces count (default 'both'). */
    side?: 'both' | 'front' | 'back';
}
export declare class ZhudaTriangleBvh {
    /** Triangles kept (those without area are left out of every query). */
    readonly triangleCount: number;
    private readonly positions;
    private readonly corners;
    private readonly order;
    private bounds;
    /** Per node: [first, count] for a leaf (count > 0), [right child, 0] inside; the left child follows its parent. */
    private links;
    private nodes;
    private matrix;
    private inverse;
    private readonly ccw;
    constructor(options: ZhudaTriangleBvhOptions);
    /** Number of nodes in the hierarchy. */
    get nodeCount(): number;
    /** Moves the mesh without rebuilding: the next query uses this world matrix. */
    setMatrix(matrix?: Matrix4): void;
    /** World-space box round the whole mesh, or null when no triangle has area. */
    worldBounds(): {
        min: Vec3;
        max: Vec3;
    } | null;
    private triangle;
    private build;
    /**
     * The nearest triangle the ray meets within `maxDistance` metres, or null.
     * The direction need not be unit length; distances are in world metres.
     */
    raycast(ray: QueryRay, maxDistance?: number, options?: ZhudaMeshRaycastOptions): ZhudaMeshHit | null;
}
export interface ZhudaMeshQueryProviderOptions extends ZhudaMeshRaycastOptions {
    entityId: string;
    instanceId?: string | number;
    layer?: number;
}
/**
 * A `QueryProvider` for `ZhudaSceneQueries` that answers with the triangle a
 * ray meets on this mesh. The hit carries `triangle`, `barycentric` and
 * `frontFace` beside the usual position, normal and distance.
 */
export declare function createZhudaMeshQueryProvider(bvh: ZhudaTriangleBvh, options: ZhudaMeshQueryProviderOptions): QueryProvider & {
    raycast: (ray: QueryRay, maxDistance: number) => ZhudaMeshHit | null;
};
/** The LayaAir `Mesh` members `readZhudaLayaMeshTriangles` reads. */
export interface ZhudaLayaMeshLike {
    getPositions(out: {
        x: number;
        y: number;
        z: number;
    }[]): void;
    getIndices(): ArrayLike<number>;
}
/**
 * Positions and triangle corners of a LayaAir mesh (all of its sub-meshes),
 * for a `ZhudaTriangleBvh`. LayaAir keeps a mesh's CPU copy only while it is
 * readable: a mesh loaded without it throws here.
 */
export declare function readZhudaLayaMeshTriangles(mesh: ZhudaLayaMeshLike): {
    positions: Float32Array;
    indices: Uint32Array;
};
