import { sampleParticleCurve } from './ParticleTypes.ts';
import type { RibbonTrailSpec } from './RibbonTrail.ts';
import type { ParticleGeometry3D } from './ParticleMesh3D.ts';
import type { ParticleVector3 } from './ParticleTypes3D.ts';

/** Bounded XYZ world history; camera-facing ribbon with stable normals. */
export class ZhudaRibbonTrail3D {
  readonly spec: RibbonTrailSpec;
  private readonly points: Array<{ x: number; y: number; z: number; born: number }>;
  private readonly geometry: ParticleGeometry3D;
  private head = 0; private count = 0; private time = 0;
  constructor(spec: RibbonTrailSpec) {
    if (!Number.isInteger(spec.maxPoints) || spec.maxPoints < 2 || spec.maxPoints > 32767
      || ![spec.lifetime, spec.width, spec.minDistance, spec.teleportDistance].every(Number.isFinite)
      || spec.lifetime <= 0 || spec.width <= 0 || spec.minDistance <= 0 || spec.teleportDistance <= spec.minDistance
      || spec.widthOverLife?.some((k, i, a) => !k || !Number.isFinite(k.time) || !Number.isFinite(k.value)
        || k.time < 0 || k.time > 1 || k.value < 0 || (i > 0 && k.time <= a[i - 1].time))) throw new Error('Invalid 3D ribbon specification.');
    this.spec = JSON.parse(JSON.stringify(spec));
    this.points = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, z: 0, born: 0 }));
    this.geometry = { vertices: new Float32Array(spec.maxPoints * 18), indices: new Uint16Array((spec.maxPoints - 1) * 6), vertexCount: 0, indexCount: 0 };
    for (let i = 0; i < spec.maxPoints - 1; i++) { const v = i * 2; this.geometry.indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6); }
  }
  get pointCount(): number { return this.count; }
  clear(): void { this.head = this.count = this.time = 0; this.geometry.vertexCount = this.geometry.indexCount = 0; }
  update(dt: number, x: number, y: number, z: number, emitting = true): void {
    if (![dt, x, y, z].every(Number.isFinite) || dt < 0) throw new Error('3D ribbon delta and positions must be finite.');
    this.time += dt;
    while (this.count && this.time - this.at(0).born >= this.spec.lifetime) { this.head = (this.head + 1) % this.points.length; this.count--; }
    if (!emitting) return;
    if (this.count) {
      const p = this.at(this.count - 1), distance = Math.hypot(x - p.x, y - p.y, z - p.z);
      if (distance > this.spec.teleportDistance) this.head = this.count = 0;
      else if (distance < this.spec.minDistance) return;
    }
    if (this.count === this.points.length) { this.head = (this.head + 1) % this.points.length; this.count--; }
    Object.assign(this.at(this.count++), { x, y, z, born: this.time });
  }
  buildMesh(cameraPosition: ParticleVector3, opacity = 1): ParticleGeometry3D {
    const g = this.geometry; g.vertices.fill(0); g.indices.fill(0); let px = 0, py = 0, pz = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.at(i), a = this.at(Math.max(0, i - 1)), b = this.at(Math.min(this.count - 1, i + 1));
      const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
      const vx = cameraPosition.x - p.x, vy = cameraPosition.y - p.y, vz = cameraPosition.z - p.z;
      let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx, n = Math.hypot(nx, ny, nz);
      if (n < 1e-7) { nx = -tz; ny = 0; nz = tx; n = Math.hypot(nx, ny, nz); }
      if (n < 1e-7) { nx = 1; ny = 0; nz = 0; n = 1; }
      nx /= n; ny /= n; nz /= n;
      if (nx * px + ny * py + nz * pz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      px = nx; py = ny; pz = nz;
      const life = Math.max(0, Math.min(1, (this.time - p.born) / this.spec.lifetime));
      const width = this.spec.width * .5 * sampleParticleCurve(this.spec.widthOverLife, life, 1 - life), alpha = (1 - life) * Math.max(0, Math.min(1, opacity));
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1, base = i * 18 + side * 9, v = g.vertices;
        v[base] = p.x + sign * nx * width; v[base + 1] = p.y + sign * ny * width; v[base + 2] = p.z + sign * nz * width;
        v[base + 3] = 1; v[base + 4] = 1; v[base + 5] = 1; v[base + 6] = alpha;
        v[base + 7] = life; v[base + 8] = side;
      }
      if (i < this.count - 1) {
        const v = i * 2, offset = i * 6, indices = g.indices;
        indices[offset] = v; indices[offset + 1] = v + 1; indices[offset + 2] = v + 2;
        indices[offset + 3] = v + 1; indices[offset + 4] = v + 3; indices[offset + 5] = v + 2;
      }
    }
    g.vertexCount = this.count * 2; g.indexCount = Math.max(0, this.count - 1) * 6; return g;
  }
  snapshot(): Array<ParticleVector3 & { age: number }> { return Array.from({ length: this.count }, (_, i) => { const p = this.at(i); return { x: p.x, y: p.y, z: p.z, age: this.time - p.born }; }); }
  private at(i: number) { return this.points[(this.head + i) % this.points.length]; }
}
