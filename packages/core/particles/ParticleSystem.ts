import { resolveParticleCollision } from './ParticleExtras.ts';
import type { ParticleEvent } from './ParticleExtras.ts';
import { sampleParticleCurve, validateParticleEffect } from './ParticleTypes.ts';
import type { ParticleEmitterSpec, ParticleRange, ParticleState, ParticleTransform } from './ParticleTypes.ts';

/** Fixed-step CPU simulation, preallocated pool, seeded replay, bounded catch-up. */
export class ZhudaParticleSystem {
  public readonly spec: ParticleEmitterSpec;
  public readonly transform: ParticleTransform = { x: 0, y: 0, rotation: 0 };
  public intensity = 1;
  public emitting = false;
  public time = 0;
  public droppedParticles = 0;
  public droppedSeconds = 0;
  /** Future births respect this cap; existing particles drain naturally. */
  private limit = Infinity;
  get particleLimit(): number { return this.limit; }
  set particleLimit(value: number) { if (value !== Infinity && (!Number.isInteger(value) || value < 0)) throw new Error('Particle limit must be a non-negative integer.'); this.limit = value; }
  onEvent?: (event: ParticleEvent) => void;
  droppedEvents = 0;
  private events: ParticleEvent[] = [];
  private queueEvent(type: 'collision' | 'death', p: any, plane = -1): void {
    if (!this.onEvent) return;
    if (this.events.length >= this.capacity * 2) { this.droppedEvents++; return; }
    this.events.push({type,x:p.x,y:p.y,z:p.z||0,vx:p.vx,vy:p.vy,vz:p.vz||0,age:p.age,plane});
  }
  private flushEvents(): void { if (!this.events.length) return; const events = this.events; this.events = []; for (const e of events) this.onEvent?.(e); }
  private readonly pool: ParticleState[];
  private readonly active: Int32Array;
  private readonly free: Int32Array;
  private freeCount: number;
  private count = 0;
  private rng: number;
  private accumulator = 0;
  private emitRemainder = 0;
  private distanceRemainder = 0;
  private cycleTime = 0;
  private firstStep = true;
  private previousX = 0;
  private previousY = 0;
  private positioned = false;
  public static readonly STEP = 1 / 120;

  constructor(spec: ParticleEmitterSpec) {
    const issues = validateParticleEffect({ schemaVersion: 1, emitters: [spec] });
    if (issues.length) throw new Error(`[ZhudaParticles] ${issues.join(' | ')}`);
    this.spec = JSON.parse(JSON.stringify(spec));
    this.rng = spec.seed >>> 0;
    this.active = new Int32Array(spec.maxParticles);
    this.free = new Int32Array(spec.maxParticles);
    this.freeCount = spec.maxParticles;
    this.pool = Array.from({ length: spec.maxParticles }, (_, i) => {
      this.free[i] = spec.maxParticles - 1 - i;
      return { x: 0, y: 0, vx: 0, vy: 0, age: 0, lifetime: 1, baseSize: 1, size: 1, rotation: 0, angularVelocity: 0, phase: 0 };
    });
  }

