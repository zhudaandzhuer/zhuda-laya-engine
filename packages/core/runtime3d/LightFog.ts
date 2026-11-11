/**
 * Height fog lit by point lights, as one post-process effect.
 *
 * Fog density falls off exponentially with height. Along each view ray the
 * effect computes, in closed form, how much the fog hides the scene and how
 * much light every source scatters toward the camera, so lanterns and candles
 * get halos and distant streets sink into haze. There is no ray marching and
 * no shadowing: geometry between a light and the ray does not cut the glow,
 * only geometry on the ray itself ends it.
 *
 * `zhudaFogOpticalDepth` and `zhudaFogAirlight` are the shader's formulas in
 * TypeScript. Only the class needs the Laya runtime.
 */

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
}

export interface ZhudaFogLight {
  position: readonly [number, number, number];
  /** Linear RGB. */
  color: readonly [number, number, number];
  intensity: number;
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
 * metres from its start. Multiplied by the fog density and the light's
 * colour, this is the light scattered toward the camera.
 */
export function zhudaFogAirlight(along: number, offset: number, distance: number): number {
  const h = Math.max(offset, 0.08);
  return (Math.atan((distance - along) / h) + Math.atan(along / h)) / h;
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
float reach=(atan((t-along)/h)+atan(along/h))/h;
float local=u_ZhudaFogShape.x*exp(-(place.y-u_ZhudaFogShape.z)/falloff);
float k2=clamp(along,0.0,t);
float dim=exp(-atEye*(abs(k)<0.0001?k2:(1.0-exp(-k*k2))/k));
glow+=colour*reach*local*dim;
}
gl_FragColor=vec4(source.rgb*through+u_ZhudaFogColor.rgb*(1.0-through)+glow*u_ZhudaFogForward.w,source.a);
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
  private readonly fog: ReturnType<typeof resolveZhudaLightFog>;
  private count = 0;
  private disposed = false;

  constructor(options: ZhudaLightFogOptions = {}) {
    const issues = validateZhudaLightFog(options);
    if (issues.length) throw Error('Invalid light fog: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.MaterialPostProcessEffect) throw Error('Light fog needs the Laya post-process module');
    if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable.TextureFormat_R32G32B32A32))
      throw Error('Light fog requires TextureFormat_R32G32B32A32');
    this.fog = resolveZhudaLightFog(options);
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

  /** Replaces the lights that shine into the fog (at most `ZHUDA_FOG_MAX_LIGHTS`). */
  setLights(lights: readonly ZhudaFogLight[]): void {
    if (this.disposed) throw Error('Disposed light fog');
    if (lights.length > ZHUDA_FOG_MAX_LIGHTS)
      throw Error(`Light fog holds at most ${ZHUDA_FOG_MAX_LIGHTS} lights`);
    this.data.fill(0);
    lights.forEach((light, i) => {
      const values = [...light.position, ...light.color, light.intensity];
      if (values.length !== 7 || !values.every(Number.isFinite) || light.intensity < 0)
        throw Error('Invalid fog light ' + i);
      this.data.set(light.position, i * 4);
      this.data.set(
        light.color.map((c) => c * light.intensity),
        (ZHUDA_FOG_MAX_LIGHTS + i) * 4,
      );
    });
    this.count = lights.length;
    this.lights.setPixelsData(this.data, false, false);
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
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.effect.material = null;
    this.material.setTexture('u_ZhudaFogLights', null);
    this.material.destroy();
    this.lights.destroy();
  }
}
