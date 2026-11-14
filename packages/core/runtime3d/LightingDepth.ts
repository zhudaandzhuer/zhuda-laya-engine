/**
 * What LayaAir 3.4.2's lights and shadows cannot be told:
 *
 * - **Falloff by the square of the distance.** LayaAir's lamp is as bright
 *   at its middle whatever its range. With `falloff: 'physical'` a lamp's
 *   `intensity` is its brightness at one metre, a quarter of it at two, and
 *   it is brought to nothing at its range.
 * - **A spot's penumbra**, a light at a time: how much of the cone is soft.
 * - **How wide the sun's soft shadow is**, in multiples of LayaAir's.
 * - **Cascades that meet without a line**: near the end of a cascade pixels
 *   take the next one more and more often, and past the last one the shadow
 *   fades out instead of stopping.
 * - **Contact shadows**: the last centimetres under a thin thing, which the
 *   shadow map is too coarse to hold, shaded by a short march toward the sun
 *   through the depth picture. Only the sun's light is shaded.
 *
 * LayaAir's lighting and shadow includes are changed as text before
 * `Laya.init` (`installLaya342LightingDepth`; `ZhudaEngine.boot` does it),
 * as point shadows are. Each change compiles to LayaAir's own arithmetic
 * unless a scene switches it on, which `ZhudaLightingDepth` does.
 *
 * Nothing is added to the scene's uniforms (LayaAir fixes the layout of
 * their block, and another member moves the rest) or to its textures (a
 * WebGPU stage has 16 samplers): the width and the reach travel in the two
 * numbers of `u_ShadowParams` that LayaAir leaves unused, and a spot's
 * penumbra in the unused fourth texel of its row in the light buffer.
 */

/** The scene defines the patched includes look at. */
export const ZHUDA_LIGHT_DEFINES = {
  inverseSquare: 'ZHUDA_LIGHT_INVERSE_SQUARE',
  spotPenumbra: 'ZHUDA_SPOT_PENUMBRA',
  cascadeBlend: 'ZHUDA_CASCADE_BLEND',
  shadowSpread: 'ZHUDA_SHADOW_SPREAD',
  contactShadow: 'ZHUDA_CONTACT_SHADOW',
} as const;

export interface ZhudaLightingDepthOptions {
  /**
   * `laya` (default): LayaAir's own falloff, 1 at the lamp whatever its
   * range. `physical`: by the square of the distance in scene units; a
   * lamp's `intensity` is then its brightness at one unit.
   */
  falloff?: 'laya' | 'physical';
  /**
   * How wide the sun's soft shadow is, 1..4 times LayaAir's (default 1, which
   * is LayaAir's own filter). Above 1 the edge is sixteen reads on a turned
   * disc: wider, and a fine grain. For soft shadows (`ShadowMode.SoftHigh`).
   */
  shadowSpread?: number;
  /** Blend from one cascade into the next, and fade the shadow out past the last (default false). */
  cascadeBlend?: boolean;
  /**
   * How far toward the sun a point looks for something in its way, in scene
   * units, 0.02..2; 0 or left out: no contact shadows. Needs the camera's
   * depth picture (the camera given to the constructor is asked for it) and
   * the sun's shadows on.
   */
  contactShadows?: number;
}

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaLightingDepth(options: ZhudaLightingDepthOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  if (o.falloff !== undefined && o.falloff !== 'laya' && o.falloff !== 'physical')
    issues.push('falloff: use laya or physical');
  const number = (key: string, low: number, high: number, zero = false) => {
    const value = o[key];
    if (value === undefined || (zero && value === 0)) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
      issues.push(`${key}: use ${zero ? '0 or ' : ''}${low}..${high}`);
  };
  number('shadowSpread', 1, 4);
  number('contactShadows', 0.02, 2, true);
  if (o.cascadeBlend !== undefined && typeof o.cascadeBlend !== 'boolean')
    issues.push('cascadeBlend: use true or false');
  return issues;
}

/**
 * How bright a lamp is at `distance` as a share of its `intensity`, with
 * LayaAir's falloff: 1 at the lamp, nothing from its range on. The shader's
 * arithmetic.
 */
