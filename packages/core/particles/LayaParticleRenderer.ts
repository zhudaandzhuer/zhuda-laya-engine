import { sampleParticleColor, sampleParticleCurve } from './ParticleTypes.ts';
import type { ParticleState } from './ParticleTypes.ts';
import type { ZhudaParticleSystem } from './ParticleSystem.ts';
import type { ZhudaRibbonTrail } from './RibbonTrail.ts';

export type ParticleTextureResolver = (key: string) => any;
interface QuadBatch { vertices: Float32Array; uvs: Float32Array; indices: Uint16Array; count: number; color: string; alpha: number; }

/** Laya WebGL textured quads, batched by lifetime band. No display object per particle. */
export class ZhudaLayaParticleRenderer {
  public readonly node: any;
  public submittedBatches = 0;
  private readonly batches: QuadBatch[];
  private texture: any;
  public readonly system: ZhudaParticleSystem;
  private readonly uv: ArrayLike<number>;
  private readonly appendParticle = (p: ParticleState) => {
    const s = this.system.spec, t = Math.min(0.999999, p.age / p.lifetime);
    const batch = this.batches[Math.floor(t * this.batches.length)];
    const i = batch.count++ * 8;
    let x = p.x, y = p.y;
    let angle = s.alignToVelocity ? Math.atan2(p.vy, p.vx) : p.rotation;
    if (s.space === 'local') {
      const c = Math.cos(this.system.transform.rotation), sn = Math.sin(this.system.transform.rotation);
      x = this.system.transform.x + p.x * c - p.y * sn;
      y = this.system.transform.y + p.x * sn + p.y * c;
      angle += this.system.transform.rotation;
    }
    const c = Math.cos(angle), sn = Math.sin(angle), hx = p.size * (s.stretch || 1) * 0.5, hy = p.size * 0.5;
    batch.vertices[i] = x - c * hx + sn * hy; batch.vertices[i + 1] = y - sn * hx - c * hy;
    batch.vertices[i + 2] = x + c * hx + sn * hy; batch.vertices[i + 3] = y + sn * hx - c * hy;
    batch.vertices[i + 4] = x + c * hx - sn * hy; batch.vertices[i + 5] = y + sn * hx + c * hy;
    batch.vertices[i + 6] = x - c * hx - sn * hy; batch.vertices[i + 7] = y - sn * hx + c * hy;
  };
  constructor(system: ZhudaParticleSystem, parent: any, resolveTexture: ParticleTextureResolver, lifeBands = 12) {
    this.system = system;
    if (!Number.isInteger(lifeBands) || lifeBands < 1 || lifeBands > 64) throw new Error('lifeBands must be 1..64.');
    const laya = (globalThis as any).Laya;
    if (!laya?.Sprite) throw new Error('[ZhudaParticles] Laya must be booted before creating a renderer.');
    this.texture = resolveTexture(system.spec.texture);
    if (!this.texture) throw new Error(`[ZhudaParticles] Missing texture: ${system.spec.texture}`);
    this.uv = this.texture.uv || [0, 0, 1, 0, 1, 1, 0, 1];
    this.node = new laya.Sprite(); this.node.name = `Particles:${system.spec.id}`;
    this.node.mouseEnabled = false;
    parent.addChild(this.node);
    this.batches = Array.from({ length: lifeBands }, (_, band) => {
      const capacity = system.capacity;
      const batch: QuadBatch = { vertices: new Float32Array(capacity * 8), uvs: new Float32Array(capacity * 8),
        indices: new Uint16Array(capacity * 6), count: 0,
        color: sampleParticleColor(system.spec.colorOverLife, (band + 0.5) / lifeBands),
        alpha: sampleParticleCurve(system.spec.alphaOverLife, (band + 0.5) / lifeBands) };
      for (let i = 0; i < capacity; i++) {
        batch.uvs.set(this.uv, i * 8);
        const v = i * 4;
        batch.indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
      }
      return batch;
    });
  }
  render(opacity = 1): void {
    if (this.node.destroyed) return;
    const g = this.node.graphics;
    g.clear(); this.submittedBatches = 0;
    for (const batch of this.batches) batch.count = 0;
    if (opacity <= 0) return;
    this.system.forEach(this.appendParticle);
    for (const b of this.batches) {
      if (!b.count || b.alpha <= 0) continue;
      g.drawTriangles(this.texture, 0, 0, b.vertices.subarray(0, b.count * 8), b.uvs.subarray(0, b.count * 8),
        b.indices.subarray(0, b.count * 6), null, Math.min(1, b.alpha * opacity), b.color,
        this.system.spec.blend === 'additive' ? 'lighter' : 'normal');
      this.submittedBatches++;
    }
  }
  dispose(): void { this.node.destroy(true); this.texture = null; }
}

/** Ribbon textures must have age along U and width along V, with transparent edges. */
export class ZhudaLayaRibbonRenderer {
  public readonly node: any;
  public submittedBatches = 0;
  public readonly trail: ZhudaRibbonTrail;
  private texture: any;
  public color: string;
  public blend: 'additive' | 'alpha';
  constructor(trail: ZhudaRibbonTrail, parent: any, texture: any,
    color = '#ffffff', blend: 'additive' | 'alpha' = 'additive') {
    this.trail = trail; this.texture = texture; this.color = color; this.blend = blend;
    const laya = (globalThis as any).Laya;
    if (!laya?.Sprite || !texture) throw new Error('Ribbon renderer requires Laya and a texture.');
    this.node = new laya.Sprite(); this.node.name = 'RibbonTrail'; this.node.mouseEnabled = false; parent.addChild(this.node);
  }
  render(opacity = 1): void {
    if (this.node.destroyed) return;
    this.node.graphics.clear(); this.submittedBatches = 0;
    const mesh = this.trail.buildMesh();
    if (mesh.indexCount === 0 || opacity <= 0) return;
    this.node.graphics.drawTriangles(this.texture, 0, 0, mesh.vertices.subarray(0, mesh.pointCount * 4),
      mesh.uvs.subarray(0, mesh.pointCount * 4), mesh.indices.subarray(0, mesh.indexCount), null,
      Math.min(1, opacity), this.color, this.blend === 'additive' ? 'lighter' : 'normal');
    this.submittedBatches = 1;
  }
  dispose(): void { this.node.destroy(true); this.texture = null; }
}
