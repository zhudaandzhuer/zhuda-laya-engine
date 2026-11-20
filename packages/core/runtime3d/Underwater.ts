/**
 * Water as a medium the camera is in: a sea, a lake seen from below.
 *
 * Three parts, all following one set of waves on the water's surface at
 * `surfaceY`:
 *
 * - The view (`ZhudaUnderwater.effect`, a post-process effect for the HDR
 *   chain): while the eye is below the surface, what it sees is dimmed per
 *   colour channel by the water between (`extinction`, per metre: red goes
 *   first, then green) and replaced by the light the water scatters toward
 *   the eye (`color`), itself dimmed by how deep the eye is. Above the
 *   surface the effect changes nothing.
 * - The light: sunlight reaching a lit surface below the water is dimmed by
 *   the water it came through and gathered into caustics, the bright net the
 *   waves focus onto the floor, computed where the light crossed the
 *   surface (`installLaya342Underwater` teaches LayaAir's PBR and Blinn-Phong
 *   lighting this; the scene's `ZHUDA_UNDERWATER` define turns it on). No
 *   texture: on WebGPU every texture a scene declares takes a sampler in
 *   every lit shader.
 * - The surface from below (`surface`): a plane at the surface, drawn while
 *   the eye is below it, showing the sky through the window the critical
 *   angle leaves (48.6°) and the water's own colour where light is totally
 *   reflected beyond it. The plane ends at `maxDistance`; behind it, and
 *   behind everything else under water, a sphere just inside the camera's
 *   far plane carries the still surface on and the water's own light below
 *   it, so that nothing but water stands behind clear water.
 *
 * `zhudaUnderwaterTransmittance` and `zhudaCausticIntensity` are the
 * shaders' formulas in TypeScript.
 */
import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
import { ZhudaShaderMaterial } from '../shaders/ShaderMaterials.ts';

type V3 = readonly [number, number, number];

export interface ZhudaUnderwaterCaustics {
  /** How strongly the waves gather sunlight, 0..4 (default 1); 0 is a plain dimmed sun. */
  strength?: number;
  /** Length of the longest wave in metres, 0.2..50 (default 2.5). */
  waveMeters?: number;
  /** Height of the waves relative to the default, 0..4 (default 1). */
  waves?: number;
  /** Metres below the surface over which caustics fade to about a third, 0.5..500 (default 10). */
  fadeDepth?: number;
  /** Metres from the eye beyond which caustics are gone, 1..2000 (default 40). */
  fadeDistance?: number;
}

export interface ZhudaUnderwaterOptions {
  /** Height of the water's surface (default 0). */
  surfaceY?: number;
  /**
   * Light the water scatters toward the eye where it is thick, as light:
   * scene-linear RGB (default a sea blue-green). A film look decodes its
   * display value first.
   */
  color?: V3;
  /** Extinction per metre for red, green and blue, each 0..10 (default [0.45, 0.12, 0.08]). */
  extinction?: V3;
  /** Rays are cut here, which bounds the water on open views, 1..10000 metres (default 150). */
  maxDistance?: number;
  /** Caustics and how the waves are made; `false` for none. */
  caustics?: ZhudaUnderwaterCaustics | false;
  /** Draw the surface seen from below (default true). */
  surface?: boolean;
}

export type ZhudaResolvedUnderwater = Required<Omit<ZhudaUnderwaterOptions, 'caustics'>> & {
  caustics: Required<ZhudaUnderwaterCaustics> | false;
};

/** The define that turns the lighting part on for a scene. */
export const ZHUDA_UNDERWATER_DEFINE = 'ZHUDA_UNDERWATER';
/** The layer the surface seen from below is drawn on (left out of light shafts' depth picture). */
export const ZHUDA_UNDERWATER_LAYER = 29;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const triple = (v: unknown, lo: number, hi: number) =>
  Array.isArray(v) && v.length === 3 && v.every((c) => finite(c) && c >= lo && c <= hi);

