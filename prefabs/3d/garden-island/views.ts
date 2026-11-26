// Places on the garden island worth standing at, and what a following camera must
// not pass through. Pure data from land.ts (no engine): a game can spawn the
// character at a view, and a test can check each one without a browser.
import { START, TREES, groundAt } from './land.ts';

/** A place and a framing: where the character stands and faces, and where the camera orbits. */
export interface GardenView {
  /** Name shown to people (Traditional Chinese). */
  label: string;
  /** The hour the picture was made at. */
  hour: number;
  /** Where the character stands, x and z (metres). */
  at: readonly [number, number];
  /** Which way the character faces, radians (0: toward +z, south). */
  face: number;
  /** Orbit of the third-person camera round the character: yaw and pitch in radians, distance in metres. */
  yaw: number;
  pitch: number;
  distance: number;
}

/**
 * The tour the game was checked with (games/zhuda-garden-island tools/scenarios/tour.json:
 * path, pond, stream, beach, above, night; source/tour.json here), the dusk check of its
 * sea (source/sea.json f-dusk) and the first framing of the bamboo and terrace shots of
 * its film (source/film.ts s08, s10).
 */
export const GARDEN_VIEWS = {
  path: { label: '石板路', hour: 10.5, at: [4.2, 21], face: 3.1, yaw: 0.15, pitch: 0.22, distance: 8 },
  pond: { label: '睡蓮池', hour: 10.5, at: [15.2, -0.6], face: 3.7, yaw: 0.6, pitch: 0.33, distance: 9 },
  stream: { label: '溪流', hour: 10.5, at: [-4.5, 5.6], face: 1, yaw: 2.3, pitch: 0.4, distance: 9 },
  beach: { label: '海灘', hour: 10.5, at: [3, 32.5], face: 3.1, yaw: 1.2, pitch: 0.2, distance: 10 },
  above: { label: '俯瞰', hour: 10.5, at: [9, 14], face: 3.1, yaw: 0.4, pitch: 0.9, distance: 26 },
  bamboo: { label: '竹林', hour: 15, at: [-16.5, -5.5], face: 4.2, yaw: 1.2, pitch: 0.06, distance: 6.5 },
  terrace: { label: '黃昏石台', hour: 17.9, at: [-20.6, 18.6], face: 4.3, yaw: 1.15, pitch: 0.2, distance: 11 },
  dusk: { label: '黃昏海邊', hour: 17.6, at: [3, 33], face: 0, yaw: 3.0, pitch: 0.12, distance: 7 },
  night: { label: '夜晚', hour: 21.5, at: [4, 16], face: 3.1, yaw: 0.2, pitch: 0.25, distance: 8 },
} as const satisfies Record<string, GardenView>;

export type GardenViewId = keyof typeof GARDEN_VIEWS;

/** Where the character starts when no view is asked for (the path above the beach). */
export const GARDEN_START = START;

/**
 * The tree crowns as spheres [x, y, z, radius]: a following camera pulls in in front of
 * one rather than looking through the leaves (FollowCamera's `obstacles`).
 */
export const CROWN_SPHERES: readonly (readonly [number, number, number, number])[] = TREES.map(
  (t) => [t.x + t.lean * t.height * 0.5, (groundAt(t.x, t.z) ?? 0) + t.height, t.z, t.crown * 1.05] as const,
);
