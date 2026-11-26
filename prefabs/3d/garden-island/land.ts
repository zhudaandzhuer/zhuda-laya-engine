// The garden island as numbers: one source for the ground mesh, its colours,
// where grass grows, where things stand and where the character may walk.
// x east, z south (toward the first camera), y up; the sea is y = 0.
import { clamp, lerp, smooth } from '../math.ts';

export type XZ = readonly [number, number];

export const SEA_Y = 0;
/** The pond and the stream share one level (one flat sheet of water). */
export const WATER_Y = 1.95;
export const ISLAND_RADIUS = 40;
/** Half the side of the square the ground mesh covers. */
export const HALF = 52;

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const noise = (x: number, y: number) => {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy),
    b = hash(ix + 1, iy),
    c = hash(ix, iy + 1),
    d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.03, y * 2.03) * 0.28 + noise(x * 4.1, y * 4.1) * 0.17;

/** The shore: the island's radius at an angle. */
export function rimAt(angle: number) {
  return ISLAND_RADIUS * (1 + 0.09 * Math.sin(2 * angle + 0.6) + 0.06 * Math.sin(3 * angle + 2.1) + 0.035 * Math.sin(5 * angle + 0.9) + 0.02 * Math.sin(9 * angle + 1.3));
}
/** Metres inside the shore line (negative: in the sea). */
export function insideBy(x: number, z: number) {
  return rimAt(Math.atan2(z, x)) - Math.hypot(x, z);
}

