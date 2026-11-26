// Where everything on the floating island stands, as numbers (no engine): the
// props and plants, the tree, the lamps, the chimney, the roof and the windmill
// tower, the things a character walks round, where grass grows, and the island
// as its characters see it (SKY_ISLAND_WORLD, for 3d/island-pig).
// Coordinates: metres, x right, y up, z toward the first camera; the island's middle is the origin.
import { HOUSE, POND, TREE, WATER_Y, groundAt, insideBy, pathDistance, pondDistance } from './ground.ts';
import type { NatureId } from '../nature-pack/nature-pack.ts';
import type { V3 } from '../math.ts';

/** Where the module's models are served after sync (relative to the page). */
export const SKY_ISLAND_BASE = 'common/3d/sky-island/assets/';
export type IslandModel = 'island' | 'house' | 'props' | 'tree';
export const islandPath = (name: IslandModel) => `${SKY_ISLAND_BASE}${name}.glb`;

/** Each prop placed: a node of props.glb, x, z, turn (degrees). The crate floats in the pond. */
export const PROPS: [string, number, number, number][] = [
  ['fence', 3.6, 2.3, 8],
  ['fence', 5.3, 1.6, 32],
  ['fence', -0.6, 3.9, -12],
  ['cart', 4.6, -0.3, -64],
  ['barrel', 4.2, 0.6, 0],
  ['barrel', 0.6, -0.4, 20],
  ['bench', -0.9, -1.4, 25],
  ['sign', 1.55, 4.3, -15],
  ['lamp', -0.1, 2.0, 160],
  ['bucket', -0.3, 1.0, 0],
  ['haybale', 5.2, -2.2, 70],
  ['mailbox', 1.8, 5.8, -10],
  ['crate', -4.4, -0.6, 22],
];

/** Plants and stones from 3d/nature-pack: model, x, z, scale, turn (degrees). */
export const NATURE: [NatureId, number, number, number, number][] = [
  ['fern_02', -0.5, -2.7, 0.55, 30],
  ['fern_02', 4.8, -3.6, 0.6, 140],
  ['fern_02', -4.3, 0.9, 0.5, 200],
  ['fern_02', -0.4, 2.7, 0.45, 80],
  ['shrub_02', -4.6, -3.6, 0.32, 10],
  ['shrub_02', 3.6, -4.0, 0.3, 200],
  ['shrub_03', 0.2, -3.8, 0.8, 0],
  ['nettle_plant', -3.4, 3.0, 0.7, 40],
  ['nettle_plant', 5.4, 0.9, 0.6, 120],
  ['namaqualand_boulder_04', -3.6, 2.6, 0.32, 30],
  ['namaqualand_boulder_06', -0.6, 1.9, 0.22, 160],
  ['namaqualand_boulder_04', 5.7, -1.0, 0.28, 250],
  ['namaqualand_boulder_06', -5.8, -1.3, 0.35, 70],
  ['tree_stump_01', 3.0, 4.6, 0.5, 10],
  ['namaqualand_stones_01', -2.2, 3.1, 0.6, 0],
  ['moss_01', -1.5, -3.0, 0.8, 0],
];

/** The big tree: turn (degrees), scale, and how far it is sunk into the ground. */
export const TREE_PLACE = { turn: 20, scale: 0.95, sink: 0.05 };

/** The crate bobbing and turning in the pond at a moment (seconds): position and Euler angles (degrees). */
export function crateAt(seconds: number): { position: V3; euler: V3 } {
  return {
    position: [-4.4 + 0.15 * Math.sin(seconds * 0.3), WATER_Y - 0.2 + 0.03 * Math.sin(seconds * 1.7), -0.6 + 0.1 * Math.cos(seconds * 0.23)],
    euler: [3 * Math.sin(seconds * 1.3), 22 + 8 * Math.sin(seconds * 0.2), 3 * Math.cos(seconds * 1.1)],
  };
}

/** The cottage's roof as source/props.py built it (house centre, ridge along z). */
export const ROOF = { eave: 2.25, ridge: 3.7, halfW: 1.6 + 0.32, halfD: 1.3 + 0.32 };
/** The windmill's stone tower beside the cottage: centre, radius, height of its cap above the house floor. */
export const TOWER = { x: HOUSE.center[0] - 1.55, z: HOUSE.center[1] - 0.75, r: 1.0, top: 5.7 };

/** Height of the roof (plus a margin for feet) at (x, z), or null off it. */
export function roofAt(x: number, z: number): number | null {
  const dx = Math.abs(x - HOUSE.center[0]),
    dz = Math.abs(z - HOUSE.center[1]);
  if (dx > ROOF.halfW || dz > ROOF.halfD) return null;
  return HOUSE.height + ROOF.ridge - (ROOF.ridge - ROOF.eave) * (dx / 1.6) + 0.12;
}

