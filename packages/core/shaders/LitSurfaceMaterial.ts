import {
  createSurfaceMaterial,
  disposeSurfaceMaterial,
  type SurfaceMaterialSpec,
} from '../runtime3d/Surfaces.ts';
import { validateShaderSpec, type ShaderUniformSpec } from './ShaderMaterials.ts';
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
   * Fields: baseColor (linear), metallic, roughness, occlusion, emission (linear HDR).
   * Geometry, alpha and normal maps retain the native PBR shadow/depth contract. */
  surface: string;
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
const registry = new WeakMap<object, Map<string, string>>();

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
/**
 * The three vertex programs of a lit material. Without a hook they are the
 * native templates unchanged; with one, each pass runs `zhudaVertex` on the
 * world-space position and normal before projecting. Pure: no Laya needed.
 */
export function buildZhudaLitVertexShaders(vertex?: string): {
  forward: string;
  shadow: string;
  depth: string;
} {
  if (vertex === undefined)
    return { forward: litVertex, shadow: litShadowVertex, depth: litDepthVertex };
  const errors = validateZhudaLitVertexHook(vertex);
  if (errors.length) throw Error(errors.join('; '));
  const hook = vertex + '\n' + VERTEX_APPLY;
  const forward = replaceOnce(
    replaceOnce(litVertex, 'void main(){', hook + 'void main(){'),
    'PixelParams pixel;initPixelParams(pixel,vertex);',
    'PixelParams pixel;initPixelParams(pixel,vertex);zhudaApplyVertex(pixel,vertex);sharePixelParams(pixel);',
  );
  const depth = replaceOnce(
    replaceOnce(litDepthVertex, 'void main(){', hook + 'void main(){'),
    'initPixelParams(pixel,vertex);sharePixelParams(pixel);',
    'initPixelParams(pixel,vertex);zhudaApplyVertex(pixel,vertex);sharePixelParams(pixel);',
  );
  const shadow = replaceOnce(
    replaceOnce(litShadowVertex, 'void main(){', vertex + '\nvoid main(){'),
    'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
    SHADOW_APPLY + 'vec4 positionCS=DepthPositionCS(positionWS,normalWS);',
  );
  return { forward, shadow, depth };
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
  constructor(spec: ZhudaLitSurfaceSpec, textures: Record<string, any> = {}) {
    const uniforms = spec.uniforms || {};
    const errors = validateShaderSpec({
      schemaVersion: 1,
      dimension: 3,
      name: spec.name,
      surface: spec.surface,
      uniforms,
    });
    if (errors.length) throw Error(errors.join('; '));
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
      uniforms,
      normalConvention: spec.normalConvention || 'directx',
      // Absent for hook-free materials, so their signatures stay as before.
      ...(spec.vertex !== undefined ? { vertex: spec.vertex } : {}),
      ...(spec.backFaces === 'same' ? { backFaces: 'same' } : {}),
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
      const helper = Object.entries(uniforms)
        .filter(([, u]) => u.type === 'texture2D')
        .map(
          ([k]) =>
            `vec4 zhudaSample_${k}(vec2 uv){vec4 c=texture2D(${k},uv);\n#ifdef Gamma_${k}\nc=gammaToLinear(c);\n#endif\nreturn c;}`,
        )
        .join('\n');
      const hook = `struct ZhudaLitSurface {vec3 baseColor;float metallic;float roughness;float occlusion;vec3 emission;};\n${helper}\n${spec.surface}\n`;
      const call = `initSurfaceInputs(inputs,pixel);ZhudaLitSurface s;s.baseColor=inputs.diffuseColor;s.metallic=inputs.metallic;s.roughness=1.0-inputs.smoothness;s.occlusion=inputs.occlusion;s.emission=inputs.emissionColor;\n#ifdef UV\nvec2 zhudaUV=pixel.uv0;\n#else\nvec2 zhudaUV=vec2(0.0);\n#endif\nzhudaSurface(s,zhudaUV,pixel.positionWS,pixel.normalWS);inputs.diffuseColor=max(s.baseColor,vec3(0.0));inputs.metallic=clamp(s.metallic,0.0,1.0);inputs.smoothness=1.0-clamp(s.roughness,0.04,1.0);inputs.occlusion=clamp(s.occlusion,0.0,1.0);inputs.emissionColor=max(s.emission,vec3(0.0));`;
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
      const fragment = backs(normals(litFragment))
        .replace('void main(){', hook + 'void main(){')
        .replace('initSurfaceInputs(inputs,pixel);', call);
      const shader = l.Shader3D.add(spec.name, true, true);
      shader.shaderType = l.ShaderFeatureType.D3;
      const sub = new l.SubShader(l.SubShader.DefaultAttributeMap, map, {});
      shader.addSubShader(sub);
      const vertexPrograms = buildZhudaLitVertexShaders(spec.vertex);
      sub.addShaderPass(vertexPrograms.forward, fragment);
      sub.addShaderPass(vertexPrograms.shadow, litShadowFragment, 'ShadowCaster');
      sub.addShaderPass(vertexPrograms.depth, backs(normals(litDepthFragment)), 'DepthNormal');
      records.set(spec.name, signature);
    }
    const m = createSurfaceMaterial({ type: 'pbr', ...spec.material });
    m.setShaderName(spec.name);
    // Switching shader applies the new shader's defaults. Rebind owned factors and
    // borrowed textures afterwards; otherwise a correct shader can render black.
    const settings = spec.material || {};
    // The render state is among those defaults: a two-sided material came out one-sided.
    if (settings.doubleSided) m.cull = l.RenderState.CULL_NONE;
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
      if (!Array.isArray(value) || value.length !== n || !value.every(Number.isFinite))
        throw Error('Invalid vector');
      this.material[{ 2: 'setVector2', 3: 'setVector3', 4: 'setVector4' }[n] as string](
        name,
        new l['Vector' + n](...value),
      );
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const l = (globalThis as any).Laya;
    for (const [k, u] of Object.entries(this.spec.uniforms || {}))
      if (u.type === 'texture2D') this.material.setTexture(k, null);
    disposeSurfaceMaterial(this.material);
  }
}
