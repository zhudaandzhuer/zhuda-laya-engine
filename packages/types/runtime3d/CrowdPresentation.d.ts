import type { TimedSnapshot } from './Clocks';
export type CrowdAnimationMode = 'full' | 'low' | 'paused';
export interface CrowdPresentationTier {
    /** Ascending outer distance, last tier must be Infinity. */
    maxDistance: number;
    updateHz: number;
    animation: CrowdAnimationMode;
    /** Native Laya frame divisor, not a promised Hz rate. Default 2. */
    animationInterval?: number;
}
export interface CrowdPresentationState {
    visible: boolean;
    distance: number;
    priority?: number;
}
export interface CrowdPresentationBinding {
    /** Presentation only. Never advance authoritative movement/damage here. */
    update(deltaSeconds: number): void;
    setTier?(tier: Readonly<CrowdPresentationTier> | null): void;
}
export interface CrowdSchedulerOptions {
    tiers: readonly CrowdPresentationTier[];
    maxUpdatesPerFrame: number;
    hysteresis?: number;
    maxDeltaSeconds?: number;
}
/** One shared presentation schedule driven by the session's scaled delta. No private timer. */
export declare class ZhudaCrowdScheduler {
    private readonly tiers;
    private readonly maxUpdates;
    private readonly hysteresis;
    private readonly maxDelta;
    private readonly entries;
    private readonly due;
    private disposed;
    private dropped;
    constructor(options: CrowdSchedulerOptions);
    private check;
    register(id: string, binding: CrowdPresentationBinding, state: CrowdPresentationState): void;
    private validate;
    setState(id: string, state: CrowdPresentationState): void;
    private selectTier;
    update(deltaSeconds: number): {
        updated: number;
        deferred: number;
        hidden: number;
        droppedSeconds: number;
    };
    remove(id: string): boolean;
    get size(): number;
    dispose(): void;
}
/** Public structural Animator properties. Native manager owns evaluation; this never manually ticks it. */
export interface CrowdAnimatorTarget {
    speed: number;
    updateMode: number;
    lowUpdateDelty: number;
}
export declare class ZhudaAnimatorLOD {
    private static readonly owners;
    private readonly target;
    private readonly speed;
    private readonly restoreMode;
    private readonly restoreInterval;
    private disposed;
    /** Native updateMode/interval are write-only in 3.4.2. Pass original settings if non-default. */
    constructor(target: CrowdAnimatorTarget, restore?: {
        updateMode?: number;
        lowUpdateInterval?: number;
    });
    set(mode: CrowdAnimationMode, frameInterval?: number): void;
    dispose(): void;
}
export interface RemoteCharacterBinding<T> extends Omit<CrowdPresentationBinding, 'update'> {
    present(value: T, mode: 'held' | 'interpolated' | 'extrapolated', stale: boolean): void;
}
export interface RemoteCharacterPresenterOptions<T> extends CrowdSchedulerOptions {
    epoch: string;
    interpolate(a: T, b: T, t: number): T;
    maxExtrapolation?: number;
    snapshotCapacity?: number;
    staleAfterSeconds?: number;
}
/** Presentation composition only: transport, server time sync, AOI and combat authority are consumer-owned. */
export declare class ZhudaRemoteCharacterPresenter<T> {
    readonly scheduler: ZhudaCrowdScheduler;
    private readonly options;
    private readonly entries;
    private epoch;
    private sampleTime;
    constructor(options: RemoteCharacterPresenterOptions<T>);
    register(id: string, binding: RemoteCharacterBinding<T>, state: CrowdPresentationState): void;
    push(id: string, snapshot: TimedSnapshot<T>, teleport?: boolean): boolean;
    update(deltaSeconds: number, serverSampleTime: number): {
        updated: number;
        deferred: number;
        hidden: number;
        droppedSeconds: number;
    };
    reset(epoch: string): void;
    remove(id: string): boolean;
    dispose(): void;
}
