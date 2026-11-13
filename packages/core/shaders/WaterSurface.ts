/**
 * Clear running water on a horizontal rectangle: a river, a stream, a pond.
 *
 * What lies under the surface is seen through it, bent by the waves and
 * tinted more the deeper the water is; the surface mirrors the scene above
 * (`ZhudaPlanarReflection`), glints in the sun, carries waves downstream and
 * foams where it is shallow (banks, stones breaking the surface). Banks and
 * stones are ordinary scenery that crosses the rectangle; the water only
 * shows where it lies above them.
 *
 * The main camera must provide its depth and opaque colour textures (film
 * stages switch them on). Drawn after opaque geometry, without depth writes.
 * `zhudaWaterAbsorption` is the shader's depth tint in TypeScript.
 */
import { ZhudaPlanarReflection } from '../runtime3d/Filmic.ts';
import { ZhudaDynamicMesh } from '../runtime3d/Surfaces.ts';
import { zhudaMirrorProjection } from './ReflectiveSurface.ts';
import { ZhudaShaderMaterial, type ZhudaShaderSpec } from './ShaderMaterials.ts';

export interface ZhudaWaterSurfaceOptions {
  /** Centre of the rectangle; `y` is the water level. */
  position: readonly [number, number, number];
  /** Width (X) and depth (Z) in metres. */
  size: readonly [number, number];
  /** Flow in metres per second along X and Z (default [0, 0.6]). */
  flow?: readonly [number, number];
  /** Colour of deep water, as light: scene-linear RGB (default a green-blue). A film scene decodes its display value first. */
  color?: readonly [number, number, number];
  /** Metres of water at which the bed has faded to about a third, 0.05..100 (default 1.5). */
  clarity?: number;
  /** Length of the waves in metres, 0.05..50 (default 0.9). */
  waveMeters?: number;
  /** Steepness of the waves, 0..1 (default 0.35). */
  waves?: number;
  /** How much the bed is bent by the waves, 0..1 (default 0.4). */
  refraction?: number;
  /** Brightness of the mirrored scene, 0..4 (default 1). */
  reflection?: number;
  /**
   * How much deep water shines in its own colour from light scattered inside
   * it, 0..4 (default 0.25). Higher values give luminous jade or turquoise water.
   */
  glow?: number;
  /** Depth in metres under which the water foams, 0..2 (default 0.12); 0 switches foam off. */
  foamDepth?: number;
  /** Sun glint: unit vector toward the sun and its linear colour times intensity. */
  sun?: { toward: readonly [number, number, number]; color: readonly [number, number, number] };
  /** Longer side of the reflection target in pixels (default 1024). */
  resolution?: 256 | 512 | 1024 | 2048;
  /**
   * Flip the lookup into the camera's depth and colour textures vertically.
   * Off for a camera that draws into a render target (captures, post-process
   * chains); a camera drawing straight to the canvas may need it.
   */
  flipScreen?: boolean;
  /**
   * The mirrored view redraws the shadow maps (default true). A game turns it
   * off to save a shadow pass per frame; the mirror then uses the shadows of
   * the main view.
   */
  mirrorShadows?: boolean;
  /** Laya layer for the surface; the mirrored camera does not draw this layer (default 29). */
  layer?: number;
}

/** Share of the bed's light that survives `metres` of water with the given clarity. */
export function zhudaWaterAbsorption(metres: number, clarity: number): number {
  return Math.exp(-Math.max(metres, 0) / clarity);
}

