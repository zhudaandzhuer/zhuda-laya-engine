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

export type ModelDecoderErrorCode =
  | "invalid-adapter"
  | "unsupported"
  | "invalid-input"
  | "aborted"
  | "timeout"
  | "invalid-output"
  | "disposed";

export class ModelDecoderError extends Error {
  readonly code: ModelDecoderErrorCode;
  readonly format?: ModelDecoderFormat;
  readonly assetId?: string;
  constructor(code: ModelDecoderErrorCode, message: string, details: { format?: ModelDecoderFormat; assetId?: string } = {}) {
    super(message);
    this.name = "ModelDecoderError";
    this.code = code;
    this.format = details.format;
    this.assetId = details.assetId;
  }
}

const formats = new Set<ModelDecoderFormat>(["draco", "meshopt", "ktx2-basis"]);
const sha256Pattern = /^[0-9a-f]{64}$/i;
const abortError = (format: ModelDecoderFormat, assetId: string, timeout: boolean) =>
  new ModelDecoderError(timeout ? "timeout" : "aborted", timeout ? `Model decoder timed out: ${assetId}` : `Model decoder cancelled: ${assetId}`, { format, assetId });

function validateDescriptor(descriptor: ModelDecoderDescriptor): void {
  if (!descriptor || !formats.has(descriptor.format) || !descriptor.name || !descriptor.version || !sha256Pattern.test(descriptor.integritySha256))
    throw new ModelDecoderError("invalid-adapter", "A decoder descriptor requires a format, name, version and SHA-256 integrity.");
}

function validatePayload(payload: ModelDecodedPayload, format: ModelDecoderFormat, assetId: string): ModelDecodedPayload {
  if (!payload || payload.assetId !== assetId || payload.format !== format || !Number.isSafeInteger(payload.byteLength) || payload.byteLength < 0 || typeof payload.release !== "function")
    throw new ModelDecoderError("invalid-output", `Decoder returned an invalid payload for ${assetId}.`, { format, assetId });
  let released = false;
  return Object.freeze({ ...payload, release: () => { if (!released) { released = true; payload.release(); } } });
}

function combinedSignal(source: AbortSignal | undefined, timeoutMs: number, format: ModelDecoderFormat, assetId: string): { signal: AbortSignal; controller: AbortController; timedOut: () => boolean; cleanup: () => void } {
  const controller = new AbortController();
  let timeout = false;
  const abort = () => controller.abort(source?.reason);
  if (source?.aborted) controller.abort(source.reason);
  else source?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timeout = true; controller.abort(); }, timeoutMs);
  return { signal: controller.signal, controller, timedOut: () => timeout, cleanup: () => { clearTimeout(timer); source?.removeEventListener("abort", abort); } };
}

/**
 * Shared lifecycle boundary for optional compressed model decoders.
 * Registration does not make a format supported by the glTF importer; a
 * decoder still needs an importer adapter and target-device evidence before
 * the capability catalog can be promoted.
 */
export class ZhudaModelDecoderRegistry {
  private readonly adapters = new Map<ModelDecoderFormat, ModelDecoderAdapter>();
  private readonly active = new Set<AbortController>();
  private readonly timeoutMs: number;
  private readonly maxInputBytes: number;
  private disposed = false;
  constructor(options: ModelDecoderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxInputBytes = options.maxInputBytes ?? 256 * 1024 * 1024;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) throw Error("Invalid decoder timeout");
    if (!Number.isSafeInteger(this.maxInputBytes) || this.maxInputBytes <= 0) throw Error("Invalid decoder input bound");
  }
  register(adapter: ModelDecoderAdapter): () => void {
    if (this.disposed) throw new ModelDecoderError("disposed", "Decoder registry is disposed.");
    validateDescriptor(adapter?.descriptor);
    const { format } = adapter.descriptor;
    if (this.adapters.has(format)) throw new ModelDecoderError("invalid-adapter", `A ${format} decoder is already registered.`, { format });
    this.adapters.set(format, adapter);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.adapters.get(format) === adapter) this.adapters.delete(format);
      adapter.dispose?.();
    };
  }
  has(format: ModelDecoderFormat): boolean { return this.adapters.has(format); }
  async decode(format: ModelDecoderFormat, assetId: string, bytes: Uint8Array, options: ModelDecodeRequestOptions = {}): Promise<ModelDecodedPayload> {
    if (this.disposed) throw new ModelDecoderError("disposed", "Decoder registry is disposed.", { format, assetId });
    if (!formats.has(format) || !assetId) throw new ModelDecoderError("invalid-input", "Decoder format and assetId are required.", { format, assetId });
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > (options.maxInputBytes ?? this.maxInputBytes))
      throw new ModelDecoderError("invalid-input", `Decoder input exceeds the configured bound: ${assetId}.`, { format, assetId });
    if (options.signal?.aborted) throw abortError(format, assetId, false);
    const adapter = this.adapters.get(format);
    if (!adapter) throw new ModelDecoderError("unsupported", `No ${format} decoder is registered.`, { format, assetId });
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new ModelDecoderError("invalid-input", "Invalid decoder timeout.", { format, assetId });
    const combined = combinedSignal(options.signal, timeoutMs, format, assetId);
    this.active.add(combined.controller);
    try {
      let payload: ModelDecodedPayload;
      try {
        payload = await adapter.decode({ assetId, bytes, signal: combined.signal });
      } catch (error) {
        if (combined.signal.aborted) throw abortError(format, assetId, combined.timedOut());
        throw error;
      }
      if (combined.signal.aborted || this.disposed) {
        try { validatePayload(payload, format, assetId).release(); } catch { /* invalid late output has no safe owner */ }
        throw abortError(format, assetId, combined.timedOut());
      }
      return validatePayload(payload, format, assetId);
    } finally {
      combined.cleanup();
      this.active.delete(combined.controller);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active) controller.abort();
    for (const adapter of this.adapters.values()) adapter.dispose?.();
    this.adapters.clear();
  }
}
