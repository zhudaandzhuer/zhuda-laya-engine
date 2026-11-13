/**
 * Grass a player walks through: narrow curved blades in clumps, moved by the
 * wind, lit and shadowed like the ground they stand on.
 *
 * The land is cut into square patches. Only the patches round the eye have a
 * mesh, made as the eye comes near (a few a frame) and dropped when it has
 * gone. A blade far from the eye is one of fewer, each drawn wider, so the
 * cover looks the same while the work falls with distance; blades are taken
 * out one at a time, each shrinking into the ground, so nothing pops. The
 * graphics card does the wind and the thinning: nothing is updated per blade
 * on the CPU after a patch is made.
 *
 * Under the blades lies turf: a sheet on the ground in the colours of the
 * grass, so that earth does not show between blades seen from above. Its
 * edge, where grass stops growing, is ragged.
 *
 * The game says where the ground is and where grass may grow. Blades are
 * geometry (no texture, no alpha): what is far is thinned, not faded. They
 * take shadows and cast none. A blade is not pushed aside by a foot.
 */
import { ZhudaLitSurfaceMaterial } from '../shaders/LitSurfaceMaterial.ts';
import { zhudaDecodeColor } from '../film/ColorValues.ts';

export interface ZhudaGrassOptions {
  /** The land grass may cover, world metres. */
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Height of the ground at a place, or null where there is none. */
  ground: (x: number, z: number) => number | null;
  /** False where nothing grows (a road, a floor, under water). Asked once a clump. */
  grows?: (x: number, z: number, y: number) => boolean;
  /** Blades on a square metre close to the eye, 20..1500 (default 400). */
  density?: number;
  /** Shortest and tallest blade, metres (default [0.14, 0.34]). */
  heightM?: readonly number[];
  /** Width of a blade at its foot, metres, 0.005..0.2 (default 0.03). */
  widthM?: number;
  /** How far from the eye grass is drawn, metres, 10..300 (default 60). */
  distanceM?: number;
  /** Within this distance every blade is drawn, metres (default a twelfth of `distanceM`). */
  fullDensityM?: number;
  /** Side of a patch of land, metres, 2..32 (default 6). */
  patchM?: number;
  /** Colour of a blade at its tip, display RGB 0..1 (default [0.46, 0.6, 0.22]). */
  tip?: readonly number[];
  /** Colour at its foot (default [0.1, 0.19, 0.06]). */
  root?: readonly number[];
  /** Colour dry blades turn toward (default [0.66, 0.62, 0.3]). */
  dry?: readonly number[];
  /** How much of the grass is dry, 0..1 (default 0.3). */
  dryness?: number;
  /** The wind: where it blows toward (degrees from +X toward +Z), how far it bends a blade (0..1) and how fast it moves. */
  wind?: { directionDeg?: number; strength?: number; speed?: number };
  /** The same seed grows the same grass (default 1). */
  seed?: number;
  /** False leaves out the turf under the blades (default true). */
  turf?: boolean;
}

export interface ZhudaGrassResolved {
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
  density: number;
  heightM: [number, number];
  widthM: number;
  distanceM: number;
  fullDensityM: number;
  patchM: number;
  tip: [number, number, number];
  root: [number, number, number];
  dry: [number, number, number];
  dryness: number;
  wind: { directionDeg: number; strength: number; speed: number };
  seed: number;
  turf: boolean;
}

/**
 * The blades of a patch are kept in five meshes by rank: the first holds the
 * few that are drawn far from the eye, each further one those that are added
 * nearer. A patch near the eye has all five, one far away the first only.
 * Coming nearer makes only the blades that are new; going away drops a mesh.
 * `segments` is how many pieces a blade is cut into along its length.
 */
export const ZHUDA_GRASS_BANDS: readonly { from: number; to: number; segments: number }[] = [
  { from: 0, to: 0.06, segments: 2 },
  { from: 0.06, to: 0.12, segments: 2 },
  { from: 0.12, to: 0.25, segments: 2 },
  { from: 0.25, to: 0.5, segments: 2 },
  { from: 0.5, to: 1, segments: 3 },
];
/** A blade's lean is stored as one of this many shares of its height. */
const LEANS = 15;
/** Numbers a blade is stored as: x, y, z of its foot, height, facing angle, lean (a share of the height) and rank. */
export const ZHUDA_GRASS_BLADE_FLOATS = 7;
const RANKS = 255;
const SOFT = 0.35; // the last share of the shown blades is growing or shrinking
const WIDEST = 3; // a far blade is at most this many times its width

const finite = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const colour = (v: unknown) =>
  Array.isArray(v) && v.length === 3 && v.every((c) => finite(c, 0, 1));

