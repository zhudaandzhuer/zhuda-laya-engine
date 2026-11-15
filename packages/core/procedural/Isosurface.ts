/**
 * Shapes as signed distances, joined smoothly, and turned into a mesh.
 *
 * A body made of soft parts (a hand, a face, a stone) is easier to write as
 * distances than as faces: each part is a round cone or an ellipsoid, the
 * parts are joined with a smooth minimum (the joint is a fillet, not a seam),
 * and the mesher finds the surface. Pure data, as the rest of `procedural/`:
 * the result is the engine's `MeshData` and nothing here touches Laya.
 *
 * Conventions: metres; a distance is negative inside; the triangles wind as
 * the geometry kit's (cross(v1 - v0, v2 - v0) points into the body).
 */
import type { MeshData } from '../runtime3d/Surfaces.ts';
import type { ZhudaVec3 } from './Geometry.ts';

/** Squeezes a shape along one direction: 1 keeps it, 0.8 makes it 0.8 as thick that way. */
export interface ZhudaSdfFlatten {
  axis: ZhudaVec3;
  factor: number;
}

interface ZhudaSdfShapeBase {
  /** How wide the fillet is where this shape meets what came before it, in metres (0: a crease). */
  blend?: number;
  /** Cut this shape out of what came before it (with the same fillet) instead of adding it. */
  subtract?: boolean;
  flatten?: ZhudaSdfFlatten;
}
/** A cone between two balls: radius `ra` at `a`, `rb` at `b`. Equal radii make a capsule. */
export interface ZhudaSdfRoundCone extends ZhudaSdfShapeBase {
  kind: 'roundCone';
  a: ZhudaVec3;
  b: ZhudaVec3;
  ra: number;
  rb: number;
}
/** An ellipsoid with half-axes `radii` along `axes` (default the world's x, y, z). */
export interface ZhudaSdfEllipsoid extends ZhudaSdfShapeBase {
  kind: 'ellipsoid';
  center: ZhudaVec3;
  radii: ZhudaVec3;
  /** Three unit vectors, square to each other. */
  axes?: [ZhudaVec3, ZhudaVec3, ZhudaVec3];
}
export type ZhudaSdfShape = ZhudaSdfRoundCone | ZhudaSdfEllipsoid;

export interface ZhudaSdfField {
  /** The distance at a point: negative inside. Never more than the true distance by much, so a mesher may step by it. */
  distance(x: number, y: number, z: number): number;
  /** A box that holds the whole body. */
  bounds: { min: ZhudaVec3; max: ZhudaVec3 };
  /** Which shape is nearest the point (the index in the list given), for colouring by part. */
  nearest(x: number, y: number, z: number): number;
}

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isVec = (value: unknown): value is ZhudaVec3 =>
  Array.isArray(value) && value.length === 3 && value.every((n) => finite(n));
const vlen = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);
const len = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

