/**
 * Reflections of what is on screen, on every surface: wet walls, props, and
 * ground beyond a planar reflector. A post-process effect in linear HDR, after
 * ambient occlusion and before fog.
 *
 * A forward renderer has no roughness or normal buffer, so the whole view
 * reflects alike and by Fresnel: strongly at grazing angles, faintly head-on.
 * That is the look of rain and of polished places; it is not a substitute for
 * materials that differ. What is off screen, hidden behind something or behind
 * the camera is not reflected. With `sky`, a ray that finds nothing and points
 * upward shows the sky's colour instead: wet ground under an open sky is as
 * bright as the sky it mirrors. Nothing tells such a ray that a roof or a wall
 * off screen is in its way: keep `sky` at 0 indoors and under cover.
 *
 * With `surfaces`, the view no longer reflects alike. LayaAir draws the
 * opaque things' world normal and roughness into pictures of their own
 * (`SurfaceBuffer.ts`), and where a material wrote them the ray leaves the
 * surface by its own normal (a normal map bends reflections), a rough
 * surface reflects little, and a metal reflects strongly head-on. Wetness
 * then polishes: at 1 every surface is as smooth as water on it. A pixel
 * whose material wrote nothing is treated as before.
 */

import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
import { zhudaSurfaceBufferSupported } from './SurfaceBuffer.ts';

export interface ZhudaScreenReflectionsOptions {
  /** Brightness of the reflections, 0..4 (default 1). */
  strength?: number;
  /** How wet the surfaces are, 0..1: how much shows when seen head-on (default 0.5). */
  wetness?: number;
  /** Metres a reflected ray is followed, 1..200 (default 30). */
  distance?: number;
  /** Steps along the ray, 8..64 (default 32). Fewer are cheaper and coarser. */
  steps?: number;
  /**
   * How much of the sky shows where a reflected ray finds nothing and points
   * upward, 0..1 (default 0: such a ray reflects nothing).
   */
  sky?: number;
  /** The sky's colour for that, as light: scene-linear RGB (default black). */
  skyColor?: readonly number[];
  /**
   * Read each surface's own normal and roughness from LayaAir's surface
   * pictures (default false). One more picture of the scene's opaque things
   * for each of the two, drawn in the same pass.
   */
  surfaces?: boolean;
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
    ['sky', 0, 1],
  ];
  for (const [key, min, max] of ranges)
    if (o[key] !== undefined && !inRange(o[key], min, max))
      issues.push(`${key}: use ${min}..${max}`);
  if (
    o.steps !== undefined &&
    !(Number.isInteger(o.steps) && inRange(o.steps, 8, ZHUDA_SCREEN_REFLECTION_MAX_STEPS))
  )
    issues.push(`steps: use a whole number 8..${ZHUDA_SCREEN_REFLECTION_MAX_STEPS}`);
  const colour: unknown = o.skyColor;
  if (
    colour !== undefined &&
    !(Array.isArray(colour) && colour.length === 3 && colour.every((v) => inRange(v, 0, 1024)))
  )
    issues.push('skyColor: use [r, g, b] of 0 or more');
  if (o.surfaces !== undefined && typeof o.surfaces !== 'boolean')
    issues.push('surfaces: use true or false');
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
    sky: options.sky ?? 0,
    skyColor: options.skyColor ? [...options.skyColor] : [0, 0, 0],
    surfaces: options.surfaces ?? false,
  };
}

const VERTEX =
  '#define SHADER_NAME ZhudaScreenReflectionsVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';

// Every texture is sampled in every step: no branch depends on what was read
// (WGSL allows sampling in uniform control flow only).
// Two shaders from one text: LayaAir decides `#ifdef` itself, from its own
// defines, before the compiler sees a `#define` in the source.
const FRAGMENT = (surfaces: boolean) => `#define SHADER_NAME ZhudaScreenReflectionsFS
#include "Color.glsl";
// The depth picture is read at high precision: a phone reads textures at low precision unless told.
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
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
// This picture has half the pixels of the depth picture each way, so the
// centre of one of its pixels falls on the corner of four depth pixels, and
// which of them a read returns is up to the GPU (Apple's and Intel's differ).
// One a quarter of this pixel back is the centre of a depth pixel: read there,
// so the ray starts on the surface and the normal is the surface's.
vec2 texel=1.0/max(u_Viewport.zw,vec2(1.0));
vec2 centre=uv-0.25*texel;
float depth=zhudaSsrDepth(centre);
vec3 p=zhudaSsrRay(centre)*depth;
vec3 view=normalize(p);
// The surface normal from the neighbours' depths. Of each pair of neighbours
// the nearer one: it lies on this surface where the other is across an outline.
vec3 px=zhudaSsrPoint(centre+vec2(texel.x,0.0))-p;
vec3 nx=p-zhudaSsrPoint(centre-vec2(texel.x,0.0));
vec3 py=zhudaSsrPoint(centre+vec2(0.0,texel.y))-p;
vec3 ny=p-zhudaSsrPoint(centre-vec2(0.0,texel.y));
vec3 dx=dot(px,px)<dot(nx,nx)?px:nx;
vec3 dy=dot(py,py)<dot(ny,ny)?py:ny;
vec3 n=normalize(cross(dx,dy));
n=dot(n,view)>0.0?-n:n;
// What the surface is, where its material said: its own normal (a normal map
// bends the reflection) and how rough and how metallic it is.
float gloss=1.0;
float metal=0.0;
${
  surfaces
    ? `vec4 gNormal=texture2D(u_ZhudaSsrNormal,uv);
