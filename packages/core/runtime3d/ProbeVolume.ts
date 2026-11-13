/**
 * Light bounced once off the scene, as the ambient light of everything in a
 * box. Probes on a grid each capture their surroundings (six small pictures,
 * lit as the scene is lit), and LayaAir's volumetric GI (`VolumetricGI`)
 * lights every pixel of a physically based material from the eight probes
 * around it, in place of the scene's flat or sky-and-ground ambient light:
 * a sunlit red wall tints what faces it, the ground under a roof is dimmer.
 *
 * Captured when `bake` is called, not every frame: what moves afterwards
 * keeps the light it had. A probe inside a solid (`solids`) would see out
 * through the solid's back faces: it is not captured, and LayaAir's own
 * visibility test is told that it sees nothing, so its neighbours light what
 * is around it. No other occlusion between probes is stored, so light can
 * leak through a wall thinner than the probes' spacing when no probe falls
 * inside it. Blinn-Phong and unlit materials are not lit by the volume.
 *
 * LayaAir reads the volume only where the scene's ambient light comes from a
 * picture of the surroundings (an environment, a sky-and-ground ambient). A
 * scene with a flat ambient colour is given an even picture of that colour
 * while the volume lasts: the same light, in the form the volume needs.
 */
import { prepareLaya342ManualDraw } from './Laya342Adapters.ts';
import { readLaya342FloatTarget } from './WebGPU342Adapters.ts';
import {
  ZHUDA_CUBE_VIEWS,
  applyZhudaHemisphereAmbient,
  evaluateZhudaAmbient,
  zhudaAmbientSH,
  zhudaCubeDirection,
  zhudaCubeFromFaces,
  type ZhudaCubePicture,
} from './EnvironmentProbe.ts';

/** LayaAir's decoding of a colour channel (the scene's ambient colour is a display value). */
const decode = (value: number) =>
  value <= 0.04045
    ? value / 12.92
    : value < 1
      ? Math.pow((value + 0.055) / 1.055, 2.4)
      : Math.pow(value, 2.4);

/** Probes one volume may hold. */
export const ZHUDA_PROBE_VOLUME_MAX_PROBES = 512;
/** Texels along each side of a probe's octahedral picture (LayaAir's fixed value, border included). */
const TEXELS = 8;
/** The same for its distance picture. */
const DISTANCE_TEXELS = 16;

export interface ZhudaProbeVolumeOptions {
  /** Corners of the box the probes fill, world metres. */
  min: readonly number[];
  max: readonly number[];
  /** Probes along X, Y and Z, 1..16 each and at most 512 in all (default: one every 3 m or so). */
  counts?: readonly number[];
  /** Edge of each captured picture in pixels: 16, 32 or 64 (default 32). */
  captureSize?: 16 | 32 | 64;
  /** Multiplies the light, 0..4 (default 1). */
  strength?: number;
  /** Layers the captures leave out (overlays such as a reflector's mirror). */
  excludedLayers?: readonly number[];
  /**
   * Probes drawn into one picture before it is read back, 1..16 (default 8).
   * Reading back costs more than drawing: fewer, larger read-backs bake faster.
   */
  batch?: number;
  /** World axis-aligned boxes of solid things: probes inside them are switched off. */
  solids?: readonly { readonly min: readonly number[]; readonly max: readonly number[] }[];
  /**
   * Each probe also keeps how far it sees in every direction, and a surface
   * takes light only from probes that see it (LayaAir's own test). With it
   * a wall thinner than the probes' spacing no longer lets the light of one
   * side through to the other. One more depth pass a capture. Default false.
   */
  visibility?: boolean;
}

const vec3 = (value: unknown) =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100_000);

