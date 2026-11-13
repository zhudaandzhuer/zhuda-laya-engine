/**
 * Numbers that describe a drawn frame, for authors who cannot judge a picture
 * by eye and as a check on those who can. Pure: takes the pixels of a preview.
 *
 * The thresholds behind `flags` were set against frames of this engine (see
 * docs/plans/records/quality-defaults). A flag is a reason to look, not a
 * verdict: a night scene is rightly dark.
 */

/** Twelve hue names, 30 degrees each, starting at red. */
export const ZHUDA_FRAME_HUES = Object.freeze([
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'spring',
  'cyan',
  'azure',
  'blue',
  'violet',
  'magenta',
  'rose',
] as const);

export type ZhudaFrameFlag =
  | 'underexposed'
  | 'burnt-out'
  | 'crushed'
  | 'low-contrast'
  | 'hard-edges';

export interface ZhudaFrameMetrics {
  width: number;
  height: number;
  /** Mean luminance of the encoded picture, 0..1. */
  meanLuminance: number;
  /** Luminance below which 5, 50 and 95 percent of the pixels fall, 0..1. */
  luminance: { p05: number; p50: number; p95: number };
  /** Share of pixels with every channel at or above 250: detail lost in white. */
  clippedShare: number;
  /** Share of pixels with every channel at or below 5: detail lost in black. */
  crushedShare: number;
  /** Mean saturation, 0..1. */
  saturation: number;
  /**
   * Strongly coloured pixels by hue: each hue that covers at least 0.2 percent
   * of the frame, with its share. A hue the scene has no source for is a
   * defect to look into (a stale uniform, a wrong texture).
   */
  vivid: { hue: (typeof ZHUDA_FRAME_HUES)[number]; share: number }[];
  /**
   * Of the strong luminance steps that run along an edge, the share with no
   * softer step on either side: high for outlines drawn without
   * anti-aliasing, low with it. Film grain hides hard edges from it.
   */
  hardEdgeShare: number;
  /** Reasons to look at the frame again; empty when none of the checks fires. */
  flags: ZhudaFrameFlag[];
}

/** Measures an RGBA frame (8 bits per channel, rows top to bottom). */
export function measureZhudaFrame(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): ZhudaFrameMetrics {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 4 ||
    height < 4 ||
    rgba.length !== width * height * 4
  )
    throw Error('Frame metrics: use RGBA pixels of a frame at least 4 by 4');
  const count = width * height,
    histogram = new Uint32Array(256),
    hues = new Uint32Array(12),
    luma = new Uint8Array(count);
  let clipped = 0,
    crushed = 0,
    saturation = 0,
    total = 0;
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    const r = rgba[p],
      g = rgba[p + 1],
      b = rgba[p + 2];
    const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    luma[i] = l;
    histogram[l]++;
    total += l;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      spread = max - min;
    if (min >= 250) clipped++;
    if (max <= 5) crushed++;
    if (max) saturation += spread / max;
    if (spread >= 96 && max >= 96) {
      let hue =
        max === r
          ? ((g - b) / spread) % 6
          : max === g
            ? (b - r) / spread + 2
            : (r - g) / spread + 4;
      if (hue < 0) hue += 6;
      hues[Math.round(hue * 2) % 12]++;
    }
  }
  const percentile = (share: number) => {
    let seen = 0;
    for (let value = 0; value < 256; value++) {
      seen += histogram[value];
      if (seen >= share * count) return +(value / 255).toFixed(3);
    }
    return 1;
  };
  // A strong step between two neighbours counts as an edge only when the next
  // pixel pair along the edge steps the same way: the grain of a texture does
  // not line up, the outline of an object does. `across` is the offset from a
  // pixel to its neighbour over the edge, `along` the offset down the edge.
  let strong = 0,
    hard = 0;
  const step = (i: number, across: number, along: number) => {
    const delta = luma[i + across] - luma[i];
    if (Math.abs(delta) < 64) return;
    const sameStep = (other: number) => other * delta > 0 && Math.abs(other) >= 64;
    if (
      !sameStep(luma[i + across + along] - luma[i + along]) &&
      !sameStep(luma[i + across - along] - luma[i - along])
    )
      return;
    strong++;
    if (
      Math.abs(luma[i] - luma[i - across]) < 8 &&
      Math.abs(luma[i + across] - luma[i + 2 * across]) < 8
    )
      hard++;
  };
  for (let y = 1; y < height - 2; y++)
    for (let x = 1; x < width - 2; x++) {
      const i = y * width + x;
      step(i, 1, width);
      step(i, width, 1);
    }
  const share = (n: number) => +(n / count).toFixed(4);
  const luminance = { p05: percentile(0.05), p50: percentile(0.5), p95: percentile(0.95) };
  const metrics: ZhudaFrameMetrics = {
    width,
    height,
    meanLuminance: +(total / count / 255).toFixed(3),
    luminance,
    clippedShare: share(clipped),
    crushedShare: share(crushed),
    saturation: +(saturation / count).toFixed(3),
    vivid: ZHUDA_FRAME_HUES.map((hue, i) => ({ hue, share: share(hues[i]) })).filter(
      (entry) => entry.share >= 0.002,
    ),
    hardEdgeShare: strong ? +(hard / strong).toFixed(3) : 0,
    flags: [],
  };
  if (luminance.p95 < 0.2) metrics.flags.push('underexposed');
  if (metrics.clippedShare > 0.05) metrics.flags.push('burnt-out');
  if (metrics.crushedShare > 0.5) metrics.flags.push('crushed');
  if (luminance.p95 - luminance.p05 < 0.2) metrics.flags.push('low-contrast');
  if (metrics.hardEdgeShare >= 0.45 && strong >= count / 2000) metrics.flags.push('hard-edges');
  return metrics;
}