/** Problems with grass options; an empty list means a field can be made of them. */
export function validateZhudaGrass(options: ZhudaGrassOptions): string[] {
  const e: string[] = [];
  const o = options as any;
  if (!o || typeof o !== 'object') return ['grass: options must be an object'];
  const a = o.area;
  if (
    !a ||
    !['minX', 'maxX', 'minZ', 'maxZ'].every((k) => finite(a[k], -1e6, 1e6)) ||
    !(a.maxX > a.minX) ||
    !(a.maxZ > a.minZ)
  )
    e.push('grass.area: minX < maxX and minZ < maxZ, finite metres');
  if (typeof o.ground !== 'function') e.push('grass.ground: a function (x, z) => height or null');
  if (o.grows !== undefined && typeof o.grows !== 'function')
    e.push('grass.grows: a function (x, z, y) => boolean');
  if (o.density !== undefined && !finite(o.density, 20, 1500))
    e.push('grass.density: 20..1500 blades a square metre');
  if (o.heightM !== undefined) {
    const h = o.heightM;
    if (
      !Array.isArray(h) ||
      h.length !== 2 ||
      !finite(h[0], 0.02, 1) ||
      !finite(h[1], 0.02, 1) ||
      h[1] < h[0]
    )
      e.push('grass.heightM: [shortest, tallest], 0.02..1 metres');
  }
  if (o.widthM !== undefined && !finite(o.widthM, 0.005, 0.2))
    e.push('grass.widthM: 0.005..0.2 metres');
  if (o.distanceM !== undefined && !finite(o.distanceM, 10, 300))
    e.push('grass.distanceM: 10..300 metres');
  const distance = finite(o.distanceM, 10, 300) ? o.distanceM : 60;
  if (o.fullDensityM !== undefined && !finite(o.fullDensityM, 1, distance))
    e.push('grass.fullDensityM: 1 metre up to distanceM');
  if (o.patchM !== undefined && !finite(o.patchM, 2, 32)) e.push('grass.patchM: 2..32 metres');
  for (const k of ['tip', 'root', 'dry'])
    if (o[k] !== undefined && !colour(o[k])) e.push(`grass.${k}: display RGB, three numbers 0..1`);
  if (o.dryness !== undefined && !finite(o.dryness, 0, 1)) e.push('grass.dryness: 0..1');
  if (o.wind !== undefined) {
    const w = o.wind;
    if (!w || typeof w !== 'object') e.push('grass.wind: an object');
    else {
      if (w.directionDeg !== undefined && !finite(w.directionDeg, -3600, 3600))
        e.push('grass.wind.directionDeg: degrees');
      if (w.strength !== undefined && !finite(w.strength, 0, 1))
        e.push('grass.wind.strength: 0..1');
      if (w.speed !== undefined && !finite(w.speed, 0, 10)) e.push('grass.wind.speed: 0..10');
    }
  }
  if (o.seed !== undefined && !(Number.isInteger(o.seed) && o.seed >= 0 && o.seed <= 0xffffffff))
    e.push('grass.seed: a whole number 0..4294967295');
  if (o.turf !== undefined && typeof o.turf !== 'boolean') e.push('grass.turf: true or false');
  return e;
}

/** The options with every default filled in. Throws what `validateZhudaGrass` lists. */
export function resolveZhudaGrass(options: ZhudaGrassOptions): ZhudaGrassResolved {
  const errors = validateZhudaGrass(options);
  if (errors.length) throw Error(errors.join('; '));
  const distanceM = options.distanceM ?? 60;
  const three = (v: readonly number[] | undefined, d: [number, number, number]) =>
    (v ? [v[0], v[1], v[2]] : d) as [number, number, number];
  return {
    area: { ...options.area },
    density: options.density ?? 400,
    heightM: options.heightM ? [options.heightM[0], options.heightM[1]] : [0.14, 0.34],
    widthM: options.widthM ?? 0.03,
    distanceM,
    fullDensityM: options.fullDensityM ?? distanceM / 12,
    patchM: options.patchM ?? 6,
    tip: three(options.tip, [0.46, 0.6, 0.22]),
    root: three(options.root, [0.1, 0.19, 0.06]),
    dry: three(options.dry, [0.66, 0.62, 0.3]),
    dryness: options.dryness ?? 0.3,
    wind: {
      directionDeg: options.wind?.directionDeg ?? 30,
      strength: options.wind?.strength ?? 0.35,
      speed: options.wind?.speed ?? 1,
    },
    seed: options.seed ?? 1,
    turf: options.turf ?? true,
  };
}

/** The share of blades drawn at a distance from the eye: all of them close by, fewer further off, none past the end. */
export function zhudaGrassShown(distance: number, fullDensityM: number, distanceM: number): number {
  if (!(distance < distanceM)) return 0;
  return Math.min(1, Math.pow(fullDensityM / Math.max(distance, 1e-3), 1.5));
}

/**
 * How many of its meshes a patch whose nearest point is this far from the
 * eye needs: all of `ZHUDA_GRASS_BANDS` close by, one far off, none past
 * the end. A mesh is needed where a blade of its ranks is drawn.
 */