/** What is wrong with a list of shapes; empty when it can be built. */
export function validateZhudaSdfShapes(shapes: readonly ZhudaSdfShape[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(shapes) || shapes.length === 0)
    return ['shapes must be a list of at least one shape'];
  shapes.forEach((shape, i) => {
    const at = `shapes[${i}]`;
    if (!shape || typeof shape !== 'object') return void errors.push(`${at} must be a shape`);
    if (shape.blend !== undefined && !(finite(shape.blend) && shape.blend >= 0))
      errors.push(`${at}.blend must be a number of metres, 0 or more`);
    if (shape.subtract && i === 0) errors.push(`${at}.subtract cannot cut the first shape`);
    if (shape.flatten !== undefined) {
      const f = shape.flatten;
      if (!f || !isVec(f.axis) || !(vlen(f.axis) > 1e-9))
        errors.push(`${at}.flatten.axis must be three numbers, not all 0`);
      if (!f || !(finite(f.factor) && f.factor > 0 && f.factor <= 1))
        errors.push(`${at}.flatten.factor must be more than 0 and at most 1`);
    }
    if (shape.kind === 'roundCone') {
      if (!isVec(shape.a) || !isVec(shape.b)) errors.push(`${at}.a and .b must be three numbers`);
      if (!(finite(shape.ra) && shape.ra > 0) || !(finite(shape.rb) && shape.rb > 0))
        errors.push(`${at}.ra and .rb must be positive numbers`);
    } else if (shape.kind === 'ellipsoid') {
      if (!isVec(shape.center)) errors.push(`${at}.center must be three numbers`);
      if (!isVec(shape.radii) || !shape.radii.every((r: number) => r > 0))
        errors.push(`${at}.radii must be three positive numbers`);
      if (shape.axes !== undefined) {
        const axes = shape.axes;
        if (!Array.isArray(axes) || axes.length !== 3 || !axes.every(isVec))
          errors.push(`${at}.axes must be three vectors`);
        else {
          for (let k = 0; k < 3; k++) {
            if (Math.abs(vlen(axes[k]) - 1) > 1e-3) errors.push(`${at}.axes[${k}] must be unit`);
            const o = axes[(k + 1) % 3];
            const d = axes[k][0] * o[0] + axes[k][1] * o[1] + axes[k][2] * o[2];
            if (Math.abs(d) > 1e-3) errors.push(`${at}.axes must be square to each other`);
          }
        }
      }
    } else errors.push(`${at}.kind must be 'roundCone' or 'ellipsoid'`);
  });
  return [...new Set(errors)];
}

