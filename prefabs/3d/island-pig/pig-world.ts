// What an island tells the characters that live on it, and the rules that need
// nothing but that: where one may stand, what it lands on, the way to a place.
// No engine here (pig.ts does the posing), so these run in Node tests too.
//
// An island is a PigWorld: its top's height, how far inside its rim a place is,
// the things to walk round, and optionally a pond, a gable roof, round caps to
// bounce off, and how far down a fall is lost. The floating island's is
// SKY_ISLAND_WORLD in 3d/sky-island/layout.ts; any island can give its own.

/** Things on the island to walk round: circles (x, z, r) and boxes (x, z, half x, half z). */
export interface Obstacles {
  circles: [number, number, number][];
  boxes: [number, number, number, number][];
}

/** A pond: < 1 inside its shore (`distance`), its middle and its water line. */
export interface PigPond {
  center: readonly [number, number];
  waterY: number;
  distance(x: number, z: number): number;
}

/** A gable roof: its height at (x, z), null off it; its ridge runs along z at x = ridgeX, so one slides off toward ±x. */
export interface PigRoof {
  at(x: number, z: number): number | null;
  ridgeX: number;
}

/** A round top one bounces off (a tower's cap): centre, radius and height. */
export interface PigCap {
  x: number;
  z: number;
  r: number;
  y: number;
}

export interface PigWorld {
  /** Height of the walkable top at (x, z), or null off the island. */
  ground(x: number, z: number): number | null;
  /** How far inside the rim (x, z) is, metres (negative outside). The island's middle is the origin. */
  inside(x: number, z: number): number;
  obstacles: Obstacles;
  pond?: PigPond;
  roof?: PigRoof;
  caps?: PigCap[];
  /** A fall that goes below this height is lost (into the sea of cloud) and the character drops back in from the sky. */
  lostBelow: number;
  /** Where it drops back in: a square this many metres across round the middle, from this height. */
  respawnSpan: number;
  respawnHeight: number;
  /** Half the width (metres) of the square round the middle that the way-finder searches. */
  reach: number;
}

/** The core clips every character model needs (3d/zhuda-characters has them all). */
export const BASE_CLIPS = ['Idle', 'Walk', 'Struggle', 'Dangle', 'Fall', 'Land', 'Cheer', 'Shake', 'Dizzy'] as const;
/** The redesign's clips (build_character.py), counted in beats of 30 frames at 63 fps; a model without them does not act. */
export const ACTS = { Wave: 2, Bow: 2, Sing: 4, Dance: 4, Sit: 8, Sleep: 8, Talk: 4, Point: 2, ReachLeft: 2, ReachRight: 2 } as const;
export type Act = keyof typeof ACTS;
export type PigClip = (typeof BASE_CLIPS)[number] | Act;
const ONCE: Record<string, boolean> = { Land: false, Shake: false, Bow: false };
/** Whether a clip loops (Land, Shake and Bow play once and hold their last pose). */
export const looped = (clip: string) => ONCE[clip] ?? true;

/** How a character is built: its scale, and where the hand takes it (model space, before the scale). */
export interface PigShape {
  /** Scale of the model (1 = as exported). */
  size?: number;
  /** The scruff: top of the back of the head. */
  scruff?: [number, number, number];
  /** Its middle, roughly. */
  middle?: [number, number, number];
  /** Height of its head, for voices and effects. */
  head?: number;
  /** Radius of the body for picking. */
  radius?: number;
}

export interface PigOptions extends PigShape {
  /** Where it stands first (x, z) and which way it looks. */
  start?: [number, number];
  yaw?: number;
  /** Others to keep clear of (their feet, world), read each step. */
  others?: () => [number, number, number][];
  /** Plays the redesign's clips the model has (waves, sits, dozes at night; act()/goAct() for the page). false: the nine core clips only. */
  performs?: boolean;
  /** Chance of a cheer each time it stops to choose what next. */
  cheerChance?: number;
  /** Drops back in on the side the camera looks from (true), or anywhere free. */
  respawnInView?: boolean;
  /** Heights (model space, before the scale) of the four spheres that pick it; default: spread up to the head. */
  pickHeights?: readonly [number, number, number, number];
  /** Name of its holder node. */
  name?: string;
}

/**
 * The floating-island game's single Zhuda (games/zhuda-sky-island), exactly: the nine
 * core clips only, cheers more often, drops back in anywhere free, picked by fixed heights.
 */
export const SKY_ISLAND_GAME_PIG: PigOptions = { performs: false, cheerChance: 0.18, respawnInView: false, pickHeights: [0.25, 0.45, 0.65, 0.85], name: 'zhuda-holder' };

/**
 * The 2026 redesign (zhuda, zhuer of 3d/zhuda-characters) as the home island shows them:
 * about 1.05 m with big heads, shown a little larger and held at the back of the head.
 * `head` is the model's head height (zhuda 0.95, zhuer 1.0).
 */
export const redesignShape = (head: number): PigShape => ({ size: 1.2, scruff: [0, head - 0.05, -0.13], middle: [0, 0.45, 0], head, radius: 0.36 });

