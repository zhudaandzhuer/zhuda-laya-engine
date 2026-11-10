// Generated from TypeScript source; run npm run types:generate.
import type { ParticleUVRect, ParticleFlipbook, ParticleCollisionSpec } from './ParticleExtras';
/** Serializable, renderer-independent particle descriptors. Units: pixels, seconds, radians. */
export type ParticleRange = number | [number, number];
export interface ParticleCurveKey {
    time: number;
    value: number;
}
export interface ParticleColorKey {
    time: number;
    color: string;
}
export interface ParticleTransform {
    x: number;
    y: number;
    rotation: number;
}
export type ParticleShape = {
    type: 'point';
} | {
    type: 'box';
    width: number;
    height: number;
} | {
    type: 'circle';
    radius: number;
    edge?: boolean;
};
export interface ParticleEmitterSpec {
    id: string;
    texture: string;
    textureRect?: ParticleUVRect;
    flipbook?: ParticleFlipbook;
    collision?: ParticleCollisionSpec;
    maxParticles: number;
    seed: number;
    space: 'world' | 'local';
    blend: 'additive' | 'alpha';
    shape: ParticleShape;
    rate: number;
    rateOverDistance?: number;
    bursts?: Array<{
        time: number;
        count: number;
    }>;
    duration?: number;
    loop?: boolean;
    lifetime: ParticleRange;
    speed: ParticleRange;
    angle: ParticleRange;
    size: ParticleRange;
    rotation?: ParticleRange;
    angularVelocity?: ParticleRange;
    acceleration?: {
        x: number;
        y: number;
    };
    drag?: number;
    turbulence?: {
        strength: number;
        frequency: number;
    };
    stretch?: number;
    alignToVelocity?: boolean;
    sizeOverLife?: ParticleCurveKey[];
    alphaOverLife?: ParticleCurveKey[];
    colorOverLife?: ParticleColorKey[];
}
export interface ParticleEffectSpec {
    schemaVersion: 1;
    emitters: ParticleEmitterSpec[];
}
/** Borrowed pooled particle; copy it if retaining it beyond a frame. */
export interface ParticleState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    lifetime: number;
    baseSize: number;
    size: number;
    rotation: number;
    angularVelocity: number;
    phase: number;
}
export declare function sampleParticleCurve(keys: ParticleCurveKey[] | undefined, time: number, fallback?: number): number;
export declare function sampleParticleColor(keys: ParticleColorKey[] | undefined, time: number): string;
export declare function validateParticleEffect(value: unknown): string[];
