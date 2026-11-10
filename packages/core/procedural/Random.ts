/**
 * Deterministic, forkable random source for procedural content.
 *
 * The same seed and the same call order always produce the same values on
 * every platform (32-bit integer arithmetic only). Gameplay authority still
 * belongs to the consumer; this stream is for authored variation such as
 * prop placement, wear and decals.
 */
export interface ZhudaRandom {
  readonly seed: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /**
   * Independent child stream. A labelled fork depends only on the parent seed
   * and the label, so adding draws to the parent never reshuffles the child.
   * Unlabelled forks are numbered in call order.
   */
  fork(label?: string | number): ZhudaRandom;
}

function mixLabel(seed: number, label: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createZhudaRandom(seed: number): ZhudaRandom {
  if (!Number.isFinite(seed)) throw Error('Random seed must be a finite number');
  const initial = Math.floor(seed) >>> 0;
  let state = initial;
  let forks = 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min)
      throw Error('Random range requires finite min <= max');
    return min + (max - min) * next();
  };
  return {
    seed: initial,
    next,
    range,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min)
        throw Error('Random int requires integer min <= max');
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (!items.length) throw Error('Cannot pick from an empty list');
      return items[Math.floor(next() * items.length)];
    },
    fork(label) {
      return createZhudaRandom(
        mixLabel(initial, label === undefined ? `#${forks++}` : String(label)),
      );
    },
  };
}
