export declare class ZhudaSimulationClock {
    readonly step: number;
    readonly maxCatchup: number;
    tick: number;
    renderTime: number;
    paused: boolean;
    timeScale: number;
    unscaledTime: number;
    scaledTime: number;
    unscaledDeltaTime: number;
    scaledDeltaTime: number;
    private accumulator;
    constructor(step?: number, maxCatchup?: number);
    advance(dt: number, simulate: (dt: number, tick: number) => void): number;
    get simulationTime(): number;
    get alpha(): number;
    reset(tick?: number): void;
}
export interface ZhudaClockSample {
    unscaledDeltaTime: number;
    scaledDeltaTime: number;
    unscaledTime: number;
    scaledTime: number;
    timeScale: number;
}
export interface ZhudaLayerClockSample extends ZhudaClockSample {
    /** The named simulation/presentation layer that produced this sample. */
    layer: string;
    /** Pausing a layer keeps its real-time clock visible while zeroing its scaled channel. */
    paused: boolean;
}
export interface ZhudaTimeLayerOptions {
    timeScale?: number;
    paused?: boolean;
}
/**
 * A single real-time source with independently scaled named channels.
 *
 * The clock deliberately does not know anything about combat, rendering or
 * animation. A consumer can freeze `enemy` for hit-stop while continuing to
 * advance `player`, `vfx` and `ui`, then pass the exposed layer deltas to the
 * shared `ZhudaTimerScheduler`.
 */
export declare class ZhudaLayeredClock {
    private readonly layerStates;
    private readonly layerDeltaValues;
    /** Global scale inherited from the owning runtime session. */
    globalTimeScale: number;
    unscaledTime: number;
    unscaledDeltaTime: number;
    constructor(layers?: readonly string[] | Record<string, ZhudaTimeLayerOptions>);
    defineLayer(name: string, options?: ZhudaTimeLayerOptions): this;
    removeLayer(name: string): boolean;
    setTimeScale(name: string, value: number): this;
    setGlobalTimeScale(value: number): this;
    setPaused(name: string, paused: boolean): this;
    getTimeScale(name: string): number;
    isPaused(name: string): boolean;
    get layerNames(): readonly string[];
    /** Reusable layer deltas for `ZhudaTimerScheduler.advance`. */
    get scaledDeltas(): ReadonlyMap<string, number>;
    advance(unscaledDeltaTime: number): void;
    sample(name: string): ZhudaLayerClockSample;
    reset(): void;
    private getLayer;
    private validateName;
}
/** A real-time clock that exposes both gameplay and presentation time channels. */
export declare class ZhudaRealtimeClock {
    timeScale: number;
    unscaledTime: number;
    scaledTime: number;
    unscaledDeltaTime: number;
    scaledDeltaTime: number;
    paused: boolean;
    advance(unscaledDeltaTime: number): ZhudaClockSample;
    sample(): ZhudaClockSample;
    reset(): void;
}
export type ZhudaTimerChannel = "scaled" | "unscaled";
export interface ZhudaTimerOptions {
    channel?: ZhudaTimerChannel;
    /** When set, the timer consumes that named layer's scaled delta. */
    layer?: string;
    owner?: object;
}
export interface ZhudaTimerHandle {
    readonly id: number;
    readonly cancelled: boolean;
    cancel(): boolean;
}
/** Frame-driven timer scheduler. It never creates a browser timer or outlives its owner. */
export declare class ZhudaTimerScheduler {
    readonly maxCallbacksPerAdvance: number;
    private nextId;
    private tasks;
    private owners;
    private disposed;
    constructor(maxCallbacksPerAdvance?: number);
    scheduleOnce(delay: number, callback: () => void, options?: ZhudaTimerOptions): ZhudaTimerHandle;
    scheduleLoop(interval: number, callback: () => void, options?: ZhudaTimerOptions): ZhudaTimerHandle;
    private schedule;
    private handle;
    private cancel;
    cancelOwner(owner: object): number;
    advance(unscaledDeltaTime: number, scaledDeltaTime?: number, layerDeltas?: ReadonlyMap<string, number>): number;
    clear(): void;
    dispose(): void;
    get size(): number;
}
export interface TimedSnapshot<T> {
    epoch: string;
    sequence: number;
    time: number;
    value: T;
}
/** Caller supplies server/sample time. Arrival order never controls playback time. */
export declare class ZhudaSnapshotBuffer<T> {
    epoch: string;
    readonly interpolate: (a: T, b: T, t: number) => T;
    readonly maxExtrapolation: number;
    readonly capacity: number;
    private items;
    private sequence;
    constructor(epoch: string, interpolate: (a: T, b: T, t: number) => T, maxExtrapolation?: number, capacity?: number);
    push(s: TimedSnapshot<T>): boolean;
    sample(time: number): {
        value: T;
        time: number;
        mode: "held";
    } | {
        value: T;
        time: number;
        mode: "interpolated";
    } | {
        value: T;
        time: number;
        mode: "extrapolated";
    } | null;
    reset(epoch: string): void;
    get size(): number;
}
/** Session-scoped, TTL + capacity bounded; seeking/replay suppresses side effects by default. */
export declare class ZhudaEventGate {
    epoch: string;
    readonly ttl: number;
    readonly capacity: number;
    private seen;
    constructor(epoch: string, ttl?: number, capacity?: number);
    dispatch(id: string, now: number, action: () => void, options?: {
        epoch?: string;
        replay?: boolean;
    }): boolean;
    reset(epoch: string): void;
    get size(): number;
}