export function zhudaLayaFalloff(distance: number, range: number): number {
  const ratio = Math.min(1, Math.max(0, distance / range)) ** 2;
  return (1 / (1 + 25 * ratio)) * Math.min(1, Math.max(0, 4 * (1 - ratio)));
}

/**
 * The same with `falloff: 'physical'`: 1 at one unit, a quarter at two,
 * brought to nothing at the range by a window that leaves the first half of
 * the range almost as the square says (0.88 of it at half the range).
 */
export function zhudaPhysicalFalloff(distance: number, range: number): number {
  const ratio = Math.min(1, Math.max(0, distance / range)) ** 2;
  const window = Math.min(1, Math.max(0, 1 - ratio * ratio));
  return (window * window) / Math.max(distance * distance, 0.0001);
}

/**
 * How bright a spot is at an angle from its axis, as a share of its middle
 * (before LayaAir's own cosine): 1 inside the inner cone, 0 outside the
 * cone, a smooth step between. `penumbra` 0..1 is the share of the cone's
 * half-angle that is soft; LayaAir's own is 0.5.
 */
export function zhudaSpotCone(angleDeg: number, coneDeg: number, penumbra = 0.5): number {
  const outer = Math.cos(((coneDeg / 2) * Math.PI) / 180),
    inner = Math.cos(((coneDeg / 2) * (1 - Math.min(1, Math.max(0.02, penumbra))) * Math.PI) / 180);
  const t = Math.min(
    1,
    Math.max(0, (Math.cos((angleDeg * Math.PI) / 180) - outer) / (inner - outer)),
  );
  return t * t * (3 - 2 * t);
}

