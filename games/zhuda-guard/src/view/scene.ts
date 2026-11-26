// The pass as a film scene: low hills, the road laid over them as slabs between the rules' own
// points, a stone pad at every building place, and the village gate at the road's end.
import type { ZhudaFilmScene } from 'zhuda-laya-engine';
import { PADS, ROAD } from '../core/td.ts';

const tile = (id: string, meters: number, roughness = 0.85, tint?: [number, number, number, number]) => ({
  picture: `textures/${id}/albedo-512.png`, normal: `textures/${id}/normal-512.png`, tileMeters: [meters, meters] as [number, number], roughness, ...(tint ? { tint } : {}),
});
const FLAT = { minX: -36, maxX: 36, minZ: -20, maxZ: 22 };

export function pass(): ZhudaFilmScene {
  const road = ROAD.slice(1).map((b, i) => {
    const a = ROAD[i];
    const w = 3.4, x0 = Math.min(a[0], b[0]) - w / 2, x1 = Math.max(a[0], b[0]) + w / 2, z0 = Math.min(a[1], b[1]) - w / 2, z1 = Math.max(a[1], b[1]) + w / 2;
    // An extrude's outline is [x, z] on the ground. (It was written [x, -z] at first: the road was drawn mirrored
    // and the beasts walked beside it; only an asymmetric shape shows the mistake.)
    return { id: `road-${i}`, type: 'extrude' as const, material: 'road', position: [0, 0, 0] as [number, number, number], height: 0.06, outline: [[x0, z0], [x0, z1], [x1, z1], [x1, z0]] as [number, number][] };
  });
  const pads = PADS.map(([x, z], i) => ({ id: `pad-${i}`, type: 'lathe' as const, material: 'stone', position: [x, 0, z] as [number, number, number], segments: 16, profile: [[1.9, 0], [1.8, 0.22], [1.6, 0.3], [0.01, 0.3]] as [number, number][] }));
  const [gx, gz] = ROAD[ROAD.length - 1];
  return {
    schemaVersion: 1, id: 'pass',
    camera: { eye: [0, 47, -45], target: [0, 0, 0], focalLengthMm: 28 },
    look: {
      preset: 'day', sun: { azimuthDeg: 140, elevationDeg: 44, intensity: 2.1, color: [1, 0.96, 0.88] },
      ambient: [0.52, 0.6, 0.72], ambientGround: [0.3, 0.36, 0.22],
      shadows: { distance: 90, resolution: 2048, cascades: 2, blend: true },
      lightFog: { density: 0.004, falloffMeters: 30, color: [0.74, 0.84, 0.92], scatter: 0.4, maxDistance: 400 },
      grade: { exposure: 1.08, contrast: 1.06, saturation: 1.05, bloom: 0.2, ao: 0.5 },
    },
    materials: {
      turf: tile('grass-lawn', 6, 0.9), hill: tile('forest-floor', 10, 0.9, [0.8, 0.95, 0.7, 1]), road: tile('dirt-path', 4, 0.9), stone: tile('stone-pavers', 2.5, 0.8),
      wall: tile('stone-wall', 3, 0.85), wood: tile('old-planks', 2, 0.7), roof: tile('clay-roof-tiles', 2, 0.6),
    },
    nodes: [
      { id: 'hills', type: 'terrain', position: [0, -0.05, 0], size: [240, 240], cells: [64, 64], material: 'hill', noise: { seed: 17, heightM: 20, scaleM: 55, flatten: [{ ...FLAT, y: 0, marginM: 14 }] } },
      { id: 'field', type: 'extrude', material: 'turf', position: [0, -0.08, 0], height: 0.08, outline: [[FLAT.minX, FLAT.minZ], [FLAT.minX, FLAT.maxZ], [FLAT.maxX, FLAT.maxZ], [FLAT.maxX, FLAT.minZ]] },
      ...road,
      ...pads,
      // The gate: two stone piers, a beam and a tiled cap, a stretch of wall either side.
      { id: 'pier-a', type: 'box', material: 'wall', position: [gx + 1, 0, gz - 3.2], size: [1.6, 5, 1.6] },
      { id: 'pier-b', type: 'box', material: 'wall', position: [gx + 1, 0, gz + 3.2], size: [1.6, 5, 1.6] },
      { id: 'beam', type: 'box', material: 'wood', position: [gx + 1, 5, gz], size: [1.2, 0.7, 8.6] },
      { id: 'cap', type: 'box', material: 'roof', position: [gx + 1, 5.7, gz], size: [2.6, 0.5, 9.8] },
      { id: 'wall-a', type: 'box', material: 'wall', position: [gx + 1, 0, gz - 9], size: [1.2, 3.2, 10] },
      { id: 'wall-b', type: 'box', material: 'wall', position: [gx + 1, 0, gz + 8.4], size: [1.2, 3.2, 8.8] },
      // Grass is off unless ?grass=1: over this field it alone is about 480 draws a frame (measured: 525 with, 45 without),
      // and from a camera 55 m up it cannot be seen.
      ...(typeof location === 'undefined' || !new URLSearchParams(location.search).has('grass') ? [] : [{ id: 'meadow', type: 'grass' as const, area: FLAT, y: 0, density: 40, heightM: [0.08, 0.22] as [number, number], distanceM: 70, tip: [0.5, 0.66, 0.24] as [number, number, number], dryness: 0.15, wind: { strength: 0.3 } }]),
    ],
  };
}
