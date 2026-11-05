# Asset loading boundary

Consumer projects use logical asset IDs through an `AssetProvider`. The game and
engine code must not depend on a directory layout, a ZIP entry, or a future
encrypted container.

The default provider is `DirectoryAssetProvider`. It resolves normalized IDs
under a base URL, applies an abortable timeout, limits response size, reports
download and verification progress, and can verify a manifest SHA-256.
`ChunkedAssetProvider` is the first optional delivery layer for heavy scenes: it
fetches a bounded chunk (SHA-verified when a digest is supplied), copies the requested logical range and
returns the same `AssetProvider` result. Scenes still know only logical IDs.

```ts
const assets = new DirectoryAssetProvider({
  baseUrl: "/assets/",
  manifestUrl: "/assets/manifest.json",
});
const glb = await assets.load("vehicles/s800.glb", {
  onProgress: (p) => console.log(p.phase, p.loadedBytes),
});
// Decode synchronously or copy into the consumer's decoder, then release the
// returned Uint8Array reference. Do not retain a view into a future WASM heap.
```

`createProviderAssetCache` adapts a provider to `ZhudaAssetCache`, retaining
shared in-flight requests, per-caller cancellation, bounded idle ownership and
explicit destruction. Chunk bytes are an optional delivery format through this
same seam; no encrypted/WASM vault is shipped.

```ts
const assets = new ChunkedAssetProvider({
  baseUrl: "/assets/",
  manifest: {
    schemaVersion: 1,
    chunks: [{id: "scene-1", url: "chunks/scene-1.bin", /* optional real SHA-256 belongs here */ bytes: 1234}],
    assets: [{id: "scenes/harbor.glb", chunk: "scene-1", offset: 0, length: 1234, kind: "model"}],
  },
});
const scene = await assets.load("scenes/harbor.glb", {signal});
```

The provider snapshots its manifest and validates chunk URL scope, byte ranges,
chunk and asset checksums, timeouts and cancellation. SHA checks are optional;
supply actual digests to require integrity. The existing `ZhudaAssetCache`
shares in-flight chunks and holds at most `maxCachedChunks` idle chunks (default
4, zero disables warm retention); active leased chunks are additional memory.
Each chunk is limited to `maxChunkBytes`, including streamed responses without
Content-Length. Requests have independent cancellation. Disposal/timeout cannot
repopulate the cache with late bytes. Returned assets are independent copies;
caller mutation does not corrupt cached chunk data. The provider downloads
whole chunks; it does not issue HTTP Range requests. It is a delivery
experiment, not a claim that a particular chunk split improves startup or GPU
memory; use the asset-packaging plan's device measurements before selecting it
for production.

## Rules for consumers

- Use slash-separated logical IDs and normalize them once at the provider edge.
- Keep manifest entries explicit: kind, decoded byte size, optional SHA-256,
  format version and optional future chunk ID.
- Manifest IDs must be normalized, unique and slash-separated. The provider
  rejects traversal, URL/query syntax and duplicate entries before loading.
- Treat provider errors as recoverable loading states with retry or a clear
  error screen. Never wait forever for a fetch or WASM initialization promise.
- Release decoded model, texture, audio and scene resources through their
  existing leases. A provider does not own GPU resources.
- Keep development on directory assets until the project is stable. Production
  can choose plain files, CDN chunks, ZIP chunks or a Rust/WASM provider without
  changing gameplay code.

## Media stream leases

An optional `openStream(id, {signal})` exposes a provider-owned media address
through `AssetStreamLease`, including delivery, integrity, retained-byte count
and idempotent `release`. The mixer shares these leases through `ZhudaAssetCache`.
Keep a lease live until all voices using its URL have disconnected.

`DirectoryAssetProvider` defaults to `streamMode:'verified-blob'`: it uses the
existing bounded byte loader and manifest checks, then owns/revokes a Blob URL.
Native mode is opt-in and refuses SHA-required entries because browser range
playback cannot prove the full-file checksum. Native playback failures are
asynchronous media failures rather than successful load evidence. Provider
teardown revokes outstanding owned URLs; dispose consumers first. See
[audio](audio.md) for playback, memory and lifetime rules.

## 1.8.0 模型接入

`ZhudaModelLibrary({provider,maxIdle,timeoutMs})` 接受邏輯 ID 的自包含 GLB／內嵌 glTF，共用離場模板及動畫，完整處理租約與取消／逾時。外部 URI 依賴在 provider 模式會拒絕。型別、遷移與所有權見 [群體模型契約](crowd-runtime.md#模型與動畫的所有權)。