/** The polynomial smooth minimum: the two distances joined with a fillet `k` wide. */
export function zhudaSmoothMin(a: number, b: number, k: number): number {
  if (!(k > 0)) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

type Compiled = {
  blend: number;
  subtract: boolean;
  /** The box, before the fillet. */
  lo: ZhudaVec3;
  hi: ZhudaVec3;
  /** How much the flatten shortens a distance at most (the factor, or 1). */
  shrink: number;
  distance: (x: number, y: number, z: number) => number;
};

function roundCone(s: ZhudaSdfRoundCone): (x: number, y: number, z: number) => number {
  // Inigo Quilez's exact round cone (MIT), written out for numbers.
  const [ax, ay, az] = s.a,
    bx = s.b[0] - ax,
    by = s.b[1] - ay,
    bz = s.b[2] - az;
  const r1 = s.ra,
    r2 = s.rb;
  const l2 = bx * bx + by * by + bz * bz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = l2 > 0 ? 1 / l2 : 0;
  if (l2 < 1e-14 || a2 <= 1e-14) {
    // One ball holds the other: the bigger ball.
    const big = r1 >= r2 ? s.a : s.b,
      r = Math.max(r1, r2);
    return (x, y, z) => len(x - big[0], y - big[1], z - big[2]) - r;
  }
  return (x, y, z) => {
    const px = x - ax,
      py = y - ay,
      pz = z - az;
    const yy = px * bx + py * by + pz * bz;
    const zz = yy - l2;
    const qx = px * l2 - bx * yy,
      qy = py * l2 - by * yy,
      qz = pz * l2 - bz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}

function ellipsoid(s: ZhudaSdfEllipsoid): (x: number, y: number, z: number) => number {
  // Inigo Quilez's bound for an ellipsoid (MIT): close to the surface, never far over.
  const [cx, cy, cz] = s.center;
  const [rx, ry, rz] = s.radii;
  const axes = s.axes ?? [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const [u, v, w] = axes;
  return (x, y, z) => {
    const px = x - cx,
      py = y - cy,
      pz = z - cz;
    const lx = px * u[0] + py * u[1] + pz * u[2],
      ly = px * v[0] + py * v[1] + pz * v[2],
      lz = px * w[0] + py * w[1] + pz * w[2];
    const k0 = len(lx / rx, ly / ry, lz / rz);
    const k1 = len(lx / (rx * rx), ly / (ry * ry), lz / (rz * rz));
    if (k1 < 1e-12) return -Math.min(rx, ry, rz);
    return (k0 * (k0 - 1)) / k1;
  };
}

function compile(shape: ZhudaSdfShape): Compiled {
  let base: (x: number, y: number, z: number) => number;
  let lo: ZhudaVec3, hi: ZhudaVec3;
  if (shape.kind === 'roundCone') {
    base = roundCone(shape);
    lo = [0, 1, 2].map((k) => Math.min(shape.a[k] - shape.ra, shape.b[k] - shape.rb)) as ZhudaVec3;
    hi = [0, 1, 2].map((k) => Math.max(shape.a[k] + shape.ra, shape.b[k] + shape.rb)) as ZhudaVec3;
  } else {
    base = ellipsoid(shape);
    const axes = shape.axes ?? [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    // The box of an oriented ellipsoid: along each world axis, the length of the radii there.
    const ext = [0, 1, 2].map((k) =>
      Math.sqrt(
        (axes[0][k] * shape.radii[0]) ** 2 +
          (axes[1][k] * shape.radii[1]) ** 2 +
          (axes[2][k] * shape.radii[2]) ** 2,
      ),
    );
    lo = [0, 1, 2].map((k) => shape.center[k] - ext[k]) as ZhudaVec3;
    hi = [0, 1, 2].map((k) => shape.center[k] + ext[k]) as ZhudaVec3;
  }
  let distance = base;
  let shrink = 1;
  if (shape.flatten && shape.flatten.factor < 1) {
    // Squeezed about the shape's own middle: a point is stretched away from it, the distance scaled back.
    const n = shape.flatten.axis;
    const nl = len(...n);
    const ax = n[0] / nl,
      ay = n[1] / nl,
      az = n[2] / nl;
    const f = shape.flatten.factor;
    const stretch = 1 / f - 1;
    const o = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
    distance = (x, y, z) => {
      const along = (x - o[0]) * ax + (y - o[1]) * ay + (z - o[2]) * az;
      return base(x + stretch * along * ax, y + stretch * along * ay, z + stretch * along * az) * f;
    };
    shrink = f;
  }
  // Never less than the distance to the shape's box: the ellipsoid's distance is an estimate
  // that can fall below it far from the shape, and a broad phase that skips by the box would
  // then change the field where it starts skipping (a step in the surface).
  const exact = distance;
  const guarded = (x: number, y: number, z: number) => {
    const e = exact(x, y, z);
    if (e <= 0) return e;
    const dx = Math.max(lo[0] - x, 0, x - hi[0]),
      dy = Math.max(lo[1] - y, 0, y - hi[1]),
      dz = Math.max(lo[2] - z, 0, z - hi[2]);
    return Math.max(e, len(dx, dy, dz) * shrink);
  };
  return { blend: shape.blend ?? 0, subtract: !!shape.subtract, lo, hi, shrink, distance: guarded };
}

/** The shapes, in order, as one field. Throws with every problem `validateZhudaSdfShapes` finds. */
export function createZhudaSdfField(shapes: readonly ZhudaSdfShape[]): ZhudaSdfField {
  const errors = validateZhudaSdfShapes(shapes);
  if (errors.length) throw Error(`Invalid signed distance shapes: ${errors.join('; ')}`);
  const parts = shapes.map(compile);
  const boxDistance = (p: Compiled, x: number, y: number, z: number) => {
    const dx = Math.max(p.lo[0] - x, 0, x - p.hi[0]),
      dy = Math.max(p.lo[1] - y, 0, y - p.hi[1]),
      dz = Math.max(p.lo[2] - z, 0, z - p.hi[2]);
    return len(dx, dy, dz) * p.shrink;
  };
  const distance = (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const p of parts) {
      if (p.subtract) {
        // A cut only matters where it is near: outside its box and fillet it changes nothing.
        if (boxDistance(p, x, y, z) >= p.blend + Math.abs(d)) continue;
        d = -zhudaSmoothMin(-d, p.distance(x, y, z), p.blend);
        continue;
      }
      // Broad phase: a shape whose box is farther than what is already here plus its fillet changes nothing.
      if (d !== Infinity && boxDistance(p, x, y, z) >= d + p.blend) continue;
      const e = p.distance(x, y, z);
      d = d === Infinity ? e : zhudaSmoothMin(d, e, p.blend);
    }
    return d;
  };
  const nearest = (x: number, y: number, z: number) => {
    let best = 0,
      bestD = Infinity;
    parts.forEach((p, i) => {
      if (p.subtract) return;
      const e = p.distance(x, y, z);
      if (e < bestD) {
        bestD = e;
        best = i;
      }
    });
    return best;
  };
  const min: ZhudaVec3 = [Infinity, Infinity, Infinity],
    max: ZhudaVec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    if (p.subtract) continue;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.lo[k] - p.blend);
      max[k] = Math.max(max[k], p.hi[k] + p.blend);
    }
  }
  return { distance, nearest, bounds: { min, max } };
}

