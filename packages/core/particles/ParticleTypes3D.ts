import { validateParticleEffect } from './ParticleTypes.ts';
import type { ParticleEmitterSpec, ParticleState } from './ParticleTypes.ts';

export interface ParticleVector3 { x: number; y: number; z: number; }
export interface ParticleQuaternion { x: number; y: number; z: number; w: number; }
export interface ParticleTransform3D extends ParticleVector3 { rotation: ParticleQuaternion; }
export interface ParticleView3D {
  position: ParticleVector3; right: ParticleVector3; up: ParticleVector3; forward: ParticleVector3;
}
export interface ParticleState3D extends ParticleState { z: number; vz: number; }
export type ParticleShape3D = { type: 'point' } | { type: 'box'; width: number; height: number; depth: number }
  | { type: 'sphere'; radius: number; surface?: boolean };
export interface ParticleEmitterSpec3D extends Omit<ParticleEmitterSpec, 'shape' | 'angle' | 'acceleration'> {
  shape: ParticleShape3D;
  direction: ParticleVector3;
  /** Half-angle in radians. Directions are sampled uniformly within this cone. */
  spread: number;
  acceleration?: ParticleVector3;
  velocityInheritance?: number;
  billboard?: 'camera' | 'velocity' | 'ground';
}
export interface ParticleEffectSpec3D { schemaVersion: 1; dimension: 3; emitters: ParticleEmitterSpec3D[]; }

export function rotateParticleVector3(v: ParticleVector3, q: ParticleQuaternion, out: ParticleVector3): void {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  out.x = v.x + q.w * tx + q.y * tz - q.z * ty;
  out.y = v.y + q.w * ty + q.z * tx - q.x * tz;
  out.z = v.z + q.w * tz + q.x * ty - q.y * tx;
}

export function validateParticleEffect3D(value: unknown): string[] {
  const spec = value as ParticleEffectSpec3D;
  if (!spec || spec.dimension !== 3 || spec.schemaVersion !== 1 || !Array.isArray(spec.emitters) || !spec.emitters.length) {
    return ['Expected dimension: 3, schemaVersion: 1 and a non-empty emitters array.'];
  }
  // Reuse the shared timing, pool, range and lifetime-curve contract.
  const issues = validateParticleEffect({ schemaVersion: 1, emitters: spec.emitters.map(e => e && ({ ...e, angle: 0, shape: { type: 'point' } })) });
  const vector = (v: ParticleVector3) => v && [v.x, v.y, v.z].every(Number.isFinite);
  for (const e of spec.emitters) {
    if (!e || typeof e !== 'object') continue;
    if (!vector(e.direction) || Math.hypot(e.direction.x, e.direction.y, e.direction.z) < 1e-8) issues.push(`${e.id}: direction must be a finite non-zero vector.`);
    if (!Number.isFinite(e.spread) || e.spread < 0 || e.spread > Math.PI) issues.push(`${e.id}: spread must be 0..PI radians.`);
    if (e.acceleration && !vector(e.acceleration)) issues.push(`${e.id}: acceleration must have finite XYZ components.`);
    if (e.velocityInheritance !== undefined && (!Number.isFinite(e.velocityInheritance) || e.velocityInheritance < 0 || e.velocityInheritance > 2)) issues.push(`${e.id}: velocityInheritance must be 0..2.`);
    if (e.billboard !== undefined && !['camera', 'velocity', 'ground'].includes(e.billboard)) issues.push(`${e.id}: invalid billboard mode.`);
    const shape = e.shape;
    if (!shape || !['point', 'box', 'sphere'].includes(shape.type)) issues.push(`${e.id}: invalid 3D shape.`);
    else if (shape.type === 'box' && ![shape.width, shape.height, shape.depth].every(v => Number.isFinite(v) && v >= 0)) issues.push(`${e.id}: invalid 3D box dimensions.`);
    else if (shape.type === 'sphere' && (!Number.isFinite(shape.radius) || shape.radius < 0)) issues.push(`${e.id}: invalid sphere radius.`);
  }
  return issues;
}