export function validateZhudaProbeVolume(options: ZhudaProbeVolumeOptions): string[] {
  const issues: string[] = [];
  const o = options ?? ({} as ZhudaProbeVolumeOptions);
  if (!vec3(o.min) || !vec3(o.max)) issues.push('min, max: use [x, y, z] in metres');
  else if (!o.min.every((v, i) => v < o.max[i])) issues.push('min: below max on every axis');
  const counts = o.counts as unknown;
  if (counts !== undefined) {
    if (
      !Array.isArray(counts) ||
      counts.length !== 3 ||
      !counts.every((n) => Number.isInteger(n) && n >= 1 && n <= 16)
    )
      issues.push('counts: use three whole numbers 1..16');
    else if (counts[0] * counts[1] * counts[2] > ZHUDA_PROBE_VOLUME_MAX_PROBES)
      issues.push(`counts: at most ${ZHUDA_PROBE_VOLUME_MAX_PROBES} probes in all`);
  }
  if (o.captureSize !== undefined && ![16, 32, 64].includes(o.captureSize))
    issues.push('captureSize: use 16, 32 or 64');
  if (o.strength !== undefined && !(o.strength >= 0 && o.strength <= 4))
    issues.push('strength: use 0..4');
  if (o.batch !== undefined && !(Number.isInteger(o.batch) && o.batch >= 1 && o.batch <= 16))
    issues.push('batch: use a whole number 1..16');
  if (o.visibility !== undefined && typeof o.visibility !== 'boolean')
    issues.push('visibility: true or false');
  return issues;
}

/** About one probe every `spacing` metres, at most 16 per axis and 512 in all. */
export function zhudaProbeCounts(
  min: readonly number[],
  max: readonly number[],
  spacing = 3,
): [number, number, number] {
  const counts = [0, 1, 2].map((i) =>
    Math.min(16, Math.max(1, Math.round((max[i] - min[i]) / spacing))),
  ) as [number, number, number];
  while (counts[0] * counts[1] * counts[2] > ZHUDA_PROBE_VOLUME_MAX_PROBES) {
    const widest = counts.indexOf(Math.max(...counts));
    counts[widest] = Math.max(1, counts[widest] - 1);
  }
  return counts;
}

/** LayaAir's octahedral decoding (`finalDecode`): a unit direction for x, y in -1..1. */
export function zhudaOctahedralDirection(x: number, y: number): [number, number, number] {
  let vx = x,
    vy = y;
  const vz = 1 - Math.abs(x) - Math.abs(y);
  if (vz < 0) {
    vx = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
    vy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
  }
  const length = Math.hypot(vx, vy, vz);
  return [vx / length, vy / length, vz / length];
}

/**
 * The picture LayaAir's shader reads: one tile of 8 by 8 texels per probe
 * (6 by 6 inside a border copied from the opposite edges), tile column
 * x + y * countX and tile row z. RGBA float, row 0 first.
 */
export function zhudaIrradianceAtlas(
  counts: readonly number[],
  ambientOf: (probe: number) => readonly number[],
  strength = 1,
): { width: number; height: number; data: Float32Array } {
  const [cx, cy, cz] = counts;
  const width = cx * cy * TEXELS,
    height = cz * TEXELS,
    data = new Float32Array(width * height * 4);
  const inner = TEXELS - 2;
  for (let probe = 0; probe < cx * cy * cz; probe++) {
    const sh = ambientOf(probe);
    const column = probe % (cx * cy),
      row = Math.floor(probe / (cx * cy));
    const tile: number[][] = [];
    for (let q = 0; q < TEXELS; q++)
      for (let p = 0; p < TEXELS; p++) {
        // Border texels repeat the texel across the opposite edge of the octahedron.
        let ip = p,
          iq = q;
        if (q === 0 || q === TEXELS - 1) {
          ip = TEXELS - 1 - p;
          iq = q === 0 ? 1 : TEXELS - 2;
        }
        if (p === 0 || p === TEXELS - 1) {
          iq = TEXELS - 1 - (q === 0 || q === TEXELS - 1 ? iq : q);
          ip = p === 0 ? 1 : TEXELS - 2;
          if (q === 0 || q === TEXELS - 1) {
            // A corner takes the diagonally opposite inner corner.
            ip = p === 0 ? TEXELS - 2 : 1;
            iq = q === 0 ? TEXELS - 2 : 1;
          }
        }
        const x = ((ip - 0.5) / inner) * 2 - 1,
          y = ((iq - 0.5) / inner) * 2 - 1;
        const [dx, dy, dz] = zhudaOctahedralDirection(x, y);
        // The volume is looked up with the world normal. These nine colours
        // come straight from the captured cube (`zhudaAmbientSH` of
        // `zhudaCubeFromFaces`), where X is not mirrored as in LayaAir's
        // ambient: measured on WebGL, a red wall on -X lights a face turned to
        // -X red only when they are evaluated at X mirrored.
        tile.push(evaluateZhudaAmbient(sh, -dx, dy, dz));
      }
    for (let q = 0; q < TEXELS; q++)
      for (let p = 0; p < TEXELS; p++) {
        const value = tile[q * TEXELS + p],
          o = ((row * TEXELS + q) * width + column * TEXELS + p) * 4;
        data[o] = value[0] * strength;
        data[o + 1] = value[1] * strength;
        data[o + 2] = value[2] * strength;
        data[o + 3] = 1;
      }
  }
  return { width, height, data };
}