export interface ZhudaIsosurfaceOptions {
  /** The distance at a point, negative inside. A `ZhudaSdfField`'s `distance` serves. */
  distance: (x: number, y: number, z: number) => number;
  /** The box to search; the surface must not touch its sides. */
  min: ZhudaVec3;
  max: ZhudaVec3;
  /** The size of a cell, in metres: the mesh's detail, and about the distance between its vertices. */
  cellSize: number;
  /** Steps that move each vertex onto the surface along the field's slope (default 3; 0 leaves them where the cells put them). */
  project?: number;
  /** Texture coordinates at a vertex (default its x and y, in metres). */
  uv?: (p: ZhudaVec3, n: ZhudaVec3) => [number, number];
  /** A colour at a vertex (four numbers); left out, the mesh has none. */
  color?: (p: ZhudaVec3, n: ZhudaVec3) => [number, number, number, number];
  /**
   * Refuse past this many vertices (default 2 000 000). Past 65535 the indices are 32-bit:
   * `splitZhudaMesh` cuts such a mesh into chunks a `ZhudaDynamicMesh` takes.
   */
  maxVertices?: number;
}

/** What is wrong with the options; empty when they can be used. */
export function validateZhudaIsosurface(options: ZhudaIsosurfaceOptions): string[] {
  const errors: string[] = [];
  if (!options || typeof options !== 'object') return ['options must be an object'];
  if (typeof options.distance !== 'function') errors.push('distance must be a function');
  if (!isVec(options.min) || !isVec(options.max)) errors.push('min and max must be three numbers');
  else if (!options.min.every((v, k) => v < options.max[k]))
    errors.push('min must be below max on every axis');
  if (!(finite(options.cellSize) && options.cellSize > 0))
    errors.push('cellSize must be a positive number of metres');
  else if (isVec(options.min) && isVec(options.max)) {
    const cells = [0, 1, 2].map((k) =>
      Math.ceil((options.max[k] - options.min[k]) / options.cellSize),
    );
    if (cells[0] * cells[1] * cells[2] > 64e6)
      errors.push(
        `cellSize ${options.cellSize} makes ${cells.join(' x ')} cells; more than 64 million`,
      );
  }
  if (
    options.project !== undefined &&
    !(Number.isInteger(options.project) && options.project >= 0 && options.project <= 8)
  )
    errors.push('project must be a whole number from 0 to 8');
  if (options.uv !== undefined && typeof options.uv !== 'function')
    errors.push('uv must be a function');
  if (options.color !== undefined && typeof options.color !== 'function')
    errors.push('color must be a function');
  if (
    options.maxVertices !== undefined &&
    !(Number.isInteger(options.maxVertices) && options.maxVertices >= 3)
  )
    errors.push('maxVertices must be a whole number, 3 or more');
  return errors;
}

/**
 * The surface where the distance is 0, as a mesh, by surface nets: one vertex
 * in each cell the surface passes through, moved onto the surface, and a
 * quad across each edge of the grid that the surface cuts. The normals are
 * the field's slope. A closed body inside the box gives a closed mesh.
 */
