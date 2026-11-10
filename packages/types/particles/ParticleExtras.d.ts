// Generated from TypeScript source; run npm run types:generate.
export interface ParticleUVRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ParticleFlipbook {
    columns: number;
    rows: number;
    fps?: number;
    cycles?: number;
    startFrame?: number;
    frameCount?: number;
    loop?: boolean;
}
export interface ParticlePlane {
    normal: {
        x: number;
        y: number;
        z?: number;
    };
    offset: number;
}
export interface ParticleCollisionSpec {
    planes: ParticlePlane[];
    restitution?: number;
    friction?: number;
    radius?: number;
    killOnCollision?: boolean;
}
export interface ParticleEvent {
    type: 'collision' | 'death';
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    plane: number;
}
export declare function validateParticleExtras(e: any, dimension?: number): string[];
/** Returns UVs through a caller-owned rectangle. Rows are authored from the top of the texture. */
export declare function sampleParticleUV(spec: {
    textureRect?: ParticleUVRect;
    flipbook?: ParticleFlipbook;
}, age: number, lifetime: number, out: ParticleUVRect): ParticleUVRect;
/** Plane convention: dot(position, normal) >= offset is free space, in the simulator's chosen world/local coordinates. */
export declare function resolveParticleCollision(p: any, spec: ParticleCollisionSpec, dimension: number, hit: (plane: number) => void): boolean;