vec4 gSurface=texture2D(u_ZhudaSsrSurface,uv);
float known=step(0.5,gNormal.a)*step(0.5,gSurface.a);
vec3 own=gNormal.rgb*2.0-1.0;
n=normalize(mix(n,own,known*step(0.25,dot(own,own))));
// Water on a surface polishes it: at full wetness everything is smooth.
float wet=clamp((u_ZhudaSsrShape.y-0.02)/0.25,0.0,1.0);
float rough=gSurface.g*(1.0-wet);
gloss=mix(1.0,(1.0-rough)*(1.0-rough),known);
metal=gSurface.r*known;`
    : ''
}
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
// Head-on a metal reflects nearly all, whatever the weather.
float base=max(u_ZhudaSsrShape.y,metal);
float fresnel=(base+(1.0-base)*pow(facing,5.0))*gloss;
// Fade toward the borders of the picture, with distance, and leave the sky alone.
vec2 border=smoothstep(vec2(0.0),vec2(0.1),where)*smoothstep(vec2(0.0),vec2(0.1),1.0-where);
float fade=found*border.x*border.y*(1.0-at)*step(depth,u_ZhudaSsrEye.w);
// The reflection alone, at half size: a blur across neighbours joins the
// pixels whose rays found a small bright thing with those whose rays missed it.
// Where the ray found nothing and points upward: the sky, not at all at the
// horizon and fully from a little above it.
float open=(1.0-found)*smoothstep(0.0,0.15,r.y)*step(depth,u_ZhudaSsrEye.w)*u_ZhudaSsrSky.w;
gl_FragColor=vec4((reflected.rgb*fade+u_ZhudaSsrSky.rgb*open)*(fresnel*u_ZhudaSsrShape.x),max(fade,open));
}`;

