import type { MeshData } from "../runtime3d/Surfaces.ts";
import type { QueryRay } from "../runtime3d/SceneQueries.ts";

/** Two-sided ray intersection; distance follows the supplied ray parameter. */
export function shellTriangleDistance(
  ray: QueryRay,
  p: Float32Array,
  a: number,
  b: number,
  c: number,
) {
  a *= 3;
  b *= 3;
  c *= 3;
  const ax = p[b] - p[a],
    ay = p[b + 1] - p[a + 1],
    az = p[b + 2] - p[a + 2],
    bx = p[c] - p[a],
    by = p[c + 1] - p[a + 1],
    bz = p[c + 2] - p[a + 2],
    d = ray.direction,
    px = d.y * bz - d.z * by,
    py = d.z * bx - d.x * bz,
    pz = d.x * by - d.y * bx,
    det = ax * px + ay * py + az * pz;
  if (Math.abs(det) < 1e-10) return null;
  const tx = ray.origin.x - p[a],
    ty = ray.origin.y - p[a + 1],
    tz = ray.origin.z - p[a + 2],
    u = (tx * px + ty * py + tz * pz) / det;
  if (u < -1e-7 || u > 1 + 1e-7) return null;
  const qx = ty * az - tz * ay,
    qy = tz * ax - tx * az,
    qz = tx * ay - ty * ax,
    v = (d.x * qx + d.y * qy + d.z * qz) / det;
  if (v < -1e-7 || u + v > 1 + 1e-7) return null;
  const t = (bx * qx + by * qy + bz * qz) / det;
  return t >= 0 ? t : null;
}

/** Clockwise Laya faces. Extrudes along local -Y; the underside follows the top. */
export function buildTerrainShell(
  top: Float32Array,
  xs: number[],
  zs: number[],
  depth: number,
): MeshData {
  if (!Number.isFinite(depth) || depth <= 0)
    throw Error("Terrain solid depth must be positive");
  const nx = xs.length,
    nz = zs.length,
    n = nx * nz;
  const edges: [number, number][] = [];
  for (let x = 0; x < nx - 1; x++) edges.push([x, x + 1]);
  for (let z = 0; z < nz - 1; z++)
    edges.push([z * nx + nx - 1, (z + 1) * nx + nx - 1]);
  for (let x = nx - 1; x > 0; x--)
    edges.push([(nz - 1) * nx + x, (nz - 1) * nx + x - 1]);
  for (let z = nz - 1; z > 0; z--) edges.push([z * nx, (z - 1) * nx]);
  const count = n + edges.length * 4,
    positions = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2),
    indices = new Uint16Array((nx - 1) * (nz - 1) * 6 + edges.length * 6);
  for (let i = 0; i < n; i++) {
    positions.set([top[i * 8], top[i * 8 + 1] - depth, top[i * 8 + 2]], i * 3);
    normals.set([-top[i * 8 + 3], -top[i * 8 + 4], -top[i * 8 + 5]], i * 3);
    uvs.set([top[i * 8 + 6], top[i * 8 + 7]], i * 2);
  }
  let k = 0;
  for (let z = 0; z < nz - 1; z++)
    for (let x = 0; x < nx - 1; x++) {
      const a = z * nx + x,
        b = a + 1,
        c = a + nx,
        d = c + 1;
      indices.set([c, d, a, a, d, b], k);
      k += 6;
    }
  edges.forEach(([a, b], j) => {
    const i = n + j * 4,
      dx = top[b * 8] - top[a * 8],
      dz = top[b * 8 + 2] - top[a * 8 + 2],
      len = Math.hypot(dx, dz);
    for (let v = 0; v < 4; v++) {
      const src = (v % 2 ? b : a) * 8;
      positions.set(
        [top[src], top[src + 1] - (v >= 2 ? depth : 0), top[src + 2]],
        (i + v) * 3,
      );
      normals.set([dz / len, 0, -dx / len], (i + v) * 3);
      uvs.set([v % 2 ? len : 0, v >= 2 ? depth : 0], (i + v) * 2);
    }
    indices.set([i, i + 2, i + 1, i + 1, i + 2, i + 3], k);
    k += 6;
  });
  return { positions, normals, uvs, indices };
}
