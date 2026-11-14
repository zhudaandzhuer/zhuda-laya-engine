import {
  createCustomSurfaceMaterial,
  type SurfacePassRequirements,
} from '../runtime3d/Surfaces.ts';
import { graphicsVertex, graphicsFragment } from './Laya342ShaderTemplates.ts';
import { ZHUDA_COMMON_INCLUDE, registerZhudaCommon } from './ZhudaCommon.ts';
export type ShaderUniformType =
  | 'float'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'int'
  | 'mat4'
  | 'texture2D'
  | 'textureCube';
export interface ShaderUniformSpec {
  type: ShaderUniformType;
  /**
   * A number for `float` and `int`, that many for a vector, sixteen in
   * column order for `mat4`; with `length`, that many elements one after
   * another.
   */
  value?: number | number[];
  /**
   * An array of `float`, `vec2`, `vec3` or `vec4`, 2..64 elements: the
   * shader reads `u_ZhudaName[i]`.
   */
  length?: number;
}
/** Numbers one value of a type is; 0 for a texture. */
const UNIFORM_SIZE: Record<ShaderUniformType, number> = {
  float: 1,
  vec2: 2,
  vec3: 3,
  vec4: 4,
  int: 1,
  mat4: 16,
  texture2D: 0,
  textureCube: 0,
};
const isTexture = (type: ShaderUniformType) => type === 'texture2D' || type === 'textureCube';
/** Whether a value is what a uniform of this spec takes. */
function validUniformValue(u: ShaderUniformSpec, value: unknown): boolean {
  const n = UNIFORM_SIZE[u.type] * (u.length ?? 1);
  if (n === 1)
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      (u.type !== 'int' || (Number.isInteger(value) && Math.abs(value) <= 2147483647))
    );
  return (
    (Array.isArray(value) || value instanceof Float32Array) &&
    (value as ArrayLike<number>).length === n &&
    Array.from(value as ArrayLike<number>).every(Number.isFinite)
  );
}
export interface ZhudaShaderSpec {
  schemaVersion: 1;
  name: string;
  dimension: 2 | 3;
  surface: string;
  uniforms: Record<string, ShaderUniformSpec>;
  blend?: 'opaque' | 'alpha' | 'additive';
  doubleSided?: boolean;
  depthWrite?: boolean;
  /** Opt out for sky domes/backgrounds; scene fog remains enabled for other surfaces. */
  fog?: boolean;
  passes?: SurfacePassRequirements;
  /**
   * The surface may call the functions of `ZhudaCommon.glsl`: `zhudaHash`,
   * `zhudaNoise`, `zhudaFbm`, `zhudaTriplanarWeights`, `zhudaTriplanar`.
   */
  common?: boolean;
}
export function validateShaderSpec(spec: unknown): string[] {
  const s = spec as ZhudaShaderSpec,
    e: string[] = [];
  if (!s || s.schemaVersion !== 1 || ![2, 3].includes(s.dimension))
    return ['Expected schemaVersion:1 and dimension:2|3'];
  if (typeof s.name !== 'string' || !/^Zhuda[A-Za-z0-9_]{1,100}$/.test(s.name))
    e.push('Shader name must start with Zhuda, then letters/digits/_');
  if (s.fog !== undefined && typeof s.fog !== 'boolean') e.push('fog must be boolean');
  if (s.common !== undefined && typeof s.common !== 'boolean') e.push('common must be boolean');
  if (
    typeof s.surface !== 'string' ||
    s.surface.length > 65536 ||
    !s.surface.includes('zhudaSurface')
  )
    e.push('surface must define zhudaSurface (at most 65536 characters)');
  if (
    !s.uniforms ||
    typeof s.uniforms !== 'object' ||
    Array.isArray(s.uniforms) ||
    Object.keys(s.uniforms).length > 64
  )
    e.push('Expected at most 64 uniform descriptors');
  else
    for (const [name, u] of Object.entries(s.uniforms)) {
      if (!/^u_Zhuda[A-Za-z0-9_]+$/.test(name)) e.push('Custom uniforms must use u_Zhuda prefix');
      if (!u || !Object.hasOwn(UNIFORM_SIZE, u.type)) {
        e.push('Invalid uniform type ' + name);
        continue;
      }
      const n = UNIFORM_SIZE[u.type];
      if (u.length !== undefined) {
        if (!['float', 'vec2', 'vec3', 'vec4'].includes(u.type))
          e.push('Only float and vector uniforms can be arrays: ' + name);
        else if (!(Number.isInteger(u.length) && u.length >= 2 && u.length <= 64))
          e.push('Uniform array length must be a whole number 2..64: ' + name);
      }
      if (n && u.value !== undefined && !validUniformValue(u, u.value))
        e.push('Invalid uniform value ' + name);
      if (!n && u.value !== undefined)
        e.push('Texture uniforms use the external texture bindings, not JSON values');
    }
  if (s.blend && !['opaque', 'alpha', 'additive'].includes(s.blend)) e.push('Invalid blend');
  if (s.dimension === 2 && s.passes && (s.passes.depth || s.passes.opaqueColor))
    e.push('2D graphics shaders cannot request 3D camera passes');
  if (
    typeof s.surface === 'string' &&
    /\b(?:uniform|attribute|varying)\b|#\s*(?:version|include)|\bvoid\s+main\s*\(/.test(
      s.surface.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''),
    )
  )
    e.push(
      'surface is a function body contract; declarations/includes/main belong to the engine template',
    );
  return e;
}
const vertex3D = `#include "Scene.glsl";
#include "SceneFogInput.glsl";
#include "Camera.glsl";
#include "Sprite3DVertex.glsl";
#include "VertexCommon.glsl";
varying vec2 v_ZhudaUV;varying vec3 v_ZhudaPosition;varying vec3 v_ZhudaNormal;
void main(){Vertex v;getVertexParams(v);mat4 w=getWorldMatrix();vec4 p=w*vec4(v.positionOS,1.0);v_ZhudaPosition=p.xyz;
v_ZhudaUV=vec2(0.0);
#ifdef UV
v_ZhudaUV=v.texCoord0;
#endif
vec3 a=w[0].xyz,b=w[1].xyz,c=w[2].xyz;v_ZhudaNormal=normalize(mat3(cross(b,c),cross(c,a),cross(a,b))*v.normalOS)*sign(dot(a,cross(b,c)));
gl_Position=remapPositionZ(getPositionCS(p.xyz));
#ifdef FOG
FogHandle(gl_Position.z);
#endif
}`;
const fragment3D = (surface: string, fog = true, common = false) => `#include "Color.glsl";
#include "Scene.glsl";
#include "Camera.glsl";
#include "SceneFog.glsl";
${common ? `#include "${ZHUDA_COMMON_INCLUDE}";` : ''}
varying vec2 v_ZhudaUV;varying vec3 v_ZhudaPosition;varying vec3 v_ZhudaNormal;
${surface}
void main(){gl_FragColor=outputTransform(zhudaSurface(v_ZhudaUV,v_ZhudaPosition,normalize(v_ZhudaNormal)));
${
  fog
    ? `#ifdef FOG
gl_FragColor.rgb=scenUnlitFog(gl_FragColor.rgb);
#endif`
    : ''
}
}`;
/** Named and typed uniforms; built-in transforms, clipping and output remain in tested templates.
 * Surface validation is structural. Actual GLSL compilation/variants require a real rendered draw. */
export class ZhudaShaderMaterial {
  readonly material: any;
  readonly spec: ZhudaShaderSpec;
  private disposed = false;
  constructor(spec: ZhudaShaderSpec, textures: Record<string, any> = {}) {
    const e = validateShaderSpec(spec);
    if (e.length) throw Error(e.join('; '));
    this.spec = JSON.parse(JSON.stringify(spec));
    for (const [name, u] of Object.entries(spec.uniforms))
      if (isTexture(u.type) && !textures[name]) throw Error('Missing texture binding ' + name);
    const l = (globalThis as any).Laya,
      types: Record<ShaderUniformType, unknown> = {
        float: l.ShaderDataType.Float,
        vec2: l.ShaderDataType.Vector2,
        vec3: l.ShaderDataType.Vector3,
        vec4: l.ShaderDataType.Vector4,
        int: l.ShaderDataType.Int,
        mat4: l.ShaderDataType.Matrix4x4,
        texture2D: l.ShaderDataType.Texture2D,
        textureCube: l.ShaderDataType.TextureCube,
      },
      // LayaAir reads an array's length off its name: `u_ZhudaStops[4]`.
      uniforms = Object.fromEntries(
        Object.keys(spec.uniforms)
          .sort()
          .map((name) => {
            const u = spec.uniforms[name];
            return [u.length ? `${name}[${u.length}]` : name, types[u.type]];
          }),
      );
    if (spec.common) {
      if (spec.dimension !== 3) throw Error('common is for 3D surfaces');
      registerZhudaCommon(l);
    }
    const textureHelpers = Object.entries(spec.uniforms)
      .filter(([, u]) => isTexture(u.type))
      .map(([name, u]) =>
        u.type === 'textureCube'
          ? `vec4 zhudaSample_${name}(vec3 direction){vec4 c=textureCube(${name},direction);
#ifdef Gamma_${name}
c=gammaToLinear(c);
#endif
return c;}`
          : `vec4 zhudaSample_${name}(vec2 uv){vec4 c=texture2D(${name},uv);
#ifdef Gamma_${name}
c=gammaToLinear(c);
#endif
return c;}`,
      )
      .join('\n');
    const surface = textureHelpers + '\n' + spec.surface;
    this.material = createCustomSurfaceMaterial({
      name: spec.name,
      dimension: spec.dimension,
      vertex: spec.dimension === 2 ? graphicsVertex : vertex3D,
      fragment:
        spec.dimension === 2
          ? graphicsFragment.replace('__ZHUDA_FUNCTION__', surface)
          : fragment3D(surface, spec.fog !== false, !!spec.common),
      uniforms,
      instancing: spec.dimension === 3,
    });
    try {
      const m = this.material,
        blend = spec.blend || (spec.dimension === 2 ? 'alpha' : 'opaque');
      m.depthWrite = spec.depthWrite ?? (spec.dimension === 3 && blend === 'opaque');
      m.depthTest =
        spec.dimension === 2 ? l.RenderState.DEPTHTEST_ALWAYS : l.RenderState.DEPTHTEST_LESS;
      m.cull =
        spec.dimension === 2 || spec.doubleSided
          ? l.RenderState.CULL_NONE
          : l.RenderState.CULL_BACK;
      m.renderQueue =
        blend === 'opaque' ? l.Material.RENDERQUEUE_OPAQUE : l.Material.RENDERQUEUE_TRANSPARENT;
      m.blend = blend === 'opaque' ? l.RenderState.BLEND_DISABLE : l.RenderState.BLEND_ENABLE_ALL;
      m.blendSrc =
        spec.dimension === 2 ? l.RenderState.BLENDPARAM_ONE : l.RenderState.BLENDPARAM_SRC_ALPHA;
      m.blendDst =
        blend === 'additive'
          ? l.RenderState.BLENDPARAM_ONE
          : l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
      for (const [name, u] of Object.entries(spec.uniforms)) {
        if (isTexture(u.type)) this.setTexture(name, textures[name]);
        else {
          const n = UNIFORM_SIZE[u.type] * (u.length ?? 1);
          const zero =
            u.type === 'mat4' ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : Array(n).fill(0);
          this.setUniform(name, u.value ?? (n === 1 ? 0 : zero));
        }
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  /**
   * A uniform's value: a number, a vector's numbers, a matrix's sixteen in
   * column order, or an array's elements one after another.
   */
  setUniform(name: string, value: number | readonly number[] | Float32Array) {
    if (this.disposed) throw Error('Disposed shader');
    const u = this.spec.uniforms[name];
    if (!u || isTexture(u.type)) throw Error('Unknown numeric uniform ' + name);
    if (!validUniformValue(u, value)) throw Error('Invalid uniform ' + name);
    const l = (globalThis as any).Laya;
    const m = this.material;
    const list = value as ArrayLike<number>;
    // A new object each time: one changed in place is not uploaded on WebGPU.
    if (u.length) m.setBuffer(name, Float32Array.from(list));
    else if (u.type === 'float') m.setFloat(name, value);
    else if (u.type === 'int') m.setInt(name, value);
    else if (u.type === 'mat4') m.setMatrix4x4(name, new l.Matrix4x4(...Array.from(list)));
    else {
      const n = UNIFORM_SIZE[u.type];
      m['setVector' + n](name, new l['Vector' + n](...Array.from(list)));
    }
  }
  setTexture(name: string, texture: any) {
    const type = this.spec.uniforms[name]?.type;
    if (this.disposed || !type || !isTexture(type) || !texture || texture.destroyed)
      throw Error('Invalid texture binding ' + name);
    this.material.setTexture(name, texture.bitmap || texture);
  }
  report() {
    return {
      name: this.spec.name,
      dimension: this.spec.dimension,
      uniforms: Object.keys(this.spec.uniforms),
      passes: this.spec.passes || {},
      gpuStatus: 'requires-first-draw' as const,
      disposed: this.disposed,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [name, u] of Object.entries(this.spec.uniforms))
      if (isTexture(u.type)) this.material.setTexture(name, null);
    this.material.destroy();
  }
}
export const shaderRecipes: Record<
  'terrain3D' | 'textured3D' | 'dissolve3D' | 'matcap3D' | 'normalView3D' | 'tint2D',
  ZhudaShaderSpec
> = {
  terrain3D: {
    schemaVersion: 1,
    name: 'ZhudaTerrainHeightSlope',
    dimension: 3,
    uniforms: {
      u_ZhudaGrass: { type: 'vec3', value: [0.15, 0.42, 0.13] },
      u_ZhudaRock: { type: 'vec3', value: [0.38, 0.32, 0.26] },
      u_ZhudaSnow: { type: 'vec3', value: [0.85, 0.91, 0.96] },
      u_ZhudaSnowLine: { type: 'float', value: 5 },
    },
    surface: `vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float slope=1.0-abs(n.y);vec3 color=mix(u_ZhudaGrass,u_ZhudaRock,smoothstep(.12,.5,slope));color=mix(color,u_ZhudaSnow,smoothstep(u_ZhudaSnowLine-.5,u_ZhudaSnowLine+.5,p.y));float grid=.95+.05*sin(uv.x*3.14159)*sin(uv.y*3.14159);float light=.35+.65*max(0.0,dot(n,normalize(vec3(.3,1.0,.2))));return vec4(color*light*grid,1.0);}`,
  },
  textured3D: {
    schemaVersion: 1,
    name: 'ZhudaTexturedSurface',
    dimension: 3,
    uniforms: {
      u_ZhudaTexture: { type: 'texture2D' },
      u_ZhudaTint: { type: 'vec4', value: [1, 1, 1, 1] },
    },
    surface:
      'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){return zhudaSample_u_ZhudaTexture(uv)*u_ZhudaTint;}',
  },
  dissolve3D: {
    schemaVersion: 1,
    name: 'ZhudaDissolveSurface',
    dimension: 3,
    doubleSided: true,
    uniforms: {
      u_ZhudaAmount: { type: 'float', value: 0.4 },
      u_ZhudaTint: { type: 'vec4', value: [0.1, 0.7, 1, 1] },
    },
    surface:
      'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float noise=fract(sin(dot(floor(uv*40.0),vec2(12.98,78.23)))*43758.54);if(noise<u_ZhudaAmount)discard;float edge=1.0-smoothstep(u_ZhudaAmount,u_ZhudaAmount+.08,noise);return vec4(mix(u_ZhudaTint.rgb,vec3(1.0,.7,.05),edge),u_ZhudaTint.a);}',
  },
  /**
   * A picture of a lit ball stands in for the lighting (a "matcap"): each
   * point takes the colour the ball has where it faces the same way, as the
   * camera sees it. No lights, no shadows, one texture read: clay, chrome or
   * a painted look on any mesh, and the cheapest shading there is. The top
   * of the picture is the side facing up. Bind the picture as
   * `u_ZhudaMatcap`.
   */
  matcap3D: {
    schemaVersion: 1,
    name: 'ZhudaMatcapSurface',
    dimension: 3,
    uniforms: {
      u_ZhudaMatcap: { type: 'texture2D' },
      u_ZhudaTint: { type: 'vec4', value: [1, 1, 1, 1] },
    },
    surface:
      'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){vec3 toEye=normalize(mat3(u_View)*(u_CameraPos-p));vec3 facing=normalize(mat3(u_View)*n);vec3 across=normalize(vec3(toEye.z,0.0,-toEye.x));vec3 up=cross(toEye,across);vec2 at=vec2(dot(across,facing),-dot(up,facing))*0.495+0.5;return zhudaSample_u_ZhudaMatcap(at)*u_ZhudaTint;}',
  },
  /**
   * Which way each point faces, as a colour: right is red, up is green,
   * toward the camera is blue (x, y, z of the normal in view space, halved
   * and lifted to 0..1). For looking at a mesh's normals; without a grade the
   * screen shows the numbers as they are.
   */
  normalView3D: {
    schemaVersion: 1,
    name: 'ZhudaNormalViewSurface',
    dimension: 3,
    fog: false,
    uniforms: {},
    surface:
      'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){vec3 facing=normalize(mat3(u_View)*n);return vec4(pow(facing*0.5+0.5,vec3(2.2)),1.0);}',
  },
  tint2D: {
    schemaVersion: 1,
    name: 'ZhudaGraphicsTint',
    dimension: 2,
    uniforms: { u_ZhudaTint: { type: 'vec4', value: [1, 1, 1, 1] } },
    surface:
      'vec4 zhudaSurface(vec2 uv,vec4 color){return vec4(color.rgb*u_ZhudaTint.rgb*u_ZhudaTint.a,color.a*u_ZhudaTint.a);}',
  },
};
