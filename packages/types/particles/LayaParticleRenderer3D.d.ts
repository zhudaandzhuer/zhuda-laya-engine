// Generated from TypeScript source; run npm run types:generate.
import { ZhudaVfxMaterial } from '../effects/VfxMaterial';
import type { ZhudaParticleSystem3D } from './ParticleSystem3D';
import type { ZhudaRibbonTrail3D } from './RibbonTrail3D';
import type { ZhudaRibbonPath3D } from './RibbonPath3D';
import type { ParticleTextureResolver } from './LayaParticleRenderer';
export declare class ZhudaLayaParticleRenderer3D {
    readonly node: any;
    readonly system: ZhudaParticleSystem3D;
    get vfxMaterial(): ZhudaVfxMaterial | undefined;
    submittedBatches: number;
    private readonly builder;
    private readonly backend;
    private readonly view;
    private disposed;
    constructor(system: ZhudaParticleSystem3D, parent: any, resolveTexture: ParticleTextureResolver);
    render(camera: any, opacity?: number): void;
    dispose(): void;
}
export declare class ZhudaLayaRibbonRenderer3D {
    readonly node: any;
    readonly trail: ZhudaRibbonTrail3D | ZhudaRibbonPath3D;
    submittedBatches: number;
    private readonly backend;
    private disposed;
    constructor(trail: ZhudaRibbonTrail3D | ZhudaRibbonPath3D, parent: any, texture: any, color?: string, blend?: 'alpha' | 'additive');
    render(camera: any, opacity?: number): void;
    dispose(): void;
}
