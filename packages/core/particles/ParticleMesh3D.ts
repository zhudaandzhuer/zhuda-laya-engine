import { sampleParticleUV } from './ParticleExtras.ts';
import { sampleParticleColor, sampleParticleCurve } from './ParticleTypes.ts';
import { rotateParticleVector3 } from './ParticleTypes3D.ts';
import type { ParticleState3D, ParticleVector3, ParticleView3D } from './ParticleTypes3D.ts';
import type { ZhudaParticleSystem3D } from './ParticleSystem3D.ts';

/** Interleaved POSITION(3), COLOR(4), UV(2), in scene units. */
export interface ParticleGeometry3D { vertices: Float32Array; indices: Uint16Array; vertexCount: number; indexCount: number; }

export class ZhudaParticleMesh3D {
  readonly geometry: ParticleGeometry3D;
  private readonly frameUV = {x:0,y:0,width:1,height:1};
  private readonly items: ParticleState3D[] = [];
  private readonly colors = new Float32Array(256 * 4);
  private position: ParticleVector3 = { x: 0, y: 0, z: 0 };
  private velocity: ParticleVector3 = { x: 0, y: 0, z: 0 };
  private readonly sortForward: ParticleVector3 = { x: 0, y: 0, z: 0 };
  private readonly collect = (p: ParticleState3D) => { this.items.push(p); };
  private readonly compare = (a: ParticleState3D, b: ParticleState3D) =>
    (b.x - a.x) * this.sortForward.x + (b.y - a.y) * this.sortForward.y + (b.z - a.z) * this.sortForward.z;
  readonly system: ZhudaParticleSystem3D;
  constructor(system: ZhudaParticleSystem3D) {
    this.system = system;
    this.geometry = { vertices: new Float32Array(system.capacity * 36), indices: new Uint16Array(system.capacity * 6), vertexCount: 0, indexCount: 0 };
    for (let i = 0; i < system.capacity; i++) { const v = i * 4; this.geometry.indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6); }
    for (let i = 0; i < 256; i++) {
      const color = sampleParticleColor(system.spec.colorOverLife, i / 255);
      this.colors.set([parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255, sampleParticleCurve(system.spec.alphaOverLife, i / 255)], i * 4);
    }
  }
  build(view: ParticleView3D, opacity = 1): ParticleGeometry3D {
    const s = this.system, spec = s.spec, g = this.geometry; g.vertices.fill(0);
    this.items.length = 0; s.forEach(this.collect);
    Object.assign(this.sortForward, view.forward);
    if (spec.space === 'local') {
      const q = s.transform.rotation;
      rotateParticleVector3(this.sortForward, { x: -q.x, y: -q.y, z: -q.z, w: q.w }, this.sortForward);
    }
    if (spec.blend === 'alpha') this.items.sort(this.compare);
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i], center = this.position, velocity = this.velocity;
      center.x = p.x; center.y = p.y; center.z = p.z; velocity.x = p.vx; velocity.y = p.vy; velocity.z = p.vz;
      if (spec.space === 'local') {
        rotateParticleVector3(center, s.transform.rotation, center); rotateParticleVector3(velocity, s.transform.rotation, velocity);
        center.x += s.transform.x; center.y += s.transform.y; center.z += s.transform.z;
      }
      let rx = view.right.x, ry = view.right.y, rz = view.right.z, ux = view.up.x, uy = view.up.y, uz = view.up.z;
      if (spec.billboard === 'ground') { rx = 1; ry = 0; rz = 0; ux = 0; uy = 0; uz = 1; }
      else if (spec.billboard === 'velocity') {
        const depth = velocity.x * view.forward.x + velocity.y * view.forward.y + velocity.z * view.forward.z;
        const x = velocity.x - depth * view.forward.x, y = velocity.y - depth * view.forward.y, z = velocity.z - depth * view.forward.z;
        const length = Math.hypot(x, y, z);
        if (length > 1e-6) {
          rx = x / length; ry = y / length; rz = z / length;
          ux = ry * view.forward.z - rz * view.forward.y; uy = rz * view.forward.x - rx * view.forward.z; uz = rx * view.forward.y - ry * view.forward.x;
        }
      }
      const c = Math.cos(p.rotation), sn = Math.sin(p.rotation), hx = p.size * (spec.stretch ?? 1) * .5, hy = p.size * .5;
      const ax = (rx * c + ux * sn) * hx, ay = (ry * c + uy * sn) * hx, az = (rz * c + uz * sn) * hx;
      const bx = (ux * c - rx * sn) * hy, by = (uy * c - ry * sn) * hy, bz = (uz * c - rz * sn) * hy;
      const ci = Math.min(255, Math.floor(p.age / p.lifetime * 255)) * 4;
      const r = this.colors[ci], green = this.colors[ci + 1], b = this.colors[ci + 2], alpha = this.colors[ci + 3] * Math.max(0, Math.min(1, opacity));
      const rect = sampleParticleUV(spec, p.age, p.lifetime, this.frameUV);
      for (let corner = 0; corner < 4; corner++) {
        const sx = corner === 0 || corner === 3 ? -1 : 1, sy = corner < 2 ? -1 : 1, base = i * 36 + corner * 9;
        const v = g.vertices;
        v[base] = center.x + sx * ax + sy * bx; v[base + 1] = center.y + sx * ay + sy * by; v[base + 2] = center.z + sx * az + sy * bz;
        v[base + 3] = r; v[base + 4] = green; v[base + 5] = b; v[base + 6] = alpha;
        v[base + 7] = rect.x + (sx > 0 ? rect.width : 0); v[base + 8] = rect.y + (sy > 0 ? 0 : rect.height);
      }
    }
    g.vertexCount = this.items.length * 4; g.indexCount = this.items.length * 6; return g;
  }
}
