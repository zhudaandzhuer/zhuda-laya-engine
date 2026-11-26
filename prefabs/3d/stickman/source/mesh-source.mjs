// 拿別人做好的高模（例如騰訊混元 3D 生成的 .glb）當形狀來源：讀網格、轉正、縮放，建 BVH 給烘焙查。
// 只讀第一個有網格的節點、第一個 primitive；節點的 rotation／scale／translation 會套上去（Blender 匯出的 Z 上轉 Y 上）。
import fs from 'node:fs';
import { PNG } from 'pngjs';

const quatApply = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};

/** 讀 .glb：回傳位置、法線、UV、索引（套上節點的轉動）、底色貼圖（解好的 RGBA）。腳底移到 y = 0、身高縮放到 `height`（公尺）。 */
export function loadMeshSource(file, { height } = {}) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const g = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = 20 + jl + 8;
  const read = (i) => {
    const a = g.accessors[i], v = g.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count;
    const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const at = b.byteOffset + bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new T(b.buffer.slice(at, at + n * T.BYTES_PER_ELEMENT));
  };
  const node = g.nodes.find((n) => n.mesh !== undefined);
  const prim = g.meshes[node.mesh].primitives[0];
  const P = read(prim.attributes.POSITION), N = read(prim.attributes.NORMAL), UV = read(prim.attributes.TEXCOORD_0), I = Uint32Array.from(read(prim.indices));
  const q = node.rotation ?? [0, 0, 0, 1], s = node.scale ?? [1, 1, 1];
  for (let i = 0; i < P.length; i += 3) {
    const p = quatApply(q, [P[i] * s[0], P[i + 1] * s[1], P[i + 2] * s[2]]);
    P.set(p, i);
    const n = quatApply(q, [N[i], N[i + 1], N[i + 2]]);
    const l = Math.hypot(...n) || 1;
    N.set([n[0] / l, n[1] / l, n[2] / l], i);
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < P.length; i += 3) (lo = Math.min(lo, P[i])), (hi = Math.max(hi, P[i]));
  const k = height ? height / (hi - lo) : 1;
  for (let i = 0; i < P.length; i += 3) (P[i] *= k), (P[i + 1] = (P[i + 1] - lo) * k), (P[i + 2] *= k);
  const mat = g.materials?.[prim.material ?? 0];
  const tex = mat?.pbrMetallicRoughness?.baseColorTexture;
  const imageOf = (ref) => {
    if (!ref) return null;
    const im = g.images[g.textures[ref.index].source], v = g.bufferViews[im.bufferView];
    return PNG.sync.read(b.subarray(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength));
  };
  return { positions: P, normals: N, uvs: UV, indices: I, baseColor: imageOf(tex), normalMap: imageOf(mat?.normalTexture), scale: k, generator: g.asset?.generator };
}

/** 同位置的頂點併成一個（UV 接縫把頂點拆開了；不併的話減面時接縫被當成邊界鎖住，減不下去）。 */
export function weld(positions, normals, indices, eps = 1e-6) {
  const map = new Map(), remap = new Int32Array(positions.length / 3), P = [], N = [];
  for (let v = 0; v < positions.length / 3; v++) {
    const key = `${Math.round(positions[v * 3] / eps)},${Math.round(positions[v * 3 + 1] / eps)},${Math.round(positions[v * 3 + 2] / eps)}`;
    let w = map.get(key);
    if (w === undefined) {
      w = P.length / 3;
      map.set(key, w);
      P.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      N.push(0, 0, 0);
    }
    remap[v] = w;
    for (let a = 0; a < 3; a++) N[w * 3 + a] += normals[v * 3 + a];
  }
  for (let w = 0; w < N.length; w += 3) {
    const l = Math.hypot(N[w], N[w + 1], N[w + 2]) || 1;
    (N[w] /= l), (N[w + 1] /= l), (N[w + 2] /= l);
  }
  return { positions: Float32Array.from(P), normals: Float32Array.from(N), indices: Uint32Array.from(indices, (v) => remap[v]) };
}

/**
 * 三角形的 BVH（每個葉子最多 4 個）。`nearestOnLine(o, d, reach)`：沿直線 o + t·d（t 在 ±reach 之間）找和三角形的交點，
 * 回傳離 o 最近的那一個 { t, tri, b1, b2 }（b1、b2 是重心座標）；沒有就 null。
 */
