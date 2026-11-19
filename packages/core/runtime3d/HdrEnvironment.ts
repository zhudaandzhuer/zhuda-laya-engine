/**
 * An HDR panorama (a Radiance `.hdr` photograph of the whole surroundings,
 * twice as wide as tall) as the light of a scene and as its sky, and a
 * studio room made here for scenes that have neither.
 *
 * What was there before: a PNG or JPEG panorama as the sky (8 bits, so the
 * sun in it is no brighter than a white wall and lights nothing), and
 * `ZhudaEnvironmentProbe`, which photographs the scene and its sky from one
 * point and lights the scene with that. Here the photograph itself is the
 * light: it is turned into a cube picture, prefiltered
 * (`prefilterZhudaEnvironment`: blurred mip levels for rough surfaces, nine
 * ambient colours) and applied, with the picture as the sky, turned and
 * exposed together.
 *
 * Only `ZhudaHdrEnvironment` needs the Laya runtime; the rest is pure.
 */
import {
  prefilterZhudaEnvironment,
  zhudaCubeDirection,
  zhudaCubeTexel,
  type ZhudaCubePicture,
  type ZhudaPrefilterOptions,
} from './EnvironmentProbe.ts';
import { zhudaFloatToHalf } from './HalfFloat.ts';
import type { ZhudaHdrImage } from './Lightmap.ts';
import { createPrefilteredEnvironment, type ZhudaEnvironmentFormat } from './Filmic.ts';

export interface ZhudaEquirectOptions {
  /** Side of each cube face, a power of two 16..1024 (default 256). */
  size?: number;
  /** Turns the panorama about the vertical axis, degrees (default 0): positive moves it to the right. */
  rotationDeg?: number;
  /** Scales every value (default 1). */
  exposure?: number;
  /**
   * The largest value kept (default 4096). A photographed sun is tens of
   * thousands of times brighter than the sky round it; left as it is, the
   * few texels that hold it flicker in every rough reflection.
   */
  maxRadiance?: number;
}

const TAU = Math.PI * 2;

/**
 * Where a world direction lies in a panorama, as u (0 at the left edge, 1 at
 * the right) and v (0 at the top). The middle of the picture is what lies
 * toward -Z, its left edge and right edge meet toward +Z, and +X is a
 * quarter of the width right of the middle: the layout of an
 * equirectangular photograph as glTF viewers and three.js read it.
 */
export function zhudaEquirectUv(x: number, y: number, z: number): [number, number] {
  const length = Math.hypot(x, y, z) || 1;
  const u = 0.5 + Math.atan2(x, -z) / TAU;
  const v = Math.acos(Math.max(-1, Math.min(1, y / length))) / Math.PI;
  return [u - Math.floor(u), v];
}

/** The direction a point of a panorama shows: the inverse of `zhudaEquirectUv`. */
export function zhudaEquirectDirection(u: number, v: number): [number, number, number] {
  const longitude = (u - 0.5) * TAU,
    polar = v * Math.PI;
  const ring = Math.sin(polar);
  return [ring * Math.sin(longitude), Math.cos(polar), -ring * Math.cos(longitude)];
}

function checkImage(image: ZhudaHdrImage) {
  if (
    !Number.isInteger(image?.width) ||
    !Number.isInteger(image?.height) ||
    image.width < 2 ||
    image.height < 1 ||
    !(image.rgb instanceof Float32Array) ||
    image.rgb.length !== image.width * image.height * 3
  )
    throw Error('Invalid panorama: width, height and width*height*3 floats are required');
}

/**
 * A panorama as a cube picture of world directions (the input of
 * `prefilterZhudaEnvironment`). Each texel is the mean of the panorama under
 * it, so a small face of a large panorama does not alias. Pure.
 */