/** Lists what is wrong with the options; empty when they are valid. Needs no GPU. */
export function validateZhudaUnderwater(options: ZhudaUnderwaterOptions): string[] {
  const o = (options ?? {}) as Record<string, unknown>;
  const issues: string[] = [];
  const known = ['surfaceY', 'color', 'extinction', 'maxDistance', 'caustics', 'surface'];
  for (const key of Object.keys(o))
    if (!known.includes(key))
      issues.push(`${key}: not an underwater field (use ${known.join(', ')})`);
  if (o.surfaceY !== undefined && !(finite(o.surfaceY) && Math.abs(o.surfaceY) <= 100000))
    issues.push('surfaceY: a height in metres');
  if (o.color !== undefined && !triple(o.color, 0, 64)) issues.push('color: three numbers 0..64');
  if (o.extinction !== undefined && !triple(o.extinction, 0, 10))
    issues.push('extinction: three numbers per metre, 0..10');
  if (
    o.maxDistance !== undefined &&
    !(finite(o.maxDistance) && o.maxDistance >= 1 && o.maxDistance <= 10000)
  )
    issues.push('maxDistance: use 1..10000');
  if (o.surface !== undefined && typeof o.surface !== 'boolean')
    issues.push('surface: true or false');
  const c = o.caustics as Record<string, unknown> | false | undefined;
  if (c !== undefined && c !== false) {
    if (!c || typeof c !== 'object' || Array.isArray(c))
      issues.push('caustics: an object or false');
    else {
      const ranges: Record<string, [number, number]> = {
        strength: [0, 4],
        waveMeters: [0.2, 50],
        waves: [0, 4],
        fadeDepth: [0.5, 500],
        fadeDistance: [1, 2000],
      };
      for (const key of Object.keys(c))
        if (!ranges[key]) issues.push(`caustics.${key}: not a caustics field`);
        else if (
          !(
            finite(c[key]) &&
            (c[key] as number) >= ranges[key][0] &&
            (c[key] as number) <= ranges[key][1]
          )
        )
          issues.push(`caustics.${key}: use ${ranges[key][0]}..${ranges[key][1]}`);
    }
  }
  return issues;
}

/** The options with their defaults. */
export function resolveZhudaUnderwater(
  options: ZhudaUnderwaterOptions = {},
): ZhudaResolvedUnderwater {
  const issues = validateZhudaUnderwater(options);
  if (issues.length) throw Error('Invalid underwater: ' + issues.join('; '));
  return {
    surfaceY: options.surfaceY ?? 0,
    color: [...(options.color ?? [0.02, 0.09, 0.12])] as [number, number, number],
    extinction: [...(options.extinction ?? [0.45, 0.12, 0.08])] as [number, number, number],
    maxDistance: options.maxDistance ?? 150,
    surface: options.surface ?? true,
    caustics:
      options.caustics === false
        ? false
        : {
            strength: 1,
            waveMeters: 2.5,
            waves: 1,
            fadeDepth: 10,
            fadeDistance: 40,
            ...options.caustics,
          },
  };
}

/** How much of each channel survives `meters` of water. */
export function zhudaUnderwaterTransmittance(
  extinction: V3,
  meters: number,
): [number, number, number] {
  return [
    Math.exp(-extinction[0] * meters),
    Math.exp(-extinction[1] * meters),
    Math.exp(-extinction[2] * meters),
  ];
}

/**
 * The waves: four trains of different length and direction, as fractions of
 * the longest (`waveMeters`) and amplitudes as fractions of a length, moving
 * at the speed of deep water. The GLSL below is the same.
 */
const WAVES: readonly { dir: [number, number]; length: number; height: number }[] = [
  { dir: [0.96, 0.28], length: 1, height: 0.012 },
  { dir: [-0.44, 0.9], length: 0.73, height: 0.009 },
  { dir: [0.62, -0.78], length: 0.53, height: 0.007 },
  { dir: [-0.88, -0.47], length: 0.37, height: 0.005 },
];
const GRAVITY = 9.81;
/** Bending of light from air into water for a gently sloped surface: 1 - 1/1.333. */
const BEND = 0.25;

/** Height, slope (d/dx, d/dz) and the second derivatives (xx, zz, xz) of the waves at x, z. */
export function zhudaUnderwaterWaves(
  x: number,
  z: number,
  seconds: number,
  waveMeters = 2.5,
  waves = 1,
): { height: number; slope: [number, number]; curvature: [number, number, number] } {
  let height = 0,
    sx = 0,
    sz = 0,
    hxx = 0,
    hzz = 0,
    hxz = 0;
  for (const w of WAVES) {
    const lambda = waveMeters * w.length,
      k = (2 * Math.PI) / lambda,
      a = w.height * lambda * waves,
      omega = Math.sqrt(GRAVITY * k);
    const phase = k * (w.dir[0] * x + w.dir[1] * z) - omega * seconds;
    const s = Math.sin(phase),
      c = Math.cos(phase);
    height += a * s;
    sx += a * k * c * w.dir[0];
    sz += a * k * c * w.dir[1];
    hxx -= a * k * k * s * w.dir[0] * w.dir[0];
    hzz -= a * k * k * s * w.dir[1] * w.dir[1];
    hxz -= a * k * k * s * w.dir[0] * w.dir[1];
  }
  return { height, slope: [sx, sz], curvature: [hxx, hzz, hxz] };
}

