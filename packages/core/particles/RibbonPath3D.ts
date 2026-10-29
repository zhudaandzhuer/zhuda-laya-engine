import { sampleParticleColor, sampleParticleCurve } from './ParticleTypes.ts';
import type { ParticleColorKey, ParticleCurveKey } from './ParticleTypes.ts';
import type { ParticleGeometry3D } from './ParticleMesh3D.ts';
import type { ParticleVector3 } from './ParticleTypes3D.ts';

export interface RibbonPathSpec3D {
  maxPoints: number; width: number;
  widthOverPath?: ParticleCurveKey[];
  alphaOverPath?: ParticleCurveKey[];
  colorOverPath?: ParticleColorKey[];
}

/** Authored XYZ flow paths. Geometry follows supplied world points, with a fade at either end. */
export class ZhudaRibbonPath3D {
  readonly spec: RibbonPathSpec3D;
  private readonly points: ParticleVector3[];
  private readonly widthDirections: ParticleVector3[];
  private hasWidthDirections = false;
  private readonly distances: Float32Array;
  private readonly geometry: ParticleGeometry3D;
  private count = 0;
  uvOffset = 0;
  uvTiles = 1;
  visibleStart = 0;
  visibleEnd = 1;
  edgeFade = .08;
  constructor(spec: RibbonPathSpec3D) {
    if (!Number.isInteger(spec.maxPoints) || spec.maxPoints < 2 || spec.maxPoints > 32767 || !Number.isFinite(spec.width) || spec.width <= 0) throw new Error('Invalid 3D ribbon path budget or width.');
    for (const keys of [spec.widthOverPath, spec.alphaOverPath]) if (keys && (!keys.length || keys.some((k, i, a) => !k || ![k.time, k.value].every(Number.isFinite)
      || k.time < 0 || k.time > 1 || k.value < 0 || (i > 0 && k.time <= a[i - 1].time)))) throw new Error('Invalid path curve.');
    if (spec.colorOverPath && (!spec.colorOverPath.length || spec.colorOverPath.some((k, i, a) => !k || !Number.isFinite(k.time)
      || k.time < 0 || k.time > 1 || !/^#[0-9a-f]{6}$/i.test(k.color) || (i > 0 && k.time <= a[i - 1].time)))) throw new Error('Invalid path color curve.');
    this.spec = JSON.parse(JSON.stringify(spec));
    this.points = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, z: 0 }));
    this.widthDirections = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, z: 0 }));
    this.distances = new Float32Array(spec.maxPoints);
    this.geometry = { vertices: new Float32Array(spec.maxPoints * 18), indices: new Uint16Array((spec.maxPoints - 1) * 6), vertexCount: 0, indexCount: 0 };
  }
  get pointCount(): number { return this.count; }
  clear(): void { this.count = 0; }
  setPoints(points: readonly ParticleVector3[], widthDirections?: readonly ParticleVector3[]): void {
    if (points.length > this.points.length || points.some(p => !p || ![p.x, p.y, p.z].every(Number.isFinite))) throw new Error('Path points exceed budget or contain invalid XYZ positions.');
    if (widthDirections && (widthDirections.length !== points.length || widthDirections.some(v => !v || ![v.x, v.y, v.z].every(Number.isFinite) || Math.hypot(v.x, v.y, v.z) < 1e-8))) throw new Error('Width directions must match the path and contain finite non-zero vectors.');
    this.hasWidthDirections = widthDirections !== undefined;
    if (widthDirections) for (let i = 0; i < points.length; i++) Object.assign(this.widthDirections[i], widthDirections[i]);
    this.count = points.length;
    for (let i = 0; i < points.length; i++) Object.assign(this.points[i], points[i]);
  }
  snapshot(): ParticleVector3[] { return this.points.slice(0, this.count).map(p => ({ ...p })); }
  buildMesh(camera: ParticleVector3, opacity = 1): ParticleGeometry3D {
    const g = this.geometry; g.vertices.fill(0); g.indices.fill(0);
    if (![this.uvOffset, this.uvTiles, opacity, this.visibleStart, this.visibleEnd, this.edgeFade].every(Number.isFinite)
      || this.visibleStart < 0 || this.visibleEnd > 1 || this.visibleStart > this.visibleEnd || this.edgeFade <= 0) throw new Error('Invalid flow UV/opacity/reveal window.');
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      if (i) { const a = this.points[i - 1], b = this.points[i]; total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
      this.distances[i] = total;
    }
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.points[i], a = this.points[Math.max(0, i - 1)], b = this.points[Math.min(this.count - 1, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, vx = camera.x - p.x, vy = camera.y - p.y, vz = camera.z - p.z;
      let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx, length = Math.hypot(nx, ny, nz);
      if (this.hasWidthDirections) {
        const d = this.widthDirections[i], tt = tx * tx + ty * ty + tz * tz;
        const projection = tt > 1e-14 ? (d.x * tx + d.y * ty + d.z * tz) / tt : 0;
        nx = d.x - projection * tx; ny = d.y - projection * ty; nz = d.z - projection * tz; length = Math.hypot(nx, ny, nz);
      }
      if (length < 1e-7) { nx = -tz; ny = 0; nz = tx; length = Math.hypot(nx, ny, nz); }
      if (length < 1e-7) { nx = 1; ny = 0; nz = 0; length = 1; }
      nx /= length; ny /= length; nz /= length;
      if (nx * px + ny * py + nz * pz < 0) { nx = -nx; ny = -ny; nz = -nz; } px = nx; py = ny; pz = nz;
      const t = total > 1e-7 ? this.distances[i] / total : 0;
      const width = this.spec.width * .5 * sampleParticleCurve(this.spec.widthOverPath, t);
      const mask = smooth((t - this.visibleStart) / this.edgeFade) * smooth((this.visibleEnd - t) / this.edgeFade);
      const alpha = Math.max(0, Math.min(1, opacity * sampleParticleCurve(this.spec.alphaOverPath, t))) * mask;
      const color = sampleParticleColor(this.spec.colorOverPath, t), r = parseInt(color.slice(1, 3), 16) / 255,
        green = parseInt(color.slice(3, 5), 16) / 255, blue = parseInt(color.slice(5, 7), 16) / 255;
      const u = t * this.uvTiles + this.uvOffset;
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1, base = i * 18 + side * 9, v = g.vertices;
        v[base] = p.x + sign * nx * width; v[base + 1] = p.y + sign * ny * width; v[base + 2] = p.z + sign * nz * width;
        v[base + 3] = r; v[base + 4] = green; v[base + 5] = blue; v[base + 6] = alpha;
        v[base + 7] = u; v[base + 8] = side;
      }
      if (i < this.count - 1) {
        const v = i * 2, offset = i * 6, indices = g.indices;
        indices[offset] = v; indices[offset + 1] = v + 1; indices[offset + 2] = v + 2;
        indices[offset + 3] = v + 1; indices[offset + 4] = v + 3; indices[offset + 5] = v + 2;
      }
    }
    g.vertexCount = this.count * 2; g.indexCount = Math.max(0, this.count - 1) * 6; return g;
  }
}

function smooth(v: number): number { const f = Math.max(0, Math.min(1, v)); return f * f * (3 - 2 * f); }