export function zhudaGrassBands(nearest: number, fullDensityM: number, distanceM: number): number {
  if (!(nearest <= distanceM)) return 0;
  const shown = zhudaGrassShown(nearest, fullDensityM, Infinity);
  let bands = 1;
  while (bands < ZHUDA_GRASS_BANDS.length && shown > ZHUDA_GRASS_BANDS[bands].from) bands++;
  return bands;
}

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x: number, z: number, seed: number) => {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Smooth noise 0..1 over the land, one hill every `scale` metres. */
function land(x: number, z: number, scale: number, seed: number) {
  const gx = x / scale,
    gz = z / scale,
    ix = Math.floor(gx),
    iz = Math.floor(gz);
  let fx = gx - ix,
    fz = gz - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed),
    b = hash(ix + 1, iz, seed),
    c = hash(ix, iz + 1, seed),
    d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

const PER_CLUMP = 7;
/** How many clumps a patch of land has. */
export function zhudaGrassPatchClumps(resolved: ZhudaGrassResolved): number {
  return Math.round((resolved.density * resolved.patchM * resolved.patchM) / PER_CLUMP);
}

/**
 * The blades of one patch of land, `ZHUDA_GRASS_BLADE_FLOATS` numbers each.
 * A patch is the square `[px, px + 1) × [pz, pz + 1)` times `patchM`. Blades
 * stand in clumps that open outward like a fountain; the land is thicker and
 * taller in places and thin in others. The same patch always grows the same
 * blades. `ranks` ([from, to), default all) keeps the blades of those ranks:
 * the ranks of `ZHUDA_GRASS_BANDS` together give every blade once, and a
 * narrow range is made quickly. `slice` ([first, end)) makes only those of
 * the patch's clumps, for a patch made over several frames. Pure: no Laya
 * needed.
 */
export function zhudaGrassPatchBlades(
  resolved: ZhudaGrassResolved,
  ground: (x: number, z: number) => number | null,
  grows: ((x: number, z: number, y: number) => boolean) | undefined,
  px: number,
  pz: number,
  ranks: readonly number[] = [0, 1],
  slice?: readonly number[],
): Float32Array {
  const { patchM, area, seed } = resolved;
  const next = random((Math.imul(px, 0x9e3779b1) ^ Math.imul(pz, 0x85ebca77) ^ seed) >>> 0);
  const clumps = zhudaGrassPatchClumps(resolved);
  const from = slice ? slice[0] : 0,
    to = slice ? Math.min(clumps, slice[1]) : clumps;
  // Room for the most a patch can grow; cut to size at the end.
  const out = new Float32Array(
    Math.ceil(Math.max(0, to - from) * PER_CLUMP * 1.75) * ZHUDA_GRASS_BLADE_FLOATS,
  );
  let filled = 0;
  const [short, tall] = resolved.heightM;
  for (let c = 0; c < to; c++) {
    // Five draws a clump whatever becomes of it, so a road through a patch
    // does not change the grass beside it.
    const cx = (px + next()) * patchM,
      cz = (pz + next()) * patchM,
      size = next(),
      turn = next() * Math.PI * 2,
      own = (next() * 4294967296) >>> 0;
    if (c < from) continue;
    if (cx < area.minX || cx >= area.maxX || cz < area.minZ || cz >= area.maxZ) continue;
    // Thick, tall grass in places; thin and short in others.
    const thick = land(cx, cz, 5.5, seed),
      count = Math.round(PER_CLUMP * (0.5 + 0.95 * thick + 0.3 * size));
    // The ground is asked for only when the clump has a blade to stand on it.
    let cy: number | null | undefined,
      sx = 0,
      sz = 0,
      lush = 0;
    for (let k = 0; k < count; k++) {
      const rank = Math.floor(hash(own, k, 1) * RANKS) / RANKS;
      if (rank < ranks[0] || rank >= ranks[1]) continue;
      if (cy === undefined) {
        cy = ground(cx, cz);
        if (cy === null || !Number.isFinite(cy) || (grows && !grows(cx, cz, cy))) cy = null;
        else {
          // The ground's slope under the clump, so blades on a bank stand on it.
          const ex = ground(cx + 0.25, cz),
            ez = ground(cx, cz + 0.25);
          if (ex !== null && Number.isFinite(ex)) sx = Math.max(-2, Math.min(2, (ex - cy) / 0.25));
          if (ez !== null && Number.isFinite(ez)) sz = Math.max(-2, Math.min(2, (ez - cy) / 0.25));
          lush = land(cx, cz, 13, seed ^ 0x5bd1e995);
        }
      }
      if (cy === null) break;
      const r0 = hash(own, k, 2),
        r1 = hash(own, k, 3),
        r2 = hash(own, k, 4),
        r3 = hash(own, k, 5);
      const out01 = Math.sqrt(r0),
        angle = turn + r1 * Math.PI * 2,
        reach = 0.12 + 0.2 * size;
      const dx = Math.cos(angle) * out01 * reach,
        dz = Math.sin(angle) * out01 * reach;
      // Tall in the middle of a clump and where the land is lush.
      const height =
        (short + (tall - short) * Math.pow(r2, 1.6)) *
        (0.7 + 0.6 * lush) *
        (1 - 0.35 * out01) *
        (0.85 + 0.3 * size);
      out[filled] = cx + dx;
      out[filled + 1] = cy + sx * dx + sz * dz;
      out[filled + 2] = cz + dz;
      out[filled + 3] = Math.max(0.02, Math.min(1, height));
      out[filled + 4] = angle + (r3 - 0.5) * 0.9;
      // A blade leans away from the middle of its clump, the outer ones most.
      out[filled + 5] = 0.12 + 0.5 * out01 + 0.25 * r3;
      out[filled + 6] = rank;
      filled += ZHUDA_GRASS_BLADE_FLOATS;
    }
  }
  return out.slice(0, filled);
}

export interface ZhudaGrassMeshData {
  /** POSITION, NORMAL, UV interleaved: eight numbers a vertex. */
  vertices: Float32Array;
  indices: Uint16Array;
  blades: number;
  min: [number, number, number];
  max: [number, number, number];
}

/** How far the turf lies above the ground, metres. */
export const ZHUDA_GRASS_TURF_LIFT_M = 0.02;

/**
 * The turf of one patch: a sheet over the ground in squares of about half a
 * metre, or null where nothing grows. A corner where grass grows carries 1
 * in its texture coordinate and one where it does not carries 0; the
 * fragment program cuts a ragged edge between them. Squares with no growing
 * corner, or with a corner off the ground, are left out. Pure: no Laya needed.
 */
export function zhudaGrassTurf(
  resolved: ZhudaGrassResolved,
  ground: (x: number, z: number) => number | null,
  grows: ((x: number, z: number, y: number) => boolean) | undefined,
  px: number,
  pz: number,
): ZhudaGrassMeshData | null {
  const { patchM, area } = resolved;
  const N = Math.max(1, Math.round(patchM / 0.5)),
    step = patchM / N,
    row = N + 1;
  const heights = new Float32Array(row * row),
    cover = new Uint8Array(row * row),
    valid = new Uint8Array(row * row);
  for (let j = 0; j < row; j++)
    for (let i = 0; i < row; i++) {
      const x = px * patchM + i * step,
        z = pz * patchM + j * step,
        y = ground(x, z),
        at = j * row + i;
      if (y === null || !Number.isFinite(y)) continue;
      valid[at] = 1;
      heights[at] = y;
      cover[at] =
        x >= area.minX &&
        x <= area.maxX &&
        z >= area.minZ &&
        z <= area.maxZ &&
        (!grows || grows(x, z, y))
          ? 1
          : 0;
    }
  const slot = new Int32Array(row * row).fill(-1);
  const vertices: number[] = [],
    indices: number[] = [];
  const min: [number, number, number] = [Infinity, Infinity, Infinity],
    max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const use = (i: number, j: number) => {
    const at = j * row + i;
    if (slot[at] < 0) {
      slot[at] = vertices.length / 8;
      const x = px * patchM + i * step,
        y = heights[at] + ZHUDA_GRASS_TURF_LIFT_M,
        z = pz * patchM + j * step;
      // Height and lean of nought mark the turf for the two programs.
      vertices.push(x, y, z, 0, 1, 0, cover[at], 0.25);
      min[0] = Math.min(min[0], x);
      min[1] = Math.min(min[1], y);
      min[2] = Math.min(min[2], z);
      max[0] = Math.max(max[0], x);
      max[1] = Math.max(max[1], y);
      max[2] = Math.max(max[2], z);
    }
    return slot[at];
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * row + i,
        b = a + 1,
        c = a + row,
        d = c + 1;
      if (!(valid[a] && valid[b] && valid[c] && valid[d])) continue;
      if (!(cover[a] || cover[b] || cover[c] || cover[d])) continue;
      const va = use(i, j),
        vb = use(i + 1, j),
        vc = use(i, j + 1),
        vd = use(i + 1, j + 1);
      indices.push(va, vc, vb, vb, vc, vd);
    }
  if (!indices.length) return null;
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    blades: 0,
    min,
    max,
  };
}

