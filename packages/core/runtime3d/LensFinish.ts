/**
 * The marks a real camera leaves on a picture, as one post-process effect at
 * the end of the chain (after tone mapping): film grain, a vignette and a
 * little colour fringing toward the corners. A rendered frame without them
 * looks cleaner than any photograph, which reads as computer-made.
 *
 * Grain is a function of the pixel and a frame seed, so a frame is the same
 * however often it is rendered. Only the class needs the Laya runtime.
 */

export interface ZhudaLensFinishOptions {
  /** Grain strength, 0..1 (default 0.25): 1 is about ±6 % of full scale in the mid-tones. */
  grain?: number;
  /** How much the corners darken, 0..1 (default 0.3). */
  vignette?: number;
  /** Colour fringing at the corners, 0..1 (default 0.15): 1 shifts red and blue by 0.4 % of the frame. */
  fringe?: number;
}

const within = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaLensFinish(options: ZhudaLensFinishOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  for (const key of ['grain', 'vignette', 'fringe'])
    if (o[key] !== undefined && !within(o[key])) issues.push(`${key}: use 0..1`);
  return issues;
}

/**
 * How much darker a point is than the centre: `x` and `y` are -1..1 across
 * the frame. The same curve as the shader.
 */
export function zhudaVignette(strength: number, x: number, y: number): number {
  const r2 = (x * x + y * y) / 2,
    falloff = r2 * r2;
  return 1 - strength * 0.85 * (falloff * (3 - 2 * Math.min(1, falloff)));
}

const VERTEX =
  '#define SHADER_NAME ZhudaLensFinishVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
const FRAGMENT = `#define SHADER_NAME ZhudaLensFinishFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
float zhudaGrainHash(vec2 p,float seed){vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)+seed*0.071);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec3 zhudaFinishSample(vec2 uv){vec4 c=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
return c.rgb;}
void main(){
vec2 uv=v_Texcoord0;
vec2 centred=uv*2.0-1.0;
vec2 shift=centred*dot(centred,centred)*0.5*u_ZhudaFinish.z*0.004;
// Stay inside the picture: a sample past the edge would bring in the opposite side.
vec2 low=vec2(0.002),high=vec2(0.998);
vec3 colour=vec3(zhudaFinishSample(clamp(uv+shift,low,high)).r,zhudaFinishSample(uv).g,zhudaFinishSample(clamp(uv-shift,low,high)).b);
float r2=dot(centred,centred)*0.5;
float falloff=r2*r2;
colour*=1.0-u_ZhudaFinish.y*0.85*(falloff*(3.0-2.0*min(1.0,falloff)));
vec2 pixel=floor(uv*u_ZhudaFinishFrame.xy);
float noise=zhudaGrainHash(pixel,u_ZhudaFinishFrame.z)+zhudaGrainHash(pixel+17.0,u_ZhudaFinishFrame.z+3.0)-1.0;
float luma=dot(colour,vec3(0.2126,0.7152,0.0722));
colour+=noise*u_ZhudaFinish.x*0.06*(0.35+0.65*sqrt(clamp(luma*(1.0-luma)*4.0,0.0,1.0)));
gl_FragColor=vec4(max(colour,0.0),1.0);
}`;

const registered = new WeakSet<object>();

export class ZhudaLensFinish {
  /** The Laya post-process effect; `ZhudaFilmicPipeline` adds it last (`finishEffects`). */
  readonly effect: any;
  private readonly material: any;
  private disposed = false;

  constructor(options: ZhudaLensFinishOptions = {}) {
    const issues = validateZhudaLensFinish(options);
    if (issues.length) throw Error('Invalid lens finish: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.MaterialPostProcessEffect)
      throw Error('Lens finish needs the Laya post-process module');
    if (!registered.has(l.Shader3D)) {
      const shader = l.Shader3D.add('ZhudaLensFinish');
      shader.shaderType = l.ShaderFeatureType.PostProcess;
      const sub = new l.SubShader(
        { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
        {
          u_MainTex: l.ShaderDataType.Texture2D,
          u_ZhudaFinish: l.ShaderDataType.Vector4,
          u_ZhudaFinishFrame: l.ShaderDataType.Vector4,
        },
      );
      shader.addSubShader(sub);
      const pass = sub.addShaderPass(VERTEX, FRAGMENT);
      pass.statefirst = true;
      pass.renderState.cull = l.RenderState.CULL_NONE;
      registered.add(l.Shader3D);
    }
    this.material = new l.Material();
    this.material.setShaderName('ZhudaLensFinish');
    this.material.setVector4(
      'u_ZhudaFinish',
      new l.Vector4(options.grain ?? 0.25, options.vignette ?? 0.3, options.fringe ?? 0.15, 0),
    );
    this.effect = new l.MaterialPostProcessEffect();
    this.effect.material = this.material;
    this.setFrame(1280, 720, 0);
  }

  /** New strengths in place; the same limits as the options. */
  setFinish(options: ZhudaLensFinishOptions): void {
    const issues = validateZhudaLensFinish(options);
    if (issues.length) throw Error('Invalid lens finish: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    const now = this.material.getVector4('u_ZhudaFinish');
    this.material.setVector4(
      'u_ZhudaFinish',
      new l.Vector4(
        options.grain ?? now.x,
        options.vignette ?? now.y,
        options.fringe ?? now.z,
        now.w,
      ),
    );
  }

  /** Output size in pixels and the frame number that seeds the grain. */
  setFrame(width: number, height: number, frame: number): void {
    if (this.disposed) throw Error('Disposed lens finish');
    if (![width, height, frame].every(Number.isFinite) || width <= 0 || height <= 0)
      throw Error('Invalid lens finish frame');
    const l = (globalThis as any).Laya;
    this.material.setVector4('u_ZhudaFinishFrame', new l.Vector4(width, height, frame % 4096, 0));
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.effect.material = null;
    this.material.destroy();
  }
}
