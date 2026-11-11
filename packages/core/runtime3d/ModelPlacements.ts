/**
 * Puts a loaded model under a holder node: once, or as many copies at given
 * places, with the per-use options film scenes and model prefabs share
 * (leaves that let light through, a scale for what the materials give off).
 * The model's meshes and materials are shared by every copy and by every
 * other user of the same asset, so whatever is changed on a material is put
 * back on disposal.
 */
import type { ModelInstance } from './Assets.ts';
import { ZHUDA_TRANSLUCENT_DEFINE } from './Laya342Adapters.ts';

/** One copy of a model: x, y, z in metres, yaw in degrees, uniform scale. */
export type ZhudaModelPlacement = readonly [number, number, number, number, number];

export interface ZhudaModelMountOptions {
  /** Copies relative to the holder; without it the model is attached once, at the holder. */
  placements?: readonly ZhudaModelPlacement[];
  /** Cut-out (alpha-tested) materials let light through. */
  translucent?: boolean;
  /** Scales the emissive strength of glTF materials (1 leaves them alone). */
  emission?: number;
  /** Name prefix of the nodes created for copies. */
  label?: string;
}

export interface ZhudaMountedModel {
  /** Renderers of the loaded instance (copies share their materials). */
  renderers: any[];
  dispose(): void;
}

/** Every mesh renderer below a node. */
export function zhudaModelRenderers(l: any, root: any): any[] {
  const found: any[] = [];
  const visit = (node: any) => {
    const renderer =
      node.meshRenderer ?? node.skinnedMeshRenderer ?? node.getComponent?.(l.MeshRenderer);
    if (renderer) found.push(renderer);
    for (let i = 0; i < (node.numChildren || 0); i++) visit(node.getChildAt(i));
  };
  visit(root);
  return found;
}

/** Lists what is wrong with a placement list; empty when it is valid. */
export function validateZhudaModelPlacements(value: unknown, max = 20000): string[] {
  if (!Array.isArray(value) || !value.length || value.length > max)
    return [`1..${max} places required`];
  const bad = value.findIndex(
    (place) =>
      !Array.isArray(place) ||
      place.length !== 5 ||
      !place.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      !(place[4] >= 0.001 && place[4] <= 1000),
  );
  return bad >= 0 ? [`[${bad}]: use [x, y, z, yawDeg, scale] with scale 0.001..1000`] : [];
}

export function mountZhudaModel(
  holder: any,
  instance: ModelInstance,
  options: ZhudaModelMountOptions = {},
): ZhudaMountedModel {
  const l = (globalThis as any).Laya;
  const cleanups: (() => void)[] = [];
  const dispose = () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
  try {
    const source = zhudaModelRenderers(l, instance.node);
    if (options.placements) {
      // The loaded instance is the first copy; the rest are clones that
      // share its meshes and materials.
      options.placements.forEach(([x, y, z, yawDeg, size], i) => {
        const place = new l.Sprite3D(`${options.label ?? 'ZhudaModel'}:${i}`);
        holder.addChild(place);
        cleanups.push(() => place.destroy(false));
        place.transform.localPosition = new l.Vector3(x, y, z);
        place.transform.localRotationEuler = new l.Vector3(0, yawDeg, 0);
        place.transform.localScale = new l.Vector3(size, size, size);
        if (i === 0) place.addChild(instance.node);
        else {
          const copy = instance.node.clone();
          place.addChild(copy);
          cleanups.push(() => copy.destroy(true));
          // Laya's clone does not keep the material of every sub-mesh: take
          // them from the source.
          zhudaModelRenderers(l, copy).forEach((renderer, k) => {
            if (source[k]) renderer.sharedMaterials = source[k].sharedMaterials;
            renderer.castShadow = true;
            renderer.receiveShadow = true;
          });
        }
      });
    } else holder.addChild(instance.node);
    // The library destroys the instance; detach it first so the holder does not.
    cleanups.push(() => instance.node.removeSelf());
    for (const renderer of source) {
      renderer.castShadow = true;
      renderer.receiveShadow = true;
    }
    const materials = new Set<any>();
    for (const renderer of source)
      for (const material of renderer.sharedMaterials ?? []) if (material) materials.add(material);
    if (options.emission !== undefined && options.emission !== 1) {
      // glTF materials multiply their emissive colour by this strength.
      const scale = options.emission;
      for (const material of materials) {
        const before = material.getFloat?.('u_EmissionStrength');
        if (typeof before !== 'number') continue;
        material.setFloat('u_EmissionStrength', before * scale);
        cleanups.push(() => !material.destroyed && material.setFloat('u_EmissionStrength', before));
      }
    }
    if (options.translucent) {
      const define = l.Shader3D.getDefineByName(ZHUDA_TRANSLUCENT_DEFINE);
      for (const material of materials) {
        if (!material.alphaTest) continue;
        material.addDefine(define);
        cleanups.push(() => !material.destroyed && material.removeDefine(define));
      }
    }
    return { renderers: source, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
