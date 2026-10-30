export type AssetPhase = "downloading" | "parsing" | "ready";
export interface AssetLease<T> {
    readonly value: T;
    release(): void;
}
/** Per-caller cancellation, shared in-flight work, bounded warm cache, explicit ownership. */
export declare class ZhudaAssetCache<T> {
    readonly load: (key: string, signal: AbortSignal, phase: (p: AssetPhase) => void) => Promise<T>;
    readonly destroy: (value: T) => void;
    readonly maxIdle: number;
    private entries;
    private disposed;
    private serial;
    loads: number;
    constructor(load: (key: string, signal: AbortSignal, phase: (p: AssetPhase) => void) => Promise<T>, destroy: (value: T) => void, maxIdle?: number);
    acquire(key: string, options?: {
        signal?: AbortSignal;
        retries?: number;
    }): Promise<AssetLease<T>>;
    private evict;
    report(): {
        entries: number;
        references: number;
        pending: number;
        loads: number;
        phases: {
            key: string;
            phase: AssetPhase;
            references: number;
        }[];
        gpuReady: "requires-first-draw";
    };
    dispose(): void;
}
export declare class ZhudaRequestSlot {
    private generation;
    private active;
    replace<T>(load: (signal: AbortSignal) => Promise<T>, commit: (value: T) => void, discard: (value: T) => void): Promise<boolean>;
    cancel(): void;
}
export declare class ZhudaModelLibrary {
    readonly cache: ZhudaAssetCache<any>;
    private instances;
    constructor(maxIdle?: number);
    instantiate(url: string, options?: {
        signal?: AbortSignal;
        independentMaterials?: boolean;
        retries?: number;
    }): Promise<{
        node: any;
        materials: any[];
        setTint: (color: [number, number, number, number]) => void;
        find: (name: string) => any;
        dispose: () => void;
    }>;
    report(): {
        instances: number;
        entries: number;
        references: number;
        pending: number;
        loads: number;
        phases: {
            key: string;
            phase: AssetPhase;
            references: number;
        }[];
        gpuReady: "requires-first-draw";
    };
    dispose(): void;
}
