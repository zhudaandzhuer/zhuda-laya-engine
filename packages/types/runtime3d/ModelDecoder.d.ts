export type ModelDecoderFormat = "draco" | "meshopt" | "ktx2-basis";
export interface ModelDecoderDescriptor {
    readonly format: ModelDecoderFormat;
    readonly name: string;
    /** Declared version; the registry does not authenticate adapter code. */
    readonly version: string;
    /** Declared SHA-256. Artifact verification belongs to build/package tooling. */
    readonly integritySha256: string;
}
export interface ModelDecoderInput {
    readonly assetId: string;
    readonly bytes: Uint8Array;
    readonly signal: AbortSignal;
    readonly maxOutputBytes: number;
}
export interface ModelDecodedPayload {
    readonly assetId: string;
    readonly format: ModelDecoderFormat;
    /** Decoder-specific CPU data or an explicitly owned native upload handle. */
    readonly data: unknown;
    readonly byteLength: number;
    /** The caller owns the returned payload and must release it exactly once. */
    release(): void;
}
export interface ModelDecoderAdapter {
    readonly descriptor: ModelDecoderDescriptor;
    decode(input: ModelDecoderInput): Promise<ModelDecodedPayload>;
    dispose?(): void;
}
export interface ModelDecoderOptions {
    readonly timeoutMs?: number;
    readonly maxInputBytes?: number;
    readonly maxOutputBytes?: number;
}
export interface ModelDecodeRequestOptions {
    readonly signal?: AbortSignal;
    readonly timeoutMs?: number;
    readonly maxInputBytes?: number;
    readonly maxOutputBytes?: number;
}
export type ModelDecoderErrorCode = "invalid-adapter" | "unsupported" | "invalid-input" | "aborted" | "timeout" | "invalid-output" | "disposed";
export declare class ModelDecoderError extends Error {
    readonly code: ModelDecoderErrorCode;
    readonly format?: ModelDecoderFormat;
    readonly assetId?: string;
    constructor(code: ModelDecoderErrorCode, message: string, details?: {
        format?: ModelDecoderFormat;
        assetId?: string;
    });
}
/** Optional decoder lifecycle. Metadata is not artifact verification or importer support. */
export declare class ZhudaModelDecoderRegistry {
    private readonly adapters;
    private readonly timeoutMs;
    private readonly maxInputBytes;
    private readonly maxOutputBytes;
    private disposed;
    constructor(options?: ModelDecoderOptions);
    private drain;
    private retire;
    register(adapter: ModelDecoderAdapter): () => void;
    has(format: ModelDecoderFormat): boolean;
    decode(format: ModelDecoderFormat, assetId: string, bytes: Uint8Array, options?: ModelDecodeRequestOptions): Promise<ModelDecodedPayload>;
    dispose(): void;
}