const SURFACE = `float zhudaWaterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float zhudaWaterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(zhudaWaterHash(i),zhudaWaterHash(i+vec2(1.0,0.0)),f.x),mix(zhudaWaterHash(i+vec2(0.0,1.0)),zhudaWaterHash(i+vec2(1.0,1.0)),f.x),f.y);}
float zhudaWaterTrain(vec2 q,vec2 along,float turn,float scale,float speed,float phase){
float c=cos(turn),sn=sin(turn);
vec2 d=vec2(along.x*c-along.y*sn,along.x*sn+along.y*c);
return sin(dot(q,d)*scale-u_ZhudaWaterFlow.z*speed+phase);}
// Ripples of a stream: five layers of drifting noise, each turned and moving
// at its own pace, drawn out along the flow. No layer repeats, so the surface
// has no stripes and no lattice; one faint wave train gives it a direction.
float zhudaWaterHeight(vec2 q0){
float pace=length(u_ZhudaWaterFlow.xy);
vec2 along=pace>0.0001?u_ZhudaWaterFlow.xy/pace:vec2(1.0,0.0);
float t=u_ZhudaWaterFlow.z*max(pace,0.15)/u_ZhudaWaterShape.x;
vec2 p=vec2(dot(q0,along)*0.6,dot(q0,vec2(-along.y,along.x)));
float h=0.5*(zhudaWaterNoise(p-vec2(t,0.0))-0.5);
h+=0.3*(zhudaWaterNoise(mat2(0.8,-0.6,0.6,0.8)*p*2.1-vec2(t*1.6,t*0.3))-0.5);
h+=0.18*(zhudaWaterNoise(mat2(0.6,0.8,-0.8,0.6)*p*4.3-vec2(t*2.3,-t*0.5))-0.5);
h+=0.1*(zhudaWaterNoise(p*8.9-vec2(t*3.1,t*0.9)+7.0)-0.5);
h+=0.06*(zhudaWaterNoise(mat2(0.8,-0.6,0.6,0.8)*p*17.0-vec2(t*4.0,0.0))-0.5);
h+=0.05*zhudaWaterTrain(q0,along,0.0,6.2832,6.2832*t/max(u_ZhudaWaterFlow.z,0.0001),0.0);
return h*0.22;}
vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){
vec3 v=normalize(u_CameraPos-p);
vec2 q=p.xz/u_ZhudaWaterShape.x;
float e=0.03;
float h0=zhudaWaterHeight(q);
vec3 wn=normalize(vec3((h0-zhudaWaterHeight(q+vec2(e,0.0)))/e*u_ZhudaWaterShape.y,1.0,(h0-zhudaWaterHeight(q+vec2(0.0,e)))/e*u_ZhudaWaterShape.y));
vec4 clip=u_ViewProjection*vec4(p,1.0);
vec2 screen=clip.xy/clip.w*0.5+0.5;
screen.y=mix(screen.y,1.0-screen.y,u_ZhudaWaterFlags.x);
float surface=clip.w;
float rawA=texture2D(u_CameraDepthTexture,screen).x;
float thick=max(1.0/(u_ZBufferParams.z*rawA+u_ZBufferParams.w)-surface,0.0);
// Bend the view of the bed; never pick up something in front of the water.
vec2 bent=clamp(screen+wn.xz*u_ZhudaWaterShape.z*0.08*clamp(thick*2.0,0.0,1.0)/max(surface*0.25,1.0),0.001,0.999);
float rawB=texture2D(u_CameraDepthTexture,bent).x;
float thickB=1.0/(u_ZBufferParams.z*rawB+u_ZBufferParams.w)-surface;
float behind=step(0.0,thickB);
bent=mix(screen,bent,behind);
thick=mix(thick,thickB,behind);
vec3 bed=texture2D(u_CameraOpaqueTexture,bent).rgb;
#ifdef Gamma_u_CameraOpaqueTexture
bed=gammaToLinear(vec4(bed,1.0)).rgb;
#endif
// Depth of the water under this pixel, not the length of the slanted view through it.
float deep=thick*max(v.y,0.2);
float through=exp(-deep/u_ZhudaWaterTint.w);
// Where the sun reaches the water: read from how bright the scene behind the
// surface is against the sun (an estimate; the surface has no shadow map).
float sunPower=max(u_ZhudaWaterSunColor.r,max(u_ZhudaWaterSunColor.g,u_ZhudaWaterSunColor.b));
float sunlit=sunPower>0.0001?smoothstep(0.5,1.1,max(bed.r,max(bed.g,bed.b))/(sunPower*0.2)):1.0;
// Light scattered inside deep water gives it its own colour (glow), mostly
// where the sun shines into it: water in the shade stays dark and clear.
float scatter=u_ZhudaWaterLight.w*mix(0.3,1.0,sunlit);
vec3 body=bed*mix(u_ZhudaWaterTint.rgb*2.0,vec3(1.0),through)*mix(0.35,1.0,through)+u_ZhudaWaterTint.rgb*u_ZhudaWaterLight.rgb*scatter*(1.0-through);
// The mirrored scene, shifted by the waves.
vec4 mc=u_ZhudaWaterC0*p.x+u_ZhudaWaterC1*p.y+u_ZhudaWaterC2*p.z+u_ZhudaWaterC3;
float front=step(0.00001,mc.w);
vec2 r=mc.xy/max(mc.w,0.00001)*0.5+0.5;
r.y=1.0-r.y;
r=clamp(r+wn.xz*0.035,0.001,0.999);
// Five taps: moving water never shows a sharp mirror image.
float soft=0.006+0.02*(1.0-wn.y);
vec3 mirror=zhudaSample_u_ZhudaWaterReflection(r).rgb*0.36;
mirror+=zhudaSample_u_ZhudaWaterReflection(r+vec2(soft,soft*0.6)).rgb*0.16;
mirror+=zhudaSample_u_ZhudaWaterReflection(r+vec2(-soft,soft*0.6)).rgb*0.16;
mirror+=zhudaSample_u_ZhudaWaterReflection(r+vec2(soft*0.5,-soft)).rgb*0.16;
mirror+=zhudaSample_u_ZhudaWaterReflection(r+vec2(-soft*0.5,-soft)).rgb*0.16;
mirror*=front*u_ZhudaWaterShape.w;
float fresnel=0.02+0.98*pow(1.0-clamp(dot(v,wn),0.0,1.0),5.0);
vec3 colour=mix(body,mirror,fresnel);
vec3 between=normalize(v+u_ZhudaWaterSun);
// Sparkle: ripples too fine for the height field tilt the surface a little
// more, so the sun breaks into many small glints, and only where it shines.
vec2 fq=q*61.0-u_ZhudaWaterFlow.xy*u_ZhudaWaterFlow.z*9.0;
vec2 fine=vec2(zhudaWaterNoise(fq),zhudaWaterNoise(fq+vec2(31.0,7.0)))-0.5;
fine+=0.6*(vec2(zhudaWaterNoise(fq*2.3+3.0),zhudaWaterNoise(fq*2.3+vec2(13.0,57.0)))-0.5);
vec3 sn=normalize(wn+vec3(fine.x,0.0,fine.y)*0.16*u_ZhudaWaterShape.y);
colour+=u_ZhudaWaterSunColor.rgb*pow(max(dot(sn,between),0.0),1300.0)*5.0*sunlit;
// Foam where the water is shallow, broken up and drifting with the flow.
// A soft line of foam where the water meets a bank or a stone, thicker where the waves lap.
float churn=zhudaWaterNoise(q*2.2-u_ZhudaWaterFlow.xy*u_ZhudaWaterFlow.z*1.5/u_ZhudaWaterShape.x);
float reach=max(u_ZhudaWaterFlags.y,0.0001)*(0.55+0.9*churn);
float foam=(1.0-smoothstep(0.0,reach,thick))*smoothstep(0.004,0.02,thick)*step(0.0001,u_ZhudaWaterFlags.y);
// Foam is the brightest thing on the water where the sun reaches it, grey in the shade.
foam*=0.6;
colour=mix(colour,u_ZhudaWaterLight.rgb*1.3*mix(0.35,1.0,sunlit),foam);
return vec4(colour,smoothstep(0.0,0.015,thick));}`;