export function zhudaEquirectToCube(
  image: ZhudaHdrImage,
  options: ZhudaEquirectOptions = {},
): ZhudaCubePicture {
  checkImage(image);
  const size = options.size ?? 256,
    exposure = options.exposure ?? 1,
    limit = options.maxRadiance ?? 4096,
    turn = ((options.rotationDeg ?? 0) / 360) % 1;
  if (!Number.isInteger(size) || size < 16 || size > 1024 || (size & (size - 1)) !== 0)
    throw Error('Cube face size must be a power of two between 16 and 1024');
  if (!(exposure >= 0) || !Number.isFinite(exposure)) throw Error('exposure must be 0 or more');
  if (!(limit > 0)) throw Error('maxRadiance must be more than 0');
  if (!Number.isFinite(turn)) throw Error('rotationDeg must be a number');
  const { width, height, rgb } = image;
  // Bilinear lookup, wrapping round the picture and clamped at the poles.
  const out = [0, 0, 0];
  const lookup = (u: number, v: number) => {
    const fx = (u - Math.floor(u)) * width - 0.5,
      fy = Math.min(height - 1, Math.max(0, v * height - 0.5));
    const x0 = Math.floor(fx),
      y0 = Math.floor(fy),
      ax = fx - x0,
      ay = fy - y0;
    const xa = ((x0 % width) + width) % width,
      xb = (xa + 1) % width,
      yb = Math.min(height - 1, y0 + 1);
    for (let c = 0; c < 3; c++) {
      const top = rgb[(y0 * width + xa) * 3 + c] * (1 - ax) + rgb[(y0 * width + xb) * 3 + c] * ax,
        bottom = rgb[(yb * width + xa) * 3 + c] * (1 - ax) + rgb[(yb * width + xb) * 3 + c] * ax;
      out[c] = top * (1 - ay) + bottom * ay;
    }
    return out;
  };
  // Taps a texel: enough that neighbouring taps are about a panorama pixel apart.
  const taps = Math.max(1, Math.min(8, Math.round(width / (4 * size))));
  const data = new Float32Array(size * size * 24);
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let tj = 0; tj < taps; tj++)
          for (let ti = 0; ti < taps; ti++) {
            const d = zhudaCubeDirection(
              face,
              (2 * (i + (ti + 0.5) / taps)) / size - 1,
              (2 * (j + (tj + 0.5) / taps)) / size - 1,
            );
            const [u, v] = zhudaEquirectUv(d[0], d[1], d[2]);
            // Turning the panorama to the right is looking further left in it.
            const c = lookup(u - turn, v);
            r += Math.min(limit, c[0]);
            g += Math.min(limit, c[1]);
            b += Math.min(limit, c[2]);
          }
        const o = (face * size * size + j * size + i) * 4,
          scale = exposure / (taps * taps);
        data[o] = Math.max(0, r * scale);
        data[o + 1] = Math.max(0, g * scale);
        data[o + 2] = Math.max(0, b * scale);
        data[o + 3] = 1;
      }
  return { size, data };
}

export interface ZhudaStudioOptions {
  /** Side of each cube face, a power of two 16..256 (default 64). */
  size?: number;
  /** Brightness of the lamps against the default, 0..16 (default 1). */
  intensity?: number;
  /** Colour of the walls, linear 0..1 (default a neutral grey). */
  walls?: readonly [number, number, number];
}

/** One lamp of the studio: a rectangle on a wall of the room, by the wall's axis and side. */
interface StudioLamp {
  axis: 0 | 1 | 2;
  side: 1 | -1;
  /** Centre and half size on the wall, in the wall's two other axes, as fractions of the room's half size. */
  centre: [number, number];
  half: [number, number];
  radiance: [number, number, number];
}

/**
 * A room of plain walls with a large soft lamp overhead, a window to one
 * side and two smaller lamps: enough to give a metal or a lacquer something
 * to reflect and a model even light, where a scene has no surroundings of
 * its own (a model viewer, a shop, a menu). Radiance arriving at the middle
 * of the room, as a cube picture. Pure, and the same every time.
 */
