/**
 * Reflections of what is on screen, on every surface: wet walls, props, and
 * ground beyond a planar reflector. A post-process effect in linear HDR, after
 * ambient occlusion and before fog.
 *
 * A forward renderer has no roughness or normal buffer, so the whole view
 * reflects alike and by Fresnel: strongly at grazing angles, faintly head-on.
 * That is the look of rain and of polished places; it is not a substitute for
 * materials that differ. What is off screen, hidden behind something or behind
 * the camera is not reflected, and the sky is not (a ray that leaves the
 * picture finds nothing).
 */

export interface ZhudaScreenReflectionsOptions {
  /** Brightness of the reflections, 0..4 (default 1). */
  strength?: number;
  /** How wet the surfaces are, 0..1: how much shows when seen head-on (default 0.5). */
  wetness?: number;
  /** Metres a reflected ray is followed, 1..200 (default 30). */
  distance?: number;
  /** Steps along the ray, 8..64 (default 32). Fewer are cheaper and coarser. */
  steps?: number;
}

export const ZHUDA_SCREEN_REFLECTION_MAX_STEPS = 64;

const inRange = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function validateZhudaScreenReflections(options: ZhudaScreenReflectionsOptions): string[] {
  const issues: string[] = [];
  const o = options ?? {};
  const ranges: [keyof ZhudaScreenReflectionsOptions, number, number][] = [
    ['strength', 0, 4],
    ['wetness', 0, 1],
    ['distance', 1, 200],
  ];
  for (const [key, min, max] of ranges)
    if (o[key] !== undefined && !inRange(o[key], min, max))
      issues.push(`${key}: use ${min}..${max}`);
  if (
    o.steps !== undefined &&
    !(Number.isInteger(o.steps) && inRange(o.steps, 8, ZHUDA_SCREEN_REFLECTION_MAX_STEPS))
  )
    issues.push(`steps: use a whole number 8..${ZHUDA_SCREEN_REFLECTION_MAX_STEPS}`);
  return issues;
}

export function resolveZhudaScreenReflections(
  options: ZhudaScreenReflectionsOptions = {},
): Required<ZhudaScreenReflectionsOptions> {
  return {
    strength: options.strength ?? 1,
    wetness: options.wetness ?? 0.5,
    distance: options.distance ?? 30,
    steps: options.steps ?? 32,
  };
}

const VERTEX =
  '#define SHADER_NAME ZhudaScreenReflectionsVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';