/** Margins the characters keep (metres, or pond distance units for the pond). */
export const KEEP = {
  /** From the rim, to stand. */
  rim: 0.9,
  /** From the pond's shore (pond distance), to stand. */
  pond: 1.18,
} as const;

/** Whether a character may stand at (x, z) as far as the island goes: in from the rim, off the pond, clear of things. */
export function standable(world: PigWorld, x: number, z: number, margin = 0.35): boolean {
  if (world.inside(x, z) < KEEP.rim) return false;
  if (world.pond && world.pond.distance(x, z) < KEEP.pond) return false;
  for (const [cx, cz, r] of world.obstacles.circles) if (Math.hypot(x - cx, z - cz) < r + margin) return false;
  for (const [bx, bz, hx, hz] of world.obstacles.boxes) if (Math.abs(x - bx) < hx + margin && Math.abs(z - bz) < hz + margin) return false;
  return world.ground(x, z) !== null;
}

/** What a falling character lands on at (x, z): a cap, a roof or the ground (y), or null over nothing. */
export function surfaceAt(world: PigWorld, x: number, z: number): { y: number; roof: boolean; cap?: PigCap } | null {
  const roof = world.roof ? world.roof.at(x, z) : null;
  const ground = world.ground(x, z);
  for (const cap of world.caps ?? []) if (Math.hypot(x - cap.x, z - cap.z) < cap.r) return { y: cap.y, roof: true, cap };
  if (roof !== null && (ground === null || roof > ground)) return { y: roof, roof: true };
  return ground === null ? null : { y: ground, roof: false };
}

/** Whether the straight line from a to b stays where `free` allows (checked every 15 cm). */
export function clearLine(free: (x: number, z: number) => boolean, ax: number, az: number, bx: number, bz: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15));
  for (let k = 1; k <= n; k++) if (!free(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false;
  return true;
}

/**
 * A way from `from` to `goal` (x, z) round whatever `free` forbids: a search over a half-metre
 * grid within `reach` of the middle, then shortcuts wherever the line is clear. The places to
 * pass, ending at the goal; null if there is none.
 */
export function findWay(free: (x: number, z: number) => boolean, from: readonly [number, number], goal: [number, number], reach = 10): [number, number][] | null {
  const [fx, fz] = from;
  if (clearLine(free, fx, fz, goal[0], goal[1])) return [goal];
  const G = 0.5,
    N = Math.round((2 * reach) / G),
    half = N / 2;
  const cell = (x: number, z: number) => [Math.round(x / G) + half, Math.round(z / G) + half] as const;
  const at = (i: number, j: number): [number, number] => [(i - half) * G, (j - half) * G];
  const ok = new Map<number, boolean>();
  const open = (i: number, j: number) => {
    const k = i * N + j;
    if (!ok.has(k)) ok.set(k, i >= 0 && j >= 0 && i < N && j < N && free(...at(i, j)));
    return ok.get(k)!;
  };
  const [si, sj] = cell(fx, fz),
    [gi, gj] = cell(goal[0], goal[1]);
  const cost = new Map<number, number>([[si * N + sj, 0]]);
  const came = new Map<number, number>();
  const queue: [number, number, number][] = [[0, si, sj]];
  let found = -1;
  for (let guard = 0; queue.length && guard < 4000; guard++) {
    queue.sort((a, b) => a[0] - b[0]);
    const [, i, j] = queue.shift()!;
    if (i === gi && j === gj) {
      found = i * N + j;
      break;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di,
        nj = j + dj;
      if (!(ni === gi && nj === gj) && !open(ni, nj)) continue;
      if (di && dj && (!open(i + di, j) || !open(i, j + dj))) continue;
      const c = cost.get(i * N + j)! + Math.hypot(di, dj);
      const k = ni * N + nj;
      if (c >= (cost.get(k) ?? Infinity)) continue;
      cost.set(k, c);
      came.set(k, i * N + j);
      queue.push([c + Math.hypot(gi - ni, gj - nj), ni, nj]);
    }
  }
  if (found < 0) return null;
  const cells: [number, number][] = [];
  for (let k: number | undefined = found; k !== undefined && k !== si * N + sj; k = came.get(k)) cells.unshift(at(Math.floor(k / N), k % N));
  cells[cells.length - 1] = goal;
  // Shortcuts: from each place, on to the farthest one in plain sight.
  const way: [number, number][] = [];
  let here: [number, number] = [fx, fz];
  for (let i = 0; i < cells.length; ) {
    let j = cells.length - 1;
    while (j > i && !clearLine(free, here[0], here[1], cells[j][0], cells[j][1])) j--;
    way.push(cells[j]);
    here = cells[j];
    i = j + 1;
  }
  return way;
}

/** Length of a way from (x, z) through its places. */
export function wayLength(from: readonly [number, number], way: readonly (readonly [number, number])[]) {
  let total = 0,
    [x, z] = from;
  for (const [px, pz] of way) (total += Math.hypot(px - x, pz - z)), ([x, z] = [px, pz]);
  return total;
}
