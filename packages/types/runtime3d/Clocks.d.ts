export declare class ZhudaSimulationClock {
    readonly step: number;
    readonly maxCatchup: number;
    tick: number;
    renderTime: number;
    paused: boolean;
    private accumulator;
    constructor(step?: number, maxCatchup?: number);
    advance(dt: number, simulate: (dt: number, tick: number) => void): number;
    get simulationTime(): number;
    get alpha(): number;
    reset(tick?: number): void;
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