const SPEC: ZhudaShaderSpec = {
  schemaVersion: 1,
  name: 'ZhudaWaterSurface',
  dimension: 3,
  blend: 'alpha',
  depthWrite: false,
  doubleSided: true,
  passes: { depth: true, opaqueColor: true },
  uniforms: {
    u_ZhudaWaterReflection: { type: 'texture2D' },
    u_ZhudaWaterC0: { type: 'vec4', value: [1, 0, 0, 0] },
    u_ZhudaWaterC1: { type: 'vec4', value: [0, 1, 0, 0] },
    u_ZhudaWaterC2: { type: 'vec4', value: [0, 0, 1, 0] },
    u_ZhudaWaterC3: { type: 'vec4', value: [0, 0, 0, 1] },
    /** wave metres, wave steepness, refraction, reflection. */
    u_ZhudaWaterShape: { type: 'vec4', value: [0.9, 0.35, 0.4, 1] },
    /** flow x, flow z, seconds, unused. */
    u_ZhudaWaterFlow: { type: 'vec4', value: [0, 0.6, 0, 0] },
    /** deep colour, clarity in metres. */
    u_ZhudaWaterTint: { type: 'vec4', value: [0.05, 0.32, 0.3, 1.5] },
    /** light that reaches the water (for its own colour and foam), glow. */
    u_ZhudaWaterLight: { type: 'vec4', value: [1, 1, 1, 0.25] },
    /** flip the screen's V, foam depth, unused, unused. */
    u_ZhudaWaterFlags: { type: 'vec4', value: [0, 0.12, 0, 0] },
    u_ZhudaWaterSun: { type: 'vec3', value: [0, 1, 0] },
    u_ZhudaWaterSunColor: { type: 'vec4', value: [0, 0, 0, 0] },
  },
  surface: SURFACE,
};

