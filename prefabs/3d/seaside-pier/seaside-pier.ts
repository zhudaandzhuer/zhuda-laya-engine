// A small seaside for a game played from above: a beach with rocks and two palms, a wooden pier, a
// rescue raft moored beside it, open sea, and the things that go in the water (a bamboo pole, a
// swim ring, a jellyfish, five pieces a pig can wear). Every model was made from numbers in
// Blender (`source/scene.py`, `source/gear.py`): no downloads, no textures, 27,302 triangles in all.
//
// After `sync.mjs … 3d/seaside-pier` the files are served at
// `common/3d/seaside-pier/assets/<file>` next to the game's index.html. Load them with
// ZhudaModelLibrary, then `mountSeaside`. The sea itself is the engine's water surface
// (`SEASIDE_WATER`), and the light is `SEASIDE_LOOK`: both are the values of the game this came
// from, the workspace game zhuer-fish-them-out (2026-11-18). Route: docs/routes/pole-rescue-arcade-3d.md.
//
// Coordinates: y up, the camera looks from +z, the water is at y = 0. The numbers here agree with
// source/scene.py (the pier's deck, where the raft floats, the beach line).

export const SEASIDE_BASE = 'common/3d/seaside-pier/assets/';

/** The four files, their root nodes and their weight. */
export const SEASIDE_FILES = {
  shore: { file: 'shore.glb', nodes: ['shore'], triangles: 14444, what: '沙灘、海床、石頭、兩棵椰子樹' },
  dock: { file: 'dock.glb', nodes: ['dock', 'raft'], triangles: 3698, what: '木碼頭與繫在旁邊的救生艇' },
  props: { file: 'props.glb', nodes: ['pole', 'ring', 'jelly'], triangles: 1848, what: '竹竿（沿 +Y 長 1 m）、泳圈（外徑 0.84 m，平放）、水母' },
  gear: { file: 'gear.glb', nodes: ['cap', 'vest', 'crown', 'shades', 'snorkel'], triangles: 7312, what: '豬大能戴的五件：泳帽、救生衣、皇冠、墨鏡、潛水面鏡' },
} as const;
export type SeasideFile = keyof typeof SEASIDE_FILES;

/** The served path of one of the files, for a provider rooted at the page. */
export const seasidePath = (id: SeasideFile) => `${SEASIDE_BASE}${SEASIDE_FILES[id].file}`;

export const WATER_Y = 0;
/** The pier's deck: x from x0 to x1, z from z0 to z1, its top at `top`. */
export const DOCK = { x0: -12, x1: -3.6, z0: 0, z1: 1.9, top: 0.55 } as const;
/** Where the raft floats (its middle, on the water) and how far from it counts as "in the raft". */
export const RAFT = { x: -4.3, z: 3.35, radius: 1.25 } as const;
/** The open water in front of the pier, for a wide screen and for a tall one. */
export const SEA = { minX: -2.4, maxX: 6.2, minZ: -5.2, maxZ: 2.6 } as const;
export const SEA_TALL = { minX: -2.6, maxX: 7.4, minZ: -2.5, maxZ: 2.3 } as const;
/** A place to stand at the end of the pier. */
export const PIER_END: readonly [number, number, number] = [-4.35, DOCK.top - 0.02, 0.95];
/** The view the scene was composed for (a wide screen): field of view, eye and the point looked at. */
export const SEASIDE_CAMERA = { fov: 36, eye: [-0.75, 8.6, 8.75], target: [-0.75, -0.2, -0.05] } as const;

/** Each piece of gear and the bone of `3d/zhuda-characters`' Zhuda it follows (modelled on its rest pose, feet at 0). */
export const GEAR_BONE = { cap: 'head', vest: 'spine', crown: 'head', shades: 'head', snorkel: 'head' } as const;
export type SeasideGear = keyof typeof GEAR_BONE;

/** The light: a clear day, the sun to the right and behind. Give it to `new ZhudaSceneLook(scene, camera, SEASIDE_LOOK, …)`. */
export const SEASIDE_LOOK = {
  preset: 'day' as const,
  sun: { azimuthDeg: 140, elevationDeg: 50 },
  ambientGround: [0.42, 0.36, 0.26] as [number, number, number],
  shadows: { distance: 45, resolution: 2048 as const, cascades: 2 as const },
  grade: { exposure: 1.12, bloom: 0.18, ao: 0.45 },
  lightFog: { density: 0.0025 },
};

/**
 * The sea, for `new ZhudaWaterSurface(scene, { ...seasideWater(phone), sun })`. The glint the game
 * used is soft (`sun.color` about [0.05, 0.047, 0.042]): a bright one sparkles all over the sea and
 * pulls the eye from what floats in it.
 */
export function seasideWater(phone = false) {
  return {
    position: [2, WATER_Y, -8] as [number, number, number],
    size: [80, 56] as [number, number],
    flow: [0.04, 0.06] as [number, number],
    color: [0.0, 0.26, 0.4] as [number, number, number],
    clarity: 0.3,
    waveMeters: 1.5,
    waves: 0.14,
    reflection: 0.55,
    glow: 0.7,
    foamDepth: 0.14,
    resolution: (phone ? 512 : 1024) as 512 | 1024,
  };
}

/** What a loaded model gives: its root, and a named node inside it (ZhudaModelLibrary's instance has both). */
export interface SeasideModel {
  node: Laya.Sprite3D;
  find(name: string): Laya.Sprite3D | null | undefined;
}

function shade(node: Laya.Node, cast: boolean) {
  const r = (node as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) as Laya.MeshRenderer | null;
  if (r) (r.castShadow = cast), (r.receiveShadow = true);
  for (let i = 0; i < node.numChildren; i++) shade(node.getChildAt(i), cast);
}

/**
 * Puts the shore and the pier in the scene (the shore receives shadows and casts none, the pier
 * and the raft cast them) and keeps the props and the gear in it switched off, as sources to
 * clone from. Returns the raft, and the three props and the gear to clone.
 */
export function mountSeaside(scene: Laya.Scene3D, models: { shore: SeasideModel; dock: SeasideModel; props?: SeasideModel; gear?: SeasideModel }) {
  scene.addChild(models.shore.node);
  shade(models.shore.node, false);
  scene.addChild(models.dock.node);
  shade(models.dock.node, true);
  for (const source of [models.props, models.gear]) {
    if (!source) continue;
    scene.addChild(source.node);
    source.node.active = false;
  }
  return {
    raft: models.dock.find('raft') ?? null,
    pole: models.props?.find('pole') ?? null,
    ring: models.props?.find('ring') ?? null,
    jelly: models.props?.find('jelly') ?? null,
    gear: (piece: SeasideGear) => models.gear?.find(piece) ?? null,
  };
}
