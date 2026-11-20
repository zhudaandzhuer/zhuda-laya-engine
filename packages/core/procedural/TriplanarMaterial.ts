/**
 * A baked texture set laid on a surface by where it is in the world, not by
 * the mesh's texture coordinates: three flat projections along the world
 * axes, mixed by which way the surface faces. A steep slope then shows the
 * recipe at its true size instead of stretched down the slope, and meshes
 * that meet (a rock on a cliff, two props side by side) carry one pattern
 * across the join.
 *
 * `top` lays a second set where the surface faces up: moss on the top of a
 * stone, snow on a ledge, dust on a shelf.
 *
 * Three reads of each of the three maps a pixel (six more with `top`),
 * against one each for `createZhudaProceduralMaterial`: use it where the
 * stretching shows, not everywhere. Lit, shadowed and occluded like any
 * material of the engine (`ZhudaLitSurfaceMaterial`).
 */
import { ZhudaLitSurfaceMaterial } from '../shaders/LitSurfaceMaterial.ts';
import { createSurfaceTexture } from '../runtime3d/Surfaces.ts';
import type { ZhudaBakedTextureSet } from './TextureRecipe.ts';

export interface ZhudaTriplanarMaterialOptions {
  /** Multiplies the base colour, as `createZhudaProceduralMaterial`'s tint; default white. */
  tint?: readonly [number, number, number, number];
  /**
   * A second set where the surface faces up. `from` and `to` are the
   * upward share of the surface normal (1 = level, 0 = a wall) between which
   * it comes in: defaults 0.55 and 0.8.
   */
  top?: { set: ZhudaBakedTextureSet; from?: number; to?: number };
  mipmap?: boolean;
}

export interface ZhudaTriplanarMaterial {
  readonly material: any;
  dispose(): void;
}

/** Checked options: `from` below `to`, both 0..1. Pure. */
export function zhudaTriplanarTopRange(top: { from?: number; to?: number }): [number, number] {
  const from = top.from ?? 0.55,
    to = top.to ?? 0.8;
  if (!(Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to <= 1 && from < to))
    throw Error('Triplanar top: from and to are 0..1, from below to');
  return [from, to];
}

// The picture's top is up on a wall (v runs down the world's y); on level
// ground u runs along x and v along z. A DirectX normal map's green points
// down the picture, which on a wall is down the world.
const projections = (prefix: string) => `
vec2 uvX=vec2(worldPosition.z,-worldPosition.y)*${prefix}Scale.xy;
vec2 uvY=worldPosition.xz*${prefix}Scale.xy;
vec2 uvZ=vec2(worldPosition.x,-worldPosition.y)*${prefix}Scale.xy;`;
const read = (prefix: string, into: string) => `
vec4 ${into}C=zhudaSample_${prefix}Albedo(uvX)*w.x+zhudaSample_${prefix}Albedo(uvY)*w.y+zhudaSample_${prefix}Albedo(uvZ)*w.z;
vec4 ${into}M=zhudaSample_${prefix}Mask(uvX)*w.x+zhudaSample_${prefix}Mask(uvY)*w.y+zhudaSample_${prefix}Mask(uvZ)*w.z;
vec3 ${into}TX=zhudaSample_${prefix}Normal(uvX).xyz*2.0-1.0;
vec3 ${into}TY=zhudaSample_${prefix}Normal(uvY).xyz*2.0-1.0;
vec3 ${into}TZ=zhudaSample_${prefix}Normal(uvZ).xyz*2.0-1.0;
vec3 ${into}N=vec3(${into}TX.z*n.x,n.y-${into}TX.y,n.z+${into}TX.x)*w.x
 +vec3(n.x+${into}TY.x,${into}TY.z*n.y,n.z+${into}TY.y)*w.y
 +vec3(n.x+${into}TZ.x,n.y-${into}TZ.y,${into}TZ.z*n.z)*w.z;`;
