// 法線貼圖：展 UV → 切線 → 從距離場烘焙（法線、環境遮蔽、顏色）→ PNG。
//
// 烘焙照 VerifyZhuda `claude/xianxia-select-stage` 分支 epic-scenes/tools/beasts/hd 的做法（textured.mjs、bake-core.mjs，
// 那邊在 LayaAir 3.4.2 驗證過）：每個貼圖像素找到它在低模上的點，沿著低模的法線走到距離場的表面，
// 取那裡的法線（距離場的斜率），換到低模的切線空間（引擎著色器用法線和切線組出來的那一組）存起來。
// 那邊用 xatlas（Python）展 UV；這裡改成自己做（分塊平面投影＋排版），建置只要 Node。
import { PNG } from 'pngjs';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const at3 = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * 展 UV：相鄰、法線和起點差不到 `maxAngle` 度的三角形併成一塊，整塊投影到垂直於起點法線的平面上
 * （不會翻面：每個三角形的法線和投影方向夾角都小於 90°）；每塊轉到外框最小的角度，再一排一排排進正方形貼圖。
 * `group[t]`：三角形屬於哪一組（不同顏色的部位），一塊不會跨兩組。`density(t)`：這個三角形要多細（1 是一般）。
 * 回傳新的頂點對應（`vmapping[新頂點] = 舊頂點`，塊與塊交界的頂點會複製）、新的索引、UV（0..1，v 從上往下）。
 */