/** One mesh of two, where they have room in one. */
function joined(a: ZhudaGrassMeshData, b: ZhudaGrassMeshData): ZhudaGrassMeshData | null {
  const first = a.vertices.length / 8;
  if (first + b.vertices.length / 8 > 65535) return null;
  const vertices = new Float32Array(a.vertices.length + b.vertices.length),
    indices = new Uint16Array(a.indices.length + b.indices.length);
  vertices.set(a.vertices);
  vertices.set(b.vertices, a.vertices.length);
  indices.set(a.indices);
  for (let i = 0; i < b.indices.length; i++) indices[a.indices.length + i] = b.indices[i] + first;
  return {
    vertices,
    indices,
    blades: a.blades + b.blades,
    min: [0, 1, 2].map((k) => Math.min(a.min[k], b.min[k])) as [number, number, number],
    max: [0, 1, 2].map((k) => Math.max(a.max[k], b.max[k])) as [number, number, number],
  };
}

/**
 * Meshes of blades, each cut into `segments` pieces along its length, so
 * that none has more than 65 535 vertices. Both edges of a blade are stored on its middle line;
 * the vertex program opens them. The normal is the way the blade faces; the
 * texture coordinate carries rank and edge in x; height, lean and place
 * along the blade in y. Pure: no Laya needed.
 */
