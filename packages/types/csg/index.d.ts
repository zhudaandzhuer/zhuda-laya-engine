// Generated from TypeScript source; run npm run types:generate.
/**
 * Boolean operations on meshes: union, subtract and intersect two closed
 * meshes (`zhuda-laya-engine/csg`, an entry of its own: a game that does not
 * import it does not carry it).
 *
 * Inputs and output are `MeshData`; draw the result with
 * `ZhudaDynamicMesh` (past 65 535 vertices, cut it with `splitZhudaMesh`).
 * The operation is the binary space partitioning of csg.js (MIT, see
 * `Bsp.ts`): exact enough for tens of thousands of triangles, slow beyond.
 * The cut splinters triangles: the report says how many came in and went
 * out. Seams where a split met an unsplit neighbour are mended, so a closed
 * input gives a closed output.
 *
 * Each face of the result keeps the normals, texture coordinates and
 * colours of the triangle it came from, interpolated where it was cut; a
 * face from `b` keeps `b`'s (in a subtraction, turned inward). `groups` says
 * which index ranges came from which input, so a cut face can take a
 * material of its own. Tangents are worked out again when an input had them.
 *
 * Pure: no renderer, no timer. Synchronous: measure before calling it every
 * frame.
 */
import type { MeshData } from '../runtime3d/Surfaces.js';
export type ZhudaCsgOperation = 'union' | 'subtract' | 'intersect';
export interface ZhudaCsgOptions {
    /** Distance in metres under which a point is on a plane (default 1e-5). */
    tolerance?: number;
    /** Refuse an input of more triangles than this (default 50 000). */
    maxTriangles?: number;
}
export interface ZhudaCsgReport {
    operation: ZhudaCsgOperation;
    /** Triangles of `a` and of `b`. */
    trianglesIn: [number, number];
    trianglesOut: number;
    /** Edges of the output used by one triangle only (0 when the result is closed). */
    openEdges: number;
    /**
     * Edges of the output used by more than two triangles (0 when it is a
     * single surface). Either above 0: the cut went wrong (in practice after
     * overlapping curved cuts in succession); do not cut the result again.
     */
    nonManifoldEdges: number;
    milliseconds: number;
}
export interface ZhudaCsgResult {
    mesh: MeshData;
    /** Index ranges of the output by the input they came from (draw each with its own material). */
    groups: {
        source: 'a' | 'b';
        start: number;
        count: number;
    }[];
    report: ZhudaCsgReport;
}
export interface ZhudaCsgInputCheck {
    triangles: number;
    /** Edges used by one triangle only, once vertices at one place are welded. */
    openEdges: number;
    /** Edges used by more than two triangles. */
    nonManifoldEdges: number;
    /** Triangles without area. */
    degenerateTriangles: number;
    /** What to fix, in words; empty when the mesh can be cut. */
    issues: string[];
}
/**
 * What stops a mesh from being cut: open edges (a hole, so inside and outside
 * are not told apart), edges of more than two triangles, triangles without
 * area. Vertices at one place (within `tolerance`) count as one.
 */
export declare function validateZhudaCsgInput(mesh: MeshData, options?: {
    tolerance?: number;
}): ZhudaCsgInputCheck;
/**
 * `a` union, minus or intersected with `b`. Both must be closed (see
 * `validateZhudaCsgInput`); an input that is not is refused with what is
 * wrong with it. Triangles without area are left out.
 */
export declare function zhudaCsg(a: MeshData, b: MeshData, operation: ZhudaCsgOperation, options?: ZhudaCsgOptions): ZhudaCsgResult;