const inRange = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const vector = (value: unknown, length: number, min: number, max: number) =>
  Array.isArray(value) && value.length === length && value.every((n) => inRange(n, min, max));

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaWaterSurface(options: ZhudaWaterSurfaceOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as unknown as Record<string, unknown>;
  if (!vector(o.position, 3, -1e6, 1e6)) issues.push('position: use three finite numbers');
  if (!vector(o.size, 2, 0.1, 4000))
    issues.push('size: use [width, depth] between 0.1 and 4000 metres');
  if (o.flow !== undefined && !vector(o.flow, 2, -20, 20))
    issues.push('flow: use [x, z] in metres per second, -20..20');
  if (o.color !== undefined && !vector(o.color, 3, 0, 1))
    issues.push('color: use linear RGB with three values between 0 and 1');
  const ranges: [string, number, number][] = [
    ['clarity', 0.05, 100],
    ['waveMeters', 0.05, 50],
    ['waves', 0, 1],
    ['refraction', 0, 1],
    ['reflection', 0, 4],
    ['glow', 0, 4],
    ['foamDepth', 0, 2],
  ];
  for (const [key, min, max] of ranges)
    if (o[key] !== undefined && !inRange(o[key], min, max))
      issues.push(`${key}: use ${min}..${max}`);
  if (o.sun !== undefined) {
    const sun = o.sun as Record<string, unknown>;
    if (
      !sun ||
      !vector(sun.toward, 3, -1, 1) ||
      Math.abs(Math.hypot(...(sun.toward as number[])) - 1) > 1e-3 ||
      !vector(sun.color, 3, 0, 1000)
    )
      issues.push('sun: toward must be a unit vector, color three numbers 0..1000');
  }
  if (o.resolution !== undefined && ![256, 512, 1024, 2048].includes(o.resolution as number))
    issues.push('resolution: use 256, 512, 1024 or 2048');
  if (o.layer !== undefined && !(Number.isInteger(o.layer) && inRange(o.layer, 0, 30)))
    issues.push('layer: use a Laya layer 0..30');
  return issues;
}

export class ZhudaWaterSurface {
  /** Laya layer of the surface. Put anything the mirror must not draw on it. */
  readonly layer: number;
  readonly planeY: number;
  private readonly reflection: ZhudaPlanarReflection;
  private readonly material: ZhudaShaderMaterial;
  private readonly mesh: ZhudaDynamicMesh;
  private readonly scene: any;
  private readonly flow: readonly [number, number];
  private foamDepth = 0.12;
  private disposed = false;