/**
 * One face cut out of a read-back picture of tiles `n` wide: the tile in
 * `column` and `row` counted from the top, its columns reversed when
 * `mirrored`.
 */
export function zhudaAtlasFace(
  picture: Float32Array,
  width: number,
  n: number,
  column: number,
  row: number,
  mirrored = false,
): Float32Array {
  const face = new Float32Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    const from = ((row * n + y) * width + column * n) * 4;
    if (!mirrored) face.set(picture.subarray(from, from + n * 4), y * n * 4);
    else
      for (let x = 0; x < n; x++)
        face.set(picture.subarray(from + (n - 1 - x) * 4, from + (n - x) * 4), (y * n + x) * 4);
  }
  return face;
}

/**
 * A face drawn into a tile reads back as the same face drawn into a target of
 * its own (measured on WebGL: the nine colours of a probe agree whether its
 * faces are read back one by one or in tiles).
 */
const TILE_OF_FACE = [0, 1, 2, 3, 4, 5];

/**
 * A texel of a probe's tile as the place inside it that it shows: the border
 * texels repeat the texel across the opposite edge of the octahedron.
 */
function insideTexel(p: number, q: number, texels: number): [number, number] {
  let ip = p,
    iq = q;
  const last = texels - 1;
  if (q === 0 || q === last) {
    ip = last - p;
    iq = q === 0 ? 1 : last - 1;
  }
  if (p === 0 || p === last) {
    iq = last - (q === 0 || q === last ? iq : q);
    ip = p === 0 ? 1 : last - 1;
    if (q === 0 || q === last) {
      // A corner takes the diagonally opposite inner corner.
      ip = p === 0 ? last - 1 : 1;
      iq = q === 0 ? last - 1 : 1;
    }
  }
  return [ip, iq];
}

/**
 * How far a probe sees, as LayaAir's shader reads it: for each of the 16 by
 * 16 texels of its tile the mean distance and the mean squared distance
 * toward that texel's direction, two numbers a texel, row 0 first. `cube` is
 * a world cube picture whose red channel is the distance in metres. The
 * means are taken over a lobe about the direction (`sharpness`), so that the
 * edge of a wall is a spread of distances and not a step.
 */