export function zhudaStudioEnvironment(options: ZhudaStudioOptions = {}): ZhudaCubePicture {
  const size = options.size ?? 64,
    intensity = options.intensity ?? 1,
    walls = options.walls ?? [0.32, 0.32, 0.34];
  if (!Number.isInteger(size) || size < 16 || size > 256 || (size & (size - 1)) !== 0)
    throw Error('Studio face size must be a power of two between 16 and 256');
  if (!(intensity >= 0 && intensity <= 16)) throw Error('Studio intensity must be 0..16');
  if (walls.length !== 3 || !walls.every((value) => value >= 0 && value <= 1))
    throw Error('Studio walls must be three values 0..1');
  // The room: 8 wide (x), 5 high (y), 10 deep (z), seen from 1.5 above its floor.
  const half = [4, 2.5, 5],
    eye = [0, -1, 0];
  const lamps: StudioLamp[] = [
    // Overhead, wide and soft.
    { axis: 1, side: 1, centre: [0, 0.1], half: [0.55, 0.45], radiance: [5.4, 5.4, 5.6] },
    // A window on the left wall, cooler.
    { axis: 0, side: -1, centre: [0.25, -0.2], half: [0.45, 0.55], radiance: [3.1, 3.5, 4.2] },
    // A warm lamp to the right and one behind.
    { axis: 0, side: 1, centre: [0.1, 0.45], half: [0.3, 0.18], radiance: [4.5, 3.7, 2.8] },
    { axis: 2, side: 1, centre: [-0.35, 0.2], half: [0.22, 0.4], radiance: [2.4, 2.4, 2.4] },
  ];
  // Light the walls give back: brighter near the ceiling lamp, darker toward the floor.
  const wall = (axis: number, side: number, point: number[]) => {
    const height = (point[1] + half[1]) / (2 * half[1]);
    const lift = axis === 1 ? (side > 0 ? 1.15 : 0.45) : 0.55 + 0.5 * height;
    return walls.map((value) => value * lift * 0.9);
  };
  const data = new Float32Array(size * size * 24);
  for (let face = 0; face < 6; face++)
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const d = zhudaCubeDirection(face, (2 * (i + 0.5)) / size - 1, (2 * (j + 0.5)) / size - 1);
        // The wall the ray from the eye meets first.
        let best = Infinity,
          axis = 0,
          side = 1;
        for (let a = 0; a < 3; a++) {
          if (Math.abs(d[a]) < 1e-9) continue;
          const s = d[a] > 0 ? 1 : -1,
            t = (s * half[a] - eye[a]) / d[a];
          if (t > 0 && t < best) {
            best = t;
            axis = a;
            side = s;
          }
        }
        const point = [eye[0] + d[0] * best, eye[1] + d[1] * best, eye[2] + d[2] * best];
        const others = [0, 1, 2].filter((a) => a !== axis);
        const p = others.map((a) => point[a] / half[a]);
        let colour = wall(axis, side, point);
        for (const lamp of lamps) {
          if (lamp.axis !== axis || lamp.side !== side) continue;
          // A soft edge a tenth of the lamp wide, so that no mip level sees a hard step.
          const edge = (value: number, centre: number, extent: number) =>
            Math.max(0, Math.min(1, (extent - Math.abs(value - centre)) / (extent * 0.1) + 0.5));
          const inside =
            edge(p[0], lamp.centre[0], lamp.half[0]) * edge(p[1], lamp.centre[1], lamp.half[1]);
          if (inside > 0)
            colour = colour.map(
              (value, c) => value * (1 - inside) + lamp.radiance[c] * intensity * inside,
            );
        }
        const o = (face * size * size + j * size + i) * 4;
        data[o] = colour[0];
        data[o + 1] = colour[1];
        data[o + 2] = colour[2];
        data[o + 3] = 1;
      }
  return { size, data };
}

export interface ZhudaHdrEnvironmentSource {
  /** The panorama (`decodeRadianceHdr`), or a cube picture made elsewhere (`zhudaStudioEnvironment`). */
  panorama?: ZhudaHdrImage;
  cube?: ZhudaCubePicture;
}

export interface ZhudaHdrEnvironmentOptions extends ZhudaEquirectOptions, ZhudaPrefilterOptions {
  /** Scales reflections, 0..8 (default 1). */
  reflection?: number;
  /** Scales the ambient light, 0..8 (default 1). */
  ambient?: number;
}

/** A panorama or a cube picture, prefiltered: what `createPrefilteredEnvironment` uploads. Pure. */
export function prefilterZhudaHdrEnvironment(
  source: ZhudaHdrEnvironmentSource,
  options: ZhudaHdrEnvironmentOptions = {},
) {
  if (!source?.panorama === !source?.cube) throw Error('Give either a panorama or a cube picture');
  const prefilterSize = options.size !== undefined && options.size <= 256 ? options.size : 64;
  const cube =
    source.cube ??
    zhudaEquirectToCube(source.panorama!, {
      // Twice the prefiltered size, so that its largest level is a mean of four texels.
      size: Math.min(1024, prefilterSize * 2),
      rotationDeg: options.rotationDeg,
      exposure: options.exposure,
      maxRadiance: options.maxRadiance,
    });
  return prefilterZhudaEnvironment(cube, { size: prefilterSize, samples: options.samples });
}

