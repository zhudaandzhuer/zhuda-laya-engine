/**
 * Height fog lit by point lights, as one post-process effect.
 *
 * Fog density falls off exponentially with height. Along each view ray the
 * effect computes, in closed form, how much the fog hides the scene and how
 * much light every source scatters toward the camera, so lanterns and candles
 * get halos and distant streets sink into haze. For point lights there is no
 * ray marching and no shadowing: geometry between a light and the ray does
 * not cut the glow, only geometry on the ray itself ends it.
 *
 * With `shafts`, the sun or moon also shines into the fog, and what stands in
 * its way cuts the light: beams between trees, roofs and window bars. That
 * part marches along the view ray and looks each step up in a depth picture
 * drawn from the light's direction (`attachSun`, `renderShafts`).
 *
 * `zhudaFogOpticalDepth` and `zhudaFogAirlight` are the shader's formulas in
 * TypeScript. Only the class needs the Laya runtime.
 */
import { prepareLaya342ManualDraw } from './Laya342Adapters.ts';

export interface ZhudaLightFogOptions {
  /** Extinction per metre at `baseY`, 0..1 (default 0.012). */
  density?: number;
  /** Height over which the density falls to 1/e, 0.5..1000 metres (default 8). */
  falloffMeters?: number;
  /** Height where the density equals `density` (default 0). */
  baseY?: number;
  /** Colour the fog itself adds (ambient light in the fog), linear RGB (default dark blue). */
  color?: readonly [number, number, number];
  /** Strength of the glow from lights, 0..16 (default 1). */
  scatter?: number;
  /** Rays are cut here, which bounds the fog on the sky, 1..100000 metres (default 600). */
  maxDistance?: number;
  /** Shadowed light from the sun or moon in the fog; needs `attachSun`. */
  shafts?: ZhudaLightShaftOptions;
}

export interface ZhudaLightShaftOptions {
  /** Brightness of the beams, 0..64 (default 1). */
  strength?: number;
  /**
   * How strongly the fog scatters forward, 0..0.95 (default 0.6): high values
   * make beams bright when looking toward the light and faint from the side.
   */
  anisotropy?: number;
  /** How far from the camera beams are drawn, 5..2000 metres (default 60). */
  distance?: number;
  /** Side of the depth picture in pixels, 256..4096 (default 2048). */
  resolution?: number;
  /** Steps along each view ray, 8..96 (default 40). */
  steps?: number;
}

export interface ZhudaFogSun {
  /** Unit vector from the scene toward the sun or moon. */
  toward: readonly [number, number, number];
  /** Linear RGB, already multiplied by the light's intensity. */
  color: readonly [number, number, number];
}

/** Most steps one view ray takes through the beams. */
export const ZHUDA_SHAFT_MAX_STEPS = 96;

export interface ZhudaFogLight {
  position: readonly [number, number, number];
  /** Linear RGB. */
  color: readonly [number, number, number];
  intensity: number;
  /**
   * Metres from the light beyond which a view ray gets no glow from it
   * (default 12). Keeps many lamps from adding up to a wash over the sky.
   */
  range?: number;
}

/** Most lights one fog can hold. */
export const ZHUDA_FOG_MAX_LIGHTS = 128;

const DEFAULTS = {
  density: 0.012,
  falloffMeters: 8,
  baseY: 0,
  color: [0.02, 0.03, 0.05] as readonly [number, number, number],
  scatter: 1,
  maxDistance: 600,
};

const within = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaLightFog(options: ZhudaLightFogOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  const ranges: [string, number, number][] = [
    ['density', 0, 1],
    ['falloffMeters', 0.5, 1000],
    ['baseY', -100000, 100000],
    ['scatter', 0, 16],
    ['maxDistance', 1, 100000],
  ];
  for (const [key, min, max] of ranges)
    if (o[key] !== undefined && !within(o[key], min, max))
      issues.push(`${key}: use ${min}..${max}`);
  if (
    o.color !== undefined &&
    !(Array.isArray(o.color) && o.color.length === 3 && o.color.every((n) => within(n, 0, 64)))
  )
    issues.push('color: use linear RGB with three values between 0 and 64');
  if (o.shafts !== undefined) {
    const s = o.shafts as Record<string, unknown>;
    if (!s || typeof s !== 'object' || Array.isArray(s)) issues.push('shafts: object required');
    else {
      const shaftRanges: [string, number, number, boolean][] = [
        ['strength', 0, 64, false],
        ['anisotropy', 0, 0.95, false],
        ['distance', 5, 2000, false],
        ['resolution', 256, 4096, true],
        ['steps', 8, ZHUDA_SHAFT_MAX_STEPS, true],
      ];
      for (const key of Object.keys(s))
        if (!shaftRanges.some(([name]) => name === key)) issues.push(`shafts.${key}: unknown`);
      for (const [key, min, max, whole] of shaftRanges)
        if (
          s[key] !== undefined &&
          !(within(s[key], min, max) && (!whole || Number.isInteger(s[key])))
        )
          issues.push(`shafts.${key}: use ${whole ? 'a whole number ' : ''}${min}..${max}`);
    }
  }
  return issues;
}

