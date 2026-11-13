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
  zhudaCubeFromFaces,
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

/** The distance pictures LayaAir's shader reads: 16 by 16 texels per probe, laid out like the irradiance. */
export function zhudaProbeDistanceAtlas(
  counts: readonly number[],
  off: readonly boolean[],
): { width: number; height: number; data: Float32Array } {
  const [cx, cy, cz] = counts;
  const width = cx * cy * DISTANCE_TEXELS,
    height = cz * DISTANCE_TEXELS,
    data = new Float32Array(width * height * 4);
  for (let probe = 0; probe < cx * cy * cz; probe++) {
    if (!off[probe]) continue;
    const column = probe % (cx * cy),
      row = Math.floor(probe / (cx * cy));
    for (let q = 0; q < DISTANCE_TEXELS; q++)
      for (let p = 0; p < DISTANCE_TEXELS; p++) {
        const o = ((row * DISTANCE_TEXELS + q) * width + column * DISTANCE_TEXELS + p) * 4;
        data[o] = 0.0001;
        data[o + 2] = 1;
        data[o + 3] = 1;
      }
  }
  return { width, height, data };
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
    const l = (globalThis as any).Laya;
    if (!l?.VolumetricGI) throw Error('Probe volumes need LayaAir’s VolumetricGI');
    for (const capability of ['TextureFormat_R32G32B32A32', 'Texture_FloatLinearFiltering'])
      if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable[capability]))
        throw Error('Probe volumes require ' + capability);
    const n = this.options.captureSize ?? 32;
    const batch = this.options.batch ?? 8;
    // Six faces per probe in three columns and two rows, the probes one above
    // the other: one read-back for `batch` probes.
    const rows = 2 * batch;
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
    let mask = -1;
    for (const layer of this.options.excludedLayers ?? []) mask &= ~(1 << layer);
    camera.cullingMask = mask;
    const main = this.scene._cameraPool?.[0];
    if (main) {
      camera.clearFlag = main.clearFlag;
      camera.clearColor = main.clearColor;
    }
    this.scene.addChild(camera);
    const ambient: number[][] = new Array(this.probes);
    const live = [...Array(this.probes).keys()].filter((probe) => !this.off[probe]);
    for (let probe = 0; probe < this.probes; probe++)
      if (this.off[probe]) ambient[probe] = new Array(27).fill(0);
    try {
      for (let first = 0; first < live.length; first += batch) {
        const group = live.slice(first, first + batch);
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
            return zhudaAtlasFace(picture, 3 * n, n, tile % 3, Math.floor(tile / 3) + 2 * slot);
          });
          ambient[probe] = zhudaAmbientSH(zhudaCubeFromFaces(faces, n));
        });
      }
    } finally {
      camera.renderTarget = null;
      camera.destroy(true);
      target.destroy();
    }
    this.ambient = ambient;
    this.apply(
      l,
      zhudaIrradianceAtlas(this.counts, (i) => ambient[i], this.options.strength ?? 1),
    );
  }

  private apply(l: any, atlas: { width: number; height: number; data: Float32Array }): void {
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
    if (!this.node) {
      if (this.scene.ambientMode !== l.AmbientMode.SphericalHarmonics || !this.scene.iblTex) {
        const colour = this.scene.ambientColor,
          light = [decode(colour.r), decode(colour.g), decode(colour.b)] as [
            number,
            number,
            number,
          ];
        this.restoreAmbient = applyZhudaHemisphereAmbient(this.scene, light, light);
      }
      // Distance pictures: an empty tile (z = 0) makes LayaAir skip its occlusion
      // test; a probe that is off says everything is right at it (z = 1), so
      // every point counts as hidden from it and its weight falls to almost 0.
      const distance = zhudaProbeDistanceAtlas(this.counts, this.off);
      this.distance = new l.Texture2D(
        distance.width,
        distance.height,
        l.TextureFormat.R32G32B32A32,
        false,
        false,
        false,
      );
      this.distance.filterMode = l.FilterMode.Bilinear;
      this.distance.wrapModeU = this.distance.wrapModeV = l.WrapMode.Clamp;
      this.distance.setPixelsData(distance.data, false, false);
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
    }
    const before = this.irradiance;
    this.volume.irradiance = texture;
    this.irradiance = texture;
    before?.destroy();
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
