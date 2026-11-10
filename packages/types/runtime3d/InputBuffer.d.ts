// Generated from TypeScript source; run npm run types:generate.
export interface ZhudaBufferedInput {
    action: string;
    time: number;
    sequence: number;
}
export interface ZhudaInputBufferOptions {
    /** Maximum age in the same clock units supplied to `push` and `consume`. */
    window?: number;
    capacity?: number;
}
/**
 * Bounded action-level input queue for fighting games.
 *
 * Platform adapters translate keyboard, touch or gamepad events into stable
 * action IDs and push them here. The buffer owns ordering and expiry only; it
 * does not decide whether an action is legal for the current game state.
 */
export declare class ZhudaInputBuffer {
    readonly window: number;
    readonly capacity: number;
    private entries;
    private nextSequence;
    private lastTime;
    private disposed;
    constructor(options?: ZhudaInputBufferOptions);
    push(action: string, time: number): boolean;
    has(action: string, time: number): boolean;
    /** Consumes the oldest matching action once. */
    consume(action: string, time: number): boolean;
    /** Consumes the oldest matching action from a set of alternatives. */
    consumeAny(actions: readonly string[], time: number): string | null;
    /**
     * Consumes an ordered combo such as `down`, `forward`, `attack`.
     * Unrelated actions may occur between combo steps; each accepted step must
     * arrive within `maxGap` of the previous accepted step.
     */
    consumeSequence(actions: readonly string[], time: number, maxGap?: number): boolean;
    snapshot(time: number): readonly ZhudaBufferedInput[];
    clear(): void;
    dispose(): void;
    get size(): number;
    get isDisposed(): boolean;
    private prune;
    private validateRead;
    private validateTime;
    private validateActions;
    private ensureLive;
}
