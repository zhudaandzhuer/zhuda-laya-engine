# Agent task: runtime-hardening

Status: Implemented; deterministic contracts verified; browser/device acceptance deferred
Owner: Codex
Last reviewed: 2026-11-06

## Source requirement

User request: 「去極致優化上面這些點」, referring to the six pain points in the
1-vs-N fighting-game engine report: scene mutation safety, local/world rendering,
scaled and unscaled time, combat hitbox queries, pool lifecycle, and defensive
Graphics input handling.

## Goal

Expose deterministic, renderer-independent public contracts for the six failure
classes, with lifecycle-safe behavior and strict consumer fixtures, without
moving gameplay authority or game assets into this engine repository.

## Invariants

- Consumer code remains authoritative for damage, health, knockback, movement,
  collision results, and network rules.
- Laya remains the rendering and scene implementation; no private Laya internals
  are required by consumers.
- Every scheduled callback, mutation, pooled object, and combat registration can
  be cancelled or disposed without a late callback or stale hit.
- Existing fixed-step, particle, asset, prefab and audio APIs remain compatible.
- Public declarations and runtime exports stay synchronized.

## Dependencies

- Existing `ZhudaSimulationClock`, `ZhudaRuntimeSession`, `ZhudaSceneQueries`,
  prefab and particle lifecycle contracts.
- LayaAir 3.4.2 public declarations under `packages/types/vendor/`.
- Existing Node test runner and strict consumer fixtures.

## Scope

### Engine

- `packages/core/runtime3d/Clocks.ts` and public timer/clock types.
- New `RenderSpaces.ts`, `SceneMutation.ts`, `GraphicsGuard.ts`, `Pool.ts`, and
  `CombatQueries.ts` contracts with runtime implementations.
- Runtime and type barrel exports.
- Focused regression tests and engine documentation.

### Consumer or adapter

- No consumer assets or game rules. Combat callbacks only report candidates;
  consumers decide damage and authority.

## Non-goals

- Patching Laya's private scene traversal or renderer internals.
- Adding FairyGUI or any consumer UI dependency.
- Adding a rigid-body combat solver or authoritative damage system.
- Claiming browser/WebGL/device performance without those checks.

## Acceptance checks

1. `npm run types:runtime3d` emits declarations for every new public contract.
2. Clock tests prove scaled/unscaled progression, pause, cancellation, owner
   disposal, bounded catch-up and deterministic replay.
3. Mutation tests prove add/remove/destroy requests made during a flush are
   applied once at a deterministic boundary and disposed queues reject late work.
4. Render-space tests prove local/world/overlay callbacks receive the documented
   transform and scratch outputs without implicit double transforms.
5. Graphics guard tests reject non-finite inputs and clamp documented radii and
   dimensions before forwarding to a supplied Graphics-like target.
6. Pool tests prove reset, spawn/despawn hooks, capacity bounds and disposal.
7. Combat tests prove layer masks, active windows and swing-ID deduplication while
   leaving hit resolution to the consumer callback.
8. `npm run verify`, `git diff --check`, and `git status --short` pass.

## Evidence to attach

- Test/build output from `npm run verify`.
- Generated declaration diff under `packages/types/runtime3d/`.
- Verification record at `docs/plans/records/runtime-hardening/verification.md`.
- Browser/WebGL/device result remains explicitly unavailable unless run.

## Unverified limits

- Real Laya browser traversal behavior and GPU Graphics backend behavior require
  a consumer browser fixture; the contracts are tested with deterministic fakes.
- No mobile device or production consumer game check is included in this engine
  change.

## Rollback

Last known good commit: `5d8e78b`. If a gate fails, revert the runtime-hardening
commit and keep consumers on the existing public API.
