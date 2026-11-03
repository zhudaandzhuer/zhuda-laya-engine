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
    advance(unscaledDeltaTime: number, scaledDeltaTime?: number): number;
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
