// Generated from TypeScript source; run npm run types:generate.
import type { ParticleEffectSpec } from '../particles/ParticleTypes.js';
import { type ZhudaEffectPreset2D } from './EffectPresets2D.js';
export interface ZhudaEffect2DOptions {
    /** Where its origin is, in the parent's pixels (default 0, 0). */
    x?: number;
    y?: number;
    /** Turned clockwise on the screen, degrees (default 0). */
    rotationDeg?: number;
    /** Every length of the preset times this, 0.05..50 (default 1). */
    scale?: number;
    /** Added to the emitters' seeds: two copies with different seeds do not move alike. */
    seed?: number;
    /** The side of the sprites' pictures in pixels: 32, 64 (default), 128 or 256. */
    spriteSize?: number;
    /** Bands of a particle's life its colour and alpha are drawn in, 1..64 (default 12). */
    lifeBands?: number;
}
/**
 * A 2D effect with every length multiplied by `scale`: sizes, speeds,
 * shapes, forces and collision planes; emission along a path keeps the same
 * count for the same path drawn bigger. Times and counts are unchanged. Pure.
 */
export declare function scaleZhudaEffect2D(effect: ParticleEffectSpec, scale: number): ParticleEffectSpec;
export declare class ZhudaEffect2D {
    readonly preset: ZhudaEffectPreset2D;
    /** The effect as it runs: the preset's, scaled and seeded. */
    readonly effect: ParticleEffectSpec;
    /** The Sprite it draws in, a child of the parent; its own, released by `dispose`. */
    readonly node: any;
    private readonly systems;
    private readonly renderers;
    private readonly textures;
    private disposed;
    constructor(parent: unknown, preset: string | ZhudaEffectPreset2D, options?: ZhudaEffect2DOptions);
    /** Particles alive now, over all emitters. */
    get aliveCount(): number;
    /** Seconds since its start, as far as it has been stepped. */
    get seconds(): number;
    /** Whether any emitter still emits (a burst stops by itself; `stop` stops a loop). */
    get emitting(): boolean;
    /**
     * Moves its origin (pixels of the parent) and turns it. Particles already
     * out stay where they are; a trail fills the way between the last
     * position and this one at the next `update`. To begin again somewhere
     * else with no trail between, move it and then `restart`.
     */
    setPosition(x: number, y: number, rotationDeg?: number): void;
    /**
     * Lets it run on by `deltaSeconds` (a game's frame). Each emitter keeps its
     * own 120 Hz steps and catches up at most a quarter of a second at once,
     * as `ZhudaParticleSystem` does.
     */
    update(deltaSeconds: number): void;
    /** Puts it where it is `seconds` after its start; a negative time is before it began (nothing). */
    seek(seconds: number): void;
    /** Back to its start: no particle alive, the same random numbers again, emitting. */
    restart(): void;
    /** Stops emitting; what is out lives on unless `clear`. A loop ends this way. */
    stop(clear?: boolean): void;
    /** Builds the particles' quads; call once a drawn frame. */
    render(opacity?: number): void;
    /** Releases its sprites, renderers and pictures; the parent is left as it is. */
    dispose(): void;
}
