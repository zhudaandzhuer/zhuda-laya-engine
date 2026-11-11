/**
 * Turns the scenery of a film scene into a model prefab, so the same models
 * at the same places can be instantiated in a game Scene through
 * `ZhudaPrefabLibrary`.
 *
 * A prefab holds scenery only. What a film scene says about the camera, the
 * look (sun, sky, fog, grade), water, reflectors, lights and built-in boxes
 * stays with the Scene that instantiates the prefab; so do lightmaps,
 * animation and motion of model nodes. Everything left out is listed, never
 * dropped silently.
 */
import type { PrefabModelNode, PrefabModelsDefinition } from '../prefabs/PrefabLibrary.ts';
import { validatePrefabModels } from '../prefabs/PrefabLibrary.ts';
import { parseZhudaFilmScene, type ZhudaFilmScene } from './FilmScene.ts';

export interface ZhudaFilmPrefabResult {
  definition: PrefabModelsDefinition;
  /** What the film scene holds that the prefab does not, for the Scene to supply. */
  left: string[];
}

export function zhudaPrefabFromFilmScene(
  scene: ZhudaFilmScene,
  id: string,
  options: { assets?: readonly string[] } = {},
): ZhudaFilmPrefabResult {
  if (typeof id !== 'string' || !id) throw Error('Prefab id required');
  // Model nodes are only valid against an asset list; take the scene's own by default.
  const named = (scene?.nodes ?? []).flatMap((node) =>
    node && node.type === 'model'
      ? [node.asset, node.lightmap, node.lightmapDirection].filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  );
  const look = scene?.look;
  if (look && typeof look.panorama === 'object' && look.panorama) named.push(look.panorama.asset);
  const parsed = parseZhudaFilmScene(scene, {
    assets: options.assets ?? named,
    // Props and recipes are not part of a prefab; accept whatever the scene names.
    props: (scene?.nodes ?? []).flatMap((node) => (node?.type === 'prop' ? [node.prop] : [])),
    recipes: Object.values(scene?.materials ?? {}).flatMap((material) =>
      typeof (material as { recipe?: unknown }).recipe === 'string'
        ? [(material as { recipe: string }).recipe]
        : [],
    ),
  });
  const nodes: PrefabModelNode[] = [];
  const left: string[] = ['camera', 'look (sun, sky, ambient, fog, grade, light fog, environment)'];
  for (const node of parsed.nodes) {
    if (node.type !== 'model') {
      left.push(`${node.type} node ${node.id}`);
      continue;
    }
    for (const key of ['lightmap', 'lightmapDirection', 'animation', 'motion'] as const)
      if (node[key] !== undefined) left.push(`${key} of model ${node.id}`);
    nodes.push({
      name: node.id,
      asset: node.asset,
      ...(node.position.some((value) => value !== 0)
        ? { position: [...node.position] as [number, number, number] }
        : {}),
      ...(node.yawDeg ? { yawDeg: node.yawDeg } : {}),
      ...(node.scale !== undefined && node.scale !== 1 ? { scale: node.scale } : {}),
      ...(node.placements
        ? { placements: node.placements.map((place) => [...place] as typeof place) }
        : {}),
      ...(node.translucent ? { translucent: true } : {}),
      ...(node.emission !== undefined && node.emission !== 1 ? { emission: node.emission } : {}),
    });
  }
  if (!nodes.length) throw Error('The film scene has no model nodes to make a prefab from');
  const definition: PrefabModelsDefinition = {
    id,
    kind: 'models',
    nodes,
    states: { default: {} },
  };
  validatePrefabModels(definition);
  return { definition, left };
}
