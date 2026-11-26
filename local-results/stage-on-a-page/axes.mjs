import { createZhudaExtrudeMesh, transformZhudaMesh } from '../../packages/core/procedural/Geometry.ts';
const box = (m) => { const p = m.positions; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); } return { min: lo.map((v) => +v.toFixed(3)), max: hi.map((v) => +v.toFixed(3)) }; };
const outline = [[-1, -0.25], [1, -0.25], [1, 0.25], [-1, 0.25]];
const plain = createZhudaExtrudeMesh({ outline, height: 2 });
console.log('extrude (outline x from -1 to 1, second coordinate -0.25 to 0.25, height 2):', JSON.stringify(box(plain)));
for (const extra of [{ bevel: 0.1 }, { bevel: 0.1, bevelBottom: true }]) {
  try { console.log(JSON.stringify(extra), JSON.stringify(box(createZhudaExtrudeMesh({ outline, height: 2, ...extra })))); } catch (e) { console.log(JSON.stringify(extra), 'error:', e.message); }
}
for (const t of [{ pitchDeg: 90 }, { pitchDeg: -90 }, { yawDeg: 90 }, { rollDeg: 90 }]) console.log(JSON.stringify(t), JSON.stringify(box(transformZhudaMesh(plain, t))));
