import { normalized, type Vec3 } from "../runtime3d/Math3D.ts";
import type { QueryRay } from "../runtime3d/SceneQueries.ts";
export interface HeightfieldSpec {
  schemaVersion: 1;
  dimension: 3;
  cellsX: number;
  cellsZ: number;
  cellSize: number;
  origin?: [number, number];
  heights: number[];
}
export interface HeightRegion {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}
export function validateHeightfield(spec: unknown): string[] {
  const s = spec as HeightfieldSpec,
    e: string[] = [];
  if (!s || s.schemaVersion !== 1 || s.dimension !== 3)
    return ["Expected schemaVersion:1, dimension:3"];
  if (
    ![s.cellsX, s.cellsZ].every(
      (n) => Number.isInteger(n) && n > 0 && n <= 2048,
    ) ||
    (s.cellsX + 1) * (s.cellsZ + 1) > 4194304
  )
    e.push(
      "Invalid heightfield dimensions (1..2048, at most 4194304 vertices)",
    );
  if (!Number.isFinite(s.cellSize) || s.cellSize <= 0)
    e.push("cellSize must be positive");
  if (
    s.origin &&
    (!Array.isArray(s.origin) ||
      s.origin.length !== 2 ||
      !s.origin.every(Number.isFinite))
  )
    e.push("Invalid origin");
  if (
    !Array.isArray(s.heights) ||
    s.heights.length !== (s.cellsX + 1) * (s.cellsZ + 1) ||
    s.heights.some((h) => !Number.isFinite(h) || Math.abs(h) > 1e6)
  )
    e.push("Invalid finite height data");
  return e;
}
/** Integer hash-based smooth noise; no global random state. */
export function terrainNoise(seed: number, x: number, z: number) {
  if (![seed, x, z].every(Number.isFinite))
    throw Error("Invalid noise coordinates");
  const hash = (a: number, b: number) => {
    let h = Math.imul(a ^ seed, 374761393) ^ Math.imul(b, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x),
    iz = Math.floor(z),
    fx = x - ix,
    fz = z - iz,
    u = fx * fx * (3 - 2 * fx),
    v = fz * fz * (3 - 2 * fz),
    a = hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u,
    b = hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u;
  return a * (1 - v) + b * v;
}
export class ZhudaHeightfield {
  readonly cellsX: number;
  readonly cellsZ: number;
  readonly cellSize: number;
  readonly origin: readonly [number, number];
  private heights: Float32Array;
  private listeners = new Set<(r: HeightRegion) => void>();
  constructor(spec: HeightfieldSpec) {
    const e = validateHeightfield(spec);
    if (e.length) throw Error(e.join("; "));
    this.cellsX = spec.cellsX;
    this.cellsZ = spec.cellsZ;
    this.cellSize = spec.cellSize;
    this.origin = Object.freeze([...(spec.origin || [0, 0])]) as readonly [
      number,
      number,
    ];
    this.heights = new Float32Array(spec.heights);
  }
  static generate(options: {
    cellsX: number;
    cellsZ: number;
    cellSize: number;
    origin?: [number, number];
    seed: number;
    amplitude?: number;
    frequency?: number;
  }) {
    const count = (options.cellsX + 1) * (options.cellsZ + 1);
    if (
      !Number.isSafeInteger(count) ||
      count < 4 ||
      count > 4194304 ||
      ![options.seed, options.amplitude ?? 4, options.frequency ?? 0.1].every(
        Number.isFinite,
      )
    )
      throw Error("Invalid generation bounds");
    const heights = Array.from(
      { length: count },
      (_, i) =>
        terrainNoise(
          options.seed,
          (i % (options.cellsX + 1)) * (options.frequency ?? 0.1),
          Math.floor(i / (options.cellsX + 1)) * (options.frequency ?? 0.1),
        ) * (options.amplitude ?? 4),
    );
    return new ZhudaHeightfield({
      schemaVersion: 1,
      dimension: 3,
      ...options,
      heights,
    });
  }
  private index(x: number, z: number) {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(z) ||
      x < 0 ||
      z < 0 ||
      x > this.cellsX ||
      z > this.cellsZ
    )
      throw Error("Vertex outside heightfield");
    return z * (this.cellsX + 1) + x;
  }
  heightAtVertex(x: number, z: number) {
    return this.heights[this.index(x, z)];
  }
  normalAtVertex(x: number, z: number): Vec3 {
    this.index(x, z);
    const ax = Math.max(0, x - 1),
      bx = Math.min(this.cellsX, x + 1),
      az = Math.max(0, z - 1),
      bz = Math.min(this.cellsZ, z + 1);
    return normalized({
      x:
        -(this.heightAtVertex(bx, z) - this.heightAtVertex(ax, z)) /
        ((bx - ax) * this.cellSize),
      y: 1,
      z:
        -(this.heightAtVertex(x, bz) - this.heightAtVertex(x, az)) /
        ((bz - az) * this.cellSize),
    });
  }
  setHeight(x: number, z: number, height: number) {
    this.applyPatch(x, z, 1, 1, [height]);
  }
  applyPatch(
    x: number,
    z: number,
    width: number,
    depth: number,
    values: ArrayLike<number>,
  ) {
    if (
      ![x, z, width, depth].every(Number.isInteger) ||
      width < 1 ||
      depth < 1 ||
      values.length !== width * depth ||
      Array.from(values).some((h) => !Number.isFinite(h) || Math.abs(h) > 1e6)
    )
      throw Error("Invalid height patch");
    this.index(x, z);
    this.index(x + width - 1, z + depth - 1);
    for (let j = 0; j < depth; j++)
      for (let i = 0; i < width; i++)
        this.heights[(z + j) * (this.cellsX + 1) + x + i] =
          values[j * width + i];
    this.emit({ minX: x, minZ: z, maxX: x + width - 1, maxZ: z + depth - 1 });
  }
  brush(x: number, z: number, radius: number, delta: number) {
    if (![x, z, radius, delta].every(Number.isFinite) || radius <= 0)
      throw Error("Invalid height brush");
    const cx = (x - this.origin[0]) / this.cellSize,
      cz = (z - this.origin[1]) / this.cellSize,
      r = radius / this.cellSize;
    const minX = Math.max(0, Math.ceil(cx - r)),
      maxX = Math.min(this.cellsX, Math.floor(cx + r)),
      minZ = Math.max(0, Math.ceil(cz - r)),
      maxZ = Math.min(this.cellsZ, Math.floor(cz + r));
    const patch: { i: number; h: number }[] = [];
    for (let j = minZ; j <= maxZ; j++)
      for (let i = minX; i <= maxX; i++) {
        const d = Math.hypot(i - cx, j - cz) / r;
        if (d > 1) continue;
        const a = 1 - d,
          h = this.heightAtVertex(i, j) + delta * a * a * (3 - 2 * a);
        if (Math.abs(h) > 1e6) throw Error("Brush exceeds height bound");
        patch.push({ i: j * (this.cellsX + 1) + i, h });
      }
    if (!patch.length) return;
    for (const p of patch) this.heights[p.i] = p.h;
    this.emit({ minX, minZ, maxX, maxZ });
  }
  private emit(r: HeightRegion) {
    for (const f of this.listeners) f(r);
  }
  onChange(f: (r: HeightRegion) => void) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  /** Exact same diagonal and barycentric interpolation as rendered triangles. */
  sample(x: number, z: number, stride: 1 | 2 | 4 = 1) {
    if (![1, 2, 4].includes(stride)) throw Error("Invalid terrain stride");
    if (![x, z].every(Number.isFinite)) throw Error("Invalid sample");
    const gx = (x - this.origin[0]) / this.cellSize,
      gz = (z - this.origin[1]) / this.cellSize;
    if (gx < 0 || gz < 0 || gx > this.cellsX || gz > this.cellsZ) return null;
    const ix = Math.min(
        Math.floor((this.cellsX - 1) / stride) * stride,
        Math.floor(gx / stride) * stride,
      ),
      iz = Math.min(
        Math.floor((this.cellsZ - 1) / stride) * stride,
        Math.floor(gz / stride) * stride,
      ),
      bx = Math.min(this.cellsX, ix + stride),
      bz = Math.min(this.cellsZ, iz + stride),
      u = (gx - ix) / (bx - ix),
      v = (gz - iz) / (bz - iz),
      a = this.heightAtVertex(ix, iz),
      b = this.heightAtVertex(bx, iz),
      c = this.heightAtVertex(ix, bz),
      d = this.heightAtVertex(bx, bz);
    const height =
      u >= v
        ? a * (1 - u) + b * (u - v) + d * v
        : a * (1 - v) + c * (v - u) + d * u;
    const normal =
      u >= v
        ? normalized({
            x: -(b - a) / ((bx - ix) * this.cellSize),
            y: 1,
            z: -(d - b) / ((bz - iz) * this.cellSize),
          })
        : normalized({
            x: -(d - c) / ((bx - ix) * this.cellSize),
            y: 1,
            z: -(c - a) / ((bz - iz) * this.cellSize),
          });
    return { height, normal, cellX: ix, cellZ: iz };
  }
  /** Local ray direction may be unnormalized, preserving world-distance parameter after inverse transform. */
  raycast(
    ray: QueryRay,
    maxDistance = Infinity,
    stride: 1 | 2 | 4 = 1,
    acceptCell?: (x: number, z: number) => boolean,
  ) {
    if (![1, 2, 4].includes(stride)) throw Error("Invalid terrain stride");
    if (
      !(maxDistance >= 0) ||
      ![...Object.values(ray.origin), ...Object.values(ray.direction)].every(
        Number.isFinite,
      ) ||
      Math.hypot(...Object.values(ray.direction)) < 1e-12
    )
      throw Error("Invalid terrain ray");
    const o = ray.origin,
      d = ray.direction,
      minX = this.origin[0],
      minZ = this.origin[1],
      maxX = minX + this.cellsX * this.cellSize,
      maxZ = minZ + this.cellsZ * this.cellSize;
    let near = 0,
      far = maxDistance;
    for (const [key, min, max] of [
      ["x", minX, maxX],
      ["z", minZ, maxZ],
    ] as const) {
      if (Math.abs(d[key]) < 1e-12) {
        if (o[key] < min || o[key] > max) return null;
      } else {
        const a = (min - o[key]) / d[key],
          b = (max - o[key]) / d[key];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (far < near) return null;
    let t = near;
    const epsilon = 1e-7 * this.cellSize;
    let x = Math.min(
        this.cellsX - 1,
        Math.max(
          0,
          Math.floor((o.x + d.x * (t + epsilon) - minX) / this.cellSize),
        ),
      ),
      z = Math.min(
        this.cellsZ - 1,
        Math.max(
          0,
          Math.floor((o.z + d.z * (t + epsilon) - minZ) / this.cellSize),
        ),
      );
    const stepX = Math.sign(d.x),
      stepZ = Math.sign(d.z),
      dtX = stepX ? this.cellSize / Math.abs(d.x) : Infinity,
      dtZ = stepZ ? this.cellSize / Math.abs(d.z) : Infinity;
    let nextX = stepX
        ? (minX + (x + (stepX > 0 ? 1 : 0)) * this.cellSize - o.x) / d.x
        : Infinity,
      nextZ = stepZ
        ? (minZ + (z + (stepZ > 0 ? 1 : 0)) * this.cellSize - o.z) / d.z
        : Infinity;
    for (
      let n = 0;
      n < this.cellsX + this.cellsZ + 4 &&
      x >= 0 &&
      z >= 0 &&
      x < this.cellsX &&
      z < this.cellsZ &&
      t <= far + 1e-8;
      n++
    ) {
      const v = (i: number, j: number) => ({
          x: minX + i * this.cellSize,
          y: this.heightAtVertex(i, j),
          z: minZ + j * this.cellSize,
        }),
        sx = Math.floor(x / stride) * stride,
        sz = Math.floor(z / stride) * stride,
        bx = Math.min(this.cellsX, sx + stride),
        bz = Math.min(this.cellsZ, sz + stride),
        a = v(sx, sz),
        b = v(bx, sz),
        c = v(sx, bz),
        q = v(bx, bz);
      let hit: number | null = null;
      for (const tri of acceptCell && !acceptCell(x, z)
        ? []
        : [
            [a, b, q],
            [a, q, c],
          ]) {
        const h = triangle(ray, tri[0], tri[1], tri[2]);
        if (
          h !== null &&
          h >= near - 1e-7 &&
          h <= Math.min(nextX, nextZ, far) + 1e-7 &&
          (hit === null || h < hit)
        )
          hit = h;
      }
      if (hit !== null) {
        const position = {
            x: o.x + d.x * hit,
            y: o.y + d.y * hit,
            z: o.z + d.z * hit,
          },
          s = this.sample(
            Math.max(minX, Math.min(maxX, position.x)),
            Math.max(minZ, Math.min(maxZ, position.z)),
            stride,
          )!;
        return {
          distance: hit,
          position,
          normal: s.normal,
          cellX: x,
          cellZ: z,
        };
      }
      if (!stepX && !stepZ) break;
      const boundary = Math.min(nextX, nextZ);
      t = boundary;
      if (nextX <= boundary + 1e-9) {
        x += stepX;
        nextX += dtX;
      }
      if (nextZ <= boundary + 1e-9) {
        z += stepZ;
        nextZ += dtZ;
      }
    }
    return null;
  }
  toJSON(): HeightfieldSpec {
    return {
      schemaVersion: 1,
      dimension: 3,
      cellsX: this.cellsX,
      cellsZ: this.cellsZ,
      cellSize: this.cellSize,
      origin: [...this.origin],
      heights: [...this.heights],
    };
  }
}
function triangle(r: QueryRay, a: Vec3, b: Vec3, c: Vec3) {
  const sub = (x: Vec3, y: Vec3) => ({
      x: x.x - y.x,
      y: x.y - y.y,
      z: x.z - y.z,
    }),
    cross = (x: Vec3, y: Vec3) => ({
      x: x.y * y.z - x.z * y.y,
      y: x.z * y.x - x.x * y.z,
      z: x.x * y.y - x.y * y.x,
    }),
    dot = (x: Vec3, y: Vec3) => x.x * y.x + x.y * y.y + x.z * y.z;
  const e1 = sub(b, a),
    e2 = sub(c, a),
    p = cross(r.direction, e2),
    det = dot(e1, p);
  if (Math.abs(det) < 1e-10) return null;
  const t = sub(r.origin, a),
    u = dot(t, p) / det;
  if (u < -1e-8 || u > 1 + 1e-8) return null;
  const q = cross(t, e1),
    v = dot(r.direction, q) / det;
  if (v < -1e-8 || u + v > 1 + 1e-8) return null;
  const distance = dot(e2, q) / det;
  return distance >= -1e-8 ? Math.max(0, distance) : null;
}