export function zhudaProbeDistanceTile(cube: ZhudaCubePicture, sharpness = 24): Float32Array {
  // The cube at 8 by 8 a face: enough for a lobe this wide.
  const m = 8,
    n = cube.size,
    block = Math.max(1, Math.floor(n / m)),
    cells = Math.min(m, n);
  const dirs: number[][] = [],
    means: number[] = [],
    squares: number[] = [],
    solid: number[] = [];
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) {
        let sum = 0,
          sum2 = 0;
        for (let v = 0; v < block; v++)
          for (let u = 0; u < block; u++) {
            const d = cube.data[(face * n * n + (j * block + v) * n + i * block + u) * 4];
            sum += d;
            sum2 += d * d;
          }
        const s = (2 * (i + 0.5)) / cells - 1,
          t = (2 * (j + 0.5)) / cells - 1,
          d = zhudaCubeDirection(face, s, t),
          length = Math.hypot(d[0], d[1], d[2]);
        dirs.push([d[0] / length, d[1] / length, d[2] / length]);
        means.push(sum / (block * block));
        squares.push(sum2 / (block * block));
        // A texel near a corner of the cube covers less of the sphere.
        solid.push(1 / (length * length * length));
      }
  const tile = new Float32Array(DISTANCE_TEXELS * DISTANCE_TEXELS * 2);
  const inner = DISTANCE_TEXELS - 2;
  for (let q = 0; q < DISTANCE_TEXELS; q++)
    for (let p = 0; p < DISTANCE_TEXELS; p++) {
      const [ip, iq] = insideTexel(p, q, DISTANCE_TEXELS);
      const [dx, dy, dz] = zhudaOctahedralDirection(
        ((ip - 0.5) / inner) * 2 - 1,
        ((iq - 0.5) / inner) * 2 - 1,
      );
      let weight = 0,
        mean = 0,
        square = 0;
      for (let k = 0; k < dirs.length; k++) {
        const along = dirs[k][0] * dx + dirs[k][1] * dy + dirs[k][2] * dz;
        if (along <= 0) continue;
        const w = Math.pow(along, sharpness) * solid[k];
        weight += w;
        mean += w * means[k];
        square += w * squares[k];
      }
      const o = (q * DISTANCE_TEXELS + p) * 2;
      tile[o] = weight > 0 ? mean / weight : 0;
      tile[o + 1] = weight > 0 ? square / weight : 0;
    }
  return tile;
}

/**
 * The distance pictures LayaAir's shader reads: 16 by 16 texels per probe,
 * laid out like the irradiance. A probe with a tile (`zhudaProbeDistanceTile`)
 * is tested for what it sees (z = 1); one without is not (z = 0); one that is
 * off says everything is right at it, so every point counts as hidden from it.
 */
export function zhudaProbeDistanceAtlas(
  counts: readonly number[],
  off: readonly boolean[],
  tiles: readonly (Float32Array | undefined)[] = [],
): { width: number; height: number; data: Float32Array } {
  const [cx, cy, cz] = counts;
  const width = cx * cy * DISTANCE_TEXELS,
    height = cz * DISTANCE_TEXELS,
    data = new Float32Array(width * height * 4);
  for (let probe = 0; probe < cx * cy * cz; probe++) {
    const tile = tiles[probe];
    if (!off[probe] && !tile) continue;
    const column = probe % (cx * cy),
      row = Math.floor(probe / (cx * cy));
    for (let q = 0; q < DISTANCE_TEXELS; q++)
      for (let p = 0; p < DISTANCE_TEXELS; p++) {
        const o = ((row * DISTANCE_TEXELS + q) * width + column * DISTANCE_TEXELS + p) * 4;
        if (off[probe]) data[o] = 0.0001;
        else {
          data[o] = tile![(q * DISTANCE_TEXELS + p) * 2];
          data[o + 1] = tile![(q * DISTANCE_TEXELS + p) * 2 + 1];
        }
        data[o + 2] = 1;
        data[o + 3] = 1;
      }
  }
  return { width, height, data };
}

const CAPTURE_VERTEX =
  '#define SHADER_NAME ZhudaProbeCaptureVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
// The picture as it was drawn, with the distance along the view in alpha.
const CAPTURE_FRAGMENT = `#define SHADER_NAME ZhudaProbeCaptureFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
void main(){
vec4 source=texture2D(u_MainTex,v_Texcoord0);
#ifdef Gamma_u_MainTex
source=gammaToLinear(source);
#endif
float eye=1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,v_Texcoord0).x+u_ZBufferParams.w);
gl_FragColor=vec4(source.rgb,eye);
}`;
const captureRegistered = new WeakSet<object>();
function registerCapture(l: any) {
  if (captureRegistered.has(l.Shader3D)) return;
  const shader = l.Shader3D.add('ZhudaProbeCapture');
  shader.shaderType = l.ShaderFeatureType.PostProcess;
  const sub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    { u_MainTex: l.ShaderDataType.Texture2D },
  );
  shader.addSubShader(sub);
  const pass = sub.addShaderPass(CAPTURE_VERTEX, CAPTURE_FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  captureRegistered.add(l.Shader3D);
}

