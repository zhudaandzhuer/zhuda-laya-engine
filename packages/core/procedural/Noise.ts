/**
 * Periodic (seamlessly tileable) noise primitives for baked textures.
 *
 * Every function repeats exactly when its lattice period is an integer, so a
 * texture sampled over uv in [0, 1) wraps without a seam. All arithmetic is
 * 32-bit integer hashing plus IEEE doubles; results are identical across
 * platforms and independent of GPU precision.
 */
const U32 = 4294967296;
const TAU = Math.PI * 2;

const wrap = (value: number, period: number) => ((value % period) + period) % period;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Lattice hash -> unsigned 32-bit integer. */
export function latticeHash(ix: number, iy: number, seed: number): number {
  let h =
    Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function gradient(
  ix: number,
  iy: number,
  periodX: number,
  periodY: number,
  seed: number,
  dx: number,
  dy: number,
): number {
  const angle = (latticeHash(wrap(ix, periodX), wrap(iy, periodY), seed) / U32) * TAU;
  return Math.cos(angle) * dx + Math.sin(angle) * dy;
}

/** Periodic gradient noise, roughly in [-1, 1]. */
export function gradientNoise(
  x: number,
  y: number,
  periodX: number,
  periodY: number,
  seed: number,
): number {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    fx = x - x0,
    fy = y - y0,
    u = fade(fx),
    v = fade(fy);
  const a = gradient(x0, y0, periodX, periodY, seed, fx, fy),
    b = gradient(x0 + 1, y0, periodX, periodY, seed, fx - 1, fy),
    c = gradient(x0, y0 + 1, periodX, periodY, seed, fx, fy - 1),
    d = gradient(x0 + 1, y0 + 1, periodX, periodY, seed, fx - 1, fy - 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * Math.SQRT2;
}

/**
 * Fractal noise over one tile, clamped to [0, 1] and centred on 0.5.
 * Frequencies must be positive integers for a seamless result.
 */
export function fractalNoise(
  u: number,
  v: number,
  frequencyX: number,
  frequencyY: number,
  octaves: number,
  seed: number,
): number {
  let amplitude = 0.5,
    sum = 0,
    total = 0,
    fx = frequencyX,
    fy = frequencyY;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * gradientNoise(u * fx, v * fy, fx, fy, seed + octave * 7);
    total += amplitude;
    amplitude *= 0.5;
    fx *= 2;
    fy *= 2;
  }
  const value = (sum / total) * 0.9 + 0.5;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Periodic cellular noise. Writes [nearest distance, second distance, cell id]
 * into `out` (cell id is uniform in [0, 1) and constant inside one cell).
 */
export function cellularNoise(
  x: number,
  y: number,
  periodX: number,
  periodY: number,
  seed: number,
  out: number[],
): number[] {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  let nearest = Infinity,
    second = Infinity,
    id = 0;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const cx = x0 + ox,
        cy = y0 + oy,
        wx = wrap(cx, periodX),
        wy = wrap(cy, periodY),
        px = cx + latticeHash(wx, wy, seed) / U32,
        py = cy + latticeHash(wx, wy, seed + 0x51ed) / U32,
        distance = Math.hypot(px - x, py - y);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        id = latticeHash(wx, wy, seed + 0x2b1f) / U32;
      } else if (distance < second) second = distance;
    }
  out[0] = nearest;
  out[1] = second;
  out[2] = id;
  return out;
}