/** Fills in the defaults. */
export function resolveZhudaLightFog(options: ZhudaLightFogOptions = {}) {
  return {
    density: options.density ?? DEFAULTS.density,
    falloffMeters: options.falloffMeters ?? DEFAULTS.falloffMeters,
    baseY: options.baseY ?? DEFAULTS.baseY,
    color: [...(options.color ?? DEFAULTS.color)] as [number, number, number],
    scatter: options.scatter ?? DEFAULTS.scatter,
    maxDistance: options.maxDistance ?? DEFAULTS.maxDistance,
    shafts: options.shafts
      ? {
          strength: options.shafts.strength ?? 1,
          anisotropy: options.shafts.anisotropy ?? 0.6,
          distance: options.shafts.distance ?? 60,
          resolution: options.shafts.resolution ?? 2048,
          steps: options.shafts.steps ?? 40,
        }
      : undefined,
  };
}

/**
 * Optical depth of the fog along a ray from `eyeY` in a direction whose
 * vertical component is `directionY` (unit vector), over `distance` metres.
 * The scene behind is seen through `exp(-depth)`.
 */
export function zhudaFogOpticalDepth(
  fog: { density: number; falloffMeters: number; baseY: number },
  eyeY: number,
  directionY: number,
  distance: number,
): number {
  const atEye = fog.density * Math.exp(-(eyeY - fog.baseY) / fog.falloffMeters);
  const k = directionY / fog.falloffMeters;
  return atEye * (Math.abs(k) < 1e-4 ? distance : (1 - Math.exp(-k * distance)) / k);
}

/**
 * The integral of 1/r² along a ray of length `distance`, r being the distance
 * to a light whose closest approach is `offset` metres from the ray, `along`
 * metres from its start, faded to nothing where the ray passes `range` metres
 * from the light. Multiplied by the fog density and the light's colour, this
 * is the light scattered toward the camera.
 */
export function zhudaFogAirlight(
  along: number,
  offset: number,
  distance: number,
  range = Infinity,
): number {
  const h = Math.max(offset, 0.08);
  // Rays that pass farther than `range` from the light get nothing; the
  // window is smooth so halos have no hard edge.
  const window = Math.max(0, 1 - h / range);
  return ((Math.atan((distance - along) / h) + Math.atan(along / h)) / h) * window * window;
}

const VERTEX =
  '#define SHADER_NAME ZhudaLightFogVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
