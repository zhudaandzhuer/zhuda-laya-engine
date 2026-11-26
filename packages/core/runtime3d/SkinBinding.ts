/**
 * Wearing a part on another model's skeleton: clothes, hair, armour or a held
 * prop made as a skinned model of its own whose joints have the same names as
 * the body's. Binding points the part's skinned meshes at the body's joints,
 * so the part is posed by whatever poses the body (its animator, a blend, a
 * procedural pose) and needs no animation of its own.
 *
 * The part need not come from the tool that made the body. Its joints may be
 * fewer, in another order, turned differently in the rest pose (bones along
 * another axis) and under an armature that is turned or scaled (a mesh in
 * centimetres, z up): where a part's joint rests differently from the body's,
 * the part is bound to a node under the body's joint that holds the difference.
 * What must agree is where the joints are: a part made for other proportions
 * is carried as it was made, not refitted.
 */
import type { ModelInstance } from './Assets.ts';

export interface ZhudaSkinBindingReport {
  /** Skinned meshes now posed by the skeleton. 0 when anything was missing. */
  renderers: number;
  /** Distinct joints the part uses. */
  joints: number;
  /** Joint names the part needs that the skeleton does not have. Nothing is bound when any is. */
  missing: string[];
  /**
   * Joints bound through an offset node because the part's rest pose there is
   * not the body's (0 for a part made on the body's own skeleton).
   */
  offsets: number;
}

