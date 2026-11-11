/**
 * A full PBR texture set from one colour picture.
 *
 * A photograph (or a generated picture) of a flat surface gives colour only.
 * This derives the rest so the surface reacts to light: it makes the picture
 * wrap without a seam, takes relief from its fine light-and-dark detail
 * (joints and pits are dark, so they sit lower), builds the normal map from
 * that relief and makes low, dirty places rougher than raised, worn ones.
 *
 * Pure and deterministic. The result is a `ZhudaBakedTextureSet`, so it goes
 * wherever a baked recipe goes. The relief is a guess from brightness: it is
 * right for masonry, paving and timber, and wrong where a surface is dark
 * without being low (a stain, a painted mark).
 */
import type { ZhudaBakedTextureSet } from './TextureRecipe.ts';

export interface ZhudaPhotoMaterialOptions {
  /** Id of the set (lowercase letters, digits, dot, dash, underscore). */
  id: string;
  /** Real size of the picture in metres along u and v. */
  tileMeters: [number, number];
  /** Output size, a power of two 16..2048 (default 1024). The picture is resampled. */
  size?: number;
  /** Depth between the lowest and highest point, 0..100 millimetres (default 8). */
  reliefMm?: number;
  /**
   * Width of the detail that counts as relief, as a share of the tile,
   * 0.002..0.25 (default 0.03). Tone changes broader than this are colour, not shape.
   */
  detail?: number;
  /** Roughness of raised, worn areas and of low, dirty ones, 0..1 (default 0.6 and 0.95). */
  roughness?: [number, number];
  /** Share of the edge blended to make the picture wrap, 0..0.25 (default 0.04). */
  seam?: number;
  /**
   * 0..1 (default 0.5): how far broad light-and-dark differences are evened
   * out, which removes uneven lighting baked into the picture.
   */
  flatten?: number;
  metallic?: number;
  normalConvention?: 'directx' | 'opengl';
}

const ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const inRange = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaPhotoMaterial(options: ZhudaPhotoMaterialOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as unknown as Record<string, unknown>;
  if (typeof o.id !== 'string' || !ID.test(o.id))
    issues.push('id: use lowercase letters, digits, dot, dash or underscore (1..64)');
  const tile = o.tileMeters;
  if (!(Array.isArray(tile) && tile.length === 2 && tile.every((n) => inRange(n, 0.001, 10000))))
    issues.push('tileMeters: use [u, v] in metres');
  const size = o.size ?? 1024;
  if (
    !(
      Number.isInteger(size) &&
      inRange(size, 16, 2048) &&
      ((size as number) & ((size as number) - 1)) === 0
    )
  )
    issues.push('size: use a power of two between 16 and 2048');
  for (const [key, min, max] of [
    ['reliefMm', 0, 100],
    ['detail', 0.002, 0.25],
    ['seam', 0, 0.25],
    ['flatten', 0, 1],
    ['metallic', 0, 1],
  ] as const)
    if (o[key] !== undefined && !inRange(o[key], min, max))
      issues.push(`${key}: use ${min}..${max}`);
  if (
    o.roughness !== undefined &&
    !(
      Array.isArray(o.roughness) &&
      o.roughness.length === 2 &&
      o.roughness.every((n) => inRange(n, 0, 1))
    )
  )
    issues.push('roughness: use [raised, low] between 0 and 1');
  if (
    o.normalConvention !== undefined &&
    o.normalConvention !== 'directx' &&
    o.normalConvention !== 'opengl'
  )
    issues.push('normalConvention: use directx or opengl');
  return issues;
}

const toLinear = (byte: number) => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const toSrgb8 = (linear: number) => {
  const c = linear <= 0 ? 0 : linear >= 1 ? 1 : linear;
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
};

/** Box blur that wraps around, run three times (close to a Gaussian). */
function blur(source: Float32Array, size: number, radius: number): Float32Array {
  if (radius < 1) return source.slice();
  let a = source.slice(),
    b = new Float32Array(source.length);
  const window = 2 * radius + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < size; j++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += a[j * size + ((k + size * 8) % size)];
      for (let i = 0; i < size; i++) {
        b[j * size + i] = sum / window;
        sum +=
          a[j * size + ((i + radius + 1) % size)] - a[j * size + ((i - radius + size * 8) % size)];
      }
    }
    for (let i = 0; i < size; i++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += b[((k + size * 8) % size) * size + i];
      for (let j = 0; j < size; j++) {
        a[j * size + i] = sum / window;
        sum +=
          b[((j + radius + 1) % size) * size + i] - b[((j - radius + size * 8) % size) * size + i];
      }
    }
  }
  return a;
}

/**
 * Derives the set. `rgba` is the picture as sRGB bytes, four per pixel, top
 * row first (alpha is ignored).
 */
