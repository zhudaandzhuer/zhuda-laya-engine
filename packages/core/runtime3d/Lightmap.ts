/**
 * Baked lightmaps for Laya 3.4.2's native lightmap path. A lightmap stores the
 * diffuse light arriving at a surface (direct and bounced), laid out by the
 * mesh's second UV set. Decoding and encoding are pure; only
 * `createZhudaLightmap` needs the Laya runtime.
 */

export interface ZhudaHdrImage {
  width: number;
  height: number;
  /** Scene-linear RGB, three floats per pixel, top row first. */
  rgb: Float32Array;
}

/** Largest side accepted for a lightmap. */
export const ZHUDA_LIGHTMAP_MAX_SIZE = 4096;
/** Laya's lightmap shader decodes RGBM with this range, in gamma space. */
const RGBM_RANGE = 5;

/**
 * Decodes a Radiance `.hdr` picture (RGBE, flat or run-length encoded, the
 * standard `-Y h +X w` orientation).
 */
export function decodeRadianceHdr(input: ArrayBuffer | Uint8Array): ZhudaHdrImage {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let offset = 0;
  const line = () => {
    let text = '';
    while (offset < bytes.length && bytes[offset] !== 10) {
      if (text.length > 512) throw Error('Radiance HDR: header line too long');
      text += String.fromCharCode(bytes[offset++]);
    }
    if (offset >= bytes.length) throw Error('Radiance HDR: truncated header');
    offset++;
    return text;
  };
  const magic = line();
  if (magic !== '#?RADIANCE' && magic !== '#?RGBE') throw Error('Radiance HDR: bad signature');
  let format = '';
  for (let text = line(); text !== ''; text = line())
    if (text.startsWith('FORMAT=')) format = text.slice(7);
  if (format !== '32-bit_rle_rgbe') throw Error('Radiance HDR: only 32-bit_rle_rgbe is supported');
  const size = /^-Y (\d+) \+X (\d+)$/.exec(line());
  if (!size) throw Error('Radiance HDR: only the -Y +X orientation is supported');
  const height = Number(size[1]),
    width = Number(size[2]);
  if (
    width < 1 ||
    height < 1 ||
    width > ZHUDA_LIGHTMAP_MAX_SIZE ||
    height > ZHUDA_LIGHTMAP_MAX_SIZE
  )
    throw Error(`Radiance HDR: size must be 1..${ZHUDA_LIGHTMAP_MAX_SIZE}`);
  const rgb = new Float32Array(width * height * 3);
  const row = new Uint8Array(width * 4);
  const need = (count: number) => {
    if (offset + count > bytes.length) throw Error('Radiance HDR: truncated pixels');
  };
  for (let y = 0; y < height; y++) {
    need(4);
    const rle =
      width >= 8 &&
      width < 32768 &&
      bytes[offset] === 2 &&
      bytes[offset + 1] === 2 &&
      (bytes[offset + 2] << 8) + bytes[offset + 3] === width;
    if (rle) {
      offset += 4;
      for (let channel = 0; channel < 4; channel++) {
        let x = 0;
        while (x < width) {
          need(1);
          let count = bytes[offset++];
          if (count > 128) {
            count -= 128;
            need(1);
            if (x + count > width) throw Error('Radiance HDR: run overflows the row');
            const value = bytes[offset++];
            for (let i = 0; i < count; i++) row[(x++ << 2) + channel] = value;
          } else {
            if (!count || x + count > width) throw Error('Radiance HDR: run overflows the row');
            need(count);
            for (let i = 0; i < count; i++) row[(x++ << 2) + channel] = bytes[offset++];
          }
        }
      }
    } else {
      need(width * 4);
      row.set(bytes.subarray(offset, offset + width * 4));
      offset += width * 4;
    }
    for (let x = 0; x < width; x++) {
      const e = row[x * 4 + 3],
        out = (y * width + x) * 3;
      if (!e) continue;
      const scale = Math.pow(2, e - 136);
      rgb[out] = row[x * 4] * scale;
      rgb[out + 1] = row[x * 4 + 1] * scale;
      rgb[out + 2] = row[x * 4 + 2] * scale;
    }
  }
  return { width, height, rgb };
}

/** Brightest linear value a lightmap can hold; brighter texels are clamped. */
export const ZHUDA_LIGHTMAP_MAX_LINEAR = Math.pow(RGBM_RANGE, 2.2);

/**
 * Encodes scene-linear light as the RGBA8 picture Laya's lightmap shader
 * reads: gamma 2.2, RGBM with range 5, straight alpha. `intensity` scales the
 * light first.
 */
export function encodeZhudaLightmapRgbm(image: ZhudaHdrImage, intensity = 1): Uint8Array {
  if (!Number.isFinite(intensity) || intensity < 0) throw Error('Invalid lightmap intensity');
  const { width, height, rgb } = image;
  if (rgb.length !== width * height * 3) throw Error('Invalid lightmap pixels');
  const out = new Uint8Array(width * height * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const r = gamma(rgb[i] * intensity),
      g = gamma(rgb[i + 1] * intensity),
      b = gamma(rgb[i + 2] * intensity);
    // Round the multiplier up so the colour bytes stay within 0..255.
    const m = Math.max(1, Math.ceil((Math.max(r, g, b) / RGBM_RANGE) * 255));
    const scale = 255 / ((m / 255) * RGBM_RANGE);
    out[o] = Math.min(255, Math.round(r * scale));
    out[o + 1] = Math.min(255, Math.round(g * scale));
    out[o + 2] = Math.min(255, Math.round(b * scale));
    out[o + 3] = m;
  }
  return out;
}

function gamma(linear: number): number {
  if (!(linear > 0)) return 0;
  return Math.min(RGBM_RANGE, Math.pow(linear, 1 / 2.2));
}

/** Inverse of `encodeZhudaLightmapRgbm` for one texel (tests and tools). */
export function decodeZhudaLightmapTexel(
  r: number,
  g: number,
  b: number,
  m: number,
): [number, number, number] {
  const scale = (m / 255) * RGBM_RANGE;
  return [r, g, b].map((v) => Math.pow((v / 255) * scale, 2.2)) as [number, number, number];
}

export interface ZhudaLightmap {
  readonly width: number;
  readonly height: number;
  /** The native `Laya.Lightmap` to list in `Scene3D.lightmaps`. */
  readonly lightmap: any;
  dispose(): void;
}

/** Uploads a decoded lightmap. The caller disposes it after the scene stops using it. */
export function createZhudaLightmap(image: ZhudaHdrImage, intensity = 1): ZhudaLightmap {
  const l = (globalThis as any).Laya;
  if (!l?.Lightmap || !l.Texture2D) throw Error('Lightmaps need the Laya 3D runtime');
  const pixels = encodeZhudaLightmapRgbm(image, intensity);
  // Linear RGBA8 without mipmaps: RGBM must not be sRGB-decoded or premultiplied.
  const texture = new l.Texture2D(
    image.width,
    image.height,
    l.TextureFormat.R8G8B8A8,
    false,
    false,
    false,
  );
  texture.filterMode = l.FilterMode.Bilinear;
  texture.wrapModeU = texture.wrapModeV = l.WrapMode.Clamp;
  texture.setPixelsData(pixels, false, false);
  const lightmap = new l.Lightmap();
  lightmap.lightmapColor = texture;
  let disposed = false;
  return {
    width: image.width,
    height: image.height,
    lightmap,
    dispose() {
      if (disposed) return;
      disposed = true;
      lightmap.lightmapColor = null;
      texture.destroy();
    },
  };
}