const FRAGMENT = `#define SHADER_NAME ZhudaLightFogFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
void main(){
vec2 uv=v_Texcoord0;
vec4 source=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
float raw=texture2D(u_CameraDepthTexture,uv).x;
float eyeDepth=1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w);
vec2 ndc=uv*2.0-1.0;
ndc.y*=u_ZhudaFogShape.w;
vec3 ray=u_ZhudaFogForward.xyz+ndc.x*u_ZhudaFogRight+ndc.y*u_ZhudaFogUp;
float t=min(eyeDepth*length(ray),u_ZhudaFogColor.w);
vec3 dir=normalize(ray);
float falloff=u_ZhudaFogShape.y;
float atEye=u_ZhudaFogShape.x*exp(-(u_ZhudaFogEye.y-u_ZhudaFogShape.z)/falloff);
float k=dir.y/falloff;
float tau=atEye*(abs(k)<0.0001?t:(1.0-exp(-k*t))/k);
float through=exp(-tau);
vec3 glow=vec3(0.0);
for(int i=0;i<${ZHUDA_FOG_MAX_LIGHTS};i++){
if(float(i)>=u_ZhudaFogEye.w)break;
float u=(float(i)+0.5)/${ZHUDA_FOG_MAX_LIGHTS}.0;
vec4 place=texture2D(u_ZhudaFogLights,vec2(u,0.25));
vec3 colour=texture2D(u_ZhudaFogLights,vec2(u,0.75)).rgb;
vec3 d=place.xyz-u_ZhudaFogEye.xyz;
float along=dot(d,dir);
float h=max(sqrt(max(dot(d,d)-along*along,0.0)),0.08);
float window=clamp(1.0-h/place.w,0.0,1.0);
float reach=(atan((t-along)/h)+atan(along/h))/h*window*window;
float local=u_ZhudaFogShape.x*exp(-(place.y-u_ZhudaFogShape.z)/falloff);
float k2=clamp(along,0.0,t);
float dim=exp(-atEye*(abs(k)<0.0001?k2:(1.0-exp(-k*k2))/k));
glow+=colour*reach*local*dim;
}
vec3 beams=vec3(0.0);
#ifdef ZHUDA_SHAFTS
float reach=min(t,u_ZhudaShaftShape.y);
float steps=u_ZhudaShaftShape.x;
float stride=reach/steps;
// Each pixel starts its steps at another offset, which turns banding into fine noise.
float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy+u_ZhudaShaftShape.w*vec2(47.0,17.0),vec2(0.06711056,0.00583715))));
float lit=0.0;
for(int i=0;i<${ZHUDA_SHAFT_MAX_STEPS};i++){
if(float(i)>=steps)break;
float s=(float(i)+jitter)*stride;
vec3 p=u_ZhudaFogEye.xyz+dir*s;
vec4 clip=u_ZhudaShaftC0*p.x+u_ZhudaShaftC1*p.y+u_ZhudaShaftC2*p.z+u_ZhudaShaftC3;
vec3 q=clip.xyz/clip.w*0.5+0.5;
float stored=texture2D(u_ZhudaShaftDepth,vec2(q.x,1.0-q.y)).x;
float open=step(q.z-u_ZhudaShaftShape.z,stored);
float inside=step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0)*step(q.z,1.0);
open=mix(1.0,open,inside);
float local=u_ZhudaFogShape.x*exp(-(p.y-u_ZhudaFogShape.z)/falloff);
float dim=exp(-atEye*(abs(k)<0.0001?s:(1.0-exp(-k*s))/k));
lit+=open*local*dim;
}
float g=u_ZhudaShaftColor.w;
float towardSun=dot(dir,u_ZhudaShaftSun);
float phase=(1.0-g*g)/(12.5663706*pow(max(1.0+g*g-2.0*g*towardSun,0.0001),1.5));
beams=u_ZhudaShaftColor.rgb*lit*stride*phase;
#endif
gl_FragColor=vec4(source.rgb*through+u_ZhudaFogColor.rgb*(1.0-through)+glow*u_ZhudaFogForward.w+beams,source.a);
}`;

const registered = new WeakSet<object>();

function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const shader = l.Shader3D.add('ZhudaLightFog');
  shader.shaderType = l.ShaderFeatureType.PostProcess;
  const sub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    {
      u_MainTex: l.ShaderDataType.Texture2D,
      u_ZhudaFogLights: l.ShaderDataType.Texture2D,
      u_ZhudaFogEye: l.ShaderDataType.Vector4,
      u_ZhudaFogForward: l.ShaderDataType.Vector4,
      u_ZhudaFogRight: l.ShaderDataType.Vector3,
      u_ZhudaFogUp: l.ShaderDataType.Vector3,
      u_ZhudaFogShape: l.ShaderDataType.Vector4,
      u_ZhudaFogColor: l.ShaderDataType.Vector4,
      u_ZhudaShaftDepth: l.ShaderDataType.Texture2D,
      u_ZhudaShaftC0: l.ShaderDataType.Vector4,
      u_ZhudaShaftC1: l.ShaderDataType.Vector4,
      u_ZhudaShaftC2: l.ShaderDataType.Vector4,
      u_ZhudaShaftC3: l.ShaderDataType.Vector4,
      u_ZhudaShaftShape: l.ShaderDataType.Vector4,
      u_ZhudaShaftColor: l.ShaderDataType.Vector4,
      u_ZhudaShaftSun: l.ShaderDataType.Vector3,
    },
  );
  shader.addSubShader(sub);
  const pass = sub.addShaderPass(VERTEX, FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  registered.add(l.Shader3D);
}

