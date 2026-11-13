/**
 * A layer of clouds with depth: a slab of air between two heights in which
 * a drifting noise says how much cloud there is, followed along each view
 * ray by a post-process effect in linear HDR. The sun lights the side of a
 * cloud that faces it and the cloud shades itself; the sky's own light fills
 * the rest. Clouds are drawn where the view reaches the slab before it
 * reaches anything solid, so hills and towers stand in front of them.
 *
 * It is one layer of one kind of cloud: no weather, no rain, no shadows of
 * clouds on the ground, and nothing mirrors them but what mirrors the screen
 * (`screenReflections`). The noise is computed, not stored: each step along
 * a ray costs about seventy arithmetic lookups, each pixel `steps` of them.
 */

const VERTEX =
  '#define SHADER_NAME ZhudaCloudsVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';

export const ZHUDA_CLOUD_MAX_STEPS = 64;

// Value noise on a lattice, four octaves. `zhudaCloudAmount` is how much
// cloud there is at a place: the noise above a threshold set by `coverage`,
// rounded off toward the bottom and the top of the slab.
const FRAGMENT = `#define SHADER_NAME ZhudaCloudsFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
float zhudaCloudHash(vec3 p){
p=fract(p*0.3183099+vec3(0.1,0.17,0.13));
p*=17.0;
return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float zhudaCloudNoise(vec3 x){
vec3 i=floor(x);
vec3 f=fract(x);
f=f*f*(3.0-2.0*f);
return mix(mix(mix(zhudaCloudHash(i),zhudaCloudHash(i+vec3(1.0,0.0,0.0)),f.x),
mix(zhudaCloudHash(i+vec3(0.0,1.0,0.0)),zhudaCloudHash(i+vec3(1.0,1.0,0.0)),f.x),f.y),
mix(mix(zhudaCloudHash(i+vec3(0.0,0.0,1.0)),zhudaCloudHash(i+vec3(1.0,0.0,1.0)),f.x),
mix(zhudaCloudHash(i+vec3(0.0,1.0,1.0)),zhudaCloudHash(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z);
}
float zhudaCloudAmount(vec3 p){
float h=(p.y-u_ZhudaCloudShape.x)/max(u_ZhudaCloudShape.y-u_ZhudaCloudShape.x,1.0);
float round=smoothstep(0.0,0.25,h)*(1.0-smoothstep(0.55,1.0,h));
vec3 q=vec3(p.x+u_ZhudaCloudDrift.x,p.y,p.z+u_ZhudaCloudDrift.y)*u_ZhudaCloudDrift.z;
float n=0.5*zhudaCloudNoise(q);
n+=0.25*zhudaCloudNoise(q*2.03+vec3(11.0,3.0,7.0));
n+=0.125*zhudaCloudNoise(q*4.01+vec3(5.0,17.0,2.0));
n+=0.0625*zhudaCloudNoise(q*8.05+vec3(1.0,9.0,13.0));
n/=0.9375;
return clamp((n-(1.0-u_ZhudaCloudShape.z))/max(u_ZhudaCloudShape.z,0.05),0.0,1.0)*round;
}
void main(){
vec2 uv=v_Texcoord0;
vec4 source=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
float raw=texture2D(u_CameraDepthTexture,uv).x;
float depth=1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w);
vec2 ndc=uv*2.0-1.0;
vec3 ray=u_ZhudaCloudForward.xyz+ndc.x*u_ZhudaCloudRight.xyz+ndc.y*u_ZhudaCloudUp.xyz;
float len=length(ray);
vec3 dir=ray/len;
vec3 eye=u_ZhudaCloudEye.xyz;
// Where the ray is inside the slab.
float steep=abs(dir.y)<0.0001?0.0001:dir.y;
float ta=(u_ZhudaCloudShape.x-eye.y)/steep;
float tb=(u_ZhudaCloudShape.y-eye.y)/steep;
float t0=max(min(ta,tb),0.0);
float t1=max(ta,tb);
// Nothing beyond what is solid. Where nothing was drawn (the depth is the
// camera's far plane, whatever that is) the clouds reach as far as they go.
float reach=u_ZhudaCloudEye.w;
t1=min(t1,raw<u_ZhudaCloudForward.w?min(reach,depth*len):reach);
vec3 gathered=vec3(0.0);
float through=1.0;
float steps=u_ZhudaCloudLight.w;
if(t1>t0){
float stride=(t1-t0)/steps;
// Each pixel starts at another offset, which turns banding into fine noise.
float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
float toward=dot(dir,u_ZhudaCloudSun.xyz);
// Light scattered forward: brightest looking toward the sun.
float phase=mix(1.0,2.2,pow(max(toward,0.0),6.0));
for(int i=0;i<${ZHUDA_CLOUD_MAX_STEPS};i++){
if(float(i)>=steps)break;
float t=t0+(float(i)+jitter)*stride;
vec3 p=eye+dir*t;
float amount=zhudaCloudAmount(p);
if(amount>0.001){
// How much cloud the sun's light has come through to get here.
float above=zhudaCloudAmount(p+u_ZhudaCloudSun.xyz*u_ZhudaCloudSun.w);
float lit=exp(-above*u_ZhudaCloudShape.w*u_ZhudaCloudSun.w*0.012);
vec3 colour=u_ZhudaCloudSky.rgb+u_ZhudaCloudLight.rgb*lit*phase;
float held=exp(-amount*u_ZhudaCloudShape.w*stride*0.012);
// Far clouds fade into the sky they stand in.
float near=exp(-t/reach*3.0);
gathered+=through*(1.0-held)*mix(source.rgb,colour,near);
through*=held;
}
}
}
gl_FragColor=vec4(source.rgb*through+gathered,source.a);
}`;