// Every texture is sampled in every step: no branch depends on what was read
// (WGSL allows sampling in uniform control flow only).
const FRAGMENT = `#define SHADER_NAME ZhudaScreenReflectionsFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
float zhudaSsrDepth(vec2 at){return 1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,at).x+u_ZBufferParams.w);}
vec3 zhudaSsrRay(vec2 uv){vec2 ndc=uv*2.0-1.0;return u_ZhudaSsrForward.xyz+ndc.x*u_ZhudaSsrRight.xyz+ndc.y*u_ZhudaSsrUp.xyz;}
// Where the surface drawn at uv is, relative to the eye.
vec3 zhudaSsrPoint(vec2 uv){return zhudaSsrRay(uv)*zhudaSsrDepth(uv);}
// Screen position of a point relative to the eye; z is its depth along the view.
vec3 zhudaSsrScreen(vec3 q){
float z=dot(q,u_ZhudaSsrForward.xyz);
vec2 ndc=vec2(dot(q,u_ZhudaSsrRight.xyz)/dot(u_ZhudaSsrRight.xyz,u_ZhudaSsrRight.xyz),dot(q,u_ZhudaSsrUp.xyz)/dot(u_ZhudaSsrUp.xyz,u_ZhudaSsrUp.xyz))/max(z,0.0001);
return vec3(ndc*0.5+0.5,z);
}
void main(){
vec2 uv=v_Texcoord0;
vec4 source=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
float depth=zhudaSsrDepth(uv);
vec3 p=zhudaSsrRay(uv)*depth;
vec3 view=normalize(p);
// The surface normal from the neighbours' depths. Of each pair of neighbours
// the nearer one: it lies on this surface where the other is across an outline.
vec2 texel=1.0/max(u_Viewport.zw,vec2(1.0));
vec3 px=zhudaSsrPoint(uv+vec2(texel.x,0.0))-p;
vec3 nx=p-zhudaSsrPoint(uv-vec2(texel.x,0.0));
vec3 py=zhudaSsrPoint(uv+vec2(0.0,texel.y))-p;
vec3 ny=p-zhudaSsrPoint(uv-vec2(0.0,texel.y));
vec3 dx=dot(px,px)<dot(nx,nx)?px:nx;
vec3 dy=dot(py,py)<dot(ny,ny)?py:ny;
vec3 n=normalize(cross(dx,dy));
n=dot(n,view)>0.0?-n:n;
vec3 r=reflect(view,n);
float reach=u_ZhudaSsrShape.z;
float steps=u_ZhudaSsrShape.w;
// Each pixel starts at another offset, which turns banding into fine noise;
// the phase moves the offsets between the samples of a still, which average it out.
float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715)))+u_ZhudaSsrForward.w);
// March in screen space, evenly from where the ray starts to where it leaves
// the picture or reaches its distance: no step skips more pixels than the path
// is long divided by the steps, so a small bright thing in the path is found
// by most neighbouring pixels. Depth along the path is interpolated as 1/z,
// which is linear on screen.
float along=dot(r,u_ZhudaSsrForward.xyz);
float zp=dot(p,u_ZhudaSsrForward.xyz);
float tmax=reach;
if(along<0.0)tmax=min(tmax,max((zp-0.1)/(-along),0.0));
vec3 s0=zhudaSsrScreen(p);
vec3 s1=zhudaSsrScreen(p+r*tmax);
vec2 path=s1.xy-s0.xy;
float umax=1.0;
if(path.x>0.000001)umax=min(umax,(1.0-s0.x)/path.x);
if(path.x<-0.000001)umax=min(umax,-s0.x/path.x);
if(path.y>0.000001)umax=min(umax,(1.0-s0.y)/path.y);
if(path.y<-0.000001)umax=min(umax,-s0.y/path.y);
umax=clamp(umax,0.0,1.0);
float iz0=1.0/max(s0.z,0.0001);
float iz1=1.0/max(s1.z,0.0001);
float found=0.0;
float before=0.0;
float at=0.0;
float last=0.0;
for(int i=0;i<${ZHUDA_SCREEN_REFLECTION_MAX_STEPS};i++){
if(float(i)>=steps)break;
float u=umax*(float(i)+jitter)/steps;
vec2 uv=mix(s0.xy,s1.xy,u);
float zr=1.0/mix(iz0,iz1,u);
float behind=zr-zhudaSsrDepth(clamp(uv,vec2(0.0),vec2(1.0)));
float zlast=1.0/mix(iz0,iz1,last);
// Behind what is drawn there, but not by more than this step could have skipped.
// Tight: a ray that passes behind a thin thing (a lamp head) is not a hit.
float window=abs(zr-zlast)+0.01*zr+0.02;
float hit=step(0.02+0.004*zr,behind)*step(behind,window)*(1.0-found);
before=mix(before,last,hit);
at=mix(at,u,hit);
found=max(found,hit);
last=u;
}
// Close in on the crossing between the last step in front and the first behind.
for(int i=0;i<5;i++){
float mid=(before+at)*0.5;
vec2 uv=mix(s0.xy,s1.xy,mid);
float zr=1.0/mix(iz0,iz1,mid);
float isBehind=step(0.0,zr-zhudaSsrDepth(clamp(uv,vec2(0.0),vec2(1.0))));
at=mix(at,mid,isBehind);
before=mix(mid,before,isBehind);
}
vec2 where=clamp(mix(s0.xy,s1.xy,at),vec2(0.0),vec2(1.0));
vec4 reflected=texture2D(u_MainTex,where);
#ifdef Gamma_u_MainTex
reflected=gammaToLinear(reflected);
#endif
float facing=1.0-max(dot(-view,n),0.0);
float fresnel=u_ZhudaSsrShape.y+(1.0-u_ZhudaSsrShape.y)*pow(facing,5.0);
// Fade toward the borders of the picture, with distance, and leave the sky alone.
vec2 border=smoothstep(vec2(0.0),vec2(0.1),where)*smoothstep(vec2(0.0),vec2(0.1),1.0-where);
float fade=found*border.x*border.y*(1.0-at)*step(depth,u_ZhudaSsrEye.w);
// The reflection alone, at half size: a blur across neighbours joins the
// pixels whose rays found a small bright thing with those whose rays missed it.
gl_FragColor=vec4(reflected.rgb*(fresnel*fade*u_ZhudaSsrShape.x),fade);
}`;

