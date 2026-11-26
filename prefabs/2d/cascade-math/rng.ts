// Seeded randomness shared with the Go server (prefabs/server/slotmath/rng.go):
// Mulberry32 and the same mapping of a draw to [0, n), so the client replays a server round
// from its seed. Pure TypeScript.
// createSeededRng is the source client's generator (<original-cascade-slot>/client/src/plugs/
// math/, the math pipeline) with one fix: the state wraps at 32 bits. The source let it
// grow as a float, which is identical for the first ~4.9 million draws of a generator and
// drifts after that.

/** Returns a function of uniform floats in [0, 1). */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A source of integers in [0, n). slotmath.RNG in Go. */
export interface IntSource {
  intN(n: number): number;
}

/** Mulberry32 with the Go mapping: intN(n) = floor(draw × n / 2^32), 0 for n ≤ 0. */
export class Mulberry32 implements IntSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** The next raw 32-bit draw. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  intN(n: number): number {
    if (!(n > 0)) return 0;
    return Math.floor((this.next() / 4294967296) * n);
  }
}

/** Integers from Math.random (not replayable; for decoration only, never for money). */
export const mathRandomSource: IntSource = { intN: (n) => (n > 0 ? Math.floor(Math.random() * n) : 0) };

/**
 * A reel strip from symbol counts: ids ascending, each repeated by its count, then a
 * Fisher–Yates shuffle by Mulberry32(seed). Same strip as slotmath.BuildStrip for the same input.
 */
export function buildStrip(counts: Record<number, number>, seed: number): number[] {
  const ids = Object.keys(counts).map(Number).sort((a, b) => a - b);
  const strip: number[] = [];
  for (const id of ids) for (let i = 0; i < counts[id]; i++) strip.push(id);
  const rng = new Mulberry32(seed);
  for (let i = strip.length - 1; i > 0; i--) {
    const j = rng.intN(i + 1);
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
}
