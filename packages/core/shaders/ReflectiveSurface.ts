/**
 * A horizontal surface that shows a real reflection of the scene above it:
 * wet paving, a courtyard after rain, still water. The reflection comes from
 * the mirrored scene camera of `ZhudaPlanarReflection` and is added on top of
 * whatever is drawn underneath, so the lit surface below keeps its material
 * and lightmap. Requires the Laya runtime.
 */
import { prepareLaya342ManualDraw } from '../runtime3d/Laya342Adapters.ts';
import { ZhudaPlanarReflection } from '../runtime3d/Filmic.ts';
import { ZhudaDynamicMesh } from '../runtime3d/Surfaces.ts';
import { ZhudaShaderMaterial, type ZhudaShaderSpec } from './ShaderMaterials.ts';

export interface ZhudaReflectiveSurfaceOptions {
  /** Centre of the rectangle; `y` is the height of the reflecting plane. */
  position: readonly [number, number, number];
  /** Width (X) and depth (Z) in metres. */
  size: readonly [number, number];
  /** Brightness of the reflection, 0..4 (default 1). */
  strength?: number;
  /** Share of the surface that is standing water, 0..1 (default 0.45). The rest is damp. */
  wetness?: number;
  /** Blur of the reflection on damp areas, 0..1 (default 0.35). */
  roughness?: number;
  /** How much damp areas break the reflection up, 0..1 (default 0.4). */
  ripple?: number;
  /** Size of the puddle pattern in metres (default 3). */
  patternMeters?: number;
  /** Longer side of the reflection target in pixels (default 1024). */
  resolution?: number;
  /** Laya layer for the surface; the mirrored camera does not draw this layer (default 30). */
  layer?: number;
  /**
   * Draw only what lies above the mirror in the mirrored view (default true).
   * The ground a wet surface lies on is below the mirror and would otherwise
   * cover the whole reflection. With `false` the view is not cut: keep such
   * geometry out of the mirror yourself (its layer, or `hides` in a film scene).
   */
  clipBelowPlane?: boolean;
}

const SURFACE = `float zhudaWetHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float zhudaWetNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(zhudaWetHash(i),zhudaWetHash(i+vec2(1.0,0.0)),f.x),mix(zhudaWetHash(i+vec2(0.0,1.0)),zhudaWetHash(i+vec2(1.0,1.0)),f.x),f.y);}
float zhudaWetFbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<4;i++){s+=a*zhudaWetNoise(p);p=p*2.03+vec2(17.0,5.0);a*=0.5;}return s;}
vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){
vec3 v=normalize(u_ZhudaWetEye-p);
vec2 q=p.xz/u_ZhudaWetShape.z;
float puddle=smoothstep(-0.07,0.07,zhudaWetFbm(q)-mix(0.82,0.12,u_ZhudaWetShape.y));
vec2 bump=vec2(zhudaWetNoise(q*11.0+3.0),zhudaWetNoise(q*11.0+41.0))-0.5;
vec4 clip=u_ZhudaWetC0*p.x+u_ZhudaWetC1*p.y+u_ZhudaWetC2*p.z+u_ZhudaWetC3;
// No early return: WGSL allows texture sampling only in uniform control flow.
float front=step(0.00001,clip.w);
vec2 r=clip.xy/max(clip.w,0.00001)*0.5+0.5;
r.y=mix(r.y,1.0-r.y,u_ZhudaWetBlur.y);
float damp=1.0-puddle;
r+=bump*u_ZhudaWetShape.w*0.06*damp;
float blur=u_ZhudaWetBlur.x*0.014*damp;
vec3 c=zhudaSample_u_ZhudaWetReflection(r).rgb*0.36;
c+=zhudaSample_u_ZhudaWetReflection(r+vec2(blur,blur*0.6)).rgb*0.16;
c+=zhudaSample_u_ZhudaWetReflection(r+vec2(-blur,blur*0.6)).rgb*0.16;
c+=zhudaSample_u_ZhudaWetReflection(r+vec2(blur*0.5,-blur)).rgb*0.16;
c+=zhudaSample_u_ZhudaWetReflection(r+vec2(-blur*0.5,-blur)).rgb*0.16;
float fresnel=0.04+0.96*pow(1.0-clamp(v.y,0.0,1.0),5.0);
float gloss=mix(0.3,1.0,puddle);
float edge=smoothstep(0.0,0.03,uv.x)*smoothstep(0.0,0.03,1.0-uv.x)*smoothstep(0.0,0.03,uv.y)*smoothstep(0.0,0.03,1.0-uv.y);
float inside=front*step(0.0,r.x)*step(r.x,1.0)*step(0.0,r.y)*step(r.y,1.0);
return vec4(c*fresnel*gloss*u_ZhudaWetShape.x*edge*inside,1.0);}`;