/**
 * How much sunlight is gathered at a point `depth` metres of light path below
 * where it crossed the surface at x, z: the area the waves focus onto it
 * (1 where flat; above 1 in the bright lines; at most 6).
 */
export function zhudaCausticIntensity(
  x: number,
  z: number,
  depth: number,
  seconds: number,
  waveMeters = 2.5,
  waves = 1,
): number {
  const [hxx, hzz, hxz] = zhudaUnderwaterWaves(x, z, seconds, waveMeters, waves).curvature;
  const f = depth * BEND;
  const det = 1 + f * (hxx + hzz) + f * f * (hxx * hzz - hxz * hxz);
  return Math.min(6, 1 / Math.max(Math.abs(det), 1 / 6));
}

const waveGlsl = () => {
  const term = (w: (typeof WAVES)[number]) =>
    `{float lambda=u_ZhudaCaustics.z*${w.length.toFixed(4)};float k=6.2831853/lambda;float a=${w.height.toFixed(4)}*lambda*u_ZhudaCaustics.w;vec2 d=vec2(${w.dir[0].toFixed(4)},${w.dir[1].toFixed(4)});float ph=k*dot(d,xz)-sqrt(${GRAVITY.toFixed(2)}*k)*t;float s=sin(ph);float c=cos(ph);slope+=a*k*c*d;float kk=a*k*k*s;curve-=vec3(kk*d.x*d.x,kk*d.y*d.y,kk*d.x*d.y);}`;
  return `void zhudaUnderwaterWaves(vec2 xz,float t,out vec2 slope,out vec3 curve){slope=vec2(0.0);curve=vec3(0.0);${WAVES.map(term).join('')}}`;
};

/**
 * The lighting part, put into LayaAir's PBR and Blinn-Phong fragments. The
 * three vectors are the scene's (`ZhudaUnderwater` writes them): surface
 * height, caustic strength, longest wave, wave height; fade depth, fade
 * distance and the waves' time in seconds; extinction per channel.
 */
const LIGHT_GLSL = () => `
#ifdef ${ZHUDA_UNDERWATER_DEFINE}
uniform vec4 u_ZhudaCaustics;
uniform vec4 u_ZhudaCausticsFade;
uniform vec4 u_ZhudaWaterSigma;
${waveGlsl()}
vec3 zhudaUnderwaterLight(vec3 p,vec3 dir){
float below=u_ZhudaCaustics.x-p.y;
if(below<=0.0||dir.y>-0.01)return vec3(1.0);
float along=below/-dir.y;
vec3 through=exp(-u_ZhudaWaterSigma.xyz*along);
if(u_ZhudaCaustics.y<=0.0)return through;
vec2 at=p.xz-dir.xz*along;
vec2 slope;vec3 curve;
zhudaUnderwaterWaves(at,u_ZhudaCausticsFade.z,slope,curve);
float f=along*${BEND.toFixed(2)};
float det=1.0+f*(curve.x+curve.y)+f*f*(curve.x*curve.y-curve.z*curve.z);
float gathered=min(6.0,1.0/max(abs(det),1.0/6.0));
float fade=exp(-below/u_ZhudaCausticsFade.x)*(1.0-smoothstep(u_ZhudaCausticsFade.y*0.5,u_ZhudaCausticsFade.y,distance(p,u_CameraPos)));
return through*mix(1.0,gathered,u_ZhudaCaustics.y*fade);
}
#endif
`;

const PBR_LIGHT =
  'Light light=getLight(directionLight);lightColor+=PBRLighting(surface,info,light)';
const PHONG_LIGHT =
  'Light light=getLight(directionLight);lightColor+=BlinnPhongLighting(surface,light,info)';