const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const shader = l.Shader3D.add('ZhudaClouds');
  shader.shaderType = l.ShaderFeatureType.PostProcess;
  const v4 = l.ShaderDataType.Vector4;
  const sub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    {
      u_MainTex: l.ShaderDataType.Texture2D,
      u_ZhudaCloudEye: v4,
      u_ZhudaCloudForward: v4,
      u_ZhudaCloudRight: v4,
      u_ZhudaCloudUp: v4,
      u_ZhudaCloudShape: v4,
      u_ZhudaCloudDrift: v4,
      u_ZhudaCloudSun: v4,
      u_ZhudaCloudLight: v4,
      u_ZhudaCloudSky: v4,
    },
  );
  shader.addSubShader(sub);
  const pass = sub.addShaderPass(VERTEX, FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  registered.add(l.Shader3D);
}

export interface ZhudaCloudsOptions {
  /** How much of the sky is cloud, 0..1 (default 0.5). */
  coverage?: number;
  /** Height of the clouds' underside in metres, 50..20000 (default 1500). */
  baseMeters?: number;
  /** How thick the layer is in metres, 50..8000 (default 900). */
  thicknessMeters?: number;
  /** Size of a cloud in metres, 100..50000 (default 2600). */
  sizeMeters?: number;
  /** How dense the cloud is, 0..4 (default 1): higher is darker underneath and harder edged. */
  density?: number;
  /** The wind: metres a second along X and Z (default [8, 0]), each within 300. */
  wind?: readonly number[];
  /** Steps along each view ray, 8..64 (default 32). */
  steps?: number;
  /** How far clouds are drawn in metres, 1000..200000 (default 40000). */
  distanceMeters?: number;
  /** Direction toward the sun (default straight up). */
  sunToward?: readonly number[];
  /** The sun's light on the clouds, scene-linear RGB (default [1, 1, 1]). */
  sunColor?: readonly number[];
  /** The sky's own light in the clouds, scene-linear RGB (default [0.35, 0.4, 0.5]). */
  skyColor?: readonly number[];
}

const CLOUD_KEYS = [
  'coverage',
  'baseMeters',
  'thicknessMeters',
  'sizeMeters',
  'density',
  'wind',
  'steps',
  'distanceMeters',
  'sunToward',
  'sunColor',
  'skyColor',
] as const;

const list = (value: unknown, length: number, min: number, max: number) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);

export function validateZhudaClouds(options: ZhudaCloudsOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(o))
    if (!(CLOUD_KEYS as readonly string[]).includes(key))
      issues.push(`${key}: unknown option (${CLOUD_KEYS.join(', ')})`);
  const range = (key: string, min: number, max: number) => {
    const value = o[key];
    if (value !== undefined && !(typeof value === 'number' && value >= min && value <= max))
      issues.push(`${key}: use ${min}..${max}`);
  };
  range('coverage', 0, 1);
  range('baseMeters', 50, 20000);
  range('thicknessMeters', 50, 8000);
  range('sizeMeters', 100, 50000);
  range('density', 0, 4);
  if (o.wind !== undefined && !list(o.wind, 2, -300, 300))
    issues.push('wind: use [x, z] in metres a second, each within 300');
  if (
    o.steps !== undefined &&
    !(Number.isInteger(o.steps) && (o.steps as number) >= 8 && (o.steps as number) <= 64)
  )
    issues.push(`steps: use a whole number 8..${ZHUDA_CLOUD_MAX_STEPS}`);
  range('distanceMeters', 1000, 200000);
  if (
    o.sunToward !== undefined &&
    !(list(o.sunToward, 3, -1e6, 1e6) && Math.hypot(...(o.sunToward as number[])) > 1e-6)
  )
    issues.push('sunToward: use a direction [x, y, z]');
  for (const key of ['sunColor', 'skyColor'])
    if (o[key] !== undefined && !list(o[key], 3, 0, 1024))
      issues.push(`${key}: use [r, g, b] of 0 or more`);
  return issues;
}

