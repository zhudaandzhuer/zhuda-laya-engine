/**
 * Environment captured from the scene itself.
 *
 * `prefilterZhudaEnvironment` (pure) turns a cube picture of the surroundings
 * into what Laya's image-based lighting needs: a mip chain blurred for
 * increasing roughness (GGX) and nine spherical-harmonic colours for ambient
 * light. `ZhudaEnvironmentProbe` renders that cube picture with a Laya camera
 * from one point and applies the result, so glossy surfaces reflect the
 * scene around them and unlit surfaces pick up its ambient light.
 *
 * One probe: reflections are correct at the probe and approximate elsewhere.
 */
import { prepareLaya342ManualDraw } from './Laya342Adapters.ts';
import { readLaya342FloatTarget } from './WebGPU342Adapters.ts';
import { createPrefilteredEnvironment, type PrefilteredEnvironmentSpec } from './Filmic.ts';

/**
 * A cube picture: six square faces of `size` pixels, RGBA float32, scene-linear,
 * in the order +X, -X, +Y, -Y, +Z, -Z with WebGL's face layout, holding the
 * radiance arriving from each world direction.
 */
export interface ZhudaCubePicture {
  size: number;
  data: Float32Array;
}

/** Direction of a texel: face 0..5, s and t in -1..1 (s along the row, t down the rows). */
export function zhudaCubeDirection(face: number, s: number, t: number): [number, number, number] {
  switch (face) {
    case 0:
      return [1, -t, -s];
    case 1:
      return [-1, -t, s];
    case 2:
      return [s, 1, t];
    case 3:
      return [s, -1, -t];
    case 4:
      return [s, -t, 1];
    default:
      return [-s, -t, -1];
  }
}

/** Face and s, t of a direction: the inverse of `zhudaCubeDirection`. */
export function zhudaCubeTexel(x: number, y: number, z: number): [number, number, number] {
  const ax = Math.abs(x),
    ay = Math.abs(y),
    az = Math.abs(z);
  if (ax >= ay && ax >= az) return x > 0 ? [0, -z / ax, -y / ax] : [1, z / ax, -y / ax];
  if (ay >= az) return y > 0 ? [2, x / ay, z / ay] : [3, x / ay, -z / ay];
  return z > 0 ? [4, x / az, -y / az] : [5, -x / az, -y / az];
}

function sampler(cube: ZhudaCubePicture) {
  const { size, data } = cube,
    out = [0, 0, 0];
  return (x: number, y: number, z: number): number[] => {
    const [face, s, t] = zhudaCubeTexel(x, y, z);
    const i = Math.min(size - 1, Math.max(0, Math.floor(((s + 1) / 2) * size))),
      j = Math.min(size - 1, Math.max(0, Math.floor(((t + 1) / 2) * size))),
      o = (face * size * size + j * size + i) * 4;
    out[0] = data[o];
    out[1] = data[o + 1];
    out[2] = data[o + 2];
    return out;
  };
}

export interface ZhudaPrefilterOptions {
  /** Side of the largest mip, a power of two 8..256 (default 64). */
  size?: number;
  /** Directions sampled per texel for the blurred mips, 8..1024 (default 64). */
  samples?: number;
}

/**
 * Prefilters a world cube picture for Laya. Laya looks the cube up with the
 * X axis mirrored, so the output is stored that way; the ambient colours use
 * the same convention.
 */
