import type { ZhudaAssetCache } from "./Assets.ts";
import { ZhudaAssetCache as AssetCache } from "./Assets.ts";

export type AssetKind =
  | "binary"
  | "text"
  | "image"
  | "audio"
  | "model"
  | "scene"
  | "shader"
  | "unknown";

export type AssetProviderPhase =
  | "downloading"
  | "verifying"
  | "ready";

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

export class AssetProviderError extends Error {
  readonly code:
    | "invalid-id"
    | "aborted"
    | "timeout"
    | "http"
    | "too-large"
    | "integrity"
    | "disposed";
  readonly id?: string;
  readonly status?: number;

  constructor(
    code: AssetProviderError["code"],
    message: string,
    details: { id?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "AssetProviderError";
    this.code = code;
    this.id = details.id;
    this.status = details.status;
  }
}

/** Logical IDs are portable; URLs and filesystem paths are provider details. */
export function normalizeAssetId(value: string): string {
  if (typeof value !== "string")
    throw new AssetProviderError("invalid-id", "Asset id must be a string");
  let id = value.trim().replace(/\\/g, "/");
  while (id.startsWith("./")) id = id.slice(2);
  if (
    !id ||
    id.startsWith("/") ||
    id.includes("\0") ||
    /[?#]/.test(id) ||
    /^[a-z][a-z\d+.-]*:/i.test(id)
  )
    throw new AssetProviderError("invalid-id", `Invalid asset id: ${value}`);
  const parts: string[] = id.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".."))
    throw new AssetProviderError("invalid-id", `Invalid asset id: ${value}`);
  return parts.join("/");
}

export function validateAssetManifest(value: unknown): AssetManifest {
  if (!value || typeof value !== "object") throw Error("Invalid asset manifest");
  const manifest = value as Partial<AssetManifest>;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries))
    throw Error("Invalid asset manifest schema");
  const ids = new Set<string>();
  for (const candidate of manifest.entries) {
    if (!candidate || typeof candidate !== "object")
      throw Error("Invalid asset manifest entry");
    const entry = candidate as AssetManifestEntry;
    const id = normalizeAssetId(entry.id);
    if (id !== entry.id || ids.has(id))
      throw Error(`Duplicate or non-normalized asset id: ${entry.id}`);
    ids.add(id);
    if (
      entry.bytes !== undefined &&
      (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0)
    )
      throw Error(`Invalid asset byte size: ${id}`);
    if (entry.sha256 !== undefined && !/^[0-9a-f]{64}$/i.test(entry.sha256))
      throw Error(`Invalid asset checksum: ${id}`);
  }
  return manifest as AssetManifest;
}

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

function manifestIdFor(baseUrl: URL, value: string): string {
  const manifestUrl = new URL(value, baseUrl);
  if (
    manifestUrl.origin !== baseUrl.origin ||
    !manifestUrl.pathname.startsWith(baseUrl.pathname)
  )
    throw new AssetProviderError("invalid-id", "Manifest must be below the provider base URL");
  const id = decodeURIComponent(manifestUrl.pathname.slice(baseUrl.pathname.length));
  return normalizeAssetId(id);
}

function abortReason(signal: AbortSignal, id: string): AssetProviderError {
  return new AssetProviderError(
    signal.reason?.name === "TimeoutError" ? "timeout" : "aborted",
    signal.reason?.name === "TimeoutError"
      ? `Asset request timed out: ${id}`
      : `Asset request cancelled: ${id}`,
    { id },
  );
}

function combineSignals(
  source: AbortSignal | undefined,
  timeoutMs: number,
  id: string,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(source?.reason);
  if (source?.aborted) controller.abort(source.reason);
  else source?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Asset request timed out", "TimeoutError"));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      source?.removeEventListener("abort", abort);
      // Preserve the distinction for callers that inspect the resulting error.
      if (timedOut && !controller.signal.reason)
        controller.abort(new DOMException(`Asset request timed out: ${id}`, "TimeoutError"));
    },
  };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new AssetProviderError("integrity", "Web Crypto subtle.digest is unavailable");
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Plain URL-backed provider used by development and the initial consumer build. */
export class DirectoryAssetProvider implements AssetProvider {
  readonly name = "directory";
  private readonly baseUrl: URL;
  private manifest?: AssetManifest;
  private readonly manifestUrl?: string;
  private readonly manifestId?: string;
  private manifestPromise?: Promise<AssetManifest>;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly fetchImpl: FetchLike;
  private readonly active = new Set<AbortController>();
  private disposed = false;