// --- The text that is changed ------------------------------------------------
// Each pair is LayaAir's text and what takes its place. `#ifdef` starts a
// line of its own, and there is no `#else`: LayaAir's shader preprocessor
// drops that branch.
const D = ZHUDA_LIGHT_DEFINES;
const LIGHTING: readonly (readonly [string, string])[] = [
  // Falloff by the square of the distance, brought to nothing at the range.
  [
    'fRatio*=fRatio;return 1.0/(1.0+25.0*fRatio)*clamp(4.0*(1.0-fRatio),0.0,1.0);}',
    `fRatio*=fRatio;float zhudaFall=1.0/(1.0+25.0*fRatio)*clamp(4.0*(1.0-fRatio),0.0,1.0);
#ifdef ${D.inverseSquare}
float zhudaWindow=clamp(1.0-fRatio*fRatio,0.0,1.0);zhudaFall=zhudaWindow*zhudaWindow/max(dot(L,L),0.0001);
#endif
return zhudaFall;}`,
  ],
  // A spot's penumbra travels with the light.
  [
    'struct SpotLight{vec3 color;vec3 position;float range;vec3 direction;float spot;float attenuation;int lightMode;};',
    'struct SpotLight{vec3 color;vec3 position;float range;vec3 direction;float spot;float attenuation;int lightMode;float zhudaPenumbra;};',
  ],
  [
    'vec2 cosAngles=cos(vec2(spotLight.spot,spotLight.spot*0.5)*0.5);',
    `vec2 cosAngles=cos(vec2(spotLight.spot,spotLight.spot*0.5)*0.5);
#ifdef ${D.spotPenumbra}
cosAngles.y=cos(spotLight.spot*0.5*(1.0-clamp(spotLight.zhudaPenumbra,0.02,1.0)));
#endif
`,
  ],
  ['light.spot=u_SpotLightSpot;', 'light.spot=u_SpotLightSpot;light.zhudaPenumbra=0.5;'],
  // The fourth texel of the light's row: its penumbra and one, or nothing (LayaAir's half).
  [
    'light.direction=p3.rgb;light.attenuation=1.0;light.lightMode=getAttenuationByMode(p3.a);',
    `light.direction=p3.rgb;light.attenuation=1.0;light.lightMode=getAttenuationByMode(p3.a);light.zhudaPenumbra=0.5;
#ifdef ${D.spotPenumbra}
#ifdef GRAPHICS_API_GLES3
float zhudaKept=texelFetch(u_LightBuffer,ivec2(3,spotIndex),0).x;
#endif
#ifndef GRAPHICS_API_GLES3
float zhudaKept=texture2DLodEXT(u_LightBuffer,vec2(0.875,(float(spotIndex)+0.5)/float(CalculateLightCount)),0.0).x;
#endif
if(zhudaKept>0.5){light.zhudaPenumbra=zhudaKept-1.0;}
#endif
`,
  ],
  // The sun's light is also shaded by what the depth picture shows in its way.
  [
    'float shadowAttenuation=sampleShadowmap(shadowCoord);light.attenuation=shadowAttenuation;}',
    `float shadowAttenuation=sampleShadowmap(shadowCoord);light.attenuation=shadowAttenuation;
#ifdef ${D.contactShadow}
light.attenuation=min(light.attenuation,zhudaContactShadow(positionWS,light.direction));
#endif
}`,
  ],
];
// Eight steps toward the sun from the lit point. Each is placed in the
// picture and compared with the depth there: something is in the way when
// the picture is nearer than the step, by less than a thing is thick.
// Whether the picture is drawn upside down (into a texture, on one backend)
// is read off the point's own pixel.
const CONTACT = `
#if defined(${D.contactShadow})&&defined(CALCULATE_SHADOWS)
float zhudaContactShadow(vec3 positionWS,vec3 travel){
float reach=u_ShadowParams.w;
if(reach<=0.0){return 1.0;}
vec3 toward=-normalize(travel);
vec4 own=u_ViewProjection*vec4(positionWS,1.0);
vec2 ownUv=own.xy/own.w*0.5+0.5;
vec2 frag=gl_FragCoord.xy/u_Viewport.zw;
float turned=step(abs(1.0-ownUv.y-frag.y)+0.0005,abs(ownUv.y-frag.y));
float level=step(0.5,u_Projection[3][3]);
float near=1.0/u_ZBufferParams.w;float far=u_ZBufferParams.y/u_ZBufferParams.w;
float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
float shade=0.0;
for(int i=0;i<8;i++){
float t=(float(i)+0.5+noise)/8.5;
vec3 at=positionWS+toward*(reach*t);
vec4 clip=u_ViewProjection*vec4(at,1.0);
vec2 uv=clip.xy/clip.w*0.5+0.5;
uv.y=mix(uv.y,1.0-uv.y,turned);
float ray=abs((u_View*vec4(at,1.0)).z);
float raw=texture2DLodEXT(u_CameraDepthTexture,uv,0.0).x;
float scene=mix(1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w),near+raw*(far-near),level);
float gap=ray-scene;
float inside=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
shade=max(shade,inside*step(0.02*reach+0.0015*ray,gap)*step(gap,0.5*reach+0.01*ray));
}
return 1.0-shade;
}
#endif
`;
const CONTACT_BEFORE = 'Light getLight(in DirectionLight directionLight){';
const SHADOWS: readonly (readonly [string, string])[] = [
  // Near the end of a cascade a pixel takes the next one more and more
  // often (and after the last, no shadow): the line between two becomes a
  // band of both.
  [
    'mediump int cascadeIndex=computeCascadeIndex(positionWS);if(cascadeIndex>=4){return vec4(0.0,0.0,-1.0,1.0);}',
    `mediump int cascadeIndex=computeCascadeIndex(positionWS);if(cascadeIndex>=4){return vec4(0.0,0.0,-1.0,1.0);}
#ifdef ${D.cascadeBlend}
vec3 zhudaFrom=positionWS-u_ShadowSplitSpheres[cascadeIndex].xyz;
float zhudaOut=dot(zhudaFrom,zhudaFrom)/max(u_ShadowSplitSpheres[cascadeIndex].w,0.0001);
float zhudaPick=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
if(zhudaPick<smoothstep(0.72,1.0,zhudaOut)){
if(cascadeIndex>=3){return vec4(0.0,0.0,-1.0,1.0);}
cascadeIndex+=1;
if(u_ShadowSplitSpheres[cascadeIndex].w<=0.0){return vec4(0.0,0.0,-1.0,1.0);}
}
#endif
`,
  ],
  // A wider soft edge. LayaAir's filter weighs nine reads laid out for the
  // map's own texels, and stretched over more it shows steps; here sixteen
  // reads lie on a disc that is turned differently in every pixel, so a wide
  // edge is a fine grain and never a staircase.
  [
    'shadowCoord.xy=clamp(shadowCoord.xy,(tileMin+guard)*shadowCoord.w,',
    'guard*=max(u_ShadowParams.z,1.0);shadowCoord.xy=clamp(shadowCoord.xy,(tileMin+guard)*shadowCoord.w,',
  ],
  [
    'attenuation=sampleShdowMapFiltered9(coord,shadowmapSize);',
    `
#ifndef ${D.shadowSpread}
attenuation=sampleShdowMapFiltered9(coord,shadowmapSize);
#endif
#ifdef ${D.shadowSpread}
attenuation=zhudaWideShadow(coord,shadowmapSize);
#endif
`,
  ],
  [
    'float sampleShadowmap(in vec4 shadowCoord){',
    `
#ifdef ${D.shadowSpread}
float zhudaWideShadow(vec3 coord,vec4 shadowmapSize){
// LayaAir's own filter reaches two and a half texels.
vec2 reach=2.5*max(u_ShadowParams.z,1.0)*shadowmapSize.xy;
float turn=6.2831853*fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
float lit=0.0;
for(int i=0;i<16;i++){
float k=float(i)+0.5;
float angle=k*2.39996323+turn;
lit+=SAMPLE_TEXTURE2D_SHADOW(u_ShadowMap,vec3(coord.xy+sqrt(k/16.0)*reach*vec2(cos(angle),sin(angle)),coord.z));
}
return lit/16.0;
}
#endif
float sampleShadowmap(in vec4 shadowCoord){`,
  ],
];
// A phone reads a texture at low precision unless told, and depth near 1
// then loses what tells one surface from the next.
const CAMERA: readonly (readonly [string, string])[] = [
  ['uniform sampler2D u_CameraDepthTexture;', 'uniform highp sampler2D u_CameraDepthTexture;'],
];