export function resolveZhudaClouds(options: ZhudaCloudsOptions = {}): Required<ZhudaCloudsOptions> {
  return {
    coverage: options.coverage ?? 0.5,
    baseMeters: options.baseMeters ?? 1500,
    thicknessMeters: options.thicknessMeters ?? 900,
    sizeMeters: options.sizeMeters ?? 2600,
    density: options.density ?? 1,
    wind: options.wind ? [...options.wind] : [8, 0],
    steps: options.steps ?? 32,
    distanceMeters: options.distanceMeters ?? 40000,
    sunToward: options.sunToward ? [...options.sunToward] : [0, 1, 0],
    sunColor: options.sunColor ? [...options.sunColor] : [1, 1, 1],
    skyColor: options.skyColor ? [...options.skyColor] : [0.35, 0.4, 0.5],
  };
}

/** A stored depth at or beyond this is the far plane: nothing was drawn there. */
const SKY_FROM = 0.99999;

export class ZhudaClouds {
  /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, first. */
  readonly effect: any;
  private options: Required<ZhudaCloudsOptions>;
  private readonly material: any;
  private seconds = 0;
  private disposed = false;

  constructor(options: ZhudaCloudsOptions = {}) {
    const issues = validateZhudaClouds(options);
    if (issues.length) throw Error('Invalid clouds: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect || !l.Material)
      throw Error('Clouds need the Laya post-process module');
    this.options = resolveZhudaClouds(options);
    register(l);
    const material = (this.material = new l.Material());
    material.setShaderName('ZhudaClouds');
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

  /** Changes the clouds in place: how many, how high, how dense, the wind, their light. */
  setClouds(options: ZhudaCloudsOptions): void {
    if (this.disposed) throw Error('Disposed clouds');
    const next = { ...this.options, ...options };
    const issues = validateZhudaClouds(next);
    if (issues.length) throw Error('Invalid clouds: ' + issues.join('; '));
    this.options = resolveZhudaClouds(next);
    this.shape();
  }

  /** The time the clouds have drifted for, in seconds. The same time draws the same sky. */
  setTime(seconds: number): void {
    if (this.disposed) throw Error('Disposed clouds');
    if (!Number.isFinite(seconds)) throw Error('Invalid clouds time');
    this.seconds = seconds;
    this.shape();
  }

  private shape(): void {
    const l = (globalThis as any).Laya,
      o = this.options,
      m = this.material;
    const sun = o.sunToward,
      length = Math.hypot(sun[0], sun[1], sun[2]);
    m.setVector4(
      'u_ZhudaCloudShape',
      new l.Vector4(o.baseMeters, o.baseMeters + o.thicknessMeters, o.coverage, o.density),
    );
    m.setVector4(
      'u_ZhudaCloudDrift',
      new l.Vector4(o.wind[0] * this.seconds, o.wind[1] * this.seconds, 1 / o.sizeMeters, 0),
    );
    // The light is followed toward the sun for a fifth of the layer's depth.
    m.setVector4(
      'u_ZhudaCloudSun',
      new l.Vector4(sun[0] / length, sun[1] / length, sun[2] / length, o.thicknessMeters * 0.2),
    );
    m.setVector4(
      'u_ZhudaCloudLight',
      new l.Vector4(o.sunColor[0], o.sunColor[1], o.sunColor[2], o.steps),
    );
    m.setVector4('u_ZhudaCloudSky', new l.Vector4(o.skyColor[0], o.skyColor[1], o.skyColor[2], 0));
  }

  /** Call after the camera has moved or its field of view has changed. */
  update(
    eye: readonly number[],
    target: readonly number[],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed clouds');
    const l = (globalThis as any).Laya;
    const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const length = Math.hypot(f[0], f[1], f[2]);
    if (!(length > 1e-9) || ![...eye, fieldOfViewDeg, aspect].every(Number.isFinite))
      throw Error('Invalid clouds camera');
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
    m.setVector4(
      'u_ZhudaCloudEye',
      new l.Vector4(eye[0], eye[1], eye[2], this.options.distanceMeters),
    );
    m.setVector4(
      'u_ZhudaCloudForward',
      new l.Vector4(forward[0], forward[1], forward[2], SKY_FROM),
    );
    m.setVector4(
      'u_ZhudaCloudRight',
      new l.Vector4(right[0] * tan * aspect, right[1] * tan * aspect, right[2] * tan * aspect, 0),
    );
    m.setVector4('u_ZhudaCloudUp', new l.Vector4(up[0] * tan, up[1] * tan, up[2] * tan, 0));
    this.shape();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.material.destroy();
  }
}
