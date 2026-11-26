import {
  applySurfaceBlend,
  createSurfaceMaterial,
  disposeSurfaceMaterial,
  type SurfaceMaterialSpec,
} from '../runtime3d/Surfaces.ts';
import {
  ZHUDA_INSTANCE_TINT_ATTRIBUTE,
  ZHUDA_INSTANCE_TINT_DEFINE,
  ZHUDA_INSTANCE_TINT_LOCATION,
  registerZhudaInstanceTintShader,
} from '../runtime3d/InstancedMesh.ts';
import { validateShaderSpec, type ShaderUniformSpec } from './ShaderMaterials.ts';
import { ZHUDA_COMMON_INCLUDE, registerZhudaCommon } from './ZhudaCommon.ts';
import {
  litVertex,
  litFragment,
  litShadowVertex,
  litShadowFragment,
  litDepthVertex,
  litDepthFragment,
} from './LitSurfaceTemplates.ts';

export interface ZhudaLitSurfaceSpec {
  name: string;
  /**
   * Optional vertex hook, a function body contract:
   * `void zhudaVertex(inout vec3 positionWS, inout vec3 normalWS, vec2 uv, vec3 originWS)`.
   * It moves world-space positions (wind in grass and leaves, swell, wobble)
   * and may bend normals. The forward, `ShadowCaster` and `DepthNormal` passes
   * all run it, so shadows and ambient occlusion follow the moved surface.
   * `originWS` is the object's world origin (a per-instance phase). Custom
   * uniforms (`u_Zhuda…`) are visible here too. The mesh bounds are not
   * grown: keep displacement small or pad the bounds yourself.
   */
  vertex?: string;
  /** void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 worldPosition, vec3 worldNormal).
   * Fields: baseColor (linear), metallic, roughness, occlusion, emission
   * (linear HDR), alpha (0..1) and normalTS (the normal in the surface's own
   * frame: x along the texture's u, y along its v, z out of the surface;
   * (0, 0, 1) leaves it as it is).
   *
   * A surface that writes `alpha` is cut by it where the material is a
   * cut-out (`material.blend: 'cutout'`, or `alphaHash`), and its shadow and
   * its depth are cut the same way: those passes run the hook too, with the
   * material's plain colour and maps, and keep only its alpha and normal. A
   * surface that writes `normalTS` is lit by that normal, on a mesh with
   * tangents or without (the frame then comes from the texture coordinates).
   * A surface that writes neither is drawn as before.
   *
   * It is also given, to read: `viewDirection` (from the surface toward the
   * eye, a unit; with the fourth argument, the mesh's own normal before any
   * normal map, it says how steeply the surface is seen; where a light's
   * shadow is written it is toward that light, so a cloth cut by how steeply
   * it is seen shades the floor by how steeply the light meets it) and `vertexColor`
   * (the mesh's colour at this place, white where it has none: red, green
   * and blue arrive as light, a display colour to the power 2.2; alpha
   * arrives as it was given, so a plain number for the hook goes there).
   * With `sheen`: `sheenColor` and `sheenRoughness`; with `subsurface`:
   * `subsurfaceColor` and `thickness`; with `strands`: `strandShift`.
   *
   * A hook that reads `s.tangent`, `s.bitangent` or `s.viewTS` is given the
   * surface's own frame where the colours are drawn: unit vectors in the
   * world along the texture's u and v (from the mesh's tangents, or from how
   * the place and the texture coordinates change across the pixel), and the
   * view direction in that frame (x along u, y along v, z out of the
   * surface): what an iris seen through a cornea, or any pattern that lies
   * under the surface, is moved by. */
  surface: string;
  /**
   * The soft glow cloth has at its edges (velvet, knit, a stocking), from
   * LayaAir's own sheen lobe: its colour as light and its roughness 0..1
   * (default white and 0.5). The hook may change both a pixel
   * (`s.sheenColor`, `s.sheenRoughness`). Not with a `ZhudaLitShading`
   * (a toon material is lit its own way).
   */
  sheen?: { color?: readonly [number, number, number]; roughness?: number } | boolean;
  /**
   * Light that goes into the surface and comes out near by: skin, wax, a
   * leaf. `wrap` (0..1, default 0.5) lets a light reach round where the
   * surface turns from it, tinted by `color` (as light; default a skin's
   * red, 1, 0.35, 0.25). `back` (default 0) is how much light from behind
   * shows through a thin part, by the hook's `s.thickness` (1 thin, 0 none);
   * `power` (6) how narrow that glow is, `distortion` (0.3) how far the
   * surface's own facing bends it. The hook may change `s.subsurfaceColor`
   * and `s.thickness` a pixel at a time. A light's own shadow takes the
   * light that goes round away again; light from behind is not shadowed by
   * a sun. Not with a `ZhudaLitShading` of one's own.
   */
  subsurface?:
    | {
        color?: readonly [number, number, number];
        wrap?: number;
        back?: number;
        power?: number;
        distortion?: number;
      }
    | boolean;
  /**
   * A highlight along strands (hair, brushed fur, a satin ribbon), after
   * Kajiya and Kay: two bands of light across the strands, both as strong as
   * `strength` (default 1), a narrow white one and a wider one of `color`
   * (default 0.5, 0.4, 0.3; on dark hair keep it near the hair's own colour,
   * since the band adds it to each light where the strands run square to it),
   * each moved along the strand by `shift` (default 0.05 and -0.1) and
   * as narrow as `exponent` (default 120 and 24). The strands run along the
   * texture's `along` (`'v'` by default, or `'u'`). The hook's
   * `s.strandShift` moves both a pixel at a time (a noise there breaks the
   * bands up as real hair does). Not with a `ZhudaLitShading`.
   */
  strands?:
    | {
        along?: 'u' | 'v';
        color?: readonly [number, number, number];
        strength?: number;
        shift?: readonly [number, number];
        exponent?: readonly [number, number];
      }
    | boolean;
  /** The surface may call `ZhudaCommon.glsl`: hash, noise, fractal noise, triplanar. */
  common?: boolean;
  /**
   * Cut by chance instead of at one threshold: a pixel is kept with the
   * chance its alpha gives, by a pattern that stays on the object (it does
   * not swim as the camera or the object moves, and it follows a skinned
   * mesh). Half-clear things then sort themselves, cast half a shadow and
   * write depth, at the price of grain; temporal anti-aliasing smooths it.
   * The material is drawn as a cut-out.
   */
  alphaHash?: boolean;
  /** Native Laya textures use -Y (DirectX). Most scanned/glTF maps use +Y (OpenGL). */
  normalConvention?: 'directx' | 'opengl';
  /**
   * How the back of a two-sided surface is lit. `mirrored` (default) turns
   * the normal round, as for a sheet with two sides. `same` lights the back
   * with the normal the vertex gave: for blades and leaves whose normals
   * point where the light should come from, whichever side is seen.
   */
  backFaces?: 'mirrored' | 'same';
  uniforms?: Record<string, ShaderUniformSpec>;
  material?: Omit<SurfaceMaterialSpec, 'type'> & {
    clearCoat?: number;
    clearCoatRoughness?: number;
  };
}
/**
 * Lighting that replaces the physically based one of a lit template. The
 * surface hook, the vertex hook, the shadow and depth passes stay as they
 * are, so a material lit another way still casts and receives shadows as
 * the others do. `ZhudaToonMaterial` is built on it.
 */
