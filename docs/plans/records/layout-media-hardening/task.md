# Layout and media hardening

Status: Accepted for the documented desktop/browser scope
Owner: Zhuda engine
Last reviewed: 2026-11-08

## Source requirement

User request: fix the shared engine problems that caused grid/layout failure,
text and bitmap-art drift, rotation/pivot confusion, and video/WebView content
being attached outside the Laya hierarchy.

## Goal

Give consumers one public, deterministic contract for design-space layout,
text metrics, bitmap-font registration, transform serialization and videos in a
Laya hierarchy, with strict checks that catch stale or unsupported usage.

## Invariants

- CSS design coordinates are independent from backing-pixel DPR.
- Prefab and Scene use the same authored `.lh`/`.ls` definition.
- LayaAir 3.4.2 remains the pinned vendor runtime and public types stay in sync.
- Consumers own game rules and assets; no consumer assets are copied here.
- Every created runtime surface has an explicit disposal path.

## Dependencies

- LayaAir 3.4.2 vendor declarations and `ZhudaAssetSerializer`.
- Existing Prefab/Scene compiler and public SDK export tests.

## Scope

### Engine

- `packages/core/ResponsiveLayout.ts`
- `packages/core/BitmapFontContract.ts`
- `packages/core/VideoSurface.ts`
- `packages/core/StaticAssetPipeline.ts`
- `packages/types/`
- version manifests, README and layout/media documentation

### Consumer or adapter

- None in this engine patch. Consumer video or native WebView adapters remain
  outside the engine and must use public contracts.

## Non-goals

- Claiming real iOS/Android/WebView2 or every browser codec without device evidence.
- Adding a second DOM renderer or a second audio/clock authority.
- Shipping game-specific scenes, fonts, models or slot-machine rules in the engine.

## Acceptance checks

1. `npm run verify` passes with package/config/lock/generated versions aligned.
2. Strict external TypeScript imports layout, BitmapFont and Video APIs.
3. Layout reports remain identical at DPR 1/2/3 and expose overflow instead of
   silently clipping.
4. Serialized and hydrated Laya nodes retain pivot/anchor/skew and text
   alignment/wrap/overflow properties.
5. Bitmap-font fallback is accepted only when declared and registered through
   the public helper; missing glyphs without fallback fail.
6. Video uses `Laya.VideoNode` in decoder mode and releases it exactly once.

## Evidence to attach

- `npm run verify` output and focused layout/media test output.
- `git diff --check` and version consistency check.
- Consumer device/WebView2 checks remain in each consumer's acceptance report.

## Unverified limits

- Native WebView embedding and mobile autoplay still require platform adapters
  and real-device evidence.
- Browser GPU behavior is covered by existing WebGL/WebGPU gates, not this unit
  contract alone.

## Rollback

Revert to `90749b319459af46182bcfd314c615bd3ca77ef8`, which is the last known
good engine commit before this hardening set. Consumers can continue using their
existing pinned SHA while the new release is reviewed.
