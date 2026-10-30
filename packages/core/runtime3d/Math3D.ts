export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}
export type Matrix4 = ArrayLike<number>;
export const identity4 = () =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function multiply4(a: Matrix4, b: Matrix4) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export function compose4(
  p: Vec3 = { x: 0, y: 0, z: 0 },
  q: Quat = { x: 0, y: 0, z: 0, w: 1 },
  s: Vec3 = { x: 1, y: 1, z: 1 },
) {
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  if (!n || ![p.x, p.y, p.z, s.x, s.y, s.z, n].every(Number.isFinite))
    throw Error("Invalid transform");
  const x = q.x / n,
    y = q.y / n,
    z = q.z / n,
    w = q.w / n;
  return new Float32Array([
    (1 - 2 * (y * y + z * z)) * s.x,
    2 * (x * y + z * w) * s.x,
    2 * (x * z - y * w) * s.x,
    0,
    2 * (x * y - z * w) * s.y,
    (1 - 2 * (x * x + z * z)) * s.y,
    2 * (y * z + x * w) * s.y,
    0,
    2 * (x * z + y * w) * s.z,
    2 * (y * z - x * w) * s.z,
    (1 - 2 * (x * x + y * y)) * s.z,
    0,
    p.x,
    p.y,
    p.z,
    1,
  ]);
}
export function transformPoint(m: Matrix4, p: Vec3): Vec3 {
  const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  if (Math.abs(w) < 1e-12) throw Error("Point projects to infinity");
  return {
    x: (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) / w,
    y: (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) / w,
    z: (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]) / w,
  };
}
export function inverse4(a: Matrix4) {
  const rows = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) =>
      c < 4 ? a[c * 4 + r] : Number(c - 4 === r),
    ),
  );
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++)
      if (Math.abs(rows[r][i]) > Math.abs(rows[p][i])) p = r;
    if (Math.abs(rows[p][i]) < 1e-12) throw Error("Singular transform");
    [rows[i], rows[p]] = [rows[p], rows[i]];
    const d = rows[i][i];
    for (let c = 0; c < 8; c++) rows[i][c] /= d;
    for (let r = 0; r < 4; r++)
      if (r !== i) {
        const k = rows[r][i];
        for (let c = 0; c < 8; c++) rows[r][c] -= k * rows[i][c];
      }
  }
  return Float32Array.from(
    { length: 16 },
    (_, i) => rows[i % 4][4 + Math.floor(i / 4)],
  );
}
export function normalized(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(n) || n < 1e-12)
    throw Error("Zero/non-finite direction");
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}
