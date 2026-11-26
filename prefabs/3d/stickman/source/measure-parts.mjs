// 逐部位、逐高度比三視圖和模型：用同樣的正交投影、同樣的比例（身高 1.2 m），量每個高度的
// 身體／腿的寬、手臂的位置與粗細、側面的前緣後緣，印成一張表。模型停在綁定姿勢（A 字手，和三視圖同姿勢）。
//
//   node 3d/stickman/source/measure-parts.mjs [glb]     （在 prefabs/ 底下跑）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { look } from '../../../../games/tools/characters/raster.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ref = PNG.sync.read(fs.readFileSync(path.join(HERE, 'turnaround', '01-turnaround.png')));
const bytes = fs.readFileSync(process.argv[2] ?? path.join(HERE, '..', 'assets', 'stickman.glb'));
const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const jl = dv.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jl)));
const bin = 20 + jl + 8;
const read = (i) => {
  const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3 }[a.type] * a.count;
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
  const at = bytes.byteOffset + bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new T(bytes.buffer.slice(at, at + n * T.BYTES_PER_ELEMENT));
};
const prim = gltf.meshes[0].primitives[0];
const positions = read(prim.attributes.POSITION), indices = Uint32Array.from(read(prim.indices));

// 三視圖的遮罩（同 compare-turnaround：從邊界灌背景，剩下的是角色，含眼白）。
const W = ref.width, H = ref.height;
const lum = (x, y) => { const i = (y * W + x) * 4; return 0.3 * ref.data[i] + 0.59 * ref.data[i + 1] + 0.11 * ref.data[i + 2]; };
function refMask(x0, x1) {
  const w = x1 - x0, bg = new Uint8Array(w * H), st = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= H || bg[y * w + x] || lum(x0 + x, y) < 200) return; bg[y * w + x] = 1; st.push(x, y); };
  for (let x = 0; x < w; x++) push(x, 0), push(x, H - 1);
  for (let y = 0; y < H; y++) push(0, y), push(w - 1, y);
  while (st.length) { const y = st.pop(), x = st.pop(); push(x + 1, y), push(x - 1, y), push(x, y + 1), push(x, y - 1); }
  let top = H, bottom = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (!bg[y * w + x]) (top = Math.min(top, y)), (bottom = Math.max(bottom, y));
  let hl = w, hr = 0;
  for (let y = top; y < top + (bottom - top) * 0.2; y++) for (let x = 0; x < w; x++) if (!bg[y * w + x]) (hl = Math.min(hl, x)), (hr = Math.max(hr, x));
  const pxm = (bottom - top) / 1.2, cx = (hl + hr) / 2;
  // 回傳：在高度 h（公尺）、離中線 dx（公尺，正＝畫面右）是不是角色。
  return (h, dx) => { const x = Math.round(cx + dx * pxm), y = Math.round(bottom - h * pxm); return x >= 0 && x < w && y >= 0 && y < H && !bg[y * w + x]; };
}
function modelMask(yaw) {
  const pxm = 745, B = [-0.45, -0.02, 0.45, 1.25];
  const v = look([{ positions, indices }], { yaw, pitch: 0, pxPerMetre: pxm, bounds: B });
  const pad = 2 / pxm;
  return (h, dx) => { const x = Math.floor((dx - B[0] + pad) * pxm), y = Math.floor((h - B[1] + pad) * pxm); return x >= 0 && y >= 0 && x < v.width && y < v.height && v.id[y * v.width + x] >= 0; };
}
// 正面：畫面左半（角色的右邊）從中線往外的每一段 [從, 到]（公尺，取絕對值）。
const runs = (m, h, side = -1) => {
  const out = [];
  let inRun = false, s = 0;
  for (let i = 0; i <= 450; i++) {
    const d = i / 1000, on = m(h, side * d);
    if (on && !inRun) (inRun = true), (s = d);
    if (!on && inRun) (inRun = false), out.push([s, d]);
  }
  return out;
};
const front = { ref: refMask(100, 640), model: modelMask(0) };
const side = { ref: refMask(660, 1020), model: modelMask(90) };
const cm = (v) => (v * 100).toFixed(1);
const fmt = (rs) => rs.map(([a, b]) => `${cm(a)}–${cm(b)}`).join(' | ') || '—';
console.log('正面（角色右半，離中線的距離 cm；第一段是身體或腿，後面是手臂、手）');
console.log('高度 m   三視圖                         模型');
for (let h = 1.15; h >= 0.02; h -= 0.05) console.log(`${h.toFixed(2)}   ${fmt(runs(front.ref, h)).padEnd(30)} ${fmt(runs(front.model, h))}`);
console.log('\n側面（臉朝畫面左：負＝前面）：最前緣、最後緣 cm');
for (let h = 1.15; h >= 0.02; h -= 0.05) {
  const ext = (m) => { let f = null, b = null; for (let i = -300; i <= 300; i++) if (m(h, i / 1000)) { if (f === null) f = i / 1000; b = i / 1000; } return f === null ? '—' : `${cm(f)} … ${cm(b)}`; };
  console.log(`${h.toFixed(2)}   ${ext(side.ref).padEnd(18)} ${ext(side.model)}`);
}