const SPEC: ZhudaShaderSpec = {
  schemaVersion: 1,
  name: 'ZhudaReflectiveSurface',
  dimension: 3,
  blend: 'additive',
  depthWrite: false,
  doubleSided: true,
  uniforms: {
    u_ZhudaWetReflection: { type: 'texture2D' },
    u_ZhudaWetEye: { type: 'vec3', value: [0, 1, 0] },
    u_ZhudaWetC0: { type: 'vec4', value: [1, 0, 0, 0] },
    u_ZhudaWetC1: { type: 'vec4', value: [0, 1, 0, 0] },
    u_ZhudaWetC2: { type: 'vec4', value: [0, 0, 1, 0] },
    u_ZhudaWetC3: { type: 'vec4', value: [0, 0, 0, 1] },
    /** strength, wetness, pattern metres, ripple. */
    u_ZhudaWetShape: { type: 'vec4', value: [1, 0.45, 3, 0.4] },
    /** roughness, flip the target's V, unused, unused. */
    u_ZhudaWetBlur: { type: 'vec4', value: [0.35, 1, 0, 0] },
  },
  surface: SURFACE,
};

const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaReflectiveSurface(options: ZhudaReflectiveSurfaceOptions): string[] {
  const issues: string[] = [];
  const o = options ?? ({} as ZhudaReflectiveSurfaceOptions);
  if (!(Array.isArray(o.position) && o.position.length === 3 && o.position.every(Number.isFinite)))
    issues.push('position: use three finite numbers');
  if (!(Array.isArray(o.size) && o.size.length === 2 && o.size.every((n) => inRange(n, 0.1, 4000))))
    issues.push('size: use [width, depth] between 0.1 and 4000 metres');
  const ranges: [keyof ZhudaReflectiveSurfaceOptions, number, number][] = [
    ['strength', 0, 4],
    ['wetness', 0, 1],
    ['roughness', 0, 1],
    ['ripple', 0, 1],
    ['patternMeters', 0.1, 100],
  ];
  for (const [key, min, max] of ranges)
    if (o[key] !== undefined && !inRange(o[key] as number, min, max))
      issues.push(`${key}: use ${min}..${max}`);
  if (o.resolution !== undefined && ![256, 512, 1024, 2048].includes(o.resolution))
    issues.push('resolution: use 256, 512, 1024 or 2048');
  if (o.layer !== undefined && !(Number.isInteger(o.layer) && inRange(o.layer, 0, 30)))
    issues.push('layer: use a Laya layer 0..30');
  if (o.clipBelowPlane !== undefined && typeof o.clipBelowPlane !== 'boolean')
    issues.push('clipBelowPlane: use true or false');
  return issues;
}

/**
 * Columns of the matrix that takes a world point to the mirrored camera's clip
 * space (x and y in -1..1 after dividing by w; z is unused). The mirrored
 * camera sits at the eye's reflection in the plane `y = planeY`, looks at the
 * reflected target and keeps +Y up.
 */
