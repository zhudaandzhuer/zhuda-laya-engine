/**
 * Three effects of a camera that a game needs while it runs, as post-process
 * effects for `ZhudaFilmicPipeline` (`sceneEffects`, after reflections and
 * fog, before bloom and the grade):
 *
 * - `ZhudaAutoExposure`: the frame's brightness, read on the GPU and followed
 *   over time, steers how bright the picture is drawn: eyes that get used to
 *   a dark alley and to a noon square.
 * - `ZhudaDepthOfField`: what is nearer or farther than the focus distance is
 *   blurred by as much as a lens of that focal length and aperture would.
 * - `ZhudaMotionBlur`: what the camera's own movement smears during the time
 *   the shutter is open. Things that move by themselves are not blurred.
 *
 * A film still or video gets depth of field and motion blur by drawing many
 * samples (`ZhudaFilmRenderer`), which is exact; these are the one-frame
 * approximations for a picture that is drawn once.
 */

const VERTEX =
  '#define SHADER_NAME ZhudaCameraEffectVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';

const LUMA = 'vec3(0.2126,0.7152,0.0722)';

// The frame's brightness as one number: the geometric mean of 144 places
// spread over it (the mean of the logarithms, so that a lamp in view does not
// outweigh the rest), the middle of the frame counted twice.
const METER_FRAGMENT = `#define SHADER_NAME ZhudaExposureMeterFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
void main(){
float sum=0.0;
float weight=0.0;
for(int j=0;j<12;j++){
for(int i=0;i<12;i++){
vec2 at=(vec2(float(i),float(j))+0.5)/12.0;
vec4 c=texture2D(u_MainTex,at);
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
float w=1.0+step(abs(at.x-0.5),0.25)*step(abs(at.y-0.5),0.25);
sum+=w*log(max(dot(c.rgb,${LUMA}),0.0001));
weight+=w;
}
}
gl_FragColor=vec4(vec3(exp(sum/weight)),1.0);
}`;

// What the eye is used to moves toward what the meter reads. x of the
// settings is how far it moves this frame (1: at once).
const ADAPT_FRAGMENT = `#define SHADER_NAME ZhudaExposureAdaptFS
varying vec2 v_Texcoord0;
void main(){
float now=texture2D(u_MainTex,vec2(0.5)).r;
float before=texture2D(u_ZhudaExposureBefore,vec2(0.5)).r;
float rate=before>0.0?u_ZhudaExposureRate.x:1.0;
gl_FragColor=vec4(vec3(before+(now-before)*rate),1.0);
}`;

// The picture times key / brightness, kept between the two limits.
const APPLY_FRAGMENT = `#define SHADER_NAME ZhudaExposureApplyFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
float used=max(texture2D(u_ZhudaExposureUsed,vec2(0.5)).r,0.0001);
float gain=clamp(u_ZhudaExposureShape.x/used,u_ZhudaExposureShape.y,u_ZhudaExposureShape.z);
gl_FragColor=vec4(source.rgb*mix(1.0,gain,u_ZhudaExposureShape.w),source.a);
}`;

// The radius of the blur disc of a thin lens, as a share of the frame's
// height: lens.x is the focus distance in metres, lens.y the disc's radius at
// infinity, lens.z the largest radius drawn. Negative in front of the focus.
const DOF_COC = `float zhudaDofDepth(vec2 at){return 1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,at).x+u_ZBufferParams.w);}
float zhudaDofCoc(float depth){return clamp(u_ZhudaDofLens.y*(depth-u_ZhudaDofLens.x)/max(depth,0.0001),-u_ZhudaDofLens.z,u_ZhudaDofLens.z);}`;

// Half size: the picture with its disc radius in alpha.
const DOF_PREPARE_FRAGMENT = `#define SHADER_NAME ZhudaDofPrepareFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
${DOF_COC}
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
gl_FragColor=vec4(source.rgb,zhudaDofCoc(zhudaDofDepth(v_Texcoord0)));
}`;

