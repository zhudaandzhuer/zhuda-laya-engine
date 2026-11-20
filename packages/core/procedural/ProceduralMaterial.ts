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
import { bakeZhudaVariation } from './Variation.ts';

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
  /**
   * Slow changes of brightness over the surface, so that its tiles do not
   * read as a grid: how far the brightness strays (`amount`, 0..1) and how
   * large the changes are (`meters`: several tiles, and not a multiple of
   * one). Off unless given. It is the material's detail map.
   */
  variation?: { amount: number; meters: number; seed?: number };
  /**
   * How the baked alpha is used (a recipe's `alpha`): 'cutout' draws where it
   * is above `alphaCutoff` (default 0.5) and keeps depth and shadows, 'alpha'
   * and 'additive' blend. Default 'opaque': the alpha is ignored.
   */
  blend?: 'opaque' | 'cutout' | 'alpha' | 'additive';
  alphaCutoff?: number;
  /** Both faces are drawn: one sheet for a leaf or a blade, not two back to back. */
  doubleSided?: boolean;
  /**
   * Fine detail for close range: a second baked set laid over the first,
   * repeating every `meters` (well under the base tile: grain, pores,
   * scratches). Its colour changes the base's brightness and tone by
   * `albedo` (0..1, default 0.5) about the set's own mean, so the surface
   * keeps its overall colour; its normal map is added at `normal` (0..2,
   * default 1). Far away its small mip levels are its mean, which changes
   * nothing: it fades by itself. It is the material's one detail map: not
   * together with `variation`.
   */
  detail?: { set: ZhudaBakedTextureSet; meters: number; albedo?: number; normal?: number };
}

export interface ZhudaProceduralMaterial {
  readonly material: any;
  readonly textures: readonly any[];
  /** Destroys the material and the textures it owns. */
  dispose(): void;
}

/**
 * A baked albedo map as LayaAir's detail map: each channel as a share of its
 * mean, about the value that leaves the base unchanged, `strength` of the way
 * from it. LayaAir multiplies the base by the detail in linear light times
 * 4.5948 (2 to the power 2.2), so that value is 1 / 4.5948. Pure.
 */
export function zhudaDetailPixels(albedo: Uint8Array, strength: number): Uint8Array {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const toDisplay = (v: number) => {
    const c = v <= 0 ? 0 : v >= 1 ? 1 : v;
    return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
  };
  const count = albedo.length / 4,
    mean = [0, 0, 0];
  for (let i = 0; i < albedo.length; i += 4)
    for (let c = 0; c < 3; c++) mean[c] += toLinear(albedo[i + c]);
  for (let c = 0; c < 3; c++) mean[c] = mean[c] / count || 1;
  const out = new Uint8Array(albedo.length);
  for (let i = 0; i < albedo.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const ratio = toLinear(albedo[i + c]) / mean[c];
      out[i + c] = toDisplay((1 + (ratio - 1) * strength) / 4.5947938);
    }
    out[i + 3] = 255;
  }
  return out;
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
      ...(options.blend ? { blend: options.blend } : {}),
      ...(options.alphaCutoff !== undefined ? { alphaCutoff: options.alphaCutoff } : {}),
      ...(options.doubleSided ? { doubleSided: true } : {}),
    });
    if (uvUnit === 'meters')
      material.tilingOffset = new l.Vector4(1 / set.tileMeters[0], 1 / set.tileMeters[1], 0, 0);
    const fine = options.detail;
    if (fine) {
      if (options.variation && options.variation.amount > 0)
        throw Error('detail and variation share the one detail map: use one of them');
      if (!(Number.isFinite(fine.meters) && fine.meters > 0))
        throw Error('detail.meters must be positive');
      const strength = fine.albedo ?? 0.5,
        relief = fine.normal ?? 1;
      if (!(strength >= 0 && strength <= 1)) throw Error('detail.albedo: use 0..1');
      if (!(relief >= 0 && relief <= 2)) throw Error('detail.normal: use 0..2');
      if (fine.set.normalConvention !== 'directx')
        throw Error('detail: bake with normalConvention: "directx"');
      const side = fine.set.size;
      const map = createSurfaceTexture(
        side,
        side,
        zhudaDetailPixels(fine.set.albedo, strength),
        'color',
        {
          mipmap,
        },
      );
      textures.push(map);
      material.detailAlbedoTexture = map;
      if (relief > 0) {
        const bumps = createSurfaceTexture(side, side, fine.set.normal, 'normal', { mipmap });
        textures.push(bumps);
        material.detailNormalTexture = bumps;
        material.detailNormalScale = relief;
      }
      const [u, v] = uvUnit === 'meters' ? [1, 1] : set.tileMeters;
      material.detailTilingOffset = new l.Vector4(u / fine.meters, v / fine.meters, 0, 0);
    }
    const variation = options.variation;
    if (variation && variation.amount > 0) {
      if (!(Number.isFinite(variation.meters) && variation.meters > 0))
        throw Error('variation.meters must be positive');
      const baked = bakeZhudaVariation({ amount: variation.amount, seed: variation.seed });
      const detail = createSurfaceTexture(baked.size, baked.size, baked.pixels, 'color', {
        mipmap,
      });
      textures.push(detail);
      material.detailAlbedoTexture = detail;
      // The detail map reads the mesh UVs, like the base maps.
      const [u, v] = uvUnit === 'meters' ? [1, 1] : set.tileMeters;
      material.detailTilingOffset = new l.Vector4(u / variation.meters, v / variation.meters, 0, 0);
    }
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