// Seven taps along u_ZhudaSsrBlur.xy (one texel of the half-size picture), weighted
// down across a step in depth so that a reflection does not spread onto the sky
// or onto a thing in front.
const BLUR_FRAGMENT = `#define SHADER_NAME ZhudaScreenReflectionsBlurFS
#include "Camera.glsl";
varying vec2 v_Texcoord0;
float zhudaSsrBlurDepth(vec2 at){return 1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,at).x+u_ZBufferParams.w);}
void main(){
vec2 uv=v_Texcoord0;
float centre=zhudaSsrBlurDepth(uv);
vec4 sum=vec4(0.0);
float weights=0.0;
for(int i=-3;i<=3;i++){
vec2 at=uv+u_ZhudaSsrBlur.xy*float(i);
float d=zhudaSsrBlurDepth(at);
float gauss=exp(-float(i*i)/8.0);
float near=clamp(1.0-abs(d-centre)/(0.02*centre+0.05),0.0,1.0);
float w=gauss*near;
sum+=texture2D(u_MainTex,at)*w;
weights+=w;
}
gl_FragColor=sum/max(weights,0.0001);
}`;

const COMPOSITE_FRAGMENT = `#define SHADER_NAME ZhudaScreenReflectionsCompositeFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
gl_FragColor=vec4(source.rgb+texture2D(u_ZhudaSsrReflection,v_Texcoord0).rgb,source.a);
}`;