export function buildBvh(positions, indices) {
  const T = indices.length / 3;
  const cen = new Float32Array(T * 3), bmin = new Float32Array(T * 3), bmax = new Float32Array(T * 3);
  for (let t = 0; t < T; t++)
    for (let a = 0; a < 3; a++) {
      const v0 = positions[indices[t * 3] * 3 + a], v1 = positions[indices[t * 3 + 1] * 3 + a], v2 = positions[indices[t * 3 + 2] * 3 + a];
      bmin[t * 3 + a] = Math.min(v0, v1, v2);
      bmax[t * 3 + a] = Math.max(v0, v1, v2);
      cen[t * 3 + a] = (v0 + v1 + v2) / 3;
    }
  const order = new Int32Array(T);
  for (let t = 0; t < T; t++) order[t] = t;
  // 節點：盒子 lo(3) hi(3)；meta：left right start count（葉子 left = -1）。
  const box = new Float32Array(T * 2 * 6);
  const meta = new Int32Array(T * 2 * 4);
  let count = 0;
  // 只把第 k 小的放到位置 k（左邊都比它小、右邊都比它大），不用整段排序。
  const select = (start, end, k, axis) => {
    let lo = start, hi = end - 1;
    while (lo < hi) {
      const pivot = cen[order[(lo + hi) >> 1] * 3 + axis];
      let i = lo, j = hi;
      while (i <= j) {
        while (cen[order[i] * 3 + axis] < pivot) i++;
        while (cen[order[j] * 3 + axis] > pivot) j--;
        if (i <= j) {
          const tmp = order[i];
          order[i] = order[j];
          order[j] = tmp;
          i++;
          j--;
        }
      }
      if (k <= j) hi = j;
      else if (k >= i) lo = i;
      else break;
    }
  };
  const build = (start, end) => {
    const id = count++;
    let lx = Infinity, ly = Infinity, lz = Infinity, hx = -Infinity, hy = -Infinity, hz = -Infinity;
    let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
    for (let i = start; i < end; i++) {
      const t = order[i];
      lx = Math.min(lx, bmin[t * 3]), ly = Math.min(ly, bmin[t * 3 + 1]), lz = Math.min(lz, bmin[t * 3 + 2]);
      hx = Math.max(hx, bmax[t * 3]), hy = Math.max(hy, bmax[t * 3 + 1]), hz = Math.max(hz, bmax[t * 3 + 2]);
      cx0 = Math.min(cx0, cen[t * 3]), cy0 = Math.min(cy0, cen[t * 3 + 1]), cz0 = Math.min(cz0, cen[t * 3 + 2]);
      cx1 = Math.max(cx1, cen[t * 3]), cy1 = Math.max(cy1, cen[t * 3 + 1]), cz1 = Math.max(cz1, cen[t * 3 + 2]);
    }
    box.set([lx, ly, lz, hx, hy, hz], id * 6);
    if (end - start <= 4) {
      meta.set([-1, -1, start, end - start], id * 4);
      return id;
    }
    const ext = [cx1 - cx0, cy1 - cy0, cz1 - cz0];
    const axis = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2;
    const mid = (start + end) >> 1;
    // 依重心在最長那一軸上的中位數一分為二。
    select(start, end, mid, axis);
    const left = build(start, mid), right = build(mid, end);
    meta.set([left, right, 0, 0], id * 4);
    return id;
  };
  build(0, T);
  const P = positions, I = indices;
  function nearestOnLine(o, d, reach) {
    let best = null;
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    const st = [0];
    while (st.length) {
      const n = st.pop();
      // 射線和盒子：t 的範圍和 [-reach, reach] 有交集才往下走。
      let t0 = -reach, t1 = reach;
      for (let a = 0; a < 3; a++) {
        let ta = (box[n * 6 + a] - o[a]) * inv[a], tb = (box[n * 6 + 3 + a] - o[a]) * inv[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
      if (t0 > t1) continue;
      if (best && Math.min(Math.abs(t0), Math.abs(t1), t0 <= 0 && t1 >= 0 ? 0 : Infinity) > Math.abs(best.t)) continue;
      const left = meta[n * 4];
      if (left >= 0) {
        st.push(left, meta[n * 4 + 1]);
        continue;
      }
      for (let i = meta[n * 4 + 2], e = i + meta[n * 4 + 3]; i < e; i++) {
        const t = order[i];
        const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
        const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
        const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
        if (Math.abs(det) < 1e-14) continue;
        const id = 1 / det;
        const tv = [o[0] - P[a], o[1] - P[a + 1], o[2] - P[a + 2]];
        const b1 = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * id;
        if (b1 < 0 || b1 > 1) continue;
        const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
        const b2 = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * id;
        if (b2 < 0 || b1 + b2 > 1) continue;
        const tt = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * id;
        if (Math.abs(tt) > reach) continue;
        if (!best || Math.abs(tt) < Math.abs(best.t)) best = { t: tt, tri: t, b1, b2 };
      }
    }
    return best;
  }
  return { nearestOnLine, nodes: count };
}

/** 貼圖雙線性取樣（UV 0..1，v 從上往下），回傳 0..1 的 RGB（sRGB）。 */
export function sampleTexture(png, u, v) {
  const W = png.width, H = png.height;
  const x = (u - Math.floor(u)) * W - 0.5, y = (v - Math.floor(v)) * H - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const px = (xx, yy, c) => png.data[((Math.max(0, Math.min(H - 1, yy)) * W + Math.max(0, Math.min(W - 1, xx))) * 4) + c];
  return [0, 1, 2].map((c) => ((px(x0, y0, c) * (1 - fx) + px(x0 + 1, y0, c) * fx) * (1 - fy) + (px(x0, y0 + 1, c) * (1 - fx) + px(x0 + 1, y0 + 1, c) * fx) * fy) / 255);
}