// Twenty-four places on a disc of the largest radius. A place counts when its
// own disc reaches this pixel, or this pixel's disc reaches it and it lies
// behind: sharp things in front keep their edge against a blurred background.
const DOF_GATHER_FRAGMENT = `#define SHADER_NAME ZhudaDofGatherFS
varying vec2 v_Texcoord0;
void main(){
vec4 centre=texture2D(u_MainTex,v_Texcoord0);
float mine=abs(centre.a);
vec3 sum=centre.rgb;
float weight=1.0;
float aspect=u_ZhudaDofLens.w;
for(int i=0;i<24;i++){
float n=float(i)+0.5;
float r=sqrt(n/24.0);
float a=n*2.39996323;
vec2 offset=vec2(cos(a),sin(a))*r*u_ZhudaDofLens.z;
vec4 tap=texture2D(u_MainTex,v_Texcoord0+vec2(offset.x/aspect,offset.y));
float reach=r*u_ZhudaDofLens.z;
float theirs=abs(tap.a);
float w=step(reach,theirs)+step(reach,mine)*step(centre.a,tap.a+0.0005)*(1.0-step(reach,theirs));
sum+=tap.rgb*w;
weight+=w;
}
gl_FragColor=vec4(sum/weight,centre.a);
}`;

// Full size: the sharp picture where the disc is under a pixel, the blurred
// one where it is two pixels or more.
const DOF_COMPOSE_FRAGMENT = `#define SHADER_NAME ZhudaDofComposeFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
${DOF_COC}
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
vec4 soft=texture2D(u_ZhudaDofBlurred,v_Texcoord0);
float radius=max(abs(zhudaDofCoc(zhudaDofDepth(v_Texcoord0))),abs(soft.a));
gl_FragColor=vec4(mix(source.rgb,soft.rgb,smoothstep(u_ZhudaDofPixel.x,u_ZhudaDofPixel.x*3.0,radius)),source.a);
}`;