export interface ZhudaLitShading {
  /** Names the lighting in the shader's contract: two lightings never share a shader name. */
  key: string;
  /** GLSL placed before `main`; it defines `vec4 <flow>(const in SurfaceInputs inputs,in PixelParams pixel)`. */
  functions: string;
  /** The function that takes the place of `PBR_Metallic_Flow`. */
  flow: string;
  /** Forward passes drawn after the lit one (an outline hull), from the material's own vertex programs. */
  passes?: (programs: { forward: string; shadow: string; depth: string }) => {
    vertex: string;
    fragment: string;
    cull?: 'front' | 'back' | 'none';
  }[];
}
const registry = new WeakMap<object, Map<string, string>>();
/**
 * A copy's own colour, when the mesh is drawn by `ZhudaInstancedMesh` with
 * tints: the define is on that renderer only, so nothing else pays for it.
 */
// Each begins on a line of its own: a directive after a brace on the same line is not one.
const TINT_VARYING = `\n#ifdef ${ZHUDA_INSTANCE_TINT_DEFINE}\nvarying vec4 v_ZhudaInstanceTint;\n#endif\n`;
const TINT_PASS = `\n#ifdef ${ZHUDA_INSTANCE_TINT_DEFINE}\nv_ZhudaInstanceTint=${ZHUDA_INSTANCE_TINT_ATTRIBUTE};\n#endif\n`;
const TINT_APPLY = `\n#ifdef ${ZHUDA_INSTANCE_TINT_DEFINE}\ns.baseColor*=v_ZhudaInstanceTint.rgb;\n#endif\n`;

