// The hunting grounds as film scenes: a level field 24 m in radius inside low hills, standing
// stones at its edge (the wall the rules clamp to is drawn, not invisible), grass, and a look
// per quest. Everything is the scene format's own nodes; pictures come from the repository's
// textures/ (copied by tools/sync-assets.mjs).
import type { ZhudaFilmScene } from 'zhuda-laya-engine';
import { ARENA_RADIUS } from '../core/hunt.ts';

const tile = (id: string, meters: number, roughness = 0.85, tint?: [number, number, number, number]) => ({
  picture: `textures/${id}/albedo-512.png`, normal: `textures/${id}/normal-512.png`, tileMeters: [meters, meters] as [number, number], roughness, ...(tint ? { tint } : {}),
});

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** A ring of standing stones just outside the field, with a gap of sky between them. */
function stones(seed: number, material: string, count: number, tall: [number, number]) {
  const r = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const d = ARENA_RADIUS + 2.2 + r() * 2.5;
    const h = tall[0] + r() * (tall[1] - tall[0]);
    const w = 1.2 + r() * 1.6;
    return { id: `stone-${i}`, type: 'lathe' as const, material, position: [Math.sin(a) * d, -0.3, Math.cos(a) * d] as [number, number, number], segments: 7,
      profile: [[w, 0], [w * 0.92, h * 0.3], [w * 0.7, h * 0.72], [w * 0.36, h * 0.95], [0.01, h]] as [number, number][] };
  });
}

const FIELD = { minX: -ARENA_RADIUS - 3, maxX: ARENA_RADIUS + 3, minZ: -ARENA_RADIUS - 3, maxZ: ARENA_RADIUS + 3 };
/** The field itself: a low round slab of turf over the hills' levelled middle. */
const FIELD_SLAB = { id: 'field', type: 'extrude' as const, material: 'turf', position: [0, -0.06, 0] as [number, number, number], height: 0.08,
  outline: Array.from({ length: 40 }, (_, i) => [Math.cos((i / 40) * Math.PI * 2) * (ARENA_RADIUS + 4), -Math.sin((i / 40) * Math.PI * 2) * (ARENA_RADIUS + 4)] as [number, number]) };
const camera = { eye: [0, 4, -18] as [number, number, number], target: [0, 1.5, 0] as [number, number, number], focalLengthMm: 28 };

/** 竹原: a green field on a clear morning. */
export function plain(): ZhudaFilmScene {
  return {
    schemaVersion: 1, id: 'plain', camera,
    look: {
      preset: 'day', sun: { azimuthDeg: 135, elevationDeg: 38, intensity: 2.1, color: [1, 0.96, 0.88] },
      ambient: [0.5, 0.6, 0.72], ambientGround: [0.3, 0.36, 0.22],
      shadows: { distance: 60, resolution: 2048, cascades: 2, blend: true },
      lightFog: { density: 0.006, falloffMeters: 30, color: [0.74, 0.84, 0.92], scatter: 0.4, maxDistance: 400 },
      grade: { exposure: 1.08, contrast: 1.06, saturation: 1.05, bloom: 0.2, ao: 0.5 },
    },
    materials: { turf: tile('grass-lawn', 5, 0.9), hill: tile('forest-floor', 9, 0.9, [0.8, 0.95, 0.7, 1]), rock: tile('mossy-rock', 3.5, 0.8) },
    nodes: [
      { id: 'hills', type: 'terrain', position: [0, 0, 0], size: [260, 260], cells: [72, 72], material: 'hill',
        noise: { seed: 11, heightM: 22, scaleM: 60, flatten: [{ ...FIELD, y: 0, marginM: 16 }] } },
      FIELD_SLAB,
      ...stones(3, 'rock', 22, [2.4, 6.5]),
      { id: 'meadow', type: 'grass', area: FIELD, y: 0.02, density: 60, heightM: [0.1, 0.26], distanceM: 20, tip: [0.5, 0.66, 0.24], dryness: 0.15, wind: { strength: 0.35 } },
      { id: 'motes', type: 'effect', preset: 'dust-motes', position: [0, 1.5, 0], scale: 6 },
    ],
  };
}