export function deriveZhudaPhotoMaterial(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: ZhudaPhotoMaterialOptions,
): ZhudaBakedTextureSet {
  const issues = validateZhudaPhotoMaterial(options);
  if (issues.length) throw Error('Invalid photo material: ' + issues.join('; '));
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 8 ||
    height < 8 ||
    width > 8192 ||
    height > 8192
  )
    throw Error('Photo material: picture must be 8..8192 pixels on each side');
  if (rgba.length !== width * height * 4)
    throw Error('Photo material: pixel data does not match the size');
  const size = options.size ?? 1024,
    pixels = size * size;
  // Resample to the output size in linear light (bilinear, clamped).
  const colour = [new Float32Array(pixels), new Float32Array(pixels), new Float32Array(pixels)];
  for (let j = 0; j < size; j++) {
    const y = Math.min(height - 1, Math.max(0, ((j + 0.5) * height) / size - 0.5)),
      y0 = Math.floor(y),
      y1 = Math.min(height - 1, y0 + 1),
      fy = y - y0;
    for (let i = 0; i < size; i++) {
      const x = Math.min(width - 1, Math.max(0, ((i + 0.5) * width) / size - 0.5)),
        x0 = Math.floor(x),
        x1 = Math.min(width - 1, x0 + 1),
        fx = x - x0;
      for (let c = 0; c < 3; c++) {
        const at = (px: number, py: number) => toLinear(rgba[(py * width + px) * 4 + c]);
        colour[c][j * size + i] =
          (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) +
          (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
      }
    }
  }
  // Wrap: inside a band at each edge, fade toward the mirror of the opposite
  // edge so both sides of the seam end at the same value.
  const band = Math.round((options.seam ?? 0.04) * size);
  if (band > 0)
    for (const channel of colour) {
      for (let j = 0; j < size; j++)
        for (let d = 0; d < band; d++) {
          const t = 0.5 * (1 - d / band),
            a = j * size + d,
            b = j * size + size - 1 - d,
            va = channel[a],
            vb = channel[b];
          channel[a] = va + (vb - va) * t;
          channel[b] = vb + (va - vb) * t;
        }
      for (let i = 0; i < size; i++)
        for (let d = 0; d < band; d++) {
          const t = 0.5 * (1 - d / band),
            a = d * size + i,
            b = (size - 1 - d) * size + i,
            va = channel[a],
            vb = channel[b];
          channel[a] = va + (vb - va) * t;
          channel[b] = vb + (va - vb) * t;
        }
    }
  const luminance = new Float32Array(pixels);
  for (let p = 0; p < pixels; p++)
    luminance[p] = 0.2126 * colour[0][p] + 0.7152 * colour[1][p] + 0.0722 * colour[2][p];
  // Even out broad lighting differences.
  const flatten = options.flatten ?? 0.5;
  if (flatten > 0) {
    const broad = blur(luminance, size, Math.max(1, Math.round(size * 0.12)));
    let mean = 0;
    for (let p = 0; p < pixels; p++) mean += broad[p];
    mean /= pixels;
    for (let p = 0; p < pixels; p++) {
      const gain = 1 + (mean / Math.max(broad[p], 1e-4) - 1) * flatten;
      for (const channel of colour) channel[p] *= gain;
      luminance[p] *= gain;
    }
  }
  // Relief: fine detail of the brightness, dark is low. Perceptual brightness
  // keeps dark joints from being crushed.
  const tone = new Float32Array(pixels);
  for (let p = 0; p < pixels; p++) tone[p] = Math.sqrt(Math.max(0, luminance[p]));
  const fine = blur(tone, size, Math.max(1, Math.round(size * 0.0015))),
    coarse = blur(tone, size, Math.max(2, Math.round(size * (options.detail ?? 0.03))));
  const relief = new Float32Array(pixels);
  const sorted = new Float32Array(pixels);
  for (let p = 0; p < pixels; p++) sorted[p] = relief[p] = fine[p] - coarse[p];
  sorted.sort();
  const low = sorted[Math.floor(pixels * 0.01)],
    high = sorted[Math.floor(pixels * 0.99)],
    span = Math.max(high - low, 1e-6),
    depth = (options.reliefMm ?? 8) * 0.001;
  const heightMap = new Float32Array(pixels),
    albedo = new Uint8Array(pixels * 4),
    normal = new Uint8Array(pixels * 4),
    metallicGloss = new Uint8Array(pixels * 4);
  const [raised, sunk] = options.roughness ?? [0.6, 0.95],
    metallic = Math.round((options.metallic ?? 0) * 255);
  for (let p = 0; p < pixels; p++) {
    const level = Math.min(1, Math.max(0, (relief[p] - low) / span)); // 0 low, 1 high
    heightMap[p] = (level - 1) * depth;
    const o = p * 4;
    albedo[o] = toSrgb8(colour[0][p]);
    albedo[o + 1] = toSrgb8(colour[1][p]);
    albedo[o + 2] = toSrgb8(colour[2][p]);
    albedo[o + 3] = 255;
    const roughness = sunk + (raised - sunk) * (level * level * (3 - 2 * level));
    metallicGloss[o] = metallic;
    metallicGloss[o + 1] = 255;
    metallicGloss[o + 3] = Math.round((1 - roughness) * 255);
  }
  // Normals from the relief with wrap-around, like baked recipes.
  const stepU = (2 * options.tileMeters[0]) / size,
    stepV = (2 * options.tileMeters[1]) / size,
    convention = options.normalConvention ?? 'directx',
    flipY = convention === 'directx' ? -1 : 1;
  for (let j = 0; j < size; j++) {
    const up = ((j + 1) % size) * size,
      down = ((j - 1 + size) % size) * size;
    for (let i = 0; i < size; i++) {
      const right = (i + 1) % size,
        left = (i - 1 + size) % size;
      const nx = -(heightMap[j * size + right] - heightMap[j * size + left]) / stepU,
        ny = -(heightMap[up + i] - heightMap[down + i]) / stepV,
        scale = 1 / Math.hypot(nx, ny, 1),
        o = (j * size + i) * 4;
      normal[o] = Math.round((nx * scale * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round((ny * scale * flipY * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round((scale * 0.5 + 0.5) * 255);
      normal[o + 3] = 255;
    }
  }
  return {
    id: options.id,
    size,
    tileMeters: [options.tileMeters[0], options.tileMeters[1]],
    normalConvention: convention,
    albedo,
    normal,
    metallicGloss,
    height: heightMap,
    bytes: pixels * 12,
  };
}