/**
 * A panorama made smaller by whole steps (each pixel the mean of a square of
 * the source), until neither side is over a limit. Pure.
 */
export function zhudaShrinkPanorama(image: ZhudaHdrImage, maxWidth: number): ZhudaHdrImage {
  checkImage(image);
  let step = 1;
  while (image.width / step > maxWidth) step *= 2;
  if (step === 1) return image;
  const width = Math.max(1, Math.floor(image.width / step)),
    height = Math.max(1, Math.floor(image.height / step));
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = 0; dy < step; dy++)
          for (let dx = 0; dx < step; dx++)
            sum += image.rgb[((y * step + dy) * image.width + x * step + dx) * 3 + c];
        rgb[(y * width + x) * 3 + c] = sum / (step * step);
      }
  return { width, height, rgb };
}

/**
 * The sky a blurred reflection would show: the panorama a prefiltered cube
 * level stands for, as a small panorama. `level` 0 is the sharpest. Pure.
 */
export function zhudaBlurredPanorama(
  prefiltered: ReturnType<typeof prefilterZhudaEnvironment>,
  level: number,
  width = 256,
): ZhudaHdrImage {
  const { spec, pixels } = prefiltered;
  const entry = spec.levels[Math.max(0, Math.min(spec.levels.length - 1, Math.round(level)))];
  const size = entry.size,
    height = Math.max(1, width >> 1);
  const rgb = new Float32Array(width * height * 3);
  // The prefiltered cube is stored as LayaAir looks it up: with the X axis mirrored.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const d = zhudaEquirectDirection((x + 0.5) / width, (y + 0.5) / height);
      const [face, s, t] = zhudaCubeTexel(-d[0], d[1], d[2]);
      // Bilinear inside the face; a face's edge is clamped, which is under a texel of a small level.
      const fx = Math.min(size - 1, Math.max(0, ((s + 1) / 2) * size - 0.5)),
        fy = Math.min(size - 1, Math.max(0, ((t + 1) / 2) * size - 0.5));
      const x0 = Math.floor(fx),
        y0 = Math.floor(fy),
        x1 = Math.min(size - 1, x0 + 1),
        y1 = Math.min(size - 1, y0 + 1),
        ax = fx - x0,
        ay = fy - y0;
      const at = (i: number, j: number, c: number) =>
        pixels[entry.offset + (face * size * size + j * size + i) * 4 + c];
      for (let c = 0; c < 3; c++)
        rgb[(y * width + x) * 3 + c] =
          (at(x0, y0, c) * (1 - ax) + at(x1, y0, c) * ax) * (1 - ay) +
          (at(x0, y1, c) * (1 - ax) + at(x1, y1, c) * ax) * ay;
    }
  return { width, height, rgb };
}

export interface ZhudaHdrEnvironmentApplyOptions extends ZhudaHdrEnvironmentOptions {
  /**
   * Draws the panorama as the sky (default: yes for a panorama, no for a
   * cube picture, which has no panorama to show). The camera given here, or
   * the scene's first, is set to clear with the sky.
   */
  sky?: boolean;
  camera?: any;
  /**
   * How soft the sky is, 0..1 (default 0, the photograph as it is). Above 0
   * the sky is the panorama as a surface of that roughness would reflect
   * it: a backdrop that does not compete with what stands before it.
   */
  skyBlur?: number;
  /** Widest sky texture, 256..4096 (default 2048); a wider panorama is made smaller. */
  skyWidth?: number;
  /**
   * How the light is stored on the graphics card (default: the best this
   * device filters): 32-bit floats, 16-bit floats, or 8 bits with a divisor.
   */
  format?: ZhudaEnvironmentFormat;
}

/**
 * LayaAir's panoramic sky at this rotation shows a panorama's middle toward
 * -Z, as `zhudaEquirectUv` has it and as the light is made; and it turns the
 * other way from the light (`GIRotate`) as its number grows. Both measured:
 * the check draws a patch toward each axis in the sky and in a mirror.
 */
const SKY_TURN_DEG = 270;

/**
 * A panorama (or a cube picture) as the light of a scene: reflections and
 * ambient light from it, and the panorama as the sky. One for a scene at a
 * time; `dispose` gives the scene back what it had.
 */
