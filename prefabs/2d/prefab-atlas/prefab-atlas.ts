// Pictures for dynamic 2D views taken from a checked prefab, never from a second URL or cache.
//
// A prefab-first game checks each atlas alone (zhuda.config.json prefabChecks) and then
// mounts the very same definition in its scene. Views that cut cells out of the atlas
// (monsters, poses, icons) take the decoded texture of that mounted instance:
//
//   const library = new ZhudaPrefabLibrary({ provider, definitions });
//   const creatures = await mountAtlasPrefab(library, 'visual/creatures-atlas', 'CreaturesAtlas', layer);
//   icon.graphics.drawTexture(gridCellAt(creatures.texture, 5, 2, 7), 0, 0, 120, 120);   // cell 7 of a 5×2 grid
//   …
//   creatures.instance.dispose();   // with the scene
//
// From games/dungeon-spin (Main.ts and its views), where three atlases were used this way.
import type { PrefabInstance, ZhudaPrefabLibrary } from 'zhuda-laya-engine';

export interface AtlasPrefab {
  /** The mounted prefab instance: keep it for as long as any cell is drawn, dispose it with the scene. */
  instance: PrefabInstance;
  /** The prefab's image node. */
  image: Laya.Image;
  /** Its decoded texture, the one the prefab check drew. */
  texture: Laya.Texture;
}

/**
 * Instantiates a 2D prefab under `parent`, hides it, and returns the texture of its image
 * node `node`. Throws when the node has no decoded picture.
 */
export async function mountAtlasPrefab(library: ZhudaPrefabLibrary, id: string, node: string, parent: Laya.Node, state = 'idle'): Promise<AtlasPrefab> {
  const instance = await library.instantiate(id, { state, parent });
  instance.root.visible = false;
  const image = instance.find(node) as Laya.Image;
  if (!image.source) throw new Error(`Verified prefab ${id} did not expose its texture (${node})`);
  return { instance, image, texture: image.source };
}

/** Cell (col, row) of an atlas laid out as `cols` × `rows` equal cells (sizes may be fractional). */
export function gridCell(texture: Laya.Texture, cols: number, rows: number, col: number, row: number): Laya.Texture {
  const cellW = texture.width / cols;
  const cellH = texture.height / rows;
  return Laya.Texture.createFromTexture(texture, col * cellW, row * cellH, cellW, cellH);
}

/** Cell number `index` of a `cols` × `rows` atlas, counted along rows from the top left. */
export function gridCellAt(texture: Laya.Texture, cols: number, rows: number, index: number): Laya.Texture {
  return gridCell(texture, cols, rows, index % cols, Math.floor(index / cols));
}
