// Generated from TypeScript source; run npm run types:generate.
import type { VfxMaterialSpec } from '../effects/VfxMaterial';
import type { ParticleEmitterSpec, ParticleState } from './ParticleTypes';
export interface ParticleVector3 {
    x: number;
    y: number;
    z: number;
}
export interface ParticleQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}
export interface ParticleTransform3D extends ParticleVector3 {
    rotation: ParticleQuaternion;
}
export interface ParticleView3D {
    position: ParticleVector3;
    right: ParticleVector3;
    up: ParticleVector3;
    forward: ParticleVector3;
}
export interface ParticleState3D extends ParticleState {
    z: number;
    vz: number;
}
export type ParticleShape3D = {
    type: 'point';
} | {
    type: 'box';
    width: number;
    height: number;
    depth: number;
} | {
    type: 'sphere';
    radius: number;
    surface?: boolean;
};
export interface ParticleEmitterSpec3D extends Omit<ParticleEmitterSpec, 'shape' | 'angle' | 'acceleration'> {
    material?: VfxMaterialSpec;
    shape: ParticleShape3D;
    direction: ParticleVector3;
    /** Half-angle in radians. Directions are sampled uniformly within this cone. */
    spread: number;
    acceleration?: ParticleVector3;
    velocityInheritance?: number;
    billboard?: 'camera' | 'velocity' | 'ground';
}
export interface ParticleEffectSpec3D {
    schemaVersion: 1;
    dimension: 3;
    emitters: ParticleEmitterSpec3D[];
}
export declare function rotateParticleVector3(v: ParticleVector3, q: ParticleQuaternion, out: ParticleVector3): void;
export declare function validateParticleEffect3D(value: unknown): string[];
