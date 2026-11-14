/**
 * Cel shading on the lit template: the light a point receives (N·L times its
 * shadow) is cut into bands instead of fading, per light, for every light
 * LayaAir gives the surface: directional, point and spot, with their
 * shadows. The band edge follows the cast shadow too, so a shadow has the
 * same hard rim as the shaded side. A highlight with a hard rim, a rim
 * light and an outline are optional.
 *
 * The outline is a second forward pass of the same material: the mesh drawn
 * again inside out, pushed along its normals, in one colour. It follows
 * skinning, instancing and the vertex hook because it is the same vertex
 * program. A mesh with split normals (a cube's corners) opens gaps in it:
 * give such meshes smooth normals. It is not in the depth texture, so depth
 * of field and fog by depth see what is behind the line.
 *
 * Only the class needs the Laya runtime; the ramp functions are plain.
 */
import { zhudaSrgbToLinear, type SurfaceMaterialSpec } from '../runtime3d/Surfaces.ts';
import {
  ZhudaLitSurfaceMaterial,
  type ZhudaLitShading,
  type ZhudaLitSurfaceSpec,
} from './LitSurfaceMaterial.ts';
import { litShadowFragment } from './LitSurfaceTemplates.ts';
import type { ShaderUniformSpec } from './ShaderMaterials.ts';

export interface ZhudaToonRamp {
  /**
   * Where one band ends and the next begins, on the light a point receives
   * (N·L times its shadow, 0..1): one to four values, ascending, inside 0..1.
   */
  edges: readonly number[];
  /**
   * How bright each band is, darkest first: one more value than `edges`, not
   * decreasing, 0..4. The first is the side turned from the light and its
   * shadows; 1 is the light at full.
   */
  levels: readonly number[];
  /** Width of the blend across an edge, in the unit of `edges` (default 0.02; 0 is a hard step). */
  softness?: number;
}
export type ZhudaToonColor = readonly [number, number, number];
export interface ZhudaToonHighlight {
  /** Display colour (as a colour picker gives it). */
  color: ZhudaToonColor;
  /** Half-angle of the highlight in degrees, above 0 and up to 90: on a ball it is a disc this wide. */
  sizeDeg: number;
  /** Multiplies the colour (default 1; above 1 it is bright enough to bloom), 0..16. */
  strength?: number;
  /** Width of the blend across its rim, on N·H (default 0.01), 0..1. */
  softness?: number;
}
export interface ZhudaToonRim {
  /** Display colour. */
  color: ZhudaToonColor;
  /** How far in from the silhouette the rim reaches, above 0 and up to 1 (0.3 is a thin rim). */
  width: number;
  /** Multiplies the colour (default 1), 0..16. */
  strength?: number;
  /** Width of the blend across its inner edge (default 0.02), 0..1. */
  softness?: number;
}
export interface ZhudaToonOutline {
  /** Display colour. */
  color: ZhudaToonColor;
  /**
   * `screen` (default): pixels of the picture being drawn, the same at any
   * distance, 0..32. `world`: scene units, thinner with distance, 0..10.
   */
  width: number;
  space?: 'screen' | 'world';
}
export interface ZhudaToonAmbient {
  /** How much of the scene's ambient light the surface takes (default 1), 0..8. */
  strength?: number;
  /**
   * 1 (default): the same on every side, the flat shade of a drawing. 0: as
   * the scene's ambient light falls on each side, like the other materials.
   */
  flat?: number;
}
export interface ZhudaToonSpec {
  /** Shader name: `Zhuda` then letters, digits or `_`. Materials of one name share a shader. */
  name: string;
  /** Default: two bands, `ZHUDA_TOON_DEFAULT_RAMP`. */
  ramp?: ZhudaToonRamp;
  highlight?: ZhudaToonHighlight;
  rim?: ZhudaToonRim;
  /** Whether a shader has the outline pass is fixed by the first material of its name. */
  outline?: ZhudaToonOutline;
  ambient?: ZhudaToonAmbient;
  /** As `ZhudaLitSurfaceSpec.surface`; metallic and roughness are not used. */
  surface?: string;
  /** As `ZhudaLitSurfaceSpec.vertex`; the outline moves with it. */
  vertex?: string;
  normalConvention?: 'directx' | 'opengl';
  backFaces?: 'mirrored' | 'same';
  /** Custom uniforms for the hooks; names beginning `u_ZhudaToon` or `u_ZhudaOutline` are the material's own. */
  uniforms?: Record<string, ShaderUniformSpec>;
  material?: Omit<
    SurfaceMaterialSpec,
    'type' | 'metallic' | 'roughness' | 'clearCoat' | 'clearCoatRoughness'
  >;
}

