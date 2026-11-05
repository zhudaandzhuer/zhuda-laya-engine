# Agent task: combat-runtime-contracts

Status: Implemented; deterministic contracts verified; browser/device acceptance deferred
Owner: Codex
Last reviewed: 2026-11-06

## Source requirement

User request: 「去優化你提到的引擎缺點」, referring to the verified gaps in
the 1-vs-N fighting-game review: layered time channels, serialized action
frame data and bone/socket presentation contracts, and buffered fighting-game
input.

## Goal

Expose deterministic, public, renderer-independent contracts for layered time,
action frame data/socket declarations and action input buffering, with strict
consumer types and regression tests.

## Invariants

- Consumer code remains authoritative for movement, damage, collision
  resolution, network rules and game-specific action semantics.
- Existing scaled/unscaled clocks, timers, pointer input, combat queries and
  pool APIs remain source-compatible.
- No browser timers, private Laya APIs, or second audio/time authority are
  introduced.
- Action and input contracts are deterministic, bounded and disposable where
  state is retained.
- Public declarations and runtime exports stay synchronized.

## Dependencies

- Existing `ZhudaRealtimeClock`, `ZhudaSimulationClock` and
  `ZhudaTimerScheduler` in `packages/core/runtime3d/Clocks.ts`.
- Existing `ZhudaPointerInput`, `ZhudaCombatWorld` and `sampleRect()` contract.
- Existing strict public consumer fixture and Node runtime tests.

## Scope

### Engine

- Add layered clock samples and layer-aware timer scheduling to the runtime3d
  clock contract.
- Add a pure action frame-data validator/state machine and a bone/socket
  declaration contract; do not implement a renderer or damage authority.
- Add a bounded action input buffer with ordered combo consumption.
- Export all contracts, generate public declarations, document consumer usage,
  and add deterministic tests/strict type coverage.

### Consumer or adapter

- None. Consumer game rules, assets, animations and actual bone adapters remain
  outside this repository.

## Non-goals

- Adding a rigid-body solver or a parallel `ZhudaPhysics` API.
- Implementing a full animation renderer, Spine adapter or authoritative
  combat state machine.
- Adding FairyGUI, game assets, scene content or a splash UI.
- Claiming browser/WebGL/device performance without a consumer acceptance run.

## Acceptance checks

1. Layered clocks advance named layers with independent time scales and pause
   state; layer timers use supplied deltas and remain bounded.
2. Action frame data rejects invalid windows/events/socket declarations and the
   state machine reports startup/active/recovery/complete, cancel windows and
   deterministic frame events.
3. The input buffer enforces capacity/window bounds, rejects time regressions,
   consumes actions once and recognizes ordered combinations.
4. Strict public consumer types import every new contract from the package root.
5. `npm run verify`, `git diff --check`, and `git status --short` pass.

## Evidence to attach

- Focused runtime test output and full `npm run verify` output.
- Generated public declarations under `packages/types/runtime3d/`.
- Verification record at `docs/plans/records/combat-runtime-contracts/verification.md`.

## Unverified limits

- No real Laya browser animation/socket adapter or mobile input/device check is
  included; those remain consumer acceptance work.

## Rollback

Last known good commit: `0347bbe15db058234f4077f3354fc5ce026eac3f`. If a gate
fails, revert this task's changes and keep the existing runtime3d contracts.
