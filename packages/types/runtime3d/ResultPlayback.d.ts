export type ZhudaJsonValue = null | boolean | number | string | readonly ZhudaJsonValue[] | {
    readonly [key: string]: ZhudaJsonValue;
};
export interface ZhudaResultScope {
    readonly gameId: string;
    readonly sessionId: string;
    readonly epoch: string;
}
export interface ZhudaResultEnvelope<T extends ZhudaJsonValue = ZhudaJsonValue> extends ZhudaResultScope {
    readonly schemaVersion: 1;
    readonly roundId: string;
    readonly sequence: number;
    readonly resultVersion: string;
    readonly payload: T;
}
export interface ZhudaPlaybackCheckpoint<T extends ZhudaJsonValue = ZhudaJsonValue> extends ZhudaResultScope {
    readonly schemaVersion: 1;
    readonly result: ZhudaResultEnvelope<T> | null;
    readonly cursor: number;
    readonly completed: boolean;
}
/** One exclusively owned key per scope. write must be synchronous and atomic or throw.
 * An async/backend store must reconcile through recover; do not acknowledge before durable write. */
export interface ZhudaPlaybackStore {
    read(key: string): unknown;
    write(key: string, checkpoint: ZhudaPlaybackCheckpoint): void;
}
/** Backend authenticates/authorizes results. Engine only coordinates presentation. */
export interface ZhudaResultRecovery<T extends ZhudaJsonValue> {
    reconcile(checkpoint: ZhudaPlaybackCheckpoint<T>, signal: AbortSignal): Promise<ZhudaResultEnvelope<T> | null>;
}
/** Bounded last-result checkpoint, not a transaction journal or TTL event gate.
 * New instances start locked until authoritative recovery. No timer drives presentation. */
export declare class ZhudaResultPlayback<T extends ZhudaJsonValue> {
    private state;
    private readonly scope;
    private readonly key;
    private ready;
    private disposed;
    private pending;
    constructor(options: {
        scope: ZhudaResultScope;
        store: ZhudaPlaybackStore;
        validate: (result: ZhudaResultEnvelope<T>) => void;
        validateCursor?: (result: ZhudaResultEnvelope<T>, cursor: number, completed: boolean) => void;
    });
    private readonly store;
    private readonly validate;
    private readonly validateCursor?;
    private checkScope;
    private result;
    private checkpoint;
    private persist;
    private alive;
    private writable;
    get inputLocked(): boolean;
    snapshot(): ZhudaPlaybackCheckpoint<T>;
    accept(value: ZhudaResultEnvelope<T>): 'accepted' | 'duplicate' | 'stale';
    /** Consumer applies idempotent visual state then checkpoints; crashes may replay that state.
     * Never attach wallet/payment side effects to this method. */
    advance(sequence: number, cursor: number, completed?: boolean): void;
    /** On blur/context loss call suspend, cancel visual work and pause the existing session. */
    suspend(): void;
    recover(adapter: ZhudaResultRecovery<T>, options?: {
        signal?: AbortSignal;
        timeoutMs?: number;
    }): Promise<void>;
    dispose(): void;
}
