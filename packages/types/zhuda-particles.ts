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

/** Fixed-step XYZ simulation with bounded pools, quaternion emitters and world/local space. */
export declare class ZhudaParticleSystem3D {
    readonly spec: ParticleEmitterSpec3D;
    readonly transform: ParticleTransform3D;
    readonly emitterVelocity: ParticleVector3;
    intensity: number;
    emitting: boolean;
    time: number;
    droppedParticles: number;
    droppedSeconds: number;
    static readonly STEP: number;
    constructor(spec: ParticleEmitterSpec3D);
    get aliveCount(): number;
    get capacity(): number;
    setTransform(x: number, y: number, z: number, rotation?: ParticleQuaternion, velocity?: ParticleVector3): void;
    play(restart?: boolean): void;
    stop(clear?: boolean): void;
    clear(): void;
    burst(count: number, x?: number, y?: number, z?: number): void;
    forEach(visitor: (particle: ParticleState3D, index: number) => void): void;
    snapshot(): ParticleState3D[];
    update(delta: number): void;
}

/** Interleaved POSITION(3), COLOR(4), UV(2), in scene units. */
export interface ParticleGeometry3D {
    vertices: Float32Array;
    indices: Uint16Array;
    vertexCount: number;
    indexCount: number;
}
export declare class ZhudaParticleMesh3D {
    readonly geometry: ParticleGeometry3D;
    readonly system: ZhudaParticleSystem3D;
    constructor(system: ZhudaParticleSystem3D);
    build(view: ParticleView3D, opacity?: number): ParticleGeometry3D;
}

/** Bounded XYZ world history; camera-facing ribbon with stable normals. */
export declare class ZhudaRibbonTrail3D {
    readonly spec: RibbonTrailSpec;
    constructor(spec: RibbonTrailSpec);
    get pointCount(): number;
    clear(): void;
    update(dt: number, x: number, y: number, z: number, emitting?: boolean): void;
    buildMesh(cameraPosition: ParticleVector3, opacity?: number): ParticleGeometry3D;
    snapshot(): Array<ParticleVector3 & {
        age: number;
    }>;
}

export interface RibbonPathSpec3D {
    maxPoints: number;
    width: number;
    widthOverPath?: ParticleCurveKey[];
    alphaOverPath?: ParticleCurveKey[];
    colorOverPath?: ParticleColorKey[];
}
/** Authored XYZ flow paths. Geometry follows supplied world points, with a fade at either end. */
export declare class ZhudaRibbonPath3D {
    readonly spec: RibbonPathSpec3D;
    uvOffset: number;
    uvTiles: number;
    visibleStart: number;
    visibleEnd: number;
    edgeFade: number;
    constructor(spec: RibbonPathSpec3D);
    get pointCount(): number;
    clear(): void;
    setPoints(points: readonly ParticleVector3[], widthDirections?: readonly ParticleVector3[]): void;
    snapshot(): ParticleVector3[];
    buildMesh(camera: ParticleVector3, opacity?: number): ParticleGeometry3D;
}

export declare class ZhudaLayaParticleRenderer3D {
    readonly node: any;
    readonly system: ZhudaParticleSystem3D;
    submittedBatches: number;
    constructor(system: ZhudaParticleSystem3D, parent: any, resolveTexture: ParticleTextureResolver);
    render(camera: any, opacity?: number): void;
    dispose(): void;
}
export declare class ZhudaLayaRibbonRenderer3D {
    readonly node: any;
    readonly trail: ZhudaRibbonTrail3D | ZhudaRibbonPath3D;
    submittedBatches: number;
    constructor(trail: ZhudaRibbonTrail3D | ZhudaRibbonPath3D, parent: any, texture: any, color?: string, blend?: 'alpha' | 'additive');
    render(camera: any, opacity?: number): void;
    dispose(): void;
}
