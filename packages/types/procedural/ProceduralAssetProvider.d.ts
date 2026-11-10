// Generated from TypeScript source; run npm run types:generate.
/**
 * Generated assets behind the normal `AssetProvider` boundary. Scene and
 * gameplay code keep asking for logical IDs; whether the bytes were computed
 * here or downloaded by the fallback provider stays a delivery detail.
 */
import { type AssetKind, type AssetLoadOptions, type AssetManifest, type AssetProvider, type LoadedAssetBytes } from '../runtime3d/AssetProvider.js';
export type ZhudaProceduralGenerator = (request: {
    id: string;
    signal?: AbortSignal;
}) => Uint8Array | Promise<Uint8Array>;
export interface ProceduralAssetProviderOptions {
    /** Asked for every ID that has no generator. It is borrowed, not disposed here. */
    fallback?: AssetProvider;
    /** Upper bound for one generated asset (default 64 MiB). */
    maxBytes?: number;
}
export declare class ProceduralAssetProvider implements AssetProvider {
    readonly name = "procedural";
    private readonly generators;
    private readonly fallback?;
    private readonly maxBytes;
    private disposed;
    constructor(options?: ProceduralAssetProviderOptions);
    register(id: string, generate: ZhudaProceduralGenerator, kind?: AssetKind): this;
    has(id: string): boolean;
    load(value: string, options?: AssetLoadOptions): Promise<LoadedAssetBytes>;
    /** Lists generated IDs only; the fallback keeps its own manifest. */
    getManifest(): Promise<AssetManifest>;
    dispose(): void;
}
