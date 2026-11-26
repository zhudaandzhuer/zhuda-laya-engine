// Is a point light's shadow speckled in a closed room, and is a wide spot from the ceiling clean?
import fs from 'node:fs';
import { ZhudaFilmHost } from '../../packages/mcp-server/film-host.mjs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const room = (light) => ({
  schemaVersion: 1, id: 'room',
  camera: { eye: [3.2, 1.7, 3.4], target: [-0.6, 1.1, -0.8], focalLengthMm: 20 },
  look: { sky: [0, 0, 0], ambient: [0.06, 0.06, 0.07], sun: { intensity: 0 }, shadows: false, grade: { exposure: 1.2, bloom: 0.05, ao: 0.5 } },
  materials: { wall: { color: [0.82, 0.8, 0.76], roughness: 0.85 }, floor: { color: [0.45, 0.36, 0.28], roughness: 0.6 }, sofa: { color: [0.25, 0.4, 0.5], roughness: 0.8 } },
  nodes: [
    { id: 'floor', type: 'box', size: [8, 0.2, 8], position: [0, -0.2, 0], material: 'floor' },
    { id: 'ceiling', type: 'box', size: [8, 0.2, 8], position: [0, 3, 0], material: 'wall' },
    { id: 'w1', type: 'box', size: [8, 3, 0.2], position: [0, 0, -4], material: 'wall' },
    { id: 'w2', type: 'box', size: [8, 3, 0.2], position: [0, 0, 4], material: 'wall' },
    { id: 'w3', type: 'box', size: [0.2, 3, 8], position: [-4, 0, 0], material: 'wall' },
    { id: 'w4', type: 'box', size: [0.2, 3, 8], position: [4, 0, 0], material: 'wall' },
    { id: 'seat', type: 'box', size: [2.2, 0.45, 0.9], position: [-1, 0, -1.5], material: 'sofa', bevel: 0.08 },
    { id: 'back', type: 'box', size: [2.2, 0.9, 0.25], position: [-1, 0.45, -1.9], material: 'sofa', bevel: 0.08 },
    { id: 'pillar', type: 'box', size: [0.4, 3, 0.4], position: [-2.6, 0, 0.6], material: 'wall' },
    light,
  ],
});
const host = new ZhudaFilmHost({});
try {
  await host.ready();
  for (const [name, light] of Object.entries({
    point: { id: 'lamp', type: 'light', kind: 'point', position: [0, 2.6, 0], intensity: 6, range: 12, color: [1, 0.95, 0.85], castsShadow: true },
    spot: { id: 'lamp', type: 'light', kind: 'spot', position: [0, 2.85, 0], target: [0, 0, 0], intensity: 9, range: 12, color: [1, 0.95, 0.85], spotAngleDeg: 150, castsShadow: true },
  })) {
    try { const { png, advice } = await host.preview(room(light), { width: 960, height: 540 }); fs.writeFileSync(`${out}/${name}.png`, png); console.log(name, 'ok', JSON.stringify(advice ?? null).slice(0, 300)); }
    catch (e) { console.log(name, 'error:', String(e.message).slice(0, 400)); }
  }
} finally { await host.dispose?.(); await host.close?.(); }
