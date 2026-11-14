/**
 * Where a moving thing was a frame ago, for the velocity picture.
 *
 * LayaAir 3.4.2's temporal anti-aliasing reads a picture of how far each
 * pixel moved since the last frame, and writes it from the camera's two
 * view-projections alone: a thing that moved is drawn into it as if it had
 * stood still. Its history is then taken from where the thing was, and what
 * is on it (a pattern, a face) smears while it moves.
 *
 * `installLaya342ObjectMotion` changes LayaAir's motion includes as text
 * before it compiles them, so that a renderer can say how its node moved:
 * one matrix, the frame before's world matrix times the inverse of this
 * frame's. `ZhudaObjectMotion` keeps that matrix for the nodes it is told
 * to track.
 *
 * A skinned mesh is given its node's motion (its bones' own are not kept:
 * that needs every bone of the frame before). Copies drawn as instances
 * stay as LayaAir writes them, without velocity.
 */
import { inverse4, multiply4 } from './Math3D.ts';

/** The renderer define and uniform the patched include reads. */
export const ZHUDA_OBJECT_MOTION_DEFINE = 'ZHUDA_OBJECT_MOTION';
export const ZHUDA_OBJECT_MOTION_UNIFORM = 'u_ZhudaMotion';

const VERTEX_INCLUDE = 'MotionVectorVertex.glsl',
  COMMON_INCLUDE = 'MotionVectorCommon.glsl';
/** Each include's changes; all of an include or none of it. */
const CHANGES: Record<string, readonly (readonly [string, string])[]> = {
  [VERTEX_INCLUDE]: [
    [
      'uniform mat4 u_TaaViewProjection;',
      `\n#ifdef ${ZHUDA_OBJECT_MOTION_DEFINE}\nuniform mat4 ${ZHUDA_OBJECT_MOTION_UNIFORM};\n#endif\nuniform mat4 u_TaaViewProjection;`,
    ],
    [
      'v_TaaPreviousClip=u_TaaPreviousViewProjection*vec4(positionWS,1.0);',
      `vec4 zhudaBefore=vec4(positionWS,1.0);\n#ifdef ${ZHUDA_OBJECT_MOTION_DEFINE}\nzhudaBefore=${ZHUDA_OBJECT_MOTION_UNIFORM}*zhudaBefore;\n#endif\nv_TaaPreviousClip=u_TaaPreviousViewProjection*zhudaBefore;`,
    ],
  ],
  // A skinned mesh that is tracked writes its node's motion instead of none.
  [COMMON_INCLUDE]: [
    [
      '#if !defined(BONE) && !defined(GPU_INSTANCE)',
      `#if (!defined(BONE) || defined(${ZHUDA_OBJECT_MOTION_DEFINE})) && !defined(GPU_INSTANCE)`,
    ],
  ],
};

const patched = new WeakSet<object>();
const applied = new WeakMap<object, Set<string>>();

/**
 * Teaches LayaAir's velocity picture that a thing can move. Must run before
 * `Laya.init` (`ZhudaEngine.boot` does it). Compiles to LayaAir's own code
 * for every renderer that is not tracked. Returns false when there is no
 * runtime to patch.
 */
export function installLaya342ObjectMotion(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (patched.has(shader)) return true;
  const addInclude = shader.addInclude;
  const done = new Set<string>();
  applied.set(shader, done);
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    const pairs = CHANGES[name];
    if (pairs && typeof text === 'string' && pairs.every(([from]) => text.includes(from))) {
      for (const [from, to] of pairs) text = text.replace(from, to);
      done.add(name);
      if (name === VERTEX_INCLUDE) {
        // A renderer's own value: LayaAir looks for it in the renderer's uniform map.
        const map = runtime.LayaGL?.renderDeviceFactory?.createGlobalUniformMap?.('Sprite3D');
        map?.addShaderUniform(
          shader.propertyNameToID(ZHUDA_OBJECT_MOTION_UNIFORM),
          ZHUDA_OBJECT_MOTION_UNIFORM,
          runtime.ShaderDataType.Matrix4x4,
        );
        if (!map) done.delete(name);
      }
    }
    return addInclude.call(this, name, text, ...rest);
  };
  patched.add(shader);
  return true;
}

/** Whether a tracked thing's motion reaches the velocity picture in this runtime (after `Laya.init`). */
export function zhudaObjectMotionInstalled(runtime: any = (globalThis as any).Laya): boolean {
  const done = applied.get(runtime?.Shader3D);
  return !!done && done.has(VERTEX_INCLUDE) && done.has(COMMON_INCLUDE);
}

