// Generated from TypeScript source; run npm run types:generate.
export type ZhudaSceneMutationKind = "add" | "remove" | "destroy" | "custom";
export interface ZhudaSceneMutation {
    kind: ZhudaSceneMutationKind;
    apply: () => void;
    key?: string;
}
export interface ZhudaSceneMutationHandle {
    readonly id: number;
    readonly cancelled: boolean;
    cancel(): boolean;
}
/**
 * Batches scene graph writes at an explicit boundary. A mutation enqueued while
 * flushing is deferred to the next flush, so traversal never observes a
 * half-applied batch. The queue only calls public consumer-provided operations.
 */
export declare class ZhudaSceneMutationQueue {
    private nextId;
    private pending;
    private disposed;
    private flushing;
    enqueue(mutation: ZhudaSceneMutation): ZhudaSceneMutationHandle;
    deferAdd(apply: () => void): ZhudaSceneMutationHandle;
    deferRemove(apply: () => void): ZhudaSceneMutationHandle;
    deferDestroy(apply: () => void): ZhudaSceneMutationHandle;
    private cancel;
    /** Applies exactly the batch present at the start of this call. */
    flush(): number;
    clear(): void;
    dispose(): void;
    get size(): number;
    get isFlushing(): boolean;
}