export class ZhudaProbeVolume {
  readonly counts: [number, number, number];
  readonly min: [number, number, number];
  readonly max: [number, number, number];
  private readonly scene: any;
  private readonly options: ZhudaProbeVolumeOptions;
  private node: any;
  private volume: any;
  private irradiance: any;
  private distance: any;
  private restoreAmbient: (() => void) | undefined;
  private disposed = false;
  /** What each probe saw last: its nine ambient colours, and how far it sees. */
  private readonly seen: (number[] | undefined)[] = [];
  private readonly reach: (Float32Array | undefined)[] = [];
  /** Where `refresh` goes on next time. */
  private cursor = 0;
  private capturing = false;
  /** The nine ambient colours of each probe after `bake`, for inspection. */
  ambient: readonly (readonly number[])[] = [];
  /** Which probes lie inside a solid and are switched off. */
  readonly off: readonly boolean[];

  constructor(scene: any, options: ZhudaProbeVolumeOptions) {
    const issues = validateZhudaProbeVolume(options);
    if (issues.length) throw Error('Invalid probe volume: ' + issues.join('; '));
    this.scene = scene;
    this.options = options;
    this.min = [...options.min] as [number, number, number];
    this.max = [...options.max] as [number, number, number];
    this.counts = (options.counts ? [...options.counts] : zhudaProbeCounts(this.min, this.max)) as [
      number,
      number,
      number,
    ];
    // A probe on a face is outside; one 2 cm or more inside a solid is in it.
    const inside = (p: readonly number[]) =>
      (options.solids ?? []).some((solid) =>
        p.every((v, i) => v > solid.min[i] + 0.02 && v < solid.max[i] - 0.02),
      );
    this.off = Array.from({ length: this.probes }, (_, i) => inside(this.probePosition(i)));
  }

  /** Probes in the volume. */
  get probes(): number {
    return this.counts[0] * this.counts[1] * this.counts[2];
  }

  /** World position of probe `index` (x fastest, then y, then z): cell centres, as LayaAir places them. */
  probePosition(index: number): [number, number, number] {
    const [cx, cy] = this.counts;
    const cell = [index % cx, Math.floor(index / cx) % cy, Math.floor(index / (cx * cy))];
    return [0, 1, 2].map(
      (i) => this.min[i] + ((cell[i] + 0.5) * (this.max[i] - this.min[i])) / this.counts[i],
    ) as [number, number, number];
  }

  /**
   * Captures every probe and lights the volume with the result. Call it
   * after the scene has drawn a frame or two, and again when its light or
   * what stands in it has changed. `signal` cancels the read-backs.
   */
  async bake(signal?: AbortSignal): Promise<void> {
    if (this.disposed) throw Error('Disposed probe volume');
    if (this.capturing) throw Error('Probe volume: a capture is already under way');
    const live = [...Array(this.probes).keys()].filter((probe) => !this.off[probe]);
    await this.capture(live, signal);
    this.cursor = 0;
    this.apply();
  }

  /**
   * Captures the next `count` probes again (default: one read-back's worth)
   * and lights the volume with them, going round all of them call after
   * call: what has moved or changed its light since the last time is taken
   * up a few probes at a time while a game runs. Needs a `bake` first.
   * Returns how many probes were captured: 0 while another capture is still
   * under way. Each probe is six small scene draws.
   */
  async refresh(count?: number, signal?: AbortSignal): Promise<number> {
    if (this.disposed) throw Error('Disposed probe volume');
    if (!this.volume) throw Error('Probe volume: bake before refresh');
    const live = [...Array(this.probes).keys()].filter((probe) => !this.off[probe]);
    const wanted = count ?? this.options.batch ?? 8;
    if (!Number.isInteger(wanted) || wanted < 1) throw Error('Probe volume refresh: use 1 or more');
    if (this.capturing || !live.length) return 0;
    const take = Math.min(wanted, live.length);
    const group = Array.from({ length: take }, (_, i) => live[(this.cursor + i) % live.length]);
    await this.capture(group, signal);
    this.cursor = (this.cursor + take) % live.length;
    this.apply();
    return take;
  }