type Matrix = ArrayLike<number>;
/** Column-major 4 x 4 product a x b. */
function multiply(a: Matrix, b: Matrix): number[] {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  return out;
}
/** Inverse of a column-major 4 x 4, or null when it has none. */
function invert(m: Matrix): number[] | null {
  const a = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) => (c < 4 ? m[c * 4 + r] : c - 4 === r ? 1 : 0)),
  );
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let c = 0; c < 8; c++) a[col][c] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f) for (let c = 0; c < 8; c++) a[r][c] -= f * a[col][c];
    }
  }
  const out = new Array<number>(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = a[r][c + 4];
  return out;
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const isIdentity = (m: Matrix) => IDENTITY.every((v, i) => Math.abs(m[i] - v) < 1e-4);
const elementsOf = (matrix: any): Matrix | null =>
  matrix?.elements?.length === 16 ? matrix.elements : null;
/** Offset nodes made for a part, so that they can be removed with it. */
const OFFSET_NODES = new WeakMap<object, any[]>();

type Node3D = {
  name?: string;
  numChildren?: number;
  getChildAt?: (index: number) => Node3D;
  getComponent?: (type: unknown) => any;
};

function visit(node: Node3D | null | undefined, each: (node: Node3D) => void): void {
  if (!node) return;
  each(node);
  for (let i = 0, n = node.numChildren ?? 0; i < n; i++) visit(node.getChildAt?.(i), each);
}

/**
 * Binds every skinned mesh under `part` to the joints of the same names under
 * `skeleton` (a model instance or a node). The skeleton's joints are the ones
 * its own skinned meshes use; if it has no skinned mesh, nodes are matched by
 * name. Either all of the part's meshes are bound or none: `missing` lists the
 * joints the skeleton lacks.
 *
 * Bind a part right after it is instantiated, before anything poses it: its
 * joints are read where they rest. The body may be in any pose. The body's own
 * skinned mesh is taken to be in the body's model space (no scale or turn
 * between its mesh and its joints' rest).
 *
 * Afterwards the part's own joint nodes are unused; its mesh nodes may stay
 * where they are or be moved under the body. Dispose the part as usual, call
 * `releaseZhudaSkinBinding` if the body lives on, and bind again after
 * replacing the body.
 */
export function bindZhudaSkinToSkeleton(
  part: ModelInstance | Laya.Sprite3D,
  skeleton: ModelInstance | Laya.Sprite3D,
): ZhudaSkinBindingReport {
  const nodeOf = (target: any): Node3D => (target && 'node' in target ? target.node : target);
  const partNode = nodeOf(part),
    skeletonNode = nodeOf(skeleton);
  if (!partNode || !skeletonNode) throw Error('Skin binding: a part and a skeleton are required');
  const Skinned = (Laya as any).SkinnedMeshRenderer;
  // The skeleton's joints are what its own skinned meshes are bound to; a mesh node may well
  // carry a joint's name (a body cut into `head`, `hips`...), and that node is not the joint.
  const byName = new Map<string, Node3D>();
  /** The body's inverse bind matrix of each joint: where the joint rests, in the body's model space. */
  const bodyBind = new Map<string, Matrix>();
  visit(skeletonNode, (node) => {
    const renderer = node.getComponent?.(Skinned);
    const binds = node.getComponent?.((Laya as any).MeshFilter)?.sharedMesh?._inverseBindPoses;
    for (const bone of [renderer?.rootBone, ...(renderer?.bones ?? [])])
      if (bone?.name && !byName.has(bone.name)) byName.set(bone.name, bone);
    (renderer?.bones ?? []).forEach((bone: Node3D, i: number) => {
      const bind = elementsOf(binds?.[i]);
      if (bone?.name && bind && !bodyBind.has(bone.name)) bodyBind.set(bone.name, bind);
    });
  });
  // A skeleton with no skinned mesh of its own (bare joints) is searched by node name.
  if (!byName.size)
    visit(skeletonNode, (node) => {
      if (node.name && !byName.has(node.name)) byName.set(node.name, node);
    });
  const renderers: any[] = [];
  const owners = new Map<any, Node3D>();
  visit(partNode, (node) => {
    const renderer = node.getComponent?.(Skinned);
    if (renderer?.bones?.length) {
      renderers.push(renderer);
      owners.set(renderer, node);
    }
  });
  const used = new Set<string>(),
    missing = new Set<string>();
  for (const renderer of renderers)
    for (const bone of [...renderer.bones, renderer.rootBone]) {
      const name = bone?.name;
      if (!name) continue;
      used.add(name);
      if (!byName.has(name)) missing.add(name);
    }
  if (missing.size || !renderers.length)
    return { renderers: 0, joints: used.size, missing: [...missing].sort(), offsets: 0 };
  // Where a joint of the part rests, in the part's own model space, against where the body's
  // joint of that name rests in the body's: the body's inverse bind times the part's rest. When
  // that is not the identity, the part's mesh was skinned to another rest pose (bones turned,
  // an armature turned or scaled), and it is bound to a node under the body's joint that holds
  // the difference; its own inverse bind matrices then still fit.
  const partRootInverse = invert(elementsOf((partNode as any).transform?.worldMatrix) ?? IDENTITY);
  const targets = new Map<string, Node3D>();
  const made: any[] = [];
  const target = (bone: Node3D): Node3D => {
    const name = bone.name!;
    const known = targets.get(name);
    if (known) return known;
    const joint = byName.get(name)!;
    const bind = bodyBind.get(name);
    const world = elementsOf((bone as any).transform?.worldMatrix);
    let bound = joint;
    if (bind && world && partRootInverse) {
      const offset = multiply(bind, multiply(partRootInverse, world));
      if (!isIdentity(offset)) {
        const node = new (Laya as any).Sprite3D(`${name}@${partNode.name ?? 'part'}`);
        (joint as any).addChild(node);
        const matrix = new (Laya as any).Matrix4x4();
        matrix.elements.set(offset);
        node.transform.localMatrix = matrix;
        made.push(node);
        bound = node;
      }
    }
    targets.set(name, bound);
    return bound;
  };
  for (const renderer of renderers) {
    const root = renderer.rootBone?.name ? byName.get(renderer.rootBone.name) : undefined;
    // The mesh's own box is in the part's mesh space (centimetres, z up, for a part exported
    // that way); LayaAir places it by the root joint. Left alone, a part in other units is
    // culled as if it stood a hundred times further away. Move the box to the body's space.
    const mesh = owners.get(renderer)?.getComponent?.((Laya as any).MeshFilter)?.sharedMesh;
    const firstRest = elementsOf((renderer.bones[0] as any)?.transform?.worldMatrix);
    const firstBind = elementsOf(mesh?._inverseBindPoses?.[0]);
    const rootBind = root?.name ? bodyBind.get(root.name) : undefined;
    const box = renderer.localBounds;
    if (firstRest && firstBind && partRootInverse && box?.getMin && box?.setMin) {
      const toBody = multiply(
        rootBind ?? IDENTITY,
        multiply(multiply(partRootInverse, firstRest), firstBind),
      );
      if (!isIdentity(toBody)) {
        const lo = box.getMin(),
          hi = box.getMax();
        const min = [Infinity, Infinity, Infinity],
          max = [-Infinity, -Infinity, -Infinity];
        for (let corner = 0; corner < 8; corner++) {
          const p = [corner & 1 ? hi.x : lo.x, corner & 2 ? hi.y : lo.y, corner & 4 ? hi.z : lo.z];
          for (let r = 0; r < 3; r++) {
            const v =
              toBody[r] * p[0] + toBody[4 + r] * p[1] + toBody[8 + r] * p[2] + toBody[12 + r];
            min[r] = Math.min(min[r], v);
            max[r] = Math.max(max[r], v);
          }
        }
        const Vector3 = (Laya as any).Vector3;
        box.setMin(new Vector3(min[0], min[1], min[2]));
        box.setMax(new Vector3(max[0], max[1], max[2]));
        renderer.localBounds = box;
      }
    }
    renderer.bones = renderer.bones.map((bone: Node3D) => target(bone));
    renderer.rootBone = root ?? renderer.bones[0];
  }
  if (made.length) OFFSET_NODES.set(partNode, [...(OFFSET_NODES.get(partNode) ?? []), ...made]);
  return { renderers: renderers.length, joints: used.size, missing: [], offsets: made.length };
}

/**
 * Removes the offset nodes a binding left under the body's joints. Call it
 * when a bound part is disposed while the body lives on. Returns how many.
 */
export function releaseZhudaSkinBinding(part: ModelInstance | Laya.Sprite3D): number {
  const node: any = part && 'node' in (part as any) ? (part as any).node : part;
  const made = OFFSET_NODES.get(node) ?? [];
  for (const offset of made) offset.destroy?.();
  OFFSET_NODES.delete(node);
  return made.length;
}