/** An include's text with the underwater light, or unchanged with the reason. Pure. */
export function zhudaPatchUnderwaterInclude(
  name: string,
  text: string,
): { text: string; reason?: string } {
  const at =
    name === 'PBRFrag.glsl' ? PBR_LIGHT : name === 'BlinnPhongFrag.glsl' ? PHONG_LIGHT : null;
  if (!at) return { text };
  if (text.split(at).length !== 2)
    return { text, reason: `${name} no longer holds the line the patch follows` };
  const position = name === 'PBRFrag.glsl' ? 'info.positionWS' : 'positionWS';
  const head = 'Light light=getLight(directionLight);';
  const patched = text.replace(
    at,
    `${head}\n#ifdef ${ZHUDA_UNDERWATER_DEFINE}\nlight.color*=zhudaUnderwaterLight(${position},light.dir);\n#endif\n${at.slice(head.length)}`,
  );
  // The function goes after the include's own includes, before its first function.
  const first = patched.indexOf('void getPixelInfo(');
  if (first < 0) return { text, reason: `${name} no longer defines getPixelInfo` };
  return { text: patched.slice(0, first) + LIGHT_GLSL() + patched.slice(first) };
}

interface State {
  includes: Set<string>;
  declared: boolean;
}
const states = new WeakMap<object, State>();

/**
 * Teaches LayaAir's PBR and Blinn-Phong lighting the underwater light. Must
 * run before `Laya.init` (`ZhudaEngine.boot` does it). Returns false when
 * there is no runtime to patch.
 */
export function installLaya342Underwater(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (states.has(shader)) return true;
  const state: State = { includes: new Set(), declared: false };
  states.set(shader, state);
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (typeof text === 'string' && (name === 'PBRFrag.glsl' || name === 'BlinnPhongFrag.glsl')) {
      const made = zhudaPatchUnderwaterInclude(name, text);
      if (!made.reason) {
        text = made.text;
        state.includes.add(name);
      }
    }
    return addInclude.call(this, name, text, ...rest);
  };
  declareAfterLaya(runtime, () => (state.declared = true));
  return true;
}

/**
 * The scene's three vectors, added to LayaAir's `Scene3D` uniforms after
 * LayaAir's own (see the same in `Foliage.ts`: before them, they would move
 * every member of WebGL 2's `Scene3D` block).
 */
function declareAfterLaya(l: any, done: () => void): void {
  const scene = l.Scene3D;
  const add = (map: any) => {
    if (typeof map?.addShaderUniform !== 'function') return;
    for (const name of ['u_ZhudaCaustics', 'u_ZhudaCausticsFade', 'u_ZhudaWaterSigma'])
      map.addShaderUniform(l.Shader3D.propertyNameToID(name), name, l.ShaderDataType.Vector4);
    done();
  };
  if (scene?.sceneUniformMap) return add(scene.sceneUniformMap);
  const init = scene?.shaderValueInit;
  if (typeof init !== 'function') return;
  scene.shaderValueInit = function (this: unknown, ...args: unknown[]) {
    scene.shaderValueInit = init;
    const result = init.apply(this, args);
    add(scene.sceneUniformMap);
    return result;
  };
}

/** Whether the underwater light reaches LayaAir's lit shaders in this runtime (after `Laya.init`). */
export function zhudaUnderwaterInstalled(runtime: any = (globalThis as any).Laya): {
  light: boolean;
  includes: string[];
} {
  const state = states.get(runtime?.Shader3D);
  if (!state) return { light: false, includes: [] };
  return {
    light: state.declared && state.includes.has('PBRFrag.glsl'),
    includes: [...state.includes],
  };
}

const VERTEX =
  '#define SHADER_NAME ZhudaUnderwaterVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