export function zhudaGrassMeshes(blades: Float32Array, segments: number): ZhudaGrassMeshData[] {
  if (!Number.isInteger(segments) || segments < 1 || segments > 8)
    throw Error('grass segments 1..8');
  const F = ZHUDA_GRASS_BLADE_FLOATS,
    S = segments,
    perBlade = S * 2 + 1,
    most = Math.floor(65535 / perBlade);
  // Written number by number: a patch near the eye is tens of thousands of
  // blades, made within a frame.
  const chosen = blades.length / F;
  const meshes: ZhudaGrassMeshData[] = [];
  let i = 0;
  for (let left = chosen; left > 0; ) {
    const count = Math.min(left, most);
    left -= count;
    const vertices = new Float32Array(count * perBlade * 8),
      indices = new Uint16Array(count * (S * 2 - 1) * 3);
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let v = 0,
      n = 0;
    for (let done = 0; done < count; i += F) {
      done++;
      const x = blades[i],
        y = blades[i + 1],
        z = blades[i + 2],
        facing = blades[i + 4],
        leans = Math.max(0, Math.min(LEANS, Math.round(blades[i + 5] * LEANS))),
        rank = Math.round(blades[i + 6] * RANKS);
      const fx = Math.cos(facing),
        fz = Math.sin(facing),
        cm = Math.max(1, Math.min(100, Math.round(blades[i + 3] * 100))),
        tall = cm / 100,
        lean = (leans / LEANS) * tall,
        first = v / 8,
        both = cm + leans * 128 + 0.25;
      // Two vertices a piece on the middle line, then the tip. The blade
      // bends over the way it faces, more toward its tip.
      for (let k = 0; k <= S * 2; k++) {
        const t = k === S * 2 ? 1 : (k >> 1) / S,
          side = k === S * 2 ? 0.5 : k & 1;
        vertices[v] = x + fx * lean * t * t;
        vertices[v + 1] = y + tall * t;
        vertices[v + 2] = z + fz * lean * t * t;
        vertices[v + 3] = fx;
        vertices[v + 5] = fz;
        vertices[v + 6] = rank + 0.25 + side * 0.5;
        vertices[v + 7] = both + t * 0.5;
        v += 8;
      }
      // The foot and the tip bound the blade: it bends one way only.
      const tx = x + fx * lean,
        tz = z + fz * lean;
      if (x < minX) minX = x;
      if (tx < minX) minX = tx;
      if (x > maxX) maxX = x;
      if (tx > maxX) maxX = tx;
      if (z < minZ) minZ = z;
      if (tz < minZ) minZ = tz;
      if (z > maxZ) maxZ = z;
      if (tz > maxZ) maxZ = tz;
      if (y < minY) minY = y;
      if (y + tall > maxY) maxY = y + tall;
      for (let k = 0; k < S - 1; k++) {
        const a = first + k * 2;
        indices[n] = a;
        indices[n + 1] = a + 1;
        indices[n + 2] = a + 2;
        indices[n + 3] = a + 1;
        indices[n + 4] = a + 3;
        indices[n + 5] = a + 2;
        n += 6;
      }
      const a = first + (S - 1) * 2;
      indices[n] = a;
      indices[n + 1] = a + 1;
      indices[n + 2] = a + 2;
      n += 3;
    }
    meshes.push({
      vertices,
      indices,
      blades: count,
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    });
  }
  return meshes;
}

