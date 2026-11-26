// 兩個模型逐高度比粗細（綁定姿勢、同樣的正交投影、同樣的身高）：正面每個高度的身體／腿、手臂、手的寬，
// 側面的前後緣。第二個模型通常是別人的高模（例如混元 3D 生成的），縮放到和第一個一樣高。
//
//   node 3d/stickman/source/measure-pair.mjs <我們的.glb> <對照的.glb>     （在 prefabs/ 底下跑）
import fs from 'node:fs';
import { look } from '../../../../games/tools/characters/raster.mjs';
import { loadMeshSource } from './mesh-source.mjs';

const [aFile, bFile] = process.argv.slice(2);
const readGlb = (file) => {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12), g = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = 20 + jl + 8;
  const read = (i) => { const a = g.accessors[i], v = g.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC3: 3 }[a.type] * a.count; const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType]; const at = b.byteOffset + bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return new T(b.buffer.slice(at, at + n * T.BYTES_PER_ELEMENT)); };
  const p = g.meshes[0].primitives[0];
  return { positions: read(p.attributes.POSITION), indices: Uint32Array.from(read(p.indices)) };
};
const A = readGlb(aFile);
let top = 0;
for (let i = 1; i < A.positions.length; i += 3) top = Math.max(top, A.positions[i]);
const B = loadMeshSource(bFile, { height: top });
const pxm = 745, BOX = [-0.45, -0.02, 0.45, 1.25];
const mask = (m, yaw) => {
  const v = look([{ positions: m.positions, indices: m.indices }], { yaw, pitch: 0, pxPerMetre: pxm, bounds: BOX });
  const pad = 2 / pxm;
  return (h, d) => { const x = Math.floor((d - BOX[0] + pad) * pxm), y = Math.floor((h - BOX[1] + pad) * pxm); return x >= 0 && y >= 0 && x < v.width && y < v.height && v.id[y * v.width + x] >= 0; };
};
const runs = (m, h) => {
  const out = [];
  let on = false, s = 0;
  for (let i = 0; i <= 450; i++) {
    const d = i / 1000, hit = m(h, -d);
    if (hit && !on) (on = true), (s = d);
    if (!hit && on) (on = false), out.push([s, d]);
  }
  return out;
};
const ext = (m, h) => { let f = null, b = null; for (let i = -300; i <= 300; i++) if (m(h, i / 1000)) { if (f === null) f = i / 1000; b = i / 1000; } return f === null ? null : [f, b]; };
const cm = (v) => (v * 100).toFixed(1);
const fa = mask(A, 0), fb = mask(B, 0), sa = mask(A, 90), sb = mask(B, 90);
console.log(`身高 ${top.toFixed(3)} m（對照的縮放到一樣高）`);
console.log('正面（右半，離中線 cm：身體或腿 | 手臂 | 手）          側面（前緣…後緣 cm，含垂在旁邊的手）');
console.log('高度   我們的                    對照的                    我們的          對照的');
for (let h = 0.8; h >= 0.02; h -= 0.04) {
  const f = (m) => runs(m, h).map(([a, b]) => `${cm(a)}–${cm(b)}(${cm(b - a)})`).join(' | ') || '—';
  const s = (m) => { const e = ext(m, h); return e ? `${cm(e[0])}…${cm(e[1])}(${cm(e[1] - e[0])})` : '—'; };
  console.log(`${h.toFixed(2)}  ${f(fa).padEnd(26)} ${f(fb).padEnd(26)} ${s(sa).padEnd(15)} ${s(sb)}`);
}
