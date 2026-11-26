// Surface detail for the textured beasts (./textured.mjs): height patterns in metres, evaluated
// at the high surface and baked into the normal, occlusion and colour maps. Each pattern returns
// a height in 0..1 (multiply by an amplitude); the edges are soft over about a texel.
import { fbm3, noise3 } from './kit.mjs';

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);

/**
 * A 2D pattern laid on a surface from three sides (by the normal), blended where the sides meet.
 * `f(u, v, axis)` gets the plane's coordinates: axis 0 is (z, y) seen from ±x, 1 is (x, z) from
 * ±y, 2 is (x, y) from ±z; on the side planes v is height (y), so a pattern can hang downward.
 */
export function triplanar(p, n, f, sharp = 6) {
  const w = [Math.abs(n[0]) ** sharp, Math.abs(n[1]) ** sharp, Math.abs(n[2]) ** sharp];
  const t = w[0] + w[1] + w[2] || 1;
  let h = 0;
  if (w[0] > 1e-3 * t) h += (w[0] / t) * f(p[2] * Math.sign(n[0] || 1), p[1], 0);
  if (w[1] > 1e-3 * t) h += (w[1] / t) * f(p[0], p[2], 1);
  if (w[2] > 1e-3 * t) h += (w[2] / t) * f(p[0] * Math.sign(n[2] || 1), p[1], 2);
  return h;
}

/**
 * 雷紋, the thunder pattern of the bronzes: square spirals in square cells, every other cell
 * turning the other way, a raised frame round each cell. (u, v) in cells.
 */
export function thunder(u, v, { turns = 2.5, line = 0.24 } = {}) {
  const cx = Math.floor(u),
    cy = Math.floor(v);
  let fx = u - cx - 0.5;
  const fy = v - cy - 0.5;
  if ((cx + cy) & 1) fx = -fx;
  const d = Math.max(Math.abs(fx), Math.abs(fy)); // 0 at the middle, 0.5 at the frame
  const a = Math.atan2(fy, fx) / (2 * Math.PI) + 0.5;
  const s = d * 2 * turns - a;
  const band = smooth(line - 0.07, line + 0.07, Math.abs(fract(s) - 0.5));
  const frame = smooth(0.43, 0.47, d);
  return Math.max(band * (1 - smooth(0.4, 0.44, d)), frame) * smooth(0.02, 0.06, d);
}

/** Overlapping scales in staggered rows, each rising toward its lower edge. (u, v) in scales; v grows downward. */
export function scales(u, v) {
  const r = Math.floor(v);
  const uu = u + (r & 1) * 0.5;
  const fx = uu - Math.floor(uu) - 0.5;
  const fy = v - r; // 0 at a row's top, 1 at its bottom edge
  const round = 1 - smooth(0.36, 0.5, Math.hypot(fx, (fy - 0.45) * 0.8));
  return smooth(0.0, 0.92, fy) * round * (1 - smooth(0.92, 1.0, fy) * 0.6);
}

/** Plates laid along an axis like an armadillo's bands: each rises toward its rear edge, then steps down. `x` across, `z` along (metres), `pitch` the plate's length. */
export function plates(x, z, pitch) {
  const f = fract(z / pitch);
  const rise = smooth(0.0, 0.88, f) * (1 - smooth(0.88, 0.96, f));
  const keel = 1 - smooth(0.015, 0.04, Math.abs(x)); // a ridge down the middle
  return Math.max(rise * 0.85, keel);
}

/** Bold relief: the cloud scrolls of the old model's gold lines, as raised bands (contours of a slow field). */
export function scrolls(p, { scale = 0.9, levels = 7, width = 0.06, seed = 13 } = {}) {
  const g = fbm3(p[0] * scale + 7, p[1] * scale, p[2] * scale, seed, 2) * levels;
  const d = Math.abs(g - Math.round(g));
  return 1 - smooth(width * 0.6, width, d);
}

/** Fine casting texture and pitting: small-scale noise, 0..1. */
export function casting(p, k = 40) {
  return noise3(p[0] * k, p[1] * k, p[2] * k, 3) * 0.6 + noise3(p[0] * k * 3.1, p[1] * k * 3.1, p[2] * k * 3.1, 5) * 0.4;
}

/** Scratches: thin random strokes, 0..1 (1 on a stroke). */
export function scratches(p, k = 6) {
  const a = fbm3(p[0] * k, p[1] * k * 0.25, p[2] * k, 41, 2);
  const b = fbm3(p[0] * k * 0.3, p[1] * k, p[2] * k * 0.4, 43, 2);
  return Math.max(1 - smooth(0.0, 0.012, Math.abs(a - 0.5)), 1 - smooth(0.0, 0.01, Math.abs(b - 0.5))) * smooth(0.55, 0.7, fbm3(p[0] * 2, p[1] * 2, p[2] * 2, 47, 2));
}