  get aliveCount(): number { return this.count; }
  get capacity(): number { return this.pool.length; }
  setTransform(x: number, y: number, rotation = 0): void {
    if (![x, y, rotation].every(Number.isFinite)) throw new Error('Particle transform must be finite.');
    this.transform.x = x; this.transform.y = y; this.transform.rotation = rotation;
    if (!this.positioned) { this.previousX = x; this.previousY = y; this.positioned = true; }
  }
  play(restart = false): void {
    if (restart) this.clear();
    if (!this.emitting) { this.cycleTime = 0; this.firstStep = true; }
    this.emitting = true;
  }
  stop(clear = false): void { this.emitting = false; if (clear) this.clear(); }
  clear(): void {
    this.count = 0; this.freeCount = this.capacity; this.events.length = 0; this.droppedEvents = 0;
    for (let i = 0; i < this.capacity; i++) this.free[i] = this.capacity - 1 - i;
    this.rng = this.spec.seed >>> 0; this.time = 0; this.cycleTime = 0;
    this.accumulator = 0; this.emitRemainder = 0; this.distanceRemainder = 0;
    this.firstStep = true; this.droppedParticles = 0; this.droppedSeconds = 0;
    this.previousX = this.transform.x; this.previousY = this.transform.y;
  }
  burst(count: number, x = this.transform.x, y = this.transform.y): void {
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid particle burst.');
    // Cap work as well as memory when a caller requests an oversized burst.
    const accepted = Math.min(count, this.freeCount, Math.max(0, Math.floor(this.particleLimit) - this.count));
    this.droppedParticles += count - accepted;
    for (let i = 0; i < accepted; i++) this.spawn(x, y);
  }
  forEach(visitor: (particle: ParticleState, index: number) => void): void {
    for (let i = 0; i < this.count; i++) visitor(this.pool[this.active[i]], i);
  }
  snapshot(): ParticleState[] {
    const result: ParticleState[] = [];
    this.forEach(p => result.push({ ...p }));
    return result;
  }
  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('Particle delta must be finite and non-negative.');
    const accepted = Math.min(deltaSeconds, 0.25);
    this.droppedSeconds += deltaSeconds - accepted;
    this.accumulator += accepted;
    const steps = Math.floor((this.accumulator + 1e-10) / ZhudaParticleSystem.STEP);
    const startX = this.previousX, startY = this.previousY;
    for (let i = 0; i < steps; i++) {
      const x = startX + (this.transform.x - startX) * ((i + 1) / steps);
      const y = startY + (this.transform.y - startY) * ((i + 1) / steps);
      this.step(ZhudaParticleSystem.STEP, x, y);
      this.previousX = x; this.previousY = y;
    }
    this.accumulator = Math.max(0, this.accumulator - steps * ZhudaParticleSystem.STEP);
    this.flushEvents();
  }

  private random(): number {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  private range(value: ParticleRange | undefined, fallback = 0): number {
    if (value === undefined) return fallback;
    return typeof value === 'number' ? value : value[0] + this.random() * (value[1] - value[0]);
  }
  private spawn(x: number, y: number): void {
    const s = this.spec, index = this.free[--this.freeCount], p = this.pool[index];
    const shape = s.shape;
    let sx = 0, sy = 0;
    if (shape.type === 'box') { sx = (this.random() - 0.5) * shape.width; sy = (this.random() - 0.5) * shape.height; }
    else if (shape.type === 'circle') {
      const a = this.random() * Math.PI * 2, r = shape.radius * (shape.edge ? 1 : Math.sqrt(this.random()));
      sx = Math.cos(a) * r; sy = Math.sin(a) * r;
    }
    const angle = this.range(s.angle) + (s.space === 'world' ? this.transform.rotation : 0);
    const speed = this.range(s.speed), c = Math.cos(this.transform.rotation), sn = Math.sin(this.transform.rotation);
    p.x = s.space === 'world' ? x + sx * c - sy * sn : sx;
    p.y = s.space === 'world' ? y + sx * sn + sy * c : sy;
    p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
    p.age = 0; p.lifetime = this.range(s.lifetime); p.baseSize = this.range(s.size);
    p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, 0);
    p.rotation = this.range(s.rotation) + (s.space === 'world' ? this.transform.rotation : 0);
    p.angularVelocity = this.range(s.angularVelocity); p.phase = this.random() * Math.PI * 2;
    this.active[this.count++] = index;
  }
  private step(dt: number, x: number, y: number): void {
    const s = this.spec;
    for (let i = this.count - 1; i >= 0; i--) {
      const index = this.active[i], p = this.pool[index];
      p.age += dt;
      if (p.age + 1e-10 >= p.lifetime) {
        this.queueEvent('death', p); this.free[this.freeCount++] = index; this.active[i] = this.active[--this.count]; continue;
      }
      let ax = s.acceleration?.x || 0, ay = s.acceleration?.y || 0;
      if (s.turbulence) {
        const t = p.age * s.turbulence.frequency;
        ax += Math.sin(t + p.phase) * s.turbulence.strength;
        ay += Math.cos(t * 0.83 + p.phase) * s.turbulence.strength;
      }
      const damping = Math.exp(-(s.drag || 0) * dt);
      p.vx = (p.vx + ax * dt) * damping; p.vy = (p.vy + ay * dt) * damping;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (s.collision && resolveParticleCollision(p, s.collision, 2, plane => this.queueEvent('collision', p, plane))) { this.queueEvent('death', p); this.free[this.freeCount++] = index; this.active[i] = this.active[--this.count]; continue; }
      p.rotation += p.angularVelocity * dt;
      p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, p.age / p.lifetime);
    }
    if (this.emitting) {
      const strength = Math.max(0, Math.min(2, Number.isFinite(this.intensity) ? this.intensity : 0));
      const duration = s.duration || Infinity;
      let remaining = dt, elapsed = 0;
      // Split at duration boundaries so non-integral loop periods never lose emission time.
      // Validated looping durations are at least one simulation tick, bounding this loop.
      while (remaining > 1e-10 && this.emitting) {
        const span = Math.min(remaining, duration - this.cycleTime);
        const end = this.cycleTime + span;
        const sx = this.previousX + (x - this.previousX) * (elapsed / dt);
        const sy = this.previousY + (y - this.previousY) * (elapsed / dt);
        elapsed += span;
        const ex = this.previousX + (x - this.previousX) * (elapsed / dt);
        const ey = this.previousY + (y - this.previousY) * (elapsed / dt);
        for (const b of s.bursts || []) {
          if ((b.time > this.cycleTime + 1e-10 || (this.firstStep && b.time === 0)) && b.time <= end + 1e-10) {
            this.burst(Math.round(b.count * strength), ex, ey);
          }
        }
        this.emitRemainder += s.rate * strength * span;
        const count = Math.floor(this.emitRemainder + 1e-10);
        this.emitRemainder = Math.max(0, this.emitRemainder - count); this.burst(count, ex, ey);
        this.distanceRemainder += Math.hypot(ex - sx, ey - sy) * (s.rateOverDistance || 0) * strength;
        const byDistance = Math.floor(this.distanceRemainder + 1e-10);
        this.distanceRemainder = Math.max(0, this.distanceRemainder - byDistance);
        const accepted = Math.min(byDistance, this.freeCount, Math.max(0, Math.floor(this.particleLimit) - this.count));
        this.droppedParticles += byDistance - accepted;
        for (let j = 0; j < accepted; j++) this.spawn(sx + (ex - sx) * (j + 1) / byDistance, sy + (ey - sy) * (j + 1) / byDistance);
        this.firstStep = false; this.cycleTime = end; remaining -= span;
        if (this.cycleTime + 1e-10 >= duration) {
          if (s.loop) { this.cycleTime = 0; this.firstStep = true; }
          else this.emitting = false;
        }
      }
    }
    this.time += dt;
  }
}