/** Two bands: the lit side at full, the rest at 0.45. */
export const ZHUDA_TOON_DEFAULT_RAMP: ZhudaToonRamp = Object.freeze({
  edges: Object.freeze([0.4]),
  levels: Object.freeze([0.45, 1]),
  softness: 0.02,
}) as ZhudaToonRamp;

const finite = (v: unknown, low: number, high: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const colour = (v: unknown): v is ZhudaToonColor =>
  Array.isArray(v) && v.length === 3 && v.every((x) => finite(x, 0, 1));

/** Problems with a ramp; an empty list means the material takes it. */
export function validateZhudaToonRamp(ramp: unknown): string[] {
  const r = ramp as ZhudaToonRamp;
  if (!r || typeof r !== 'object' || !Array.isArray(r.edges) || !Array.isArray(r.levels))
    return ['ramp: expected { edges: number[], levels: number[] }'];
  const e: string[] = [];
  if (r.edges.length < 1 || r.edges.length > 4) e.push('ramp.edges: one to four values');
  if (!r.edges.every((v) => finite(v, 0, 1) && v > 0 && v < 1))
    e.push('ramp.edges: each inside 0..1 (not 0, not 1)');
  else if (r.edges.some((v, i) => i > 0 && v <= r.edges[i - 1]))
    e.push('ramp.edges: ascending, no two the same');
  if (r.levels.length !== r.edges.length + 1)
    e.push('ramp.levels: one more value than ramp.edges (a level for each band)');
  if (!r.levels.every((v) => finite(v, 0, 4))) e.push('ramp.levels: each 0..4');
  else if (r.levels.some((v, i) => i > 0 && v < r.levels[i - 1]))
    e.push('ramp.levels: not decreasing (the darkest band first)');
  if (r.softness !== undefined && !finite(r.softness, 0, 1)) e.push('ramp.softness: use 0..1');
  return e;
}

/**
 * A ramp of `bands` equal bands (2 to 5): the darkest at `darkest` (default
 * 0.3), the brightest at 1, the ones between evenly spaced. The first edge
 * is at `from` (default 0.15) and the last at `to` (default 0.75).
 */
export function zhudaToonRamp(
  bands: number,
  options: { darkest?: number; from?: number; to?: number; softness?: number } = {},
): ZhudaToonRamp {
  if (!Number.isInteger(bands) || bands < 2 || bands > 5)
    throw Error('Toon ramp: 2 to 5 bands (whole number)');
  const { darkest = 0.3, from = 0.15, to = 0.75, softness = 0.02 } = options;
  if (!finite(darkest, 0, 1)) throw Error('Toon ramp: darkest 0..1');
  if (!finite(from, 0, 1) || !finite(to, 0, 1) || from <= 0 || to >= 1 || from > to)
    throw Error('Toon ramp: 0 < from <= to < 1');
  const edges: number[] = [];
  const levels: number[] = [];
  for (let i = 0; i < bands; i++) {
    levels.push(darkest + ((1 - darkest) * i) / (bands - 1));
    if (i < bands - 1)
      edges.push(bands === 2 ? (from + to) / 2 : from + ((to - from) * i) / (bands - 2));
  }
  const ramp = { edges, levels, softness };
  const problems = validateZhudaToonRamp(ramp);
  if (problems.length) throw Error('Toon ramp: ' + problems.join('; '));
  return ramp;
}

const smooth = (low: number, high: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
/**
 * The brightness the shader gives a point that receives `lit` (N·L times
 * its shadow, 0..1): the same arithmetic as the shader, for tests and tools.
 */
export function zhudaToonBand(ramp: ZhudaToonRamp, lit: number): number {
  const half = Math.max((ramp.softness ?? 0.02) * 0.5, 1e-5);
  let value = ramp.levels[0];
  for (let i = 0; i < ramp.edges.length; i++)
    value += (ramp.levels[i + 1] - value) * smooth(ramp.edges[i] - half, ramp.edges[i] + half, lit);
  return value;
}

const OWN = /^u_Zhuda(?:Toon|Outline)/;
/** Problems with a toon spec; an empty list means `ZhudaToonMaterial` takes it. */
export function validateZhudaToonSpec(spec: unknown): string[] {
  const s = spec as ZhudaToonSpec;
  if (!s || typeof s !== 'object') return ['Expected a toon spec'];
  const e: string[] = [];
  if (typeof s.name !== 'string' || !/^Zhuda[A-Za-z0-9_]{1,100}$/.test(s.name))
    e.push('name: Zhuda, then letters/digits/_');
  if (s.ramp !== undefined) e.push(...validateZhudaToonRamp(s.ramp));
  if (s.highlight !== undefined) {
    const h = s.highlight;
    if (!h || !colour(h.color)) e.push('highlight.color: three numbers 0..1');
    if (!h || !finite(h.sizeDeg, 0, 90) || h.sizeDeg <= 0)
      e.push('highlight.sizeDeg: above 0, up to 90');
    if (h?.strength !== undefined && !finite(h.strength, 0, 16))
      e.push('highlight.strength: use 0..16');
    if (h?.softness !== undefined && !finite(h.softness, 0, 1))
      e.push('highlight.softness: use 0..1');
  }
  if (s.rim !== undefined) {
    const r = s.rim;
    if (!r || !colour(r.color)) e.push('rim.color: three numbers 0..1');
    if (!r || !finite(r.width, 0, 1) || r.width <= 0) e.push('rim.width: above 0, up to 1');
    if (r?.strength !== undefined && !finite(r.strength, 0, 16)) e.push('rim.strength: use 0..16');
    if (r?.softness !== undefined && !finite(r.softness, 0, 1)) e.push('rim.softness: use 0..1');
  }
  if (s.outline !== undefined) {
    const o = s.outline;
    if (!o || !colour(o.color)) e.push('outline.color: three numbers 0..1');
    if (o?.space !== undefined && o.space !== 'screen' && o.space !== 'world')
      e.push('outline.space: screen or world');
    if (!o || !finite(o.width, 0, o.space === 'world' ? 10 : 32))
      e.push('outline.width: 0..32 pixels (screen) or 0..10 units (world)');
  }
  if (s.ambient !== undefined) {
    const a = s.ambient;
    if (!a || typeof a !== 'object') e.push('ambient: expected { strength?, flat? }');
    else {
      if (a.strength !== undefined && !finite(a.strength, 0, 8)) e.push('ambient.strength: 0..8');
      if (a.flat !== undefined && !finite(a.flat, 0, 1)) e.push('ambient.flat: use 0..1');
    }
  }
  for (const name of Object.keys(s.uniforms ?? {}))
    if (OWN.test(name)) e.push(`uniform ${name}: u_ZhudaToon… and u_ZhudaOutline… are taken`);
  return e;
}

/** The surface hook of a toon material that has none: the material's own colour and textures. */
const PLAIN_SURFACE =
  'void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 worldPosition,vec3 worldNormal){}';

const BAND = `float zhudaToonBand(float x){float w=max(u_ZhudaToonBase.y*0.5,0.00001);float v=u_ZhudaToonBase.x;
v=mix(v,u_ZhudaToonLevels.x,smoothstep(u_ZhudaToonEdges.x-w,u_ZhudaToonEdges.x+w,x));
v=mix(v,u_ZhudaToonLevels.y,smoothstep(u_ZhudaToonEdges.y-w,u_ZhudaToonEdges.y+w,x));
v=mix(v,u_ZhudaToonLevels.z,smoothstep(u_ZhudaToonEdges.z-w,u_ZhudaToonEdges.z+w,x));
v=mix(v,u_ZhudaToonLevels.w,smoothstep(u_ZhudaToonEdges.w-w,u_ZhudaToonEdges.w+w,x));
return v;}
#if defined(DIRECTIONLIGHT) || defined(POINTLIGHT) || defined(SPOTLIGHT)
vec3 zhudaToonLight(const in Surface surface,const in PixelInfo info,const in Light light){
vec3 l=normalize(-light.dir);
// What the point receives: the shadow is inside the band, so it has the band's edge.
float lit=saturate(dot(info.normalWS,l))*light.attenuation;
vec3 c=surface.diffuseColor*zhudaToonBand(lit);
float hw=max(u_ZhudaToonShape.x,0.00001);
float nh=saturate(dot(info.normalWS,SafeNormalize(info.viewDir+l)));
float tw=max(u_ZhudaToonBase.y*0.5,0.00001);
// The highlight only where the first band is passed: none in shadow.
c+=u_ZhudaToonHighlight.rgb*smoothstep(u_ZhudaToonHighlight.a-hw,u_ZhudaToonHighlight.a+hw,nh)*smoothstep(u_ZhudaToonEdges.x-tw,u_ZhudaToonEdges.x+tw,lit);
return c*light.color;}
#endif
`;
// LayaAir 3.4.2's light loop (PBRFrag.glsl, MIT, Layabox) with the banded light in place of the physical one.
const FLOW = `vec4 zhudaToonFlow(const in SurfaceInputs inputs,in PixelParams pixel){
#ifdef ALPHATEST
if(inputs.alpha<inputs.alphaTest){discard;}
#endif
Surface surface;initSurface(surface,inputs,pixel);
// The whole base colour: a drawn surface is not a metal.
surface.diffuseColor=inputs.diffuseColor;
PixelInfo info;getPixelInfo(info,pixel,surface);
#ifdef LAYA_MRT
writeGBuffer(info.normalWS,inputs.diffuseColor,0.0,1.0,surface.occlusion);
#endif
vec3 color=vec3(0.0);
#ifdef DIRECTIONLIGHT
for(int i=0;i<CalculateLightCount;i++){if(i>=DirectionCount)break;DirectionLight directionLight=getDirectionLight(i,info.positionWS);if(directionLight.lightMode==LightMode_Mix){continue;}Light light=getLight(directionLight);color+=zhudaToonLight(surface,info,light);}
#endif
#if defined(POINTLIGHT) || defined(SPOTLIGHT)
ivec4 clusterInfo=getClusterInfo(u_View,u_Viewport,info.positionWS,gl_FragCoord,u_ProjectionParams);
#endif
#ifdef POINTLIGHT
for(int i=0;i<CalculateLightCount;i++){if(i>=clusterInfo.x)break;PointLight pointLight=getPointLight(i,clusterInfo,info.positionWS);if(pointLight.lightMode==LightMode_Mix){continue;}Light light=getLight(pointLight,info.normalWS,info.positionWS);color+=zhudaToonLight(surface,info,light);}
#endif
#ifdef SPOTLIGHT
for(int i=0;i<CalculateLightCount;i++){if(i>=clusterInfo.y)break;SpotLight spotLight=getSpotLight(i,clusterInfo,info.positionWS);if(spotLight.lightMode==LightMode_Mix){continue;}Light light=getLight(spotLight,info.normalWS,info.positionWS);color+=zhudaToonLight(surface,info,light);}
#endif
#if defined(USELIGHTMAP)
color+=getBakedLightmapColor(info.lightmapUV,info.normalWS)*surface.diffuseColor;
#else
vec3 around=diffuseIrradiance(info.normalWS,info.positionWS,info.viewDir);
vec3 level=0.5*(diffuseIrradiance(vec3(0.0,1.0,0.0),info.positionWS,info.viewDir)+diffuseIrradiance(vec3(0.0,-1.0,0.0),info.positionWS,info.viewDir));
color+=surface.diffuseColor*mix(around,level,u_ZhudaToonBase.w)*surface.occlusion*u_ZhudaToonBase.z;
#endif
float rs=max(u_ZhudaToonShape.z,0.00001);
color+=u_ZhudaToonRim.rgb*smoothstep(u_ZhudaToonShape.y-rs,u_ZhudaToonShape.y+rs,1.0-info.NoV);
#ifdef EMISSION
color+=surface.emissionColor;
#endif
return vec4(color,surface.alpha);}
`;
/** The hull: along the normal by a width in pixels of the picture, or in scene units. */
const OUTLINE_PROJECT = `vec4 zhudaClip=u_ViewProjection*vec4(positionWS,1.0);
if(u_ZhudaOutlineShape.x>0.5){zhudaClip=u_ViewProjection*vec4(positionWS+normalWS*u_ZhudaOutline.a,1.0);}
else{vec4 zhudaAlong=u_ViewProjection*vec4(normalWS,0.0);vec2 zhudaWay=(zhudaAlong.xy*zhudaClip.w-zhudaClip.xy*zhudaAlong.w)*u_Viewport.zw;float zhudaLength=length(zhudaWay);
if(zhudaLength>0.000001){zhudaClip.xy+=zhudaWay/zhudaLength*(2.0*u_ZhudaOutline.a/u_Viewport.zw)*zhudaClip.w;}}
gl_Position=remapPositionZ(zhudaClip);
#ifdef FOG
FogHandle(gl_Position.z);
#endif
`;
const replaceOnce = (source: string, find: string, replacement: string) => {
  const at = source.indexOf(find);
  if (at < 0 || source.indexOf(find, at + 1) >= 0)
    throw Error('Lit template changed; the toon outline cannot be placed');
  return source.slice(0, at) + replacement + source.slice(at + find.length);
};
/**
 * The outline pass from a material's shadow programs: the same vertices
 * (skinning, the vertex hook, the alpha test), projected as a hull and
 * filled with one colour. Pure: no Laya needed.
 */
export function buildZhudaToonOutlinePass(shadowVertex: string): {
  vertex: string;
  fragment: string;
} {
  const vertex = replaceOnce(
    replaceOnce(
      replaceOnce(
        shadowVertex,
        '#define SHADER_NAME DepthVS',
        '#define SHADER_NAME ZhudaToonOutlineVS',
      ),
      // Not the depth include itself: its projection is only declared while a depth or shadow pass is drawn.
      '#include "DepthVertex.glsl";',
      '#include "Math.glsl";\n#include "Scene.glsl";\n#include "SceneFogInput.glsl";\n#include "Camera.glsl";\n#include "Sprite3DVertex.glsl";\n#include "VertexCommon.glsl";',
    ),
    'vec4 positionCS=DepthPositionCS(positionWS,normalWS);gl_Position=remapPositionZ(positionCS);',
    OUTLINE_PROJECT,
  );
  const fragment = replaceOnce(
    replaceOnce(
      replaceOnce(
        litShadowFragment,
        '#define SHADER_NAME PBRDepthFS',
        '#define SHADER_NAME ZhudaToonOutlineFS',
      ),
      '#include "DepthFrag.glsl";',
      '#include "Color.glsl";\n#include "Scene.glsl";\n#include "SceneFog.glsl";',
    ),
    'gl_FragColor=getDepthColor();',
    'vec4 zhudaLine=vec4(u_ZhudaOutline.rgb,1.0);\n#ifdef FOG\nzhudaLine.rgb=sceneLitFog(zhudaLine.rgb);\n#endif\ngl_FragColor=outputTransform(zhudaLine);',
  );
  return { vertex, fragment };
}

const NEVER = 2;
const linear = (c: ZhudaToonColor, strength = 1) =>
  c.map((v) => zhudaSrgbToLinear(v) * strength) as [number, number, number];

/** A lit material shaded in bands, with LayaAir's lights, shadows, fog, skinning and instancing. */
export class ZhudaToonMaterial {
  /** The Laya material: give it to a renderer. */
  readonly material: any;
  readonly spec: ZhudaToonSpec;
  private readonly lit: ZhudaLitSurfaceMaterial;
  private readonly hasOutline: boolean;
  private disposed = false;

  constructor(spec: ZhudaToonSpec, textures: Record<string, any> = {}) {
    const problems = validateZhudaToonSpec(spec);
    if (problems.length) throw Error('Toon material: ' + problems.join('; '));
    this.spec = JSON.parse(JSON.stringify(spec));
    this.hasOutline = spec.outline !== undefined;
    const own: Record<string, ShaderUniformSpec> = {
      u_ZhudaToonEdges: { type: 'vec4' },
      u_ZhudaToonLevels: { type: 'vec4' },
      u_ZhudaToonBase: { type: 'vec4' },
      u_ZhudaToonHighlight: { type: 'vec4' },
      u_ZhudaToonRim: { type: 'vec4' },
      u_ZhudaToonShape: { type: 'vec4' },
      ...(this.hasOutline
        ? { u_ZhudaOutline: { type: 'vec4' }, u_ZhudaOutlineShape: { type: 'vec4' } }
        : {}),
    };
    const shading: ZhudaLitShading = {
      key: this.hasOutline ? 'toon-1+outline' : 'toon-1',
      functions: BAND + FLOW,
      flow: 'zhudaToonFlow',
      passes: this.hasOutline
        ? (programs) => [{ ...buildZhudaToonOutlinePass(programs.shadow), cull: 'front' }]
        : undefined,
    };
    const litSpec: ZhudaLitSurfaceSpec = {
      name: spec.name,
      surface: spec.surface ?? PLAIN_SURFACE,
      vertex: spec.vertex,
      normalConvention: spec.normalConvention,
      backFaces: spec.backFaces,
      uniforms: { ...(spec.uniforms ?? {}), ...own },
      material: { ...(spec.material ?? {}), metallic: 0, roughness: 1 },
    };
    this.lit = new ZhudaLitSurfaceMaterial(litSpec, textures, shading);
    this.material = this.lit.material;
    try {
      this.setRamp(spec.ramp ?? ZHUDA_TOON_DEFAULT_RAMP);
      this.setHighlight(spec.highlight ?? null);
      this.setRim(spec.rim ?? null);
      this.setAmbient(spec.ambient ?? {});
      if (spec.outline) this.setOutline(spec.outline);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private check(problems: string[]) {
    if (this.disposed) throw Error('Disposed material');
    if (problems.length) throw Error('Toon material: ' + problems.join('; '));
  }
  private probe(part: Partial<ZhudaToonSpec>) {
    this.check(validateZhudaToonSpec({ name: this.spec.name, ...part }));
  }

  /** Changes the bands; nothing is compiled. */
  setRamp(ramp: ZhudaToonRamp): void {
    this.check(validateZhudaToonRamp(ramp));
    const edges = [NEVER, NEVER, NEVER, NEVER];
    const last = ramp.levels[ramp.levels.length - 1];
    const levels = [last, last, last, last];
    ramp.edges.forEach((edge, i) => {
      edges[i] = edge;
      levels[i] = ramp.levels[i + 1];
    });
    this.lit.set('u_ZhudaToonEdges', edges);
    this.lit.set('u_ZhudaToonLevels', levels);
    this.spec.ramp = { edges: [...ramp.edges], levels: [...ramp.levels], softness: ramp.softness };
    this.base();
  }
  private base() {
    const ambient = this.spec.ambient ?? {};
    this.lit.set('u_ZhudaToonBase', [
      (this.spec.ramp ?? ZHUDA_TOON_DEFAULT_RAMP).levels[0],
      (this.spec.ramp ?? ZHUDA_TOON_DEFAULT_RAMP).softness ?? 0.02,
      ambient.strength ?? 1,
      ambient.flat ?? 1,
    ]);
  }
  private shape() {
    const { highlight, rim } = this.spec;
    this.lit.set('u_ZhudaToonShape', [
      highlight?.softness ?? 0.01,
      rim ? 1 - rim.width : NEVER,
      rim?.softness ?? 0.02,
      0,
    ]);
  }
  /** The highlight, or `null` for none. */
  setHighlight(highlight: ZhudaToonHighlight | null): void {
    if (highlight) this.probe({ highlight });
    else this.check([]);
    this.lit.set(
      'u_ZhudaToonHighlight',
      highlight
        ? [
            ...linear(highlight.color, highlight.strength ?? 1),
            Math.cos((highlight.sizeDeg * Math.PI) / 180),
          ]
        : [0, 0, 0, NEVER],
    );
    this.spec.highlight = highlight ? { ...highlight } : undefined;
    this.shape();
  }
  /** The rim light, or `null` for none. */
  setRim(rim: ZhudaToonRim | null): void {
    if (rim) this.probe({ rim });
    else this.check([]);
    this.lit.set(
      'u_ZhudaToonRim',
      rim ? [...linear(rim.color, rim.strength ?? 1), 0] : [0, 0, 0, 0],
    );
    this.spec.rim = rim ? { ...rim } : undefined;
    this.shape();
  }
  setAmbient(ambient: ZhudaToonAmbient): void {
    this.probe({ ambient });
    this.spec.ambient = { ...ambient };
    this.base();
  }
  /**
   * Colour, width and space of the outline. Only for a material made with an
   * outline: the pass is part of the shader. A width of 0 hides the line.
   */
  setOutline(outline: ZhudaToonOutline): void {
    this.probe({ outline });
    if (!this.hasOutline)
      throw Error('Toon material: made without an outline; give `outline` in the spec');
    this.lit.set('u_ZhudaOutline', [...linear(outline.color), outline.width]);
    this.lit.set('u_ZhudaOutlineShape', [outline.space === 'world' ? 1 : 0, 0, 0, 0]);
    this.spec.outline = { ...outline };
  }
  /** A custom uniform of the hooks (`spec.uniforms`). */
  set(name: string, value: any): void {
    if (OWN.test(name)) throw Error('Toon material: use setRamp, setHighlight, setRim, setOutline');
    this.lit.set(name, value);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lit.dispose();
  }
}
