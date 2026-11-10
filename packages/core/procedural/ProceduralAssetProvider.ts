/**
 * Generated assets behind the normal `AssetProvider` boundary. Scene and
 * gameplay code keep asking for logical IDs; whether the bytes were computed
 * here or downloaded by the fallback provider stays a delivery detail.
 */
import {
  AssetProviderError,
  normalizeAssetId,
  type AssetKind,
  type AssetLoadOptions,
  type AssetManifest,
  type AssetProvider,
  type LoadedAssetBytes,
} from '../runtime3d/AssetProvider.ts';

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

export class ProceduralAssetProvider implements AssetProvider {
  readonly name = 'procedural';
  private readonly generators = new Map<
    string,
    { generate: ZhudaProceduralGenerator; kind: AssetKind }
  >();
  private readonly fallback?: AssetProvider;
  private readonly maxBytes: number;
  private disposed = false;

  constructor(options: ProceduralAssetProviderOptions = {}) {
    this.fallback = options.fallback;
    this.maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    if (!Number.isInteger(this.maxBytes) || this.maxBytes <= 0)
      throw Error('maxBytes must be a positive integer');
  }

  register(id: string, generate: ZhudaProceduralGenerator, kind: AssetKind = 'binary'): this {
    const key = normalizeAssetId(id);
    if (typeof generate !== 'function') throw Error(`Generator required for ${key}`);
    if (this.generators.has(key)) throw Error(`Duplicate procedural asset: ${key}`);
    this.generators.set(key, { generate, kind });
    return this;
  }

  has(id: string): boolean {
    return this.generators.has(normalizeAssetId(id));
  }

  async load(value: string, options: AssetLoadOptions = {}): Promise<LoadedAssetBytes> {
    if (this.disposed) throw new AssetProviderError('disposed', 'Asset provider disposed');
    const id = normalizeAssetId(value),
      entry = this.generators.get(id);
    if (!entry) {
      if (this.fallback) return this.fallback.load(id, options);
      throw new AssetProviderError('http', `No generator or fallback for asset: ${id}`, {
        id,
        status: 404,
      });
    }
    const cancelled = () =>
      new AssetProviderError('aborted', `Asset request cancelled: ${id}`, { id });
    if (options.signal?.aborted) throw cancelled();
    options.onProgress?.({ id, phase: 'downloading', loadedBytes: 0 });
    const bytes = await entry.generate({ id, signal: options.signal });
    if (options.signal?.aborted) throw cancelled();
    if (this.disposed) throw new AssetProviderError('disposed', 'Asset provider disposed');
    if (!(bytes instanceof Uint8Array))
      throw new AssetProviderError('integrity', `Generator for ${id} must return a Uint8Array`, {
        id,
      });
    const limit = options.maxBytes ?? this.maxBytes;
    if (bytes.byteLength > limit)
      throw new AssetProviderError('too-large', `Asset exceeds ${limit} bytes: ${id}`, { id });
    options.onProgress?.({
      id,
      phase: 'ready',
      loadedBytes: bytes.byteLength,
      totalBytes: bytes.byteLength,
    });
    return { id, bytes, manifest: { id, kind: entry.kind, bytes: bytes.byteLength } };
  }

  /** Lists generated IDs only; the fallback keeps its own manifest. */
  async getManifest(): Promise<AssetManifest> {
    return {
      schemaVersion: 1,
      entries: [...this.generators.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([id, entry]) => ({ id, kind: entry.kind })),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.generators.clear();
  }
}