export function prefilterZhudaEnvironment(
  world: ZhudaCubePicture,
  options: ZhudaPrefilterOptions = {},
): { spec: PrefilteredEnvironmentSpec; pixels: Float32Array } {
  const size = options.size ?? 64,
    samples = options.samples ?? 64;
  if (!Number.isInteger(size) || size < 8 || size > 256 || (size & (size - 1)) !== 0)
    throw Error('Environment size must be a power of two between 8 and 256');
  if (!Number.isInteger(samples) || samples < 8 || samples > 1024)
    throw Error('Environment samples must be 8..1024');
  if (
    !Number.isInteger(world.size) ||
    world.size < 1 ||
    world.data.length !== world.size * world.size * 24
  )
    throw Error('Invalid cube picture');
  for (let i = 0; i < world.data.length; i++)
    if (!(world.data[i] >= 0)) throw Error('Cube picture holds a negative or non-finite value');
  const lookup = sampler(world);
  // Mip 0 in Laya's convention: its texel in direction d shows the world direction (-d.x, d.y, d.z).
  const base: ZhudaCubePicture = { size, data: new Float32Array(size * size * 24) };
  // Box-filter the source when it is larger than the base.
  const taps = Math.max(1, Math.round(world.size / size));
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let v = 0; v < taps; v++)
          for (let u = 0; u < taps; u++) {
            const d = zhudaCubeDirection(
              face,
              (2 * (i + (u + 0.5) / taps)) / size - 1,
              (2 * (j + (v + 0.5) / taps)) / size - 1,
            );
            const c = lookup(-d[0], d[1], d[2]);
            r += c[0];
            g += c[1];
            b += c[2];
          }
        const o = (face * size * size + j * size + i) * 4,
          n = taps * taps;
        base.data[o] = r / n;
        base.data[o + 1] = g / n;
        base.data[o + 2] = b / n;
        base.data[o + 3] = 1;
      }
  const levels: PrefilteredEnvironmentSpec['levels'] = [];
  const count = Math.log2(size) + 1;
  let total = 0;
  for (let m = 0; m < count; m++) {
    const side = size >> m;
    levels.push({ size: side, offset: total, elements: side * side * 24 });
    total += side * side * 24;
  }
  const pixels = new Float32Array(total);
  pixels.set(base.data, 0);
  const source = sampler(base);
  for (let m = 1; m < count; m++) {
    const side = size >> m,
      level = levels[m];
    // Laya picks the mip with r * (2 - r) of the perceptual roughness r.
    const roughness = 1 - Math.sqrt(1 - m / (count - 1)),
      alpha = Math.max(roughness * roughness, 1e-3),
      a2 = alpha * alpha;
    for (let face = 0; face < 6; face++)
      for (let j = 0; j < side; j++)
        for (let i = 0; i < side; i++) {
          const d = zhudaCubeDirection(
            face,
            (2 * (i + 0.5)) / side - 1,
            (2 * (j + 0.5)) / side - 1,
          );
          const length = Math.hypot(d[0], d[1], d[2]),
            nx = d[0] / length,
            ny = d[1] / length,
            nz = d[2] / length;
          // Tangent frame around the normal.
          const ux = Math.abs(nz) < 0.999 ? -ny : 0,
            uy = Math.abs(nz) < 0.999 ? nx : 1,
            uz = 0,
            ul = Math.hypot(ux, uy, uz),
            tx = ux / ul,
            ty = uy / ul,
            tz = uz / ul,
            bx = ny * tz - nz * ty,
            by = nz * tx - nx * tz,
            bz = nx * ty - ny * tx;
          let r = 0,
            g = 0,
            b = 0,
            weight = 0;
          for (let k = 0; k < samples; k++) {
            // Hammersley point, GGX importance sampling of the half vector.
            let bits = k;
            bits = ((bits << 16) | (bits >>> 16)) >>> 0;
            bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
            bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
            bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
            bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
            const u1 = (k + 0.5) / samples,
              u2 = bits * 2.3283064365386963e-10;
            const phi = 2 * Math.PI * u1,
              cos = Math.sqrt((1 - u2) / (1 + (a2 - 1) * u2)),
              sin = Math.sqrt(Math.max(0, 1 - cos * cos)),
              hx = sin * Math.cos(phi),
              hy = sin * Math.sin(phi);
            const wx = tx * hx + bx * hy + nx * cos,
              wy = ty * hx + by * hy + ny * cos,
              wz = tz * hx + bz * hy + nz * cos;
            const vh = nx * wx + ny * wy + nz * wz,
              lx = 2 * vh * wx - nx,
              ly = 2 * vh * wy - ny,
              lz = 2 * vh * wz - nz,
              nl = nx * lx + ny * ly + nz * lz;
            if (nl <= 0) continue;
            const c = source(lx, ly, lz);
            r += c[0] * nl;
            g += c[1] * nl;
            b += c[2] * nl;
            weight += nl;
          }
          const o = level.offset + (face * side * side + j * side + i) * 4;
          pixels[o] = weight ? r / weight : 0;
          pixels[o + 1] = weight ? g / weight : 0;
          pixels[o + 2] = weight ? b / weight : 0;
          pixels[o + 3] = 1;
        }
  }
  // Ambient: irradiance / pi as a quadratic in the normal (Laya's `u_IblSH`),
  // projected from the base mip, in the same mirrored-X convention.
  const ambientSH = zhudaAmbientSH(base);
  return { spec: { size, levels, ambientSH }, pixels };
}