/** What a character walks round: the tower, the tree, the props (not fences or the floating crate) and the house. */
export const OBSTACLES: { circles: [number, number, number][]; boxes: [number, number, number, number][] } = {
  circles: [
    [HOUSE.center[0] - 1.55, HOUSE.center[1] - 0.75, 1.0],
    [TREE.center[0], TREE.center[1], 0.55],
    ...PROPS.filter((p) => p[0] !== 'fence' && p[0] !== 'crate').map(([name, x, z]) => [x, z, name === 'cart' ? 1.0 : 0.4] as [number, number, number]),
  ],
  boxes: [[HOUSE.center[0], HOUSE.center[1], 1.75, 1.45]],
};

/**
 * The floating island as its characters see it (a PigWorld of 3d/island-pig): the top,
 * the rim, the pond, the cottage roof to slide off, the tower's cap to bounce off; a fall
 * below 16 m under the top is lost in the sea of cloud and they drop back from 14 m.
 */
export const SKY_ISLAND_WORLD = {
  ground: groundAt,
  inside: insideBy,
  obstacles: OBSTACLES,
  pond: { center: POND.center, waterY: WATER_Y, distance: pondDistance },
  roof: { at: roofAt, ridgeX: HOUSE.center[0] },
  caps: [{ x: TOWER.x, z: TOWER.z, r: TOWER.r, y: HOUSE.height + TOWER.top }],
  lostBelow: -16,
  respawnSpan: 9,
  respawnHeight: 14,
  reach: 10,
};

const footprints: [number, number, number][] = PROPS.filter((p) => p[0] !== 'crate' && p[0] !== 'fence').map(([name, x, z]) => [x, z, name === 'cart' ? 1.1 : 0.5]);
const fenceLines = PROPS.filter((p) => p[0] === 'fence');

/** Whether grass grows at (x, z) with the ground at y: on the top, off the path and the pond's banks, clear of the house, tower, tree, props and fences. */
export function grassGrows(x: number, z: number, y: number): boolean {
  return (
    insideBy(x, z) > 0.32 &&
    pathDistance(x, z) > 0.42 &&
    pondDistance(x, z) > 1.12 &&
    y > WATER_Y + 0.05 &&
    !(Math.abs(x - HOUSE.center[0]) < 1.75 && Math.abs(z - HOUSE.center[1]) < 1.5) &&
    Math.hypot(x - (HOUSE.center[0] - 1.55), z - (HOUSE.center[1] - 0.75)) > 1.05 &&
    Math.hypot(x - TREE.center[0], z - TREE.center[1]) > 0.45 &&
    !footprints.some(([fx, fz, r]) => Math.hypot(x - fx, z - fz) < r) &&
    !fenceLines.some(([, fx, fz, turn]) => {
      const a = (turn * Math.PI) / 180;
      const lx = (x - fx) * Math.cos(a) - (z - fz) * Math.sin(a),
        lz = (x - fx) * Math.sin(a) + (z - fz) * Math.cos(a);
      return Math.abs(lx) < 1.05 && Math.abs(lz) < 0.12;
    })
  );
}

const lampProp = PROPS.find((p) => p[0] === 'lamp')!;
const lampTurn = (lampProp[3] * Math.PI) / 180;
/** Night lights: the lamp post's lantern and the two lanterns by the cottage door (position, range). */
export const LAMPS: { at: V3; range: number }[] = [
  { at: [lampProp[1] + Math.cos(lampTurn) * 0.38, (groundAt(lampProp[1], lampProp[2]) ?? 0) + 1.55, lampProp[2] - Math.sin(lampTurn) * 0.38], range: 6 },
  { at: [HOUSE.center[0] - 1.05, HOUSE.height + 1.45, HOUSE.center[1] + 1.7], range: 4.5 },
  { at: [HOUSE.center[0] + 1.05, HOUSE.height + 1.45, HOUSE.center[1] + 1.7], range: 4.5 },
];

/** Top of the chimney, where the smoke starts. */
export const CHIMNEY: V3 = [HOUSE.center[0] + 0.85, HOUSE.height + 3.6 + 0.85, HOUSE.center[1] - 0.55];
/** The windmill's hub, where its creak is heard from. */
export const WINDMILL: V3 = [HOUSE.center[0] - 1.55, HOUSE.height + 6.05, HOUSE.center[1] - 0.25];

/** The view both island games open with: orbit target, yaw, pitch (radians) and distance (metres, landscape). */
export const HOME_VIEW = { target: [0.4, 1.0, -0.6] as V3, yaw: 0.62, pitch: 0.3, distance: 25 };

/** An open patch of grass at the front left, where the home island's siblings perform, and the side the camera frames it from. */
export const STAGE = { center: [-3.75, 4.4] as [number, number], yaw: -0.35, distance: 8.5 };