const SURFACE = `void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 worldPosition,vec3 worldNormal){
vec3 n=normalize(worldNormal);
vec3 w=zhudaTriplanarWeights(n);
${projections('u_ZhudaTri')}
${read('u_ZhudaTri', 'a')}
vec3 color=aC.rgb;vec4 mask=aM;vec3 bent=aN;
#TOP#
s.baseColor*=color;
s.metallic=mask.r;
s.roughness=1.0-mask.a;
bent=normalize(bent);
s.normalTS=normalize(vec3(dot(bent,s.tangent),dot(bent,s.bitangent),max(dot(bent,n),0.05)));
}`;
const TOP = `
{
vec2 uvT=worldPosition.xz*u_ZhudaTriTopScale.xy;
float up=smoothstep(u_ZhudaTriTopScale.z,u_ZhudaTriTopScale.w,n.y);
vec3 tT=zhudaSample_u_ZhudaTriTopNormal(uvT).xyz*2.0-1.0;
color=mix(color,zhudaSample_u_ZhudaTriTopAlbedo(uvT).rgb,up);
mask=mix(mask,zhudaSample_u_ZhudaTriTopMask(uvT),up);
bent=mix(bent,vec3(n.x+tT.x,tT.z*n.y,n.z+tT.y),up);
}`;

export function createZhudaTriplanarMaterial(
  set: ZhudaBakedTextureSet,
  options: ZhudaTriplanarMaterialOptions = {},
): ZhudaTriplanarMaterial {
  for (const one of [set, options.top?.set])
    if (one && one.normalConvention !== 'directx')
      throw Error('Laya expects directx (-Y) normal maps; bake with normalConvention: "directx"');
  const range = options.top ? zhudaTriplanarTopRange(options.top) : undefined;
  const mipmap = options.mipmap ?? true,
    textures: any[] = [];
  const maps = (one: ZhudaBakedTextureSet) => {
    const made = [
      createSurfaceTexture(one.size, one.size, one.albedo, 'color', { mipmap }),
      createSurfaceTexture(one.size, one.size, one.normal, 'normal', { mipmap }),
      createSurfaceTexture(one.size, one.size, one.metallicGloss, 'data', { mipmap }),
    ];
    textures.push(...made);
    return made;
  };
  let lit: ZhudaLitSurfaceMaterial | undefined;
  try {
    const base = maps(set),
      over = options.top ? maps(options.top.set) : undefined;
    lit = new ZhudaLitSurfaceMaterial(
      {
        name: over ? 'ZhudaTriplanarTop' : 'ZhudaTriplanar',
        common: true,
        surface: SURFACE.replace('#TOP#', over ? TOP : ''),
        uniforms: {
          u_ZhudaTriAlbedo: { type: 'texture2D' },
          u_ZhudaTriNormal: { type: 'texture2D' },
          u_ZhudaTriMask: { type: 'texture2D' },
          u_ZhudaTriScale: {
            type: 'vec4',
            value: [1 / set.tileMeters[0], 1 / set.tileMeters[1], 0, 0],
          },
          ...(over
            ? {
                u_ZhudaTriTopAlbedo: { type: 'texture2D' },
                u_ZhudaTriTopNormal: { type: 'texture2D' },
                u_ZhudaTriTopMask: { type: 'texture2D' },
                u_ZhudaTriTopScale: {
                  type: 'vec4',
                  value: [
                    1 / options.top!.set.tileMeters[0],
                    1 / options.top!.set.tileMeters[1],
                    range![0],
                    range![1],
                  ],
                },
              }
            : {}),
        },
        material: { color: [...(options.tint ?? [1, 1, 1, 1])], metallic: 0, roughness: 1 },
      },
      {
        u_ZhudaTriAlbedo: base[0],
        u_ZhudaTriNormal: base[1],
        u_ZhudaTriMask: base[2],
        ...(over
          ? {
              u_ZhudaTriTopAlbedo: over[0],
              u_ZhudaTriTopNormal: over[1],
              u_ZhudaTriTopMask: over[2],
            }
          : {}),
      },
    );
  } catch (error) {
    for (const texture of textures) texture.destroy?.();
    throw error;
  }
  const made = lit;
  let disposed = false;
  return {
    material: made.material,
    dispose() {
      if (disposed) return;
      disposed = true;
      made.dispose();
      for (const texture of textures) texture.destroy?.();
    },
  };
}
