// The island's top as the game reads it: the heights source/island.py shaped the mesh with.
import { island } from './island-data.ts';

export type XZ = readonly [number, number];

/** Height of the island's top at a place, or null off the island (bilinear on the 0.2 m grid). */
export function groundAt(x: number, z: number): number | null {
  const { step, count, origin, heights } = island;
  const fx = (x - origin) / step,
    fz = (z - origin) / step;
  const ix = Math.floor(fx),
    iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= count - 1 || iz >= count - 1) return null;
  const tx = fx - ix,
    tz = fz - iz;
  const h00 = heights[iz * count + ix],
    h10 = heights[iz * count + ix + 1],
    h01 = heights[(iz + 1) * count + ix],
    h11 = heights[(iz + 1) * count + ix + 1];
  if (h00 === null || h10 === null || h01 === null || h11 === null) {
    // At the rim: the nearest known corner, so the edge is not ragged by a cell.
    const near = [
      [h00, (1 - tx) * (1 - tz)],
      [h10, tx * (1 - tz)],
      [h01, (1 - tx) * tz],
      [h11, tx * tz],
    ] as const;
    let best: number | null = null,
      weight = 0.35;
    for (const [h, w] of near) if (h !== null && w > weight) (best = h), (weight = w);
    return best;
  }
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

/** Radius of the island's rim at an angle (128 samples round the circle). */
export function rimAt(angle: number): number {
  const n = island.rim.length;
  const f = ((((angle / (2 * Math.PI)) % 1) + 1) % 1) * n;
  const i = Math.floor(f),
    t = f - i;
  return island.rim[i % n] * (1 - t) + island.rim[(i + 1) % n] * t;
}

/** How far inside the rim a place is, metres (negative outside). */
export function insideBy(x: number, z: number): number {
  return rimAt(Math.atan2(z, x)) - Math.hypot(x, z);
}

/** < 1 inside the pond's shore, as the island tool measures it. */
export function pondDistance(x: number, z: number): number {
  const [cx, cz] = island.pond.center;
  const [rx, rz] = island.pond.radii;
  const a = Math.atan2(z - cz, x - cx);
  const wobble = 1 + 0.08 * Math.sin(3 * a + 0.5) + 0.05 * Math.sin(5 * a + 1.9);
  return Math.hypot((x - cx) / rx, (z - cz) / rz) / wobble;
}

export function pathDistance(x: number, z: number): number {
  let best = Infinity;
  const p = island.path;
  for (let i = 0; i + 1 < p.length; i++) {
    const [ax, az] = p[i],
      [bx, bz] = p[i + 1];
    const dx = bx - ax,
      dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

export const WATER_Y = island.pond.water;
export const HOUSE = island.house;
export const TREE = island.tree;
export const POND = island.pond;