const patched = new WeakSet<object>();
const applied = new WeakMap<object, Set<string>>();

/**
 * Teaches LayaAir 3.4.2's lights and sun shadows what `ZhudaLightingDepth`
 * switches on. Must run before `Laya.init`, which registers the includes
 * and compiles the lit shaders from them. Returns false when there is no
 * runtime to patch.
 */
export function installLaya342LightingDepth(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (patched.has(shader)) return true;
  const addInclude = shader.addInclude;
  const done = new Set<string>();
  applied.set(shader, done);
  const change = (text: string, pairs: readonly (readonly [string, string])[]) => {
    // All of an include or none of it: a release of LayaAir with other text is left alone.
    if (!pairs.every(([from]) => text.includes(from))) return undefined;
    for (const [from, to] of pairs) text = text.replace(from, to);
    return text;
  };
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (typeof text === 'string') {
      let next: string | undefined;
      if (name === 'Lighting.glsl' && text.includes(CONTACT_BEFORE)) {
        next = change(text, LIGHTING);
        if (next !== undefined) next = next.replace(CONTACT_BEFORE, CONTACT + CONTACT_BEFORE);
      } else if (name === 'ShadowSampler.glsl') next = change(text, SHADOWS);
      else if (name === 'Camera.glsl') next = change(text, CAMERA);
      if (next !== undefined) {
        text = next;
        done.add(name);
      }
    }
    return addInclude.call(this, name, text, ...rest);
  };
  hookLightBuffer(runtime);
  patched.add(shader);
  return true;
}

/** Whether the includes this runtime registered were changed (after `Laya.init`). */
export function zhudaLightingDepthInstalled(runtime: any = (globalThis as any).Laya): boolean {
  const done = applied.get(runtime?.Shader3D);
  return !!done && done.has('Lighting.glsl') && done.has('ShadowSampler.glsl');
}

// --- A spot's penumbra ---------------------------------------------------------
const penumbras = new WeakMap<object, number>();
/** Whether any light was ever given a penumbra: from then on the fourth texels are kept up to date. */
let penumbraUsed = false;

/**
 * How much of a spot light's cone is soft, 0..1: 0 a hard rim, 1 soft from
 * the middle out; `null` gives LayaAir's own half back. `light` is the
 * LayaAir spot light component. It shows in scenes whose
 * `ZhudaLightingDepth` is alive.
 */
