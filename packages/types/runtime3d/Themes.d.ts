// Generated from TypeScript source; run npm run types:generate.
import { type AssetProvider, type AssetManifest, type AssetManifestEntry, type AssetLoadOptions, type LoadedAssetBytes } from './AssetProvider.js';
export interface ZhudaThemeAsset extends AssetManifestEntry {
    /** Logical ID is stable across themes; source is a provider-relative ID. */
    readonly source: string;
    readonly sha256: string;
    readonly bytes: number;
}
export interface ZhudaThemeManifest {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly revision: string;
    /** Exact consumer presentation contract ID, including layout/schema revision. */
    readonly contractId: string;
    readonly assets: readonly ZhudaThemeAsset[];
    /** Consumer estimate, NOT a GPU measurement. Includes decoded textures/audio/fonts. */
    readonly estimatedDecodedBytes: number;
}
export interface ZhudaThemeContract {
    readonly id: string;
    readonly required: readonly Pick<AssetManifestEntry, 'id' | 'kind' | 'formatVersion'>[];
    readonly maxDownloadBytes?: number;
    readonly maxEstimatedDecodedBytes?: number;
}
/** Returns an immutable snapshot. Checks metadata; decoded Spine/font/layout checks belong in prepare. */
export declare function validateThemeManifest(value: ZhudaThemeManifest, contract: ZhudaThemeContract): ZhudaThemeManifest;
/** Borrows source, owns in-flight operations and returned byte leases. No second cache. */
export declare class ZhudaThemeAssetProvider implements AssetProvider {
    readonly name: string;
    readonly manifest: ZhudaThemeManifest;
    private readonly source;
    private readonly lifetime;
    private readonly releases;
    private readonly timeoutMs;
    constructor(source: AssetProvider, manifest: ZhudaThemeManifest, contract: ZhudaThemeContract, timeoutMs?: number);
    /** Namespace a caller's shared cache key; never reuse bare logical IDs between providers. */
    cacheKey(id: string): string;
    private entry;
    getManifest(signal?: AbortSignal): Promise<AssetManifest>;
    load(id: string, options?: AssetLoadOptions): Promise<LoadedAssetBytes>;
    dispose(): void;
}
export interface ZhudaPreparedTheme<T> {
    readonly value: T;
    /** Release decoded resources/listeners. Must not dispose the borrowed source provider. */
    dispose(): void;
}
export interface ZhudaActiveTheme<T> {
    readonly manifest: ZhudaThemeManifest;
    readonly provider: ZhudaThemeAssetProvider;
    readonly value: T;
}
/** Two-phase preparation: active stays usable until replacement has fully validated. */
export declare class ZhudaThemeController<T> {
    private readonly slot;
    private active;
    private disposed;
    private readonly contract;
    private readonly source;
    private readonly maxTransitionEstimatedBytes;
    constructor(source: AssetProvider, contract: ZhudaThemeContract, maxTransitionEstimatedBytes?: number);
    get current(): ZhudaActiveTheme<T> | null;
    replace(manifest: ZhudaThemeManifest, prepare: (provider: ZhudaThemeAssetProvider, signal: AbortSignal) => Promise<ZhudaPreparedTheme<T>>, options?: {
        signal?: AbortSignal;
        timeoutMs?: number;
    }): Promise<boolean>;
    cancel(): void;
    clear(): void;
    dispose(): void;
}
