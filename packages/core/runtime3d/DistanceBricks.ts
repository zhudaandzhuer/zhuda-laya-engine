/**
 * The distance to a surface, kept only near it: a camera or a character asks
 * how far the rock is, which way is out, where a ray or a moving sphere
 * first meets it. What it does then (slide, stop, take damage) is the
 * consumer's rule.
 *
 * The region `min..max` is cut into bricks of 4 × 4 × 4 samples `cellSize`
 * apart (three cells a side; neighbouring bricks share their border
 * samples, so the field is continuous). A brick the surface comes within
 * `band` of keeps its 64 distances as signed bytes, `band / 127` a step; any
 * other brick keeps only whether it is inside or outside. A query between
 * samples is trilinear. Beyond `band` from the surface a query says `band`
 * (or `-band` inside): at least that far. Outside the region there is no
 * data and a query says `band` (empty).
 *
 * The field is a distance (negative inside, growing no faster than the way
 * travelled), or a density volume (`computeZhudaDensityVolume`).
 */
import type { ZhudaDensityVolume } from '../procedural/Isosurface.ts';
import { zhudaVolumeDistance } from '../procedural/Isosurface.ts';
import type { QueryProvider, QueryRay } from './SceneQueries.ts';

type V3 = [number, number, number];
type XYZ = { x: number; y: number; z: number };

export interface ZhudaDistanceBricksOptions {
  /** The distance at a point, negative inside. */
  distance?: (x: number, y: number, z: number) => number;
  /** Or values on a grid, interpolated. */
  volume?: ZhudaDensityVolume;
  /** The region kept. */
  min: V3;
  max: V3;
  /** Metres between samples. */
  cellSize: number;
  /** How far from the surface distances are kept, in metres (default 4 cells). */
  band?: number;
}

export interface ZhudaBrickHit {
  /** Along the ray, or along the sweep from `from`, in metres. */
  distance: number;
  /** Where the ray meets the surface, or where the sphere's centre is at contact. */
  position: V3;
  /** Out of the surface there. */
  normal: V3;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(finite);
/** Samples a side of a brick; cells a side are one fewer. */
const S = 4;
const FAR_OUT = -1,
  FAR_IN = -2;

/** Lists what is wrong with the options; empty when they can be used. */
export function validateZhudaDistanceBricks(options: ZhudaDistanceBricksOptions): string[] {
  const o = (options ?? {}) as ZhudaDistanceBricksOptions;
  const issues: string[] = [];
  if (typeof o.distance !== 'function' && !o.volume)
    issues.push('distance: a function, or a volume');
  if (o.distance !== undefined && typeof o.distance !== 'function')
    issues.push('distance: a function');
  if (!isVec(o.min) || !isVec(o.max) || !o.min.every((v, k) => v < o.max[k]))
    issues.push('min and max: three numbers each, min below max');
  if (!(finite(o.cellSize) && o.cellSize > 0)) issues.push('cellSize: metres above 0');
  const band = o.band ?? (finite(o.cellSize) ? o.cellSize * 4 : NaN);
  if (!(finite(band) && band >= (o.cellSize ?? 0) * 2)) issues.push('band: at least two cells');
  if (!issues.length) {
    const bricks = [0, 1, 2].map((k) => Math.ceil((o.max[k] - o.min[k]) / ((S - 1) * o.cellSize)));
    if (bricks[0] * bricks[1] * bricks[2] > 16777216)
      issues.push(
        `${bricks.join(' x ')} bricks; at most 16777216 (a larger cellSize or a smaller region)`,
      );
  }
  return issues;
}

export class ZhudaDistanceBricks {
  readonly min: V3;
  readonly max: V3;
  readonly cellSize: number;
  readonly band: number;
  /** Bricks along x, y and z. */
  readonly bricks: [number, number, number];
  /** For each brick: its slot in `data`, or -1 (all outside), -2 (all inside). */
  private readonly directory: Int32Array;
  /** 64 signed bytes a kept brick. */
  private readonly data: Int8Array;
  private readonly scale: number;

  private constructor(
    options: ZhudaDistanceBricksOptions,
    bricks: [number, number, number],
    directory: Int32Array,
    data: Int8Array,
    band: number,
  ) {
    this.min = [...options.min] as V3;
    this.max = [...options.max] as V3;
    this.cellSize = options.cellSize;
    this.band = band;
    this.bricks = bricks;
    this.directory = directory;
    this.data = data;
    this.scale = band / 127;
  }

