import { zhudaShaderRegistrar } from './ShaderRegistry.ts';
import { zhudaSrgbToLinear } from './Surfaces.ts';
/**
 * What a bright light does inside a lens: a glow round the light, a streak
 * through it, and ghosts (discs, rings, the shape of the aperture) strung
 * along the line from the light through the middle of the picture.
 *
 * The light must be seen to flare. Before anything is drawn, a few points
 * round the light are looked up in the depth picture, and the flare is as
 * strong as the share of them that nothing stands in front of: it fades as
 * the sun goes behind a roof and is gone behind a wall. LayaAir 3.4.2's own
 * `LensFlareEffect` draws through everything, and needs pictures; the shapes
 * here are drawn by arithmetic, so a flare needs no assets.
 *
 * One effect for `sceneEffects` (it adds light to the scene, so bloom and
 * the tone curve treat it like any other light): a copy of the picture, a
 * one-pixel pass for what is seen, and a small quad for each element. It
 * does not know about clouds or fog drawn after the scene (they are not in
 * the depth picture): lower `strength` under an overcast sky. Only the
 * class needs the Laya runtime.
 */

export type ZhudaLensFlareShape = 'glow' | 'disc' | 'ring' | 'polygon';
export interface ZhudaLensFlareElement {
  /**
   * `glow`: brightest in the middle, fading to nothing at the rim (wide and
   * low, it is a streak). `disc`: evenly bright. `ring`: the rim of a disc.
   * `polygon`: a disc with straight sides, the shape of an aperture.
   */
  shape: ZhudaLensFlareShape;
  /**
   * Where along the line from the light through the middle of the picture,
   * -1..3: 0 on the light, 1 in the middle, 2 as far beyond the middle as
   * the light is before it.
   */
  at: number;
  /** How wide across, as a share of the picture's height, 0.005..3. */
  size: number;
  /**
   * Width over height, 0.02..50 (default 1): its height is `size` over
   * this. A streak is a glow many times wider than high.
   */
  stretch?: number;
  /** Display RGB 0..1. */
  color: readonly [number, number, number];
  /** Brightness where it is brightest, as a multiple of white, 0..64 (default 1). */
  strength?: number;
  /** Degrees it is turned by (default 0). */
  rotationDeg?: number;
  /** Turn with the line toward the middle of the picture (default false). */
  follow?: boolean;
  /** `polygon`: sides, 3..12 (default 6). */
  sides?: number;
  /** `disc`, `ring`, `polygon`: how soft the rim is, 0..1 (default 0.15). */
  softness?: number;
  /** `ring`: its width as a share of the radius, 0.02..1 (default 0.12). */
  width?: number;
}
export interface ZhudaLensFlareOptions {
  /** One to twelve elements (default `ZHUDA_LENS_FLARE_SUN`). */
  elements?: readonly ZhudaLensFlareElement[];
  /** Scales every element, 0..16 (default 1). */
  strength?: number;
  /**
   * The radius round the light that is looked up in the depth picture, as a
   * share of the picture's height, 0.002..0.1 (default 0.012): the flare
   * fades over this distance as the light passes behind an edge.
   */
  occlusionRadius?: number;
}
/** Where the light is: a direction toward it (the sun) or a point in the scene (a lamp). */
export interface ZhudaLensFlareLight {
  /** Toward the light, from anywhere in the scene. Either this or `position`. */
  toward?: readonly [number, number, number];
  position?: readonly [number, number, number];
  /** The light's colour as light (not a display colour), multiplied into every element (default white). */
  color?: readonly [number, number, number];
}

/** A flare for a low sun: a glow, a streak across, and five ghosts down the line. */
export const ZHUDA_LENS_FLARE_SUN: readonly ZhudaLensFlareElement[] = [
  { shape: 'glow', at: 0, size: 0.55, color: [1, 0.86, 0.66], strength: 0.9 },
  { shape: 'glow', at: 0, size: 1.6, stretch: 14, color: [0.75, 0.85, 1], strength: 0.5 },
  { shape: 'ring', at: 0, size: 0.34, color: [1, 0.72, 0.45], strength: 0.12, width: 0.08 },
  { shape: 'polygon', at: 0.45, size: 0.07, color: [0.55, 0.85, 0.6], strength: 0.1 },
  { shape: 'disc', at: 0.8, size: 0.035, color: [1, 0.8, 0.55], strength: 0.14 },
  { shape: 'polygon', at: 1.3, size: 0.13, color: [0.55, 0.7, 1], strength: 0.07 },
  { shape: 'ring', at: 1.75, size: 0.22, color: [0.9, 0.6, 0.85], strength: 0.06, width: 0.2 },
  { shape: 'disc', at: 2.1, size: 0.3, color: [0.6, 0.9, 0.8], strength: 0.035, softness: 0.5 },
];