const FRAGMENT = `#define SHADER_NAME ZhudaUnderwaterFS
#include "Color.glsl";
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
varying vec2 v_Texcoord0;
void main(){
vec2 uv=v_Texcoord0;
vec4 source=texture2D(u_MainTex,uv);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
if(u_ZhudaUwForward.w<0.5){gl_FragColor=source;return;}
float eyeDepth=1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,uv).x+u_ZBufferParams.w);
vec2 ndc=uv*2.0-1.0;
ndc.y*=u_ZhudaUwRight.w;
vec3 ray=u_ZhudaUwForward.xyz+ndc.x*u_ZhudaUwRight.xyz+ndc.y*u_ZhudaUwUp.xyz;
float reach=eyeDepth*length(ray);
// Where nothing is drawn (the far plane's depth, or the backdrop just inside
// it) the water is counted to maxDistance, whatever the camera's far plane
// is: one length on both sides of the horizon. What lies farther is in the
// backdrop's colour.
bool open=eyeDepth>=u_ZBufferParams.y/u_ZBufferParams.w*0.94;
float t=open?u_ZhudaUwSigma.w:min(reach,u_ZhudaUwSigma.w);
vec3 dir=normalize(ray);
// Only the water between the eye and the surface: beyond it the view is in air.
if(dir.y>0.0001)t=min(t,(u_ZhudaUwEye.w-u_ZhudaUwEye.y)/dir.y);
vec3 through=exp(-u_ZhudaUwSigma.xyz*t);
vec3 scattered=u_ZhudaUwColor.rgb*exp(-u_ZhudaUwSigma.xyz*max(u_ZhudaUwEye.w-u_ZhudaUwEye.y,0.0));
gl_FragColor=vec4(source.rgb*through+scattered*(1.0-through),source.a);
}`;

