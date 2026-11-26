// 一整張連續表面的整理工具：距離場的法線、表面鬆弛、網格離表面多遠。
import { add, dot, mul, norm, sub } from '../../../../games/tools/characters/kit.mjs';

/** 距離場在 p 的法線（中央差分）。 */
export function normalAt(field, p, e = 0.0008) {
  const f = (x, y, z) => field.distance(x, y, z);
  return norm([f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)]);
}

/**
 * 表面鬆弛：拓撲不變，每個頂點沿著表面（去掉法線方向）往鄰居的平均位置移一點，再貼回距離場的表面；重複幾輪。
 * 自動減面後三角形大小不一（細手腳一圈有時 5 邊、有時 7 邊），鬆弛後頂點分布均勻、輪廓比較圓。回傳新的 positions、normals。
 * `fixed(p)`（可省）：這些頂點不動（手指：面數少的細管一鬆弛，指縫的頂點會滑過去，四根指頭黏成一團）。
 */
export function relaxOnSurface(field, positions, indices, { iterations = 15, step = 0.5, fixed } = {}) {
  const n = positions.length / 3;
  const stay = new Uint8Array(n);
  if (fixed) for (let v = 0; v < n; v++) stay[v] = fixed([positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]]) ? 1 : 0;
  const nbr = Array.from({ length: n }, () => new Set());
  for (let k = 0; k < indices.length; k += 3)
    for (const [a, b] of [[indices[k], indices[k + 1]], [indices[k + 1], indices[k + 2]], [indices[k + 2], indices[k]]]) (nbr[a].add(b), nbr[b].add(a));
  let P = Float32Array.from(positions);
  const snap = (p) => {
    let q = p;
    for (let i = 0; i < 4; i++) {
      const d = field.distance(...q);
      if (Math.abs(d) < 1e-6) break;
      q = sub(q, mul(normalAt(field, q), d));
    }
    return q;
  };
  for (let it = 0; it < iterations; it++) {
    const Q = new Float32Array(P.length);
    for (let v = 0; v < n; v++) {
      const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
      if (!nbr[v].size || stay[v]) {
        Q.set(p, v * 3);
        continue;
      }
      let c = [0, 0, 0];
      for (const u of nbr[v]) c = add(c, [P[u * 3], P[u * 3 + 1], P[u * 3 + 2]]);
      c = mul(c, 1 / nbr[v].size);
      const nn = normalAt(field, p);
      let d = sub(c, p);
      d = sub(d, mul(nn, dot(d, nn)));
      Q.set(snap(add(p, mul(d, step))), v * 3);
    }
    P = Q;
  }
  const N = new Float32Array(P.length);
  for (let v = 0; v < n; v++) N.set(normalAt(field, [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]), v * 3);
  return { positions: P, normals: N };
}

/** 網格離距離場表面多遠：每個三角形的中心與三邊中點，回傳最深（在表面內）與最遠（在表面外）的公釐數。 */
export function surfaceError(field, positions, indices) {
  let inside = 0,
    outside = 0;
  const P = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [P(indices[k]), P(indices[k + 1]), P(indices[k + 2])];
    for (const q of [mul(add(add(a, b), c), 1 / 3), mul(add(a, b), 0.5), mul(add(b, c), 0.5), mul(add(a, c), 0.5)]) {
      const d = field.distance(...q);
      inside = Math.max(inside, -d);
      outside = Math.max(outside, d);
    }
  }
  return { insideMm: +(inside * 1000).toFixed(2), outsideMm: +(outside * 1000).toFixed(2) };
}
