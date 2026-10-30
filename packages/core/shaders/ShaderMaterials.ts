import {
  createCustomSurfaceMaterial,
  type SurfacePassRequirements,
} from "../runtime3d/Surfaces.ts";
import { graphicsVertex, graphicsFragment } from "./Laya342ShaderTemplates.ts";
export type ShaderUniformType =
  | "float"
  | "vec2"
  | "vec3"
  | "vec4"
  | "texture2D";
export interface ShaderUniformSpec {
  type: ShaderUniformType;
  value?: number | number[];
}
export interface ZhudaShaderSpec {
  schemaVersion: 1;
  name: string;
  dimension: 2 | 3;
  surface: string;
  uniforms: Record<string, ShaderUniformSpec>;
  blend?: "opaque" | "alpha" | "additive";
  doubleSided?: boolean;
  depthWrite?: boolean;
  passes?: SurfacePassRequirements;
}
export function validateShaderSpec(spec: unknown): string[] {
  const s = spec as ZhudaShaderSpec,
    e: string[] = [];
  if (!s || s.schemaVersion !== 1 || ![2, 3].includes(s.dimension))
    return ["Expected schemaVersion:1 and dimension:2|3"];
  if (typeof s.name !== "string" || !/^Zhuda[A-Za-z0-9_]{1,100}$/.test(s.name))
    e.push("Shader name must start with Zhuda, then letters/digits/_");
  if (
    typeof s.surface !== "string" ||
    s.surface.length > 65536 ||
    !s.surface.includes("zhudaSurface")
  )
    e.push("surface must define zhudaSurface (at most 65536 characters)");
  if (
    !s.uniforms ||
    typeof s.uniforms !== "object" ||
    Array.isArray(s.uniforms) ||
    Object.keys(s.uniforms).length > 64
  )
    e.push("Expected at most 64 uniform descriptors");
  else
    for (const [name, u] of Object.entries(s.uniforms)) {
      if (!/^u_Zhuda[A-Za-z0-9_]+$/.test(name))
        e.push("Custom uniforms must use u_Zhuda prefix");
      if (
        !u ||
        !["float", "vec2", "vec3", "vec4", "texture2D"].includes(u.type)
      ) {
        e.push("Invalid uniform type " + name);
        continue;
      }
      const n = { float: 1, vec2: 2, vec3: 3, vec4: 4, texture2D: 0 }[u.type];
      if (
        n &&
        u.value !== undefined &&
        (n === 1
          ? typeof u.value !== "number" || !Number.isFinite(u.value)
          : !Array.isArray(u.value) ||
            u.value.length !== n ||
            !u.value.every(Number.isFinite))
      )
        e.push("Invalid uniform value " + name);
      if (!n && u.value !== undefined)
        e.push(
          "Texture uniforms use the external texture bindings, not JSON values",
        );
    }
  if (s.blend && !["opaque", "alpha", "additive"].includes(s.blend))
    e.push("Invalid blend");
  if (s.dimension === 2 && s.passes && (s.passes.depth || s.passes.opaqueColor))
    e.push("2D graphics shaders cannot request 3D camera passes");
  if (
    typeof s.surface === "string" &&
    /\b(?:uniform|attribute|varying)\b|#\s*(?:version|include)|\bvoid\s+main\s*\(/.test(
      s.surface.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""),
    )
  )
    e.push(
      "surface is a function body contract; declarations/includes/main belong to the engine template",
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
const fragment3D = (surface: string) => `#include "Color.glsl";
#include "Scene.glsl";
#include "SceneFog.glsl";
varying vec2 v_ZhudaUV;varying vec3 v_ZhudaPosition;varying vec3 v_ZhudaNormal;
${surface}
void main(){gl_FragColor=outputTransform(zhudaSurface(v_ZhudaUV,v_ZhudaPosition,normalize(v_ZhudaNormal)));
#ifdef FOG
gl_FragColor.rgb=scenUnlitFog(gl_FragColor.rgb);
#endif
}`;
/** Named and typed uniforms; built-in transforms, clipping and output remain in tested templates.
 * Surface validation is structural. Actual GLSL compilation/variants require a real rendered draw. */
export class ZhudaShaderMaterial {
  readonly material: any;
  readonly spec: ZhudaShaderSpec;
  private disposed = false;
  constructor(spec: ZhudaShaderSpec, textures: Record<string, any> = {}) {
    const e = validateShaderSpec(spec);
    if (e.length) throw Error(e.join("; "));
    this.spec = JSON.parse(JSON.stringify(spec));
    for (const [name, u] of Object.entries(spec.uniforms))
      if (u.type === "texture2D" && !textures[name])
        throw Error("Missing texture binding " + name);
    const l = (globalThis as any).Laya,
      types = {
        float: l.ShaderDataType.Float,
        vec2: l.ShaderDataType.Vector2,
        vec3: l.ShaderDataType.Vector3,
        vec4: l.ShaderDataType.Vector4,
        texture2D: l.ShaderDataType.Texture2D,
      },
      uniforms = Object.fromEntries(
        Object.keys(spec.uniforms)
          .sort()
          .map((name) => [name, types[spec.uniforms[name].type]]),
      );
    const textureHelpers = Object.entries(spec.uniforms)
      .filter(([, u]) => u.type === "texture2D")
      .map(
        ([
          name,
        ]) => `vec4 zhudaSample_${name}(vec2 uv){vec4 c=texture2D(${name},uv);
#ifdef Gamma_${name}
c=gammaToLinear(c);
#endif
return c;}`,
      )
      .join("\n");
    const surface = textureHelpers + "\n" + spec.surface;
    this.material = createCustomSurfaceMaterial({
      name: spec.name,
      dimension: spec.dimension,
      vertex: spec.dimension === 2 ? graphicsVertex : vertex3D,
      fragment:
        spec.dimension === 2
          ? graphicsFragment.replace("__ZHUDA_FUNCTION__", surface)
          : fragment3D(surface),
      uniforms,
      instancing: spec.dimension === 3,
    });
    try {
      const m = this.material,
        blend = spec.blend || (spec.dimension === 2 ? "alpha" : "opaque");
      m.depthWrite =
        spec.depthWrite ?? (spec.dimension === 3 && blend === "opaque");
      m.depthTest =
        spec.dimension === 2
          ? l.RenderState.DEPTHTEST_ALWAYS
          : l.RenderState.DEPTHTEST_LESS;
      m.cull =
        spec.dimension === 2 || spec.doubleSided
          ? l.RenderState.CULL_NONE
          : l.RenderState.CULL_BACK;
      m.renderQueue =
        blend === "opaque"
          ? l.Material.RENDERQUEUE_OPAQUE
          : l.Material.RENDERQUEUE_TRANSPARENT;
      m.blend =
        blend === "opaque"
          ? l.RenderState.BLEND_DISABLE
          : l.RenderState.BLEND_ENABLE_ALL;
      m.blendSrc =
        spec.dimension === 2
          ? l.RenderState.BLENDPARAM_ONE
          : l.RenderState.BLENDPARAM_SRC_ALPHA;
      m.blendDst =
        blend === "additive"
          ? l.RenderState.BLENDPARAM_ONE
          : l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
      for (const [name, u] of Object.entries(spec.uniforms)) {
        if (u.type === "texture2D") this.setTexture(name, textures[name]);
        else
          this.setUniform(
            name,
            u.value ??
              (u.type === "float"
                ? 0
                : Array(Number(u.type.slice(-1))).fill(0)),
          );
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  setUniform(name: string, value: number | readonly number[]) {
    if (this.disposed) throw Error("Disposed shader");
    const u = this.spec.uniforms[name];
    if (!u || u.type === "texture2D")
      throw Error("Unknown numeric uniform " + name);
    const n = u.type === "float" ? 1 : Number(u.type.slice(-1));
    if (
      n === 1
        ? typeof value !== "number" || !Number.isFinite(value)
        : typeof value === "number" ||
          value.length !== n ||
          !Array.from(value).every(Number.isFinite)
    )
      throw Error("Invalid uniform " + name);
    const l = (globalThis as any).Laya;
    if (u.type === "float") this.material.setFloat(name, value);
    else
      this.material["setVector" + n](
        name,
        new l["Vector" + n](...(value as number[])),
      );
  }
  setTexture(name: string, texture: any) {
    if (
      this.disposed ||
      this.spec.uniforms[name]?.type !== "texture2D" ||
      !texture ||
      texture.destroyed
    )
      throw Error("Invalid texture binding " + name);
    this.material.setTexture(name, texture.bitmap || texture);
  }
  report() {
    return {
      name: this.spec.name,
      dimension: this.spec.dimension,
      uniforms: Object.keys(this.spec.uniforms),
      passes: this.spec.passes || {},
      gpuStatus: "requires-first-draw" as const,
      disposed: this.disposed,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [name, u] of Object.entries(this.spec.uniforms))
      if (u.type === "texture2D") this.material.setTexture(name, null);
    this.material.destroy();
  }
}
export const shaderRecipes: Record<
  "terrain3D" | "textured3D" | "dissolve3D" | "tint2D",
  ZhudaShaderSpec
> = {
  terrain3D: {
    schemaVersion: 1,
    name: "ZhudaTerrainHeightSlope",
    dimension: 3,
    uniforms: {
      u_ZhudaGrass: { type: "vec3", value: [0.15, 0.42, 0.13] },
      u_ZhudaRock: { type: "vec3", value: [0.38, 0.32, 0.26] },
      u_ZhudaSnow: { type: "vec3", value: [0.85, 0.91, 0.96] },
      u_ZhudaSnowLine: { type: "float", value: 5 },
    },
    surface: `vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float slope=1.0-abs(n.y);vec3 color=mix(u_ZhudaGrass,u_ZhudaRock,smoothstep(.12,.5,slope));color=mix(color,u_ZhudaSnow,smoothstep(u_ZhudaSnowLine-.5,u_ZhudaSnowLine+.5,p.y));float grid=.95+.05*sin(uv.x*3.14159)*sin(uv.y*3.14159);float light=.35+.65*max(0.0,dot(n,normalize(vec3(.3,1.0,.2))));return vec4(color*light*grid,1.0);}`,
  },
  textured3D: {
    schemaVersion: 1,
    name: "ZhudaTexturedSurface",
    dimension: 3,
    uniforms: {
      u_ZhudaTexture: { type: "texture2D" },
      u_ZhudaTint: { type: "vec4", value: [1, 1, 1, 1] },
    },
    surface:
      "vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){return zhudaSample_u_ZhudaTexture(uv)*u_ZhudaTint;}",
  },
  dissolve3D: {
    schemaVersion: 1,
    name: "ZhudaDissolveSurface",
    dimension: 3,
    doubleSided: true,
    uniforms: {
      u_ZhudaAmount: { type: "float", value: 0.4 },
      u_ZhudaTint: { type: "vec4", value: [0.1, 0.7, 1, 1] },
    },
    surface:
      "vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float noise=fract(sin(dot(floor(uv*40.0),vec2(12.98,78.23)))*43758.54);if(noise<u_ZhudaAmount)discard;float edge=1.0-smoothstep(u_ZhudaAmount,u_ZhudaAmount+.08,noise);return vec4(mix(u_ZhudaTint.rgb,vec3(1.0,.7,.05),edge),u_ZhudaTint.a);}",
  },
  tint2D: {
    schemaVersion: 1,
    name: "ZhudaGraphicsTint",
    dimension: 2,
    uniforms: { u_ZhudaTint: { type: "vec4", value: [1, 1, 1, 1] } },
    surface:
      "vec4 zhudaSurface(vec2 uv,vec4 color){return vec4(color.rgb*u_ZhudaTint.rgb*u_ZhudaTint.a,color.a*u_ZhudaTint.a);}",
  },
};