/**
 * The matrix that takes a point of this frame to where it was a frame ago:
 * the earlier world matrix times the inverse of this one. Identity for a
 * thing that did not move, and for one whose matrix cannot be inverted.
 */
export function zhudaMotionMatrix(before: ArrayLike<number>, now: ArrayLike<number>): Float32Array {
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  let same = true;
  for (let i = 0; i < 16 && same; i++) same = before[i] === now[i];
  if (same) return identity;
  try {
    const motion = multiply4(before, inverse4(now));
    return Array.from(motion).every(Number.isFinite) ? new Float32Array(motion) : identity;
  } catch {
    // A node scaled to nothing has no inverse.
    return identity;
  }
}

interface Tracked {
  node: any;
  /** Each renderer's node under it, with its world matrix of the frame before. */
  parts: Map<any, Float32Array | null>;
}

export class ZhudaObjectMotion {
  private readonly tracked = new Set<Tracked>();
  private disposed = false;

  constructor() {
    const l = (globalThis as any).Laya;
    if (!zhudaObjectMotionInstalled(l))
      throw Error(
        'Object motion needs installLaya342ObjectMotion() before Laya.init (ZhudaEngine.boot does it)',
      );
  }

  /**
   * A node that moves, with everything under it that draws. Call
   * `refresh()` on what comes back after adding or removing parts of it.
   */
  track(node: any): { refresh(): void; remove(): void } {
    if (this.disposed) throw Error('Disposed object motion');
    if (!node?.transform) throw Error('Invalid object motion: a 3D node is required');
    const entry: Tracked = { node, parts: new Map() };
    this.find(entry);
    this.tracked.add(entry);
    return {
      refresh: () => this.find(entry),
      remove: () => {
        if (this.tracked.delete(entry)) this.release(entry);
      },
    };
  }

  private find(entry: Tracked) {
    const l = (globalThis as any).Laya;
    const seen = new Set<any>();
    const visit = (node: any) => {
      const renderer = node.getComponent?.(l.BaseRender);
      if (renderer?._baseRenderNode?.shaderData) {
        seen.add(node);
        if (!entry.parts.has(node)) entry.parts.set(node, null);
      }
      for (let i = 0; i < (node.numChildren ?? 0); i++) visit(node.getChildAt(i));
    };
    if (!entry.node.destroyed) visit(entry.node);
    for (const node of [...entry.parts.keys()])
      if (!seen.has(node)) {
        this.clear(node);
        entry.parts.delete(node);
      }
  }

  private clear(node: any) {
    const l = (globalThis as any).Laya;
    const data = node.destroyed
      ? null
      : node.getComponent?.(l.BaseRender)?._baseRenderNode?.shaderData;
    data?.removeDefine(l.Shader3D.getDefineByName(ZHUDA_OBJECT_MOTION_DEFINE));
  }
  private release(entry: Tracked) {
    for (const node of entry.parts.keys()) this.clear(node);
    entry.parts.clear();
  }

  /**
   * Once a frame, after everything has moved and before the frame is drawn:
   * tells each tracked renderer where its node was the frame before.
   */
  update(): void {
    if (this.disposed) return;
    const l = (globalThis as any).Laya;
    const define = l.Shader3D.getDefineByName(ZHUDA_OBJECT_MOTION_DEFINE);
    const id = l.Shader3D.propertyNameToID(ZHUDA_OBJECT_MOTION_UNIFORM);
    for (const entry of this.tracked)
      for (const [node, before] of entry.parts) {
        if (node.destroyed) {
          entry.parts.delete(node);
          continue;
        }
        const data = node.getComponent(l.BaseRender)?._baseRenderNode?.shaderData;
        if (!data) continue;
        const now = Float32Array.from(node.transform.worldMatrix.elements);
        const motion = zhudaMotionMatrix(before ?? now, now);
        data.addDefine(define);
        // A new matrix each time: one changed in place is not uploaded on WebGPU.
        data.setMatrix4x4(id, new l.Matrix4x4(...motion));
        entry.parts.set(node, now);
      }
  }

  /** After a cut or a teleport: the next frame has no motion. */
  reset(): void {
    for (const entry of this.tracked)
      for (const node of entry.parts.keys()) entry.parts.set(node, null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.tracked) this.release(entry);
    this.tracked.clear();
  }
}