const VERTEX = `void zhudaVertex(inout vec3 p, inout vec3 n, vec2 uv, vec3 origin) {
  float rank = (floor(uv.x) + 0.5) / ${RANKS}.0;
  float side = (fract(uv.x) - 0.25) * 2.0;
  float both = floor(uv.y);
  float leans = floor(both / 128.0);
  float tall = (both - leans * 128.0) * 0.01;
  float lean = leans / ${LEANS}.0 * tall;
  float t = (fract(uv.y) - 0.25) * 2.0;
  if (both < 0.5) {
    // The turf: it sinks into the ground where the grass ends.
    float away = length(u_ZhudaGrassEye.xz - p.xz);
    p.y -= clamp((away - u_ZhudaGrassShape.y * 0.85) / (u_ZhudaGrassShape.y * 0.15), 0.0, 1.0) * 0.5;
    return;
  }
  // Where the blade stands: the same for every vertex of it, so the whole
  // blade is thinned, turned and blown as one.
  vec3 foot = p - vec3(n.x * lean * t * t, tall * t, n.z * lean * t * t);
  vec3 toEye = u_ZhudaGrassEye.xyz - (foot + vec3(0.0, tall * 0.5, 0.0));
  float d = length(toEye.xz);
  // Fewer blades far from the eye: the last of those shown are still growing.
  float shown = min(1.0, pow(u_ZhudaGrassShape.x / max(d, 0.001), 1.5));
  float size = clamp((shown - rank) / (shown * ${SOFT}), 0.0, 1.0)
    * clamp((u_ZhudaGrassShape.y - d) / (u_ZhudaGrassShape.y * 0.15), 0.0, 1.0);
  // Gusts cross the land the way the wind blows; each blade flutters on its own.
  vec2 dir = u_ZhudaGrassWind.xy;
  float time = u_ZhudaGrassEye.w * u_ZhudaGrassWind.w;
  float along = dot(foot.xz, dir);
  float beside = dot(foot.xz, vec2(-dir.y, dir.x));
  float gust = 0.5 + 0.5 * sin(along * 0.33 - time * 1.7 + sin(beside * 0.19 + time * 0.23) * 1.6);
  float flutter = sin(time * 5.1 + rank * 43.0 + along * 1.9) * (0.3 + 0.7 * gust);
  float blown = (0.12 + 0.88 * gust * gust + 0.14 * flutter) * u_ZhudaGrassWind.z * tall * size;
  p.xz += dir * (blown * t * t);
  p.y -= tall * t * (1.0 - size) + blown * 0.4 * t * t * t;
  // The blade opens from its middle line. Far blades are wider, for the
  // ones that are not drawn.
  vec3 across = vec3(-n.z, 0.0, n.x);
  float wide = u_ZhudaGrassShape.z * (0.7 + 0.6 * fract(rank * 17.3)) * (1.0 - t * t)
    * min(u_ZhudaGrassShape.w, inversesqrt(max(shown, 0.001)));
  p += across * ((side - 0.5) * 2.0 * wide * size);
  // Lit almost like the ground under it, whichever side is seen, so a field
  // is one soft surface.
  vec2 face = dot(n.xz, toEye.xz) < 0.0 ? -n.xz : n.xz;
  n = normalize(vec3(face.x * 0.4, 1.0, face.y * 0.4));
}`;
const SURFACE = `float zhudaGrassHash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
float zhudaGrassLand(vec2 g) {
  vec2 i = floor(g), f = fract(g);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(zhudaGrassHash(i), zhudaGrassHash(i + vec2(1.0, 0.0)), f.x),
    mix(zhudaGrassHash(i + vec2(0.0, 1.0)), zhudaGrassHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  // Dry in drifts across the land.
  float drift = zhudaGrassLand(p.xz * 0.09) * 0.7 + zhudaGrassLand(p.xz * 0.37) * 0.3;
  s.metallic = 0.0;
  if (uv.y < 0.75) {
    // The turf, seen between the blades: in their shade, mottled, and cut
    // off raggedly where grass stops growing.
    float fine = zhudaGrassLand(p.xz * 7.0) * 0.6 + zhudaGrassLand(p.xz * 23.0) * 0.4;
    if (uv.x < 0.5 + (zhudaGrassLand(p.xz * 2.3) * 0.65 + fine * 0.35 - 0.5) * 0.9) discard;
    vec3 green = mix(u_ZhudaGrassTip.xyz, u_ZhudaGrassDry.xyz, clamp(u_ZhudaGrassDry.w * (0.35 + 1.3 * drift), 0.0, 1.0) * 0.6);
    s.baseColor = mix(u_ZhudaGrassRoot.xyz, green, 0.2 + 0.3 * fine);
    s.roughness = 0.9;
    s.occlusion *= 0.5 + 0.2 * fine;
    return;
  }
  float rank = (floor(uv.x) + 0.5) / ${RANKS}.0;
  float t = clamp((fract(uv.y) - 0.25) * 2.0, 0.0, 1.0);
  float own = fract(rank * 23.7);
  // And a blade here and there is dry on its own.
  float dry = clamp(u_ZhudaGrassDry.w * (0.35 + 1.3 * drift) + (own - 0.5) * 0.5 * u_ZhudaGrassDry.w, 0.0, 1.0);
  vec3 tip = mix(u_ZhudaGrassTip.xyz, u_ZhudaGrassDry.xyz, dry * smoothstep(0.15, 1.0, t));
  // The foot of a blade is the colour of the turf it stands in.
  vec3 foot = mix(u_ZhudaGrassRoot.xyz, tip, 0.35);
  s.baseColor = mix(foot, tip * (0.84 + 0.32 * own), smoothstep(0.0, 0.8, t));
  s.roughness = 0.62;
  // Little of the sky reaches the foot of a blade among its neighbours.
  s.occlusion *= mix(0.6, 1.0, smoothstep(0.0, 0.65, t));
}`;
const SHADER = 'ZhudaGrassBlades';

export interface ZhudaGrassStats {
  /** Patches of land that have a mesh now. */
  patches: number;
  /** Blades in those meshes (those drawn are fewer: far ones are thinned). */
  blades: number;
  vertices: number;
  /** Patches round the eye still waiting for their mesh. */
  pending: number;
}

/** Clumps made in one go when every rank is kept: under 65 535 vertices, a few milliseconds. */
const SLICE_CLUMPS = 780;

/** One of a patch's meshes by rank (several where it is too large for one). */
interface Band {
  drawn: number;
  vertices: number;
  nodes: any[];
  meshes: any[];
}

interface Patch {
  px: number;
  pz: number;
  /** Whole bands, the far one first. */
  bands: Band[];
}

/** The band being made: the next of a patch, not drawn until it is whole. */
interface Job {
  key: string;
  /** Its place among the patch's bands. */
  index: number;
  /** The first clump not made yet. */
  next: number;
  band: Band;
}

/**
 * A field of grass in a scene. Call `update` every frame with the eye and the
 * time; it makes at most a few patches a call. `fill` makes every patch the
 * eye needs at once (a first frame, a picture). `dispose` gives it all back.
 */
