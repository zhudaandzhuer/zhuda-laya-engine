// Generated from TypeScript source; run npm run types:generate.
import type { ModelDecoderAdapter, ModelDecoderInput, ModelDecodedPayload } from './ModelDecoder.js';
/** Optional pinned CPU decoder: embedded glTF/GLB -> ordinary self-contained GLB.
 * Uses existing ModelLibrary/provider ownership; no second renderer or cache.
 */
export declare class ZhudaMeshoptModelDecoder implements ModelDecoderAdapter {
    readonly descriptor: Readonly<{
        format: "meshopt";
        name: "meshoptimizer";
        version: "1.3.0";
        integritySha256: "10b313edaa0e322b0c1b46443f6c8b186b42139fe1eca189d50c09511d0ebedc";
    }>;
    private disposed;
    decode({ assetId, bytes, signal, maxOutputBytes, }: ModelDecoderInput): Promise<ModelDecodedPayload>;
    dispose(): void;
}
