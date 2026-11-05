import {normalizeAssetId, type AssetProvider, type AssetManifest, type AssetManifestEntry, type AssetLoadOptions, type LoadedAssetBytes} from './AssetProvider.ts';
import {ZhudaRequestSlot} from './Assets.ts';
import {withDeadline} from './AsyncDeadline.ts';

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
function identity(value: string): void {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value)) throw Error('Invalid theme identity');
}
function budget(value: number | undefined): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw Error('Invalid theme budget');
}
/** Returns an immutable snapshot. Checks metadata; decoded Spine/font/layout checks belong in prepare. */
export function validateThemeManifest(value: ZhudaThemeManifest, contract: ZhudaThemeContract): ZhudaThemeManifest {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.assets) || !contract || !Array.isArray(contract.required)) throw Error('Invalid theme schema');
  identity(value.id); identity(value.revision); identity(value.contractId); identity(contract.id);
  if (value.contractId !== contract.id) throw Error('Theme contract mismatch');
  budget(value.estimatedDecodedBytes); budget(contract.maxDownloadBytes); budget(contract.maxEstimatedDecodedBytes);
  if (value.estimatedDecodedBytes === undefined) throw Error('Missing decoded theme estimate');
  const ids = new Set<string>(); let bytes = 0;
  const assets = value.assets.map(entry => {
    if (!entry || normalizeAssetId(entry.id) !== entry.id || normalizeAssetId(entry.source) !== entry.source || ids.has(entry.id)) throw Error('Duplicate or invalid theme asset');
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw Error('Theme asset requires bytes and lowercase SHA-256: ' + entry.id);
    if (entry.kind !== undefined && !['binary','text','image','audio','model','scene','shader','unknown'].includes(entry.kind)) throw Error('Invalid theme asset kind');
    if (entry.formatVersion !== undefined && (typeof entry.formatVersion !== 'string' || !entry.formatVersion)) throw Error('Invalid theme formatVersion');
    ids.add(entry.id); bytes += entry.bytes;
    return Object.freeze({...entry});
  });
  const required = new Set<string>();
  for (const need of contract.required) {
    if (normalizeAssetId(need.id) !== need.id || required.has(need.id)) throw Error('Invalid theme requirement');
    required.add(need.id);
    const found = assets.find(a => a.id === need.id);
    if (!found || (need.kind && need.kind !== found.kind) || (need.formatVersion && need.formatVersion !== found.formatVersion)) throw Error('Missing/incompatible theme asset: ' + need.id);
  }
  if (!Number.isSafeInteger(bytes) || bytes > (contract.maxDownloadBytes ?? Infinity)) throw Error('Theme download budget exceeded');
  if (value.estimatedDecodedBytes > (contract.maxEstimatedDecodedBytes ?? Infinity)) throw Error('Theme decoded estimate budget exceeded');
  return Object.freeze({...value, assets: Object.freeze(assets)});
}
/** Borrows source, owns in-flight operations and returned byte leases. No second cache. */
export class ZhudaThemeAssetProvider implements AssetProvider {
  readonly name: string;
  readonly manifest: ZhudaThemeManifest;
  private readonly source: AssetProvider;
  private readonly lifetime = new AbortController();
  private readonly releases = new Set<() => void>();
  private readonly timeoutMs: number;
  constructor(source: AssetProvider, manifest: ZhudaThemeManifest, contract: ZhudaThemeContract, timeoutMs = 15_000) {
    this.manifest = validateThemeManifest(manifest, contract);
    this.name = `theme:${manifest.id}:${manifest.revision}`;
    this.source = source; this.timeoutMs = timeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw Error('Invalid IO timeoutMs');
  }
  /** Namespace a caller's shared cache key; never reuse bare logical IDs between providers. */
  cacheKey(id: string): string {
    const entry = this.entry(id);
    return JSON.stringify([this.manifest.id, this.manifest.revision, entry.id, entry.sha256]);
  }
  private entry(id: string): ZhudaThemeAsset {
    if (this.lifetime.signal.aborted) throw Error('Disposed theme provider');
    const entry = this.manifest.assets.find(a => a.id === normalizeAssetId(id));
    if (!entry) throw Error('Unmapped theme asset: ' + id);
    return entry;
  }
  async getManifest(signal?: AbortSignal): Promise<AssetManifest> {
    if (this.lifetime.signal.aborted || signal?.aborted) throw new DOMException('Cancelled theme manifest', 'AbortError');
    return {schemaVersion: 1, entries: this.manifest.assets.map(({source: _source, ...entry}) => entry)};
  }
  async load(id: string, options: AssetLoadOptions = {}): Promise<LoadedAssetBytes> {
    const entry = this.entry(id);
    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException('Theme load cancelled', 'AbortError'));
    const signals = [this.lifetime.signal, options.signal].filter((s): s is AbortSignal => !!s);
    for (const signal of signals) { signal.addEventListener('abort', abort, {once: true}); if (signal.aborted) abort(); }
    try {
      const asset = await withDeadline(async signal => {
        const raw = await this.source.load(entry.source, {...options, signal, maxBytes: Math.min(entry.bytes || 1, options.maxBytes ?? Infinity), onProgress: p => options.onProgress?.({...p, id: entry.id})});
        try {
          if (raw.bytes.byteLength !== entry.bytes || raw.bytes.byteLength > (options.maxBytes ?? Infinity)) throw Error('Theme asset size mismatch: ' + id);
          const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(raw.bytes).buffer);
          const sha = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
          if (sha !== entry.sha256) throw Error('Theme asset integrity mismatch: ' + id);
          return raw;
        } catch (error) { raw.release?.(); throw error; }
      }, {signal: controller.signal, timeoutMs: this.timeoutMs}, raw => raw.release?.());
      let released = false;
      const release = () => { if (released) return; released = true; this.releases.delete(release); asset.release?.(); };
      if (controller.signal.aborted) { release(); throw controller.signal.reason; }
      this.releases.add(release);
      // Preserve logical identity, required by the Prefab texture/provider contract.
      return {id: entry.id, bytes: asset.bytes, manifest: {...entry}, release};
    } finally { for (const signal of signals) signal.removeEventListener('abort', abort); }
  }
  dispose(): void {
    if (this.lifetime.signal.aborted) return;
    this.lifetime.abort();
    const errors: unknown[] = [];
    for (const release of [...this.releases]) {try {release();} catch (error) {errors.push(error);}}
    if (errors.length) throw Object.assign(Error("Theme release failed"), {errors});
  }
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
export class ZhudaThemeController<T> {
  private readonly slot = new ZhudaRequestSlot();
  private active: (ZhudaActiveTheme<T> & {dispose(): void}) | null = null;
  private disposed = false;
  private readonly contract: ZhudaThemeContract;
  private readonly source: AssetProvider;
  private readonly maxTransitionEstimatedBytes: number;
  constructor(source: AssetProvider, contract: ZhudaThemeContract, maxTransitionEstimatedBytes = Infinity) {
    this.source = source; this.maxTransitionEstimatedBytes = maxTransitionEstimatedBytes;
    this.contract = {...contract, required: contract.required.map(r => ({...r}))};
    if (maxTransitionEstimatedBytes !== Infinity) budget(maxTransitionEstimatedBytes);
  }
  get current(): ZhudaActiveTheme<T> | null { return this.active; }
  async replace(manifest: ZhudaThemeManifest, prepare: (provider: ZhudaThemeAssetProvider, signal: AbortSignal) => Promise<ZhudaPreparedTheme<T>>, options: {signal?: AbortSignal; timeoutMs?: number} = {}): Promise<boolean> {
    if (this.disposed) throw Error('Disposed theme controller');
    const snapshot = validateThemeManifest(manifest, this.contract);
    if (snapshot.estimatedDecodedBytes + (this.active?.manifest.estimatedDecodedBytes ?? 0) > this.maxTransitionEstimatedBytes) throw Error('Theme transition estimate budget exceeded');
    let retirementError: unknown;
    const changed = await this.slot.replace(async signal => {
      const provider = new ZhudaThemeAssetProvider(this.source, snapshot, this.contract, options.timeoutMs);
      const controller = new AbortController();
      const abort = () => controller.abort(new DOMException('Theme preparation cancelled', 'AbortError'));
      for (const s of [signal, options.signal]) { s?.addEventListener('abort', abort, {once:true}); if (s?.aborted) abort(); }
      try {
        const prepared = await withDeadline(s => prepare(provider, s), {signal: controller.signal, timeoutMs: options.timeoutMs}, value => value.dispose());
        let disposed = false;
        return Object.freeze({manifest:snapshot, provider, value:prepared.value, dispose:() => {if (disposed) return; disposed = true; try {prepared.dispose();} finally {provider.dispose();}}});
      } catch (error) {provider.dispose(); throw error;}
      finally {for (const s of [signal, options.signal]) s?.removeEventListener('abort', abort);}
    }, value => {
      const old = this.active; this.active = value;
      // Retire synchronously; a cleanup error must not discard the new owner.
      try {old?.dispose();} catch (error) {retirementError = error;}
    }, value => value.dispose());
    if (retirementError) throw retirementError;
    return changed;
  }
  cancel(): void {this.slot.cancel();}
  clear(): void {this.slot.cancel(); const old = this.active; this.active = null; old?.dispose();}
  dispose(): void {if (this.disposed) return; this.disposed = true; this.clear();}
}
