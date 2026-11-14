// Radiance .hdr panoramas made here, so that no photograph is checked in:
// a sky with a ground, a small sun, and a coloured patch toward each axis,
// which says which way round a picture of it is.
import { zhudaEquirectDirection } from '../../packages/core/runtime3d/HdrEnvironment.ts';

/** Float RGB as a flat (not run-length encoded) Radiance HDR file. */
export function encodeRadianceHdr({ width, height, rgb }) {
  const header = Buffer.from(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`,
    'latin1',
  );
  const body = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = rgb[i * 3],
      g = rgb[i * 3 + 1],
      b = rgb[i * 3 + 2];
    const peak = Math.max(r, g, b);
    if (peak < 1e-32) continue;
    let exponent = Math.ceil(Math.log2(peak));
    // The mantissa of the largest channel lies in 128..255.
    if (peak / 2 ** exponent >= 1) exponent++;
    const scale = 256 / 2 ** exponent;
    body[i * 4] = Math.min(255, Math.floor(r * scale));
    body[i * 4 + 1] = Math.min(255, Math.floor(g * scale));
    body[i * 4 + 2] = Math.min(255, Math.floor(b * scale));
    body[i * 4 + 3] = exponent + 128;
  }
  return Buffer.concat([header, body]);
}

/** Where the patches stand and what colour they are (linear, under 1 so that a screen shows them unclipped). */
export const PANORAMA_MARKS = {
  '-z': { toward: [0, 0, -1], colour: [0.8, 0.1, 0.1] },
  '+x': { toward: [1, 0, 0], colour: [0.1, 0.7, 0.1] },
  '+z': { toward: [0, 0, 1], colour: [0.1, 0.2, 0.9] },
  '-x': { toward: [-1, 0, 0], colour: [0.8, 0.7, 0.05] },
  '+y': { toward: [0, 1, 0], colour: [0.7, 0.1, 0.8] },
  '-y': { toward: [0, -1, 0], colour: [0.05, 0.6, 0.6] },
};
/** The sun of the marked panorama: its direction, half its width in degrees, its radiance. */
export const PANORAMA_SUN = { toward: [0.5, 0.6, -0.62], halfDeg: 2.5, radiance: 400 };

/**
 * A sky that is light toward the top and a dark ground, with a patch 14
 * degrees across toward each axis and a sun, or without them (`marks: false`)
 * for checks of light alone.
 */
export function makeMarkedPanorama(width = 512, { marks = true, sun = true } = {}) {
  const height = width / 2;
  const rgb = new Float32Array(width * height * 3);
  const unit = (v) => v.map((c) => c / Math.hypot(...v));
  const sunToward = unit(PANORAMA_SUN.toward);
  const patch = Math.cos((14 * Math.PI) / 180),
    disc = Math.cos((PANORAMA_SUN.halfDeg * Math.PI) / 180);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const d = zhudaEquirectDirection((x + 0.5) / width, (y + 0.5) / height);
      const up = Math.max(0, d[1]);
      let colour =
        d[1] >= 0 ? [0.25 + 0.3 * up, 0.35 + 0.35 * up, 0.5 + 0.45 * up] : [0.09, 0.08, 0.07];
      if (marks)
        for (const mark of Object.values(PANORAMA_MARKS))
          if (d[0] * mark.toward[0] + d[1] * mark.toward[1] + d[2] * mark.toward[2] > patch)
            colour = mark.colour;
      if (sun && d[0] * sunToward[0] + d[1] * sunToward[1] + d[2] * sunToward[2] > disc)
        colour = [
          PANORAMA_SUN.radiance,
          PANORAMA_SUN.radiance * 0.95,
          PANORAMA_SUN.radiance * 0.85,
        ];
      rgb.set(colour, (y * width + x) * 3);
    }
  return { width, height, rgb };
}