/**
 * The nine ambient colours (27 numbers, Laya's `u_IblSH`: irradiance / pi as
 * a quadratic in the normal, X mirrored) of a cube picture of the
 * surroundings. `evaluateZhudaAmbient` evaluates them.
 */
export function zhudaAmbientSH(base: ZhudaCubePicture): number[] {
  const size = base.size;
  const sh = new Float64Array(27);
  let solid = 0;
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const s = (2 * (i + 0.5)) / size - 1,
          t = (2 * (j + 0.5)) / size - 1,
          d = zhudaCubeDirection(face, s, t),
          l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2],
          length = Math.sqrt(l2),
          x = d[0] / length,
          y = d[1] / length,
          z = d[2] / length,
          omega = 4 / (size * size) / (l2 * length); // solid angle of the texel
        solid += omega;
        const o = (face * size * size + j * size + i) * 4;
        const basis = [
          0.282095,
          0.488603 * y,
          0.488603 * z,
          0.488603 * x,
          1.092548 * x * y,
          1.092548 * y * z,
          0.315392 * (3 * z * z - 1),
          1.092548 * x * z,
          0.546274 * (x * x - y * y),
        ];
        for (let k = 0; k < 9; k++)
          for (let c = 0; c < 3; c++) sh[k * 3 + c] += base.data[o + c] * basis[k] * omega;
      }
  const norm = (4 * Math.PI) / solid;
  // Cosine lobe per band (divided by pi) times each basis function's constant.
  const scale = [
    0.282095,
    (2 / 3) * 0.488603,
    (2 / 3) * 0.488603,
    (2 / 3) * 0.488603,
    0.25 * 1.092548,
    0.25 * 1.092548,
    0.25 * 0.315392,
    0.25 * 1.092548,
    0.25 * 0.546274,
  ];
  const ambientSH: number[] = [];
  for (let k = 0; k < 9; k++)
    for (let c = 0; c < 3; c++) ambientSH.push(sh[k * 3 + c] * norm * scale[k]);
  return ambientSH;
}

/**
 * Ambient light (irradiance / pi) on a surface with world normal (x, y, z),
 * as Laya's shader evaluates the nine colours. For tests and tools.
 */
export function evaluateZhudaAmbient(
  ambientSH: readonly number[],
  x: number,
  y: number,
  z: number,
): number[] {
  const nx = -x,
    terms = [1, y, z, nx, y * nx, y * z, 3 * z * z - 1, z * nx, nx * nx - y * y];
  return [0, 1, 2].map((c) =>
    Math.max(
      0,
      terms.reduce((sum, term, k) => sum + ambientSH[k * 3 + c] * term, 0),
    ),
  );
}