export function unwrap({ positions, indices, group, density = () => 1, prefer = () => 0, size = 1024, padding = 8, maxAngle = 55 }) {
  const T = indices.length / 3;
  const fn = [], area = [];
  for (let t = 0; t < T; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => at3(positions, indices[t * 3 + k]));
    const n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
    area.push(Math.hypot(...n) / 2);
    fn.push(norm(n));
  }
  // 相鄰：共用一條邊、同一組。
  const edges = new Map();
  for (let t = 0; t < T; t++)
    for (let k = 0; k < 3; k++) {
      const u = indices[t * 3 + k], v = indices[t * 3 + ((k + 1) % 3)];
      const key = u < v ? `${u},${v}` : `${v},${u}`;
      (edges.get(key) ?? edges.set(key, []).get(key)).push(t);
    }
  const nbr = Array.from({ length: T }, () => []);
  for (const list of edges.values())
    for (const a of list) for (const b of list) if (a !== b && group[a] === group[b]) nbr[a].push(b);
  // 分塊：從面積最大、還沒分到的三角形開始往外長。
  const cosMax = Math.cos((maxAngle * Math.PI) / 180);
  const chartOf = new Int32Array(T).fill(-1);
  // 先從 `prefer` 大的三角形開始長（例如正臉），一樣的再照面積大小。
  const byArea = (list) => list.sort((a, b) => prefer(b) - prefer(a) || area[b] - area[a]);
  const charts = [];
  // 每塊投影成平面座標（公尺），轉到外框面積最小的角度。
  const project = (ch) => {
    const a = ch.axis;
    const e1 = norm(cross(Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], a));
    const e2 = cross(a, e1);
    ch.verts = new Map();
    for (const t of ch.tris) for (let k = 0; k < 3; k++) ch.verts.set(indices[t * 3 + k], null);
    const pts = [...ch.verts.keys()].map((v) => {
      const p = at3(positions, v);
      return [dot(p, e1), dot(p, e2)];
    });
    let best = null;
    for (let deg = 0; deg < 90; deg += 3) {
      const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of pts) {
        const u = x * c - y * s, v = x * s + y * c;
        (x0 = Math.min(x0, u)), (x1 = Math.max(x1, u)), (y0 = Math.min(y0, v)), (y1 = Math.max(y1, v));
      }
      if (!best || (x1 - x0) * (y1 - y0) < best.area) best = { area: (x1 - x0) * (y1 - y0), c, s, x0, y0, w: x1 - x0, h: y1 - y0 };
    }
    [...ch.verts.keys()].forEach((v, i) => {
      const [x, y] = pts[i];
      ch.verts.set(v, [x * best.c - y * best.s - best.x0, x * best.s + y * best.c - best.y0]);
    });
    (ch.bw = best.w), (ch.bh = best.h);
  };
  // 一塊裡投影後疊在一起的三角形（例如腋下：身體側面和手臂下緣朝向差不多、又連在一起）：
  // 在 0.75 mm 的格子上畫，一格已經有別的三角形完全蓋住，後長進來的那個拿出來。
  // 也拿出來：投影後在平面上貼得很近（不到約兩格貼圖）、在 3D 裡卻離很遠的兩個三角形（腋下：身體側面和上臂前面，
  // 朝向差不多、投影後挨在一起，實際隔 9 cm）。留著的話取樣和補邊會把一邊的顏色（腋下的暗）混到另一邊，烘出一道暗痕。
  const segDist2 = (p, a, b) => {
    const d = [b[0] - a[0], b[1] - a[1]], L = d[0] * d[0] + d[1] * d[1];
    const t = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / L)) : 0;
    return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t);
  };
  const segDist3 = (p, a, b) => {
    const d = sub3(b, a), L = dot(d, d);
    const t = L > 0 ? Math.max(0, Math.min(1, dot(sub3(p, a), d) / L)) : 0;
    return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t);
  };
  const triDist = (A, B, dist) => {
    let m = Infinity;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m = Math.min(m, dist(A[i], B[j], B[(j + 1) % 3]), dist(B[i], A[j], A[(j + 1) % 3]));
    return m;
  };
  const overlapping = (ch) => {
    const cell = 0.00075, grid = new Map(), drop = new Set();
    const coarse = 0.004, near = new Map();
    for (const t of ch.tris) {
      const [a, b, c] = [0, 1, 2].map((k) => ch.verts.get(indices[t * 3 + k]));
      const A = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(A) < 1e-12) continue;
      const cells = [];
      let hit = false;
      // 平面上 margin 以內、3D 裡遠（比平面距離的 3 倍再多 1 cm）的已留三角形。
      const margin = 0.011 / density(t);
      const P3 = [0, 1, 2].map((k) => at3(positions, indices[t * 3 + k]));
      const cx0 = Math.floor((Math.min(a[0], b[0], c[0]) - margin) / coarse), cx1 = Math.floor((Math.max(a[0], b[0], c[0]) + margin) / coarse);
      const cy0 = Math.floor((Math.min(a[1], b[1], c[1]) - margin) / coarse), cy1 = Math.floor((Math.max(a[1], b[1], c[1]) + margin) / coarse);
      const seen = new Set();
      for (let gx = cx0; gx <= cx1 && !hit; gx++)
        for (let gy = cy0; gy <= cy1 && !hit; gy++)
          for (const u of near.get(gx * 100003 + gy) ?? []) {
            if (seen.has(u)) continue;
            seen.add(u);
            const B2 = [0, 1, 2].map((k) => ch.verts.get(indices[u * 3 + k]));
            const d2 = triDist([a, b, c], B2, segDist2);
            if (d2 >= margin) continue;
            const d3 = triDist(P3, [0, 1, 2].map((k) => at3(positions, indices[u * 3 + k])), segDist3);
            if (d3 > d2 * 3 + 0.01) {
              hit = true;
              break;
            }
          }
      for (let gx = Math.floor(Math.min(a[0], b[0], c[0]) / cell); gx <= Math.floor(Math.max(a[0], b[0], c[0]) / cell) && !hit; gx++)
        for (let gy = Math.floor(Math.min(a[1], b[1], c[1]) / cell); gy <= Math.floor(Math.max(a[1], b[1], c[1]) / cell); gy++) {
          const px = (gx + 0.5) * cell, py = (gy + 0.5) * cell;
          const w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / A;
          const w2 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / A;
          if (Math.min(w1, w2, 1 - w1 - w2) < 0.01) continue;
          const key = gx * 100003 + gy;
          if (grid.has(key)) {
            hit = true;
            break;
          }
          cells.push(key);
        }
      if (hit) drop.add(t);
      else {
        for (const key of cells) grid.set(key, t);
        for (let gx = Math.floor(Math.min(a[0], b[0], c[0]) / coarse); gx <= Math.floor(Math.max(a[0], b[0], c[0]) / coarse); gx++)
          for (let gy = Math.floor(Math.min(a[1], b[1], c[1]) / coarse); gy <= Math.floor(Math.max(a[1], b[1], c[1]) / coarse); gy++) {
            const key = gx * 100003 + gy;
            (near.get(key) ?? near.set(key, []).get(key)).push(t);
          }
      }
    }
    return drop;
  };
  let pending = byArea(Array.from({ length: T }, (_, t) => t));
  let dropped = 0;
  for (let round = 0; round < 12 && pending.length; round++) {
    const start = charts.length;
    for (const seed of pending) {
      if (chartOf[seed] >= 0) continue;
      const axis = fn[seed], id = charts.length, tris = [seed];
      chartOf[seed] = id;
      for (let q = 0; q < tris.length; q++)
        for (const n of nbr[tris[q]])
          if (chartOf[n] < 0 && dot(fn[n], axis) > cosMax) {
            chartOf[n] = id;
            tris.push(n);
          }
      charts.push({ tris, axis });
    }
    const again = [];
    for (const ch of charts.slice(start)) {
      project(ch);
      const drop = overlapping(ch);
      if (!drop.size) continue;
      ch.tris = ch.tris.filter((t) => !drop.has(t));
      for (const t of drop) (chartOf[t] = -1), again.push(t);
      project(ch);
    }
    dropped += again.length;
    pending = byArea(again);
  }
  if (pending.length) throw Error(`unwrap: ${pending.length} triangles still overlap after 12 rounds`);
  for (const ch of charts) {
    let A = 0, D = 0;
    for (const t of ch.tris) (A += area[t]), (D += area[t] * density(t));
    ch.density = D / A;
    (ch.w = ch.bw * ch.density), (ch.h = ch.bh * ch.density);
  }
  // 排版：高的先排，一排一排放；找最大的「每公尺幾個像素」放得下。
  const sorted = [...charts].sort((a, b) => b.h - a.h);
  const pack = (s) => {
    let x = 0, y = 0, row = 0;
    const place = [];
    for (const ch of sorted) {
      const w = Math.ceil(ch.w * s) + padding, h = Math.ceil(ch.h * s) + padding;
      if (w > size) return null;
      if (x + w > size) (y += row), (x = 0), (row = 0);
      place.push([ch, x, y]);
      x += w;
      row = Math.max(row, h);
    }
    return y + row <= size ? place : null;
  };
  let lo = 1, hi = 1e5;
  for (let i = 0; i < 40; i++) {
    const mid = Math.sqrt(lo * hi);
    if (pack(mid)) lo = mid;
    else hi = mid;
  }
  const scale = lo, placed = pack(scale);
  const vmapping = [], uvs = [], newIndex = new Uint32Array(indices.length);
  const chartOfTri = new Int32Array(T);
  for (const [ch, x, y] of placed) {
    const local = new Map();
    for (const [v, [px, py]] of ch.verts) {
      local.set(v, vmapping.length);
      vmapping.push(v);
      uvs.push((x + padding / 2 + px * ch.density * scale) / size, (y + padding / 2 + py * ch.density * scale) / size);
    }
    const id = charts.indexOf(ch);
    for (const t of ch.tris) {
      chartOfTri[t] = id;
      for (let k = 0; k < 3; k++) newIndex[t * 3 + k] = local.get(indices[t * 3 + k]);
    }
  }
  let used = 0;
  for (const ch of charts) used += ch.w * ch.h * scale * scale;
  return { vmapping: Int32Array.from(vmapping), indices: newIndex, uvs: Float32Array.from(uvs), charts: charts.length, movedForOverlap: dropped, chartOfTri, texelsPerMetre: +scale.toFixed(1), fill: +(used / (size * size)).toFixed(3) };
}

