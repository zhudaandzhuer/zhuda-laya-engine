# Agent task: procedural-pipeline

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-10

## Source requirement

An external contribution on top of 1.16.0 (`472cea5`) adds a procedural asset
pipeline and fixes follow-up review findings. The user asked us to verify the
contribution's claims and land it on `main`.

## Scope

### Engine

- `packages/core/procedural/`: texture recipes baked on the CPU, geometry kit,
  prop factory with colliders and per-material merging, synthesised audio,
  `ProceduralAssetProvider`, module boot contract and seeded random streams.
- Neutral starter recipes and props on `zhuda-laya-engine/demo`; MCP
  `validate_texture_recipe` and `validate_synth_recipe`.
- Review fixes: editors refuse non-loopback binds without `--allow-remote`
  (then a one-time key becomes a per-port HttpOnly session cookie); preview
  server Host check and malformed-URL handling; asset downloads abort on
  rejection and `unlisted: 'reject'`; `npm pack --json` stays valid JSON;
  `exports` no longer fall back to `.ts`; `npm start` without Python;
  TypeScript pinned to 5.9.3; truthful Bullet and version reporting.

### Consumer or adapter

- None. Recipes, props and surface meanings a game uses stay in its own
  repository.

## Non-goals

GPU baking, WebGPU or mobile acceptance, art approval of the starter samples.

## Acceptance checks

1. `npm ci`, `npm run verify`, lint and format pass on Node 24+.
2. Generated declarations are current under the pinned TypeScript.
3. Editor, preview and asset-provider hardening have regression tests,
   including a deliberate failure for each fix made while landing.
4. A real WebGL draw shows merged prop batches, mipmapped uploads, and normal
   maps that shade like real geometry on both texture axes.
5. Existing browser batches still pass.

## Result

See [verification.md](verification.md).
