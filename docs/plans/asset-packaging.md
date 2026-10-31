# Deferred asset packaging

Status: Proposed  
Owner: Engine and consumer integration  
Last reviewed: 2026-10-31

## Objective

Choose a production asset delivery format after the game projects, asset
inventory and startup path are stable. The selected format must preserve the
current asset lifecycle, load error behavior and device compatibility while
allowing future chunking or packing.

The project must remain playable with ordinary web assets during development.
Packing is a delivery layer, not a new source of truth for gameplay, scene
layout, Spine presentation or rendering rules.

## Current baseline

- Consumers address resources through the public `AssetProvider` boundary.
- `DirectoryAssetProvider` is the current web and development provider. It has
  normalized logical IDs, timeout, cancellation, bounded reads, progress,
  manifest validation and optional SHA-256 verification.
- `createProviderAssetCache` adapts a provider to the existing shared cache,
  leases and destruction rules.
- The current consumer build still emits normal web files and a bounded ZIP
  archive for build evidence. No Rust/WASM vault is part of the runtime.
- The engine source and public types live in `packages/core/runtime3d` and
  `packages/types/runtime3d`; game assets and game-specific manifests stay in
  consumer repositories.

See [asset-loading.md](../asset-loading.md) and the provider tests in
`tests/asset-provider.test.mjs` for the accepted baseline.

## Non-goals

- Making browser assets impossible to extract. A browser must receive decoded
  bytes, so any client-side encryption is a deterrent and packaging measure.
- Moving game rules, payout authority, network authority or art into the engine.
- Replacing Laya resource lifecycle or GPU ownership with a second asset system.
- Claiming a fixed package size or startup time before real assets and devices
  are measured.

## Entry criteria

Do not start a packed implementation until all of these are available:

1. A complete asset inventory with logical IDs, kinds, decoded sizes and format
   versions (including Spine 4.2 data where applicable).
2. A representative startup slice and at least one heavy scene using the
   directory provider.
3. Baseline measurements on desktop, iPhone Safari and Android Chrome:
   download bytes, time to first frame, time to playable, peak JS/WASM/GPU
   memory and repeated scene load/unload counts.
4. A consumer error screen that can retry or fall back to ordinary assets.

## Options to measure

### A. Plain files with HTTP compression

Keep the directory provider, use immutable content hashes and Brotli/gzip at the
CDN. This is the default baseline because it has the fewest browser and iframe
failure modes.

### B. Chunked web delivery

Add a provider that maps manifest entries to independently cacheable chunks.
Load a small core chunk first and fetch heavy scenes or bonus content on demand.
Use ordinary HTTP responses or byte ranges; measure cache hit rate, seek
behavior, retries and memory peaks.

### C. Packed or Rust/WASM provider

Only consider this if A or B fails a stated product requirement. A packed
provider must implement the existing `AssetProvider` interface and must not leak
container details into scenes. It needs independently authenticated chunks,
bounded decompression, corrupt-package rejection, per-asset release handles and
a plain-provider fallback. It must work without `SharedArrayBuffer` so it can
run in third-party iframes.

## Staged implementation

1. **Inventory and fixtures** — generate a manifest from real consumer assets;
   reject duplicate IDs, traversal, unknown formats and missing Spine versions.
2. **Provider conformance** — run the same fixture suite against the directory
   provider and each candidate provider. Test cancellation, retry, timeout,
   stale results, checksum failure, truncated data and oversized decompression.
3. **Chunk experiment** — measure core/heavy splits with real network throttling,
   browser cache states and the target scenes. Do not use a synthetic 10 MB /
   8 ms claim as an acceptance threshold.
4. **Optional packed prototype** — keep it in a consumer or experimental package
   first. Parse and validate all lengths before allocation; use per-chunk nonces
   and authenticated metadata if encryption is selected. Never retain long-lived
   views into a growable WASM heap.
5. **Device gate** — test Chrome, Safari and Firefox desktop, iPhone Safari,
   Android Chrome, cross-origin iframe embedding, slow network, offline cache,
   context loss and 30 repeated load/unload cycles.
6. **Rollout decision** — record measured startup, memory, failure and support
   costs. Promote one provider behind a configuration switch; keep the directory
   provider for development and emergency fallback.

## Required failure behavior

The loader must show a bounded loading state, then a retry or fallback action.
The following cases must never become an unhandled rejection or an endless
spinner:

- stalled, partial or non-2xx network responses;
- missing or invalid manifest, checksum, format version or chunk;
- malformed header, offset, count or decompressed-size limit;
- WASM unsupported, initialization failure or memory exhaustion;
- image/audio decode failure and WebGL context loss;
- a scene or panel closing while its request is still in flight.

## Acceptance gates

- All provider implementations pass the same conformance tests.
- First frame and playable time are reported for cold cache, warm cache and
  throttled network; values are measured per device, not promised universally.
- Peak memory remains within the device budget and returns to a bounded level
  after 30 scene load/unload cycles.
- 4K/large assets are split or rejected before they can block the first frame.
- iPhone Safari, Android Chrome and cross-origin iframe runs have no white screen,
  endless loading state or unhandled provider errors.
- `npm run verify`, consumer build, real WebGL checks and the provider report
  pass before a production provider is selected.

## Rollback

If a packed provider fails any gate, keep `DirectoryAssetProvider` as the
production provider, retain the manifest and logical IDs, and remove only the
candidate provider. No gameplay or scene code should need to be reverted.