function segmentDistance(x: number, z: number, line: readonly XZ[]): [number, number] {
  let best = Infinity,
    along = 0,
    run = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i],
      [bx, bz] = line[i + 1];
    const dx = bx - ax,
      dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < best) (best = d), (along = run + t * Math.sqrt(l2));
    run += Math.sqrt(l2);
  }
  return [best, along];
}
/** A polyline rounded by Catmull-Rom, sampled every `step` metres or so. */
function rounded(points: readonly XZ[], step = 0.8): XZ[] {
  const out: XZ[] = [];
  const at = (i: number) => points[clamp(i, 0, points.length - 1)];
  for (let i = 0; i + 1 < points.length; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// ---- the plan (metres) -------------------------------------------------------
/** The lily pond, in the blossom grove. */
export const POND = { center: [11, -9] as XZ, radii: [7.2, 5.2] as XZ, bottom: 1.1 };
/** The far pool the stream ends in. */
export const POOL = { center: [-17, 9] as XZ, radii: [3.4, 2.6] as XZ, bottom: 1.25 };
/** The stream, from the pond to the pool. */
export const STREAM: XZ[] = rounded([
  [5.2, -6.5],
  [1.5, -3.5],
  [-1.5, 1.5],
  [-6.5, 3.0],
  [-9.5, 7.5],
  [-14.2, 8.4],
]);
export const STREAM_HALF = 1.15;
/** The flagstone path: from the landing on the south beach, past the pond, to the terrace. */
export const PATH: XZ[] = rounded([
  [3, 33],
  [4.5, 24],
  [1.5, 15],
  [4.5, 8],
  [9.5, 1.5],
  [14, -1.2],
]);
export const PATH2: XZ[] = rounded([
  [1.5, 15],
  [-5, 12.5],
  [-9.2, 13.6],
  [-14, 16.5],
  [-20, 17.5],
]);
export const PATH_HALF = 0.95;
/** The round stone terrace with lamps. */
export const TERRACE = { center: [-23, 18] as XZ, radius: 4.6, height: 3.05 };
/** Bamboo stands here. */
export const BAMBOO = { center: [-22, -10] as XZ, radii: [9, 12] as XZ };
/** Where the character starts. */
export const START: XZ = [4.2, 21];

/** < 1 inside a pond's shore (an ellipse with a wobbly edge). */
function pondR(x: number, z: number, p: { center: XZ; radii: XZ }, k = 0) {
  const a = Math.atan2(z - p.center[1], x - p.center[0]);
  const wobble = 1 + 0.09 * Math.sin(3 * a + 0.5 + k) + 0.05 * Math.sin(5 * a + 1.9 + k);
  return Math.hypot((x - p.center[0]) / p.radii[0], (z - p.center[1]) / p.radii[1]) / wobble;
}
export const pondDistance = (x: number, z: number) => pondR(x, z, POND);
export const poolDistance = (x: number, z: number) => pondR(x, z, POOL, 2);
export const streamDistance = (x: number, z: number) => segmentDistance(x, z, STREAM)[0];
export const pathDistance = (x: number, z: number) => Math.min(segmentDistance(x, z, PATH)[0], segmentDistance(x, z, PATH2)[0]);
export const terraceDistance = (x: number, z: number) => Math.hypot(x - TERRACE.center[0], z - TERRACE.center[1]);

/**
 * How far a place is from open water, metres (0 on the water's edge, negative in it):
 * the pond, the pool and the stream together.
 */
export function waterEdge(x: number, z: number) {
  const pond = (pondDistance(x, z) - 1) * Math.min(POND.radii[0], POND.radii[1]);
  const pool = (poolDistance(x, z) - 1) * Math.min(POOL.radii[0], POOL.radii[1]);
  const stream = streamDistance(x, z) - STREAM_HALF * (0.85 + 0.3 * noise(x * 0.6, z * 0.6));
  return Math.min(pond, pool, stream);
}

/** Height of the ground at a place. Below the sea it is the sea floor. */
export function heightAt(x: number, z: number): number {
  const inside = insideBy(x, z);
  // The sea floor, the beach (a gentle ramp), then the lawn's shoulder.
  const floor = -2.2 * smooth(0, -9, inside) - 0.25;
  const beach = lerp(-0.25, 0.75, smooth(-1.5, 5.5, inside));
  const shoulder = smooth(5, 11.5, inside);
  // Rolling ground inland: a base a little above the water's level, and low hills.
  const hills = fbm(x * 0.045 + 3.1, z * 0.045 + 7.7);
  const hill = 2.45 + 2.6 * Math.pow(hills, 1.6) + 0.5 * smooth(18, 30, inside);
  let h = inside < 0 ? lerp(beach, floor, smooth(0, -3, inside)) : lerp(beach, hill, shoulder);
  // The ground near water comes down to its banks, so no hill stands in the stream.
  const edge = waterEdge(x, z);
  const bank = WATER_Y + 0.22 + 0.06 * noise(x * 1.3, z * 1.3);
  if (inside > 4) {
    h = lerp(bank + Math.max(0, edge) * 0.09, h, smooth(0.4, 7.5, edge));
    // The beds.
    if (edge < 0.4) {
      const pondBed = lerp(WATER_Y - 0.1, POND.bottom, smooth(1.0, 0.55, pondDistance(x, z)));
      const poolBed = lerp(WATER_Y - 0.1, POOL.bottom, smooth(1.0, 0.5, poolDistance(x, z)));
      const streamBed = lerp(WATER_Y - 0.08, WATER_Y - 0.5, smooth(STREAM_HALF, STREAM_HALF * 0.35, streamDistance(x, z)));
      const bed = Math.min(pondDistance(x, z) < 1.05 ? pondBed : Infinity, poolDistance(x, z) < 1.05 ? poolBed : Infinity, streamDistance(x, z) < STREAM_HALF * 1.3 ? streamBed : Infinity);
      if (bed !== Infinity) h = lerp(h, bed, smooth(0.4, -0.25, edge));
    }
  }
  // The path is worn a little into the lawn; the terrace's ground is level.
  const path = pathDistance(x, z);
  if (path < PATH_HALF + 0.6 && edge > 0.3) h -= 0.05 * smooth(PATH_HALF + 0.6, PATH_HALF * 0.5, path);
  const terrace = terraceDistance(x, z);
  if (terrace < TERRACE.radius + 5) h = lerp(TERRACE.height - 0.35, h, smooth(TERRACE.radius + 0.4, TERRACE.radius + 5, terrace));
  return h;
}

/** The ground the character and things stand on (the terrace's top over its ground). */
export function groundAt(x: number, z: number): number | null {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return null;
  if (terraceDistance(x, z) < TERRACE.radius) return TERRACE.height;
  if (stepAt(x, z)) return STEP_TOP;
  return heightAt(x, z);
}

export type Cover = 'sea' | 'sand' | 'grass' | 'path' | 'bank' | 'bed' | 'terrace';
/** What the ground is made of at a place. */
export function coverAt(x: number, z: number): Cover {
  const inside = insideBy(x, z);
  const h = heightAt(x, z);
  if (inside < -0.5 && h < -0.05) return 'sea';
  const edge = waterEdge(x, z);
  if (inside > 4 && edge < 0) return 'bed';
  if (inside > 4 && edge < 0.55) return 'bank';
  if (terraceDistance(x, z) < TERRACE.radius + 0.9) return 'terrace';
  if (inside < 6.2 + 1.6 * noise(x * 0.3, z * 0.3)) return 'sand';
  if (pathDistance(x, z) < PATH_HALF * (0.8 + 0.45 * noise(x * 0.9, z * 0.9))) return 'path';
  return 'grass';
}

/** Whether grass grows at a place. */
export function grassGrows(x: number, z: number) {
  return coverAt(x, z) === 'grass' && waterEdge(x, z) > 0.75 && pathDistance(x, z) > PATH_HALF + 0.1;
}

/** Whether the character may stand at a place: on land, out of deep water. */
export function walkable(x: number, z: number) {
  if (insideBy(x, z) < 1.2) return false;
  // Wading at the edge of the stream is fine; the middle of a pond is not.
  return waterEdge(x, z) > -0.45 || stepAt(x, z);
}

// ---- what stands on the island ------------------------------------------------
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat stones to step on, across the pond: x, z, radius. Their tops are a hand above the water. */
export const STEPS: [number, number, number][] = [
  [14.6, -3.2, 0.75],
  [13.6, -5.0, 0.6],
  [12.2, -6.6, 0.8],
  [10.6, -8.2, 1.25],
  [8.6, -9.6, 0.65],
  [6.9, -10.9, 0.7],
  [5.4, -12.6, 0.6],
];
export const STEP_TOP = WATER_Y + 0.14;
export function stepAt(x: number, z: number) {
  for (const [sx, sz, r] of STEPS) if (Math.hypot(x - sx, z - sz) < r + 0.25) return true;
  return false;
}

export type TreeKind = 'pink' | 'rose' | 'violet' | 'green';
export interface Tree {
  x: number;
  z: number;
  kind: TreeKind;
  /** Height of the crown's middle, metres. */
  height: number;
  /** Crown radius, metres. */
  crown: number;
  lean: number;
  turn: number;
  shape: number;
}
const free = (x: number, z: number, margin: number) =>
  insideBy(x, z) > 9 && waterEdge(x, z) > margin && pathDistance(x, z) > PATH_HALF + margin * 0.6 && terraceDistance(x, z) > TERRACE.radius + margin + 1 && Math.hypot(x - START[0], z - START[1]) > 3;

export const TREES: Tree[] = (() => {
  const r = seeded(11);
  const out: Tree[] = [];
  const far = (x: number, z: number, d: number) => out.every((t) => Math.hypot(t.x - x, t.z - z) > d);
  const put = (x: number, z: number, kind: TreeKind, size = 1) => {
    if (!free(x, z, 1.6) || !far(x, z, 4.2)) return;
    out.push({ x, z, kind, height: (5.4 + 1.6 * r()) * size, crown: (2.5 + 0.9 * r()) * size, lean: (r() - 0.5) * 0.35, turn: r() * 360, shape: Math.floor(r() * 4) });
  };
  // The blossom grove: a ring round the pond, thicker to the north and east.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const k = 1.55 + 0.5 * r();
    put(POND.center[0] + Math.cos(a) * POND.radii[0] * k, POND.center[1] + Math.sin(a) * POND.radii[1] * k * 1.25, i % 3 === 0 ? 'rose' : 'pink');
  }
  for (let i = 0; i < 26; i++) put(4 + r() * 26, -30 + r() * 26, r() < 0.7 ? 'pink' : 'rose', 0.9 + 0.3 * r());
  // Along the path from the beach: an avenue.
  for (const [x, z] of [[8.6, 19], [-0.5, 26], [7.5, 12], [-2.5, 18.5], [9, 26.5]] as XZ[]) put(x, z, 'pink', 1.1);
  // Violet ones toward the terrace and the west.
  for (let i = 0; i < 90; i++) put(-32 + r() * 30, -2 + r() * 32, 'violet', 0.9 + 0.35 * r());
  // Green trees elsewhere.
  for (let i = 0; i < 160; i++) put(-34 + r() * 68, -34 + r() * 68, 'green', 0.85 + 0.4 * r());
  return out.filter((t) => Math.hypot((t.x - BAMBOO.center[0]) / BAMBOO.radii[0], (t.z - BAMBOO.center[1]) / BAMBOO.radii[1]) > 1.05);
})();

/** Bamboo culms: x, z, height, lean direction (radians), lean amount. */
export const CULMS: [number, number, number, number, number][] = (() => {
  const r = seeded(23);
  const out: [number, number, number, number, number][] = [];
  for (let i = 0; i < 900 && out.length < 150; i++) {
    const a = r() * Math.PI * 2,
      d = Math.sqrt(r());
    const x = BAMBOO.center[0] + Math.cos(a) * d * BAMBOO.radii[0],
      z = BAMBOO.center[1] + Math.sin(a) * d * BAMBOO.radii[1];
    // In clumps: keep where a slow noise is high.
    if (noise(x * 0.35 + 9, z * 0.35) < 0.42 || !free(x, z, 1.2)) continue;
    if (out.some((c) => Math.hypot(c[0] - x, c[1] - z) < 0.55)) continue;
    out.push([x, z, 6.5 + 3.5 * r(), r() * Math.PI * 2, 0.04 + 0.1 * r()]);
  }
  return out;
})();

/** Round bushes: x, z, radius, flowering (0 green, 1 white blossom). */
export const BUSHES: [number, number, number, number][] = (() => {
  const r = seeded(37);
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < 400 && out.length < 60; i++) {
    const x = -34 + r() * 68,
      z = -34 + r() * 68;
    if (!free(x, z, 0.9) || out.some((b) => Math.hypot(b[0] - x, b[1] - z) < 2.4) || TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue;
    out.push([x, z, 0.7 + 0.8 * r(), r() < 0.3 ? 1 : 0]);
  }
  return out;
})();

/** Stones along the water's edge: x, z, size, turn. */
export const ROCKS: [number, number, number, number][] = (() => {
  const r = seeded(53);
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < 4000 && out.length < 110; i++) {
    const x = -24 + r() * 46,
      z = -18 + r() * 34;
    const e = waterEdge(x, z);
    if (e < -0.25 || e > 0.45 || out.some((b) => Math.hypot(b[0] - x, b[1] - z) < 0.75)) continue;
    out.push([x, z, 0.28 + 0.5 * r() * r(), r() * 360]);
  }
  return out;
})();

/** Lantern posts beside the path: x, z, the way the arm points (degrees). */
export const LANTERNS: [number, number, number][] = [
  [5.9, 27, 200],
  [3.2, 18.5, 20],
  [5.9, 9.8, 215],
  [11.2, 2.4, 300],
  [-3.2, 14.1, 120],
  [-12.3, 14.2, 330],
];

/** How much fallen blossom lies at a place, 0..1 (under the blossom trees). */
export function petalsAt(x: number, z: number) {
  let v = 0;
  for (const t of TREES) {
    if (t.kind === 'green') continue;
    const d = Math.hypot(t.x - x, t.z - z) / (t.crown * 1.5);
    if (d < 1) v = Math.max(v, 1 - d);
  }
  return v;
}
