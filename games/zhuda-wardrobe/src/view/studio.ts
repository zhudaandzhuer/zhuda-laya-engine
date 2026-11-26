// The room the character stands in, as a film scene: a round floor, a curved wall behind, daylight.
import type { ZhudaFilmScene } from 'zhuda-laya-engine';

export function studio(): ZhudaFilmScene {
  return {
    schemaVersion: 1, id: 'studio',
    camera: { eye: [0, 1.05, 3.3], target: [0, 0.86, 0], focalLengthMm: 50 },
    look: {
      preset: 'day', sun: { azimuthDeg: 28, elevationDeg: 48, intensity: 2.0, color: [1, 0.97, 0.92] },
      ambient: [0.62, 0.66, 0.74], ambientGround: [0.4, 0.38, 0.36],
      shadows: { distance: 12, resolution: 2048, cascades: 1, blend: true },
      grade: { exposure: 1.05, contrast: 1.04, saturation: 1.02, bloom: 0.1, ao: 0.5 },
    },
    materials: {
      floor: { color: [0.62, 0.6, 0.58], roughness: 0.85 },
      wall: { color: [0.36, 0.4, 0.5], roughness: 0.95 },
    },
    nodes: [
      { id: 'floor', type: 'lathe', material: 'floor', position: [0, -0.04, 0], segments: 48, profile: [[2.6, 0], [2.6, 0.04], [0.01, 0.04]] },
      { id: 'wall', type: 'box', material: 'wall', position: [0, 0, -3.2], size: [14, 6, 0.3] },
      { id: 'ground', type: 'box', material: 'wall', position: [0, -0.3, 0], size: [14, 0.26, 8] },
    ],
  } as ZhudaFilmScene;
}
