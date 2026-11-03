# Task: preserve serialized texture draw commands

## Source requirement

The consumer migration report identified that `StaticAssetPipeline` silently
dropped Laya `DrawTextureCmd` entries while serializing a runtime hierarchy.
Prefab-first consumers must be able to keep a stable provider asset ID when a
procedural renderer still needs a texture draw command.

## Invariants

- `Image.skin` remains the preferred path for reusable UI artwork.
- Asset IDs remain provider IDs and are resolved through the existing loader;
  this change does not add a second asset cache or URL authority.
- Missing texture resources fail with a useful error instead of producing a
  silently incomplete prefab.
- Existing geometry commands and their explicit `percent: false` behavior are
  unchanged.

## Scope

- `packages/types/zhuda-static-assets.ts`
- `packages/types/zhuda-static-assets.d.ts`
- `packages/core/StaticAssetPipeline.ts`
- `tests/static-asset-calibration.test.mjs`

## Non-goals

- No consumer game assets or scene rules are added to the engine repository.
- No automatic conversion of a dynamic game Scene into production content.
- No claim of device or WebGL parity from the unit fixture alone.

## Acceptance evidence

- Serializer preserves a stable `textureId` for `DrawTextureCmd`.
- Hydration resolves a preloaded texture and calls `drawTexture`.
- A missing texture reports the texture ID.
- `npm run verify`, `git diff --check`, and `git status --short` from the
  repository root.

