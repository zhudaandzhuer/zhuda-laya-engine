export type ModelDecoderFormat = "draco" | "meshopt" | "ktx2-basis";
export interface ModelDecoderDescriptor {
    readonly format: ModelDecoderFormat;
    readonly name: string;
    /** Pin the decoder implementation before it can be used in a release. */
    readonly version: string;
    /** SHA-256 of the decoder bytes or immutable package artifact. */
    readonly integritySha256: string;
}
export interface ModelDecoderInput {
    readonly assetId: string;
    readonly bytes: Uint8Array;
    readonly signal: AbortSignal;
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
}
export interface ModelDecodeRequestOptions {
    readonly signal?: AbortSignal;
    readonly timeoutMs?: number;
    readonly maxInputBytes?: number;
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
/**
 * Shared lifecycle boundary for optional compressed model decoders.
 * Registration does not make a format supported by the glTF importer; a
 * decoder still needs an importer adapter and target-device evidence before
 * the capability catalog can be promoted.
 */
export declare class ZhudaModelDecoderRegistry {
    private readonly adapters;
    private readonly active;
    private readonly timeoutMs;
    private readonly maxInputBytes;
    private disposed;
    constructor(options?: ModelDecoderOptions);
    register(adapter: ModelDecoderAdapter): () => void;
    has(format: ModelDecoderFormat): boolean;
    decode(format: ModelDecoderFormat, assetId: string, bytes: Uint8Array, options?: ModelDecodeRequestOptions): Promise<ModelDecodedPayload>;
    dispose(): void;
}
