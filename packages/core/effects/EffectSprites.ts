/**
 * The pictures particles are drawn with, made by a program: white shapes with
 * their own alpha, tinted by an emitter's colours. No file is shipped or
 * loaded; a sprite is the same bytes every time for the same id and size.
 *
 * `bakeZhudaEffectSprite(id, size)` gives straight (not premultiplied) RGBA,
 * row by row from the top. Pure: no LayaAir, no canvas.
 */
import { zhudaFbm2D } from '../shaders/ZhudaCommon.ts';

/** What each built-in sprite is for. */
export const ZHUDA_EFFECT_SPRITES = Object.freeze({
  soft: 'A soft round glow that fades to nothing at its edge: light, magic, embers, fireflies.',
  disc: 'A round dot with a firm edge: bubbles of colour, confetti, debris seen small.',
  ring: 'A thin ring: a shock wave, a ripple, a halo.',
  spark: 'A four-pointed star with a bright core: sparks, glints, stars.',
  streak:
    'A thin line that fades at both ends, lying along the picture: rain, speed lines, sparks in flight.',
  smoke: 'An uneven soft puff: smoke, dust, steam, mist, cloud.',
  flame: 'A teardrop, round below and pointed above: a tongue of fire.',
  flake: 'A six-armed snow crystal.',
  leaf: 'A leaf with a midrib.',
  petal: 'A rounded petal.',
  bubble: 'A clear ball: a bright rim and a highlight.',
} as const);

export type ZhudaEffectSpriteId = keyof typeof ZHUDA_EFFECT_SPRITES;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Alpha 0..1 of a sprite at (u, v), each -1..1 with v up. */
const SHAPES: Record<ZhudaEffectSpriteId, (u: number, v: number) => number> = {
  soft: (u, v) => {
    const r = Math.hypot(u, v);
    return r >= 1 ? 0 : Math.pow(1 - r * r, 2.2);
  },
  disc: (u, v) => 1 - smooth(0.78, 0.92, Math.hypot(u, v)),
  ring: (u, v) => {
    const d = Math.abs(Math.hypot(u, v) - 0.78);
    return 1 - smooth(0.05, 0.16, d);
  },
  spark: (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 1) return 0;
    const arm = (a: number, b: number) =>
      Math.exp(-Math.pow(Math.abs(b) / 0.045, 1.4)) * Math.pow(1 - Math.min(1, Math.abs(a)), 1.5);
    const core = Math.exp(-(r * r) / 0.02);
    return Math.min(1, arm(u, v) + arm(v, u) + core) * (1 - smooth(0.85, 1, r));
  },
  streak: (u, v) => {
    const along = 1 - smooth(0.25, 1, Math.abs(u));
    return along * Math.exp(-Math.pow(Math.abs(v) / 0.07, 2));
  },
  smoke: (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 1) return 0;
    const lumps = zhudaFbm2D(u * 2.3 + 11.7, v * 2.3 + 4.1) / 0.97;
    const body = 1 - smooth(0.25 + lumps * 0.45, 0.6 + lumps * 0.4, r);
    return body * (0.55 + 0.45 * lumps) * (1 - smooth(0.82, 1, r));
  },
  flame: (u, v) => {
    // Round at the bottom (v = -0.55), a point at the top (v = 0.95).
    const t = (v + 0.95) / 1.9;
    if (t <= 0 || t >= 1) return 0;
    const half = 1.18 * Math.sqrt(t) * Math.pow(1 - t, 0.9);
    const edge = 1 - smooth(half * 0.35, half, Math.abs(u));
    return edge * smooth(0, 0.1, t);
  },
  flake: (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 0.95) return 0;
    let best = 0;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3,
        along = u * Math.cos(a) + v * Math.sin(a),
        across = -u * Math.sin(a) + v * Math.cos(a);
      let arm = Math.exp(-Math.pow(Math.abs(across) / 0.05, 2));
      // Two pairs of side branches on each arm.
      for (const at of [0.38, 0.62]) {
        const d = Math.abs(along) - at;
        const side = Math.abs(Math.abs(across) - Math.max(0, d) * 1.2);
        if (d > 0 && d < 0.2) arm = Math.max(arm, Math.exp(-Math.pow(side / 0.04, 2)));
      }
      best = Math.max(best, arm);
    }
    return best * (1 - smooth(0.8, 0.95, r)) + Math.exp(-(r * r) / 0.01) * 0.6;
  },
  leaf: (u, v) => {
    const t = (v + 0.9) / 1.8;
    if (t <= 0 || t >= 1) return 0;
    const half = 0.5 * Math.sin(Math.PI * Math.pow(t, 0.8));
    const body = 1 - smooth(half * 0.82, half, Math.abs(u));
    const rib = 1 - 0.35 * Math.exp(-Math.pow(u / 0.035, 2));
    return body * rib;
  },
  petal: (u, v) => {
    const t = (v + 0.9) / 1.8;
    if (t <= 0 || t >= 1) return 0;
    const half = 0.62 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.5)), 0.7);
    return (1 - smooth(half * 0.8, half, Math.abs(u))) * (0.75 + 0.25 * t);
  },
  bubble: (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 0.95) return 0;
    const rim = smooth(0.62, 0.9, r) * (1 - smooth(0.9, 0.95, r));
    const glint = Math.exp(-(Math.pow(u + 0.35, 2) + Math.pow(v - 0.4, 2)) / 0.02);
    return Math.min(1, 0.12 + rim * 0.85 + glint);
  },
};

/** Sizes a sprite may be baked at. */
export const ZHUDA_EFFECT_SPRITE_SIZES = [32, 64, 128, 256] as const;

/**
 * One sprite as straight RGBA: white, with the shape in alpha (four samples a
 * pixel, so edges are smooth at any size).
 */
export function bakeZhudaEffectSprite(id: ZhudaEffectSpriteId, size = 128): Uint8Array {
  const shape = SHAPES[id];
  if (!shape)
    throw Error(
      `Unknown effect sprite ${String(id)}; known: ${Object.keys(ZHUDA_EFFECT_SPRITES).join(', ')}`,
    );
  if (!(ZHUDA_EFFECT_SPRITE_SIZES as readonly number[]).includes(size))
    throw Error(`Effect sprite size: use ${ZHUDA_EFFECT_SPRITE_SIZES.join(', ')}`);
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let alpha = 0;
      for (let s = 0; s < 4; s++) {
        const u = ((x + 0.25 + 0.5 * (s & 1)) / size) * 2 - 1,
          v = 1 - ((y + 0.25 + 0.5 * (s >> 1)) / size) * 2;
        alpha += Math.max(0, Math.min(1, shape(u, v)));
      }
      const o = (y * size + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = 255;
      out[o + 3] = Math.round((alpha / 4) * 255);
    }
  return out;
}