  constructor(options: DirectoryAssetProviderOptions) {
    if (!options?.baseUrl) throw Error("DirectoryAssetProvider requires baseUrl");
    this.baseUrl = new URL(options.baseUrl, globalThis.location?.href || "http://localhost/");
    if (!this.baseUrl.pathname.endsWith("/")) this.baseUrl.pathname += "/";
    this.manifest = options.manifest ? validateAssetManifest(options.manifest) : undefined;
    this.manifestUrl = options.manifestUrl;
    this.manifestId = options.manifestUrl ? manifestIdFor(this.baseUrl, options.manifestUrl) : undefined;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxBytes = options.maxBytes ?? 128 * 1024 * 1024;
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0)
      throw Error("timeoutMs must be a positive integer");
    if (!Number.isInteger(this.maxBytes) || this.maxBytes <= 0)
      throw Error("maxBytes must be a positive integer");
  }

  async getManifest(signal?: AbortSignal): Promise<AssetManifest> {
    if (this.disposed) throw new AssetProviderError("disposed", "Asset provider disposed");
    if (this.manifest) return this.manifest;
    if (!this.manifestId) return { schemaVersion: 1, entries: [] };
    if (!this.manifestPromise) {
      const pending = (async () => {
        const result = await this.load(this.manifestId!, {
          signal,
          maxBytes: 2 * 1024 * 1024,
        });
        try {
          const parsed = JSON.parse(new TextDecoder().decode(result.bytes));
          this.manifest = validateAssetManifest(parsed);
          return this.manifest;
        } catch (error) {
          if (error instanceof AssetProviderError) throw error;
          throw new AssetProviderError("integrity", `Invalid asset manifest: ${this.manifestUrl}`);
        }
      })();
      this.manifestPromise = pending.catch((error) => {
        this.manifestPromise = undefined;
        throw error;
      });
    }
    return this.manifestPromise;
  }

  async load(value: string, options: AssetLoadOptions = {}): Promise<LoadedAssetBytes> {
    if (this.disposed) throw new AssetProviderError("disposed", "Asset provider disposed");
    const id = normalizeAssetId(value);
    if (this.manifestId && id !== this.manifestId && !this.manifest)
      await this.getManifest(options.signal);
    const entry = this.manifest?.entries.find((candidate) => candidate.id === id);
    const maxBytes = options.maxBytes ?? this.maxBytes;
    const url = new URL(id.split("/").map(encodeURIComponent).join("/"), this.baseUrl);
    const combined = combineSignals(options.signal, this.timeoutMs, id);
    const request = new AbortController();
    const relay = () => request.abort(combined.signal.reason);
    combined.signal.addEventListener("abort", relay, { once: true });
    this.active.add(request);
    try {
      options.onProgress?.({ id, phase: "downloading", loadedBytes: 0 });
      const response = await this.fetchImpl(url, { signal: request.signal });
      if (!response.ok)
        throw new AssetProviderError("http", `Asset HTTP ${response.status}: ${id}`, {
          id,
          status: response.status,
        });
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBytes)
        throw new AssetProviderError("too-large", `Asset exceeds ${maxBytes} bytes: ${id}`, { id });
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          total += next.value.byteLength;
          if (total > maxBytes)
            throw new AssetProviderError("too-large", `Asset exceeds ${maxBytes} bytes: ${id}`, { id });
          chunks.push(next.value);
          options.onProgress?.({ id, phase: "downloading", loadedBytes: total, totalBytes: contentLength || undefined });
        }
      } else {
        const data = new Uint8Array(await response.arrayBuffer());
        total = data.byteLength;
        if (total > maxBytes)
          throw new AssetProviderError("too-large", `Asset exceeds ${maxBytes} bytes: ${id}`, { id });
        chunks.push(data);
        options.onProgress?.({ id, phase: "downloading", loadedBytes: total, totalBytes: total });
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (entry?.bytes !== undefined && entry.bytes !== bytes.byteLength)
        throw new AssetProviderError("integrity", `Asset size mismatch: ${id}`, { id });
      if (entry?.sha256) {
        options.onProgress?.({ id, phase: "verifying", loadedBytes: total, totalBytes: total });
        if ((await sha256(bytes)) !== entry.sha256.toLowerCase())
          throw new AssetProviderError("integrity", `Asset checksum mismatch: ${id}`, { id });
      }
      options.onProgress?.({ id, phase: "ready", loadedBytes: total, totalBytes: total });
      return { id, bytes, manifest: entry };
    } catch (error) {
      if (combined.signal.aborted || request.signal.aborted) {
        if (combined.signal.reason?.name === "TimeoutError") throw abortReason(combined.signal, id);
        throw abortReason(combined.signal, id);
      }
      throw error;
    } finally {
      this.active.delete(request);
      combined.signal.removeEventListener("abort", relay);
      combined.cleanup();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active) controller.abort(new DOMException("Asset provider disposed", "AbortError"));
    this.active.clear();
  }
}

/** Adapts a provider to the existing bounded cache without changing cache callers. */
export function createProviderAssetCache<T>(
  provider: AssetProvider,
  decode: (asset: LoadedAssetBytes, signal: AbortSignal, phase: (phase: "parsing" | "ready") => void) => Promise<T> | T,
  destroy: (value: T) => void,
  maxIdle = 0,
): ZhudaAssetCache<T> {
  return new AssetCache(
    async (id, signal, phase) => {
      const asset = await provider.load(id, {
        signal,
        onProgress: ({ phase: providerPhase }) => phase(providerPhase === "ready" ? "ready" : "downloading"),
      });
      phase("parsing");
      try {
        return await decode(asset, signal, phase);
      } finally {
        asset.release?.();
      }
    },
    destroy,
    maxIdle,
  );
}
