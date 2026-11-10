# Verification: layout-media-hardening / 1.15.0

Source commit: `f1af173` (implementation: `dd9b5fd`).
Environment: macOS, Node/npm from the engine checkout, LayaAir 3.4.2 vendor
runtime. The acceptance scope is deterministic desktop/browser and strict
consumer integration; it does not claim native-device coverage.

## Engine checks

| Check | Result |
| --- | --- |
| `npm run verify` | PASS, 271 tests; build, strict typecheck, declaration audit and Doctor all passed |
| Layout/DPR contracts | PASS; grid and text calculations stay independent from backing-pixel DPR and expose overflow |
| BitmapFont contract | PASS; duplicate/missing glyphs, fallback coverage, authored advances, registration and unregister are covered |
| `.lh`/`.ls` serialization | PASS; pivot, anchor, skew, rotation, text padding, wrapping, overflow, spacing and decoration survive round-trip |
| Laya video/WebView contracts | PASS; `ZhudaVideoSurface` owns a decoder-mode `Laya.VideoNode`; `ZhudaWebViewSurface` requires an explicit platform adapter and anchor lifecycle |
| Browser SDK | PASS; six 1.15.0 profiles build deterministically with SRI and duplicate-runtime protection |

## Consumer checks

| Consumer | Result |
| --- | --- |
| `consumer A client` | PASS: 152 client tests + 6 Go transport tests; build, typecheck and Doctor passed |
| `consumer B client` | PASS: 6 tests; asset manifest, build, typecheck and Doctor passed |
| `consumer C client` | PASS: 95/95 gates; build, typecheck and Doctor passed |
| `consumer D client` | PASS: 19 tests; build, typecheck and Doctor passed |

## Hosted SDK

The fixed 1.15.0 browser bundle is published at
`https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/9c61e10983b1ba814a16104b4e790f0b/`.
The uploaded ZIP SHA-256 is
`b10b248deb2580c8cea2eafa81a1bfed451a6a2c8be894c9196d5c8e525120ac`; archive
size is 39,939,000 bytes and the response reports 16 files. The local ZIP hash
matched the publish response. Source browser templates now pin this release and
the exact per-profile SHA-384 values.

## Limits that remain explicit

- iOS/Android native playback, WebView2/native WebView adapters, device codec
  matrices, autoplay gesture recovery and hardware GPU evidence still require
  the target platform. The engine exposes the adapter contract; it cannot
  certify a platform it has not run on.
- One consumer still has a legacy DOM WebM effect pool for its own
  transparent-video art. It uses `pointer-events:none`, but migrating that
  consumer to `ZhudaVideoSurface` is a separate consumer change; the engine
  contract itself does not create an untracked DOM overlay.
- Consumer visual approval remains asset-specific. The deterministic layout and
  font reports catch coordinate/metric drift, but they do not approve a game's
  art direction or production artwork.