export function setZhudaSpotPenumbra(light: any, penumbra: number | null): void {
  if (!light || typeof light !== 'object') throw Error('A spot light component is required');
  if (penumbra === null) {
    penumbras.delete(light);
    return;
  }
  if (typeof penumbra !== 'number' || !Number.isFinite(penumbra) || penumbra < 0 || penumbra > 1)
    throw Error('Invalid spot penumbra: use 0..1');
  penumbraUsed = true;
  penumbras.set(light, penumbra);
}

const hooked = new WeakSet<object>();
/**
 * LayaAir writes three texels of a light's row and uploads the rows it
 * wrote; the fourth texel of a spot's row is filled in just before that
 * upload, when the lights are in the order they are written in.
 */
function hookLightBuffer(l: any) {
  const proto = l.Scene3D?.prototype;
  if (!proto || typeof proto._prepareSceneToRender !== 'function' || hooked.has(proto)) return;
  hooked.add(proto);
  const prepare = proto._prepareSceneToRender;
  const wrapped = new WeakSet<object>();
  let current: any;
  proto._prepareSceneToRender = function (this: any) {
    const texture = this._getLightTexture?.();
    if (texture && !wrapped.has(texture) && typeof texture.setSubPixelsData === 'function') {
      wrapped.add(texture);
      const upload = texture.setSubPixelsData;
      texture.setSubPixelsData = function (
        x: number,
        y: number,
        width: number,
        height: number,
        pixels: Float32Array,
        ...rest: unknown[]
      ) {
        const scene = current;
        if (scene && penumbraUsed && width >= 4) {
          const on = l.Stat?.enableLight !== false;
          const first =
            (on ? (scene._directionLights?._length ?? 0) : 0) +
            (on ? (scene._pointLights?._length ?? 0) : 0);
          const spots = scene._spotLights?._elements ?? [],
            count = on ? (scene._spotLights?._length ?? 0) : 0;
          for (let k = 0; k < count; k++) {
            const at = (first + k) * width * 4 + 12;
            if (at >= pixels.length) break;
            const kept = penumbras.get(spots[k]);
            // The penumbra and one: nothing there means LayaAir's own.
            pixels[at] = kept === undefined ? 0 : kept + 1;
          }
        }
        return upload.call(this, x, y, width, height, pixels, ...rest);
      };
    }
    current = this;
    try {
      return prepare.call(this);
    } finally {
      current = undefined;
    }
  };
}

// --- A scene's switches --------------------------------------------------------
const owners = new WeakMap<object, ZhudaLightingDepth>();

export class ZhudaLightingDepth {
  private readonly scene: any;
  private readonly camera: any;
  private values: Required<ZhudaLightingDepthOptions>;
  /** Whether this asked the camera for its depth picture. */
  private askedDepth = false;
  /** The scene's own way of reading a vector, while this stands in for it. */
  private read: ((id: number) => any) | undefined;
  private write: ((id: number, value: any) => void) | undefined;
  private disposed = false;

