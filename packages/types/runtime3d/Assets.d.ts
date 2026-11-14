// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaModelDecoderRegistry } from './ModelDecoder.js';
import { type ZhudaGltfNodeData } from './GltfIntake.js';
import { type ModelCompatibilityReport } from './ModelCompatibility.js';
import type { AssetProvider } from './AssetProvider.js';
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
/** glTF node data LayaAir drops (extras, a camera, a light), found on this instance's Laya node. */
export interface ZhudaModelGltfNode extends ZhudaGltfNodeData {
    /** The Laya node made from the glTF node, in this instance. Its name is the glTF name or `node_<n>`. */
    readonly node: Laya.Sprite3D;
    /** The light component made from `light` when `instantiate` asked for lights; otherwise null. */
    readonly lightComponent: Laya.Light | null;
}
export interface ModelInstance {
    readonly node: Laya.Sprite3D;
    readonly compatibility: ModelCompatibilityReport;
    readonly materials: readonly Laya.Material[];
    /** The nodes that carry glTF `extras`, a camera or a `KHR_lights_punctual` light, in node order. */
    readonly gltfNodes: readonly ZhudaModelGltfNode[];
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
        /**
         * Make the file's `KHR_lights_punctual` lights on their nodes (off by
         * default: copies of a model would copy its lights). `scale` multiplies
         * the glTF intensities (see zhudaGltfLightToLaya); default 1.
         */
        lights?: boolean | {
            scale?: number;
        };
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