const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const v4 = l.ShaderDataType.Vector4,
    texture = l.ShaderDataType.Texture2D;
  const shader = l.Shader3D.add('ZhudaUnderwater');
  shader.shaderType = l.ShaderFeatureType.PostProcess;
  const sub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    {
      u_MainTex: texture,
      u_ZhudaUwEye: v4,
      u_ZhudaUwForward: v4,
      u_ZhudaUwRight: v4,
      u_ZhudaUwUp: v4,
      u_ZhudaUwSigma: v4,
      u_ZhudaUwColor: v4,
    },
  );
  shader.addSubShader(sub);
  const pass = sub.addShaderPass(VERTEX, FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

/** The surface seen from below: the sky through the window, the water's colour beyond it. */
const UNDERSIDE = () => `${waveGlsl().replace(/u_ZhudaCaustics/g, 'u_ZhudaUwWave')}
vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){
vec2 slope;vec3 curve;
zhudaUnderwaterWaves(p.xz,u_ZhudaUwWave.y,slope,curve);
vec3 up=normalize(vec3(-slope.x,1.0,-slope.y));
vec3 v=normalize(p-u_CameraPos);
float cosI=max(dot(v,up),0.0);
float sinT2=1.7769*(1.0-cosI*cosI);
vec3 deep=u_ZhudaUwDeep.rgb;
if(sinT2>=1.0)return vec4(deep,1.0);
float cosT=sqrt(1.0-sinT2);
// Out into the air: the transmitted direction, and how much is reflected back (Schlick, from the water side).
vec3 outward=normalize(1.333*v+(cosT-1.333*cosI)*up);
float r0=0.02;
float reflected=r0+(1.0-r0)*pow(1.0-cosT,5.0);
vec3 sky=u_ZhudaUwSky.rgb*(0.55+0.45*outward.y);
float sun=pow(max(dot(outward,u_ZhudaUwSun.xyz),0.0),u_ZhudaUwSun.w);
vec3 seen=sky+u_ZhudaUwSunColor.rgb*sun;
return vec4(mix(seen,deep,reflected),1.0);
}`;

/**
 * What lies behind everything under water: a sphere round the eye, just
 * inside the camera's far plane. Level and below it is the water's own light
 * at the eye's depth, which is what any thickness of that water comes to.
 * Above level it is the still surface as the plane shows it (the plane ends
 * at `maxDistance`, and the camera's far plane cuts it sooner), seen through
 * the water that lies beyond the `maxDistance` the medium counts: so it runs
 * into the water's own light toward the horizon and meets the lower half
 * there without a step. Without it the sky, or the camera's clear colour,
 * stood behind the water, and clear water let it through: a line across the
 * frame at the plane's edge.
 *
 * The medium counts the same length of water on both sides of the horizon.
 * Counting all the water up to the surface above it and `maxDistance` below
 * it took the light fog's light away above the horizon only: a step there.
 */
const BACKDROP = `vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){
vec3 dir=normalize(p-u_CameraPos);
vec3 deep=u_ZhudaUwDeep.rgb;
float depth=max(u_ZhudaUwWave.x-u_CameraPos.y,0.0);
// The water's own light at the eye's depth: what any thickness of it comes to.
vec3 own=deep*exp(-u_ZhudaUwSigma.xyz*depth);
if(dir.y<=0.0001)return vec4(own,1.0);
float cosI=dir.y;
float sinT2=1.7769*(1.0-cosI*cosI);
vec3 seen=deep;
if(sinT2<1.0){
float cosT=sqrt(1.0-sinT2);
vec3 outward=normalize(1.333*dir+(cosT-1.333*cosI)*vec3(0.0,1.0,0.0));
float reflected=0.02+0.98*pow(1.0-cosT,5.0);
vec3 sky=u_ZhudaUwSky.rgb*(0.55+0.45*outward.y);
float sun=pow(max(dot(outward,u_ZhudaUwSun.xyz),0.0),u_ZhudaUwSun.w);
seen=mix(sky+u_ZhudaUwSunColor.rgb*sun,deep,reflected);
}
// The medium counts maxDistance (w) of water in front of this; the surface is
// farther along the view than that by \`beyond\`, and that much water is put
// into the colour here. Level with the eye the surface is endlessly far and
// the colour is the water's own, as it is below.
float beyond=max(depth/dir.y-u_ZhudaUwSigma.w,0.0);
return vec4(own+(seen-own)*exp(-u_ZhudaUwSigma.xyz*beyond),1.0);
}`;
/** The backdrop's radius as a share of the camera's far plane. */
const BACKDROP_REACH = 0.95;

/** One underwater medium: its post effect, the scene's lighting values and the surface from below. */
export class ZhudaUnderwater {
  /** The Laya post-process effect; the HDR chain takes it after the light fog. */
  readonly effect: any;
  private readonly material: any;
  private readonly scene: any;
  private resolved: ZhudaResolvedUnderwater;
  private readonly underside?: { node: any; mesh: any; shader: ZhudaShaderMaterial };
  private readonly backdrop?: { node: any; mesh: any; shader: ZhudaShaderMaterial };
  /** The camera's far plane, as last told or last seen by the effect. */
  private far = 4000;
  private readonly define: any;
  private seconds = 0;
  private disposed = false;

  /**
   * `scene3D`: the scene whose lit surfaces take the underwater light. `sky`
   * and `sun` (as light) light the window in the surface seen from below.
   */
  constructor(
    scene3D: any,
    options: ZhudaUnderwaterOptions = {},
    light: { sky?: V3; sun?: { toward: V3; color: V3 } } = {},
  ) {
    const l = (globalThis as any).Laya;
    if (!l?.MaterialPostProcessEffect) throw Error('Underwater needs the Laya post-process module');
    if (!scene3D?._shaderValues) throw Error('Underwater: pass a Laya Scene3D');
    this.resolved = resolveZhudaUnderwater(options);
    if (this.resolved.caustics && !zhudaUnderwaterInstalled(l).light)
      throw Error(
        'Underwater: the light is not installed (installLaya342Underwater before Laya.init)',
      );
    register(l);
    this.scene = scene3D;
    this.material = new l.Material();
    this.material.setShaderName('ZhudaUnderwater');
    const Base = l.MaterialPostProcessEffect as new () => any;
    this.effect = new Base();
    this.effect.material = this.material;
    this.define = l.Shader3D.getDefineByName(ZHUDA_UNDERWATER_DEFINE);
    scene3D._shaderValues.addDefine(this.define);
    if (this.resolved.surface) {
      const shader = new ZhudaShaderMaterial({
        schemaVersion: 1,
        name: 'ZhudaWaterUnderside',
        dimension: 3,
        surface: UNDERSIDE(),
        uniforms: {
          u_ZhudaUwWave: { type: 'vec4' },
          u_ZhudaUwDeep: { type: 'vec4' },
          u_ZhudaUwSky: { type: 'vec4' },
          u_ZhudaUwSun: { type: 'vec4' },
          u_ZhudaUwSunColor: { type: 'vec4' },
        },
        doubleSided: true,
        fog: false,
      });
      const size = this.resolved.maxDistance * 2;
      const mesh = l.PrimitiveMesh.createPlane(size, size, 96, 96);
      const node = new l.MeshSprite3D(mesh);
      node.name = 'zhuda-water-underside';
      node.meshRenderer.sharedMaterial = shader.material;
      node.meshRenderer.castShadow = false;
      node.meshRenderer.receiveShadow = false;
      node.layer = ZHUDA_UNDERWATER_LAYER;
      node.active = false;
      scene3D.addChild(node);
      this.underside = { node, mesh, shader };
      const round = new ZhudaShaderMaterial({
        schemaVersion: 1,
        name: 'ZhudaWaterBackdrop',
        dimension: 3,
        surface: BACKDROP,
        uniforms: {
          u_ZhudaUwWave: { type: 'vec4' },
          u_ZhudaUwDeep: { type: 'vec4' },
          u_ZhudaUwSigma: { type: 'vec4' },
          u_ZhudaUwSky: { type: 'vec4' },
          u_ZhudaUwSun: { type: 'vec4' },
          u_ZhudaUwSunColor: { type: 'vec4' },
        },
        doubleSided: true,
        fog: false,
      });
      const ball = l.PrimitiveMesh.createSphere(1, 24, 48);
      const behind = new l.MeshSprite3D(ball);
      behind.name = 'zhuda-water-backdrop';
      behind.meshRenderer.sharedMaterial = round.material;
      behind.meshRenderer.castShadow = false;
      behind.meshRenderer.receiveShadow = false;
      behind.layer = ZHUDA_UNDERWATER_LAYER;
      behind.active = false;
      scene3D.addChild(behind);
      this.backdrop = { node: behind, mesh: ball, shader: round };
      // The light of the window, for the plane and for what stands behind it.
      const sky = light.sky ?? [0.5, 0.65, 0.8];
      const sun = light.sun ?? { toward: [0.3, 0.9, 0.3], color: [3, 2.9, 2.7] };
      const length = Math.hypot(...sun.toward) || 1;
      for (const m of [shader.material, round.material]) {
        m.setVector4('u_ZhudaUwSky', new l.Vector4(sky[0], sky[1], sky[2], 1));
        m.setVector4(
          'u_ZhudaUwSun',
          new l.Vector4(
            sun.toward[0] / length,
            sun.toward[1] / length,
            sun.toward[2] / length,
            300,
          ),
        );
        m.setVector4(
          'u_ZhudaUwSunColor',
          new l.Vector4(sun.color[0], sun.color[1], sun.color[2], 1),
        );
      }
    }
    // The far plane of whichever camera draws the view, for the backdrop's size.
    const render = this.effect.render;
    if (typeof render === 'function') {
      const water = this;
      this.effect.render = function (context: any) {
        const far = context?.camera?.farPlane;
        if (Number.isFinite(far) && far > 0) water.far = far;
        return render.call(this, context);
      };
    }
    this.write(l);
    this.update(
      [0, this.resolved.surfaceY + 1, 0],
      [0, this.resolved.surfaceY + 1, -1],
      50,
      16 / 9,
    );
  }

  /** The values in use, with their defaults. */
  get options(): ZhudaResolvedUnderwater {
    return structuredClone(this.resolved);
  }

  /**
   * Changes the water in place (clearer, murkier, calmer): colour,
   * extinction, surface height, reach and the caustics' values. Whether there
   * are caustics and whether the surface is drawn are fixed at construction.
   */
  set(options: ZhudaUnderwaterOptions): void {
    if (this.disposed) throw Error('Disposed underwater');
    const next = resolveZhudaUnderwater({
      ...this.resolved,
      ...options,
      caustics:
        options.caustics === undefined
          ? this.resolved.caustics
          : options.caustics && this.resolved.caustics
            ? { ...this.resolved.caustics, ...options.caustics }
            : options.caustics,
    } as ZhudaUnderwaterOptions);
    if (!next.caustics !== !this.resolved.caustics || next.surface !== this.resolved.surface)
      throw Error('Underwater: caustics and surface are fixed at construction; build another');
    this.resolved = next;
    this.write((globalThis as any).Laya);
  }

  private write(l: any) {
    const r = this.resolved,
      c = r.caustics;
    const values = this.scene._shaderValues;
    const id = (name: string) => l.Shader3D.propertyNameToID(name);
    // New vectors each time: one changed in place is not uploaded on WebGPU.
    values.setVector(
      id('u_ZhudaCaustics'),
      new l.Vector4(r.surfaceY, c ? c.strength : 0, c ? c.waveMeters : 2.5, c ? c.waves : 1),
    );
    values.setVector(
      id('u_ZhudaCausticsFade'),
      new l.Vector4(c ? c.fadeDepth : 10, c ? c.fadeDistance : 40, this.seconds, 0),
    );
    values.setVector(id('u_ZhudaWaterSigma'), new l.Vector4(...r.extinction, 0));
    const m = this.material;
    m.setVector4('u_ZhudaUwSigma', new l.Vector4(...r.extinction, r.maxDistance));
    m.setVector4('u_ZhudaUwColor', new l.Vector4(...r.color, 0));
    if (this.underside) {
      const s = this.underside.shader.material;
      s.setVector4(
        'u_ZhudaUwWave',
        new l.Vector4(r.surfaceY, this.seconds, c ? c.waveMeters : 2.5, c ? c.waves : 1),
      );
      s.setVector4('u_ZhudaUwDeep', new l.Vector4(...r.color, 1));
    }
    if (this.backdrop) {
      const b = this.backdrop.shader.material;
      b.setVector4('u_ZhudaUwWave', new l.Vector4(r.surfaceY, this.seconds, 0, 0));
      b.setVector4('u_ZhudaUwDeep', new l.Vector4(...r.color, 1));
      b.setVector4('u_ZhudaUwSigma', new l.Vector4(...r.extinction, r.maxDistance));
    }
  }

  /** Where the waves are: seconds of a shot (a film) or of play (a game's clock). */
  setTime(seconds: number): void {
    if (this.disposed) return;
    if (!(Number.isFinite(seconds) && seconds >= 0)) throw Error('Underwater: a time in seconds');
    this.seconds = seconds;
    this.write((globalThis as any).Laya);
  }

  /**
   * The camera for the next frame (as `ZhudaLightFog.update`): the medium is
   * drawn while the eye is below the surface, and the surface seen from
   * below follows the eye. `farMeters` is the camera's far plane: what stands
   * behind the water is put just inside it. Left out, it is taken from the
   * camera that draws the effect, a frame late.
   */
  update(eye: V3, target: V3, fieldOfViewDeg: number, aspect: number, farMeters?: number): void {
    if (this.disposed) return;
    if (farMeters !== undefined) {
      if (!(Number.isFinite(farMeters) && farMeters > 0))
        throw Error('Underwater: farMeters is the camera far plane, above 0');
      this.far = farMeters;
    }
    const l = (globalThis as any).Laya;
    const r = this.resolved;
    const below = eye[1] < r.surfaceY;
    let forward = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(forward[0], forward[1], forward[2]) || 1;
    forward = forward.map((n) => n / fl);
    const vertical = Math.abs(forward[1]) > 0.999;
    const world = vertical ? [0, 0, 1] : [0, 1, 0];
    let right = [
      forward[1] * world[2] - forward[2] * world[1],
      forward[2] * world[0] - forward[0] * world[2],
      forward[0] * world[1] - forward[1] * world[0],
    ];
    const rl = Math.hypot(right[0], right[1], right[2]) || 1;
    right = right.map((n) => n / rl);
    const up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];
    const tan = Math.tan((fieldOfViewDeg * Math.PI) / 360);
    const m = this.material;
    m.setVector4('u_ZhudaUwEye', new l.Vector4(eye[0], eye[1], eye[2], r.surfaceY));
    m.setVector4(
      'u_ZhudaUwForward',
      new l.Vector4(forward[0], forward[1], forward[2], below ? 1 : 0),
    );
    m.setVector4(
      'u_ZhudaUwRight',
      new l.Vector4(right[0] * tan * aspect, right[1] * tan * aspect, right[2] * tan * aspect, 1),
    );
    // w: the surface is drawn from below, with the water behind it.
    m.setVector4(
      'u_ZhudaUwUp',
      new l.Vector4(up[0] * tan, up[1] * tan, up[2] * tan, this.underside ? 1 : 0),
    );
    if (this.underside) {
      const node = this.underside.node;
      node.active = below;
      if (below) node.transform.position = new l.Vector3(eye[0], r.surfaceY, eye[2]);
    }
    if (this.backdrop) {
      const node = this.backdrop.node;
      node.active = below;
      if (below) {
        // Round the eye, just inside the far plane: behind everything that is drawn.
        const radius = this.far * BACKDROP_REACH;
        node.transform.position = new l.Vector3(eye[0], eye[1], eye[2]);
        node.transform.localScale = new l.Vector3(radius, radius, radius);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.scene.destroyed) this.scene._shaderValues.removeDefine(this.define);
    if (this.underside) {
      if (!this.underside.node.destroyed) this.underside.node.destroy();
      this.underside.mesh.destroy();
      this.underside.shader.dispose();
    }
    if (this.backdrop) {
      if (!this.backdrop.node.destroyed) this.backdrop.node.destroy();
      this.backdrop.mesh.destroy();
      this.backdrop.shader.dispose();
    }
    this.material.destroy();
  }
}