const SHAPES: readonly ZhudaLensFlareShape[] = ['glow', 'disc', 'ring', 'polygon'];
const MAX_ELEMENTS = 12;
const number = (value: unknown, low: number, high: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const triple = (value: unknown, low: number, high: number) =>
  Array.isArray(value) && value.length === 3 && value.every((v) => number(v, low, high));

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaLensFlare(options: ZhudaLensFlareOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  if (o.strength !== undefined && !number(o.strength, 0, 16)) issues.push('strength: use 0..16');
  if (o.occlusionRadius !== undefined && !number(o.occlusionRadius, 0.002, 0.1))
    issues.push('occlusionRadius: use 0.002..0.1');
  if (o.elements === undefined) return issues;
  if (!Array.isArray(o.elements) || o.elements.length < 1 || o.elements.length > MAX_ELEMENTS)
    return [...issues, `elements: one to ${MAX_ELEMENTS}`];
  o.elements.forEach((element: unknown, i: number) => {
    const at = `elements[${i}]`;
    if (!element || typeof element !== 'object') return issues.push(`${at}: object expected`);
    const e = element as Record<string, unknown>;
    const known = [
      'shape',
      'at',
      'size',
      'stretch',
      'color',
      'strength',
      'rotationDeg',
      'follow',
      'sides',
      'softness',
      'width',
    ];
    for (const key of Object.keys(e))
      if (!known.includes(key)) issues.push(`${at}.${key}: not a field of an element`);
    if (!SHAPES.includes(e.shape as ZhudaLensFlareShape))
      issues.push(`${at}.shape: use ${SHAPES.join(', ')}`);
    if (!number(e.at, -1, 3)) issues.push(`${at}.at: use -1..3`);
    if (!number(e.size, 0.005, 3)) issues.push(`${at}.size: use 0.005..3`);
    if (!triple(e.color, 0, 1)) issues.push(`${at}.color: three numbers 0..1`);
    const optional: [string, number, number][] = [
      ['stretch', 0.02, 50],
      ['strength', 0, 64],
      ['rotationDeg', -360, 360],
      ['softness', 0, 1],
      ['width', 0.02, 1],
    ];
    for (const [key, low, high] of optional)
      if (e[key] !== undefined && !number(e[key], low, high))
        issues.push(`${at}.${key}: use ${low}..${high}`);
    if (e.sides !== undefined && !(Number.isInteger(e.sides) && number(e.sides, 3, 12)))
      issues.push(`${at}.sides: use a whole number 3..12`);
    if (e.follow !== undefined && typeof e.follow !== 'boolean')
      issues.push(`${at}.follow: use true or false`);
  });
  return issues;
}

/**
 * How much of a flare is left for a light at this place in the picture
 * (`x` and `y` are -1..1 across it): all of it inside the frame, none of it
 * a third of the frame outside, and nothing for a light behind the camera.
 */
export function zhudaLensFlareEdgeFade(x: number, y: number): number {
  const out = Math.max(Math.abs(x), Math.abs(y));
  return Math.min(1, Math.max(0, 1 - (out - 1) / 0.3));
}

/**
 * Where an element is and how it is turned, for a light at `light` (both in
 * picture coordinates, 0..1 from the bottom left): its middle, and the
 * angle in radians. `aspect` is the picture's width over its height.
 */
export function zhudaLensFlarePlace(
  element: ZhudaLensFlareElement,
  light: readonly [number, number],
  aspect: number,
): { middle: [number, number]; angle: number } {
  const middle: [number, number] = [
    light[0] + (0.5 - light[0]) * element.at,
    light[1] + (0.5 - light[1]) * element.at,
  ];
  let angle = ((element.rotationDeg ?? 0) * Math.PI) / 180;
  // The line as it lies on the screen, where a step across is `aspect` steps up.
  if (element.follow) angle += Math.atan2(0.5 - light[1], (0.5 - light[0]) * aspect);
  return { middle, angle };
}

// How much of the light is seen: sixteen points on a spiral round it, each
// counted when nothing in the depth picture is nearer than the light.
const SEEN = `#define SHADER_NAME ZhudaLensFlareSeenFS
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
varying vec2 v_Texcoord0;
void main(){
float near=1.0/u_ZBufferParams.w;float far=u_ZBufferParams.y/u_ZBufferParams.w;
float seen=0.0;
for(int i=0;i<16;i++){
float k=float(i)+0.5;
float turn=k*2.39996323;
vec2 at=u_ZhudaFlareLight.xy+sqrt(k/16.0)*vec2(cos(turn),sin(turn))*u_ZhudaFlareLight.zw;
float raw=texture2DLodEXT(u_CameraDepthTexture,clamp(at,0.0,1.0),0.0).x;
float depth=u_ZhudaFlareDepth.y>0.5?near+raw*(far-near):1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w);
// Outside the frame nothing is known to be in the way.
float inside=step(0.0,at.x)*step(at.x,1.0)*step(0.0,at.y)*step(at.y,1.0);
seen+=mix(1.0,step(u_ZhudaFlareDepth.x,depth),inside);
}
gl_FragColor=vec4(vec3(seen/16.0),1.0);
}`;
const COPY = `#define SHADER_NAME ZhudaLensFlareCopyFS
#include "Color.glsl";
varying vec2 v_Texcoord0;
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
gl_FragColor=source;
}`;
const BLIT_VERTEX = (name: string) =>
  `#define SHADER_NAME ${name}\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}`;
// u_ZhudaFlareRect: the element's middle in the picture (x, y, 0..1) and half its size (z across, w up).
// u_ZhudaFlareTurn: cosine and sine of its angle, then the picture's width over its height.
// The corners of the screen quad say which way the picture's coordinates run on this target.
const ELEMENT_VERTEX = `#define SHADER_NAME ZhudaLensFlareElementVS
varying vec2 v_ZhudaFlareLocal;
void main(){
vec2 corner=a_PositionTexcoord.zw*2.0-1.0;
vec2 way=sign(a_PositionTexcoord.xy)*sign(corner);
v_ZhudaFlareLocal=corner;
vec2 across=corner*u_ZhudaFlareRect.zw;
// Turned on the screen, where a step across is as long as a step up times the aspect.
vec2 onScreen=vec2(across.x*u_ZhudaFlareTurn.z,across.y);
onScreen=vec2(onScreen.x*u_ZhudaFlareTurn.x-onScreen.y*u_ZhudaFlareTurn.y,onScreen.x*u_ZhudaFlareTurn.y+onScreen.y*u_ZhudaFlareTurn.x);
vec2 uv=u_ZhudaFlareRect.xy+vec2(onScreen.x/u_ZhudaFlareTurn.z,onScreen.y);
gl_Position=vec4(way*(uv*2.0-1.0),0.0,1.0);
}`;
// u_ZhudaFlareShape: the kind (0 glow, 1 disc, 2 ring, 3 polygon), softness, ring width, sides.
// u_ZhudaFlareColor: the light it adds where it is brightest.
const ELEMENT_FRAGMENT = `#define SHADER_NAME ZhudaLensFlareElementFS
varying vec2 v_ZhudaFlareLocal;
void main(){
// The one-pixel picture of how much of the light is seen.
float seen=texture2D(u_MainTex,vec2(0.5)).r;
vec2 q=v_ZhudaFlareLocal;
float r=length(q);
float kind=u_ZhudaFlareShape.x;
float soft=max(u_ZhudaFlareShape.y,0.002);
float value;
if(kind<0.5){
float t=clamp(1.0-r,0.0,1.0);
value=t*t*t;
}else{
float rim=r;
if(kind>2.5){
float part=6.2831853/u_ZhudaFlareShape.w;
rim=r*cos(mod(atan(q.y,q.x),part)-0.5*part)/cos(0.5*part);
}
value=1.0-smoothstep(1.0-soft,1.0,rim);
if(kind>1.5&&kind<2.5)value*=smoothstep(1.0-u_ZhudaFlareShape.z-soft,1.0-u_ZhudaFlareShape.z,rim);
}
gl_FragColor=vec4(u_ZhudaFlareColor.rgb*(value*seen),0.0);
}`;

const NAMES = ['ZhudaLensFlareSeen', 'ZhudaLensFlareCopy', 'ZhudaLensFlareElement'] as const;
const registered = new WeakSet<object>();
function register(l: any) {
  if (registered.has(l.Shader3D)) return;
  const add = (
    name: string,
    vertex: string,
    fragment: string,
    uniforms: Record<string, unknown>,
    additive = false,
  ) => {
    const shader = l.Shader3D.add(name);
    shader.shaderType = l.ShaderFeatureType.PostProcess;
    const sub = new l.SubShader(
      { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
      { u_MainTex: l.ShaderDataType.Texture2D, ...uniforms },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(vertex, fragment);
    pass.statefirst = true;
    pass.renderState.cull = l.RenderState.CULL_NONE;
    pass.renderState.depthTest = l.RenderState.DEPTHTEST_ALWAYS;
    pass.renderState.depthWrite = false;
    if (additive) {
      pass.renderState.blend = l.RenderState.BLEND_ENABLE_ALL;
      pass.renderState.srcBlend = l.RenderState.BLENDPARAM_ONE;
      pass.renderState.dstBlend = l.RenderState.BLENDPARAM_ONE;
    }
  };
  add(NAMES[0], BLIT_VERTEX(NAMES[0] + 'VS'), SEEN, {
    u_ZhudaFlareLight: l.ShaderDataType.Vector4,
    u_ZhudaFlareDepth: l.ShaderDataType.Vector4,
  });
  add(NAMES[1], BLIT_VERTEX(NAMES[1] + 'VS'), COPY, {});
  add(
    NAMES[2],
    ELEMENT_VERTEX,
    ELEMENT_FRAGMENT,
    {
      u_ZhudaFlareRect: l.ShaderDataType.Vector4,
      u_ZhudaFlareTurn: l.ShaderDataType.Vector4,
      u_ZhudaFlareShape: l.ShaderDataType.Vector4,
      u_ZhudaFlareColor: l.ShaderDataType.Vector4,
    },
    true,
  );
  registered.add(l.Shader3D);
}
zhudaShaderRegistrar(register);

export class ZhudaLensFlare {
  /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `sceneEffects`, last. */
  readonly effect: any;
  private readonly seen: any;
  private readonly copy: any;
  private elements: { spec: ZhudaLensFlareElement; material: any }[] = [];
  private strength: number;
  private radius: number;
  private light: Required<ZhudaLensFlareLight> | undefined;
  private disposed = false;

  constructor(options: ZhudaLensFlareOptions = {}) {
    const issues = validateZhudaLensFlare(options);
    if (issues.length) throw Error('Invalid lens flare: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PostProcessEffect) throw Error('A lens flare needs the Laya post-process module');
    register(l);
    this.strength = options.strength ?? 1;
    this.radius = options.occlusionRadius ?? 0.012;
    const material = (name: string) => {
      const m = new l.Material();
      m.setShaderName(name);
      return m;
    };
    this.seen = material(NAMES[0]);
    this.copy = material(NAMES[1]);
    this.build(options.elements ?? ZHUDA_LENS_FLARE_SUN);
    const owner = this;
    const forward = new l.Vector3();
    const Base = l.PostProcessEffect as new () => any;
    this.effect = new (class extends Base {
      getCameraDepthTextureModeFlag() {
        return l.DepthTextureMode.Depth;
      }
      render(context: any) {
        const source = context.indirectTarget,
          command = context.command,
          camera = context.camera;
        camera.depthTextureMode |= l.DepthTextureMode.Depth;
        const blit = (from: any, to: any, m: any) =>
          command.blitScreenQuad(from, to, null, m.shader, m.shaderData, 0);
        blit(source, context.destination, owner.copy);
        const light = owner.light;
        if (!light || owner.strength === 0 || !camera.depthTexture) return;
        // Where the light is in the picture, and how far in front of the eye.
        const e = camera.projectionViewMatrix.elements;
        const eye = camera.transform.position;
        const sun = !!light.toward;
        const p = sun
          ? [
              eye.x + light.toward[0] * camera.farPlane * 0.5,
              eye.y + light.toward[1] * camera.farPlane * 0.5,
              eye.z + light.toward[2] * camera.farPlane * 0.5,
            ]
          : light.position;
        const clip = [0, 1, 3].map(
          (i) => e[i] * p[0] + e[4 + i] * p[1] + e[8 + i] * p[2] + e[12 + i],
        );
        if (clip[2] <= 1e-6) return;
        // How far in front of the eye the light is, whatever the view (a lens or flat).
        camera.transform.getForward(forward);
        const ahead =
          ((p[0] - eye.x) * forward.x + (p[1] - eye.y) * forward.y + (p[2] - eye.z) * forward.z) /
          Math.hypot(forward.x, forward.y, forward.z);
        if (ahead <= 0) return;
        const x = clip[0] / clip[2],
          y = clip[1] / clip[2];
        const fade = zhudaLensFlareEdgeFade(x, y);
        if (fade === 0) return;
        const at: [number, number] = [x / 2 + 0.5, y / 2 + 0.5];
        const aspect = source.width / source.height;
        const flat = camera.projectionMatrix.elements[15] > 0.5;
        owner.seen.setVector4(
          'u_ZhudaFlareLight',
          new l.Vector4(at[0], at[1], owner.radius / aspect, owner.radius),
        );
        // The sun is behind everything but the sky; a lamp is in front of what is farther than it.
        owner.seen.setVector4(
          'u_ZhudaFlareDepth',
          new l.Vector4(sun ? camera.farPlane * 0.999 : ahead * 0.995 - 0.02, flat ? 1 : 0, 0, 0),
        );
        const seen = l.RenderTexture.createFromPool(
          1,
          1,
          l.RenderTargetFormat.R8G8B8A8,
          l.RenderTargetFormat.None,
          false,
          1,
        );
        context.deferredReleaseTextures.push(seen);
        blit(source, seen, owner.seen);
        for (const { spec, material: m } of owner.elements) {
          const place = zhudaLensFlarePlace(spec, at, aspect);
          const half = spec.size / 2;
          m.setVector4(
            'u_ZhudaFlareRect',
            new l.Vector4(
              place.middle[0],
              place.middle[1],
              half / aspect,
              half / (spec.stretch ?? 1),
            ),
          );
          m.setVector4(
            'u_ZhudaFlareTurn',
            new l.Vector4(Math.cos(place.angle), Math.sin(place.angle), aspect, 0),
          );
          const colour = spec.color.map(
            (v, k) =>
              zhudaSrgbToLinear(v) * light.color[k] * (spec.strength ?? 1) * owner.strength * fade,
          );
          m.setVector4('u_ZhudaFlareColor', new l.Vector4(colour[0], colour[1], colour[2], 0));
          blit(seen, context.destination, m);
        }
      }
    })();
  }

  private build(elements: readonly ZhudaLensFlareElement[]) {
    const l = (globalThis as any).Laya;
    for (const { material } of this.elements) material.destroy();
    this.elements = elements.map((spec) => {
      // A material an element: each draw keeps its own values until the frame is drawn.
      const material = new l.Material();
      material.setShaderName(NAMES[2]);
      material.setVector4(
        'u_ZhudaFlareShape',
        new l.Vector4(
          SHAPES.indexOf(spec.shape),
          spec.softness ?? 0.15,
          spec.width ?? 0.12,
          spec.sides ?? 6,
        ),
      );
      return { spec: { ...spec }, material };
    });
  }

  /** Where the light is and what colour; `null` puts the flare out. Call it when the light moves. */
  setLight(light: ZhudaLensFlareLight | null): void {
    if (this.disposed) throw Error('Disposed lens flare');
    if (light === null) {
      this.light = undefined;
      return;
    }
    const given = [light.toward, light.position].filter((v) => v !== undefined);
    if (given.length !== 1 || !triple(given[0], -1e9, 1e9))
      throw Error('Invalid lens flare light: give toward or position, three numbers');
    if (light.color !== undefined && !triple(light.color, 0, 1048576))
      throw Error('Invalid lens flare light: color: three numbers, 0 or more');
    let toward = light.toward;
    if (toward) {
      const length = Math.hypot(toward[0], toward[1], toward[2]);
      if (length < 1e-9) throw Error('Invalid lens flare light: toward has no direction');
      toward = [toward[0] / length, toward[1] / length, toward[2] / length];
    }
    this.light = {
      toward: toward as any,
      position: light.position as any,
      color: light.color ?? [1, 1, 1],
    };
  }

  /** New strength, radius or elements in place; the same limits as the options. */
  set(options: ZhudaLensFlareOptions): void {
    if (this.disposed) throw Error('Disposed lens flare');
    const issues = validateZhudaLensFlare(options);
    if (issues.length) throw Error('Invalid lens flare: ' + issues.join('; '));
    if (options.strength !== undefined) this.strength = options.strength;
    if (options.occlusionRadius !== undefined) this.radius = options.occlusionRadius;
    if (options.elements !== undefined) this.build(options.elements);
  }

  /** Call after the effect has been removed from its post-process chain. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.seen.destroy();
    this.copy.destroy();
    for (const { material } of this.elements) material.destroy();
    this.elements = [];
  }
}