  /** Samples the field near its surface and keeps it as bricks. Synchronous. */
  static build(options: ZhudaDistanceBricksOptions): ZhudaDistanceBricks {
    const issues = validateZhudaDistanceBricks(options);
    if (issues.length) throw Error('Invalid distance bricks: ' + issues.join('; '));
    const field = options.distance ?? zhudaVolumeDistance(options.volume!);
    const h = options.cellSize,
      band = options.band ?? h * 4,
      side = (S - 1) * h;
    const { min, max } = options;
    const bricks = [0, 1, 2].map((k) => Math.ceil((max[k] - min[k]) / side)) as [
      number,
      number,
      number,
    ];
    const total = bricks[0] * bricks[1] * bricks[2];
    const directory = new Int32Array(total);
    const kept: Int8Array[] = [];
    const reach = Math.sqrt(3) * (side / 2) * 1.05;
    const samples = new Float64Array(S * S * S);
    for (let bz = 0; bz < bricks[2]; bz++)
      for (let by = 0; by < bricks[1]; by++)
        for (let bx = 0; bx < bricks[0]; bx++) {
          const index = bx + by * bricks[0] + bz * bricks[0] * bricks[1];
          const ox = min[0] + bx * side,
            oy = min[1] + by * side,
            oz = min[2] + bz * side;
          const middle = field(ox + side / 2, oy + side / 2, oz + side / 2);
          // The surface cannot be nearer than this to any sample of the brick.
          if (Math.abs(middle) - reach >= band) {
            directory[index] = middle < 0 ? FAR_IN : FAR_OUT;
            continue;
          }
          let near = false,
            inside = 0;
          for (let k = 0, n = 0; k < S; k++)
            for (let j = 0; j < S; j++)
              for (let i = 0; i < S; i++, n++) {
                const d = field(ox + i * h, oy + j * h, oz + k * h);
                if (!Number.isFinite(d))
                  throw Error(
                    `Distance bricks: the field is not finite at ${[ox + i * h, oy + j * h, oz + k * h]}`,
                  );
                samples[n] = d;
                if (Math.abs(d) < band) near = true;
                if (d < 0) inside++;
              }
          if (!near && (inside === 0 || inside === S * S * S)) {
            directory[index] = inside ? FAR_IN : FAR_OUT;
            continue;
          }
          const bytes = new Int8Array(S * S * S);
          for (let n = 0; n < bytes.length; n++)
            bytes[n] = Math.round((Math.max(-band, Math.min(band, samples[n])) / band) * 127);
          directory[index] = kept.length;
          kept.push(bytes);
        }
    const data = new Int8Array(kept.length * S * S * S);
    kept.forEach((bytes, i) => data.set(bytes, i * S * S * S));
    return new ZhudaDistanceBricks(options, bricks, directory, data, band);
  }

  /** Bricks kept with distances, and all bricks. */
  get stats(): { kept: number; total: number; bytes: number; denseBytes: number } {
    const samples = this.bricks.map((n) => n * (S - 1) + 1);
    return {
      kept: this.data.length / (S * S * S),
      total: this.directory.length,
      bytes: this.data.byteLength + this.directory.byteLength,
      // The same samples as a full grid of 32-bit floats, for comparison.
      denseBytes: samples[0] * samples[1] * samples[2] * 4,
    };
  }

  /** Whether a point is inside the region the bricks cover. */
  contains(x: number, y: number, z: number): boolean {
    return (
      x >= this.min[0] &&
      y >= this.min[1] &&
      z >= this.min[2] &&
      x <= this.max[0] &&
      y <= this.max[1] &&
      z <= this.max[2]
    );
  }