export class ZhudaGrassField {
  readonly options: ZhudaGrassResolved;
  private readonly scene: any;
  private readonly ground: (x: number, z: number) => number | null;
  private readonly grows?: (x: number, z: number, y: number) => boolean;
  private readonly material: ZhudaLitSurfaceMaterial;
  private readonly patches = new Map<string, Patch>();
  private pending = 0;
  /** The patch being made, over several calls when it is a large one. */
  private job: Job | null = null;
  private disposed = false;
  constructor(scene: any, options: ZhudaGrassOptions) {
    this.options = resolveZhudaGrass(options);
    this.scene = scene;
    this.ground = options.ground;
    this.grows = options.grows;
    this.material = new ZhudaLitSurfaceMaterial({
      name: SHADER,
      vertex: VERTEX,
      surface: SURFACE,
      backFaces: 'same',
      // No starting values here: fields of different colours share the shader.
      uniforms: {
        u_ZhudaGrassEye: { type: 'vec4' },
        u_ZhudaGrassShape: { type: 'vec4' },
        u_ZhudaGrassWind: { type: 'vec4' },
        u_ZhudaGrassTip: { type: 'vec4' },
        u_ZhudaGrassRoot: { type: 'vec4' },
        u_ZhudaGrassDry: { type: 'vec4' },
      },
      material: { color: [1, 1, 1, 1], roughness: 0.62, doubleSided: true },
    });
    const o = this.options;
    this.material.set('u_ZhudaGrassShape', [o.fullDensityM, o.distanceM, o.widthM / 2, WIDEST]);
    this.material.set('u_ZhudaGrassTip', [...zhudaDecodeColor(o.tip), 0]);
    this.material.set('u_ZhudaGrassRoot', [...zhudaDecodeColor(o.root), 0]);
    this.material.set('u_ZhudaGrassDry', [...zhudaDecodeColor(o.dry), o.dryness]);
    this.setWind(o.wind);
    this.material.set('u_ZhudaGrassEye', [0, 0, 0, 0]);
  }
  /** Changes the wind in place. */
  setWind(wind: { directionDeg?: number; strength?: number; speed?: number }) {
    if (this.disposed) throw Error('Disposed grass');
    const next = { ...this.options.wind, ...wind };
    const errors = validateZhudaGrass({ area: this.options.area, ground: this.ground, wind: next });
    if (errors.length) throw Error(errors.join('; '));
    Object.assign(this.options.wind, next);
    const a = (next.directionDeg * Math.PI) / 180;
    // A blade's tip moves at most about a third of its height.
    this.material.set('u_ZhudaGrassWind', [
      Math.cos(a),
      Math.sin(a),
      next.strength * 0.9,
      next.speed,
    ]);
  }
  get stats(): ZhudaGrassStats {
    let blades = 0,
      vertices = 0;
    for (const patch of this.patches.values())
      for (const band of patch.bands) {
        blades += band.drawn;
        vertices += band.vertices;
      }
    let patches = 0;
    for (const patch of this.patches.values()) if (patch.bands.length) patches++;
    return { patches, blades, vertices, pending: this.pending };
  }
  /**
   * Moves the grass to the eye and the time. Makes the meshes the eye needs,
   * nearest first, until it has made `blades` blades (default 6000; always
   * some), and returns how many patches are still short of a mesh. The mesh
   * a patch near the eye gains is tens of thousands of blades: it is made
   * over several calls and shown when it is whole.
   */
  update(eye: readonly number[], seconds: number, blades = 6000): number {
    if (this.disposed) throw Error('Disposed grass');
    if (
      !Array.isArray(eye) ||
      eye.length < 3 ||
      ![eye[0], eye[1], eye[2], seconds].every(Number.isFinite)
    )
      throw Error('grass.update: eye [x, y, z] and seconds, finite');
    if (!(blades >= 1)) throw Error('grass.update: blades >= 1');
    // The time wraps where every wave of the wind comes round, to keep it exact.
    this.material.set('u_ZhudaGrassEye', [eye[0], eye[1], eye[2], seconds % 3600]);
    const { patchM, distanceM, fullDensityM, area } = this.options;
    // A patch gets a mesh a little before it is needed, keeps it a little
    // after, and is dropped a little past the end.
    const LEAD = 1.5,
      KEEP = 3;
    const wanted: { key: string; px: number; pz: number; bands: number; nearest: number }[] = [];
    const seen = new Set<string>();
    const reach = distanceM + KEEP;
    const x0 = Math.floor(Math.max(area.minX, eye[0] - reach) / patchM),
      x1 = Math.floor(Math.min(area.maxX - 1e-6, eye[0] + reach) / patchM),
      z0 = Math.floor(Math.max(area.minZ, eye[2] - reach) / patchM),
      z1 = Math.floor(Math.min(area.maxZ - 1e-6, eye[2] + reach) / patchM);
    for (let px = x0; px <= x1; px++)
      for (let pz = z0; pz <= z1; pz++) {
        const dx = Math.max(px * patchM - eye[0], 0, eye[0] - (px + 1) * patchM),
          dz = Math.max(pz * patchM - eye[2], 0, eye[2] - (pz + 1) * patchM),
          nearest = Math.hypot(dx, dz);
        const key = px + ':' + pz,
          have = this.patches.get(key);
        const needs = zhudaGrassBands(Math.max(0, nearest - LEAD), fullDensityM, distanceM + LEAD);
        if (have) {
          if (nearest > reach) continue;
          seen.add(key);
          // More than it would need even a few metres nearer: those go.
          const most = Math.max(
            1,
            zhudaGrassBands(Math.max(0, nearest - LEAD - KEEP), fullDensityM, reach),
          );
          while (have.bands.length > most) this.release(have.bands.pop()!);
          if (have.bands.length < needs) wanted.push({ key, px, pz, bands: needs, nearest });
        } else if (needs > 0) {
          seen.add(key);
          wanted.push({ key, px, pz, bands: needs, nearest });
        }
      }
    for (const [key, patch] of this.patches)
      if (!seen.has(key)) {
        for (const band of patch.bands) this.release(band);
        this.patches.delete(key);
      }
    wanted.sort((a, b) => a.nearest - b.nearest);
    // The band in the making is finished first, unless it is no longer wanted.
    const job = this.job;
    if (job) {
      const at = wanted.findIndex((want) => want.key === job.key && want.bands > job.index);
      if (at < 0 || (this.patches.get(job.key)?.bands.length ?? 0) !== job.index) {
        this.release(job.band);
        this.job = null;
      } else wanted.unshift(...wanted.splice(at, 1));
    }
    let made = 0,
      spent = 0,
      worked = false;
    for (const want of wanted) {
      let patch = this.patches.get(want.key);
      if (!patch) this.patches.set(want.key, (patch = { px: want.px, pz: want.pz, bands: [] }));
      while (patch.bands.length < want.bands && !(worked && spent >= blades)) {
        if (!this.job)
          this.job = {
            key: want.key,
            index: patch.bands.length,
            next: 0,
            band: { drawn: 0, vertices: 0, nodes: [], meshes: [] },
          };
        spent += this.step(this.job, patch);
        worked = true;
      }
      if (patch.bands.length < want.bands) break;
      made++;
    }
    return (this.pending = wanted.length - made);
  }
  /** Makes every patch the eye needs now, however many. */
  fill(eye: readonly number[], seconds: number) {
    while (this.update(eye, seconds, Infinity) > 0);
  }
  /**
   * Makes the next part of a band: some of the patch's clumps as meshes that
   * are not drawn yet. With the last part of a patch's first band comes its
   * turf, and a band that is whole is shown. Returns how many blades it made.
   */
  private step(job: Job, patch: Patch): number {
    const l = (globalThis as any).Laya;
    const { band } = job;
    const { from, to, segments } = ZHUDA_GRASS_BANDS[job.index];
    const end = job.next + Math.floor(SLICE_CLUMPS / (to - from));
    const last = end >= zhudaGrassPatchClumps(this.options);
    const blades = zhudaGrassPatchBlades(
      this.options,
      this.ground,
      this.grows,
      patch.px,
      patch.pz,
      [from, to],
      [job.next, end],
    );
    job.next = end;
    // Room for the wind and for the far blades' width.
    const pad = this.options.heightM[1] * 0.5 + this.options.widthM * WIDEST;
    const parts = zhudaGrassMeshes(blades, segments);
    const turf =
      last && job.index === 0 && this.options.turf
        ? zhudaGrassTurf(this.options, this.ground, this.grows, patch.px, patch.pz)
        : null;
    if (turf) {
      // In the last mesh of blades where it has room: one draw fewer.
      const both = parts.length ? joined(parts[parts.length - 1], turf) : null;
      if (both) parts[parts.length - 1] = both;
      else parts.push(turf);
    }
    let made = 0;
    for (const data of parts) {
      const mesh = l.PrimitiveMesh._createMesh(
        l.VertexMesh.getVertexDeclaration('POSITION,NORMAL,UV'),
        data.vertices,
        data.indices,
      );
      mesh.bounds = new l.Bounds(
        new l.Vector3(data.min[0] - pad, data.min[1] - pad, data.min[2] - pad),
        new l.Vector3(data.max[0] + pad, data.max[1] + pad, data.max[2] + pad),
      );
      const node = new l.MeshSprite3D(mesh);
      node.name = 'grass';
      node.meshRenderer.sharedMaterial = this.material.material;
      node.meshRenderer.receiveShadow = true;
      node.meshRenderer.castShadow = false;
      node.meshRenderer.boundsChange = true;
      // Not drawn until the whole band is made.
      node.active = false;
      this.scene.addChild(node);
      band.nodes.push(node);
      band.meshes.push(mesh);
      band.drawn += data.blades;
      band.vertices += data.vertices.length / 8;
      made += data.blades;
    }
    if (last) {
      for (const node of band.nodes) node.active = true;
      patch.bands.push(band);
      this.job = null;
    }
    return made;
  }
  private release(band: Band) {
    for (const node of band.nodes) node.destroy(true);
    for (const mesh of band.meshes) mesh.destroy();
    band.nodes = [];
    band.meshes = [];
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const patch of this.patches.values()) for (const band of patch.bands) this.release(band);
    this.patches.clear();
    if (this.job) this.release(this.job.band);
    this.job = null;
    this.pending = 0;
    this.material.dispose();
  }
}
