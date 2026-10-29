import { sampleParticleCurve } from './ParticleTypes.ts';
import type { ParticleRange } from './ParticleTypes.ts';
import { rotateParticleVector3, validateParticleEffect3D } from './ParticleTypes3D.ts';
import type { ParticleEmitterSpec3D, ParticleQuaternion, ParticleState3D, ParticleTransform3D, ParticleVector3 } from './ParticleTypes3D.ts';

/** Fixed-step XYZ simulation with bounded pools, quaternion emitters and world/local space. */
export class ZhudaParticleSystem3D {
  readonly spec: ParticleEmitterSpec3D;
  readonly transform: ParticleTransform3D = { x: 0, y: 0, z: 0, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  readonly emitterVelocity: ParticleVector3 = { x: 0, y: 0, z: 0 };
  intensity = 1; emitting = false; time = 0; droppedParticles = 0; droppedSeconds = 0;
  private readonly pool: ParticleState3D[];
  private readonly active: Int32Array;
  private readonly free: Int32Array;
  private freeCount: number; private count = 0; private rng: number;
  private accumulator = 0; private remainder = 0; private distanceRemainder = 0;
  private cycle = 0; private first = true; private positioned = false;
  private previous: ParticleVector3 = { x: 0, y: 0, z: 0 };
  private scratch: ParticleVector3 = { x: 0, y: 0, z: 0 };
  private readonly direction: ParticleVector3;
  private readonly basisU: ParticleVector3;
  private readonly basisV: ParticleVector3;
  static readonly STEP = 1 / 120;
  constructor(spec: ParticleEmitterSpec3D) {
    const issues = validateParticleEffect3D({ schemaVersion: 1, dimension: 3, emitters: [spec] });
    if (issues.length) throw new Error(`[ZhudaParticles3D] ${issues.join(' | ')}`);
    this.spec = JSON.parse(JSON.stringify(spec)); this.rng = spec.seed >>> 0;
    this.active = new Int32Array(spec.maxParticles); this.free = new Int32Array(spec.maxParticles); this.freeCount = spec.maxParticles;
    this.pool = Array.from({ length: spec.maxParticles }, (_, i) => {
      this.free[i] = spec.maxParticles - 1 - i;
      return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1, baseSize: 1, size: 1, rotation: 0, angularVelocity: 0, phase: 0 };
    });
    const d = spec.direction, n = Math.hypot(d.x, d.y, d.z);
    this.direction = { x: d.x / n, y: d.y / n, z: d.z / n };
    const axis = Math.abs(this.direction.y) < .9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const x = axis.y * this.direction.z - axis.z * this.direction.y, y = axis.z * this.direction.x - axis.x * this.direction.z,
      z = axis.x * this.direction.y - axis.y * this.direction.x, length = Math.hypot(x, y, z);
    this.basisU = { x: x / length, y: y / length, z: z / length };
    this.basisV = { x: this.direction.y * this.basisU.z - this.direction.z * this.basisU.y,
      y: this.direction.z * this.basisU.x - this.direction.x * this.basisU.z,
      z: this.direction.x * this.basisU.y - this.direction.y * this.basisU.x };
  }
  get aliveCount(): number { return this.count; }
  get capacity(): number { return this.pool.length; }
  setTransform(x: number, y: number, z: number, rotation?: ParticleQuaternion, velocity?: ParticleVector3): void {
    if (![x, y, z].every(Number.isFinite)) throw new Error('3D emitter position must be finite.');
    if (rotation && (![rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite)
      || Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) < 1e-8)) throw new Error('Invalid emitter quaternion.');
    if (velocity && ![velocity.x, velocity.y, velocity.z].every(Number.isFinite)) throw new Error('Invalid emitter velocity.');
    Object.assign(this.transform, { x, y, z });
    if (rotation) { const n = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
      Object.assign(this.transform.rotation, { x: rotation.x / n, y: rotation.y / n, z: rotation.z / n, w: rotation.w / n }); }
    if (velocity) Object.assign(this.emitterVelocity, velocity);
    if (!this.positioned) { Object.assign(this.previous, { x, y, z }); this.positioned = true; }
  }
  play(restart = false): void { if (restart) this.clear(); if (!this.emitting) { this.cycle = 0; this.first = true; } this.emitting = true; }
  stop(clear = false): void { this.emitting = false; if (clear) this.clear(); }
  clear(): void {
    this.count = 0; this.freeCount = this.capacity;
    for (let i = 0; i < this.capacity; i++) this.free[i] = this.capacity - 1 - i;
    this.rng = this.spec.seed >>> 0; this.time = this.cycle = this.accumulator = this.remainder = this.distanceRemainder = 0;
    this.first = true; this.droppedParticles = this.droppedSeconds = 0;
    Object.assign(this.previous, { x: this.transform.x, y: this.transform.y, z: this.transform.z });
  }
  burst(count: number, x = this.transform.x, y = this.transform.y, z = this.transform.z): void {
    if (!Number.isInteger(count) || count < 0 || ![x, y, z].every(Number.isFinite)) throw new Error('Invalid 3D burst.');
    const accepted = Math.min(count, this.freeCount); this.droppedParticles += count - accepted;
    for (let i = 0; i < accepted; i++) this.spawn(x, y, z);
  }
  forEach(visitor: (particle: ParticleState3D, index: number) => void): void { for (let i = 0; i < this.count; i++) visitor(this.pool[this.active[i]], i); }
  snapshot(): ParticleState3D[] { const result: ParticleState3D[] = []; this.forEach(p => result.push({ ...p })); return result; }
  update(delta: number): void {
    if (!Number.isFinite(delta) || delta < 0) throw new Error('Invalid 3D particle delta.');
    const accepted = Math.min(delta, .25); this.droppedSeconds += delta - accepted; this.accumulator += accepted;
    const steps = Math.floor((this.accumulator + 1e-10) / ZhudaParticleSystem3D.STEP);
    const sx = this.previous.x, sy = this.previous.y, sz = this.previous.z;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const x = sx + (this.transform.x - sx) * t, y = sy + (this.transform.y - sy) * t, z = sz + (this.transform.z - sz) * t;
      this.step(ZhudaParticleSystem3D.STEP, x, y, z); Object.assign(this.previous, { x, y, z });
    }
    this.accumulator = Math.max(0, this.accumulator - steps * ZhudaParticleSystem3D.STEP);
  }
  private random(): number { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }
  private range(v: ParticleRange | undefined, fallback = 0): number { return v === undefined ? fallback : typeof v === 'number' ? v : v[0] + this.random() * (v[1] - v[0]); }
  private spawn(x: number, y: number, z: number): void {
    const s = this.spec, slot = this.free[--this.freeCount], p = this.pool[slot], v = this.scratch;
    v.x = v.y = v.z = 0;
    if (s.shape.type === 'box') { v.x = (this.random() - .5) * s.shape.width; v.y = (this.random() - .5) * s.shape.height; v.z = (this.random() - .5) * s.shape.depth; }
    else if (s.shape.type === 'sphere') {
      const h = this.random() * 2 - 1, a = this.random() * Math.PI * 2, r = s.shape.radius * (s.shape.surface ? 1 : Math.cbrt(this.random()));
      v.x = Math.sqrt(1 - h * h) * Math.cos(a) * r; v.y = h * r; v.z = Math.sqrt(1 - h * h) * Math.sin(a) * r;
    }
    if (s.space === 'world') rotateParticleVector3(v, this.transform.rotation, v);
    p.x = v.x + (s.space === 'world' ? x : 0); p.y = v.y + (s.space === 'world' ? y : 0); p.z = v.z + (s.space === 'world' ? z : 0);
    const a = this.random() * Math.PI * 2, cos = 1 - this.random() * (1 - Math.cos(s.spread)), sin = Math.sqrt(1 - cos * cos), speed = this.range(s.speed);
    v.x = (this.direction.x * cos + sin * (this.basisU.x * Math.cos(a) + this.basisV.x * Math.sin(a))) * speed;
    v.y = (this.direction.y * cos + sin * (this.basisU.y * Math.cos(a) + this.basisV.y * Math.sin(a))) * speed;
    v.z = (this.direction.z * cos + sin * (this.basisU.z * Math.cos(a) + this.basisV.z * Math.sin(a))) * speed;
    if (s.space === 'world') rotateParticleVector3(v, this.transform.rotation, v);
    const inherit = s.space === 'world' ? s.velocityInheritance || 0 : 0;
    p.vx = v.x + this.emitterVelocity.x * inherit; p.vy = v.y + this.emitterVelocity.y * inherit; p.vz = v.z + this.emitterVelocity.z * inherit;
    p.age = 0; p.lifetime = this.range(s.lifetime); p.baseSize = this.range(s.size); p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, 0);
    p.rotation = this.range(s.rotation); p.angularVelocity = this.range(s.angularVelocity); p.phase = this.random() * Math.PI * 2;
    this.active[this.count++] = slot;
  }
  private step(dt: number, x: number, y: number, z: number): void {
    const s = this.spec, damp = Math.exp(-(s.drag || 0) * dt);
    for (let i = this.count - 1; i >= 0; i--) {
      const slot = this.active[i], p = this.pool[slot]; p.age += dt;
      if (p.age + 1e-10 >= p.lifetime) { this.free[this.freeCount++] = slot; this.active[i] = this.active[--this.count]; continue; }
      const t = p.age * (s.turbulence?.frequency || 0), force = s.turbulence?.strength || 0;
      p.vx = (p.vx + ((s.acceleration?.x || 0) + Math.sin(t + p.phase) * force) * dt) * damp;
      p.vy = (p.vy + ((s.acceleration?.y || 0) + Math.cos(t * .83 + p.phase) * force) * dt) * damp;
      p.vz = (p.vz + ((s.acceleration?.z || 0) + Math.sin(t * .71 + p.phase) * force) * dt) * damp;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rotation += p.angularVelocity * dt;
      p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, p.age / p.lifetime);
    }
    let remaining = dt, elapsed = 0;
    const strength = Math.max(0, Math.min(2, Number.isFinite(this.intensity) ? this.intensity : 0)), duration = s.duration || Infinity;
    while (remaining > 1e-10 && this.emitting) {
      const span = Math.min(remaining, duration - this.cycle), end = this.cycle + span;
      const start = elapsed / dt; elapsed += span; const fraction = elapsed / dt;
      const ex = this.previous.x + (x - this.previous.x) * fraction, ey = this.previous.y + (y - this.previous.y) * fraction, ez = this.previous.z + (z - this.previous.z) * fraction;
      for (const b of s.bursts || []) if ((b.time > this.cycle + 1e-10 || (this.first && b.time === 0)) && b.time <= end + 1e-10) this.burst(Math.round(b.count * strength), ex, ey, ez);
      this.remainder += s.rate * strength * span;
      const count = Math.floor(this.remainder + 1e-10); this.remainder = Math.max(0, this.remainder - count); this.burst(count, ex, ey, ez);
      const dx = (x - this.previous.x) * (fraction - start), dy = (y - this.previous.y) * (fraction - start), dz = (z - this.previous.z) * (fraction - start);
      this.distanceRemainder += Math.hypot(dx, dy, dz) * (s.rateOverDistance || 0) * strength;
      const distanceCount = Math.floor(this.distanceRemainder + 1e-10), accepted = Math.min(distanceCount, this.freeCount);
      this.distanceRemainder = Math.max(0, this.distanceRemainder - distanceCount); this.droppedParticles += distanceCount - accepted;
      for (let i = 0; i < accepted; i++) this.spawn(ex - dx + dx * (i + 1) / distanceCount, ey - dy + dy * (i + 1) / distanceCount, ez - dz + dz * (i + 1) / distanceCount);
      this.first = false; this.cycle = end; remaining -= span;
      if (this.cycle + 1e-10 >= duration) { if (s.loop) { this.cycle = 0; this.first = true; } else this.emitting = false; }
    }
    this.time += dt;
  }
}
