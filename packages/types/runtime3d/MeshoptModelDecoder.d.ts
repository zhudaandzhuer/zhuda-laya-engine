// Generated from TypeScript source; run npm run types:generate.
import type { ModelDecoderAdapter, ModelDecoderInput, ModelDecodedPayload } from './ModelDecoder.js';
export interface ZhudaMeshoptDecoderOptions {
    /**
     * Decode in this many web workers, 0..8 (default 0: on the calling
     * thread, a buffer view at a time). The decoder library starts them from
     * a script it makes itself (a `blob:` URL), each with its own copy of the
     * decoder; a page whose content policy forbids that, or a host without
     * workers, decodes on the calling thread as before and `workers` says 0.
     * They are stopped when the last decoder that asked for them is disposed.
     */
    workers?: number;
}
/** Optional pinned CPU decoder: embedded glTF/GLB -> ordinary self-contained GLB.
 * Reads `EXT_meshopt_compression` and `KHR_meshopt_compression` (with its COLOR
 * filter). Uses existing ModelLibrary/provider ownership; no second renderer or cache.
 */
export declare class ZhudaMeshoptModelDecoder implements ModelDecoderAdapter {
    readonly descriptor: Readonly<{
        format: "meshopt";
        name: "meshoptimizer";
        version: "1.3.0";
        integritySha256: "10b313edaa0e322b0c1b46443f6c8b186b42139fe1eca189d50c09511d0ebedc";
    }>;
    private disposed;
    private readonly request;
    /** Why the workers asked for are not used, when they are not. */
    readonly workersUnavailable: string | null;
    constructor(options?: ZhudaMeshoptDecoderOptions);
    /** How many workers this decoder decodes in; 0 when it decodes on the calling thread. */
    get workers(): number;
    decode({ assetId, bytes, signal, maxOutputBytes, }: ModelDecoderInput): Promise<ModelDecodedPayload>;
    dispose(): void;
}