export class ZhudaLightFog {
  /** The Laya post-process effect; `ZhudaFilmicPipeline` adds it to its chain. */
  readonly effect: any;
  private readonly material: any;
  private readonly lights: any;
  private readonly data = new Float32Array(ZHUDA_FOG_MAX_LIGHTS * 2 * 4);
  private fog: ReturnType<typeof resolveZhudaLightFog>;
  private readonly authored: ZhudaLightFogOptions;
  private count = 0;
  private disposed = false;
  private shaft?: { scene: any; camera: any; target: any; sun: ZhudaFogSun };
  private refresh: 'always' | 'moved' = 'always';
  /** What the depth picture was last drawn for; undefined forces a redraw. */
  private drawnFor: string | undefined;
  private boxCentre: number[] | undefined;
  private frame = 0;

  constructor(options: ZhudaLightFogOptions = {}) {
    const issues = validateZhudaLightFog(options);
    if (issues.length) throw Error('Invalid light fog: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.MaterialPostProcessEffect) throw Error('Light fog needs the Laya post-process module');
    if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable.TextureFormat_R32G32B32A32))
      throw Error('Light fog requires TextureFormat_R32G32B32A32');
    this.fog = resolveZhudaLightFog(options);
    this.authored = structuredClone(options);
    register(l);
    this.lights = new l.Texture2D(
      ZHUDA_FOG_MAX_LIGHTS,
      2,
      l.TextureFormat.R32G32B32A32,
      false,
      false,
      false,
    );
    this.lights.filterMode = l.FilterMode.Point;
    this.lights.wrapModeU = this.lights.wrapModeV = l.WrapMode.Clamp;
    this.lights.setPixelsData(this.data, false, false);
    this.material = new l.Material();
    this.material.setShaderName('ZhudaLightFog');
    this.material.setTexture('u_ZhudaFogLights', this.lights);
    this.effect = new l.MaterialPostProcessEffect();
    this.effect.material = this.material;
    this.update([0, 0, 0], [0, 0, -1], 40, 16 / 9);
  }

  /**
   * Changes the fog in place (weather turning): density, falloff, base
   * height, colour, scatter, reach, and the strength and spread of the light
   * shafts. The next \`update\` shows it. Whether there are shafts, and their
   * distance, resolution and step count, are fixed at construction.
   */
  setFog(values: {
    density?: number;
    falloffMeters?: number;
    baseY?: number;
    color?: readonly [number, number, number];
    scatter?: number;
    maxDistance?: number;
    shafts?: { strength?: number; anisotropy?: number };
  }): void {
    if (this.disposed) throw Error('Disposed light fog');
    const { shafts, ...plain } = values;
    if (shafts && !this.authored.shafts) throw Error('Light fog was built without shafts');
    const defined = (object: object) =>
      Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
    const next: ZhudaLightFogOptions = {
      ...this.authored,
      ...defined(plain),
      ...(this.authored.shafts
        ? { shafts: { ...this.authored.shafts, ...defined(shafts ?? {}) } }
        : {}),
    } as ZhudaLightFogOptions;
    const issues = validateZhudaLightFog(next);
    if (issues.length) throw Error('Invalid light fog: ' + issues.join('; '));
    Object.assign(this.authored, structuredClone(next));
    this.fog = resolveZhudaLightFog(next);
  }

  /** Replaces the lights that shine into the fog (at most `ZHUDA_FOG_MAX_LIGHTS`). */
  setLights(lights: readonly ZhudaFogLight[]): void {
    if (this.disposed) throw Error('Disposed light fog');
    if (lights.length > ZHUDA_FOG_MAX_LIGHTS)
      throw Error(`Light fog holds at most ${ZHUDA_FOG_MAX_LIGHTS} lights`);
    this.data.fill(0);
    lights.forEach((light, i) => {
      const range = light.range ?? 12;
      const values = [...light.position, ...light.color, light.intensity, range];
      if (
        values.length !== 8 ||
        !values.every(Number.isFinite) ||
        light.intensity < 0 ||
        !(range > 0)
      )
        throw Error('Invalid fog light ' + i);
      this.data.set([...light.position, range], i * 4);
      this.data.set(
        light.color.map((c) => c * light.intensity),
        (ZHUDA_FOG_MAX_LIGHTS + i) * 4,
      );
    });
    this.count = lights.length;
    this.lights.setPixelsData(this.data, false, false);
  }

  /**
   * Lets the sun or moon shine into the fog (`shafts` options required). A
   * camera in `scene` draws what the light sees into a depth picture; call
   * `update` and then `renderShafts` before every frame. Calling it again
   * replaces the light.
   */
  attachSun(scene: any, sun: ZhudaFogSun): void {
    if (this.disposed) throw Error('Disposed light fog');
    const options = this.fog.shafts;
    if (!options) throw Error('Light fog was created without shafts');
    const values = [...sun.toward, ...sun.color];
    const length = Math.hypot(sun.toward[0], sun.toward[1], sun.toward[2]);
    if (values.length !== 6 || !values.every(Number.isFinite) || Math.abs(length - 1) > 1e-3)
      throw Error('Invalid fog sun: toward must be a unit vector, color three numbers');
    const l = (globalThis as any).Laya;
    if (this.shaft) {
      if (this.shaft.scene !== scene) throw Error('Light fog is attached to another scene');
      this.shaft.sun = { toward: [...sun.toward] as any, color: [...sun.color] as any };
      return;
    }
    const target = new l.RenderTexture(
      options.resolution,
      options.resolution,
      l.RenderTargetFormat.R8G8B8A8,
      l.RenderTargetFormat.DEPTH_32 ?? l.RenderTargetFormat.DEPTH_16,
      false,
      1,
      true,
    );
    const depth = target.depthStencilTexture;
    if (!depth) {
      target.destroy();
      throw Error('Light shafts need a render target with a readable depth texture');
    }
    depth.filterMode = l.FilterMode.Point;
    depth.wrapModeU = depth.wrapModeV = l.WrapMode.Clamp;
    const camera = new l.Camera(1, 0.5, 1000);
    camera.name = 'zhuda-light-shafts';
    camera.orthographic = true;
    camera.clearFlag = l.CameraClearFlags.SolidColor;
    camera.clearColor = new l.Color(0, 0, 0, 1);
    camera.enableHDR = false;
    camera.renderTarget = target;
    camera.renderingOrder = -200;
    // Drawn by `renderShafts`, not by the engine's frame loop.
    camera.enableRender = false;
    scene.addChild(camera);
    this.shaft = {
      scene,
      camera,
      target,
      sun: { toward: [...sun.toward] as any, color: [...sun.color] as any },
    };
    this.material.setTexture('u_ZhudaShaftDepth', depth);
    this.material.addDefine(l.Shader3D.getDefineByName('ZHUDA_SHAFTS'));
  }

  /** Which frame of a sequence is drawn: moves the step noise so samples average it away. */
  setFrame(index: number): void {
    if (!Number.isInteger(index) || index < 0) throw Error('Invalid frame index');
    this.frame = index % 1024;
  }

  /**
   * `always` (default): `renderShafts` redraws the depth picture every time,
   * which moving things in the light need. `moved`: the picture covers a
   * larger box that follows the camera in steps and is redrawn only when the
   * camera has left it, which suits a game with still scenery.
   */
  setShaftRefresh(mode: 'always' | 'moved'): void {
    if (mode !== 'always' && mode !== 'moved') throw Error('Shaft refresh: always or moved');
    this.refresh = mode;
    this.drawnFor = undefined;
  }

  /** Forces the next `renderShafts` to redraw (the scenery changed). */
  invalidateShafts(): void {
    this.drawnFor = undefined;
  }

  /**
   * Draws the depth picture of the light. Call it after `update`, before the
   * main camera draws; the engine's frame loop does not draw it. The pass
   * needs no shadow maps of its own and does not draw any.
   */
  renderShafts(): void {
    if (this.disposed) throw Error('Disposed light fog');
    if (!this.shaft) return;
    const l = (globalThis as any).Laya;
    const { camera, scene, target, sun } = this.shaft;
    if (this.refresh === 'moved') {
      const key = JSON.stringify([this.boxCentre, sun.toward]);
      if (key === this.drawnFor) return;
      this.drawnFor = key;
    }
    const before = l.Stat.enableShadow;
    l.Stat.enableShadow = false;
    try {
      prepareLaya342ManualDraw(scene);
      l.Camera.drawRenderTextureByScene(camera, scene, target);
    } finally {
      l.Stat.enableShadow = before;
      camera.renderTarget = target;
    }
  }

  /** Call when the camera moves or its field of view or aspect changes. */
  update(
    eye: readonly number[],
    target: readonly number[],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed light fog');
    const l = (globalThis as any).Laya;
    const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const length = Math.hypot(f[0], f[1], f[2]);
    if (!(length > 1e-9) || ![...eye, fieldOfViewDeg, aspect].every(Number.isFinite))
      throw Error('Invalid light fog camera');
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
    const m = this.material;
    m.setVector4('u_ZhudaFogEye', new l.Vector4(eye[0], eye[1], eye[2], this.count));
    m.setVector4(
      'u_ZhudaFogForward',
      new l.Vector4(forward[0], forward[1], forward[2], this.fog.scatter),
    );
    m.setVector3(
      'u_ZhudaFogRight',
      new l.Vector3(right[0] * tan * aspect, right[1] * tan * aspect, right[2] * tan * aspect),
    );
    m.setVector3('u_ZhudaFogUp', new l.Vector3(up[0] * tan, up[1] * tan, up[2] * tan));
    m.setVector4(
      'u_ZhudaFogShape',
      new l.Vector4(this.fog.density, this.fog.falloffMeters, this.fog.baseY, 1),
    );
    m.setVector4(
      'u_ZhudaFogColor',
      new l.Vector4(this.fog.color[0], this.fog.color[1], this.fog.color[2], this.fog.maxDistance),
    );
    if (this.shaft && this.fog.shafts) {
      // The light's camera covers a box around the stretch of view where beams are drawn.
      const options = this.fog.shafts,
        { camera, sun } = this.shaft;
      // `moved`: the box is larger and its centre snaps to a grid, so the
      // same picture serves until the camera has travelled a grid cell.
      const grid = this.refresh === 'moved' ? options.distance * 0.25 : 0;
      const half = options.distance * 0.6 + grid,
        back = half + 300;
      const centre = eye.map((v, i) => {
        const at = v + forward[i] * options.distance * 0.5;
        return grid ? Math.round(at / grid) * grid : at;
      });
      this.boxCentre = centre;
      camera.orthographicVerticalSize = half * 2;
      camera.aspectRatio = 1;
      camera.nearPlane = 0.5;
      camera.farPlane = back + half + 50;
      camera.transform.position = new l.Vector3(
        centre[0] + sun.toward[0] * back,
        centre[1] + sun.toward[1] * back,
        centre[2] + sun.toward[2] * back,
      );
      const steep = Math.hypot(sun.toward[0], sun.toward[2]) < 1e-4;
      camera.transform.lookAt(
        new l.Vector3(centre[0], centre[1], centre[2]),
        steep ? new l.Vector3(0, 0, 1) : new l.Vector3(0, 1, 0),
        false,
      );
      // The same projection as that camera, computed here: Laya refreshes a
      // camera's own matrices only when it draws, one frame too late.
      const z = sun.toward,
        upHint = steep ? [0, 0, 1] : [0, 1, 0];
      let x = [
        upHint[1] * z[2] - upHint[2] * z[1],
        upHint[2] * z[0] - upHint[0] * z[2],
        upHint[0] * z[1] - upHint[1] * z[0],
      ];
      const xl = Math.hypot(x[0], x[1], x[2]);
      x = x.map((n) => n / xl);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      const place = [centre[0] + z[0] * back, centre[1] + z[1] * back, centre[2] + z[2] * back];
      const dot = (a: readonly number[], b: readonly number[]) =>
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const depth = 2 / (camera.farPlane - camera.nearPlane);
      for (let i = 0; i < 3; i++)
        m.setVector4(
          'u_ZhudaShaftC' + i,
          new l.Vector4(x[i] / half, y[i] / half, -z[i] * depth, 0),
        );
      m.setVector4(
        'u_ZhudaShaftC3',
        new l.Vector4(
          -dot(place, x) / half,
          -dot(place, y) / half,
          (dot(place, z) - camera.nearPlane) * depth - 1,
          1,
        ),
      );
      m.setVector4(
        'u_ZhudaShaftShape',
        // steps, reach, depth bias (0.2 m of the camera's range), frame
        new l.Vector4(options.steps, options.distance, 0.2 / (camera.farPlane - 0.5), this.frame),
      );
      m.setVector4(
        'u_ZhudaShaftColor',
        new l.Vector4(
          sun.color[0] * options.strength,
          sun.color[1] * options.strength,
          sun.color[2] * options.strength,
          options.anisotropy,
        ),
      );
      m.setVector3('u_ZhudaShaftSun', new l.Vector3(sun.toward[0], sun.toward[1], sun.toward[2]));
    }
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.effect.material = null;
    if (this.shaft) {
      this.material.setTexture('u_ZhudaShaftDepth', null);
      this.shaft.camera.renderTarget = null;
      this.shaft.camera.destroy(true);
      this.shaft.target.destroy();
      this.shaft = undefined;
    }
    this.material.setTexture('u_ZhudaFogLights', null);
    this.material.destroy();
    this.lights.destroy();
  }
}