/** Problems with a vertex hook; an empty list means it can be compiled into the lit passes. */
export function validateZhudaLitVertexHook(vertex: unknown): string[] {
  if (typeof vertex !== 'string' || vertex.length > 65536 || !/\bzhudaVertex\s*\(/.test(vertex))
    return ['vertex must define zhudaVertex (at most 65536 characters)'];
  const code = vertex.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const e: string[] = [];
  if (/\b(?:uniform|attribute|varying)\b|#\s*(?:version|include)|\bvoid\s+main\s*\(/.test(code))
    e.push(
      'vertex is a function body contract; declarations/includes/main belong to the engine template',
    );
  if (/\bgl_(?:Position|PointSize)\b/.test(code))
    e.push('vertex moves world-space positions; clip-space output belongs to the engine template');
  return e;
}

const VERTEX_APPLY = `void zhudaApplyVertex(inout PixelParams p,in Vertex v){vec2 zhudaUV=vec2(0.0);
#ifdef UV
zhudaUV=v.texCoord0;
#endif
vec3 n0=p.normalWS;zhudaVertex(p.positionWS,p.normalWS,zhudaUV,getWorldMatrix()[3].xyz);p.normalWS=normalize(p.normalWS);
vec3 t=p.tangentWS-p.normalWS*dot(p.normalWS,p.tangentWS);float tl=length(t);
if(tl>1e-4){float h=dot(p.biNormalWS,cross(n0,p.tangentWS))<0.0?-1.0:1.0;p.tangentWS=t/tl;p.biNormalWS=normalize(cross(p.normalWS,p.tangentWS))*h;}}
`;
const SHADOW_APPLY = `{vec2 zhudaUV=vec2(0.0);
#ifdef UV
zhudaUV=vertex.texCoord0;
#endif
zhudaVertex(positionWS,normalWS,zhudaUV,worldMat[3].xyz);normalWS=normalize(normalWS);}`;
const replaceOnce = (source: string, find: string, replacement: string) => {
  const at = source.indexOf(find);
  if (at < 0 || source.indexOf(find, at + 1) >= 0)
    throw Error('Lit template changed; the vertex hook cannot be placed');
  return source.slice(0, at) + replacement + source.slice(at + find.length);
};
/** What the fragment programs of a lit material need from its vertex programs. */
export interface ZhudaLitVertexNeeds {
  /** Each vertex's place in its own mesh, for the pattern of `alphaHash`. */
  objectPosition?: boolean;
  /** The shadow pass runs the surface hook: it needs the place, the normal, the texture coordinates. */
  shadowSurface?: boolean;
}
const SHADOW_SURFACE_VARYINGS =
  '\nvarying vec3 v_ZhudaShadowPositionWS;varying vec3 v_ZhudaShadowNormalWS;varying vec2 v_ZhudaShadowUV;varying vec4 v_ZhudaShadowVertexColor;\n';
const SHADOW_SURFACE_PASS = `v_ZhudaShadowPositionWS=positionWS;v_ZhudaShadowNormalWS=normalWS;
#ifdef UV
v_ZhudaShadowUV=vertex.texCoord0;
#else
v_ZhudaShadowUV=vec2(0.0);
#endif
#ifdef COLOR
v_ZhudaShadowVertexColor=vertex.vertexColor;
#else
v_ZhudaShadowVertexColor=vec4(1.0);
#endif
`;
/**
 * The three vertex programs of a lit material. Without a hook they are the
 * native templates unchanged; with one, each pass runs `zhudaVertex` on the
 * world-space position and normal before projecting. `needs` adds what a
 * surface that is cut hands to its fragment programs. Pure: no Laya needed.
 */
export function buildZhudaLitVertexShaders(
  vertex?: string,
  needs: ZhudaLitVertexNeeds = {},
): {
  forward: string;
  shadow: string;
  depth: string;
} {
  let forward = litVertex,
    shadow = litShadowVertex,
    depth = litDepthVertex;
  if (vertex !== undefined) {
    const errors = validateZhudaLitVertexHook(vertex);
    if (errors.length) throw Error(errors.join('; '));
    const hook = vertex + '\n' + VERTEX_APPLY;
    forward = replaceOnce(
      replaceOnce(forward, 'void main(){', hook + 'void main(){'),
      'PixelParams pixel;initPixelParams(pixel,vertex);',
      'PixelParams pixel;initPixelParams(pixel,vertex);zhudaApplyVertex(pixel,vertex);sharePixelParams(pixel);',
    );
    depth = replaceOnce(
      replaceOnce(depth, 'void main(){', hook + 'void main(){'),
      'initPixelParams(pixel,vertex);sharePixelParams(pixel);',
      'initPixelParams(pixel,vertex);zhudaApplyVertex(pixel,vertex);sharePixelParams(pixel);',
    );
    shadow = replaceOnce(
      replaceOnce(shadow, 'void main(){', vertex + '\nvoid main(){'),
      'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
      SHADOW_APPLY + 'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
    );
  }
  if (needs.shadowSurface)
    // After the vertex hook: the surface is asked about the place the vertex moved to.
    shadow = replaceOnce(
      replaceOnce(shadow, 'void main(){', SHADOW_SURFACE_VARYINGS + 'void main(){'),
      'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
      SHADOW_SURFACE_PASS + 'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
    );
  if (needs.objectPosition) {
    const place = (source: string) =>
      replaceOnce(
        replaceOnce(source, 'void main(){', OBJECT_VARYING + 'void main(){'),
        'Vertex vertex;getVertexParams(vertex);',
        'Vertex vertex;getVertexParams(vertex);v_ZhudaObjectPosition=vertex.positionOS;',
      );
    forward = place(forward);
    shadow = place(shadow);
    depth = place(depth);
  }
  return { forward, shadow, depth };
}
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
/** Which of the fields added after the first five a surface's text touches. */
export function zhudaLitSurfaceWrites(surface: string): { alpha: boolean; normal: boolean } {
  const code = stripComments(surface);
  return { alpha: /\.\s*alpha\b/.test(code), normal: /\.\s*normalTS\b/.test(code) };
}
interface Lobes {
  sheen: boolean;
  subsurface: boolean;
  strands: 'u' | 'v' | null;
  frame: boolean;
}
const surfaceStruct = (lobes: Lobes) =>
  `struct ZhudaLitSurface {vec3 baseColor;float metallic;float roughness;float occlusion;vec3 emission;float alpha;vec3 normalTS;vec3 viewDirection;vec4 vertexColor;${
    lobes.sheen ? 'vec3 sheenColor;float sheenRoughness;' : ''
  }${lobes.subsurface ? 'vec3 subsurfaceColor;float thickness;' : ''}${
    lobes.strands ? 'float strandShift;' : ''
  }${lobes.frame ? 'vec3 tangent;vec3 bitangent;vec3 viewTS;' : ''}};`;
/** A lit surface's subsurface light: its colour and wrap; how much comes through from behind, how narrow, how bent. */
export const ZHUDA_LIT_SUBSURFACE_UNIFORM = 'u_ZhudaLitSubsurface';
export const ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM = 'u_ZhudaLitSubsurfaceBack';
/** A lit surface's strand highlight: the two shifts and exponents; the wide band's colour and the strength of both. */
export const ZHUDA_LIT_STRANDS_UNIFORM = 'u_ZhudaLitStrands';
export const ZHUDA_LIT_STRAND_COLOR_UNIFORM = 'u_ZhudaLitStrandColor';
/** What the hook's new fields start as (and stay as, in the passes that draw no colour). */
const lobeDefaults = (lobes: Lobes) =>
  `${lobes.subsurface ? `s.subsurfaceColor=${ZHUDA_LIT_SUBSURFACE_UNIFORM}.rgb;s.thickness=1.0;` : ''}${
    lobes.strands ? 's.strandShift=0.0;' : ''
  }${lobes.frame ? 's.tangent=vec3(1.0,0.0,0.0);s.bitangent=vec3(0.0,0.0,1.0);s.viewTS=vec3(0.0,0.0,1.0);' : ''}`;
/** The uniform a lit surface's sheen is kept in: its colour, and its roughness in the fourth place. */
export const ZHUDA_LIT_SHEEN_UNIFORM = 'u_ZhudaLitSheen';
/**
 * LayaAir's physically based flow with the sheen of the surface put on it:
 * its own `PBR_Metallic_Flow`, which leaves a surface's sheen unset (only its
 * glTF shader sets it).
 */
const SHEEN_FLOW = `vec4 zhudaLitSheenFlow(const in SurfaceInputs inputs,in PixelParams pixel,vec3 zhudaSheen,float zhudaSheenRoughness){
#ifdef ALPHATEST
if(inputs.alpha<inputs.alphaTest){discard;}
#endif
Surface surface;initSurface(surface,inputs,pixel);
#ifdef SHEEN
surface.sheenColor=zhudaSheen;surface.sheenPerceptualRoughness=max(zhudaSheenRoughness,MIN_PERCEPTUAL_ROUGHNESS);surface.sheenRoughness=surface.sheenPerceptualRoughness*surface.sheenPerceptualRoughness;
#endif
PixelInfo info;getPixelInfo(info,pixel,surface);
#ifdef LAYA_MRT
writeGBuffer(info.normalWS,inputs.diffuseColor,inputs.metallic,surface.perceptualRoughness,surface.occlusion);
#endif
vec3 surfaceColor=vec3(0.0);surfaceColor+=PBRLighting(surface,info);return vec4(surfaceColor,surface.alpha);}
`;
/** The varying a copy's own place in its mesh arrives in, for the pattern of `alphaHash`. */
const OBJECT_VARYING = '\nvarying vec3 v_ZhudaObjectPosition;\n';
/**
 * Hashed alpha testing (Wyman and McGuire 2017): the threshold is a hash of
 * the place on the object, in cells about a pixel wide, blended between the
 * two nearest sizes of cell so that it does not jump as the object comes
 * nearer. Without derivatives (WebGL 1) the cells have one size.
 */
const ALPHA_HASH = `${OBJECT_VARYING}#ifdef GRAPHICS_API_GLES3
float zhudaAlphaHash(vec3 p){float span=max(length(dFdx(p)),length(dFdy(p)));float cells=1.0/max(span*1.5,1.0e-6);float size=log2(cells);float low=exp2(floor(size)),high=exp2(ceil(size));float f=fract(size);float x=mix(zhudaHash(floor(low*p)),zhudaHash(floor(high*p)),f);float w=max(min(f,1.0-f),1.0e-4);float t=x<1.0-w?(x<w?x*x/(2.0*w*(1.0-w)):(x-0.5*w)/(1.0-w)):1.0-(1.0-x)*(1.0-x)/(2.0*w*(1.0-w));return clamp(t,1.0e-4,1.0);}
#endif
#ifndef GRAPHICS_API_GLES3
float zhudaAlphaHash(vec3 p){return clamp(zhudaHash(floor(p*64.0)),1.0e-4,1.0);}
#endif
`;
/**
 * The normal a surface wrote, in the world. With tangents it goes through
 * LayaAir's own frame; without, through one worked out from how the place
 * and the texture coordinates change across the pixel.
 */
// Which way LayaAir's own second axis runs along the texture's v.
const FRAME_V = '1.0';
/** The surface's frame in the world: along the texture's u and along its v. */
const SURFACE_FRAME = `
void zhudaSurfaceFrame(in PixelParams p,vec2 uv,out vec3 t,out vec3 b){
#ifdef TANGENT
t=normalize(p.TBN[0]);b=normalize(p.TBN[1]);
#endif
#ifndef TANGENT
t=vec3(1.0,0.0,0.0);b=vec3(0.0,0.0,1.0);
#ifdef GRAPHICS_API_GLES3
vec3 dx=dFdx(p.positionWS),dy=dFdy(p.positionWS);vec2 ux=dFdx(uv),uy=dFdy(uv);vec3 a=cross(dy,p.normalWS),c=cross(p.normalWS,dx);vec3 tt=a*ux.x+c*uy.x,bb=a*ux.y+c*uy.y;float lt=dot(tt,tt),lb=dot(bb,bb);if(lt>1.0e-20)t=tt*inversesqrt(lt);if(lb>1.0e-20)b=bb*inversesqrt(lb)*(${FRAME_V});
#endif
#endif
}
`;
/**
 * What the lobes of a lit surface add for one light, and LayaAir 3.4.2's
 * light loop (PBRFrag.glsl, MIT, Layabox) calling it: the light that goes
 * round and through (subsurface), the bands along strands.
 */
const LOBE_LIGHTS = (lobes: Lobes) => `
#if defined(DIRECTIONLIGHT) || defined(POINTLIGHT) || defined(SPOTLIGHT)
vec3 zhudaLobeLight(const in Surface surface,const in PixelInfo info,const in Light light,float zhudaBehind,vec3 zhudaScatter,float zhudaThin,vec3 zhudaStrand,float zhudaShift){
vec3 l=normalize(-light.dir);vec3 c=vec3(0.0);float nl=dot(info.normalWS,l);
${
  lobes.subsurface
    ? `float w=${ZHUDA_LIT_SUBSURFACE_UNIFORM}.a;c+=surface.diffuseColor*zhudaScatter*(saturate((nl+w)/(1.0+w))-saturate(nl))*light.attenuation;vec3 through=normalize(l+info.normalWS*${ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM}.z);c+=zhudaScatter*${ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM}.x*zhudaThin*pow(saturate(dot(info.viewDir,-through)),${ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM}.y)*zhudaBehind;`
    : ''
}
${
  lobes.strands
    ? `vec3 h=SafeNormalize(info.viewDir+l);vec3 t1=normalize(zhudaStrand+info.normalWS*(${ZHUDA_LIT_STRANDS_UNIFORM}.x+zhudaShift)),t2=normalize(zhudaStrand+info.normalWS*(${ZHUDA_LIT_STRANDS_UNIFORM}.y+zhudaShift));float d1=dot(t1,h),d2=dot(t2,h);c+=${ZHUDA_LIT_STRAND_COLOR_UNIFORM}.a*(vec3(smoothstep(-1.0,0.0,d1)*pow(sqrt(max(1.0-d1*d1,0.0)),${ZHUDA_LIT_STRANDS_UNIFORM}.z))+${ZHUDA_LIT_STRAND_COLOR_UNIFORM}.rgb*smoothstep(-1.0,0.0,d2)*pow(sqrt(max(1.0-d2*d2,0.0)),${ZHUDA_LIT_STRANDS_UNIFORM}.w))*saturate(nl*0.75+0.25)*light.attenuation;`
    : ''
}
return c*light.color;}
#endif
vec3 zhudaLobeLights(const in Surface surface,const in PixelInfo info,vec3 zhudaScatter,float zhudaThin,vec3 zhudaStrand,float zhudaShift){vec3 color=vec3(0.0);
#ifdef DIRECTIONLIGHT
for(int i=0;i<CalculateLightCount;i++){if(i>=DirectionCount)break;DirectionLight directionLight=getDirectionLight(i,info.positionWS);if(directionLight.lightMode==LightMode_Mix){continue;}Light light=getLight(directionLight);color+=zhudaLobeLight(surface,info,light,1.0,zhudaScatter,zhudaThin,zhudaStrand,zhudaShift);}
#endif
#if defined(POINTLIGHT) || defined(SPOTLIGHT)
ivec4 clusterInfo=getClusterInfo(u_View,u_Viewport,info.positionWS,gl_FragCoord,u_ProjectionParams);
#endif
#ifdef POINTLIGHT
for(int i=0;i<CalculateLightCount;i++){if(i>=clusterInfo.x)break;PointLight pointLight=getPointLight(i,clusterInfo,info.positionWS);if(pointLight.lightMode==LightMode_Mix){continue;}Light light=getLight(pointLight,info.normalWS,info.positionWS);color+=zhudaLobeLight(surface,info,light,light.attenuation,zhudaScatter,zhudaThin,zhudaStrand,zhudaShift);}
#endif
#ifdef SPOTLIGHT
for(int i=0;i<CalculateLightCount;i++){if(i>=clusterInfo.y)break;SpotLight spotLight=getSpotLight(i,clusterInfo,info.positionWS);if(spotLight.lightMode==LightMode_Mix){continue;}Light light=getLight(spotLight,info.normalWS,info.positionWS);color+=zhudaLobeLight(surface,info,light,light.attenuation,zhudaScatter,zhudaThin,zhudaStrand,zhudaShift);}
#endif
return color;}
`;
/** LayaAir's physically based flow with a lit surface's lobes: its sheen set as `SHEEN_FLOW` sets it, the others added light by light. */
const LOBES_FLOW = (
  lobes: Lobes,
) => `${LOBE_LIGHTS(lobes)}vec4 zhudaLitLobesFlow(const in SurfaceInputs inputs,in PixelParams pixel,vec3 zhudaSheen,float zhudaSheenRoughness,vec3 zhudaScatter,float zhudaThin,vec3 zhudaStrand,float zhudaShift){
#ifdef ALPHATEST
if(inputs.alpha<inputs.alphaTest){discard;}
#endif
Surface surface;initSurface(surface,inputs,pixel);
#ifdef SHEEN
surface.sheenColor=zhudaSheen;surface.sheenPerceptualRoughness=max(zhudaSheenRoughness,MIN_PERCEPTUAL_ROUGHNESS);surface.sheenRoughness=surface.sheenPerceptualRoughness*surface.sheenPerceptualRoughness;
#endif
PixelInfo info;getPixelInfo(info,pixel,surface);
#ifdef LAYA_MRT
writeGBuffer(info.normalWS,inputs.diffuseColor,inputs.metallic,surface.perceptualRoughness,surface.occlusion);
#endif
vec3 surfaceColor=vec3(0.0);surfaceColor+=PBRLighting(surface,info);surfaceColor+=zhudaLobeLights(surface,info,zhudaScatter,zhudaThin,zhudaStrand,zhudaShift);return vec4(surfaceColor,surface.alpha);}
`;
const NORMAL_FRAME = `
vec3 zhudaSurfaceNormal(in PixelParams p,vec3 n,vec2 uv){
#ifdef TANGENT
return normalize(p.TBN*n);
#endif
#ifndef TANGENT
#ifdef GRAPHICS_API_GLES3
vec3 dx=dFdx(p.positionWS),dy=dFdy(p.positionWS);vec2 ux=dFdx(uv),uy=dFdy(uv);vec3 a=cross(dy,p.normalWS),b=cross(p.normalWS,dx);vec3 t=a*ux.x+b*uy.x,c=a*ux.y+b*uy.y;float longest=max(dot(t,t),dot(c,c));if(longest<1.0e-20)return p.normalWS;float k=inversesqrt(longest);return normalize(t*k*n.x+c*k*n.y*(${FRAME_V})+p.normalWS*n.z);
#endif
#ifndef GRAPHICS_API_GLES3
return p.normalWS;
#endif
#endif
}
`;
const cleanNormal =
  'vec3 zhudaN=s.normalTS;zhudaN=dot(zhudaN,zhudaN)>1.0e-8?normalize(zhudaN):vec3(0.0,0.0,1.0);';
/**
 * Whom a surface is seen by, in the pass that writes a light's shadow (and
 * the camera's own depth): LayaAir gives that pass a view and a projection
 * and no eye. A sun looks along one direction everywhere; a spot light or
 * a camera looks from a point, read back out of the view.
 */
const PASS_VIEW = `vec3 zhudaPassViewDirection(vec3 positionWS){
if(u_Projection[3][3]>0.5){return normalize(vec3(u_View[0][2],u_View[1][2],u_View[2][2]));}
vec3 t=u_View[3].xyz;vec3 eye=-vec3(dot(u_View[0].xyz,t),dot(u_View[1].xyz,t),dot(u_View[2].xyz,t));return normalize(eye-positionWS);}
`;
/** The material's plain values, for the passes that draw no colour. */
const PLAIN_SURFACE = (
  uv: string,
  view: string,
  vertexColor: string,
  sheen: boolean,
  lobes: Lobes,
) => `ZhudaLitSurface s;s.baseColor=u_AlbedoColor.rgb;s.metallic=u_Metallic;s.roughness=1.0-u_Smoothness;s.occlusion=1.0;s.emission=vec3(0.0);s.alpha=u_AlbedoColor.a;s.normalTS=vec3(0.0,0.0,1.0);s.viewDirection=${view};${
  sheen
    ? `s.sheenColor=${ZHUDA_LIT_SHEEN_UNIFORM}.rgb;s.sheenRoughness=${ZHUDA_LIT_SHEEN_UNIFORM}.a;`
    : ''
}${lobeDefaults(lobes)}
#ifdef COLOR
s.vertexColor=${vertexColor};
#else
s.vertexColor=vec4(1.0);
#endif
#if defined(COLOR) && defined(ENABLEVERTEXCOLOR)
s.alpha*=s.vertexColor.a;
#endif
#ifdef ALBEDOTEXTURE
s.alpha*=texture2D(u_AlbedoTexture,transformUV(${uv},u_TilingOffset)).a;
#endif
`;
export interface ZhudaLitFragmentOptions {
  surface: string;
  uniforms?: Record<string, ShaderUniformSpec>;
  normalConvention?: 'directx' | 'opengl';
  backFaces?: 'mirrored' | 'same';
  common?: boolean;
  alphaHash?: boolean;
  /** The surface has a sheen (see `ZhudaLitSurfaceSpec.sheen`). */
  sheen?: unknown;
  /** The surface has subsurface light, or a strand highlight (see `ZhudaLitSurfaceSpec`). */
  subsurface?: unknown;
  strands?: unknown;
}
/**
 * The three fragment programs of a lit material, and which of the passes
 * that draw no colour run the surface hook. Pure: no Laya needed.
 */
export function buildZhudaLitFragmentShaders(
  spec: ZhudaLitFragmentOptions,
  shading?: ZhudaLitShading,
): { forward: string; shadow: string; depth: string; shadowHook: boolean; depthHook: boolean } {
  const uniforms = spec.uniforms || {};
  const writes = zhudaLitSurfaceWrites(spec.surface);
  const hash = spec.alphaHash === true;
  const sheen = !!spec.sheen;
  if (sheen && shading)
    throw Error('sheen belongs to the physically based lighting: not with a ZhudaLitShading');
  const strandsAlong = spec.strands
    ? (spec.strands as { along?: unknown }).along === 'u'
      ? 'u'
      : 'v'
    : null;
  const lobes: Lobes = {
    sheen,
    subsurface: !!spec.subsurface,
    strands: strandsAlong,
    frame:
      strandsAlong !== null ||
      /\.\s*(?:tangent|bitangent|viewTS)\b/.test(stripComments(spec.surface)),
  };
  if ((lobes.subsurface || lobes.strands) && shading)
    throw Error(
      'subsurface and strands belong to the physically based lighting: not with a ZhudaLitShading',
    );
  // A field of a lobe the material was made without is not in the struct.
  // It is said here, by name, and not left to the GLSL compiler: on WebGPU
  // LayaAir stops drawing when a program fails to compile.
  const hookText = stripComments(spec.surface);
  const owner = /\bzhudaSurface\s*\(\s*inout\s+ZhudaLitSurface\s+([A-Za-z_]\w*)/.exec(
    hookText,
  )?.[1];
  if (owner)
    for (const [option, fields, has] of [
      ['sheen', ['sheenColor', 'sheenRoughness'], sheen],
      ['subsurface', ['subsurfaceColor', 'thickness'], lobes.subsurface],
      ['strands', ['strandShift'], lobes.strands !== null],
    ] as const)
      for (const field of fields)
        if (!has && new RegExp(`\\b${owner}\\s*\\.\\s*${field}\\b`).test(hookText))
          throw Error(
            `The hook uses ${owner}.${field}: make the material with \`${option}\` (the field is not there without it)`,
          );
  const library = spec.common || hash ? `#include "${ZHUDA_COMMON_INCLUDE}";\n` : '';
  const helper = Object.entries(uniforms)
    .filter(([, u]) => u.type === 'texture2D')
    .map(
      ([k]) =>
        `vec4 zhudaSample_${k}(vec2 uv){vec4 c=texture2D(${k},uv);\n#ifdef Gamma_${k}\nc=gammaToLinear(c);\n#endif\nreturn c;}`,
    )
    .join('\n');
  const frame = writes.normal ? NORMAL_FRAME : '';
  // The shadow pass has no frame to turn a normal with, and no use for one.
  const declare = (withFrame: boolean) =>
    `${surfaceStruct(lobes)}\n${helper}\n${hash ? ALPHA_HASH : ''}${withFrame ? frame : ''}${
      withFrame && lobes.frame ? SURFACE_FRAME : ''
    }${spec.surface}\n`;
  const declarations = declare(true);
  const hook = `${TINT_VARYING}${declarations}`;
  const threshold = hash ? 'float zhudaThreshold=zhudaAlphaHash(v_ZhudaObjectPosition);' : '';
  const call = `initSurfaceInputs(inputs,pixel);${threshold}ZhudaLitSurface s;s.baseColor=inputs.diffuseColor;s.metallic=inputs.metallic;s.roughness=1.0-inputs.smoothness;s.occlusion=inputs.occlusion;s.emission=inputs.emissionColor;s.alpha=inputs.alpha;s.normalTS=inputs.normalTS;s.viewDirection=normalize(u_CameraPos-pixel.positionWS);${
    sheen
      ? `s.sheenColor=${ZHUDA_LIT_SHEEN_UNIFORM}.rgb;s.sheenRoughness=${ZHUDA_LIT_SHEEN_UNIFORM}.a;`
      : ''
  }\n#ifdef COLOR\ns.vertexColor=pixel.vertexColor;\n#else\ns.vertexColor=vec4(1.0);\n#endif\n${TINT_APPLY}#ifdef UV\nvec2 zhudaUV=pixel.uv0;\n#else\nvec2 zhudaUV=vec2(0.0);\n#endif\n${lobeDefaults(lobes)}${
    lobes.frame
      ? 'zhudaSurfaceFrame(pixel,zhudaUV,s.tangent,s.bitangent);s.viewTS=vec3(dot(s.viewDirection,s.tangent),dot(s.viewDirection,s.bitangent),dot(s.viewDirection,normalize(pixel.normalWS)));'
      : ''
  }zhudaSurface(s,zhudaUV,pixel.positionWS,pixel.normalWS);inputs.diffuseColor=max(s.baseColor,vec3(0.0));inputs.metallic=clamp(s.metallic,0.0,1.0);inputs.smoothness=1.0-clamp(s.roughness,0.04,1.0);inputs.occlusion=clamp(s.occlusion,0.0,1.0);inputs.emissionColor=max(s.emission,vec3(0.0));${
    writes.alpha ? 'inputs.alpha=clamp(s.alpha,0.0,1.0);' : ''
  }${
    writes.normal
      ? `${cleanNormal}inputs.normalTS=zhudaN;\n#ifndef TANGENT\npixel.normalWS=zhudaSurfaceNormal(pixel,zhudaN,zhudaUV);\n#endif\n`
      : ''
  }${hash ? 'inputs.alphaTest=zhudaThreshold;' : ''}`;
  const normals = (source: string) =>
    spec.normalConvention === 'opengl'
      ? source.replace(
          /\b(?:normalSampler|detailnormalSampler|clearCoatNormalSampler)\.y\*=-1\.0;/g,
          '',
        )
      : source;
  // LayaAir turns the normal of a back face round as it reads the pixel;
  // `same` turns it back before anything is lit.
  const backs = (source: string) =>
    spec.backFaces === 'same'
      ? replaceOnce(
          source,
          'getPixelParams(pixel);',
          'getPixelParams(pixel);if(!gl_FrontFacing){pixel.normalWS=-pixel.normalWS;pixel.tangentWS=-pixel.tangentWS;pixel.biNormalWS=-pixel.biNormalWS;pixel.TBN=mat3(pixel.tangentWS,pixel.biNormalWS,pixel.normalWS);}',
        )
      : source;
  const included = (source: string, after: string) =>
    library ? replaceOnce(source, after, after + library) : source;
  const hooked = included(backs(normals(litFragment)), '#include "PBRMetallicFrag.glsl";\n')
    .replace('void main(){', hook + 'void main(){')
    .replace('initSurfaceInputs(inputs,pixel);', call);
  const forward = shading
    ? replaceOnce(
        replaceOnce(hooked, 'void main(){', shading.functions + '\nvoid main(){'),
        'PBR_Metallic_Flow(inputs,pixel)',
        shading.flow + '(inputs,pixel)',
      )
    : lobes.subsurface || lobes.strands
      ? replaceOnce(
          replaceOnce(hooked, 'void main(){', LOBES_FLOW(lobes) + 'void main(){'),
          'PBR_Metallic_Flow(inputs,pixel)',
          `zhudaLitLobesFlow(inputs,pixel,${
            sheen ? 'max(s.sheenColor,vec3(0.0)),clamp(s.sheenRoughness,0.0,1.0)' : 'vec3(0.0),1.0'
          },${
            lobes.subsurface
              ? 'max(s.subsurfaceColor,vec3(0.0)),clamp(s.thickness,0.0,1.0)'
              : 'vec3(0.0),0.0'
          },${
            lobes.strands
              ? `${lobes.strands === 'u' ? 's.tangent' : 's.bitangent'},s.strandShift`
              : 'vec3(0.0,1.0,0.0),0.0'
          })`,
        )
      : sheen
        ? replaceOnce(
            replaceOnce(hooked, 'void main(){', SHEEN_FLOW + 'void main(){'),
            'PBR_Metallic_Flow(inputs,pixel)',
            'zhudaLitSheenFlow(inputs,pixel,max(s.sheenColor,vec3(0.0)),clamp(s.sheenRoughness,0.0,1.0))',
          )
        : hooked;
  // The shadow and the depth of a cut surface are cut by the same hook.
  const shadowHook = writes.alpha || hash;
  const depthHook = shadowHook || writes.normal;
  const limit = hash ? 'zhudaThreshold' : 'u_AlphaTestValue';
  const shadow = shadowHook
    ? `#define SHADER_NAME PBRDepthFS
#include "Color.glsl";
#include "Scene.glsl";
#include "Camera.glsl";
#include "DepthFrag.glsl";
#include "Sprite3DFrag.glsl";
${library}varying vec3 v_ZhudaShadowPositionWS;varying vec3 v_ZhudaShadowNormalWS;varying vec2 v_ZhudaShadowUV;varying vec4 v_ZhudaShadowVertexColor;
${PASS_VIEW}${declare(false)}void main(){${threshold}
#ifdef ALPHATEST
${PLAIN_SURFACE('v_ZhudaShadowUV', 'zhudaPassViewDirection(v_ZhudaShadowPositionWS)', 'v_ZhudaShadowVertexColor', sheen, lobes)}zhudaSurface(s,v_ZhudaShadowUV,v_ZhudaShadowPositionWS,normalize(v_ZhudaShadowNormalWS));if(clamp(s.alpha,0.0,1.0)<${limit})discard;
#endif
gl_FragColor=getDepthColor();}`
    : litShadowFragment;
  const plainDepth = backs(normals(litDepthFragment));
  let depth = plainDepth;
  if (depthHook) {
    const cutAt = plainDepth.indexOf('\n#ifdef ALPHATEST\nfloat alpha=u_AlbedoColor.a;'),
      normalAt = plainDepth.indexOf('vec3 normalWS=pixel.normalWS;'),
      endAt = plainDepth.indexOf('vec4 positionCS=v_PositionCS;');
    if (cutAt < 0 || normalAt < cutAt || endAt < normalAt)
      throw Error('Lit template changed; the surface hook cannot be placed');
    const before = `${plainDepth.slice(0, cutAt)}${threshold}\n#ifdef UV\nvec2 zhudaUV=pixel.uv0;\n#else\nvec2 zhudaUV=vec2(0.0);\n#endif\n`;
    const plain = PLAIN_SURFACE(
      'zhudaUV',
      'normalize(u_CameraPos-pixel.positionWS)',
      'pixel.vertexColor',
      sheen,
      lobes,
    );
    const cut = `if(clamp(s.alpha,0.0,1.0)<${limit})discard;`;
    const body = writes.normal
      ? // The surface is asked everywhere: its normal is what the pass writes.
        `${plain}${normals(
          '#ifdef NORMALTEXTURE\n#ifdef UV\nvec3 normalSampler=texture2D(u_NormalTexture,transformUV(pixel.uv0,u_TilingOffset)).rgb;normalSampler=normalize(normalSampler*2.0-1.0);normalSampler.y*=-1.0;s.normalTS=normalScale(normalSampler,u_NormalScale);\n#endif\n#endif\n',
        )}zhudaSurface(s,zhudaUV,pixel.positionWS,pixel.normalWS);\n#ifdef ALPHATEST\n${cut}\n#endif\n${cleanNormal}vec3 normalWS=zhudaSurfaceNormal(pixel,zhudaN,zhudaUV);`
      : // Asked only where it may be cut; the normal is the template's own.
        `#ifdef ALPHATEST\n${plain}zhudaSurface(s,zhudaUV,pixel.positionWS,pixel.normalWS);${cut}\n#endif\n${plainDepth.slice(normalAt, endAt)}`;
    depth = replaceOnce(
      included(`${before}${body}${plainDepth.slice(endAt)}`, '#include "DepthNormalFrag.glsl";\n'),
      'varying vec4 v_PositionCS;void main(){',
      `varying vec4 v_PositionCS;${declarations}void main(){`,
    );
  }
  return { forward, shadow, depth, shadowHook, depthHook };
}
/** A lit surface's sheen with its defaults; null when it has none. Throws on values out of range. */
export function resolveZhudaLitSheen(
  sheen: ZhudaLitSurfaceSpec['sheen'],
): { color: [number, number, number]; roughness: number } | null {
  if (sheen === undefined || sheen === false) return null;
  const given = sheen === true ? {} : sheen;
  if (!given || typeof given !== 'object')
    throw Error('Invalid sheen: true, or { color, roughness }');
  const color = given.color ?? [1, 1, 1],
    roughness = given.roughness ?? 0.5;
  if (
    !Array.isArray(color) ||
    color.length !== 3 ||
    !color.every((v) => Number.isFinite(v) && v >= 0 && v <= 16)
  )
    throw Error('Invalid sheen.color: three numbers 0..16');
  if (!(Number.isFinite(roughness) && roughness >= 0 && roughness <= 1))
    throw Error('Invalid sheen.roughness: 0..1');
  return { color: [color[0], color[1], color[2]], roughness };
}
const within = (value: unknown, low: number, high: number, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
    throw Error(`Invalid ${name}: ${low}..${high}`);
  return value;
};
const triple = (value: unknown, name: string): [number, number, number] => {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((v) => Number.isFinite(v) && v >= 0 && v <= 16)
  )
    throw Error(`Invalid ${name}: three numbers 0..16`);
  return [value[0], value[1], value[2]];
};
/** A lit surface's subsurface light with its defaults; null when it has none. Throws on values out of range. */
export function resolveZhudaLitSubsurface(subsurface: ZhudaLitSurfaceSpec['subsurface']): {
  color: [number, number, number];
  wrap: number;
  back: number;
  power: number;
  distortion: number;
} | null {
  if (subsurface === undefined || subsurface === false) return null;
  const given = subsurface === true ? {} : subsurface;
  if (!given || typeof given !== 'object')
    throw Error('Invalid subsurface: true, or { color, wrap, back, power, distortion }');
  return {
    color: triple(given.color ?? [1, 0.35, 0.25], 'subsurface.color'),
    wrap: within(given.wrap ?? 0.5, 0, 1, 'subsurface.wrap'),
    back: within(given.back ?? 0, 0, 16, 'subsurface.back'),
    power: within(given.power ?? 6, 1, 64, 'subsurface.power'),
    distortion: within(given.distortion ?? 0.3, 0, 1, 'subsurface.distortion'),
  };
}
/** A lit surface's strand highlight with its defaults; null when it has none. Throws on values out of range. */
export function resolveZhudaLitStrands(strands: ZhudaLitSurfaceSpec['strands']): {
  along: 'u' | 'v';
  color: [number, number, number];
  strength: number;
  shift: [number, number];
  exponent: [number, number];
} | null {
  if (strands === undefined || strands === false) return null;
  const given = strands === true ? {} : strands;
  if (!given || typeof given !== 'object')
    throw Error('Invalid strands: true, or { along, color, strength, shift, exponent }');
  const along = given.along ?? 'v';
  if (along !== 'u' && along !== 'v') throw Error("Invalid strands.along: 'u' or 'v'");
  const pair = (value: unknown, low: number, high: number, name: string): [number, number] => {
    if (!Array.isArray(value) || value.length !== 2) throw Error(`Invalid ${name}: two numbers`);
    return [within(value[0], low, high, name), within(value[1], low, high, name)];
  };
  return {
    along,
    color: triple(given.color ?? [0.5, 0.4, 0.3], 'strands.color'),
    strength: within(given.strength ?? 1, 0, 16, 'strands.strength'),
    shift: pair(given.shift ?? [0.05, -0.1], -1, 1, 'strands.shift'),
    exponent: pair(given.exponent ?? [120, 24], 1, 2048, 'strands.exponent'),
  };
}
const fields: Record<string, string> = {
  u_AlbedoColor: 'Color',
  u_TilingOffset: 'Vector4',
  u_NormalScale: 'Float',
  u_Metallic: 'Float',
  u_Smoothness: 'Float',
  u_OcclusionStrength: 'Float',
  u_AlphaTestValue: 'Float',
  u_EmissionColor: 'Color',
  u_EmissionIntensity: 'Float',
  u_AlbedoTexture: 'Texture2D',
  u_NormalTexture: 'Texture2D',
  u_OcclusionTexture: 'Texture2D',
  u_EmissionTexture: 'Texture2D',
  u_MetallicGlossTexture: 'Texture2D',
  u_ClearCoatFactor: 'Float',
  u_ClearCoatTexture: 'Texture2D',
  u_ClearCoatRoughness: 'Float',
  u_ClearCoatRoughnessTexture: 'Texture2D',
  u_ClearCoatNormalTexture: 'Texture2D',
};
/** Native Laya PBR lighting, IBL, shadows, depth normals and instancing with a bounded surface hook. */
export class ZhudaLitSurfaceMaterial {
  readonly material: any;
  readonly spec: ZhudaLitSurfaceSpec;
  private disposed = false;
  constructor(
    spec: ZhudaLitSurfaceSpec,
    textures: Record<string, any> = {},
    shading?: ZhudaLitShading,
  ) {
    const uniforms = spec.uniforms || {};
    const errors = validateShaderSpec({
      schemaVersion: 1,
      dimension: 3,
      name: spec.name,
      surface: spec.surface,
      uniforms,
    });
    if (errors.length) throw Error(errors.join('; '));
    // The plain shader material takes more kinds of uniform than this one does.
    for (const [name, u] of Object.entries(uniforms))
      if (!['float', 'vec2', 'vec3', 'vec4', 'texture2D'].includes(u.type) || u.length)
        throw Error(`A lit surface's uniforms are float, vec2, vec3, vec4 or texture2D: ${name}`);
    if (spec.normalConvention && !['directx', 'opengl'].includes(spec.normalConvention))
      throw Error('Invalid normal map convention');
    if (spec.backFaces && !['mirrored', 'same'].includes(spec.backFaces))
      throw Error('Invalid backFaces: mirrored or same');
    if (spec.vertex !== undefined) {
      const vertexErrors = validateZhudaLitVertexHook(spec.vertex);
      if (vertexErrors.length) throw Error(vertexErrors.join('; '));
    }
    for (const v of [spec.material?.clearCoat ?? 0, spec.material?.clearCoatRoughness ?? 0.1])
      if (!Number.isFinite(v) || v < 0 || v > 1) throw Error('Invalid clear coat factor');
    for (const key of ['common', 'alphaHash'] as const)
      if (spec[key] !== undefined && typeof spec[key] !== 'boolean')
        throw Error(`Invalid ${key}: true or false`);
    if (spec.alphaHash && ![undefined, 'cutout'].includes(spec.material?.blend))
      throw Error('alphaHash is a cut-out: leave material.blend out, or set it to cutout');
    const sheen = resolveZhudaLitSheen(spec.sheen);
    if (sheen && shading)
      throw Error('sheen belongs to the physically based lighting: not with a ZhudaLitShading');
    const subsurface = resolveZhudaLitSubsurface(spec.subsurface),
      strands = resolveZhudaLitStrands(spec.strands);
    if ((subsurface || strands) && shading)
      throw Error(
        'subsurface and strands belong to the physically based lighting: not with a ZhudaLitShading',
      );
    for (const own of [
      ZHUDA_LIT_SHEEN_UNIFORM,
      ZHUDA_LIT_SUBSURFACE_UNIFORM,
      ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM,
      ZHUDA_LIT_STRANDS_UNIFORM,
      ZHUDA_LIT_STRAND_COLOR_UNIFORM,
    ])
      if (own in uniforms) throw Error(`${own} is the material's own`);
    for (const [k, u] of Object.entries(uniforms))
      if (u.type === 'texture2D' && !textures[k]) throw Error('Missing texture binding ' + k);
    this.spec = {
      ...spec,
      uniforms: JSON.parse(JSON.stringify(uniforms)),
      material: spec.material ? { ...spec.material } : undefined,
    };
    const l = (globalThis as any).Laya;
    let records = registry.get(l.Shader3D);
    if (!records) registry.set(l.Shader3D, (records = new Map()));
    const signature = JSON.stringify({
      surface: spec.surface,
      // What the shader declares: each uniform's type. A starting value is
      // the material's own (written below), so two materials of one name may
      // start from different ones.
      uniforms: Object.fromEntries(Object.entries(uniforms).map(([k, u]) => [k, u.type])),
      normalConvention: spec.normalConvention || 'directx',
      // Absent for hook-free materials, so their signatures stay as before.
      ...(spec.vertex !== undefined ? { vertex: spec.vertex } : {}),
      ...(spec.backFaces === 'same' ? { backFaces: 'same' } : {}),
      ...(spec.common ? { common: true } : {}),
      ...(spec.alphaHash ? { alphaHash: true } : {}),
      ...(sheen ? { sheen: true } : {}),
      ...(subsurface ? { subsurface: true } : {}),
      ...(strands ? { strands: strands.along } : {}),
      ...(shading ? { shading: shading.key } : {}),
    });
    if (l.Shader3D.find(spec.name)) {
      if (records.get(spec.name) !== signature) throw Error('Shader name has a different contract');
    } else {
      const types: Record<string, string> = {
        float: 'Float',
        vec2: 'Vector2',
        vec3: 'Vector3',
        vec4: 'Vector4',
        texture2D: 'Texture2D',
      };
      const map = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, l.ShaderDataType[v]]),
      );
      for (const [k, u] of Object.entries(uniforms)) map[k] = l.ShaderDataType[types[u.type]];
      if (sheen) map[ZHUDA_LIT_SHEEN_UNIFORM] = l.ShaderDataType.Vector4;
      if (subsurface)
        map[ZHUDA_LIT_SUBSURFACE_UNIFORM] = map[ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM] =
          l.ShaderDataType.Vector4;
      if (strands)
        map[ZHUDA_LIT_STRANDS_UNIFORM] = map[ZHUDA_LIT_STRAND_COLOR_UNIFORM] =
          l.ShaderDataType.Vector4;
      if (spec.common || spec.alphaHash) registerZhudaCommon(l);
      const programs = buildZhudaLitFragmentShaders({ ...spec, uniforms }, shading);
      const fragment = programs.forward;
      const shader = l.Shader3D.add(spec.name, true, true);
      shader.shaderType = l.ShaderFeatureType.D3;
      const sub = new l.SubShader(
        {
          ...l.SubShader.DefaultAttributeMap,
          [ZHUDA_INSTANCE_TINT_ATTRIBUTE]: [ZHUDA_INSTANCE_TINT_LOCATION, l.ShaderDataType.Vector4],
        },
        map,
        {},
      );
      shader.addSubShader(sub);
      const vertexPrograms = buildZhudaLitVertexShaders(spec.vertex, {
        objectPosition: spec.alphaHash === true,
        shadowSurface: programs.shadowHook,
      });
      sub.addShaderPass(
        replaceOnce(
          vertexPrograms.forward,
          'void main(){',
          TINT_VARYING + 'void main(){' + TINT_PASS,
        ),
        fragment,
      );
      registerZhudaInstanceTintShader(l, spec.name);
      sub.addShaderPass(vertexPrograms.shadow, programs.shadow, 'ShadowCaster');
      sub.addShaderPass(vertexPrograms.depth, programs.depth, 'DepthNormal');
      const culls: Record<string, unknown> = {
        front: l.RenderState.CULL_FRONT,
        back: l.RenderState.CULL_BACK,
        none: l.RenderState.CULL_NONE,
      };
      for (const extra of shading?.passes?.(vertexPrograms) ?? []) {
        const pass = sub.addShaderPass(extra.vertex, extra.fragment);
        if (extra.cull) {
          // The pass's own side wins over the material's; the rest stays the material's.
          pass.statefirst = true;
          pass.renderState.cull = culls[extra.cull];
        }
      }
      records.set(spec.name, signature);
    }
    const m = createSurfaceMaterial({
      type: 'pbr',
      ...spec.material,
      ...(spec.alphaHash ? { blend: 'cutout' as const } : {}),
    });
    m.setShaderName(spec.name);
    // Switching shader applies the new shader's defaults. Rebind owned factors and
    // borrowed textures afterwards; otherwise a correct shader can render black.
    const settings = spec.material || {};
    // The render state and the defines are among those defaults: a two-sided
    // material came out one-sided, and one that was to be cut or blended was
    // drawn whole. An opaque one is left with what the shader change gave it.
    const blend = spec.alphaHash ? ('cutout' as const) : settings.blend;
    if ((blend && blend !== 'opaque') || settings.depthWrite !== undefined)
      applySurfaceBlend(m, { ...settings, type: 'pbr', blend });
    else if (settings.doubleSided) m.cull = l.RenderState.CULL_NONE;
    m.albedoColor = new l.Color(...(settings.color || [1, 1, 1, 1]));
    m.metallic = settings.metallic ?? 0;
    m.smoothness = 1 - (settings.roughness ?? 0.5);
    const slots: Record<string, string> = {
      albedo: 'albedoTexture',
      normal: 'normalTexture',
      metallicGloss: 'metallicGlossTexture',
      emission: 'emissionTexture',
    };
    for (const [k, value] of Object.entries(settings.textures || {}))
      m[slots[k]] = (value as any)?.bitmap || value;
    m.emissionColor = new l.Color(...(settings.emission || [0, 0, 0]), 1);
    m.tilingOffset = new l.Vector4(1, 1, 0, 0);
    m.normalTextureScale = 1;
    m.occlusionTextureStrength = 1;
    m.emissionIntensity = 1;
    if (sheen) {
      // LayaAir's define for its sheen lobe: the surface, the light and the room's light all read it.
      m.addDefine(l.Shader3D.getDefineByName('SHEEN'));
      m.setVector4(
        ZHUDA_LIT_SHEEN_UNIFORM,
        new l.Vector4(sheen.color[0], sheen.color[1], sheen.color[2], sheen.roughness),
      );
    }
    this.material = m;
    if (subsurface) this.writeSubsurface(subsurface);
    if (strands) this.writeStrands(strands);
    m.clearCoatEnable = (spec.material?.clearCoat ?? 0) > 0;
    m.clearCoat = spec.material?.clearCoat ?? 0;
    m.clearCoatRoughness = spec.material?.clearCoatRoughness ?? 0.1;
    m.enableEmission = true;
    this.material = m;
    for (const [k, u] of Object.entries(uniforms))
      this.set(
        k,
        u.type === 'texture2D'
          ? textures[k]
          : (u.value ?? (u.type === 'float' ? 0 : Array(Number(u.type.slice(-1))).fill(0))),
      );
  }
  set(name: string, value: any) {
    if (this.disposed) throw Error('Disposed material');
    const u = this.spec.uniforms?.[name];
    if (!u) throw Error('Unknown uniform ' + name);
    const l = (globalThis as any).Laya;
    if (u.type === 'texture2D') this.material.setTexture(name, value?.bitmap || value);
    else if (u.type === 'float') {
      if (!Number.isFinite(value)) throw Error('Expected finite float');
      this.material.setFloat(name, value);
    } else {
      const n = Number(u.type.slice(-1));
      // A LayaAir vector or colour is taken as well as an array.
      if (value && !Array.isArray(value) && typeof value === 'object')
        value = (value.x !== undefined ? ['x', 'y', 'z', 'w'] : ['r', 'g', 'b', 'a'])
          .slice(0, n)
          .map((key) => value[key]);
      if (!Array.isArray(value) || value.length !== n || !value.every(Number.isFinite))
        throw Error(
          `Invalid value for ${name}: ${n} finite numbers (an array, or a LayaAir vector)`,
        );
      this.material[{ 2: 'setVector2', 3: 'setVector3', 4: 'setVector4' }[n] as string](
        name,
        new l['Vector' + n](...value),
      );
    }
  }
  /** The sheen's colour and roughness in place; only for a material made with `sheen`. */
  setSheen(sheen: { color?: readonly [number, number, number]; roughness?: number }) {
    if (this.disposed) throw Error('Disposed material');
    const now = resolveZhudaLitSheen(this.spec.sheen);
    if (!now) throw Error('The material was made without sheen');
    const next = resolveZhudaLitSheen({ ...now, ...sheen })!;
    this.spec.sheen = next;
    const l = (globalThis as any).Laya;
    this.material.setVector4(
      ZHUDA_LIT_SHEEN_UNIFORM,
      new l.Vector4(next.color[0], next.color[1], next.color[2], next.roughness),
    );
  }
  private writeSubsurface(v: NonNullable<ReturnType<typeof resolveZhudaLitSubsurface>>) {
    const l = (globalThis as any).Laya;
    this.material.setVector4(
      ZHUDA_LIT_SUBSURFACE_UNIFORM,
      new l.Vector4(v.color[0], v.color[1], v.color[2], v.wrap),
    );
    this.material.setVector4(
      ZHUDA_LIT_SUBSURFACE_BACK_UNIFORM,
      new l.Vector4(v.back, v.power, v.distortion, 0),
    );
  }
  private writeStrands(v: NonNullable<ReturnType<typeof resolveZhudaLitStrands>>) {
    const l = (globalThis as any).Laya;
    this.material.setVector4(
      ZHUDA_LIT_STRANDS_UNIFORM,
      new l.Vector4(v.shift[0], v.shift[1], v.exponent[0], v.exponent[1]),
    );
    this.material.setVector4(
      ZHUDA_LIT_STRAND_COLOR_UNIFORM,
      new l.Vector4(v.color[0], v.color[1], v.color[2], v.strength),
    );
  }
  /** The subsurface light's values in place; only for a material made with `subsurface`. */
  setSubsurface(subsurface: {
    color?: readonly [number, number, number];
    wrap?: number;
    back?: number;
    power?: number;
    distortion?: number;
  }) {
    if (this.disposed) throw Error('Disposed material');
    const now = resolveZhudaLitSubsurface(this.spec.subsurface);
    if (!now) throw Error('The material was made without subsurface');
    const next = resolveZhudaLitSubsurface({ ...now, ...subsurface })!;
    this.spec.subsurface = next;
    this.writeSubsurface(next);
  }
  /** The strand highlight's values in place (not `along`, which is in the program); only for a material made with `strands`. */
  setStrands(strands: {
    color?: readonly [number, number, number];
    strength?: number;
    shift?: readonly [number, number];
    exponent?: readonly [number, number];
  }) {
    if (this.disposed) throw Error('Disposed material');
    const now = resolveZhudaLitStrands(this.spec.strands);
    if (!now) throw Error('The material was made without strands');
    if ((strands as { along?: unknown }).along !== undefined)
      throw Error('strands.along is part of the program: make another material');
    const next = resolveZhudaLitStrands({ ...now, ...strands })!;
    this.spec.strands = next;
    this.writeStrands(next);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [k, u] of Object.entries(this.spec.uniforms || {}))
      if (u.type === 'texture2D') this.material.setTexture(k, null);
    disposeSurfaceMaterial(this.material);
  }
}