/** 山口: the same ground at dusk, the wind up. */
export function dusk(): ZhudaFilmScene {
  const s = plain();
  return {
    ...s, id: 'dusk',
    look: {
      preset: 'dusk', sun: { azimuthDeg: 250, elevationDeg: 11, intensity: 1.7, color: [1, 0.62, 0.38] },
      ambient: [0.42, 0.36, 0.46], ambientGround: [0.34, 0.24, 0.18],
      shadows: { distance: 60, resolution: 2048, cascades: 2, blend: true },
      lightFog: { density: 0.011, falloffMeters: 22, color: [0.9, 0.56, 0.4], scatter: 0.7, maxDistance: 320 },
      grade: { exposure: 1.15, contrast: 1.08, saturation: 1.05, bloom: 0.35, ao: 0.5 },
    },
    materials: { turf: tile('grass-lawn', 5, 0.9, [0.95, 0.8, 0.6, 1]), hill: tile('cracked-earth', 8, 0.9, [0.9, 0.75, 0.6, 1]), rock: tile('cliff-rock', 4, 0.8) },
    nodes: [
      { id: 'hills', type: 'terrain', position: [0, 0, 0], size: [260, 260], cells: [72, 72], material: 'hill',
        noise: { seed: 23, heightM: 38, scaleM: 46, ridged: true, flatten: [{ ...FIELD, y: 0, marginM: 14 }] } },
      FIELD_SLAB,
      ...stones(7, 'rock', 18, [3.5, 9]),
      { id: 'meadow', type: 'grass', area: FIELD, y: 0.02, density: 50, heightM: [0.12, 0.34], distanceM: 20, tip: [0.72, 0.6, 0.3], dryness: 0.6, wind: { strength: 0.8 } },
      { id: 'leaves', type: 'effect', preset: 'falling-leaves', position: [0, 6, 0], scale: 5 },
    ],
  };
}

/** 常羊山: ash and old lava under a low sky, braziers at the edge. */
export function ash(): ZhudaFilmScene {
  const fires = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 0.6, d = ARENA_RADIUS + 1;
    return [Math.sin(a) * d, Math.cos(a) * d] as const;
  });
  return {
    schemaVersion: 1, id: 'ash', camera,
    look: {
      preset: 'overcast', sun: { azimuthDeg: 200, elevationDeg: 24, intensity: 1.2, color: [1, 0.8, 0.7] },
      ambient: [0.36, 0.33, 0.36], ambientGround: [0.4, 0.22, 0.14],
      shadows: { distance: 60, resolution: 2048, cascades: 2, blend: true },
      lightFog: { density: 0.016, falloffMeters: 16, color: [0.5, 0.36, 0.32], scatter: 0.6, maxDistance: 260 },
      grade: { exposure: 1.2, contrast: 1.12, saturation: 0.95, bloom: 0.5, ao: 0.55 },
    },
    materials: {
      turf: tile('cracked-earth', 6, 0.9, [0.62, 0.56, 0.54, 1]), hill: tile('lava-crust', 12, 0.85), rock: tile('rock-skin', 4, 0.7, [0.5, 0.46, 0.46, 1]),
      bronze: tile('bronze-thunder', 1.2, 0.45), flame: { color: [1, 0.55, 0.2], roughness: 1, emission: [5, 2.2, 0.5] },
    },
    nodes: [
      { id: 'hills', type: 'terrain', position: [0, 0, 0], size: [260, 260], cells: [72, 72], material: 'hill',
        noise: { seed: 41, heightM: 46, scaleM: 52, ridged: true, flatten: [{ ...FIELD, y: 0, marginM: 12 }] } },
      FIELD_SLAB,
      ...stones(13, 'rock', 16, [4, 11]),
      ...fires.flatMap(([x, z], k) => [
        { id: `bowl-${k}`, type: 'lathe' as const, material: 'bronze', position: [x, 0, z] as [number, number, number], segments: 14,
          profile: [[0.5, 0], [0.3, 0.2], [0.25, 1.5], [0.9, 2.0], [0.95, 2.2], [0.7, 2.15]] as [number, number][] },
        { id: `fire-${k}`, type: 'effect' as const, preset: 'campfire', position: [x, 2.15, z] as [number, number, number], scale: 1.8 },
        { id: `glow-${k}`, type: 'light' as const, kind: 'point' as const, position: [x, 3.2, z] as [number, number, number], color: [1, 0.55, 0.22] as [number, number, number], intensity: 9, range: 22 },
      ]),
      { id: 'embers', type: 'effect', preset: 'embers', position: [0, 0.5, 0], scale: 8 },
    ],
  };
}

export const ARENAS: Record<string, () => ZhudaFilmScene> = { plain, dusk, ash };
