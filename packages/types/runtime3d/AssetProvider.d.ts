import type { ZhudaAssetCache } from "./Assets";
export type AssetKind = "binary" | "text" | "image" | "audio" | "model" | "scene" | "shader" | "unknown";
export type AssetProviderPhase = "downloading" | "verifying" | "ready";
export interface AssetManifestEntry {
    readonly id: string;
    readonly kind?: AssetKind;
    readonly bytes?: number;
    /** Lowercase SHA-256 of the decoded bytes, when integrity is required. */
    readonly sha256?: string;
    /** Consumer-defined format version, such as Spine 4.2. */
    readonly formatVersion?: string;
    /** Future packed providers may use this to select a remote chunk. */
    readonly chunk?: string;
}
export interface AssetManifest {
    readonly schemaVersion: 1;
    readonly entries: readonly AssetManifestEntry[];
}
export interface AssetLoadProgress {
    readonly id: string;
    readonly phase: AssetProviderPhase;
    readonly loadedBytes?: number;
    readonly totalBytes?: number;
}
export interface AssetLoadOptions {
    readonly signal?: AbortSignal;
    readonly maxBytes?: number;
    readonly onProgress?: (progress: AssetLoadProgress) => void;
}
export interface LoadedAssetBytes {
    readonly id: string;
    readonly bytes: Uint8Array;
    readonly manifest?: AssetManifestEntry;
    /** Packed providers may release a WASM/decoder lease after decode completes. */
    readonly release?: () => void;
}
/**
 * Stable source boundary for consumer assets.
 *
 * A packed/WASM implementation can satisfy this interface later without
 * leaking its container format into scene, model, Spine or gameplay code.
 */
export interface AssetProvider {
    readonly name: string;
    load(id: string, options?: AssetLoadOptions): Promise<LoadedAssetBytes>;
    getManifest?(signal?: AbortSignal): Promise<AssetManifest>;
    dispose?(): void;
}
export declare class AssetProviderError extends Error {
    readonly code: "invalid-id" | "aborted" | "timeout" | "http" | "too-large" | "integrity" | "disposed";
    readonly id?: string;
    readonly status?: number;
    constructor(code: AssetProviderError["code"], message: string, details?: {
        id?: string;
        status?: number;
    });
}
/** Logical IDs are portable; URLs and filesystem paths are provider details. */
export declare function normalizeAssetId(value: string): string;
export declare function validateAssetManifest(value: unknown): AssetManifest;
type FetchLike = typeof fetch;
export interface DirectoryAssetProviderOptions {
    /** Base URL or path ending in `/`; IDs are resolved below this root. */
    readonly baseUrl: string;
    readonly manifest?: AssetManifest;
    readonly manifestUrl?: string;
    readonly timeoutMs?: number;
    /** Default protects against accidental decompression/resource bombs. */
    readonly maxBytes?: number;
    readonly fetch?: FetchLike;
}
/** Plain URL-backed provider used by development and the initial consumer build. */
export declare class DirectoryAssetProvider implements AssetProvider {
    readonly name = "directory";
    private readonly baseUrl;
    private manifest?;
    private readonly manifestUrl?;
    private readonly manifestId?;
    private manifestPromise?;
    private readonly timeoutMs;
    private readonly maxBytes;
    private readonly fetchImpl;
    private readonly active;
    private disposed;
    constructor(options: DirectoryAssetProviderOptions);
    getManifest(signal?: AbortSignal): Promise<AssetManifest>;
    load(value: string, options?: AssetLoadOptions): Promise<LoadedAssetBytes>;
    dispose(): void;
}
/** Adapts a provider to the existing bounded cache without changing cache callers. */
export declare function createProviderAssetCache<T>(provider: AssetProvider, decode: (asset: LoadedAssetBytes, signal: AbortSignal, phase: (phase: "parsing" | "ready") => void) => Promise<T> | T, destroy: (value: T) => void, maxIdle?: number): ZhudaAssetCache<T>;
export {};
