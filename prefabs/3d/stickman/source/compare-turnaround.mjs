// 把模型的綁定姿勢（A 字手）用正交投影畫成剪影，和三視圖（source/turnaround/01-turnaround.png）的正面、側面疊起來比。
//
//   node 3d/stickman/source/compare-turnaround.mjs [輸出.png]    （在 prefabs/ 底下跑；先跑 build.mjs）
//
// 三視圖裡的角色身高換算成 1.2 m（腳底到頭頂 894 px）。輸出一張疊圖：兩邊都有＝深灰、只有三視圖有＝藍（模型少了）、
// 只有模型有＝紅（模型多了）；印出正面、側面的重疊率（交集 ÷ 聯集）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { look, writePng } from '../../../../games/tools/characters/raster.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(HERE, 'turnaround', 'compare.png');
const ref = PNG.sync.read(fs.readFileSync(path.join(HERE, 'turnaround', '01-turnaround.png')));

// 讀回 GLB 的位置與三角形（綁定姿勢）。
const bytes = fs.readFileSync(path.join(HERE, '..', 'assets', 'stickman.glb'));
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

// 三視圖的角色：腳底 y、高度、正面與側面的中心 x（頭的左右邊界的中點）。
const W = ref.width, H = ref.height;
const lum = (x, y) => {
  const i = (y * W + x) * 4;
  return 0.3 * ref.data[i] + 0.59 * ref.data[i + 1] + 0.11 * ref.data[i + 2];
};
/** 區域裡的角色（含被包住的眼白、嘴）：從邊界把背景（亮的）灌滿，剩下的就是角色。 */
function referenceMask(x0, x1) {
  const w = x1 - x0, bg = new Uint8Array(w * H), stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= H || bg[y * w + x] || lum(x0 + x, y) < 200) return;
    bg[y * w + x] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) push(x, 0), push(x, H - 1);
  for (let y = 0; y < H; y++) push(0, y), push(w - 1, y);
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    push(x + 1, y), push(x - 1, y), push(x, y + 1), push(x, y - 1);
  }
  let top = H, bottom = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (!bg[y * w + x]) (top = Math.min(top, y)), (bottom = Math.max(bottom, y));
  // 頭的左右邊界（頭頂往下 40% 頭高之內最寬的那一行）。
  let hl = w, hr = 0;
  for (let y = top; y < top + (bottom - top) * 0.2; y++) for (let x = 0; x < w; x++) if (!bg[y * w + x]) (hl = Math.min(hl, x)), (hr = Math.max(hr, x));
  return { x0, w, inside: (x, y) => !bg[y * w + x], top, bottom, centre: (hl + hr) / 2 };
}
const views = [
  { name: '正面', yaw: 0, ref: referenceMask(100, 640) },
  { name: '側面', yaw: 90, ref: referenceMask(660, 1020) },
];
const HEIGHT = 1.2;
const tiles = [];
const result = {};
for (const v of views) {
  const pxm = (v.ref.bottom - v.ref.top) / HEIGHT;
  const B = [-0.45, -0.02, 0.45, 1.25];
  const view = look([{ positions, indices }], { yaw: v.yaw, pitch: 0, pxPerMetre: pxm, bounds: B });
  const pad = 2 / pxm;
  const mine = (sx, sy) => {
    const x = Math.floor((sx - B[0] + pad) * pxm), y = Math.floor((sy - B[1] + pad) * pxm);
    if (x < 0 || y < 0 || x >= view.width || y >= view.height) return false;
    return view.id[y * view.width + x] >= 0;
  };
  let both = 0, onlyRef = 0, onlyMine = 0;
  const rgba = new Uint8Array(v.ref.w * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < v.ref.w; x++) {
      const sx = (x + 0.5 - v.ref.centre) / pxm, sy = (v.ref.bottom + 0.5 - y) / pxm;
      const r = v.ref.inside(x, y), m = mine(sx, sy);
      const c = r && m ? [70, 70, 76] : r ? [40, 110, 255] : m ? [235, 50, 50] : [250, 250, 250];
      if (r && m) both++;
      else if (r) onlyRef++;
      else if (m) onlyMine++;
      rgba.set([...c, 255], (y * v.ref.w + x) * 4);
    }
  result[v.name] = { iou: +(both / (both + onlyRef + onlyMine)).toFixed(3), modelMissingPx: onlyRef, modelExtraPx: onlyMine };
  tiles.push({ width: v.ref.w, height: H, rgba });
}
const width = tiles.reduce((a, t) => a + t.width, 0), all = new Uint8Array(width * H * 4);
let ox = 0;
for (const t of tiles) {
  for (let y = 0; y < H; y++) all.set(t.rgba.subarray(y * t.width * 4, (y + 1) * t.width * 4), (y * width + ox) * 4);
  ox += t.width;
}
writePng(out, width, H, all);
console.log(JSON.stringify({ out, ...result }));
