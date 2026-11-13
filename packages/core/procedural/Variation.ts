/**
 * A tileable picture of slow, soft changes in brightness around a neutral
 * grey. Laid over a tiled surface at a much larger scale (as the detail map
 * of its material), it makes every tile a little different from the next and
 * hides the repeat that a large floor or road otherwise shows as a grid.
 * Pure and deterministic.
 */

export interface ZhudaVariationOptions {
  /** How far the brightness strays, 0..1: at 1 from about 0.65 to 1.35 times. */
  amount: number;
  /** Edge of the square picture in pixels: 32, 64, 128 or 256 (default 256). */
  size?: number;
  /** Which pattern; the same seed always gives the same picture (default 1). */
  seed?: number;
}

export interface ZhudaBakedVariation {
  size: number;
  /** RGBA, 8 bits, sRGB-encoded; 128 is neutral for LayaAir's detail map. */
  pixels: Uint8Array;
}

export function validateZhudaVariation(options: ZhudaVariationOptions): string[] {
  const issues: string[] = [];
  const o = options ?? ({} as ZhudaVariationOptions);
  if (!(typeof o.amount === 'number' && o.amount >= 0 && o.amount <= 1))
    issues.push('amount: use 0..1');
  if (o.size !== undefined && ![32, 64, 128, 256].includes(o.size))
    issues.push('size: use 32, 64, 128 or 256');
  if (o.seed !== undefined && !(Number.isSafeInteger(o.seed) && o.seed >= 0))
    issues.push('seed: use a whole number 0 or above');
  return issues;
}

/** LayaAir multiplies a detail map, once decoded, by this: sRGB 0.5 comes to 1. */
const DOUBLE = 4.5947938;
const encode = (linear: number) =>
  linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;

/** A value in 0..1 for a lattice point; the same for the same point and seed. */
function lattice(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function bakeZhudaVariation(options: ZhudaVariationOptions): ZhudaBakedVariation {
  const issues = validateZhudaVariation(options);
  if (issues.length) throw Error('Invalid variation: ' + issues.join('; '));
  const size = options.size ?? 256,
    seed = options.seed ?? 1,
    pixels = new Uint8Array(size * size * 4);
  // Three layers of smooth noise whose lattices divide the picture: it tiles.
  const layers: [cells: number, weight: number][] = [
    [5, 0.5],
    [11, 0.3],
    [23, 0.2],
  ];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const values = new Float32Array(size * size);
  let mean = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let value = 0;
      layers.forEach(([cells, weight], layer) => {
        const fx = (x / size) * cells,
          fy = (y / size) * cells;
        const x0 = Math.floor(fx),
          y0 = Math.floor(fy);
        const tx = smooth(fx - x0),
          ty = smooth(fy - y0);
        const at = (i: number, j: number) => lattice(i % cells, j % cells, seed * 31 + layer);
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx,
          bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        value += weight * (top * (1 - ty) + bottom * ty);
      });
      values[y * size + x] = value;
      mean += value;
    }
  mean /= values.length;
  // Summed noise huddles around its mean. Stretch it about the mean until the
  // farthest value reaches the end of the range: the amount then means what it
  // says, and the surface stays as bright on average.
  let reach = 1e-6;
  for (const value of values) reach = Math.max(reach, Math.abs(value - mean));
  for (let i = 0; i < values.length; i++) {
    const factor = 1 + ((values[i] - mean) / reach) * 0.35 * options.amount;
    const grey = Math.round(Math.min(1, Math.max(0, encode(factor / DOUBLE))) * 255);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = grey;
    pixels[i * 4 + 3] = 255;
  }
  return { size, pixels };
}