  /** The distance to the surface (negative inside), within `band`; `±band` beyond it; `band` outside the region. */
  distance(x: number, y: number, z: number): number {
    if (!this.contains(x, y, z)) return this.band;
    const h = this.cellSize;
    const fx = (x - this.min[0]) / h,
      fy = (y - this.min[1]) / h,
      fz = (z - this.min[2]) / h;
    const [nx, ny, nz] = this.bricks;
    const bx = Math.min(Math.floor(fx / (S - 1)), nx - 1),
      by = Math.min(Math.floor(fy / (S - 1)), ny - 1),
      bz = Math.min(Math.floor(fz / (S - 1)), nz - 1);
    const slot = this.directory[bx + by * nx + bz * nx * ny];
    if (slot === FAR_OUT) return this.band;
    if (slot === FAR_IN) return -this.band;
    const lx = Math.min(fx - bx * (S - 1), S - 1),
      ly = Math.min(fy - by * (S - 1), S - 1),
      lz = Math.min(fz - bz * (S - 1), S - 1);
    const i = Math.min(Math.floor(lx), S - 2),
      j = Math.min(Math.floor(ly), S - 2),
      k = Math.min(Math.floor(lz), S - 2);
    const tx = lx - i,
      ty = ly - j,
      tz = lz - k;
    const base = slot * S * S * S;
    const d = this.data;
    const at = (a: number, b: number, c: number) => d[base + a + b * S + c * S * S];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c00 = lerp(at(i, j, k), at(i + 1, j, k), tx),
      c10 = lerp(at(i, j + 1, k), at(i + 1, j + 1, k), tx),
      c01 = lerp(at(i, j, k + 1), at(i + 1, j, k + 1), tx),
      c11 = lerp(at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1), tx);
    return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz) * this.scale;
  }

  /** Out of the surface at a point: the slope of the kept distance, unit length (up where it is flat). */
  normal(x: number, y: number, z: number): V3 {
    const e = this.cellSize * 0.5;
    const g: V3 = [
      this.distance(x + e, y, z) - this.distance(x - e, y, z),
      this.distance(x, y + e, z) - this.distance(x, y - e, z),
      this.distance(x, y, z + e) - this.distance(x, y, z - e),
    ];
    const length = Math.hypot(...g);
    return length > 1e-12 ? [g[0] / length, g[1] / length, g[2] / length] : [0, 1, 0];
  }

  /**
   * Where a ray from `origin` along `direction` (any length; it is made unit)
   * first meets the surface, within `maxDistance`; null if it does not. A
   * ray that starts inside meets it at 0.
   */
  raycast(origin: V3, direction: V3, maxDistance = Infinity): ZhudaBrickHit | null {
    return this.march(origin, direction, maxDistance, 0);
  }

  /**
   * Where a sphere of `radius` moving from `from` to `to` first touches the
   * surface: its centre then, the distance travelled, the normal at the
   * nearest surface point. Null if it reaches `to` untouched; distance 0
   * when it already touches at `from`. `radius` must be below `band`.
   */
  sweepSphere(from: V3, to: V3, radius: number): ZhudaBrickHit | null {
    if (!(finite(radius) && radius >= 0 && radius < this.band))
      throw Error(`Distance bricks: a sweep radius from 0 to below band (${this.band})`);
    const delta: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const length = Math.hypot(...delta);
    if (length < 1e-12) {
      const d = this.distance(...from);
      return d <= radius
        ? { distance: 0, position: [...from] as V3, normal: this.normal(...from) }
        : null;
    }
    return this.march(from, delta, length, radius);
  }

  private march(
    origin: V3,
    direction: V3,
    maxDistance: number,
    radius: number,
  ): ZhudaBrickHit | null {
    if (!isVec(origin) || !isVec(direction)) throw Error('Distance bricks: three numbers a point');
    if (!(maxDistance >= 0)) throw Error('Distance bricks: maxDistance at least 0');
    const length = Math.hypot(...direction);
    if (!(length > 1e-12)) throw Error('Distance bricks: a direction, not zero');
    const u: V3 = [direction[0] / length, direction[1] / length, direction[2] / length];
    const at = (t: number): V3 => [
      origin[0] + u[0] * t,
      origin[1] + u[1] * t,
      origin[2] + u[2] * t,
    ];
    const gap = (t: number) => this.distance(...at(t)) - radius;
    const eps = this.cellSize * 0.01,
      least = this.cellSize * 0.25;
    // Only the part of the ray inside the region has data: where it enters and leaves.
    let enter = 0,
      leave = maxDistance;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(u[k]) < 1e-12) {
        if (origin[k] < this.min[k] || origin[k] > this.max[k]) return null;
        continue;
      }
      const a = (this.min[k] - origin[k]) / u[k],
        b = (this.max[k] - origin[k]) / u[k];
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (enter > leave) return null;
    let t = enter,
      before = enter;
    const hit = (t: number): ZhudaBrickHit => {
      const p = at(t);
      return { distance: t, position: p, normal: this.normal(...p) };
    };
    if (gap(t) <= eps) return hit(t);
    maxDistance = leave;
    for (let step = 0; step < 100000; step++) {
      const g = gap(t);
      if (g <= eps) {
        // Crossed: halve the last step until the contact is found.
        let lo = before,
          hi = t;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (gap(mid) > eps) lo = mid;
          else hi = mid;
        }
        return hi <= maxDistance ? hit(hi) : null;
      }
      if (t >= maxDistance) return null;
      before = t;
      t = Math.min(maxDistance, t + Math.max(g, least));
    }
    return null;
  }

  /**
   * A provider for `ZhudaSceneQueries`: its rays and sweeps answered by these
   * bricks, so `resolveCameraBoom` and the game's own queries see the
   * surface. The consumer registers it, and decides what a hit means.
   */
  queryProvider(entityId: string, options: { layer?: number } = {}): QueryProvider {
    const v = (p: XYZ): V3 => [p.x, p.y, p.z];
    const o = (p: V3): XYZ => ({ x: p[0], y: p[1], z: p[2] });
    const answer = (h: ZhudaBrickHit | null) =>
      h ? { position: o(h.position), normal: o(h.normal), distance: h.distance } : null;
    return {
      entityId,
      ...(options.layer === undefined ? {} : { layer: options.layer }),
      raycast: (ray: QueryRay, maxDistance: number) =>
        answer(this.raycast(v(ray.origin), v(ray.direction), maxDistance)),
      sweepSphere: (from: XYZ, to: XYZ, radius: number) =>
        answer(this.sweepSphere(v(from), v(to), radius)),
    };
  }
}