export interface ZhudaEnvironmentProbeOptions {
  /** World position the surroundings are captured from. */
  position: readonly [number, number, number];
  /** Pixels per captured face, 32..512 (default 128). */
  captureSize?: number;
  /** Side of the largest stored mip (default 64). */
  size?: number;
  /** Scales reflections, 0..8 (default 1). */
  reflection?: number;
  /** Scales the ambient light, 0..8 (default 1). */
  ambient?: number;
  /**
   * Use the capture for reflections only and leave the scene's ambient light
   * as it is. Under a canopy or in a courtyard the captured ambient is as
   * dark as the surroundings; an open sky light may suit the shot better.
   */
  reflectionOnly?: boolean;
  /**
   * The room the capture stands for, as the corners of a world box. With it
   * a reflection is looked up where the reflected ray meets the box, not at
   * infinity: what is on a wall is mirrored at its place on the wall. For
   * interiors and courtyards; without it the surroundings are infinitely far,
   * which suits an open sky.
   */
  box?: { min: readonly number[]; max: readonly number[] } | false;
  /** Laya layers the capture does not draw (default: none). */
  excludedLayers?: readonly number[];
}

// Capture views: forward and up of each of the six renders.
const VIEWS: { forward: number[]; up: number[] }[] = [
  { forward: [1, 0, 0], up: [0, 1, 0] },
  { forward: [-1, 0, 0], up: [0, 1, 0] },
  { forward: [0, 1, 0], up: [0, 0, -1] },
  { forward: [0, -1, 0], up: [0, 0, 1] },
  { forward: [0, 0, 1], up: [0, 1, 0] },
  { forward: [0, 0, -1], up: [0, 1, 0] },
];
/** The six views of a capture, in the order the faces are read back. */
export const ZHUDA_CUBE_VIEWS: readonly { readonly forward: number[]; readonly up: number[] }[] =
  VIEWS;
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * A sky-and-ground surrounding as a cube picture: `sky` from above, `ground`
 * from below, blended across the horizon. Light from it gives surfaces that
 * face up the colour of the sky and surfaces that face down the light the
 * ground throws back, which is what keeps shadows from going flat and black.
 */
export function zhudaHemisphereCube(
  sky: readonly [number, number, number],
  ground: readonly [number, number, number],
  size = 16,
): ZhudaCubePicture {
  const colours = [...sky, ...ground];
  if (colours.length !== 6 || !colours.every((v) => Number.isFinite(v) && v >= 0))
    throw Error('Hemisphere colours must be non-negative numbers');
  if (!Number.isInteger(size) || size < 8 || size > 64) throw Error('Invalid hemisphere size');
  const data = new Float32Array(size * size * 24);
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const d = zhudaCubeDirection(face, (2 * (i + 0.5)) / size - 1, (2 * (j + 0.5)) / size - 1);
        const up = d[1] / Math.hypot(d[0], d[1], d[2]);
        // A soft horizon: a hard one would band on smooth surfaces.
        const t = Math.min(1, Math.max(0, up * 2.5 + 0.5));
        const blend = t * t * (3 - 2 * t);
        const o = ((face * size + j) * size + i) * 4;
        for (let c = 0; c < 3; c++) data[o + c] = ground[c] + (sky[c] - ground[c]) * blend;
        data[o + 3] = 1;
      }
  return { size, data };
}

let hemisphereBasis: { spec: PrefilteredEnvironmentSpec; pixels: Float32Array } | undefined;

/**
 * The prefiltered environment of `zhudaHemisphereCube(sky, ground, 16)` at
 * size 16, without prefiltering again. The cube is linear in the two colours
 * and so is the prefilter, so one prefilter of a unit sky (red) and a unit
 * ground (green) is mixed per call: microseconds instead of milliseconds,
 * equal to a full prefilter up to float rounding.
 */