export function zhudaMirrorProjection(
  eye: readonly number[],
  target: readonly number[],
  planeY: number,
  fieldOfViewDeg: number,
  aspect: number,
): [number[], number[], number[], number[]] {
  const e = [eye[0], 2 * planeY - eye[1], eye[2]],
    t = [target[0], 2 * planeY - target[1], target[2]];
  const unit = (v: number[]) => {
    const length = Math.hypot(v[0], v[1], v[2]);
    return v.map((n) => n / length);
  };
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const forward = unit([t[0] - e[0], t[1] - e[1], t[2] - e[2]]);
  // Looking straight up or down: any horizontal axis works as the side.
  const vertical = Math.hypot(forward[0], forward[2]) < 1e-6;
  const side = unit(cross(forward, vertical ? [0, 0, 1] : [0, 1, 0])),
    up = cross(side, forward);
  const g = 1 / Math.tan((fieldOfViewDeg * Math.PI) / 360),
    gx = g / aspect;
  const column = (i: number) => [side[i] * gx, up[i] * g, 0, forward[i]];
  return [
    column(0),
    column(1),
    column(2),
    [-dot(side, e) * gx, -dot(up, e) * g, 0, -dot(forward, e)],
  ];
}

export class ZhudaReflectiveSurface {
  /** Laya layer of the surface. Put anything the mirror must not draw on it. */
  readonly layer: number;
  readonly planeY: number;
  private readonly reflection: ZhudaPlanarReflection;
  private readonly material: ZhudaShaderMaterial;
  private readonly mesh: ZhudaDynamicMesh;
  private readonly scene: any;
  private disposed = false;

  constructor(scene: any, options: ZhudaReflectiveSurfaceOptions) {
    const issues = validateZhudaReflectiveSurface(options);
    if (issues.length) throw Error('Invalid reflective surface: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    this.scene = scene;
    this.layer = options.layer ?? 30;
    this.planeY = options.position[1];
    const resolution = options.resolution ?? 1024;
    this.reflection = new ZhudaPlanarReflection(scene, {
      width: resolution,
      height: Math.max(64, Math.round((resolution * 9) / 16)),
      planeY: this.planeY,
      excludedLayer: this.layer,
      clipBelowPlane: options.clipBelowPlane ?? true,
    });
    try {
      this.material = new ZhudaShaderMaterial(SPEC, {
        u_ZhudaWetReflection: this.reflection.texture,
      });
    } catch (error) {
      this.reflection.dispose();
      throw error;
    }
    try {
      this.material.setUniform('u_ZhudaWetShape', [
        options.strength ?? 1,
        options.wetness ?? 0.45,
        options.patternMeters ?? 3,
        options.ripple ?? 0.4,
      ]);
      // Laya render targets are sampled bottom row first on WebGL and WebGPU
      // alike (measured on both): flip V.
      this.material.setUniform('u_ZhudaWetBlur', [options.roughness ?? 0.35, 1, 0, 0]);
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
    void l;
  }

  /** The mirrored camera, for matching the main camera's clear flag, sky and fog. */
  get camera(): any {
    return this.reflection.camera;
  }

  /** Call after the main camera moves or its field of view changes. */
  update(
    eye: readonly [number, number, number],
    target: readonly [number, number, number],
    fieldOfViewDeg: number,
    aspect: number,
  ): void {
    if (this.disposed) throw Error('Disposed reflective surface');
    this.reflection.update(eye, target, fieldOfViewDeg, aspect);
    const columns = zhudaMirrorProjection(eye, target, this.planeY, fieldOfViewDeg, aspect);
    this.material.setUniform('u_ZhudaWetEye', eye);
    columns.forEach((column, i) => this.material.setUniform('u_ZhudaWetC' + i, column));
  }

  /**
   * Draws the mirrored view now. The engine's normal frame loop already draws
   * it; call this only when a frame is rendered outside that loop (captures).
   */
  render(): void {
    if (this.disposed) throw Error('Disposed reflective surface');
    const l = (globalThis as any).Laya;
    const camera = this.reflection.camera,
      target = this.reflection.texture;
    try {
      prepareLaya342ManualDraw(this.scene);
      l.Camera.drawRenderTextureByScene(camera, this.scene, target);
    } finally {
      camera.renderTarget = target;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.material.dispose();
    this.reflection.dispose();
  }
}