/** 每個頂點的切線（xyz）和方向（w）：bitangent = cross(normal, tangent) × w 沿著 +v（同 textured.mjs 的 tangentsOf）。 */
export function tangentsOf(positions, normals, uvs, indices) {
  const nv = positions.length / 3;
  const t1 = new Float64Array(nv * 3), t2 = new Float64Array(nv * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const e1 = [0, 1, 2].map((k) => positions[b * 3 + k] - positions[a * 3 + k]);
    const e2 = [0, 1, 2].map((k) => positions[c * 3 + k] - positions[a * 3 + k]);
    const du1 = uvs[b * 2] - uvs[a * 2], dv1 = uvs[b * 2 + 1] - uvs[a * 2 + 1];
    const du2 = uvs[c * 2] - uvs[a * 2], dv2 = uvs[c * 2 + 1] - uvs[a * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-14) continue;
    const r = 1 / det;
    const sd = [0, 1, 2].map((k) => (e1[k] * dv2 - e2[k] * dv1) * r);
    const td = [0, 1, 2].map((k) => (e2[k] * du1 - e1[k] * du2) * r);
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) (t1[v * 3 + k] += sd[k]), (t2[v * 3 + k] += td[k]);
  }
  const out = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    const n = at3(normals, v);
    let s = [t1[v * 3], t1[v * 3 + 1], t1[v * 3 + 2]];
    s = [s[0] - n[0] * dot(n, s), s[1] - n[1] * dot(n, s), s[2] - n[2] * dot(n, s)];
    if (Math.hypot(...s) < 1e-9) s = cross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n);
    s = norm(s);
    const w = dot(cross(n, s), [t2[v * 3], t2[v * 3 + 1], t2[v * 3 + 2]]) < 0 ? -1 : 1;
    out.set([s[0], s[1], s[2], w], v * 4);
  }
  return out;
}

