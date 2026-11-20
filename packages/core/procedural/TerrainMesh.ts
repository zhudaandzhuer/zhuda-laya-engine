/**
 * A piece of ground with heights, as plain mesh data: a grid over a
 * rectangle, each corner at its own height, from numbers given or from
 * fractal noise. Texture coordinates are in metres seen from above (lay a
 * recipe with `projection: 'triplanar'` where the ground is steep). Pure.
 *
 * It is one mesh of at most 255 by 255 corners; for streamed ground that
 * can be edited use `ZhudaTerrain3D`. No caves or overhangs: those are
 * meshes of their own.
 */
import type { MeshData } from '../runtime3d/Surfaces.ts';
import { zhudaFbm2D } from '../shaders/ZhudaCommon.ts';

export interface ZhudaTerrainMeshOptions {
  /** Width (X) and depth (Z) in metres; the piece is centred on its origin. */
  size: [number, number];
  /** Cells along X and Z, 1..254 each. */
  cells: [number, number];
  /**
   * Heights in metres, a corner each: `(cells[0] + 1) * (cells[1] + 1)`
   * numbers, row by row from -Z to +Z, each row from -X to +X.
   */
  heights?: ArrayLike<number>;
  /**
   * Or heights from fractal noise: up to `heightM` high, hills about
   * `scaleM` across, the same for the same `seed`. `ridged` folds the noise
   * into ridges; `flatten` are rectangles pressed level (a building plot, a
   * road), each `{minX, maxX, minZ, maxZ, y, marginM}` in the piece's own
   * metres, eased in over `marginM` (default 4).
   */
  noise?: {
    seed?: number;
    heightM: number;
    scaleM: number;
    ridged?: boolean;
    flatten?: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
      y: number;
      marginM?: number;
    }[];
  };
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** What is wrong with the options, each issue a line; empty when they are sound. */
export function validateZhudaTerrainMesh(options: ZhudaTerrainMeshOptions): string[] {
  const issues: string[] = [];
  const pair = (v: unknown, ok: (n: number) => boolean) =>
    Array.isArray(v) && v.length === 2 && v.every((n) => finite(n) && ok(n));
  if (!pair(options?.size, (n) => n > 0 && n <= 100000))
    issues.push('size: use [width, depth] in metres');
  const cellsOk = pair(options?.cells, (n) => Number.isInteger(n) && n >= 1 && n <= 254);
  if (!cellsOk) issues.push('cells: use [along X, along Z], whole numbers 1..254');
  const { heights, noise } = options ?? ({} as ZhudaTerrainMeshOptions);
  if ((heights === undefined) === (noise === undefined))
    issues.push('give heights or noise, one of them');
  if (heights !== undefined) {
    const count = cellsOk ? (options.cells[0] + 1) * (options.cells[1] + 1) : -1;
    if (typeof heights !== 'object' || heights === null || typeof heights.length !== 'number')
      issues.push('heights: a list of numbers');
    else if (cellsOk && heights.length !== count)
      issues.push(`heights: ${count} numbers for these cells, not ${heights.length}`);
    else
      for (let i = 0; i < heights.length; i++)
        if (!finite(heights[i]) || Math.abs(heights[i]) > 100000) {
          issues.push(`heights[${i}]: a height in metres`);
          break;
        }
  }
  if (noise !== undefined) {
    if (typeof noise !== 'object' || noise === null) issues.push('noise: object required');
    else {
      if (!(finite(noise.heightM) && noise.heightM >= 0 && noise.heightM <= 10000))
        issues.push('noise.heightM: use 0..10000');
      if (!(finite(noise.scaleM) && noise.scaleM >= 1 && noise.scaleM <= 100000))
        issues.push('noise.scaleM: use 1..100000');
      if (noise.seed !== undefined && !(Number.isInteger(noise.seed) && noise.seed >= 0))
        issues.push('noise.seed: a whole number from 0');
      if (noise.ridged !== undefined && typeof noise.ridged !== 'boolean')
        issues.push('noise.ridged: true or false');
      if (noise.flatten !== undefined) {
        const ok = (r: any) =>
          r &&
          typeof r === 'object' &&
          ['minX', 'maxX', 'minZ', 'maxZ', 'y'].every((k) => finite(r[k])) &&
          r.maxX > r.minX &&
          r.maxZ > r.minZ &&
          (r.marginM === undefined || (finite(r.marginM) && r.marginM >= 0 && r.marginM <= 1000));
        if (!Array.isArray(noise.flatten) || noise.flatten.length > 32 || !noise.flatten.every(ok))
          issues.push(
            'noise.flatten: up to 32 rectangles {minX, maxX, minZ, maxZ, y, marginM}, minX < maxX and minZ < maxZ',
          );
      }
    }
  }
  return issues;
}

