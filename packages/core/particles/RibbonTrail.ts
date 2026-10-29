import { sampleParticleCurve } from './ParticleTypes.ts';
import type { ParticleCurveKey } from './ParticleTypes.ts';

export interface RibbonTrailSpec {
  maxPoints: number;
  lifetime: number;
  width: number;
  minDistance: number;
  teleportDistance: number;
  widthOverLife?: ParticleCurveKey[];
}
export interface RibbonMesh {
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  pointCount: number;
  indexCount: number;
}

/** World-space path history. Moving an emitter never drags its old trail. */
export class ZhudaRibbonTrail {
  public readonly spec: RibbonTrailSpec;
  private readonly points: Array<{ x: number; y: number; born: number }>;
  private head = 0;
  private count = 0;
  private time = 0;
  private readonly mesh: RibbonMesh;

  constructor(spec: RibbonTrailSpec) {
    if (!Number.isInteger(spec.maxPoints) || spec.maxPoints < 2 || spec.maxPoints > 32767
      || ![spec.lifetime, spec.width, spec.minDistance, spec.teleportDistance].every(Number.isFinite)
      || spec.lifetime <= 0 || spec.width <= 0 || spec.minDistance <= 0 || spec.teleportDistance <= spec.minDistance) {
      throw new Error('[ZhudaRibbonTrail] Invalid point budget, lifetime, width or distance limits.');
    }
    if (spec.widthOverLife?.some((k, i, a) => !Number.isFinite(k.time) || !Number.isFinite(k.value)
      || k.time < 0 || k.time > 1 || k.value < 0 || (i > 0 && k.time <= a[i - 1].time))) throw new Error('[ZhudaRibbonTrail] Invalid width curve.');
    this.spec = JSON.parse(JSON.stringify(spec));
    this.points = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, born: 0 }));
    this.mesh = { vertices: new Float32Array(spec.maxPoints * 4), uvs: new Float32Array(spec.maxPoints * 4),
      indices: new Uint16Array((spec.maxPoints - 1) * 6), pointCount: 0, indexCount: 0 };
    for (let i = 0; i < spec.maxPoints - 1; i++) {
      const v = i * 2;
      this.mesh.indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
  }
  get pointCount(): number { return this.count; }
  clear(): void { this.head = 0; this.count = 0; this.time = 0; this.mesh.pointCount = 0; this.mesh.indexCount = 0; }
  update(dt: number, x: number, y: number, emitting = true): void {
    if (![dt, x, y].every(Number.isFinite) || dt < 0) throw new Error('Trail delta and position must be finite.');
    this.time += dt;
    while (this.count > 0 && this.time - this.at(0).born >= this.spec.lifetime) {
      this.head = (this.head + 1) % this.points.length; this.count--;
    }
    if (!emitting) return;
    if (this.count) {
      const last = this.at(this.count - 1), distance = Math.hypot(x - last.x, y - last.y);
      if (distance > this.spec.teleportDistance) { this.head = 0; this.count = 0; }
      else if (distance < this.spec.minDistance) return;
    }
    if (this.count === this.points.length) { this.head = (this.head + 1) % this.points.length; this.count--; }
    const p = this.at(this.count++); p.x = x; p.y = y; p.born = this.time;
  }
  /** Reuses storage; UV.x encodes age, UV.y crosses the ribbon width. */
  buildMesh(): RibbonMesh {
    const m = this.mesh;
    m.pointCount = this.count; m.indexCount = Math.max(0, this.count - 1) * 6;
    for (let i = 0; i < this.count; i++) {
      const p = this.at(i), previous = this.at(Math.max(0, i - 1)), next = this.at(Math.min(this.count - 1, i + 1));
      let dx = next.x - previous.x, dy = next.y - previous.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) { dx = 1; dy = 0; } else { dx /= length; dy /= length; }
      const life = Math.min(1, Math.max(0, (this.time - p.born) / this.spec.lifetime));
      const half = this.spec.width * 0.5 * sampleParticleCurve(this.spec.widthOverLife, life, 1 - life);
      m.vertices.set([p.x - dy * half, p.y + dx * half, p.x + dy * half, p.y - dx * half], i * 4);
      m.uvs.set([life, 0, life, 1], i * 4);
    }
    return m;
  }
  snapshot(): Array<{ x: number; y: number; age: number }> {
    return Array.from({ length: this.count }, (_, i) => ({ x: this.at(i).x, y: this.at(i).y, age: this.time - this.at(i).born }));
  }
  private at(index: number) { return this.points[(this.head + index) % this.points.length]; }
}