const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];

/**
 * 烘焙。`surfaceOf(group)`：那一組的距離場（法線從它來）；`aoField`：所有東西的距離場（環境遮蔽用）；
 * `colourOf(group)`：那一組的底色（0..255，sRGB）。`ao`：兩種尺度（`small` 給指縫，`large` 給腋下胯下）的取樣間距與強度。
 * 回傳三張 PNG（底色、法線、環境遮蔽）和統計。
 */
export function bakeMaps({ positions, normals, uvs, tangents, indices, group, chartOfTri, size = 1024, surfaceOf, aoField, colourOf, colourAt = null, extraAt = null, normalWeight = () => 1, highSample = null, ao = { small: 0.006, large: 0.025, strength: 0.75 } }) {
  const W = size, H = size;
  const owner = new Int32Array(W * H).fill(-1);
  const strict = new Int32Array(W * H).fill(-1);
  const colour = new Float32Array(W * H * 3), normal = new Float32Array(W * H * 3), occl = new Float32Array(W * H);
  // `extraAt(p, 組, 遮蔽)`：另外一張灰階貼圖（例如絨毛版的柔光強度），沒給就不做。
  const extra = extraAt ? new Float32Array(W * H) : null;
  let texels = 0, overlap = 0, worstTilt = 0, steep = 0;
  const overlapAt = new Map();
  const filled = new Uint8Array(W * H);
  // 兩輪：第一輪每個三角形只填中心落在自己裡面的像素，第二輪才補邊外 1.5 格的容許帶（還沒有主人的）。
  // 只跑一輪的話，先處理到的細長三角形會用容許帶搶走隔壁三角形裡面的像素，烘出一道楔形的暗痕（上臂前面，2026-11-26）。
  for (const pass of [0, 1]) for (let t = 0; t < indices.length; t += 3) {
    const tri = t / 3;
    const [i0, i1, i2] = [indices[t], indices[t + 1], indices[t + 2]];
    const uv = [i0, i1, i2].map((i) => [uvs[i * 2] * W, uvs[i * 2 + 1] * H]);
    const areaUv = (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]);
    if (Math.abs(areaUv) < 1e-9) continue;
    const P = [i0, i1, i2].map((i) => at3(positions, i));
    const area3 = Math.hypot(...cross([P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]]));
    const texel = Math.sqrt(area3 / Math.abs(areaUv));
    const field = surfaceOf(group[tri]);
    const f = (p) => field.distance(p[0], p[1], p[2]);
    const fa = (p) => aoField.distance(p[0], p[1], p[2]);
    const base = colourOf(group[tri]).map((v) => v / 255);
    const x0 = Math.max(0, Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0]) - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(uv[0][0], uv[1][0], uv[2][0]) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1]) - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(uv[0][1], uv[1][1], uv[2][1]) + 1));
    const edgeLen = [0, 1, 2].map((k) => Math.hypot(uv[(k + 2) % 3][0] - uv[(k + 1) % 3][0], uv[(k + 2) % 3][1] - uv[(k + 1) % 3][1]));
    const slack = edgeLen.map((l) => (0.75 * l) / Math.abs(areaUv));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const b1 = ((px - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[2][0] - uv[0][0]) * (py - uv[0][1])) / areaUv;
        const b2 = ((uv[1][0] - uv[0][0]) * (py - uv[0][1]) - (px - uv[0][0]) * (uv[1][1] - uv[0][1])) / areaUv;
        const b0 = 1 - b1 - b2;
        const inside = b0 >= 0 && b1 >= 0 && b2 >= 0;
        if (!inside && (b0 < -slack[0] || b1 < -slack[1] || b2 < -slack[2])) continue;
        if (pass === 0 ? !inside : inside) continue;
        const o = y * W + x;
        // 兩個不相鄰的三角形都把這個像素包在正中間：展 UV 重疊了（應該是 0）。
        if (Math.min(b0, b1, b2) > 0.02) {
          if (strict[o] >= 0 && strict[o] !== tri) {
            overlap++;
            const key = `${chartOfTri?.[strict[o]]}/${chartOfTri?.[tri]}`;
            if (!overlapAt.has(key)) overlapAt.set(key, { charts: key, tris: [strict[o], tri], y: +((P[0][1] + P[1][1] + P[2][1]) / 3).toFixed(3), x: +((P[0][0] + P[1][0] + P[2][0]) / 3).toFixed(3), texels: 0 });
            overlapAt.get(key).texels++;
          }
          strict[o] = tri;
        }
        if (owner[o] >= 0) continue;
        owner[o] = tri;
        const c = [Math.max(0, b0), Math.max(0, b1), Math.max(0, b2)];
        const cs = c[0] + c[1] + c[2];
        const B = c.map((v) => v / cs);
        let p = [0, 1, 2].map((a) => B[0] * P[0][a] + B[1] * P[1][a] + B[2] * P[2][a]);
        const p0 = p;
        const N = norm([0, 1, 2].map((a) => B[0] * normals[i0 * 3 + a] + B[1] * normals[i1 * 3 + a] + B[2] * normals[i2 * 3 + a]));
        const tl = [0, 1, 2].map((a) => B[0] * tangents[i0 * 4 + a] + B[1] * tangents[i1 * 4 + a] + B[2] * tangents[i2 * 4 + a]);
        const w = tangents[i0 * 4 + 3];
        // `highSample`（別人的高模）：沿低模法線找高模的表面，法線、底色都從那裡拿；沒找到才走距離場。
        const hs = highSample ? highSample(p0, N) : null;
        // 1. 沿著低模的法線走到真正的表面。
        for (let i = 0; i < 10 && !hs; i++) {
          const d = f(p);
          if (Math.abs(d) < 1e-5) break;
          const step = Math.max(-0.02, Math.min(0.02, d));
          p = [p[0] - N[0] * step, p[1] - N[1] * step, p[2] - N[2] * step];
        }
        // 2. 那裡的法線（四面體差分），換到低模的切線空間。
        const e = Math.max(0.0006, texel * 0.75);
        let g = [0, 0, 0];
        for (const k of TET) {
          const v = f([p[0] + k[0] * e, p[1] + k[1] * e, p[2] + k[2] * e]);
          g = [g[0] + k[0] * v, g[1] + k[1] * v, g[2] + k[2] * v];
        }
        const nb = hs ? hs.normal : norm(g);
        const Tt = norm([tl[0] - N[0] * dot(tl, N), tl[1] - N[1] * dot(tl, N), tl[2] - N[2] * dot(tl, N)]);
        const Bt = cross(N, Tt).map((v) => v * w);
        let ts = [dot(nb, Tt), dot(nb, Bt), dot(nb, N)];
        if (ts[2] < 0.5) steep++;
        // `normalWeight(p)` 小於 1 的地方往低模本來的法線靠（0＝完全不改）：低模的法線本來就取自真正的形狀，
        // 只有細的地方（手）需要；身體也用的話，塊與塊交界的切線方向不同，深色表面上會看到一條淡淡的接縫。
        const nw = normalWeight(p);
        if (nw < 1) ts = norm([ts[0] * nw, ts[1] * nw, ts[2] * nw + (1 - nw)]);
        // 指縫裡：低模的三角形橫跨兩根指頭之間的縫，沿著它的法線會走到指頭的側面，法線幾乎和它垂直。
        // 保留方向、最多斜 80°（再斜就背對鏡頭，光會怪）。
        const minZ = Math.cos((80 * Math.PI) / 180);
        if (ts[2] < minZ) {
          const side = Math.hypot(ts[0], ts[1]) || 1, k = Math.sqrt(1 - minZ * minZ) / side;
          ts = [ts[0] * k, ts[1] * k, minZ];
        }
        worstTilt = Math.max(worstTilt, Math.acos(Math.max(-1, Math.min(1, ts[2]))));
        normal.set([ts[0] * 0.5 + 0.5, ts[1] * 0.5 + 0.5, ts[2] * 0.5 + 0.5], o * 3);
        // 3. 環境遮蔽：從低模上的點、沿低模的法線往外，兩種距離，看附近有多少東西擋著
        // （距離場在 p + h·n 的值比 h 小多少）。用低模的點和法線（不是走到真表面的那一點）：
        // 兩者在整個模型上連續、塊與塊交界兩邊一樣，算出來不會一格一格跳（窄縫裡沿法線走，有時會走到另一面，出現白點）。
        // 低模的點不一定剛好在表面上，差多少（e）就把每一步的「沒被擋時的距離」加多少。
        const e0 = fa(p0);
        const occAt = (step) => {
          let occ = 0, max = 0;
          for (let i = 1; i <= 5; i++) {
            const h = i * step;
            occ += Math.max(0, h + e0 - fa([p0[0] + N[0] * h, p0[1] + N[1] * h, p0[2] + N[2] * h])) * 0.6 ** i;
            max += h * 0.6 ** i;
          }
          return Math.min(1, occ / max);
        };
        occl[o] = 1 - ao.strength * Math.max(occAt(ao.small), occAt(ao.large));
        // `colourAt(p, 組)`：每個像素自己的底色（臉的眼睛、嘴）；沒給就是整組一個顏色。
        colour.set(hs?.colour ?? (colourAt && colourAt(p0, group[tri])) ?? base, o * 3);
        if (extra) extra[o] = extraAt(p0, group[tri], occl[o]);
        filled[o] = 1;
        texels++;
      }
  }
  dilate(colour, 3, filled, W, H, 16);
  dilate(normal, 3, filled, W, H, 16);
  dilate(occl, 1, filled, W, H, 16);
  if (extra) dilate(extra, 1, filled, W, H, 16);
  const png = (data, channels, colorType) => {
    const img = new PNG({ width: W, height: H, colorType, inputColorType: 6, bitDepth: 8 });
    for (let i = 0; i < W * H; i++) {
      const v = (c) => Math.max(0, Math.min(255, Math.round(data[i * channels + Math.min(c, channels - 1)] * 255)));
      img.data[i * 4] = v(0), (img.data[i * 4 + 1] = v(1)), (img.data[i * 4 + 2] = v(2)), (img.data[i * 4 + 3] = 255);
    }
    return PNG.sync.write(img, { colorType, inputColorType: 6, deflateLevel: 9 });
  };
  return {
    baseColor: png(colour, 3, 2),
    normal: png(normal, 3, 2),
    occlusion: png(occl, 1, 0),
    ...(extra ? { extra: png(extra, 1, 0) } : {}),
    stats: { size, texels, filled: +(texels / (W * H)).toFixed(3), overlapTexels: overlap, overlapAt: [...overlapAt.values()].slice(0, 12), steepestNormalDeg: +((worstTilt * 180) / Math.PI).toFixed(1), texelsOver60Deg: steep },
  };
}

/** 空的像素用旁邊有值的像素補，補 `passes` 圈，其餘補平均（同 textured.mjs 的 dilate）。 */
function dilate(data, ch, filled, W, H, passes) {
  let mask = filled.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = mask.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        if (mask[o]) continue;
        let n = 0;
        const acc = new Float64Array(ch);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const b = yy * W + xx;
          if (!mask[b]) continue;
          n++;
          for (let c = 0; c < ch; c++) acc[c] += data[b * ch + c];
        }
        if (n) {
          for (let c = 0; c < ch; c++) data[o * ch + c] = acc[c] / n;
          next[o] = 1;
        }
      }
    mask = next;
  }
  const mean = new Float64Array(ch);
  let n = 0;
  for (let o = 0; o < W * H; o++)
    if (filled[o]) {
      n++;
      for (let c = 0; c < ch; c++) mean[c] += data[o * ch + c];
    }
  for (let o = 0; o < W * H; o++) if (!mask[o]) for (let c = 0; c < ch; c++) data[o * ch + c] = mean[c] / Math.max(1, n);
}