const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const add = (name: string, fragment: string, uniforms: Record<string, unknown>) => {
    const shader = l.Shader3D.add(name);
    shader.shaderType = l.ShaderFeatureType.PostProcess;
    const sub = new l.SubShader(
      { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
      { u_MainTex: l.ShaderDataType.Texture2D, ...uniforms },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(VERTEX, fragment);
    pass.statefirst = true;
    pass.renderState.cull = l.RenderState.CULL_NONE;
  };
  add('ZhudaScreenReflections', FRAGMENT, {
    u_ZhudaSsrEye: l.ShaderDataType.Vector4,
    u_ZhudaSsrForward: l.ShaderDataType.Vector4,
    u_ZhudaSsrRight: l.ShaderDataType.Vector4,
    u_ZhudaSsrUp: l.ShaderDataType.Vector4,
    u_ZhudaSsrShape: l.ShaderDataType.Vector4,
  });
  add('ZhudaScreenReflectionsBlur', BLUR_FRAGMENT, { u_ZhudaSsrBlur: l.ShaderDataType.Vector4 });
  add('ZhudaScreenReflectionsComposite', COMPOSITE_FRAGMENT, {
    u_ZhudaSsrReflection: l.ShaderDataType.Texture2D,
  });
  registered.add(l.Shader3D);
}

/**
 * The effect in the HDR chain: the rays are followed at half size, the result
 * is blurred across and down (taking depth into account) and added to the
 * scene. Written like LayaAir's own ambient occlusion: pooled targets,
 * released after the frame.
 */
function createReflectionsEffect(
  l: any,
  parts: { trace: any; across: any; down: any; composite: any },
): any {
  const Base = l.PostProcessEffect as new () => any;
  const reflection = l.Shader3D.propertyNameToID('u_ZhudaSsrReflection');
  return new (class extends Base {
    getCameraDepthTextureModeFlag() {
      return l.DepthTextureMode.Depth;
    }
    render(context: any) {
      const command = context.command,
        source = context.indirectTarget;
      const width = Math.max(1, source.width >> 1),
        height = Math.max(1, source.height >> 1);
      const pooled = () =>
        l.RenderTexture.createFromPool(
          width,
          height,
          l.RenderTargetFormat.R16G16B16A16,
          l.RenderTargetFormat.None,
          false,
          1,
        );
      const traced = pooled(),
        blurred = pooled();
      // One texel of the half-size picture along each axis.
      parts.across.setVector4('u_ZhudaSsrBlur', new l.Vector4(1 / width, 0, 0, 0));
      parts.down.setVector4('u_ZhudaSsrBlur', new l.Vector4(0, 1 / height, 0, 0));
      command.blitScreenTriangle(
        source,
        traced,
        null,
        parts.trace.shader,
        parts.trace.shaderData,
        0,
      );
      command.blitScreenTriangle(
        traced,
        blurred,
        null,
        parts.across.shader,
        parts.across.shaderData,
        0,
      );
      command.blitScreenTriangle(
        blurred,
        traced,
        null,
        parts.down.shader,
        parts.down.shaderData,
        0,
      );
      command.setShaderDataTexture(parts.composite.shaderData, reflection, traced);
      command.blitScreenTriangle(
        source,
        context.destination,
        null,
        parts.composite.shader,
        parts.composite.shaderData,
        0,
      );
      context.deferredReleaseTextures.push(traced, blurred);
    }
  })();
}

/** Sky and anything farther than this from the eye, in metres, reflects nothing. */
const FAR = 5000;

export class ZhudaScreenReflections {
  /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, before fog. */
  readonly effect: any;
  /** The material of the pass that follows the rays (its uniforms are the effect's settings). */
  private readonly material: any;
  private readonly passes: any[];
  private options: Required<ZhudaScreenReflectionsOptions>;
  private phase = 0;
  private disposed = false;

  constructor(options: ZhudaScreenReflectionsOptions = {}) {
    const issues = validateZhudaScreenReflections(options);
    if (issues.length) throw Error('Invalid screen reflections: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect || !l.RenderTexture?.createFromPool)
      throw Error('Screen reflections need the Laya post-process module');
    this.options = resolveZhudaScreenReflections(options);
    register(l);
    const material = (name: string) => {
      const value = new l.Material();
      value.setShaderName(name);
      return value;
    };
    const parts = {
      trace: material('ZhudaScreenReflections'),
      across: material('ZhudaScreenReflectionsBlur'),
      down: material('ZhudaScreenReflectionsBlur'),
      composite: material('ZhudaScreenReflectionsComposite'),
    };
    this.material = parts.trace;
    this.passes = Object.values(parts);
    // Every declared uniform is written before the first draw.
    parts.across.setVector4('u_ZhudaSsrBlur', new l.Vector4(0, 0, 0, 0));
    parts.down.setVector4('u_ZhudaSsrBlur', new l.Vector4(0, 0, 0, 0));
    this.effect = createReflectionsEffect(l, parts);
    // Every declared uniform is written before the first draw.
    this.update([0, 0, 0], [0, 0, -1], 40, 16 / 9);
  }

  /** Changes the values in place. */
  setReflections(options: ZhudaScreenReflectionsOptions): void {
    if (this.disposed) throw Error('Disposed screen reflections');
    const issues = validateZhudaScreenReflections(options);
    if (issues.length) throw Error('Invalid screen reflections: ' + issues.join('; '));
    this.options = resolveZhudaScreenReflections(options);
    this.shape();
  }

  private shape(): void {
    const l = (globalThis as any).Laya,
      o = this.options;
    this.material.setVector4(
      'u_ZhudaSsrShape',
      // strength, reflection seen head-on, reach, steps
      new l.Vector4(o.strength, 0.02 + 0.25 * o.wetness, o.distance, o.steps),
    );
  }

  /**
   * Shifts the noise of the ray steps for the frame at `seconds`. A capture
   * calls it for every sample (their times differ by the shutter), so a still
   * averages the noise away; the same time always gives the same pattern. A
   * game leaves it alone. Takes effect with the next `update`.
   */
  setPhase(seconds: number): void {
    if (this.disposed) throw Error('Disposed screen reflections');
    if (!Number.isFinite(seconds)) throw Error('Invalid screen reflections phase');
    const turned = seconds * 12345.678;
    this.phase = turned - Math.floor(turned);
  }

  /** Call after the camera has moved or its field of view has changed. */
  update(
    eye: readonly number[],
    target: readonly number[],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed screen reflections');
    const l = (globalThis as any).Laya;
    const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const length = Math.hypot(f[0], f[1], f[2]);
    if (!(length > 1e-9) || ![...eye, fieldOfViewDeg, aspect].every(Number.isFinite))
      throw Error('Invalid screen reflections camera');
    const forward = f.map((n) => n / length);
    const world = Math.hypot(forward[0], forward[2]) < 1e-6 ? [0, 0, 1] : [0, 1, 0];
    let right = [
      forward[1] * world[2] - forward[2] * world[1],
      forward[2] * world[0] - forward[0] * world[2],
      forward[0] * world[1] - forward[1] * world[0],
    ];
    const rl = Math.hypot(right[0], right[1], right[2]);
    right = right.map((n) => n / rl);
    const up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];
    const tan = Math.tan((fieldOfViewDeg * Math.PI) / 360);
    const m = this.material;
    m.setVector4('u_ZhudaSsrEye', new l.Vector4(eye[0], eye[1], eye[2], FAR));
    m.setVector4(
      'u_ZhudaSsrForward',
      new l.Vector4(forward[0], forward[1], forward[2], this.phase),
    );
    m.setVector4(
      'u_ZhudaSsrRight',
      new l.Vector4(right[0] * tan * aspect, right[1] * tan * aspect, right[2] * tan * aspect, 0),
    );
    m.setVector4('u_ZhudaSsrUp', new l.Vector4(up[0] * tan, up[1] * tan, up[2] * tan, 0));
    this.shape();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const pass of this.passes) pass.destroy();
  }
}
