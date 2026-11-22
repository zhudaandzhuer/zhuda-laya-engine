// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaModelDecoderRegistry } from './ModelDecoder.js';
import { type ZhudaGltfNodeData, type ZhudaImageDecodeSupport } from './GltfIntake.js';
import type { ZhudaBasisTranscoder } from './BasisTexture.js';
import { type ModelCompatibilityReport } from './ModelCompatibility.js';
import type { AssetProvider } from './AssetProvider.js';
import { type ZhudaVrmDocument, type ZhudaVrmIssue } from './VrmDocument.js';
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
    /**
     * `EXT_mesh_gpu_instancing`: where the node's mesh is to be drawn, sixteen
     * numbers a copy (column by column, in the node's own space). The node
     * itself draws its mesh once, where it is; `mountZhudaModel` draws the
     * copies instead. Absent when the node has none, or none that can be
     * drawn.
     */
    readonly instances?: Float32Array;
}
/** A mesh renderer of a model copy and the glTF material each of its slots was made from. */
export interface ZhudaModelMaterialSlots {
    readonly node: Laya.Sprite3D;
    /** The node's `MeshRenderer` or `SkinnedMeshRenderer`. */
    readonly renderer: any;
    /** For each of the renderer's materials, in order: its glTF material index, or -1 (LayaAir's default material). */
    readonly materials: readonly number[];
}
export interface ModelInstance {
    readonly node: Laya.Sprite3D;
    readonly compatibility: ModelCompatibilityReport;
    readonly materials: readonly Laya.Material[];
    /**
     * The nodes that carry glTF `extras`, a camera, a `KHR_lights_punctual`
     * light or copies of their mesh (`EXT_mesh_gpu_instancing`), in node order.
     */
    readonly gltfNodes: readonly ZhudaModelGltfNode[];
    /**
     * The Laya node this copy has for glTF node `index`, or null (no such
     * node, or one outside the default scene).
     */
    gltfNode(index: number): Laya.Sprite3D | null;
    /** Every mesh renderer of this copy, with the glTF material of each slot. */
    readonly gltfMaterialSlots: readonly ZhudaModelMaterialSlots[];
    /**
     * The texture LayaAir made for glTF texture `index`, or null. Borrowed from
     * the loaded model: it lives while any copy does; never destroy it.
     */
    gltfTexture(index: number): any | null;
    /** The file's VRM 1.0 data (`readZhudaVrm`), or null: not a VRM, or one an error refused. `ZhudaVrm` applies it. */
    readonly vrm: ZhudaVrmDocument | null;
    /** What reading the VRM data found: the errors that refused it, and the parts left out. */
    readonly vrmIssues: readonly ZhudaVrmIssue[];
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
    /**
     * This host's WebP/AVIF decoding, when the consumer already knows it (a
     * mini-game host's own capability answer). `probeZhudaImageDecode` is then
     * not run for this library's models.
     */
    imageDecode?: ZhudaImageDecodeSupport;
    /**
     * Borrowed. Transcodes the KTX 2 images of `KHR_texture_basisu` textures to
     * the block format this device samples (`ZhudaBasisTranscoder`). Without
     * one such a texture loads its fallback image, and a model whose only image
     * is KTX 2 is refused with a report.
     */
    basisTranscoder?: ZhudaBasisTranscoder;
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