  constructor(scene: any, options: ZhudaWaterSurfaceOptions) {
    const issues = validateZhudaWaterSurface(options);
    if (issues.length) throw Error('Invalid water surface: ' + issues.join('; '));
    this.scene = scene;
    this.layer = options.layer ?? 29;
    this.planeY = options.position[1];
    this.flow = options.flow ?? [0, 0.6];
    const resolution = options.resolution ?? 1024;
    this.reflection = new ZhudaPlanarReflection(scene, {
      width: resolution,
      height: Math.max(64, Math.round((resolution * 9) / 16)),
      planeY: this.planeY,
      excludedLayer: this.layer,
      clipBelowPlane: true,
      // The owner draws the mirror with `render()`: once per frame, not twice.
      manual: true,
      shadows: options.mirrorShadows ?? true,
    });
    try {
      this.material = new ZhudaShaderMaterial(SPEC, {
        u_ZhudaWaterReflection: this.reflection.texture,
      });
    } catch (error) {
      this.reflection.dispose();
      throw error;
    }
    try {
      const colour = options.color ?? [0.05, 0.32, 0.3];
      const set = (name: string, value: number[]) => this.material.setUniform(name, value);
      set('u_ZhudaWaterShape', [
        options.waveMeters ?? 0.9,
        (options.waves ?? 0.35) * 2.5,
        options.refraction ?? 0.4,
        options.reflection ?? 1,
      ]);
      set('u_ZhudaWaterFlow', [this.flow[0], this.flow[1], 0, 0]);
      set('u_ZhudaWaterTint', [colour[0], colour[1], colour[2], options.clarity ?? 1.5]);
      this.foamDepth = options.foamDepth ?? 0.12;
      set('u_ZhudaWaterFlags', [options.flipScreen ? 1 : 0, this.foamDepth, 0, 0]);
      const sun = options.sun;
      set('u_ZhudaWaterSun', sun ? [...sun.toward] : [0, 1, 0]);
      set('u_ZhudaWaterSunColor', sun ? [...sun.color, 0] : [0, 0, 0, 0]);
      const light = sun ? Math.max(0.25, Math.min(1.5, Math.max(...sun.color) * 0.35)) : 1;
      set('u_ZhudaWaterLight', [light, light, light, options.glow ?? 0.25]);
      const [x, y, z] = options.position,
        hw = options.size[0] / 2,
        hd = options.size[1] / 2;
      this.mesh = new ZhudaDynamicMesh(
        {
          positions: new Float32Array([
            x - hw,
            y,
            z - hd,
            x - hw,
            y,
            z + hd,
            x + hw,
            y,
            z + hd,
            x + hw,
            y,
            z - hd,
          ]),
          normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
          uvs: new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
          indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
        },
        scene,
      );
    } catch (error) {
      this.material.dispose();
      this.reflection.dispose();
      throw error;
    }
    const renderer = this.mesh.node.meshRenderer;
    renderer.sharedMaterial = this.material.material;
    renderer.castShadow = false;
    renderer.receiveShadow = false;
    this.mesh.node.layer = this.layer;
  }

  /** The mirrored camera, for matching the main camera's clear flag, sky and fog. */
  get camera(): any {
    return this.reflection.camera;
  }

  /**
   * Whether the lookup into the camera's depth and colour textures is flipped
   * vertically (see `flipScreen`). A game that switches its camera between
   * drawing through a post-process chain and straight to the canvas changes
   * it at the same time.
   */
  setScreenFlip(flip: boolean): void {
    if (this.disposed) throw Error('Disposed water surface');
    this.material.setUniform('u_ZhudaWaterFlags', [flip ? 1 : 0, this.foamDepth, 0, 0]);
  }

  /**
   * Moves the sun the water glints in (a day passing). Same rules as the
   * `sun` option: `toward` is a unit vector toward the sun, `color` its linear
   * colour times intensity. `null` turns the glint off.
   */
  setSun(
    sun: {
      toward: readonly [number, number, number];
      color: readonly [number, number, number];
    } | null,
  ): void {
    if (this.disposed) throw Error('Disposed water surface');
    if (sun) {
      const values = [...sun.toward, ...sun.color];
      if (
        values.length !== 6 ||
        !values.every(Number.isFinite) ||
        Math.abs(Math.hypot(...sun.toward) - 1) > 1e-3 ||
        sun.color.some((c) => c < 0 || c > 1000)
      )
        throw Error('Water sun: toward must be a unit vector, color three numbers 0..1000');
    }
    this.material.setUniform('u_ZhudaWaterSun', sun ? [...sun.toward] : [0, 1, 0]);
    this.material.setUniform('u_ZhudaWaterSunColor', sun ? [...sun.color, 0] : [0, 0, 0, 0]);
  }

  /** Seconds of flow: where the waves and the foam are. */
  setTime(seconds: number): void {
    if (this.disposed) throw Error('Disposed water surface');
    if (!Number.isFinite(seconds) || seconds < 0) throw Error('Invalid water time');
    this.material.setUniform('u_ZhudaWaterFlow', [this.flow[0], this.flow[1], seconds, 0]);
  }

  /** Call after the main camera moves or its field of view changes. */
  update(
    eye: readonly [number, number, number],
    target: readonly [number, number, number],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed water surface');
    this.reflection.update(eye, target, fieldOfViewDeg, aspect);
    const columns = zhudaMirrorProjection(eye, target, this.planeY, fieldOfViewDeg, aspect);
    columns.forEach((column, i) => this.material.setUniform('u_ZhudaWaterC' + i, column));
  }

  /**
   * Draws the mirrored view. Call it once per frame before the main camera
   * draws (the engine's frame loop does not draw it), or less often to save time.
   */
  render(): void {
    if (this.disposed) throw Error('Disposed water surface');
    this.reflection.draw();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.material.dispose();
    this.reflection.dispose();
  }
}
