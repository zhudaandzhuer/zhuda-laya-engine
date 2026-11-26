// 從一個高模（騰訊混元 3D 照三視圖生成的 50k 版，需求者 說「這個像」）的頭上，依方向取出臉的圖案：
// 從頭的球心往每個方向（左右角 yaw、上下角 pitch）射出去，打到頭的表面，讀那裡的底色貼圖，
// 分成「眼白」「嘴」兩個通道，存成 face/face-mask.png（R＝眼白、G＝嘴，0..255，有反鋸齒的邊）。
// 建置時我們的正圓頭照方向查這張圖，把眼睛和嘴畫進底色貼圖（不需要那個高模，也不靠幾何貼片）。
//
//   node 3d/stickman/source/face/extract-face.mjs <高模.glb>      （在 prefabs/ 底下跑）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { buildBvh, loadMeshSource, sampleTexture } from '../mesh-source.mjs';
import { FACE_MASK, HEAD } from '../stickman-def.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = loadMeshSource(process.argv[2], { height: HEAD.centre[1] + HEAD.radii[0] });
const P = src.positions;
// 頭的球心和半徑：頭頂附近（y 在球心以上）的頂點擬合一個球（最小平方）。
const pts = [];
for (let i = 0; i < P.length; i += 3) if (P[i + 1] > HEAD.centre[1] - 0.02 && Math.abs(P[i]) < 0.25) pts.push([P[i], P[i + 1], P[i + 2]]);
let c = [0, HEAD.centre[1], 0], r = HEAD.radii[0];
for (let it = 0; it < 50; it++) {
  // 高斯牛頓：殘差 |p - c| - r
  const JtJ = Array.from({ length: 4 }, () => [0, 0, 0, 0]), Jtr = [0, 0, 0, 0];
  for (const p of pts) {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], L = Math.hypot(...d) || 1;
    const J = [-d[0] / L, -d[1] / L, -d[2] / L, -1], res = L - r;
    for (let a = 0; a < 4; a++) {
      Jtr[a] += J[a] * res;
      for (let b = 0; b < 4; b++) JtJ[a][b] += J[a] * J[b];
    }
  }
  // 4×4 解（高斯消去）
  const M = JtJ.map((row, a) => [...row, -Jtr[a]]);
  for (let a = 0; a < 4; a++) {
    let piv = a;
    for (let b = a + 1; b < 4; b++) if (Math.abs(M[b][a]) > Math.abs(M[piv][a])) piv = b;
    [M[a], M[piv]] = [M[piv], M[a]];
    for (let b = 0; b < 4; b++) if (b !== a) { const f = M[b][a] / M[a][a]; for (let k = a; k < 5; k++) M[b][k] -= f * M[a][k]; }
  }
  const dx = M.map((row, a) => row[4] / row[a]);
  (c = [c[0] + dx[0], c[1] + dx[1], c[2] + dx[2]]), (r += dx[3]);
  if (Math.hypot(...dx) < 1e-7) break;
}
const bvh = buildBvh(P, src.indices);
const { yaw: [y0, y1], pitch: [p0, p1], step } = FACE_MASK;
const W = Math.round((y1 - y0) / step), H = Math.round((p1 - p0) / step);
const out = new PNG({ width: W, height: H });
let eyeTexels = 0, mouthTexels = 0, misses = 0;
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const yaw = ((y0 + (i + 0.5) * step) * Math.PI) / 180, pitch = ((p1 - (j + 0.5) * step) * Math.PI) / 180;
    const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const o = [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r];
    const h = bvh.nearestOnLine(o, d, 0.05);
    let eye = 0, mouth = 0;
    if (h) {
      const I = src.indices, U = src.uvs, w = [1 - h.b1 - h.b2, h.b1, h.b2], v = [I[h.tri * 3], I[h.tri * 3 + 1], I[h.tri * 3 + 2]];
      const uv = [0, 1].map((k) => w[0] * U[v[0] * 2 + k] + w[1] * U[v[1] * 2 + k] + w[2] * U[v[2] * 2 + k]);
      const [R, G, B] = sampleTexture(src.baseColor, uv[0], uv[1]);
      const lum = 0.3 * R + 0.59 * G + 0.11 * B, red = R - (G + B) / 2;
      // 身體約 0.25、眼白約 0.97、嘴紅 R≈0.8 G,B≈0.2：在兩者之間平滑換算成覆蓋率。
      mouth = Math.max(0, Math.min(1, (red - 0.12) / 0.3));
      eye = mouth > 0.5 ? 0 : Math.max(0, Math.min(1, (lum - 0.4) / 0.4));
    } else misses++;
    if (eye > 0.5) eyeTexels++;
    if (mouth > 0.5) mouthTexels++;
    out.data.set([Math.round(eye * 255), Math.round(mouth * 255), 0, 255], (j * W + i) * 4);
  }
// 嘴是一條細線，貼到 3000 面模型的貼圖上會被取樣糊掉一點：嘴的通道先往外長一格（3×3 取最大），看起來和混元那顆一樣粗。
{
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v = Math.max(v, out.data[(Math.max(0, Math.min(H - 1, y + dy)) * W + Math.max(0, Math.min(W - 1, x + dx))) * 4 + 1]);
      m[y * W + x] = v;
    }
  for (let i = 0; i < W * H; i++) out.data[i * 4 + 1] = m[i];
}
// 去毛邊：每個通道先 3×3 中位數（去掉零星的雜點），再高斯模糊（σ ≈ 1 格），再用平滑階梯收回成有一格反鋸齒的邊。
for (const ch of [0, 1]) {
  const at = (x, y) => out.data[(Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))) * 4 + ch] / 255;
  const med = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n.push(at(x + dx, y + dy));
      med[y * W + x] = n.sort((a, b) => a - b)[4];
    }
  const k = [0.06, 0.24, 0.4, 0.24, 0.06];
  const blur = (src, dx, dy) => {
    const dst = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let i = -2; i <= 2; i++) s += k[i + 2] * src[Math.max(0, Math.min(H - 1, y + i * dy)) * W + Math.max(0, Math.min(W - 1, x + i * dx))];
        dst[y * W + x] = s;
      }
    return dst;
  };
  const b = blur(blur(med, 1, 0), 0, 1);
  for (let i = 0; i < W * H; i++) {
    const t = Math.max(0, Math.min(1, (b[i] - 0.3) / 0.4));
    out.data[i * 4 + ch] = Math.round(t * t * (3 - 2 * t) * 255);
  }
}
fs.writeFileSync(path.join(HERE, 'face-mask.png'), PNG.sync.write(out));
console.log(JSON.stringify({ source: path.basename(process.argv[2]), headCentre: c.map((v) => +v.toFixed(4)), headRadius: +r.toFixed(4), size: [W, H], eyeTexels, mouthTexels, misses }));