export function createZhudaIsosurfaceMesh(options: ZhudaIsosurfaceOptions): MeshData {
  const errors = validateZhudaIsosurface(options);
  if (errors.length) throw Error(`Invalid isosurface: ${errors.join('; ')}`);
  const { distance, min, max, cellSize: h } = options;
  const project = options.project ?? 3;
  const maxVertices = options.maxVertices ?? 2_000_000;
  // Grid points: n per axis, the box padded by two cells so the surface never meets its side.
  const o: ZhudaVec3 = [min[0] - 2 * h, min[1] - 2 * h, min[2] - 2 * h];
  const nx = Math.ceil((max[0] - min[0]) / h) + 5,
    ny = Math.ceil((max[1] - min[1]) / h) + 5,
    nz = Math.ceil((max[2] - min[2]) / h) + 5;
  const sx = 1,
    sy = nx,
    sz = nx * ny;
  const values = new Float32Array(nx * ny * nz);
  // Blocks of 8 cells a side: where the distance at a block's middle is more than its half
  // diagonal, the surface is not in it (the distance grows no faster than the way travelled)
  // and its points all take that sign without being asked.
  const B = 8;
  const reach = Math.sqrt(3) * (B / 2) * h * 1.05;
  for (let bz = 0; bz < nz; bz += B)
    for (let by = 0; by < ny; by += B)
      for (let bx = 0; bx < nx; bx += B) {
        const ex = Math.min(bx + B, nx),
          ey = Math.min(by + B, ny),
          ez = Math.min(bz + B, nz);
        const mid = distance(
          o[0] + ((bx + ex - 1) / 2) * h,
          o[1] + ((by + ey - 1) / 2) * h,
          o[2] + ((bz + ez - 1) / 2) * h,
        );
        const far = Math.abs(mid) > reach;
        for (let z = bz; z < ez; z++)
          for (let y = by; y < ey; y++)
            for (let x = bx; x < ex; x++) {
              values[x * sx + y * sy + z * sz] = far
                ? mid
                : distance(o[0] + x * h, o[1] + y * h, o[2] + z * h);
            }
      }
  for (const k of [0, nx - 1])
    for (let z = 0; z < nz; z++)
      for (let y = 0; y < ny; y++)
        if (values[k + y * sy + z * sz] <= 0)
          throw Error('The surface reaches the side of the box; give a larger min and max');
  for (const k of [0, ny - 1])
    for (let z = 0; z < nz; z++)
      for (let x = 0; x < nx; x++)
        if (values[x + k * sy + z * sz] <= 0)
          throw Error('The surface reaches the side of the box; give a larger min and max');
  for (const k of [0, nz - 1])
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        if (values[x + y * sy + k * sz] <= 0)
          throw Error('The surface reaches the side of the box; give a larger min and max');

  const gradient = (x: number, y: number, z: number): ZhudaVec3 => {
    const e = h * 0.25;
    return [
      distance(x + e, y, z) - distance(x - e, y, z),
      distance(x, y + e, z) - distance(x, y - e, z),
      distance(x, y, z + e) - distance(x, y, z - e),
    ];
  };
  // One vertex in each cell the surface crosses (the cell's corner with the lowest index names it).
  const cellVertex = new Int32Array((nx - 1) * (ny - 1) * nz).fill(-1);
  const cellIndex = (x: number, y: number, z: number) => x + y * (nx - 1) + z * (nx - 1) * (ny - 1);
  const positions: number[] = [];
  const normals: number[] = [];
  const CORNERS = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];
  const EDGES = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const corner = new Float32Array(8);
  for (let z = 0; z < nz - 1; z++)
    for (let y = 0; y < ny - 1; y++)
      for (let x = 0; x < nx - 1; x++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const [cx, cy, cz] = CORNERS[c];
          corner[c] = values[(x + cx) * sx + (y + cy) * sy + (z + cz) * sz];
          if (corner[c] <= 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        // The mean of where the surface crosses the cell's edges.
        let px = 0,
          py = 0,
          pz = 0,
          count = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a],
            vb = corner[b];
          if (va <= 0 === vb <= 0) continue;
          const t = va / (va - vb);
          const A = CORNERS[a],
            Bc = CORNERS[b];
          px += A[0] + (Bc[0] - A[0]) * t;
          py += A[1] + (Bc[1] - A[1]) * t;
          pz += A[2] + (Bc[2] - A[2]) * t;
          count++;
        }
        let p: ZhudaVec3 = [
          o[0] + (x + px / count) * h,
          o[1] + (y + py / count) * h,
          o[2] + (z + pz / count) * h,
        ];
        const start = p;
        for (let i = 0; i < project; i++) {
          const d = distance(...p);
          const g = gradient(...p);
          const gl2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
          if (!(gl2 > 1e-20)) break;
          // The slope was taken over half a cell: g / (h / 2) is the field's gradient.
          const scale = (d * (h * 0.5)) / gl2;
          const next: ZhudaVec3 = [p[0] - g[0] * scale, p[1] - g[1] * scale, p[2] - g[2] * scale];
          // Never more than a cell from where the cell put it: keeps sharp places from folding.
          if (len(next[0] - start[0], next[1] - start[1], next[2] - start[2]) > h) break;
          p = next;
        }
        const g = gradient(...p);
        const gl = len(...g);
        const n: ZhudaVec3 = gl > 1e-20 ? [g[0] / gl, g[1] / gl, g[2] / gl] : [0, 1, 0];
        const index = positions.length / 3;
        if (index >= maxVertices)
          throw Error(
            `The surface needs more than ${maxVertices} vertices at cellSize ${h}; give a larger cellSize or split the body`,
          );
        cellVertex[cellIndex(x, y, z)] = index;
        positions.push(p[0], p[1], p[2]);
        normals.push(n[0], n[1], n[2]);
      }
  // A quad across every grid edge the surface cuts, made of the four cells round that edge.
  const indices: number[] = [];
  const P = (i: number): ZhudaVec3 => [
    positions[i * 3],
    positions[i * 3 + 1],
    positions[i * 3 + 2],
  ];
  const N = (i: number): ZhudaVec3 => [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
  // The four cells round an edge go round it one way; `flip` turns them the other, so that
  // every triangle winds into the body (the side of the edge whose point is inside).
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) [b, d] = [d, b];
    const tri = (i: number, j: number, k: number) => indices.push(i, j, k);
    // Split along the shorter diagonal: fewer slivers.
    const pa = P(a),
      pb = P(b),
      pc = P(c),
      pd = P(d);
    const ac = len(pa[0] - pc[0], pa[1] - pc[1], pa[2] - pc[2]);
    const bd = len(pb[0] - pd[0], pb[1] - pd[1], pb[2] - pd[2]);
    if (ac <= bd) {
      tri(a, b, c);
      tri(a, c, d);
    } else {
      tri(a, b, d);
      tri(b, c, d);
    }
  };
  const cv = (x: number, y: number, z: number) => cellVertex[cellIndex(x, y, z)];
  for (let z = 1; z < nz - 1; z++)
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        const here = values[x * sx + y * sy + z * sz] <= 0;
        // The edge along x from this point: the four cells round it share y-1..y, z-1..z, and
        // go round +x in that order (round -y for the edge along y, round +z for z). The
        // outside is toward +axis when this point is inside.
        if (here !== values[(x + 1) * sx + y * sy + z * sz] <= 0)
          quad(cv(x, y - 1, z - 1), cv(x, y, z - 1), cv(x, y, z), cv(x, y - 1, z), here);
        if (here !== values[x * sx + (y + 1) * sy + z * sz] <= 0)
          quad(cv(x - 1, y, z - 1), cv(x, y, z - 1), cv(x, y, z), cv(x - 1, y, z), !here);
        if (here !== values[x * sx + y * sy + (z + 1) * sz] <= 0)
          quad(cv(x - 1, y - 1, z), cv(x, y - 1, z), cv(x, y, z), cv(x - 1, y, z), here);
      }
  const count = positions.length / 3;
  if (count < 3) throw Error('The field has no surface inside the box');
  const uvs = new Float32Array(count * 2);
  const colors = options.color ? new Float32Array(count * 4) : undefined;
  for (let i = 0; i < count; i++) {
    const p = P(i),
      n = N(i);
    const uv = options.uv ? options.uv(p, n) : [p[0], p[1]];
    uvs[i * 2] = uv[0];
    uvs[i * 2 + 1] = uv[1];
    if (colors && options.color) colors.set(options.color(p, n), i * 4);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs,
    ...(colors ? { colors } : {}),
    indices: count <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices),
  };
}

