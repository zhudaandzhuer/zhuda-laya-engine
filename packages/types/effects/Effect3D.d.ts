// Generated from TypeScript source; run npm run types:generate.
import type { ParticleEffectSpec3D } from '../particles/ParticleTypes3D.js';
import { type ZhudaEffectPreset3D } from './EffectPresets.js';
export interface ZhudaEffect3DOptions {
    /** Where its origin is, metres (default the world's origin). */
    position?: readonly [number, number, number];
    /** Turned about the vertical, degrees. */
    yawDeg?: number;
    /** Every length of the preset times this, 0.05..50 (default 1). */
    scale?: number;
    /** Added to the emitters' seeds: two copies with different seeds do not move alike. */
    seed?: number;
    /** The side of the sprites' pictures in pixels: 32, 64, 128 (default) or 256. */
    spriteSize?: number;
}
/** A preset's effect with every length multiplied by `scale`: sizes, speeds, shapes, forces. Pure. */
export declare function scaleZhudaEffect3D(effect: ParticleEffectSpec3D, scale: number): ParticleEffectSpec3D;
export declare class ZhudaEffect3D {
    readonly preset: ZhudaEffectPreset3D;
    /** The effect as it runs: the preset's, scaled and seeded. */
    readonly effect: ParticleEffectSpec3D;
    private readonly systems;
    private readonly renderers;
    private readonly textures;
    private steps;
    private disposed;
    constructor(parent: unknown, preset: string | ZhudaEffectPreset3D, options?: ZhudaEffect3DOptions);
    /** Particles alive now, over all emitters. */
    get aliveCount(): number;
    /** Seconds since its start, as far as it has been stepped. */
    get seconds(): number;
    /** Lets it run on by `deltaSeconds` (a game's frame). */
    update(deltaSeconds: number): void;
    /** Puts it where it is `seconds` after its start; a negative time is before it began (nothing). */
    seek(seconds: number): void;
    /** Back to its start: no particle alive, the same random numbers again. */
    restart(): void;
    private advance;
    /** Builds the particles' meshes for this camera; call once a drawn frame. */
    render(camera: unknown, opacity?: number): void;
    dispose(): void;
}
