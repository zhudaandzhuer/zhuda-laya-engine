// Generated from TypeScript source; run npm run types:generate.
import type { ParticleEvent } from './ParticleExtras.js';
import type { ParticleEmitterSpec3D, ParticleQuaternion, ParticleState3D, ParticleTransform3D, ParticleVector3 } from './ParticleTypes3D.js';
export interface ParticleSimulationOptions3D {
    /** Visual simulation rate, 15–240 Hz. Default 120. Does not control game rules. */
    frequencyHz?: number;
    /** Per-call work bound, 1–240 steps. Default 30. Excess time is dropped and reported. */
    maxSubsteps?: number;
}
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
    private remainder;
    private distanceRemainder;
    private cycle;
    private first;
    private positioned;
    private previous;
    private scratch;
    private readonly direction;
    private readonly basisU;
    private readonly basisV;
    static readonly STEP: number;
    private frequency;
    private maxSteps;
    simulatedSteps: number;
    lastSubsteps: number;
    get frequencyHz(): number;
    /** Rate changes discard only the fractional remainder, reported in droppedSeconds. */
    setSimulation(options: ParticleSimulationOptions3D): void;
    constructor(spec: ParticleEmitterSpec3D, simulation?: ParticleSimulationOptions3D);
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
    private random;
    private range;
    private spawn;
    private step;
}