/**
 * A trunk with limbs: each limb is joined to the trunk with its own fillet,
 * and the limbs meet each other with none (fingers touch without growing
 * together). `distance` is the least of the trunk joined with each limb.
 */
export function joinZhudaSdfFields(
  trunk: ZhudaSdfField,
  limbs: ReadonlyArray<{ field: ZhudaSdfField; blend: number }>,
): ZhudaSdfField {
  limbs.forEach((limb, i) => {
    if (!limb || typeof limb.field?.distance !== 'function')
      throw Error(`limbs[${i}].field must be a signed distance field`);
    if (!(finite(limb.blend) && limb.blend >= 0))
      throw Error(`limbs[${i}].blend must be a number of metres, 0 or more`);
  });
  const boxOf = (f: ZhudaSdfField, x: number, y: number, z: number) =>
    len(
      Math.max(f.bounds.min[0] - x, 0, x - f.bounds.max[0]),
      Math.max(f.bounds.min[1] - y, 0, y - f.bounds.max[1]),
      Math.max(f.bounds.min[2] - z, 0, z - f.bounds.max[2]),
    );
  const distance = (x: number, y: number, z: number) => {
    const t = trunk.distance(x, y, z);
    let d = t;
    for (const limb of limbs) {
      // A field's box already holds its own fillets; past it by more than the trunk's distance
      // and this fillet, the limb leaves the trunk as it is.
      if (boxOf(limb.field, x, y, z) >= t + limb.blend) continue;
      d = Math.min(d, zhudaSmoothMin(t, limb.field.distance(x, y, z), limb.blend));
    }
    return d;
  };
  const min = [...trunk.bounds.min] as ZhudaVec3,
    max = [...trunk.bounds.max] as ZhudaVec3;
  for (const limb of limbs)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], limb.field.bounds.min[k] - limb.blend);
      max[k] = Math.max(max[k], limb.field.bounds.max[k] + limb.blend);
    }
  // Which part is nearest: -1 the trunk, else the limb's index.
  const nearest = (x: number, y: number, z: number) => {
    let best = -1,
      bestD = trunk.distance(x, y, z);
    limbs.forEach((limb, i) => {
      const e = limb.field.distance(x, y, z);
      if (e < bestD) {
        bestD = e;
        best = i;
      }
    });
    return best;
  };
  return { distance, nearest, bounds: { min, max } };
}

