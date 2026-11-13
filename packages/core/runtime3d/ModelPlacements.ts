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
import { ZhudaModelLod, type ZhudaLodItem } from './ModelLod.ts';

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
  /**
   * Lighter versions of the model for distance, nearest first: beyond
   * `fromMeters` a copy draws this one instead of the one before. The caller
   * loaded them and disposes them after this mount.
   */
  lod?: readonly { instance: ModelInstance; fromMeters: number }[];
  /** Beyond this distance a copy draws nothing. */
  cullMeters?: number;
}

export interface ZhudaMountedModel {
  /** Renderers of the loaded instance (copies share their materials). */
  renderers: any[];
  /**
   * Scales what the model's materials give off, 0..8, while it is mounted (1 is
   * as authored). The materials are shared by every copy of the model.
   */
  setEmission(scale: number): void;
  /** Present when the mount has levels or a cull distance: call `update(eye)` as the eye moves. */
  lod?: ZhudaModelLod;
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
    // Every version of the model, the full one first.
    const versions = [instance, ...(options.lod ?? []).map((level) => level.instance)];
    const sources = versions.map((version) => zhudaModelRenderers(l, version.node));
    const from = (options.lod ?? []).map((level) => level.fromMeters);
    const levelled = versions.length > 1 || options.cullMeters !== undefined;
    const items: ZhudaLodItem[] = [];
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
        const nodes = versions.map((version, v) => {
          if (i === 0) {
            place.addChild(version.node);
            return version.node;
          }
          const copy = version.node.clone();
          place.addChild(copy);
          cleanups.push(() => copy.destroy(true));
          // Laya's clone does not keep the material of every sub-mesh: take
          // them from the source.
          zhudaModelRenderers(l, copy).forEach((renderer, k) => {
            if (sources[v][k]) renderer.sharedMaterials = sources[v][k].sharedMaterials;
            renderer.castShadow = true;
            renderer.receiveShadow = true;
          });
          return copy;
        });
        if (levelled) items.push({ anchor: place, nodes, from, cull: options.cullMeters });
      });
    } else {
      for (const version of versions) holder.addChild(version.node);
      if (levelled)
        items.push({
          anchor: holder,
          nodes: versions.map((version) => version.node),
          from,
          cull: options.cullMeters,
        });
    }
    // The library destroys the instances; detach them first so the holder does not.
    for (const version of versions) cleanups.push(() => version.node.removeSelf());
    const materials = new Set<any>();
    for (const renderers of sources)
      for (const renderer of renderers) {
        renderer.castShadow = true;
        renderer.receiveShadow = true;
        for (const material of renderer.sharedMaterials ?? [])
          if (material) materials.add(material);
      }
    let lod: ZhudaModelLod | undefined;
    if (levelled) {
      // Hidden, not deactivated: a deactivated renderer leaves its scene's
      // lists, and on WebGPU the renderers that stay are then drawn with
      // pipelines that no longer match their bindings (LayaAir 3.4.2). The
      // flag LayaAir's editor hides things with skips a renderer in every
      // pass and leaves the lists alone.
      const hidden = l.RenderBitFlag?.RenderBitFlag_Editor;
      const drawn = new Map<any, any[]>();
      const show = (node: any, visible: boolean) => {
        if (hidden === undefined) return void (node.active = visible);
        let renderers = drawn.get(node);
        if (!renderers) drawn.set(node, (renderers = zhudaModelRenderers(l, node)));
        for (const renderer of renderers) renderer.setRenderbitFlag(hidden, !visible);
      };
      lod = new ZhudaModelLod(items, undefined, show);
      const levels = lod;
      cleanups.push(() => levels.dispose());
    }
    // glTF materials multiply their emissive colour by this strength. What each
    // had is kept, so the scale can change while the model is mounted (windows
    // and lanterns that light at dusk) and is put back on disposal.
    const glowing: { material: any; authored: number }[] = [];
    for (const material of materials) {
      const authored = material.getFloat?.('u_EmissionStrength');
      if (typeof authored === 'number') glowing.push({ material, authored });
    }
    const setEmission = (scale: number) => {
      if (!(scale >= 0 && scale <= 8)) throw Error('Model emission: use 0..8');
      for (const { material, authored } of glowing)
        if (!material.destroyed) material.setFloat('u_EmissionStrength', authored * scale);
    };
    if (glowing.length) cleanups.push(() => setEmission(1));
    if (options.emission !== undefined && options.emission !== 1) setEmission(options.emission);
    if (options.translucent) {
      const define = l.Shader3D.getDefineByName(ZHUDA_TRANSLUCENT_DEFINE);
      for (const material of materials) {
        if (!material.alphaTest) continue;
        material.addDefine(define);
        cleanups.push(() => !material.destroyed && material.removeDefine(define));
      }
    }
    return { renderers: source, lod, setEmission, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
