import { normalizeAssetId } from './AssetProvider.ts';
import { awaitAbortable } from './AsyncOperation.ts';
export type ModelDecoderFormat = 'draco' | 'meshopt' | 'ktx2-basis';

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

export type ModelDecoderErrorCode =
  | 'invalid-adapter'
  | 'unsupported'
  | 'invalid-input'
  | 'aborted'
  | 'timeout'
  | 'invalid-output'
  | 'disposed';

export class ModelDecoderError extends Error {
  readonly code: ModelDecoderErrorCode;
  readonly format?: ModelDecoderFormat;
  readonly assetId?: string;
  constructor(
    code: ModelDecoderErrorCode,
    message: string,
    details: { format?: ModelDecoderFormat; assetId?: string } = {},
  ) {
    super(message);
    this.name = 'ModelDecoderError';
    this.code = code;
    this.format = details.format;
    this.assetId = details.assetId;
  }
}

const formats = new Set<ModelDecoderFormat>(['draco', 'meshopt', 'ktx2-basis']);
const sha256Pattern = /^[0-9a-f]{64}$/i;
const abortError = (format: ModelDecoderFormat, assetId: string, timeout: boolean) =>
  new ModelDecoderError(
    timeout ? 'timeout' : 'aborted',
    timeout ? `Model decoder timed out: ${assetId}` : `Model decoder cancelled: ${assetId}`,
    { format, assetId },
  );

function validateDescriptor(descriptor: ModelDecoderDescriptor): void {
  if (
    !descriptor ||
    !formats.has(descriptor.format) ||
    typeof descriptor.name !== 'string' ||
    !descriptor.name.trim() ||
    typeof descriptor.version !== 'string' ||
    !descriptor.version.trim() ||
    typeof descriptor.integritySha256 !== 'string' ||
    !sha256Pattern.test(descriptor.integritySha256)
  )
    throw new ModelDecoderError(
      'invalid-adapter',
      'A decoder descriptor requires a format, name, version and SHA-256 metadata.',
    );
}
function positive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
function releasePayload(payload: ModelDecodedPayload): void {
  if (typeof payload?.release === 'function') payload.release();
}
type Registration = {
  adapter: ModelDecoderAdapter;
  requests: Set<AbortController>;
  pending: number;
  leases: number;
  retired: boolean;
  disposed: boolean;
};

/** Optional decoder lifecycle. Metadata is not artifact verification or importer support. */
export class ZhudaModelDecoderRegistry {
  private readonly adapters = new Map<ModelDecoderFormat, Registration>();
  private readonly timeoutMs: number;
  private readonly maxInputBytes: number;
  private readonly maxOutputBytes: number;
  private disposed = false;
  constructor(options: ModelDecoderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxInputBytes = options.maxInputBytes ?? 256 * 1024 * 1024;
    this.maxOutputBytes = options.maxOutputBytes ?? 256 * 1024 * 1024;
    if (
      !positive(this.timeoutMs) ||
      this.timeoutMs > 2_147_483_647 ||
      !positive(this.maxInputBytes) ||
      !positive(this.maxOutputBytes)
    )
      throw Error('Invalid decoder limits');
  }
  private drain(entry: Registration): void {
    if (entry.retired && !entry.pending && !entry.leases && !entry.disposed) {
      entry.disposed = true;
      entry.adapter.dispose?.();
    }
  }
  private retire(entry: Registration): void {
    if (entry.retired) return;
    entry.retired = true;
    for (const controller of entry.requests)
      controller.abort(new DOMException('Decoder retired', 'AbortError'));
    this.drain(entry);
  }
  register(adapter: ModelDecoderAdapter): () => void {
    if (this.disposed) throw new ModelDecoderError('disposed', 'Decoder registry is disposed.');
    validateDescriptor(adapter?.descriptor);
    if (
      typeof adapter.decode !== 'function' ||
      (adapter.dispose !== undefined && typeof adapter.dispose !== 'function')
    )
      throw new ModelDecoderError(
        'invalid-adapter',
        'Decoder requires decode and an optional dispose function.',
      );
    const { format } = adapter.descriptor;
    if (this.adapters.has(format))
      throw new ModelDecoderError('invalid-adapter', `A ${format} decoder is already registered.`, {
        format,
      });
    const entry: Registration = {
      adapter,
      requests: new Set(),
      pending: 0,
      leases: 0,
      retired: false,
      disposed: false,
    };
    this.adapters.set(format, entry);
    return () => {
      if (this.adapters.get(format) === entry) this.adapters.delete(format);
      this.retire(entry);
    };
  }
  has(format: ModelDecoderFormat): boolean {
    return this.adapters.has(format);
  }
  async decode(
    format: ModelDecoderFormat,
    assetId: string,
    bytes: Uint8Array,
    options: ModelDecodeRequestOptions = {},
  ): Promise<ModelDecodedPayload> {
    if (this.disposed)
      throw new ModelDecoderError('disposed', 'Decoder registry is disposed.', { format, assetId });
    if (!formats.has(format) || normalizeAssetId(assetId) !== assetId)
      throw new ModelDecoderError('invalid-input', 'A normalized logical asset ID is required.', {
        format,
        assetId,
      });
    const timeoutMs = options.timeoutMs ?? this.timeoutMs,
      inputLimit = options.maxInputBytes ?? this.maxInputBytes,
      outputLimit = options.maxOutputBytes ?? this.maxOutputBytes;
    if (
      !positive(timeoutMs) ||
      timeoutMs > 2_147_483_647 ||
      !positive(inputLimit) ||
      !positive(outputLimit) ||
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength > inputLimit
    )
      throw new ModelDecoderError('invalid-input', `Invalid decoder bounds/input: ${assetId}.`, {
        format,
        assetId,
      });
    if (options.signal?.aborted) throw abortError(format, assetId, false);
    const entry = this.adapters.get(format);
    if (!entry)
      throw new ModelDecoderError('unsupported', `No ${format} decoder is registered.`, {
        format,
        assetId,
      });
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    entry.requests.add(controller);
    entry.pending++;
    // Snapshot bytes: caller mutation/release cannot affect an asynchronous decode.
    const input = new Uint8Array(bytes);
    const work = Promise.resolve()
      .then(async () => {
        if (controller.signal.aborted) throw abortError(format, assetId, timedOut);
        const payload = await entry.adapter.decode({
          assetId,
          bytes: input,
          signal: controller.signal,
          maxOutputBytes: outputLimit,
        });
        if (
          !payload ||
          payload.assetId !== assetId ||
          payload.format !== format ||
          !Number.isSafeInteger(payload.byteLength) ||
          payload.byteLength < 0 ||
          payload.byteLength > outputLimit ||
          typeof payload.release !== 'function'
        ) {
          releasePayload(payload);
          throw new ModelDecoderError(
            'invalid-output',
            `Invalid or oversized decoder output: ${assetId}`,
            { format, assetId },
          );
        }
        entry.leases++;
        let released = false;
        return Object.freeze({
          assetId,
          format,
          data: payload.data,
          byteLength: payload.byteLength,
          release: () => {
            if (released) return;
            released = true;
            try {
              payload.release();
            } finally {
              entry.leases--;
              this.drain(entry);
            }
          },
        });
      })
      .finally(() => {
        entry.pending--;
        entry.requests.delete(controller);
        this.drain(entry);
      });
    try {
      return await awaitAbortable(work, controller.signal, releasePayload);
    } catch (error) {
      if (controller.signal.aborted) throw abortError(format, assetId, timedOut);
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const entries = [...this.adapters.values()];
    this.adapters.clear();
    for (const entry of entries) this.retire(entry);
  }
}
