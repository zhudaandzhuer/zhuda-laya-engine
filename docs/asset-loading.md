# Asset loading boundary

Consumer projects use logical asset IDs through an `AssetProvider`. The game and
engine code must not depend on a directory layout, a ZIP entry, or a future
encrypted container.

The default provider is `DirectoryAssetProvider`. It resolves normalized IDs
under a base URL, applies an abortable timeout, limits response size, reports
download and verification progress, and can verify a manifest SHA-256. A future
packed or Rust/WASM provider implements the same `AssetProvider` interface.

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
explicit destruction. This is the seam for a later packed provider; no packed
format is part of the engine runtime yet.

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
