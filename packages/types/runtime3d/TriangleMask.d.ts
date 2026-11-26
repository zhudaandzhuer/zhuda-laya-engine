// Generated from TypeScript source; run npm run types:generate.
/**
 * Hiding some triangles of a mesh that is being drawn: the skin under a
 * garment, the shirt under a coat. What cannot be seen is not drawn, so it
 * cannot come through what covers it, whatever the pose.
 *
 * A mask is a bit per triangle, in the order the triangles have in the model
 * file (a tool that knows the model writes it: which triangles lie under the
 * garment). Hidden triangles stay in the index buffer with their three corners
 * made the same vertex, which draws nothing: the buffer keeps its length, so
 * sub-meshes and skinning are untouched and a mask can be changed at any time.
 *
 * The file's order is not the mesh's: LayaAir 3.4.2 reads each primitive of a
 * glTF file last index first (that is how it turns the triangles to face its
 * way), so triangle t of a primitive of n is triangle n - 1 - t of its
 * sub-mesh. `setZhudaTriangleMask` takes the file's order and does the
 * turning; pass `{ order: 'mesh' }` for a mask made from the mesh itself.
 *
 * The first mask on a node gives that node a copy of its mesh, so that other
 * instances of the model keep theirs. Meshes with more than 65,535 vertices
 * cannot be copied by LayaAir 3.4.2 and are masked in place (`own` is false):
 * every instance drawing that mesh then shows the same mask.
 */
import type { ModelInstance } from './Assets.js';
export type ZhudaIndexArray = Uint8Array | Uint16Array | Uint32Array;
export interface ZhudaTriangleMaskReport {
    /** Triangles of the mesh. */
    triangles: number;
    /** Triangles the mask hides. When it equals `triangles`, deactivate the node instead of drawing nothing. */
    hidden: number;
    /** False when the mesh could not be copied and every instance sharing it is masked alike. */
    own: boolean;
}
/** An empty mask for a mesh of `triangles` triangles: one bit each, none hidden. */
export declare function createZhudaTriangleMask(triangles: number): Uint8Array;
/** Whether a mask hides triangle `triangle`. */
export declare function isZhudaTriangleHidden(mask: ArrayLike<number>, triangle: number): boolean;
/** Hides or shows triangle `triangle` in a mask. */
export declare function hideZhudaTriangle(mask: Uint8Array, triangle: number, hidden?: boolean): void;
/** Triangles a mask hides among the first `triangles`. */
export declare function countZhudaHiddenTriangles(mask: ArrayLike<number>, triangles: number): number;
/** The union of masks of one mesh (what is hidden by any of them); null entries are skipped. */
export declare function unionZhudaTriangleMasks(triangles: number, masks: Iterable<ArrayLike<number> | null | undefined>): Uint8Array;
/** A mask as text (base64), for a manifest; and back. */
export declare function encodeZhudaTriangleMask(mask: Uint8Array): string;
export declare function decodeZhudaTriangleMask(text: string): Uint8Array;
/** A run of indices in a mesh's index list that came from one primitive of the file. */
export interface ZhudaIndexRange {
    start: number;
    count: number;
}
/**
 * The indices of a mesh with the masked triangles made empty (three times their
 * first corner). `indices` is left as it is; the result has its type and length.
 *
 * `fileOrder`: the mask is in the file's order and the mesh holds each of
 * `ranges` (its sub-meshes; the whole list when omitted) last index first, as
 * LayaAir 3.4.2 loads glTF: bit t of a range of n triangles hides its triangle
 * n - 1 - t. Bits run through the ranges in turn.
 */
export declare function maskZhudaIndices<T extends ZhudaIndexArray>(indices: T, mask: ArrayLike<number> | null, fileOrder?: {
    ranges?: ZhudaIndexRange[];
}): T;
export interface ZhudaTriangleMaskOptions {
    /**
     * `file` (default): bit t is triangle t of the model file (of its primitives
     * in turn). `mesh`: bit t is triangle t of the loaded mesh's own index list.
     */
    order?: 'file' | 'mesh';
}
/**
 * Hides the triangles of `mask` on the mesh of `target` (a node carrying one
 * mesh, or a model instance or node with exactly one mesh under it), replacing
 * any earlier mask. `null` shows every triangle again. A mask of the wrong
 * length for the mesh is an error: it was made for another model. The mask is
 * in the model file's order unless `options.order` is `'mesh'`.
 */
export declare function setZhudaTriangleMask(target: ModelInstance | Laya.Sprite3D, mask: ArrayLike<number> | null, options?: ZhudaTriangleMaskOptions): ZhudaTriangleMaskReport;
/**
 * Gives a masked node its mesh back as it was loaded and frees the copy. Call
 * it before disposing a model whose nodes were masked if the model's meshes
 * are shared with instances that live on. Returns whether there was a mask.
 */
export declare function releaseZhudaTriangleMask(target: ModelInstance | Laya.Sprite3D): boolean;
