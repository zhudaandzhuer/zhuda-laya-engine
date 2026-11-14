/**
 * Puts a loaded model under a holder node: once, or as many copies at given
 * places, with the per-use options film scenes and model prefabs share
 * (leaves that let light through, a scale for what the materials give off).
 * The model's meshes and materials are shared by every copy and by every
 * other user of the same asset, so whatever is changed on a material is put
 * back on disposal.
 *
 * A node of the file that asks for copies of its own mesh
 * (`EXT_mesh_gpu_instancing`) is drawn here as those copies, one draw a
 * group of them, in place of the mesh LayaAir draws once at the node.
 */
import type { ModelInstance } from './Assets.ts';
import { ZhudaInstancedMesh, zhudaPlacementMatrices } from './InstancedMesh.ts';
import { ZHUDA_TRANSLUCENT_DEFINE, destroyLaya342ModelTree } from './Laya342Adapters.ts';
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
  /**
   * False: the model casts no shadow (it still takes them). For ground,
   * paving and what is too small to matter: a model is drawn again in every
   * split of the shadow map it reaches. Default true.
   */
  castShadow?: boolean;
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
  /**
   * With `placements`: no node for a copy. The copies of each mesh are drawn
   * together, a group for each square of ground (`ZhudaInstancedMesh`): one
   * draw a group instead of one a copy, lit and shadowed as before. Levels
   * and the cull distance are then chosen for a group, by the middle of its
   * box. Only for models of plain meshes (no bones, no morph targets).
   */
  instanced?: boolean;
  /** With `instanced`: side of the squares the copies are grouped by, in metres (default 32). */
  cellMeters?: number;
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
  /** With `instanced`: how many copies, groups and draws a pass (of the full model). */
  instanced?: { copies: number; groups: number; drawsPerPass: number };
  dispose(): void;
}

/**
 * Renderers whose own draw the copies of their mesh stand in for
 * (`EXT_mesh_gpu_instancing`): hidden while mounted, whatever else is shown.
 */