// Where each pixel's surface was on screen a frame ago, from its depth and
// the two cameras; the picture is averaged along the way between.
const MOTION_FRAGMENT = `#define SHADER_NAME ZhudaMotionBlurFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
void main(){
vec2 uv=v_Texcoord0;
float depth=1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,uv).x+u_ZBufferParams.w);
vec2 ndc=uv*2.0-1.0;
vec3 world=u_ZhudaMotionEye.xyz+(u_ZhudaMotionForward.xyz+ndc.x*u_ZhudaMotionRight.xyz+ndc.y*u_ZhudaMotionUp.xyz)*min(depth,u_ZhudaMotionEye.w);
vec3 d=world-u_ZhudaMotionEyeBefore.xyz;
float along=dot(d,u_ZhudaMotionForwardBefore.xyz);
vec2 before=along>0.0001?vec2(dot(d,u_ZhudaMotionRightBefore.xyz),dot(d,u_ZhudaMotionUpBefore.xyz))/along*0.5+0.5:uv;
vec2 smear=(uv-before)*u_ZhudaMotionShape.x;
float length2=dot(smear,smear);
float limit=u_ZhudaMotionShape.y;
if(length2>limit*limit){smear*=limit/sqrt(length2);}
vec3 sum=vec3(0.0);
for(int i=0;i<12;i++){
vec4 c=texture2D(u_MainTex,uv-smear*((float(i)+0.5)/12.0-0.5));
#ifdef Gamma_u_MainTex
c=gammaToLinear(c);
#endif
sum+=c.rgb;
}
vec4 source=texture2D(u_MainTex,uv);
gl_FragColor=vec4(sum/12.0,source.a);
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
  const v4 = l.ShaderDataType.Vector4,
    tex = l.ShaderDataType.Texture2D;
  add('ZhudaExposureMeter', METER_FRAGMENT, {});
  add('ZhudaExposureAdapt', ADAPT_FRAGMENT, {
    u_ZhudaExposureBefore: tex,
    u_ZhudaExposureRate: v4,
  });
  add('ZhudaExposureApply', APPLY_FRAGMENT, { u_ZhudaExposureUsed: tex, u_ZhudaExposureShape: v4 });
  add('ZhudaDofPrepare', DOF_PREPARE_FRAGMENT, { u_ZhudaDofLens: v4 });
  add('ZhudaDofGather', DOF_GATHER_FRAGMENT, { u_ZhudaDofLens: v4 });
  add('ZhudaDofCompose', DOF_COMPOSE_FRAGMENT, {
    u_ZhudaDofLens: v4,
    u_ZhudaDofBlurred: tex,
    u_ZhudaDofPixel: v4,
  });
  add('ZhudaMotionBlur', MOTION_FRAGMENT, {
    u_ZhudaMotionEye: v4,
    u_ZhudaMotionForward: v4,
    u_ZhudaMotionRight: v4,
    u_ZhudaMotionUp: v4,
    u_ZhudaMotionEyeBefore: v4,
    u_ZhudaMotionForwardBefore: v4,
    u_ZhudaMotionRightBefore: v4,
    u_ZhudaMotionUpBefore: v4,
    u_ZhudaMotionShape: v4,
  });
  registered.add(l.Shader3D);
}

function requireRuntime(what: string) {
  const l = (globalThis as any).Laya;
  if (!l?.PostProcessEffect || !l.RenderTexture?.createFromPool || !l.Material)
    throw Error(`${what} needs the Laya post-process module`);
  if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable.RenderTextureFormat_R16G16B16A16))
    throw Error(`${what} requires RenderTextureFormat_R16G16B16A16`);
  register(l);
  return l;
}
function materialOf(l: any, name: string) {
  const material = new l.Material();
  material.setShaderName(name);
  return material;
}
const numberIn = (
  issues: string[],
  options: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) => {
  const value = options[key];
  if (value !== undefined && !(typeof value === 'number' && value >= min && value <= max))
    issues.push(`${key}: use ${min}..${max}`);
};
const unknownKeys = (issues: string[], options: object, known: readonly string[]) => {
  for (const key of Object.keys(options))
    if (!known.includes(key)) issues.push(`${key}: unknown option (${known.join(', ')})`);
};

export interface ZhudaAutoExposureOptions {
  /**
   * The brightness the picture is brought to, as the scene value of a middle
   * grey before the grade, 0.01..4 (default 0.18).
   */
  key?: number;
  /** The least the picture is multiplied by, 0.01..64 (default 0.25): how far a bright scene is dimmed. */
  min?: number;
  /** The most it is multiplied by, 0.01..64 (default 4): how far a dark scene is lifted. */
  max?: number;
  /**
   * How fast the eye gets used to a new brightness, per second, 0..60
   * (default 1.5); 0 follows the frame at once (a still).
   */
  speed?: number;
  /** How much of the correction is applied, 0..1 (default 1). */
  strength?: number;
}

const EXPOSURE_KEYS = ['key', 'min', 'max', 'speed', 'strength'] as const;

export function validateZhudaAutoExposure(options: ZhudaAutoExposureOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  unknownKeys(issues, o, EXPOSURE_KEYS);
  numberIn(issues, o, 'key', 0.01, 4);
  numberIn(issues, o, 'min', 0.01, 64);
  numberIn(issues, o, 'max', 0.01, 64);
  numberIn(issues, o, 'speed', 0, 60);
  numberIn(issues, o, 'strength', 0, 1);
  if (typeof o.min === 'number' && typeof o.max === 'number' && !issues.length && o.min > o.max)
    issues.push('min: at most max');
  return issues;
}

export function resolveZhudaAutoExposure(
  options: ZhudaAutoExposureOptions = {},
): Required<ZhudaAutoExposureOptions> {
  const min = options.min ?? Math.min(0.25, options.max ?? 0.25),
    max = options.max ?? Math.max(4, min);
  return {
    key: options.key ?? 0.18,
    min,
    max,
    speed: options.speed ?? 1.5,
    strength: options.strength ?? 1,
  };
}

/** How far the adapted brightness moves toward the metered one in `seconds` at `speed` per second. */
export function zhudaExposureRate(speed: number, seconds: number): number {
  if (!(speed > 0)) return 1;
  return 1 - Math.exp(-speed * Math.max(seconds, 0));
}

export class ZhudaAutoExposure {
  /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, last. */
  readonly effect: any;
  private options: Required<ZhudaAutoExposureOptions>;
  private readonly meter: any;
  private readonly adapt: any;
  private readonly apply: any;
  /** Two pictures of one texel: what the eye was used to, and is used to now. */
  private readonly used: any[];
  private current = 0;
  private seconds = 1 / 60;
  private disposed = false;

  constructor(options: ZhudaAutoExposureOptions = {}) {
    const issues = validateZhudaAutoExposure(options);
    if (issues.length) throw Error('Invalid auto exposure: ' + issues.join('; '));
    const l = requireRuntime('Auto exposure');
    this.options = resolveZhudaAutoExposure(options);
    this.meter = materialOf(l, 'ZhudaExposureMeter');
    this.adapt = materialOf(l, 'ZhudaExposureAdapt');
    this.apply = materialOf(l, 'ZhudaExposureApply');
    const one = () => {
      const target = new l.RenderTexture(
        1,
        1,
        l.RenderTargetFormat.R16G16B16A16,
        l.RenderTargetFormat.None,
        false,
        1,
      );
      target.filterMode = l.FilterMode.Point;
      target.wrapModeU = target.wrapModeV = l.WrapMode.Clamp;
      return target;
    };
    this.used = [one(), one()];
    this.write();
    const before = l.Shader3D.propertyNameToID('u_ZhudaExposureBefore'),
      usedId = l.Shader3D.propertyNameToID('u_ZhudaExposureUsed');
    const owner = this;
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      render(context: any) {
        const command = context.command,
          source = context.indirectTarget;
        const now = l.RenderTexture.createFromPool(
          1,
          1,
          l.RenderTargetFormat.R16G16B16A16,
          l.RenderTargetFormat.None,
          false,
          1,
        );
        const from = owner.used[owner.current],
          to = owner.used[1 - owner.current];
        owner.current = 1 - owner.current;
        command.blitScreenTriangle(
          source,
          now,
          null,
          owner.meter.shader,
          owner.meter.shaderData,
          0,
        );
        command.setShaderDataTexture(owner.adapt.shaderData, before, from);
        command.blitScreenTriangle(now, to, null, owner.adapt.shader, owner.adapt.shaderData, 0);
        command.setShaderDataTexture(owner.apply.shaderData, usedId, to);
        command.blitScreenTriangle(
          source,
          context.destination,
          null,
          owner.apply.shader,
          owner.apply.shaderData,
          0,
        );
        context.deferredReleaseTextures.push(now);
      }
    })();
  }

  private write(): void {
    const l = (globalThis as any).Laya,
      o = this.options;
    this.adapt.setVector4(
      'u_ZhudaExposureRate',
      new l.Vector4(zhudaExposureRate(o.speed, this.seconds), 0, 0, 0),
    );
    this.apply.setVector4('u_ZhudaExposureShape', new l.Vector4(o.key, o.min, o.max, o.strength));
  }

  /** Changes the settings in place; the brightness the eye is used to is kept. */
  setExposure(options: ZhudaAutoExposureOptions): void {
    if (this.disposed) throw Error('Disposed auto exposure');
    const next = { ...this.options, ...options };
    const issues = validateZhudaAutoExposure(next);
    if (issues.length) throw Error('Invalid auto exposure: ' + issues.join('; '));
    this.options = resolveZhudaAutoExposure(next);
    this.write();
  }

  /** The time the next frame stands for, in seconds (default 1/60): how far the eye adapts in it. */
  setFrameSeconds(seconds: number): void {
    if (this.disposed) throw Error('Disposed auto exposure');
    if (!(seconds >= 0) || !Number.isFinite(seconds)) throw Error('Invalid frame time');
    this.seconds = seconds;
    this.write();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const target of this.used) target.destroy();
    this.meter.destroy();
    this.adapt.destroy();
    this.apply.destroy();
  }
}

export interface ZhudaDepthOfFieldOptions {
  /** Distance in metres that is sharp, 0.05..100000. */
  focusDistanceM: number;
  /** Aperture as an f-number, 0.5..64 (default 2.8): smaller blurs more. */
  fStop?: number;
  /** Focal length in millimetres, 4..1200 (default 50). */
  focalLengthMm?: number;
  /** Height of the sensor in millimetres, 1..100 (default 24, full frame). */
  sensorHeightMm?: number;
  /** The largest blur radius drawn, as a share of the frame's height, 0.001..0.05 (default 0.02). */
  maxRadius?: number;
}

const DOF_KEYS = [
  'focusDistanceM',
  'fStop',
  'focalLengthMm',
  'sensorHeightMm',
  'maxRadius',
] as const;

export function validateZhudaDepthOfField(options: ZhudaDepthOfFieldOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as unknown as Record<string, unknown>;
  unknownKeys(issues, o, DOF_KEYS);
  if (o.focusDistanceM === undefined) issues.push('focusDistanceM: required, in metres');
  numberIn(issues, o, 'focusDistanceM', 0.05, 100000);
  numberIn(issues, o, 'fStop', 0.5, 64);
  numberIn(issues, o, 'focalLengthMm', 4, 1200);
  numberIn(issues, o, 'sensorHeightMm', 1, 100);
  numberIn(issues, o, 'maxRadius', 0.001, 0.05);
  if (
    !issues.length &&
    (o.focusDistanceM as number) * 1000 <= ((o.focalLengthMm as number | undefined) ?? 50)
  )
    issues.push('focusDistanceM: beyond the focal length');
  return issues;
}

export function resolveZhudaDepthOfField(
  options: ZhudaDepthOfFieldOptions,
): Required<ZhudaDepthOfFieldOptions> {
  return {
    focusDistanceM: options.focusDistanceM,
    fStop: options.fStop ?? 2.8,
    focalLengthMm: options.focalLengthMm ?? 50,
    sensorHeightMm: options.sensorHeightMm ?? 24,
    maxRadius: options.maxRadius ?? 0.02,
  };
}

/**
 * Radius of the blur disc of something infinitely far, as a share of the
 * frame's height: the thin-lens circle of confusion f² / (N (S − f)), halved,
 * over the sensor's height. Something at depth D has this times (D − S) / D.
 */
export function zhudaDofRadiusAtInfinity(options: Required<ZhudaDepthOfFieldOptions>): number {
  const f = options.focalLengthMm / 1000,
    s = options.focusDistanceM;
  return (f * f) / (options.fStop * (s - f)) / 2 / (options.sensorHeightMm / 1000);
}

export class ZhudaDepthOfField {
  /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, after fog. */
  readonly effect: any;
  private options: Required<ZhudaDepthOfFieldOptions>;
  private readonly prepare: any;
  private readonly gather: any;
  private readonly compose: any;
  private aspect = 16 / 9;
  private disposed = false;

  constructor(options: ZhudaDepthOfFieldOptions) {
    const issues = validateZhudaDepthOfField(options);
    if (issues.length) throw Error('Invalid depth of field: ' + issues.join('; '));
    const l = requireRuntime('Depth of field');
    this.options = resolveZhudaDepthOfField(options);
    this.prepare = materialOf(l, 'ZhudaDofPrepare');
    this.gather = materialOf(l, 'ZhudaDofGather');
    this.compose = materialOf(l, 'ZhudaDofCompose');
    this.write();
    const blurred = l.Shader3D.propertyNameToID('u_ZhudaDofBlurred');
    const owner = this;
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      getCameraDepthTextureModeFlag() {
        return l.DepthTextureMode.Depth;
      }
      render(context: any) {
        const command = context.command,
          source = context.indirectTarget;
        const width = Math.max(1, source.width >> 1),
          height = Math.max(1, source.height >> 1);
        if (Math.abs(source.width / source.height - owner.aspect) > 0.001) {
          owner.aspect = source.width / source.height;
          owner.write();
        }
        owner.compose.setVector4('u_ZhudaDofPixel', new l.Vector4(1 / source.height, 0, 0, 0));
        const pooled = () =>
          l.RenderTexture.createFromPool(
            width,
            height,
            l.RenderTargetFormat.R16G16B16A16,
            l.RenderTargetFormat.None,
            false,
            1,
          );
        const half = pooled(),
          soft = pooled();
        command.blitScreenTriangle(
          source,
          half,
          null,
          owner.prepare.shader,
          owner.prepare.shaderData,
          0,
        );
        command.blitScreenTriangle(
          half,
          soft,
          null,
          owner.gather.shader,
          owner.gather.shaderData,
          0,
        );
        command.setShaderDataTexture(owner.compose.shaderData, blurred, soft);
        command.blitScreenTriangle(
          source,
          context.destination,
          null,
          owner.compose.shader,
          owner.compose.shaderData,
          0,
        );
        context.deferredReleaseTextures.push(half, soft);
      }
    })();
  }

  private write(): void {
    const l = (globalThis as any).Laya,
      o = this.options;
    const lens = () =>
      new l.Vector4(o.focusDistanceM, zhudaDofRadiusAtInfinity(o), o.maxRadius, this.aspect);
    for (const material of [this.prepare, this.gather, this.compose])
      material.setVector4('u_ZhudaDofLens', lens());
  }

  /** Changes focus, aperture and the rest in place (pulling focus while the game runs). */
  setLens(options: Partial<ZhudaDepthOfFieldOptions>): void {
    if (this.disposed) throw Error('Disposed depth of field');
    const next = { ...this.options, ...options };
    const issues = validateZhudaDepthOfField(next);
    if (issues.length) throw Error('Invalid depth of field: ' + issues.join('; '));
    this.options = resolveZhudaDepthOfField(next);
    this.write();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.prepare.destroy();
    this.gather.destroy();
    this.compose.destroy();
  }
}

export interface ZhudaMotionBlurOptions {
  /**
   * Share of the time between two frames the shutter is open, 0..1 (default
   * 0.5, a 180-degree shutter).
   */
  shutter?: number;
  /** The longest smear drawn, as a share of the frame, 0.001..0.2 (default 0.04). */
  maxLength?: number;
}

const MOTION_KEYS = ['shutter', 'maxLength'] as const;

export function validateZhudaMotionBlur(options: ZhudaMotionBlurOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  unknownKeys(issues, o, MOTION_KEYS);
  numberIn(issues, o, 'shutter', 0, 1);
  numberIn(issues, o, 'maxLength', 0.001, 0.2);
  return issues;
}

export function resolveZhudaMotionBlur(
  options: ZhudaMotionBlurOptions = {},
): Required<ZhudaMotionBlurOptions> {
  return { shutter: options.shutter ?? 0.5, maxLength: options.maxLength ?? 0.04 };
}

/** Sky and anything farther than this from the eye, in metres, moves as if it were this far. */
const MOTION_FAR = 5000;

/** The camera as the shader takes it: where it is and its three axes, the two across scaled to the frame. */
export function zhudaCameraBasis(
  eye: readonly number[],
  target: readonly number[],
  fieldOfViewDeg: number,
  aspect: number,
): { eye: number[]; forward: number[]; right: number[]; up: number[]; tan: number } {
  const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  const length = Math.hypot(f[0], f[1], f[2]);
  if (!(length > 1e-9) || ![...eye, fieldOfViewDeg, aspect].every(Number.isFinite))
    throw Error('Invalid camera');
  const forward = f.map((n) => n / length);
  const vertical = Math.hypot(forward[0], forward[2]) < 1e-6;
  const world = vertical ? [0, 0, 1] : [0, 1, 0];
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
  return {
    eye: [...eye],
    forward,
    right: right.map((n) => n * tan * aspect),
    up: up.map((n) => n * tan),
    tan,
  };
}

export class ZhudaMotionBlur {
  /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, after depth of field. */
  readonly effect: any;
  private options: Required<ZhudaMotionBlurOptions>;
  private readonly material: any;
  private before: ReturnType<typeof zhudaCameraBasis> | undefined;
  private disposed = false;

  constructor(options: ZhudaMotionBlurOptions = {}) {
    const issues = validateZhudaMotionBlur(options);
    if (issues.length) throw Error('Invalid motion blur: ' + issues.join('; '));
    const l = requireRuntime('Motion blur');
    this.options = resolveZhudaMotionBlur(options);
    const material = (this.material = materialOf(l, 'ZhudaMotionBlur'));
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      getCameraDepthTextureModeFlag() {
        return l.DepthTextureMode.Depth;
      }
      render(context: any) {
        context.command.blitScreenTriangle(
          context.indirectTarget,
          context.destination,
          null,
          material.shader,
          material.shaderData,
          0,
        );
      }
    })();
    this.update([0, 0, 0], [0, 0, -1], 40, 16 / 9);
  }

  /** Changes the shutter and the longest smear in place. */
  setBlur(options: ZhudaMotionBlurOptions): void {
    if (this.disposed) throw Error('Disposed motion blur');
    const next = { ...this.options, ...options };
    const issues = validateZhudaMotionBlur(next);
    if (issues.length) throw Error('Invalid motion blur: ' + issues.join('; '));
    this.options = resolveZhudaMotionBlur(next);
    this.shape();
  }

  private shape(): void {
    const l = (globalThis as any).Laya;
    this.material.setVector4(
      'u_ZhudaMotionShape',
      new l.Vector4(this.options.shutter, this.options.maxLength, 0, 0),
    );
  }

  /**
   * Call once a frame with the camera, before the frame is drawn. The smear
   * runs from where the camera was at the call before to where it is now.
   */
  update(
    eye: readonly number[],
    target: readonly number[],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed motion blur');
    const l = (globalThis as any).Laya;
    const now = zhudaCameraBasis(eye, target, fieldOfViewDeg, aspect);
    const before = this.before ?? now;
    const m = this.material;
    const set = (name: string, v: readonly number[], w = 0) =>
      m.setVector4(name, new l.Vector4(v[0], v[1], v[2], w));
    set('u_ZhudaMotionEye', now.eye, MOTION_FAR);
    set('u_ZhudaMotionForward', now.forward);
    set('u_ZhudaMotionRight', now.right);
    set('u_ZhudaMotionUp', now.up);
    // The camera before, turned round: its axes divided by their own length
    // squared take a point back to that camera's frame.
    const inverse = (v: readonly number[]) => {
      const n = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
      return v.map((x) => x / n);
    };
    set('u_ZhudaMotionEyeBefore', before.eye);
    set('u_ZhudaMotionForwardBefore', before.forward);
    set('u_ZhudaMotionRightBefore', inverse(before.right));
    set('u_ZhudaMotionUpBefore', inverse(before.up));
    this.shape();
    this.before = now;
  }

  /** After a cut or a teleport: the next frame is not smeared from the old place. */
  resetHistory(): void {
    if (this.disposed) throw Error('Disposed motion blur');
    this.before = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.material.destroy();
  }
}
