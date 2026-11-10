// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaModelDecoderRegistry } from './ModelDecoder';
import { type ModelCompatibilityReport } from './ModelCompatibility';
import type { AssetProvider } from './AssetProvider';
export type AssetPhase = 'downloading' | 'parsing' | 'ready';
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
export interface ModelInstance {
    readonly node: Laya.Sprite3D;
    readonly compatibility: ModelCompatibilityReport;
    readonly materials: readonly Laya.Material[];
    setTint(color: [number, number, number, number]): void;
    find(name: string): Laya.Sprite3D | null;
    dispose(): void;
}
export interface ModelLibraryOptions {
    /** Borrowed optional decoders. Embedded Meshopt conversion runs before native parsing. */
    decoders?: ZhudaModelDecoderRegistry;
    maxIdle?: number;
    /** Borrowed provider. Embedded GLB/glTF only; external URI dependencies are rejected. */
    provider?: AssetProvider;
    /** Per-caller download + parse deadline. Default 15000ms. */
    timeoutMs?: number;
}
export declare class ZhudaModelLibrary {
    readonly cache: ZhudaAssetCache<any>;
    private instances;
    private templates;
    private readonly timeoutMs;
    private readonly provider?;
    constructor(options?: number | ModelLibraryOptions);
    instantiate(url: string, options?: {
        signal?: AbortSignal;
        independentMaterials?: boolean;
        retries?: number;
        timeoutMs?: number;
    }): Promise<ModelInstance>;
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