/** The heights of every corner, row by row from -Z, as the mesh uses them. Pure. */
export function zhudaTerrainHeights(options: ZhudaTerrainMeshOptions): Float32Array {
  const issues = validateZhudaTerrainMesh(options);
  if (issues.length) throw Error('Terrain: ' + issues.join('; '));
  const [nx, nz] = options.cells,
    [w, d] = options.size;
  const out = new Float32Array((nx + 1) * (nz + 1));
  if (options.heights) {
    for (let i = 0; i < out.length; i++) out[i] = options.heights[i];
    return out;
  }
  const noise = options.noise!,
    seed = noise.seed ?? 0,
    // Each seed reads another part of the noise.
    ox = seed * 37.13,
    oz = seed * 91.77;
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * w,
        z = (j / nz - 0.5) * d;
      let n = zhudaFbm2D(x / noise.scaleM + ox, z / noise.scaleM + oz) / 0.97;
      if (noise.ridged) n = 1 - Math.abs(n * 2 - 1);
      let h = n * noise.heightM;
      for (const r of noise.flatten ?? []) {
        const margin = r.marginM ?? 4;
        const out2 = Math.max(r.minX - x, x - r.maxX, r.minZ - z, z - r.maxZ, 0);
        const t = margin > 0 ? Math.min(1, out2 / margin) : out2 > 0 ? 1 : 0;
        h = r.y + (h - r.y) * (t * t * (3 - 2 * t));
      }
      out[j * (nx + 1) + i] = h;
    }
  return out;
}

/**
 * The height of the ground at a place of the piece's own metres, between the
 * corners as the mesh's two triangles a cell lie; null outside the piece.
 */
export function zhudaTerrainHeightAt(
  heights: ArrayLike<number>,
  size: readonly [number, number],
  cells: readonly [number, number],
  x: number,
  z: number,
): number | null {
  const [nx, nz] = cells;
  const u = (x / size[0] + 0.5) * nx,
    v = (z / size[1] + 0.5) * nz;
  if (!(u >= 0 && u <= nx && v >= 0 && v <= nz)) return null;
  const i = Math.min(nx - 1, Math.floor(u)),
    j = Math.min(nz - 1, Math.floor(v)),
    fx = u - i,
    fz = v - j;
  const at = (a: number, b: number) => heights[b * (nx + 1) + a];
  const h00 = at(i, j),
    h10 = at(i + 1, j),
    h01 = at(i, j + 1),
    h11 = at(i + 1, j + 1);
  // The cell is cut from its -X-Z corner to its +X+Z corner.
  return fx >= fz
    ? h00 + (h10 - h00) * fx + (h11 - h10) * fz
    : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
}

/** The mesh: positions, smooth normals, texture coordinates in metres, clockwise fronts facing up. */
export function createZhudaTerrainMesh(options: ZhudaTerrainMeshOptions): MeshData {
  const heights = zhudaTerrainHeights(options);
  const [nx, nz] = options.cells,
    [w, d] = options.size,
    row = nx + 1,
    count = row * (nz + 1);
  const positions = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2);
  const dx = w / nx,
    dz = d / nz;
  const h = (i: number, j: number) =>
    heights[Math.max(0, Math.min(nz, j)) * row + Math.max(0, Math.min(nx, i))];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const k = j * row + i,
        x = (i / nx - 0.5) * w,
        z = (j / nz - 0.5) * d;
      positions.set([x, heights[k], z], k * 3);
      // Central differences; one-sided at the border.
      const sx = (h(i + 1, j) - h(i - 1, j)) / ((Math.min(nx, i + 1) - Math.max(0, i - 1)) * dx),
        sz = (h(i, j + 1) - h(i, j - 1)) / ((Math.min(nz, j + 1) - Math.max(0, j - 1)) * dz);
      const l = Math.hypot(sx, 1, sz);
      normals.set([-sx / l, 1 / l, -sz / l], k * 3);
      uvs.set([x, z], k * 2);
    }
  const indices = new Uint16Array(nx * nz * 6);
  let o = 0;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * row + i,
        b = a + 1,
        c = a + row,
        e = c + 1;
      // Clockwise seen from above (LayaAir's front).
      indices.set([a, b, e, a, e, c], o);
      o += 6;
    }
  return { positions, normals, uvs, indices };
}
