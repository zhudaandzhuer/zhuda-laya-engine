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
import type { ModelInstance } from './Assets.ts';

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
export function createZhudaTriangleMask(triangles: number): Uint8Array {
  return new Uint8Array(Math.ceil(triangles / 8));
}
/** Whether a mask hides triangle `triangle`. */
export function isZhudaTriangleHidden(mask: ArrayLike<number>, triangle: number): boolean {
  return ((mask[triangle >> 3] ?? 0) & (1 << (triangle & 7))) !== 0;
}
/** Hides or shows triangle `triangle` in a mask. */
export function hideZhudaTriangle(mask: Uint8Array, triangle: number, hidden = true): void {
  if (hidden) mask[triangle >> 3] |= 1 << (triangle & 7);
  else mask[triangle >> 3] &= ~(1 << (triangle & 7));
}
/** Triangles a mask hides among the first `triangles`. */
export function countZhudaHiddenTriangles(mask: ArrayLike<number>, triangles: number): number {
  let count = 0;
  for (let t = 0; t < triangles; t++) if (isZhudaTriangleHidden(mask, t)) count++;
  return count;
}
/** The union of masks of one mesh (what is hidden by any of them); null entries are skipped. */
export function unionZhudaTriangleMasks(
  triangles: number,
  masks: Iterable<ArrayLike<number> | null | undefined>,
): Uint8Array {
  const out = createZhudaTriangleMask(triangles);
  for (const mask of masks) {
    if (!mask) continue;
    if (mask.length !== out.length)
      throw Error(`Triangle mask: ${mask.length} bytes for ${triangles} triangles (${out.length})`);
    for (let i = 0; i < out.length; i++) out[i] |= mask[i];
  }
  return out;
}
/** A mask as text (base64), for a manifest; and back. */
export function encodeZhudaTriangleMask(mask: Uint8Array): string {
  let text = '';
  for (const byte of mask) text += String.fromCharCode(byte);
  return btoa(text);
}
export function decodeZhudaTriangleMask(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

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
export function maskZhudaIndices<T extends ZhudaIndexArray>(
  indices: T,
  mask: ArrayLike<number> | null,
  fileOrder?: { ranges?: ZhudaIndexRange[] },
): T {
  const out = indices.slice() as T;
  if (!mask) return out;
  const triangles = Math.floor(indices.length / 3);
  if (mask.length !== Math.ceil(triangles / 8))
    throw Error(
      `Triangle mask: ${mask.length} bytes for ${triangles} triangles (${Math.ceil(triangles / 8)})`,
    );
  if (!fileOrder) {
    for (let t = 0; t < triangles; t++)
      if (isZhudaTriangleHidden(mask, t)) out[t * 3 + 1] = out[t * 3 + 2] = out[t * 3];
    return out;
  }
  const ranges = fileOrder.ranges?.length ? fileOrder.ranges : [{ start: 0, count: triangles * 3 }];
  let bit = 0;
  for (const range of ranges) {
    const n = Math.floor(range.count / 3);
    for (let local = 0; local < n; local++, bit++) {
      if (!isZhudaTriangleHidden(mask, bit)) continue;
      const at = range.start + (n - 1 - local) * 3;
      out[at + 1] = out[at + 2] = out[at];
    }
  }
  if (bit !== triangles)
    throw Error(`Triangle mask: the mesh's sub-meshes hold ${bit} triangles of its ${triangles}`);
  return out;
}

export interface ZhudaTriangleMaskOptions {
  /**
   * `file` (default): bit t is triangle t of the model file (of its primitives
   * in turn). `mesh`: bit t is triangle t of the loaded mesh's own index list.
   */
  order?: 'file' | 'mesh';
}

interface Masked {
  /** Where each primitive of the file lies in the mesh's index list. */
  ranges: ZhudaIndexRange[];
  /** The mesh the node drew before its first mask. */
  shared: any;
  /** The mesh the node draws now: a copy of its own, or `shared` when it could not be copied. */
  mesh: any;
  /** The indices as the model was loaded. */
  original: ZhudaIndexArray;
}
const MASKED = new WeakMap<object, Masked>();

type Node3D = {
  name?: string;
  numChildren?: number;
  getChildAt?: (index: number) => Node3D;
  getComponent?: (type: unknown) => any;
};
/** The one node under `target` that carries a mesh; an error when there are none or several. */
function meshNodeOf(target: any): Node3D {
  const root: Node3D = target && 'node' in target ? target.node : target;
  if (!root) throw Error('Triangle mask: a node is required');
  const Filter = (Laya as any).MeshFilter;
  const found: Node3D[] = [];
  const visit = (node: Node3D | undefined) => {
    if (!node) return;
    if (node.getComponent?.(Filter)?.sharedMesh) found.push(node);
    for (let i = 0, n = node.numChildren ?? 0; i < n; i++) visit(node.getChildAt?.(i));
  };
  visit(root);
  if (found.length !== 1)
    throw Error(
      `Triangle mask: ${root.name ?? 'the node'} holds ${found.length} meshes; pass the node of the one to mask`,
    );
  return found[0];
}

/**
 * Hides the triangles of `mask` on the mesh of `target` (a node carrying one
 * mesh, or a model instance or node with exactly one mesh under it), replacing
 * any earlier mask. `null` shows every triangle again. A mask of the wrong
 * length for the mesh is an error: it was made for another model. The mask is
 * in the model file's order unless `options.order` is `'mesh'`.
 */
export function setZhudaTriangleMask(
  target: ModelInstance | Laya.Sprite3D,
  mask: ArrayLike<number> | null,
  options: ZhudaTriangleMaskOptions = {},
): ZhudaTriangleMaskReport {
  const node = meshNodeOf(target);
  const filter = node.getComponent!((Laya as any).MeshFilter);
  let state = MASKED.get(node);
  if (!state) {
    const shared = filter.sharedMesh;
    const original: ZhudaIndexArray = shared.getIndices();
    const triangles = Math.floor(original.length / 3);
    if (!mask) return { triangles, hidden: 0, own: true };
    let mesh = shared;
    if (original instanceof Uint16Array && typeof shared.clone === 'function') {
      mesh = shared.clone();
      // A skinned renderer keeps its own box (a bound part's was moved to the body's space):
      // replacing the mesh must not put the mesh's box back.
      const renderer =
        node.getComponent!((Laya as any).SkinnedMeshRenderer) ??
        node.getComponent!((Laya as any).MeshRenderer);
      const box = renderer?.localBounds?.clone?.();
      const bones = renderer?.bones,
        rootBone = renderer?.rootBone;
      filter.sharedMesh = mesh;
      if (renderer && bones && renderer.bones !== bones) renderer.bones = bones;
      if (renderer && rootBone && renderer.rootBone !== rootBone) renderer.rootBone = rootBone;
      if (renderer && box) renderer.localBounds = box;
    }
    const ranges: ZhudaIndexRange[] = [];
    for (let i = 0, n = shared.subMeshCount ?? 0; i < n; i++) {
      const sub = shared.getSubMesh?.(i);
      if (typeof sub?._indexStart === 'number' && typeof sub?._indexCount === 'number')
        ranges.push({ start: sub._indexStart, count: sub._indexCount });
    }
    state = { shared, mesh, original, ranges };
    MASKED.set(node, state);
  }
  const triangles = Math.floor(state.original.length / 3);
  state.mesh.setIndices(
    maskZhudaIndices(
      state.original,
      mask,
      options.order === 'mesh' ? undefined : { ranges: state.ranges },
    ),
  );
  return {
    triangles,
    hidden: mask ? countZhudaHiddenTriangles(mask, triangles) : 0,
    own: state.mesh !== state.shared,
  };
}

/**
 * Gives a masked node its mesh back as it was loaded and frees the copy. Call
 * it before disposing a model whose nodes were masked if the model's meshes
 * are shared with instances that live on. Returns whether there was a mask.
 */
export function releaseZhudaTriangleMask(target: ModelInstance | Laya.Sprite3D): boolean {
  const node = meshNodeOf(target);
  const state = MASKED.get(node);
  if (!state) return false;
  if (state.mesh === state.shared) state.shared.setIndices(state.original);
  else {
    const filter = node.getComponent!((Laya as any).MeshFilter);
    if (filter.sharedMesh === state.mesh) filter.sharedMesh = state.shared;
    state.mesh.destroy?.();
  }
  MASKED.delete(node);
  return true;
}