export function prefilterZhudaHemisphere(
  sky: readonly [number, number, number],
  ground: readonly [number, number, number],
): { spec: PrefilteredEnvironmentSpec; pixels: Float32Array } {
  const colours = [...sky, ...ground];
  if (colours.length !== 6 || !colours.every((v) => Number.isFinite(v) && v >= 0))
    throw Error('Hemisphere colours must be non-negative numbers');
  hemisphereBasis ??= prefilterZhudaEnvironment(zhudaHemisphereCube([1, 0, 0], [0, 1, 0]), {
    size: 16,
  });
  const basis = hemisphereBasis;
  const pixels = new Float32Array(basis.pixels.length);
  for (let o = 0; o < pixels.length; o += 4) {
    const up = basis.pixels[o],
      down = basis.pixels[o + 1];
    pixels[o] = sky[0] * up + ground[0] * down;
    pixels[o + 1] = sky[1] * up + ground[1] * down;
    pixels[o + 2] = sky[2] * up + ground[2] * down;
    pixels[o + 3] = 1;
  }
  const ambientSH: number[] = [];
  for (let k = 0; k < 9; k++) {
    const up = basis.spec.ambientSH[k * 3],
      down = basis.spec.ambientSH[k * 3 + 1];
    for (let c = 0; c < 3; c++) ambientSH.push(sky[c] * up + ground[c] * down);
  }
  const levels = basis.spec.levels.map((level) => ({ ...level }));
  return { spec: { size: basis.spec.size, levels, ambientSH }, pixels };
}

/** What `applyZhudaHemisphereAmbient` returns: call it to restore the scene. */
export interface ZhudaHemisphereAmbientHandle {
  (): void;
  /** New colours in the same texture; nothing is allocated on the GPU. */
  update(sky: readonly [number, number, number], ground: readonly [number, number, number]): void;
}

/**
 * Lights a scene with a sky-and-ground ambient (and the matching soft
 * reflections). Returns the function that restores the scene's previous
 * ambient setup and releases the texture; its `update` changes the colours
 * in place. The colours are light (scene-linear); a film look and
 * `ZhudaSceneLook` decode their display colours before handing them here.
 */
export function applyZhudaHemisphereAmbient(
  scene: any,
  sky: readonly [number, number, number],
  ground: readonly [number, number, number],
): ZhudaHemisphereAmbientHandle {
  const { spec, pixels } = prefilterZhudaHemisphere(sky, ground);
  const environment = createPrefilteredEnvironment(spec, pixels);
  const previous = { mode: scene.ambientMode, tex: scene.iblTex };
  environment.apply(scene);
  let released = false;
  const restore = (() => {
    if (released) return;
    released = true;
    if (!scene.destroyed) {
      scene.iblTex = previous.tex ?? null;
      scene.ambientMode = previous.mode;
    }
    environment.dispose();
  }) as ZhudaHemisphereAmbientHandle;
  restore.update = (nextSky, nextGround) => {
    if (released) throw Error('Released hemisphere ambient');
    const next = prefilterZhudaHemisphere(nextSky, nextGround);
    environment.update(next.pixels, next.spec.ambientSH);
    // Only while the scene still uses this light; something else may have replaced it.
    if (!scene.destroyed && scene.iblTex === environment.texture) environment.apply(scene);
  };
  return restore;
}

/**
 * Six pictures read back from a 90-degree camera turned along `VIEWS`, as one
 * cube picture of the surroundings in world directions.
 */