  /**
   * `camera` is needed for contact shadows only: it is asked to draw its
   * depth picture, and left as it was on disposal.
   */
  constructor(scene3D: any, options: ZhudaLightingDepthOptions = {}, camera?: any) {
    const issues = validateZhudaLightingDepth(options);
    if (issues.length) throw Error('Invalid lighting: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!zhudaLightingDepthInstalled(l))
      throw Error(
        'Lighting depth needs installLaya342LightingDepth() before Laya.init (ZhudaEngine.boot does it)',
      );
    if (!scene3D?._shaderValues) throw Error('A Scene3D is required');
    if (owners.has(scene3D)) throw Error('This scene already has a ZhudaLightingDepth');
    this.scene = scene3D;
    this.camera = camera;
    this.values = { falloff: 'laya', shadowSpread: 1, cascadeBlend: false, contactShadows: 0 };
    owners.set(scene3D, this);
    try {
      this.watch();
      this.set(options);
    } catch (error) {
      this.unwatch();
      owners.delete(scene3D);
      throw error;
    }
  }

  /**
   * LayaAir reads the vector of its shadow strengths, writes a strength into
   * it and puts it back, once for each shadow pass. The spread and the reach
   * ride in its last two numbers, put in as it goes back. What LayaAir is
   * handed to write into is a copy: it changes the scene's own vector in
   * place otherwise, which then counts as unchanged, and on WebGPU the new
   * strength (or these two numbers) never reaches the graphics card.
   */
  private watch() {
    const l = (globalThis as any).Laya;
    const data = this.scene._shaderValues;
    const id = l.ShadowCasterPass.SHADOW_PARAMS;
    const read = (this.read = data.getVector),
      write = (this.write = data.setVector);
    const owner = this;
    data.getVector = function (index: number) {
      const value = read.call(this, index);
      return index === id && value ? new l.Vector4(value.x, value.y, value.z, value.w) : value;
    };
    data.setVector = function (index: number, value: any) {
      if (index === id && value) {
        value = new l.Vector4(
          value.x,
          value.y,
          owner.values.shadowSpread,
          owner.values.contactShadows,
        );
      }
      return write.call(this, index, value);
    };
  }

  private unwatch() {
    const data = this.data();
    // Only what this put there: the scene's own methods come back from its class.
    if (data && this.read && Object.hasOwn(data, 'getVector')) delete data.getVector;
    if (data && this.write && Object.hasOwn(data, 'setVector')) delete data.setVector;
    this.read = this.write = undefined;
  }

  /** The scene's values; nothing once LayaAir has destroyed the scene. */
  private data(): any {
    return this.scene.destroyed ? undefined : (this.scene._shaderValues ?? undefined);
  }

  /** New values in place; the same limits as the options. */
  set(options: ZhudaLightingDepthOptions): void {
    if (this.disposed) throw Error('Disposed lighting');
    const issues = validateZhudaLightingDepth(options);
    if (issues.length) throw Error('Invalid lighting: ' + issues.join('; '));
    if ((options.contactShadows ?? 0) > 0 && !this.camera)
      throw Error('Invalid lighting: contactShadows needs the camera (its depth picture)');
    this.values = { ...this.values, ...options };
    this.apply(this.values);
  }

  private apply(values: Required<ZhudaLightingDepthOptions>) {
    const l = (globalThis as any).Laya;
    // A scene destroyed with this left on it has nothing to switch.
    const data = this.data();
    this.values = values;
    if (data) {
      const define = (name: string, on: boolean) => {
        const d = l.Shader3D.getDefineByName(name);
        if (on) data.addDefine(d);
        else data.removeDefine(d);
      };
      define(D.inverseSquare, values.falloff === 'physical');
      // A scene has the penumbra's lookup while it has this at all.
      define(D.spotPenumbra, true);
      define(D.cascadeBlend, values.cascadeBlend);
      define(D.shadowSpread, values.shadowSpread > 1);
      define(D.contactShadow, values.contactShadows > 0);
      // Into the vector LayaAir keeps its shadow strengths in, if it has made
      // it (see `watch`, which puts the two numbers in as the vector goes back).
      const id = l.ShadowCasterPass.SHADOW_PARAMS;
      const now = data.getVector(id);
      if (now) data.setVector(id, now);
    }
    if (this.camera && !this.camera.destroyed) {
      const depth = l.DepthTextureMode.Depth;
      if (values.contactShadows > 0 && !(this.camera.depthTextureMode & depth)) {
        this.camera.depthTextureMode |= depth;
        this.askedDepth = true;
      } else if (values.contactShadows === 0 && this.askedDepth) {
        this.camera.depthTextureMode &= ~depth;
        this.askedDepth = false;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const l = (globalThis as any).Laya;
    this.apply({ falloff: 'laya', shadowSpread: 1, cascadeBlend: false, contactShadows: 0 });
    const data = this.data();
    data?.removeDefine(l.Shader3D.getDefineByName(D.spotPenumbra));
    this.unwatch();
    const id = l.ShadowCasterPass.SHADOW_PARAMS;
    const now = data?.getVector(id);
    if (now) data.setVector(id, new l.Vector4(now.x, now.y, 0, 0));
    owners.delete(this.scene);
  }
}
