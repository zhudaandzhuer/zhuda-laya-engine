# Agent task: consumer-runtime-hardening

Status: Implemented; desktop scope verified; cross-device acceptance deferred
Owner: Engine runtime and consumer tooling
Last reviewed: 2026-11-06

## Source requirement

User request: 「你開始補強我們的引擎吧」, following the Astra v0.2 and
Argon/Spark consumer reviews of f6726e7. Reproduced gaps: Doctor can report
HEALTHY after scanning zero consumer files; the mixer has no original-sample
ingress; the shared Prefab library/preview only accepts static 2D hierarchies.
See also ../../consumer-delivery-followups.md and ../../prefab-toolchain.md.

## Goal

Make the default Doctor inspect the actual consumer and reject empty scans;
provide provider-backed decoded audio through the existing mixer; allow a
serializable primitive 3D tree to use the same library, state, provenance and
isolated preview route as its scene.

## Invariants

- Public declarations and runtime exports agree; existing 2D consumers remain valid.
- One audio context/mixer and the existing provider/cache/lease abstractions.
- Consumer owns gameplay, media, input decisions and effect recipes.
- A node tree or successful build never auto-approves pixel/device evidence.
- Cancellation, timeout, late completion and disposal cannot resurrect owners.

## Dependencies

- IframeSoundAdapter, AssetProvider, ZhudaAssetCache, ZhudaResourceScope.
- ZhudaPrefabLibrary, prefab-preview and schema 2 evidence checker.
- Existing typed Laya primitives, material and Transform APIs.

## Scope

### Engine

- Doctor defaults/diagnostics and consumer guard hints.
- Mixer sample loading, bounded playback/loop/offset/fade and explicit release.
- Typed primitive 3D tree renderer and shared Prefab library/preview extension.
- Public declarations, neutral regression fixtures and documentation.

### Consumer or adapter

- Independent neutral SDK acceptance project outside this repository; no game art.
- Neutral named primitive nodes, states and a generated WAV fixture.

## Non-goals

- Kart rules, AI, spline tracks, physics authority, game assets or game repairs.
- Streaming/spatial audio, automatic baseline approval, single-file distribution.
- Full vendor declaration repair and selective evidence dependency graph; those
  remain separate stages in consumer-delivery-followups.md.

## Acceptance checks

1. Doctor CLI from a consumer without --project scans that consumer; empty or
   explicit missing roots fail with a path and corrective guidance.
2. Audio provider/decode failure, caller cancellation, timeout, late success,
   unlock queue, loop/offset/fades, bounded voices and 30 load/unload cycles.
3. 3D tree validates names/transforms/material references, renders named nodes,
   applies states, records recipe provenance and releases resources over 30 cycles.
4. Strict independent consumer typecheck/build plus ESM/CJS export checks.
5. Real desktop preview/scene of the same neutral definition and user-gesture
   WAV decode/playback; store browser evidence outside this repository. Physical
   iOS/Android checks remain UNAVAILABLE unless actually performed.
6. npm run verify; git diff --check; git status --short.

## Evidence to attach

- Focused regressions and full verify output; independent consumer build logs.
- External neutral preview/scene screenshots and browser observations.
- Verification record with exact source identity, commands and limitations.

## Unverified limits

- Physical mobile speakers, autoplay policies, codec matrix and GPU drivers.

## Rollback

Baseline f6726e7b3cd8e166a6afa21df038af22e2fc838a. Keep tone playback and static
2D Prefabs compatible; reject invalid new definitions without publishing output.
