/**
 * Edge smoothing as one pass over the finished picture (FXAA): where the
 * brightness steps along an edge, the pixel is mixed with its neighbours
 * along that edge. Nine reads of the frame a pixel and no extra memory:
 * for devices where multisampling an HDR target is too dear (on a phone it
 * was a fifth of the frame). It softens fine texture a little, which
 * multisampling does not, and it cannot recover a line thinner than a pixel.
 *
 * It runs after tone mapping, on the colours the screen shows: an edge is
 * judged as the eye sees it. Only the class needs the Laya runtime.
 */
const VERTEX =
  '#define SHADER_NAME ZhudaEdgeSmoothingVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
const FRAGMENT = `#define SHADER_NAME ZhudaEdgeSmoothingFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
vec3 zhudaEdgeSample(vec2 uv){vec4 c=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
return c.rgb;}
// Brightness as the eye weighs it, on a curve close to the screen's.
float zhudaEdgeLuma(vec3 c){return sqrt(dot(c,vec3(0.299,0.587,0.114)));}
void main(){
vec2 uv=v_Texcoord0;
vec2 texel=u_ZhudaEdgeTexel.xy;
vec3 middle=zhudaEdgeSample(uv);
float lNW=zhudaEdgeLuma(zhudaEdgeSample(uv+vec2(-1.0,-1.0)*texel));
float lNE=zhudaEdgeLuma(zhudaEdgeSample(uv+vec2(1.0,-1.0)*texel));
float lSW=zhudaEdgeLuma(zhudaEdgeSample(uv+vec2(-1.0,1.0)*texel));
float lSE=zhudaEdgeLuma(zhudaEdgeSample(uv+vec2(1.0,1.0)*texel));
float lM=zhudaEdgeLuma(middle);
float lowest=min(lM,min(min(lNW,lNE),min(lSW,lSE)));
float highest=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
// The way the edge runs: across the direction the brightness changes in.
vec2 along=vec2(-((lNW+lNE)-(lSW+lSE)),(lNW+lSW)-(lNE+lSE));
float reduce=max((lNW+lNE+lSW+lSE)*0.03125,0.0078125);
along=clamp(along/(min(abs(along.x),abs(along.y))+reduce),vec2(-8.0),vec2(8.0))*texel;
vec3 near=0.5*(zhudaEdgeSample(uv+along*(1.0/3.0-0.5))+zhudaEdgeSample(uv+along*(2.0/3.0-0.5)));
vec3 wide=near*0.5+0.25*(zhudaEdgeSample(uv-along*0.5)+zhudaEdgeSample(uv+along*0.5));
float lWide=zhudaEdgeLuma(wide);
// The wider mix reached past the edge into something else: keep the nearer one.
gl_FragColor=vec4(lWide<lowest||lWide>highest?near:wide,1.0);
}`;

const registered = new WeakSet<object>();

export class ZhudaEdgeSmoothing {
  /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `finishEffects`, before the lens finish. */
  readonly effect: any;
  private readonly material: any;
  private disposed = false;

  constructor() {
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect) throw Error('Edge smoothing needs the Laya post-process module');
    if (!registered.has(l.Shader3D)) {
      const shader = l.Shader3D.add('ZhudaEdgeSmoothing');
      shader.shaderType = l.ShaderFeatureType.PostProcess;
      const sub = new l.SubShader(
        { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
        { u_MainTex: l.ShaderDataType.Texture2D, u_ZhudaEdgeTexel: l.ShaderDataType.Vector4 },
      );
      shader.addSubShader(sub);
      const pass = sub.addShaderPass(VERTEX, FRAGMENT);
      pass.statefirst = true;
      pass.renderState.cull = l.RenderState.CULL_NONE;
      registered.add(l.Shader3D);
    }
    const material = (this.material = new l.Material());
    material.setShaderName('ZhudaEdgeSmoothing');
    material.setVector4('u_ZhudaEdgeTexel', new l.Vector4(1 / 1280, 1 / 720, 0, 0));
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      render(context: any) {
        // The size of a pixel of the picture being smoothed, whatever it is this frame.
        const source = context.indirectTarget;
        material.setVector4(
          'u_ZhudaEdgeTexel',
          new l.Vector4(1 / source.width, 1 / source.height, 0, 0),
        );
        context.command.blitScreenTriangle(
          source,
          context.destination,
          null,
          material.shader,
          material.shaderData,
          0,
        );
      }
    })();
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.material.destroy();
  }
}
