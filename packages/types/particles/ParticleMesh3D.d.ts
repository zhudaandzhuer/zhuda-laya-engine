// Generated from TypeScript source; run npm run types:generate.
import type { ParticleView3D } from './ParticleTypes3D';
import type { ZhudaParticleSystem3D } from './ParticleSystem3D';
/** Interleaved POSITION(3), COLOR(4), UV(2), in scene units. */
export interface ParticleGeometry3D {
    vertices: Float32Array;
    indices: Uint16Array;
    vertexCount: number;
    indexCount: number;
}
export declare class ZhudaParticleMesh3D {
    readonly geometry: ParticleGeometry3D;
    private readonly frameUV;
    private readonly items;
    private readonly colors;
    private position;
    private velocity;
    private readonly sortForward;
    private readonly collect;
    private readonly compare;
    readonly system: ZhudaParticleSystem3D;
    constructor(system: ZhudaParticleSystem3D);
    build(view: ParticleView3D, opacity?: number): ParticleGeometry3D;
}