// Seven taps along u_ZhudaSsrBlur.xy (one texel of the half-size picture), weighted
// down across a step in depth so that a reflection does not spread onto the sky
// or onto a thing in front.
const BLUR_FRAGMENT = `#define SHADER_NAME ZhudaScreenReflectionsBlurFS
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
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
  const trace = {
    u_ZhudaSsrEye: l.ShaderDataType.Vector4,
    u_ZhudaSsrForward: l.ShaderDataType.Vector4,
    u_ZhudaSsrRight: l.ShaderDataType.Vector4,
    u_ZhudaSsrUp: l.ShaderDataType.Vector4,
    u_ZhudaSsrShape: l.ShaderDataType.Vector4,
    u_ZhudaSsrSky: l.ShaderDataType.Vector4,
  };
  add('ZhudaScreenReflections', FRAGMENT(false), trace);
  // A shader of its own: one that names the two pictures has to be given them.
  add('ZhudaScreenReflectionsSurfaces', FRAGMENT(true), {
    ...trace,
    u_ZhudaSsrNormal: l.ShaderDataType.Texture2D,
    u_ZhudaSsrSurface: l.ShaderDataType.Texture2D,
  });
  add('ZhudaScreenReflectionsBlur', BLUR_FRAGMENT, { u_ZhudaSsrBlur: l.ShaderDataType.Vector4 });
  add('ZhudaScreenReflectionsComposite', COMPOSITE_FRAGMENT, {
    u_ZhudaSsrReflection: l.ShaderDataType.Texture2D,
  });
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

/**
 * The effect in the HDR chain: the rays are followed at half size, the result
 * is blurred across and down (taking depth into account) and added to the
 * scene. Written like LayaAir's own ambient occlusion: pooled targets,
 * released after the frame.
 */
function createReflectionsEffect(
  l: any,
  parts: {
    trace: any;
    across: any;
    down: any;
    composite: any;
    surfaces: boolean;
    unknown: any;
  },
): any {
  const Base = l.PostProcessEffect as new () => any;
  const reflection = l.Shader3D.propertyNameToID('u_ZhudaSsrReflection');
  const normal = l.Shader3D.propertyNameToID('u_ZhudaSsrNormal'),
    surface = l.Shader3D.propertyNameToID('u_ZhudaSsrSurface');
  return new (class extends Base {
    getCameraDepthTextureModeFlag() {
      return l.DepthTextureMode.Depth;
    }
    /** LayaAir gives the camera the two pictures while this effect is on it. */
    getCameraOpaqueMRTRequirements() {
      return parts.surfaces ? [l.GBuffer.Normal, l.GBuffer.Surface] : null;
    }
    render(context: any) {
      const command = context.command,
        source = context.indirectTarget;
      if (parts.surfaces) {
        // Borrowed from the camera for this frame; another frame may have others.
        const camera = context.camera;
        const pictures = [
          camera?.getOpaqueAuxiliaryTexture?.(l.GBuffer.Normal.name),
          camera?.getOpaqueAuxiliaryTexture?.(l.GBuffer.Surface.name),
        ];
        // A camera that could not be given them: a picture with no alpha says
        // "unknown" for every pixel.
        command.setShaderDataTexture(parts.trace.shaderData, normal, pictures[0] ?? parts.unknown);
        command.setShaderDataTexture(parts.trace.shaderData, surface, pictures[1] ?? parts.unknown);
      }
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
  private material: any;
  private readonly parts: {
    trace: any;
    across: any;
    down: any;
    composite: any;
    surfaces: boolean;
    /** One pixel with no alpha: what the surface pictures say where nothing wrote. */
    unknown: any;
  };
  /** What `update` was last given, to give a new trace material its values. */
  private view: [readonly number[], readonly number[], number, number] = [
    [0, 0, 0],
    [0, 0, -1],
    40,
    16 / 9,
  ];
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
    if (this.options.surfaces && !zhudaSurfaceBufferSupported(l))
      throw Error('Invalid screen reflections: surfaces needs LayaAir 3.4.2 surface pictures');
    register(l);
    const parts = (this.parts = {
      // Made when the surface pictures are first asked for; without them nothing is.
      unknown: null,
      trace: null,
      across: this.pass('ZhudaScreenReflectionsBlur'),
      down: this.pass('ZhudaScreenReflectionsBlur'),
      composite: this.pass('ZhudaScreenReflectionsComposite'),
      surfaces: this.options.surfaces,
    });
    parts.trace = this.traceMaterial(this.options.surfaces);
    this.material = parts.trace;
    // Every declared uniform is written before the first draw.
    parts.across.setVector4('u_ZhudaSsrBlur', new l.Vector4(0, 0, 0, 0));
    parts.down.setVector4('u_ZhudaSsrBlur', new l.Vector4(0, 0, 0, 0));
    this.effect = createReflectionsEffect(l, parts);
    // Every declared uniform is written before the first draw.
    this.update(...this.view);
  }

  private pass(name: string): any {
    const value = new (globalThis as any).Laya.Material();
    value.setShaderName(name);
    return value;
  }
  /** The pass that follows the rays: another shader when it reads the surface pictures. */
  private traceMaterial(surfaces: boolean): any {
    const made = this.pass(surfaces ? 'ZhudaScreenReflectionsSurfaces' : 'ZhudaScreenReflections');
    if (surfaces) {
      const l = (globalThis as any).Laya;
      if (!this.parts.unknown) {
        // One pixel without alpha: "nothing is known of this surface".
        const unknown = new l.Texture2D(1, 1, l.TextureFormat.R8G8B8A8, false, false, false);
        unknown.setPixelsData(new Uint8Array([128, 128, 255, 0]), false, false);
        unknown.lock = true;
        this.parts.unknown = unknown;
      }
      // Given every frame from the camera; something valid until the first.
      made.setTexture('u_ZhudaSsrNormal', this.parts.unknown);
      made.setTexture('u_ZhudaSsrSurface', this.parts.unknown);
    }
    return made;
  }

  /** Changes the values in place. */
  setReflections(options: ZhudaScreenReflectionsOptions): void {
    if (this.disposed) throw Error('Disposed screen reflections');
    const issues = validateZhudaScreenReflections(options);
    if (issues.length) throw Error('Invalid screen reflections: ' + issues.join('; '));
    const next = resolveZhudaScreenReflections(options);
    if (next.surfaces && !zhudaSurfaceBufferSupported((globalThis as any).Laya))
      throw Error('Invalid screen reflections: surfaces needs LayaAir 3.4.2 surface pictures');
    const changed = next.surfaces !== this.options.surfaces;
    this.options = next;
    if (changed) {
      // The other shader: a new material for the pass, with the same view.
      const old = this.parts.trace;
      this.material = this.parts.trace = this.traceMaterial(next.surfaces);
      this.parts.surfaces = next.surfaces;
      old.destroy();
      this.update(...this.view);
    } else this.shape();
  }

  private shape(): void {
    const l = (globalThis as any).Laya,
      o = this.options;
    this.material.setVector4(
      'u_ZhudaSsrShape',
      // strength, reflection seen head-on, reach, steps
      new l.Vector4(o.strength, 0.02 + 0.25 * o.wetness, o.distance, o.steps),
    );
    this.material.setVector4(
      'u_ZhudaSsrSky',
      new l.Vector4(o.skyColor[0], o.skyColor[1], o.skyColor[2], o.sky),
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
    this.view = [[...eye], [...target], fieldOfViewDeg, aspect];
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
    const { trace, across, down, composite, unknown } = this.parts;
    for (const pass of [trace, across, down, composite]) pass.destroy();
    if (unknown) {
      unknown.lock = false;
      unknown.destroy();
    }
  }
}
