export interface ZhudaPoolOptions<T> {
    capacity: number;
    create: () => T;
    reset?: (item: T) => void;
    onSpawn?: (item: T) => void;
    onDespawn?: (item: T) => void;
    dispose?: (item: T) => void;
}
/** Explicit lifecycle contract for reusable consumer-owned objects. */
export declare class ZhudaObjectPool<T> {
    readonly capacity: number;
    private readonly create;
    private readonly reset?;
    private readonly onSpawn?;
    private readonly onDespawn?;
    private readonly disposeItemCallback?;
    private readonly free;
    private readonly active;
    private readonly disposedItems;
    private created;
    private disposed;
    constructor(options: ZhudaPoolOptions<T>);
    acquire(): T | null;
    release(item: T): boolean;
    private disposeItem;
    clear(): number;
    dispose(): void;
    get activeCount(): number;
    get availableCount(): number;
    get createdCount(): number;
    get isDisposed(): boolean;
}
