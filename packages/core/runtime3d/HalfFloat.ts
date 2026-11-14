/** 16-bit floats, for light stored at half the size of 32-bit floats. Pure. */

/** A 32-bit float as the 16 bits of a half float, rounded to nearest; values past its range become its largest. */
export function zhudaFloatToHalf(value: number): number {
  if (!(value > 0)) return 0;
  if (value >= 65504) return 0x7bff;
  // Subnormal halves: steps of 2^-24.
  if (value < 6.103515625e-5) return Math.round(value / 5.960464477539063e-8);
  const exponent = Math.floor(Math.log2(value));
  const mantissa = Math.round((value / 2 ** exponent - 1) * 1024);
  if (mantissa === 1024) return ((exponent + 16) << 10) & 0x7fff;
  return ((exponent + 15) << 10) | mantissa;
}

/** Float pixels as half floats. */
export function zhudaToHalfFloats(pixels: Float32Array): Uint16Array {
  const out = new Uint16Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) out[i] = zhudaFloatToHalf(pixels[i]);
  return out;
}

/**
 * Scene-linear RGBA float pixels as LayaAir's RGBD: 8 bits a channel, with
 * the colour divided by its largest channel where that is over 1 and the
 * divisor's reciprocal in alpha (`decodeRGBD`: rgb / a). Reaches 255; coarse
 * above 1, and filtered on encoded values.
 */
export function zhudaToRgbd(pixels: Float32Array): Uint8Array {
  const out = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const peak = Math.max(r, g, b);
    // Alpha is 1/peak in 8 bits, never under 1/255; the colour is divided by what alpha holds.
    const alpha = peak <= 1 ? 255 : Math.max(1, Math.round(255 / peak));
    const scale = alpha;
    out[i] = Math.min(255, Math.round(Math.max(0, r) * scale));
    out[i + 1] = Math.min(255, Math.round(Math.max(0, g) * scale));
    out[i + 2] = Math.min(255, Math.round(Math.max(0, b) * scale));
    out[i + 3] = alpha;
  }
  return out;
}