export function zhudaCubeFromFaces(faces: readonly Float32Array[], n: number): ZhudaCubePicture {
  const world: ZhudaCubePicture = { size: n, data: new Float32Array(n * n * 24) };
  const rights = VIEWS.map((view) => cross(view.forward, view.up));
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const d = zhudaCubeDirection(face, (2 * (i + 0.5)) / n - 1, (2 * (j + 0.5)) / n - 1);
        // Which capture looks along this direction.
        let best = 0,
          depth = -Infinity;
        for (let k = 0; k < 6; k++) {
          const f = VIEWS[k].forward,
            along = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
          if (along > depth) {
            depth = along;
            best = k;
          }
        }
        const right = rights[best],
          up = VIEWS[best].up;
        const x = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / depth,
          y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / depth;
        const column = Math.min(n - 1, Math.max(0, Math.floor(((x + 1) / 2) * n))),
          // Read-back rows start at the top of the picture (measured on Laya
          // 3.4.2 render targets: a lamp above the probe lands in the first rows).
          row = Math.min(n - 1, Math.max(0, Math.floor(((1 - y) / 2) * n)));
        const from = (row * n + column) * 4,
          to = (face * n * n + j * n + i) * 4;
        for (let c = 0; c < 3; c++) {
          const value = faces[best][from + c];
          world.data[to + c] = value > 0 && Number.isFinite(value) ? Math.min(value, 4096) : 0;
        }
        world.data[to + 3] = 1;
      }
  return world;
}

/** The reflection probe LayaAir 3.4.2 keeps for a scene as a whole (the one `iblTex` belongs to). */
const sceneProbe = (scene: any) =>
  scene._sceneReflectionProb ?? scene._volumeManager?.reflectionProbeManager?.sceneReflectionProbe;

export class ZhudaEnvironmentProbe {
  private readonly scene: any;
  private environment: ReturnType<typeof createPrefilteredEnvironment> | undefined;
  private previous:
    | { mode: any; reflection: number; ambient: number; sh: Float32Array | undefined }
    | undefined;
  /** The node of the room's own probe, when a box is given. */
  private room: any;
  private disposed = false;
  /** The nine ambient colours of the last capture (27 numbers), for inspection. */
  ambientSH: readonly number[] = [];
  constructor(scene: any) {
    this.scene = scene;
  }

  /**
   * Renders the surroundings and applies them to the scene. Call it after the
   * scene has drawn at least one frame; call it again when the surroundings
   * change. `signal` cancels the read-back.
   */
  async capture(options: ZhudaEnvironmentProbeOptions, signal?: AbortSignal): Promise<void> {
    if (this.disposed) throw Error('Disposed environment probe');
    const l = (globalThis as any).Laya;
    const n = options.captureSize ?? 128;
    if (!Number.isInteger(n) || n < 32 || n > 512) throw Error('captureSize must be 32..512');
    for (const key of ['reflection', 'ambient'] as const) {
      const value = options[key];
      if (value !== undefined && !(Number.isFinite(value) && value >= 0 && value <= 8))
        throw Error(`${key} must be 0..8`);
    }
    if (options.position.length !== 3 || !options.position.every(Number.isFinite))
      throw Error('Invalid environment probe position');
    const target = new l.RenderTexture(
      n,
      n,
      l.RenderTargetFormat.R16G16B16A16,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1,
    );
    const camera = new l.Camera(1, 0.05, 4000);
    camera.name = 'zhuda-environment-probe';
    camera.fieldOfView = 90;
    camera.enableHDR = true;
    let mask = -1;
    for (const layer of options.excludedLayers ?? []) mask &= ~(1 << layer);
    camera.cullingMask = mask;
    const main = this.scene._cameraPool?.[0];
    if (main) {
      camera.clearFlag = main.clearFlag;
      camera.clearColor = main.clearColor;
    }
    this.scene.addChild(camera);
    const faces: Float32Array[] = [];
    try {
      const [px, py, pz] = options.position;
      camera.transform.position = new l.Vector3(px, py, pz);
      for (const view of VIEWS) {
        camera.transform.lookAt(
          new l.Vector3(px + view.forward[0], py + view.forward[1], pz + view.forward[2]),
          new l.Vector3(view.up[0], view.up[1], view.up[2]),
        );
        l.Stat.loopCount++;
        l.LayaGL.renderEngine.startFrame();
        try {
          prepareLaya342ManualDraw(this.scene);
          l.Camera.drawRenderTextureByScene(camera, this.scene, target);
        } finally {
          this.scene.recaculateCullCamera();
          l.LayaGL.renderEngine.endFrame();
        }
        const pixels = await readLaya342FloatTarget(l, target, n, n);
        if (signal?.aborted)
          throw signal.reason ?? new DOMException('Capture cancelled', 'AbortError');
        if (this.disposed) throw Error('Disposed environment probe');
        faces.push(pixels);
      }
    } finally {
      camera.renderTarget = null;
      camera.destroy(true);
      target.destroy();
    }
    // Resample the six views into a world cube picture.
    const world = zhudaCubeFromFaces(faces, n);
    const { spec, pixels } = prefilterZhudaEnvironment(world, { size: options.size ?? 64 });
    const next = createPrefilteredEnvironment(spec, pixels);
    this.previous ??= {
      mode: this.scene.ambientMode,
      reflection: this.scene.reflectionIntensity,
      ambient: this.scene.ambientIntensity,
      sh: this.scene.ambientSH ? new Float32Array(this.scene.ambientSH) : undefined,
    };
    this.environment?.dispose();
    this.environment = next;
    next.apply(this.scene);
    this.scene.reflectionIntensity = options.reflection ?? 1;
    if (options.reflectionOnly) {
      this.scene.ambientMode = this.previous.mode;
      this.scene.ambientIntensity = this.previous.ambient;
      if (this.previous.sh) this.scene.ambientSH = new Float32Array(this.previous.sh);
    } else this.scene.ambientIntensity = options.ambient ?? 1;
    this.ambientSH = spec.ambientSH;
    this.project(l, options);
  }

