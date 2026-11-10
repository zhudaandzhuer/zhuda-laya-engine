// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaParticleSystem } from './ParticleSystem';
import type { ZhudaRibbonTrail } from './RibbonTrail';
export type ParticleTextureResolver = (key: string) => any;
/** Laya WebGL textured quads, batched by lifetime band. No display object per particle. */
export declare class ZhudaLayaParticleRenderer {
    readonly node: any;
    submittedBatches: number;
    private readonly batches;
    private texture;
    readonly system: ZhudaParticleSystem;
    private readonly uv;
    private readonly frameUV;
    private readonly appendParticle;
    constructor(system: ZhudaParticleSystem, parent: any, resolveTexture: ParticleTextureResolver, lifeBands?: number);
    render(opacity?: number): void;
    dispose(): void;
}
/** Ribbon textures must have age along U and width along V, with transparent edges. */
export declare class ZhudaLayaRibbonRenderer {
    readonly node: any;
    submittedBatches: number;
    readonly trail: ZhudaRibbonTrail;
    private texture;
    color: string;
    blend: 'additive' | 'alpha';
    constructor(trail: ZhudaRibbonTrail, parent: any, texture: any, color?: string, blend?: 'additive' | 'alpha');
    render(opacity?: number): void;
    dispose(): void;
}