  /** Draws and reads back `probes`, and keeps what each one saw. */
  private async capture(probes: readonly number[], signal?: AbortSignal): Promise<void> {
    const l = (globalThis as any).Laya;
    if (!l?.VolumetricGI) throw Error('Probe volumes need LayaAir’s VolumetricGI');
    for (const capability of ['TextureFormat_R32G32B32A32', 'Texture_FloatLinearFiltering'])
      if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable[capability]))
        throw Error('Probe volumes require ' + capability);
    const n = this.options.captureSize ?? 32;
    const batch = this.options.batch ?? 8;
    const visibility = this.options.visibility === true;
    // Six faces per probe in three columns and two rows, the probes one above
    // the other: one read-back for `batch` probes.
    const rows = 2 * batch;
    const flipped = !!l.WebGPURenderDeviceFactory;
    this.capturing = true;
    const target = new l.RenderTexture(
      3 * n,
      rows * n,
      l.RenderTargetFormat.R16G16B16A16,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1,
    );
    const camera = new l.Camera(1, 0.05, 4000);
    camera.name = 'zhuda-probe-volume';
    camera.fieldOfView = 90;
    camera.enableHDR = true;
    let material: any;
    if (visibility) {
      // The distance rides in the capture's alpha: one more depth pass, no second read-back.
      if (!l.MaterialPostProcessEffect)
        throw Error('Probe volume visibility needs the Laya post-process module');
      registerCapture(l);
      material = new l.Material();
      material.setShaderName('ZhudaProbeCapture');
      const effect = new l.MaterialPostProcessEffect();
      effect.material = material;
      const post = new l.PostProcess();
      post.addEffect(effect);
      camera.postProcess = post;
      camera.depthTextureMode |= l.DepthTextureMode.Depth;
    }
    let mask = -1;
    for (const layer of this.options.excludedLayers ?? []) mask &= ~(1 << layer);
    camera.cullingMask = mask;
    const main = this.scene._cameraPool?.[0];
    if (main) {
      camera.clearFlag = main.clearFlag;
      camera.clearColor = main.clearColor;
    }
    this.scene.addChild(camera);
    try {
      for (let first = 0; first < probes.length; first += batch) {
        const group = probes.slice(first, first + batch);
        group.forEach((probe, slot) => {
          const [px, py, pz] = this.probePosition(probe);
          camera.transform.position = new l.Vector3(px, py, pz);
          ZHUDA_CUBE_VIEWS.forEach((view, face) => {
            camera.transform.lookAt(
              new l.Vector3(px + view.forward[0], py + view.forward[1], pz + view.forward[2]),
              new l.Vector3(view.up[0], view.up[1], view.up[2]),
            );
            camera.normalizedViewport = new l.Viewport(
              (face % 3) / 3,
              (Math.floor(face / 3) + 2 * slot) / rows,
              1 / 3,
              1 / rows,
            );
            l.Stat.loopCount++;
            l.LayaGL.renderEngine.startFrame();
            try {
              prepareLaya342ManualDraw(this.scene);
              l.Camera.drawRenderTextureByScene(camera, this.scene, target);
            } finally {
              camera.renderTarget = target;
              this.scene.recaculateCullCamera();
              l.LayaGL.renderEngine.endFrame();
            }
          });
        });
        const picture = await readLaya342FloatTarget(l, target, 3 * n, rows * n);
        if (signal?.aborted)
          throw signal.reason ?? new DOMException('Bake cancelled', 'AbortError');
        if (this.disposed) throw Error('Disposed probe volume');
        group.forEach((probe, slot) => {
          const faces = ZHUDA_CUBE_VIEWS.map((_, face) => {
            const tile = TILE_OF_FACE[face];
            // WebGPU counts the viewport's rows of tiles from the other edge
            // of the target (measured: `verify:film-bounce` on both backends).
            const line = Math.floor(tile / 3) + 2 * slot;
            return zhudaAtlasFace(picture, 3 * n, n, tile % 3, flipped ? rows - 1 - line : line);
          });
          this.seen[probe] = zhudaAmbientSH(zhudaCubeFromFaces(faces, n));
          if (visibility) this.reach[probe] = zhudaProbeDistanceTile(distanceCube(faces, n));
        });
      }
    } finally {
      this.capturing = false;
      camera.renderTarget = null;
      camera.postProcess = null;
      camera.destroy(true);
      target.destroy();
      material?.destroy();
    }
  }

  /** Writes what the probes saw into the two pictures LayaAir reads, in place once they exist. */
  private apply(): void {
    const l = (globalThis as any).Laya;
    const dark = new Array(27).fill(0);
    const ambient = Array.from({ length: this.probes }, (_, probe) =>
      this.off[probe] ? dark : (this.seen[probe] ?? dark),
    );
    this.ambient = ambient;
    const irradiance = zhudaIrradianceAtlas(
      this.counts,
      (i) => ambient[i],
      this.options.strength ?? 1,
    );
    const distance = zhudaProbeDistanceAtlas(this.counts, this.off, this.reach);
    const picture = (atlas: { width: number; height: number; data: Float32Array }) => {
      const texture = new l.Texture2D(
        atlas.width,
        atlas.height,
        l.TextureFormat.R32G32B32A32,
        false,
        false,
        false,
      );
      texture.filterMode = l.FilterMode.Bilinear;
      texture.wrapModeU = texture.wrapModeV = l.WrapMode.Clamp;
      texture.setPixelsData(atlas.data, false, false);
      return texture;
    };
    // In place: allocating again would be refused (the texture is immutable).
    const rewrite = (texture: any, atlas: { width: number; height: number; data: Float32Array }) =>
      texture.setSubPixelsData(0, 0, atlas.width, atlas.height, atlas.data, 0, false, false, false);
    if (this.node) {
      rewrite(this.irradiance, irradiance);
      rewrite(this.distance, distance);
      return;
    }
    if (this.scene.ambientMode !== l.AmbientMode.SphericalHarmonics || !this.scene.iblTex) {
      const colour = this.scene.ambientColor,
        light = [decode(colour.r), decode(colour.g), decode(colour.b)] as [number, number, number];
      this.restoreAmbient = applyZhudaHemisphereAmbient(this.scene, light, light);
    }
    this.irradiance = picture(irradiance);
    this.distance = picture(distance);
    this.node = new l.Sprite3D('zhuda-probe-volume');
    this.scene.addChild(this.node);
    const volume = (this.volume = this.node.addComponent(l.VolumetricGI));
    volume.boundsMin = new l.Vector3(...this.min);
    volume.boundsMax = new l.Vector3(...this.max);
    volume.probeCounts = new l.Vector3(...this.counts);
    volume.probeStep = new l.Vector3(
      ...[0, 1, 2].map((i) => (this.max[i] - this.min[i]) / this.counts[i]),
    );
    volume.normalBias = 0.1;
    volume.viewBias = 0.1;
    volume.distance = this.distance;
    volume.irradiance = this.irradiance;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.node && !this.node.destroyed) this.node.destroy(true);
    if (!this.scene.destroyed) this.restoreAmbient?.();
    this.irradiance?.destroy();
    this.distance?.destroy();
  }
}

/**
 * The six captured faces as a world cube picture of distances from the
 * probe: each face's alpha is the distance along its view, which a ray
 * toward a corner of the face covers a longer way.
 */
function distanceCube(faces: readonly Float32Array[], n: number): ZhudaCubePicture {
  return zhudaCubeFromFaces(
    faces.map((face) => {
      const out = new Float32Array(n * n * 4);
      for (let row = 0; row < n; row++)
        for (let column = 0; column < n; column++) {
          const x = ((column + 0.5) / n) * 2 - 1,
            y = 1 - ((row + 0.5) / n) * 2,
            i = (row * n + column) * 4;
          out[i] = face[i + 3] * Math.sqrt(1 + x * x + y * y);
          out[i + 3] = 1;
        }
      return out;
    }),
    n,
  );
}