/** How far a line from a point inside the body runs before it leaves it (up to `limit`). */
export function zhudaSdfDepthAlong(
  distance: (x: number, y: number, z: number) => number,
  from: ZhudaVec3,
  direction: ZhudaVec3,
  limit: number,
): number {
  const l = len(...direction);
  const dx = direction[0] / l,
    dy = direction[1] / l,
    dz = direction[2] / l;
  let t = 0;
  for (let i = 0; i < 128 && t < limit; i++) {
    const d = distance(from[0] + dx * t, from[1] + dy * t, from[2] + dz * t);
    if (d > 0 && t > 0) return t;
    t += Math.max(Math.abs(d), limit / 400);
  }
  return Math.min(t, limit);
}

/**
 * Cuts a mesh into chunks of at most `maxVertices` (default 65535) with 16-bit
 * indices, the size a `ZhudaDynamicMesh` takes. Triangles keep their order;
 * a vertex on a cut is in both chunks, with the same normal, so no seam shows.
 */
export function splitZhudaMesh(data: MeshData, maxVertices = 65535): MeshData[] {
  if (!(Number.isInteger(maxVertices) && maxVertices >= 3 && maxVertices <= 65535))
    throw Error('maxVertices must be a whole number from 3 to 65535');
  const count = data.positions.length / 3;
  if (count <= maxVertices && data.indices instanceof Uint16Array) return [data];
  const chunks: MeshData[] = [];
  const map = new Int32Array(count).fill(-1);
  let used: number[] = [];
  let tris: number[] = [];
  const flush = () => {
    if (!tris.length) return;
    const n = used.length;
    const pick = (array: Float32Array | undefined, size: number) => {
      if (!array) return undefined;
      const result = new Float32Array(n * size);
      used.forEach((v, i) => result.set(array.subarray(v * size, v * size + size), i * size));
      return result;
    };
    const chunk: MeshData = {
      positions: pick(data.positions, 3)!,
      indices: new Uint16Array(tris),
    };
    const normals = pick(data.normals, 3),
      uvs = pick(data.uvs, 2),
      tangents = pick(data.tangents, 4),
      colors = pick(data.colors, 4);
    if (normals) chunk.normals = normals;
    if (uvs) chunk.uvs = uvs;
    if (tangents) chunk.tangents = tangents;
    if (colors) chunk.colors = colors;
    chunks.push(chunk);
    for (const v of used) map[v] = -1;
    used = [];
    tris = [];
  };
  const index = data.indices;
  for (let i = 0; i < index.length; i += 3) {
    let fresh = 0;
    for (let k = 0; k < 3; k++) if (map[index[i + k]] < 0) fresh++;
    if (used.length + fresh > maxVertices) flush();
    for (let k = 0; k < 3; k++) {
      const v = index[i + k];
      if (map[v] < 0) {
        map[v] = used.length;
        used.push(v);
      }
      tris.push(map[v]);
    }
  }
  flush();
  return chunks;
}

