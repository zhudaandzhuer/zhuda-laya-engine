// Generated from TypeScript source; run npm run types:generate.
import type { ParticleEvent } from './ParticleExtras';
import type { ParticleEmitterSpec, ParticleState, ParticleTransform } from './ParticleTypes';
/** Fixed-step CPU simulation, preallocated pool, seeded replay, bounded catch-up. */
export declare class ZhudaParticleSystem {
    readonly spec: ParticleEmitterSpec;
    readonly transform: ParticleTransform;
    intensity: number;
    emitting: boolean;
    time: number;
    droppedParticles: number;
    droppedSeconds: number;
    /** Future births respect this cap; existing particles drain naturally. */
    private limit;
    get particleLimit(): number;
    set particleLimit(value: number);
    onEvent?: (event: ParticleEvent) => void;
    droppedEvents: number;
    private events;
    private queueEvent;
    private flushEvents;
    private readonly pool;
    private readonly active;
    private readonly free;
    private freeCount;
    private count;
    private rng;
    private accumulator;
    private emitRemainder;
    private distanceRemainder;
    private cycleTime;
    private firstStep;
    private previousX;
    private previousY;
    private positioned;
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
    private random;
    private range;
    private spawn;
    private step;
}
