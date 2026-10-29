/** Public particle API contract; keep aligned with packages/core/particles. */
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

/** Fixed-step CPU simulation, preallocated pool, seeded replay, bounded catch-up. */
export declare class ZhudaParticleSystem {
    readonly spec: ParticleEmitterSpec;
    readonly transform: ParticleTransform;
    intensity: number;
    emitting: boolean;
    time: number;
    droppedParticles: number;
    droppedSeconds: number;
    static readonly STEP: number;
    constructor(spec: ParticleEmitterSpec);
    get aliveCount(): number;
    get capacity(): number;
    setTransform(x: number, y: number, rotation?: number): void;
    play(restart?: boolean): void;
    stop(clear?: boolean): void;
    clear(): void;
    burst(count: number, x?: number, y?: number): void;
    forEach(visitor: (particle: ParticleState, index: number) => void): void;
    snapshot(): ParticleState[];
    update(deltaSeconds: number): void;
}

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
export declare class ZhudaRibbonTrail {
    readonly spec: RibbonTrailSpec;
    constructor(spec: RibbonTrailSpec);
    get pointCount(): number;
    clear(): void;
    update(dt: number, x: number, y: number, emitting?: boolean): void;
    /** Reuses storage; UV.x encodes age, UV.y crosses the ribbon width. */
    buildMesh(): RibbonMesh;
    snapshot(): Array<{
        x: number;
        y: number;
        age: number;
    }>;
}

export type EffectPhase = 'idle' | 'attack' | 'sustain' | 'release';
/** Generic attack/sustain/release envelope. Stopping releases the effect without clearing live particles. */
export declare class ZhudaEffectEnvelope {
    phase: EffectPhase;
    value: number;
    readonly attack: number;
    readonly release: number;
    constructor(attack?: number, release?: number);
    start(strength?: number): void;
    setStrength(strength: number): void;
    stop(): void;
    reset(): void;
    update(dt: number): number;
}

export type ParticleTextureResolver = (key: string) => any;
/** Laya WebGL textured quads, batched by lifetime band. No display object per particle. */
export declare class ZhudaLayaParticleRenderer {
    readonly node: any;
    submittedBatches: number;
    readonly system: ZhudaParticleSystem;
    constructor(system: ZhudaParticleSystem, parent: any, resolveTexture: ParticleTextureResolver, lifeBands?: number);
    render(opacity?: number): void;
    dispose(): void;
}
/** Ribbon textures must have age along U and width along V, with transparent edges. */
export declare class ZhudaLayaRibbonRenderer {
    readonly node: any;
    submittedBatches: number;
    readonly trail: ZhudaRibbonTrail;
    color: string;
    blend: 'additive' | 'alpha';
    constructor(trail: ZhudaRibbonTrail, parent: any, texture: any, color?: string, blend?: 'additive' | 'alpha');
    render(opacity?: number): void;
    dispose(): void;
}
