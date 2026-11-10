// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaParticleSystem } from '../particles/ParticleSystem';
import type { ZhudaParticleSystem3D } from '../particles/ParticleSystem3D';
/** Links collision/death events to a bounded child emitter. The child is advanced by its application's loop. */
export declare class ZhudaParticleEventLink {
    private disposed;
    private readonly previous;
    private readonly listener;
    readonly source: ZhudaParticleSystem | ZhudaParticleSystem3D;
    readonly child: ZhudaParticleSystem | ZhudaParticleSystem3D;
    constructor(source: ZhudaParticleSystem | ZhudaParticleSystem3D, child: ZhudaParticleSystem | ZhudaParticleSystem3D, options: {
        event: 'collision' | 'death';
        count: number;
    });
    dispose(): void;
}
