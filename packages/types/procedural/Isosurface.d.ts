// Generated from TypeScript source; run npm run types:generate.
/**
 * Shapes as signed distances, joined smoothly, and turned into a mesh.
 *
 * A body made of soft parts (a hand, a face, a stone) is easier to write as
 * distances than as faces: each part is a round cone or an ellipsoid, the
 * parts are joined with a smooth minimum (the joint is a fillet, not a seam),
 * and the mesher finds the surface. Pure data, as the rest of `procedural/`:
 * the result is the engine's `MeshData` and nothing here touches Laya.
 *
 * Conventions: metres; a distance is negative inside; the triangles wind as
 * the geometry kit's (cross(v1 - v0, v2 - v0) points into the body).
 */
import type { MeshData } from '../runtime3d/Surfaces.js';
import type { ZhudaVec3 } from './Geometry.js';
/** Squeezes a shape along one direction: 1 keeps it, 0.8 makes it 0.8 as thick that way. */
export interface ZhudaSdfFlatten {
    axis: ZhudaVec3;
    factor: number;
}
interface ZhudaSdfShapeBase {
    /** How wide the fillet is where this shape meets what came before it, in metres (0: a crease). */
    blend?: number;
    /** Cut this shape out of what came before it (with the same fillet) instead of adding it. */
    subtract?: boolean;
    flatten?: ZhudaSdfFlatten;
}
/** A cone between two balls: radius `ra` at `a`, `rb` at `b`. Equal radii make a capsule. */
export interface ZhudaSdfRoundCone extends ZhudaSdfShapeBase {
    kind: 'roundCone';
    a: ZhudaVec3;
    b: ZhudaVec3;
    ra: number;
    rb: number;
}
/** An ellipsoid with half-axes `radii` along `axes` (default the world's x, y, z). */
export interface ZhudaSdfEllipsoid extends ZhudaSdfShapeBase {
    kind: 'ellipsoid';
    center: ZhudaVec3;
    radii: ZhudaVec3;
    /** Three unit vectors, square to each other. */
    axes?: [ZhudaVec3, ZhudaVec3, ZhudaVec3];
}
export type ZhudaSdfShape = ZhudaSdfRoundCone | ZhudaSdfEllipsoid;
export interface ZhudaSdfField {
    /** The distance at a point: negative inside. Never more than the true distance by much, so a mesher may step by it. */
    distance(x: number, y: number, z: number): number;
    /** A box that holds the whole body. */
    bounds: {
        min: ZhudaVec3;
        max: ZhudaVec3;
    };
    /** Which shape is nearest the point (the index in the list given), for colouring by part. */
    nearest(x: number, y: number, z: number): number;
}
/** What is wrong with a list of shapes; empty when it can be built. */
export declare function validateZhudaSdfShapes(shapes: readonly ZhudaSdfShape[]): string[];
/** The polynomial smooth minimum: the two distances joined with a fillet `k` wide. */
export declare function zhudaSmoothMin(a: number, b: number, k: number): number;
/** The shapes, in order, as one field. Throws with every problem `validateZhudaSdfShapes` finds. */
export declare function createZhudaSdfField(shapes: readonly ZhudaSdfShape[]): ZhudaSdfField;
export interface ZhudaIsosurfaceOptions {
    /** The distance at a point, negative inside. A `ZhudaSdfField`'s `distance` serves. */
    distance: (x: number, y: number, z: number) => number;
    /** The box to search; the surface must not touch its sides. */
    min: ZhudaVec3;
    max: ZhudaVec3;
    /** The size of a cell, in metres: the mesh's detail, and about the distance between its vertices. */
    cellSize: number;
    /** Steps that move each vertex onto the surface along the field's slope (default 3; 0 leaves them where the cells put them). */
    project?: number;
    /** Texture coordinates at a vertex (default its x and y, in metres). */
    uv?: (p: ZhudaVec3, n: ZhudaVec3) => [number, number];
    /** A colour at a vertex (four numbers); left out, the mesh has none. */
    color?: (p: ZhudaVec3, n: ZhudaVec3) => [number, number, number, number];
    /**
     * Refuse past this many vertices (default 2 000 000). Past 65535 the indices are 32-bit:
     * `splitZhudaMesh` cuts such a mesh into chunks a `ZhudaDynamicMesh` takes.
     */
    maxVertices?: number;
}
/** What is wrong with the options; empty when they can be used. */
export declare function validateZhudaIsosurface(options: ZhudaIsosurfaceOptions): string[];
/**
 * The surface where the distance is 0, as a mesh, by surface nets: one vertex
 * in each cell the surface passes through, moved onto the surface, and a
 * quad across each edge of the grid that the surface cuts. The normals are
 * the field's slope. A closed body inside the box gives a closed mesh.
 */
export declare function createZhudaIsosurfaceMesh(options: ZhudaIsosurfaceOptions): MeshData;
/**
 * A trunk with limbs: each limb is joined to the trunk with its own fillet,
 * and the limbs meet each other with none (fingers touch without growing
 * together). `distance` is the least of the trunk joined with each limb.
 */
export declare function joinZhudaSdfFields(trunk: ZhudaSdfField, limbs: ReadonlyArray<{
    field: ZhudaSdfField;
    blend: number;
}>): ZhudaSdfField;
/** How far a line from a point inside the body runs before it leaves it (up to `limit`). */
export declare function zhudaSdfDepthAlong(distance: (x: number, y: number, z: number) => number, from: ZhudaVec3, direction: ZhudaVec3, limit: number): number;
/**
 * Cuts a mesh into chunks of at most `maxVertices` (default 65535) with 16-bit
 * indices, the size a `ZhudaDynamicMesh` takes. Triangles keep their order;
 * a vertex on a cut is in both chunks, with the same normal, so no seam shows.
 */
export declare function splitZhudaMesh(data: MeshData, maxVertices?: number): MeshData[];
/**
 * Many small shapes as one plain union (no fillets, no cuts: creases, rivets,
 * pores), found through a grid so a point asks only the shapes near it.
 * Within `reach` of a shape the distance is exact; farther it is `reach`,
 * which is never more than the true distance. Use it where only what is
 * near matters: a cut into a surface, a detail joined to one.
 */
export declare function createZhudaSdfUnion(shapes: readonly ZhudaSdfShape[], options?: {
    reach?: number;
    cell?: number;
}): ZhudaSdfField;
export {};