const replaced = new WeakSet<object>();
/** `out = a * b`, column-major 4 by 4. */
function multiply(a: ArrayLike<number>, b: ArrayLike<number>, out: Float32Array) {
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
}
/** The child indices that lead from a root down to a node below it. */
function pathBelow(root: any, node: any): number[] {
  const path: number[] = [];
  for (let at = node; at && at !== root; at = at.parent) {
    if (!at.parent) throw Error('Model mount: a node with copies is not in its model');
    path.unshift(at.parent.getChildIndex(at));
  }
  return path;
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
    const casts = options.castShadow !== false;
    // The flag LayaAir's editor hides things with: it skips a renderer in
    // every pass and leaves the scene's lists alone.
    const hidden = l.RenderBitFlag?.RenderBitFlag_Editor;
    // The nodes of a version whose mesh the file draws as copies, and where.
    const copiesOf = (version: ModelInstance) =>
      (version.gltfNodes ?? []).filter((item) => item.instances?.length);
    const meshOf = (node: any) =>
      node?.meshFilter?.sharedMesh ?? node?.getComponent?.(l.MeshFilter)?.sharedMesh;
    const rendererOf = (node: any) => node?.meshRenderer ?? node?.getComponent?.(l.MeshRenderer);
    // Drawn after the model stands where it is mounted, so that nothing made
    // for the copies is cloned or counted with the model's own nodes.
    const pending: { node: any; matrices: Float32Array; label: string }[] = [];
    const drawCopies = () => {
      for (const { node, matrices, label } of pending.splice(0)) {
        const renderer = rendererOf(node),
          mesh = meshOf(node);
        if (
          !renderer ||
          !mesh ||
          mesh.morphTargetData ||
          (l.SkinnedMeshRenderer && renderer instanceof l.SkinnedMeshRenderer)
        )
          throw Error('Model mount: a node with copies needs a plain mesh (no bones, no morphs)');
        const made = new ZhudaInstancedMesh(node, mesh, renderer.sharedMaterials, matrices, {
          castShadow: casts,
          follow: true,
          label,
        });
        replaced.add(renderer);
        if (hidden !== undefined) renderer.setRenderbitFlag(hidden, true);
        else renderer.enabled = false;
        cleanups.push(() => {
          made.dispose();
          replaced.delete(renderer);
          if (renderer.destroyed || renderer.owner?.destroyed) return;
          if (hidden !== undefined) renderer.setRenderbitFlag(hidden, false);
          else renderer.enabled = true;
        });
      }
    };
    // Every version of the model, the full one first.
    const versions = [instance, ...(options.lod ?? []).map((level) => level.instance)];
    const sources = versions.map((version) => zhudaModelRenderers(l, version.node));
    const from = (options.lod ?? []).map((level) => level.fromMeters);
    const levelled = versions.length > 1 || options.cullMeters !== undefined;
    const items: ZhudaLodItem[] = [];
    let instanced: ZhudaMountedModel['instanced'];
    if (options.instanced) {
      const placements = options.placements;
      if (!placements) throw Error('Model mount: instanced copies need placements');
      // Every mesh of the model falls into the groups of where the model stands.
      const anchors = new Float32Array(placements.length * 3);
      placements.forEach((place, i) => anchors.set([place[0], place[1], place[2]], i * 3));
      const meshes = versions.map((version, v) => {
        if (version.node.parent)
          throw Error('Model mount: an instanced model must not be in a scene already');
        const own = new Map(copiesOf(version).map((item) => [item.node as any, item.instances!]));
        if (own.size && levelled)
          throw Error(
            'Model mount: levels and a cull distance are not offered for instanced copies of a model whose file has copies of its own',
          );
        return sources[v].map((renderer) => {
          const owner = renderer.owner;
          const mesh =
            owner?.meshFilter?.sharedMesh ?? owner?.getComponent?.(l.MeshFilter)?.sharedMesh;
          if (
            !mesh ||
            (l.SkinnedMeshRenderer && renderer instanceof l.SkinnedMeshRenderer) ||
            mesh.morphTargetData
          )
            throw Error(
              'Model mount: instanced copies need plain meshes (no bones, no morph targets)',
            );
          // The model is not in a scene: a mesh's world matrix is its place inside the model.
          const inside = owner.transform.worldMatrix.elements;
          const within = own.get(owner);
          let matrices: Float32Array,
            stands = anchors;
          if (within) {
            // Every copy of the model draws every copy the file asks for.
            const each = within.length / 16,
              local = new Float32Array(16);
            matrices = new Float32Array(placements.length * each * 16);
            stands = new Float32Array(placements.length * each * 3);
            for (let i = 0; i < each; i++) {
              multiply(inside, within.subarray(i * 16, i * 16 + 16), local);
              const part = zhudaPlacementMatrices(placements, undefined, local);
              for (let p = 0; p < placements.length; p++) {
                matrices.set(part.subarray(p * 16, p * 16 + 16), (p * each + i) * 16);
                stands.set(anchors.subarray(p * 3, p * 3 + 3), (p * each + i) * 3);
              }
            }
          } else matrices = zhudaPlacementMatrices(placements, undefined, inside);
          const made = new ZhudaInstancedMesh(holder, mesh, renderer.sharedMaterials, matrices, {
            castShadow: casts,
            anchors: stands,
            cellMeters: options.cellMeters,
            label: `${options.label ?? 'ZhudaModel'}:${v}`,
          });
          cleanups.push(() => made.dispose());
          return made;
        });
      });
      const full = meshes[0];
      instanced = full.reduce(
        (sum, mesh) => ({
          copies: placements.length,
          groups: Math.max(sum.groups, mesh.stats.groups),
          drawsPerPass: sum.drawsPerPass + mesh.stats.drawsPerPass,
        }),
        { copies: 0, groups: 0, drawsPerPass: 0 },
      );
      if (levelled && full.length)
        full[0].groups.forEach((group, g) =>
          items.push({
            anchor: {
              transform: {
                get position() {
                  return group.renderer.bounds.getCenter();
                },
              },
            },
            // A level is every mesh of that version, for this group.
            nodes: meshes.map((version) => ({
              zhudaRenderers: version.map((mesh) => mesh.groups[g].renderer),
            })),
            from,
            cull: options.cullMeters,
          }),
        );
    } else if (options.placements) {
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
            for (const item of copiesOf(version))
              pending.push({
                node: item.node,
                matrices: item.instances!,
                label: `${options.label ?? 'ZhudaModel'}:${i}:copies`,
              });
            return version.node;
          }
          const copy = version.node.clone();
          place.addChild(copy);
          // At once, not on the next frame as LayaAir would: the clone's
          // renderers hold the model's meshes and materials, and the library
          // may destroy the model in the same breath. What is still held then
          // is skipped and never destroyed.
          cleanups.push(() => destroyLaya342ModelTree(copy));
          // The clone keeps the model's child order: the same way down finds the same node.
          for (const item of copiesOf(version)) {
            let node = copy;
            for (const index of pathBelow(version.node, item.node)) node = node?.getChildAt(index);
            if (!node) throw Error('Model mount: a node with copies is missing from the clone');
            pending.push({
              node,
              matrices: item.instances!,
              label: `${options.label ?? 'ZhudaModel'}:${i}:copies`,
            });
          }
          // Laya's clone does not keep the material of every sub-mesh: take
          // them from the source.
          zhudaModelRenderers(l, copy).forEach((renderer, k) => {
            if (sources[v][k]) renderer.sharedMaterials = sources[v][k].sharedMaterials;
            renderer.castShadow = casts;
            renderer.receiveShadow = true;
          });
          return copy;
        });
        if (levelled) items.push({ anchor: place, nodes, from, cull: options.cullMeters });
      });
    } else {
      for (const version of versions) {
        holder.addChild(version.node);
        for (const item of copiesOf(version))
          pending.push({
            node: item.node,
            matrices: item.instances!,
            label: `${options.label ?? 'ZhudaModel'}:copies`,
          });
      }
      if (levelled && versions.length === 1) {
        // One model, only a distance beyond which it is not drawn: each of
        // its meshes is measured by itself, to the middle of its own box. A
        // model cut into squares (zhuda-laya-lod --split) then stops drawing
        // square by square, not all at once by where its origin lies.
        const parts: any[] = [];
        const visit = (node: any) => {
          if (node.meshRenderer ?? node.getComponent?.(l.MeshRenderer)) parts.push(node);
          for (let i = 0; i < (node.numChildren || 0); i++) visit(node.getChildAt(i));
        };
        visit(instance.node);
        for (const part of parts) {
          const renderer = part.meshRenderer ?? part.getComponent(l.MeshRenderer);
          items.push({
            anchor: {
              transform: {
                get position() {
                  return renderer.bounds.getCenter();
                },
              },
            },
            nodes: [part],
            from,
            cull: options.cullMeters,
          });
        }
        if (!parts.length)
          items.push({ anchor: holder, nodes: [instance.node], from, cull: options.cullMeters });
      } else if (levelled)
        items.push({
          anchor: holder,
          nodes: versions.map((version) => version.node),
          from,
          cull: options.cullMeters,
        });
    }
    // The library destroys the instances; detach them first so the holder does not.
    for (const version of versions) cleanups.push(() => version.node.removeSelf());
    drawCopies();
    const materials = new Set<any>();
    for (const renderers of sources)
      for (const renderer of renderers) {
        renderer.castShadow = casts;
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
      const drawn = new Map<any, any[]>();
      const show = (node: any, visible: boolean) => {
        // An instanced level is a list of group renderers, not a node.
        const listed: any[] | undefined = node.zhudaRenderers;
        if (hidden === undefined) {
          if (listed) for (const renderer of listed) renderer.owner.active = visible;
          else node.active = visible;
          return;
        }
        let renderers = listed ?? drawn.get(node);
        if (!renderers) drawn.set(node, (renderers = zhudaModelRenderers(l, node)));
        // A renderer its copies stand in for stays hidden.
        for (const renderer of renderers)
          if (!(visible && replaced.has(renderer))) renderer.setRenderbitFlag(hidden, !visible);
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
    return { renderers: source, lod, instanced, setEmission, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
