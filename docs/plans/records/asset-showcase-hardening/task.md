# Agent task: asset-showcase-hardening

Status: Implemented; desktop verified. Seller/device acceptance deferred.

Owner: reusable model loading, inspection and showcase presentation

Last reviewed: 2026-11-05

## Source requirement

User: “好，去優化”, following the 3D asset seller assessment and the reproduced
ASSET-01/02/03 failures. Review and original fixtures:
`<external-evidence>/REVIEW.md`.
Baseline: 1.8.0 / `2e92e5932cac9128f3e33309719a0e035af9ca5e`.

## Goal

A consumer can load supported glTF assets without silently losing required
features, preserve static and animated morphs, inspect compatibility and model
contents, and present the same owned instance in Raw/Gameplay/Cinematic modes.

## Invariants

- Existing AssetProvider, cache/lease, timeout/cancellation and stale-result rules.
- No second render engine, asset cache, animation evaluator or gameplay clock.
- Unsupported required extensions fail before native resource allocation;
  optional degradation is machine-readable and never labelled full fidelity.
- Exact cubic tangents, node-over-mesh weights and independent cloned state.
- Mode changes do not replace or rewrite the asset's materials/geometry.
- Public APIs/types, package exports and compiler/MCP guidance remain aligned.
- Validator, browser pixels, desktop timing and target-device acceptance are
  distinct evidence; no full glTF, UE, offline cinema or mobile parity claim.

## Dependencies

README, plans index, agent-development, asset-loading, 3d-integration,
filmic-rendering, prefab-workflow; ModelLibrary/AssetCache/RequestSlot,
Laya 3.4.2 glTF version seam, FilmicPipeline, existing runtime clocks/profiler.
Existing crowd/filmic/public consumer tests and four validated review fixtures.

## Scope

### Engine

- Repair native glTF morph creation through a version-pinned adapter.
- Public compatibility inventory, errors and capability matrix; integrate with
  ModelLibrary without weakening the provider boundary.
- Reusable model inspection and explicit presentation-mode controller, using
  existing filmic rendering/lifecycle; an independent consumer inspector demo.
- Regression fixtures, strict types/exports, real browser regression, docs and
  packaged/browser delivery as appropriate to the public contract.

### Consumer or adapter

External acceptance project uses the packed public package and one model
definition for isolated and composed modes. Authored neutral test triangles,
materials and animation data are engine fixtures; commercial assets, HDRs and
device media stay external. Studio/game lighting is consumer-authored data.

## Non-goals

Lumen/Nanite/Path Tracer replacement, an offline movie renderer, full DCC editor,
universal lossless FBX/OBJ/USD conversion, commercial scene artwork or guaranteed
visual parity for unprovided seller assets. These remain explicit later phases.

## Acceptance checks

1. Valid unknown required extension rejects with code/path/extension and releases
   provider bytes; optional missing extension reports degradation. Malformed
   declarations never silently pass. Conditional opaque pass is identifiable.
2. Node weights override mesh weights; clones retain independent morph state.
   LINEAR/STEP/CUBICSPLINE with multiple morph targets keep duration, exact values
   and tangents; mixed transform/morph channels and skinned targets regress.
3. Inspector exposes stable node paths, mesh/material/texture/animation/morph
   information and limitations through the public SDK without private imports.
4. Raw/Gameplay/Cinematic share the same model/material identities; mode
   transitions, camera state restoration, failure, cancellation, replacement
   and 30 full load/unload cycles retain bounded resources.
5. Neutral fixture `asset-probe` and named `Probe` child stay separately runnable.
   Compare initial/weighted/animated states in isolation, then the same definition
   under all three presentation modes. Source hashes and actual/reference images
   are external. Deterministic fixture references are not seller art approval.
6. Strict independent consumer, ESM/CJS exports, public diagnostics, real WebGL
   draws; `npm run verify`, `git diff --check`, Markdown links and clean handoff.

## Evidence to attach

External directory: `<external-evidence>/zhuda-asset-showcase-acceptance-20261105`.
Keep package/source hashes, test and build logs, official validator output,
browser model/clip/pose snapshots, mode comparisons, lifecycle and screenshots.
Complete verification.md with command/commit/environment/result/artifact.

## Unverified limits

Seller models and original UE project not provided. Full glTF corpus, mobile,
cross-renderer material matching, complex transparency/hair/cloth/skin, spatial
GI, physical camera, HDR/movie export and native platforms require separate work.

## Rollback

Pin baseline 1.8.0 commit/browser release. Required unsupported extensions now
reject intentionally; supply a supported export instead of suppressing the gate.