export class ZhudaHdrEnvironment {
  private readonly l: any;
  private readonly scene: any;
  private readonly environment: ReturnType<typeof createPrefilteredEnvironment>;
  private readonly previous: {
    mode: unknown;
    tex: unknown;
    rgbd: boolean;
    sh: unknown;
    reflection: number;
    ambient: number;
    rotate: number;
    skyMaterial: unknown;
    skyMesh: unknown;
    clearFlag: unknown;
  };
  private readonly camera: any;
  private sky: { material: any; mesh: any; texture: any } | undefined;
  private rotationDeg = 0;
  private disposed = false;
  /** The nine ambient colours (27 numbers), for inspection. */
  readonly ambientSH: readonly number[];

  constructor(
    scene3D: any,
    source: ZhudaHdrEnvironmentSource,
    options: ZhudaHdrEnvironmentApplyOptions = {},
  ) {
    const l = (this.l = (globalThis as any).Laya);
    if (!l?.TextureCube || !scene3D?.sceneReflectionProb)
      throw Error('ZhudaHdrEnvironment: pass a Laya Scene3D');
    for (const key of ['reflection', 'ambient'] as const) {
      const value = options[key];
      if (value !== undefined && !(Number.isFinite(value) && value >= 0 && value <= 8))
        throw Error(`${key} must be 0..8`);
    }
    const blur = options.skyBlur ?? 0;
    if (!(blur >= 0 && blur <= 1)) throw Error('skyBlur must be 0..1');
    const skyWidth = options.skyWidth ?? 2048;
    if (!Number.isInteger(skyWidth) || skyWidth < 256 || skyWidth > 4096)
      throw Error('skyWidth must be 256..4096');
    // Everything is checked before anything is made: a refusal leaves the scene as it was.
    const drawSky = options.sky ?? source?.panorama !== undefined;
    if (drawSky && !source?.panorama)
      throw Error('A sky needs a panorama: a cube picture has none to show');
    if (options.rotationDeg !== undefined && !Number.isFinite(options.rotationDeg))
      throw Error('rotationDeg must be a number');
    this.scene = scene3D;
    // The light is made unturned: turning is LayaAir's own (`GIRotate`), so it costs nothing to change.
    const prefiltered = prefilterZhudaHdrEnvironment(source, { ...options, rotationDeg: 0 });
    this.ambientSH = prefiltered.spec.ambientSH;
    this.camera = options.camera ?? scene3D._cameraPool?.[0];
    this.previous = {
      mode: scene3D.ambientMode,
      tex: scene3D.iblTex,
      rgbd: scene3D.iblTexRGBD === true,
      sh: scene3D.ambientSH,
      reflection: scene3D.reflectionIntensity,
      ambient: scene3D.ambientIntensity,
      rotate: scene3D.GIRotate ?? 0,
      skyMaterial: scene3D.skyRenderer?.material,
      skyMesh: scene3D.skyRenderer?.mesh,
      clearFlag: this.camera?.clearFlag,
    };
    this.environment = createPrefilteredEnvironment(
      prefiltered.spec,
      prefiltered.pixels,
      options.format,
    );
    this.environment.apply(scene3D);
    scene3D.reflectionIntensity = options.reflection ?? 1;
    scene3D.ambientIntensity = options.ambient ?? 1;
    if (drawSky && source.panorama) {
      const exposure = options.exposure ?? 1,
        limit = options.maxRadiance ?? 4096;
      // Soft: the level whose roughness is the blur (LayaAir's levels run r*(2-r)).
      const picture =
        blur > 0
          ? zhudaBlurredPanorama(
              prefiltered,
              (1 - Math.sqrt(1 - blur)) * (prefiltered.spec.levels.length - 1),
            )
          : zhudaShrinkPanorama(source.panorama, skyWidth);
      const scale = blur > 0 ? 1 : exposure;
      const half = l.LayaGL.renderEngine.getCapable(l.RenderCapable.TextureFormat_R16G16B16A16);
      const count = picture.width * picture.height;
      let texture: any;
      if (half) {
        const data = new Uint16Array(count * 4);
        for (let i = 0; i < count; i++) {
          for (let c = 0; c < 3; c++)
            data[i * 4 + c] = zhudaFloatToHalf(
              Math.min(limit * exposure, picture.rgb[i * 3 + c] * scale),
            );
          data[i * 4 + 3] = 0x3c00;
        }
        texture = new l.Texture2D(
          picture.width,
          picture.height,
          l.TextureFormat.R16G16B16A16,
          false,
          false,
          false,
        );
        texture.setPixelsData(data, false, false);
      } else {
        // No 16-bit float textures: the sky as an ordinary picture, clipped at white.
        const data = new Uint8Array(count * 4);
        for (let i = 0; i < count; i++) {
          for (let c = 0; c < 3; c++) {
            const value = Math.min(1, picture.rgb[i * 3 + c] * scale);
            data[i * 4 + c] = Math.round(
              255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055),
            );
          }
          data[i * 4 + 3] = 255;
        }
        texture = new l.Texture2D(
          picture.width,
          picture.height,
          l.TextureFormat.R8G8B8A8,
          false,
          false,
          true,
        );
        texture.setPixelsData(data, false, false);
      }
      texture.filterMode = l.FilterMode.Bilinear;
      // No anisotropic filtering (LayaAir asks for 4x from the start): along
      // the meridian where the picture's edges meet, the panoramic sky's
      // texture coordinate jumps by the whole width of the picture between
      // two pixels, and anisotropic reads spread along that whole row.
      texture.anisoLevel = 1;
      texture.wrapModeU = l.WrapMode.Repeat;
      texture.wrapModeV = l.WrapMode.Clamp;
      const material = new l.SkyPanoramicMaterial();
      material.panoramicTexture = texture;
      // The texture's own values on the screen: LayaAir multiplies by the tint
      // (read as a display colour: a half is 2^-2.2) and by 2^2.2.
      material.tintColor = new l.Color(0.5, 0.5, 0.5, 1);
      material.exposure = 1;
      const mesh = new l.SkyDome();
      const renderer = scene3D.skyRenderer;
      renderer.mesh = mesh;
      renderer.material = material;
      if (this.camera) this.camera.clearFlag = l.CameraClearFlags.Sky;
      this.sky = { material, mesh, texture };
    }
    this.setRotation(options.rotationDeg ?? 0);
  }

  /** How the light is stored on this device. */
  get format(): ZhudaEnvironmentFormat {
    return this.environment.format;
  }

  /** Degrees the surroundings are turned about the vertical axis. */
  get rotation(): number {
    return this.rotationDeg;
  }

  /**
   * Turns the light and the sky together, degrees: positive moves the
   * surroundings to the right. Costs nothing: nothing is filtered again.
   */
  setRotation(degrees: number): void {
    if (this.disposed) throw Error('Disposed environment');
    if (!Number.isFinite(degrees)) throw Error('rotationDeg must be a number');
    this.rotationDeg = degrees;
    this.scene.GIRotate = (degrees * Math.PI) / 180;
    if (this.sky) this.sky.material.rotation = SKY_TURN_DEG - degrees;
  }

  /** Scales reflections and ambient light, each 0..8. */
  setIntensity(reflection: number, ambient: number): void {
    if (this.disposed) throw Error('Disposed environment');
    for (const value of [reflection, ambient])
      if (!(Number.isFinite(value) && value >= 0 && value <= 8))
        throw Error('reflection and ambient must be 0..8');
    this.scene.reflectionIntensity = reflection;
    this.scene.ambientIntensity = ambient;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const scene = this.scene,
      previous = this.previous;
    if (!scene.destroyed) {
      if (this.sky) {
        scene.skyRenderer.material = previous.skyMaterial ?? null;
        scene.skyRenderer.mesh = previous.skyMesh ?? null;
        if (this.camera && !this.camera.destroyed) this.camera.clearFlag = previous.clearFlag;
      }
      scene.iblTex = previous.tex ?? null;
      scene.iblTexRGBD = previous.rgbd;
      scene.ambientMode = previous.mode;
      if (previous.sh) scene.ambientSH = previous.sh;
      scene.reflectionIntensity = previous.reflection;
      scene.ambientIntensity = previous.ambient;
      scene.GIRotate = previous.rotate;
    }
    if (this.sky) {
      this.sky.material.destroy();
      this.sky.mesh.destroy();
      this.sky.texture.destroy();
      this.sky = undefined;
    }
    this.environment.dispose();
  }
}