/**
 * Many small shapes as one plain union (no fillets, no cuts: creases, rivets,
 * pores), found through a grid so a point asks only the shapes near it.
 * Within `reach` of a shape the distance is exact; farther it is `reach`,
 * which is never more than the true distance. Use it where only what is
 * near matters: a cut into a surface, a detail joined to one.
 */
export function createZhudaSdfUnion(
  shapes: readonly ZhudaSdfShape[],
  options: { reach?: number; cell?: number } = {},
): ZhudaSdfField {
  const errors = validateZhudaSdfShapes(shapes);
  shapes.forEach((s, i) => {
    if (s && (s.subtract || (s.blend ?? 0) > 0))
      errors.push(`shapes[${i}] must have no blend and no subtract in a plain union`);
  });
  const reach = options.reach ?? 0.004,
    cell = options.cell ?? 0.008;
  if (!(finite(reach) && reach > 0)) errors.push('reach must be a positive number of metres');
  if (!(finite(cell) && cell > 0)) errors.push('cell must be a positive number of metres');
  if (errors.length) throw Error(`Invalid signed distance union: ${errors.join('; ')}`);
  const parts = shapes.map(compile);
  const min = [0, 1, 2].map((k) => Math.min(...parts.map((p) => p.lo[k]))) as ZhudaVec3;
  const max = [0, 1, 2].map((k) => Math.max(...parts.map((p) => p.hi[k]))) as ZhudaVec3;
  const o = min.map((v) => v - reach) as ZhudaVec3;
  const n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((max[k] + reach - o[k]) / cell)));
  const buckets: number[][] = Array.from({ length: n[0] * n[1] * n[2] }, () => []);
  parts.forEach((p, i) => {
    const a = [0, 1, 2].map((k) => Math.max(0, Math.floor((p.lo[k] - reach - o[k]) / cell)));
    const b = [0, 1, 2].map((k) => Math.min(n[k] - 1, Math.floor((p.hi[k] + reach - o[k]) / cell)));
    for (let z = a[2]; z <= b[2]; z++)
      for (let y = a[1]; y <= b[1]; y++)
        for (let x = a[0]; x <= b[0]; x++) buckets[x + y * n[0] + z * n[0] * n[1]].push(i);
  });
  const bucket = (x: number, y: number, z: number) => {
    const i = Math.floor((x - o[0]) / cell),
      j = Math.floor((y - o[1]) / cell),
      k = Math.floor((z - o[2]) / cell);
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return null;
    return buckets[i + j * n[0] + k * n[0] * n[1]];
  };
  const distance = (x: number, y: number, z: number) => {
    const list = bucket(x, y, z);
    let d = reach;
    if (list) for (const i of list) d = Math.min(d, parts[i].distance(x, y, z));
    return d;
  };
  const nearest = (x: number, y: number, z: number) => {
    const list = bucket(x, y, z);
    let best = -1,
      bestD = Infinity;
    if (list)
      for (const i of list) {
        const e = parts[i].distance(x, y, z);
        if (e < bestD) {
          bestD = e;
          best = i;
        }
      }
    return best;
  };
  return { distance, nearest, bounds: { min, max } };
}
