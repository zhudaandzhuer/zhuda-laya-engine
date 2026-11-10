/**
 * Renderer hand-off for a baked texture set. Requires the Laya runtime.
 *
 * Uses the engine's existing surface helpers, so texture colour space and
 * material ownership follow the same rules as loaded assets.
 */
import {
  createSurfaceMaterial,
  createSurfaceTexture,
  disposeSurfaceMaterial,
} from '../runtime3d/Surfaces.ts';
import type { ZhudaBakedTextureSet } from './TextureRecipe.ts';

export interface ZhudaProceduralMaterialOptions {
  /** Multiplies the baked colour, so one texture set can serve several paint colours. */
  tint?: [number, number, number, number];
  /**
   * 'meters' (default): mesh UVs are in metres and the material repeats every
   * `tileMeters`. 'tile': UVs already span 0..1 per tile.
   */
  uvUnit?: 'meters' | 'tile';
  /** Upload with mipmaps (default true); tiled surfaces shimmer without them. */
  mipmap?: boolean;
}

export interface ZhudaProceduralMaterial {
  readonly material: any;
  readonly textures: readonly any[];
  /** Destroys the material and the three textures it owns. */
  dispose(): void;
}

export function createZhudaProceduralMaterial(
  set: ZhudaBakedTextureSet,
  options: ZhudaProceduralMaterialOptions = {},
): ZhudaProceduralMaterial {
  if (set.normalConvention !== 'directx')
    throw Error('Laya expects directx (-Y) normal maps; bake with normalConvention: "directx"');
  const uvUnit = options.uvUnit ?? 'meters';
  if (uvUnit !== 'meters' && uvUnit !== 'tile') throw Error('uvUnit must be meters or tile');
  const l = (globalThis as any).Laya,
    mipmap = options.mipmap ?? true,
    textures: any[] = [];
  let material: any;
  try {
    textures.push(createSurfaceTexture(set.size, set.size, set.albedo, 'color', { mipmap }));
    textures.push(createSurfaceTexture(set.size, set.size, set.normal, 'normal', { mipmap }));
    textures.push(createSurfaceTexture(set.size, set.size, set.metallicGloss, 'data', { mipmap }));
    // With a metallic-gloss map Laya reads metallic from R and multiplies A by
    // the smoothness factor, so the factor must stay at 1 (roughness 0).
    material = createSurfaceMaterial({
      type: 'pbr',
      color: options.tint ?? [1, 1, 1, 1],
      metallic: 0,
      roughness: 0,
      textures: { albedo: textures[0], normal: textures[1], metallicGloss: textures[2] },
    });
    if (uvUnit === 'meters')
      material.tilingOffset = new l.Vector4(1 / set.tileMeters[0], 1 / set.tileMeters[1], 0, 0);
  } catch (error) {
    for (const texture of textures) texture.destroy();
    throw error;
  }
  let disposed = false;
  return {
    material,
    textures,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeSurfaceMaterial(material);
      for (const texture of textures) texture.destroy();
    },
  };
}