  /**
   * Box projection is LayaAir's, on a reflection probe that stands on a node:
   * the scene's own probe has no place. So a second probe is put at the
   * capture position with the scene probe's settings and the room as its
   * bounds; what is drawn inside the box takes it, the rest the scene's.
   */
  private project(l: any, options: ZhudaEnvironmentProbeOptions): void {
    this.room?.destroy(true);
    this.room = undefined;
    if (!options.box) return;
    const { min, max } = options.box;
    const valid = (v: readonly number[]) => v.length === 3 && v.every(Number.isFinite);
    if (!valid(min) || !valid(max) || !min.every((v, i) => v < max[i]))
      throw Error('Environment probe box: min below max on every axis, in metres');
    const whole = sceneProbe(this.scene);
    if (!l.ReflectionProbe || !whole)
      throw Error('Environment probe box: this LayaAir build has no reflection probe component');
    const node = (this.room = new l.Sprite3D('zhuda-environment-room'));
    this.scene.addChild(node);
    node.transform.position = new l.Vector3(...options.position);
    const probe = node.addComponent(l.ReflectionProbe);
    probe.ambientMode = whole.ambientMode;
    probe.iblTex = whole.iblTex;
    probe.iblTexRGBD = whole.iblTexRGBD;
    if (whole.ambientSH) probe.ambientSH = new Float32Array(whole.ambientSH);
    if (whole.ambientColor) probe.ambientColor = whole.ambientColor;
    probe.ambientIntensity = whole.ambientIntensity;
    probe.reflectionIntensity = whole.reflectionIntensity;
    // LayaAir takes the bounds in the node's own frame.
    const [px, py, pz] = options.position;
    probe.boundsMin = new l.Vector3(min[0] - px, min[1] - py, min[2] - pz);
    probe.boundsMax = new l.Vector3(max[0] - px, max[1] - py, max[2] - pz);
    probe.boxProjection = true;
    probe.importance = 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.scene.destroyed) this.room?.destroy(true);
    this.room = undefined;
    if (this.environment && !this.scene.destroyed) {
      this.scene.iblTex = null;
      if (this.previous) {
        this.scene.ambientMode = this.previous.mode;
        this.scene.reflectionIntensity = this.previous.reflection;
        this.scene.ambientIntensity = this.previous.ambient;
      }
    }
    this.environment?.dispose();
    this.environment = undefined;
  }
}
