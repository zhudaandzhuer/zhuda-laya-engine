# Agent task: crowd-runtime-hardening

Status: Implemented; desktop verified; target-platform acceptance Deferred
Owner: reusable runtime, diagnostics and consumer benchmark
Last reviewed: 2026-11-05

## Source requirement

User: “去按照上面優化咱們的repo，確保用戶能安心使用，開發各種遊戲”.
Source review: `/Users/yaowei/Desktop/zhuda-national-war-review-20261105.md`.
Baseline: 1.7.0 / `70c7e000eb9f4eb8eda64d8093626e30da441bb3`.

## Goal

Give consumers measured, reusable crowd presentation and effect/performance
controls, a reproducible real animated-character benchmark, and explicit
platform/asset/scale acceptance boundaries.

## Invariants

- One runtime/layer clock. Consumer movement, damage, AOI and network authority
  remain external. Presentation throttling never throttles authoritative rules.
- Provider logical IDs, cancellation/deadline/stale-result and resource leases.
- Existing public defaults retain behavior. Public runtime and declarations agree.
- Important telegraphs cannot silently disappear under a cosmetic budget.
- Draw/CPU/GPU/heap metrics state their source, time window and unsupported cases.
- Synthetic/fixed-frame, headless and hardware results are labelled separately.
- No private consumer imports or global Laya:any; original game assets stay out.

## Dependencies

Read README, AGENTS, plans index, agent-development, 3d-integration/acceptance,
asset-loading, prefab workflow, effects/particles contracts and public types/tests.
Reuse InstanceGroup, ModelLibrary/cache, SnapshotBuffer, scene lifecycle,
EffectBudget, ParticleSystem3D and RuntimeProfiler. Optional reference model:
licensed upstream animated glTF downloaded into external acceptance directory,
with source revision/hash/license and model statistics recorded before use.

## Scope

### Engine

Reuse instance matrices; safe provider-backed model loading with deadline;
presentation scheduler and remote snapshot composition; effect minimum/fallback
allocation; configurable bounded particle step and efficient active geometry
uploads; long-test profiler with accurate statistics and optional GPU queries;
public types, failing fixtures, benchmark harness, route/status documentation.

### Consumer or adapter

External neutral benchmark uses public SDK. Same model definition powers
isolated character selection and 25/50/100 scene; shared tick, animation, optional
equipment/HUD and effects are declared. Network fixture owns simulated authority,
transport and reconnect. Server business logic is not engine code.

## Non-goals

A new ECS, MMORPG business backend, automatic game skill importance, universal
60 FPS guarantee, or claimed Windows/Steam/device support without those hosts.
Native/Steam needs a published capability matrix and integration recipe, not a
fabricated binary or passing result.

## Acceptance checks

1. Repeated instance transforms reuse storage; invalid input is atomic, borrowed
   mesh/material survive disposal; real draw and batch measurement.
2. Character presentation supports stable IDs, priority/distance/visibility,
   bounded per-frame work, deterministic rates, teleport/epoch reset and removal.
   Adapter controls animation explicitly; no duplicate native animator ticks.
3. Effect minimums/fallback are explicit when infeasible. Different particle
   rates actually reduce substeps, catch-up is bounded, and default replay holds.
   Active geometry upload handles shrink/empty/grow without stale triangles.
4. Profiler retains configurable long windows, exports raw measurements with
   P50/P95/P99 and frame/CPU bounds; GPU query validity/cleanup and unavailable
   status are tested. No fabricated GPU or native memory readings.
5. Strict independent consumer, ESM/CJS/browser parity; npm run verify,
   git diff --check/status. Model lifecycle includes 30 load/unload cycles,
   timeout, abort, stale completion and shared material ownership.
6. External real animated-model browser benchmark at 25/50/100, model provenance,
   isolated/Scene comparison, transforms, VFX, network snapshot replay and resource
   reports. Duration, hardware, draw path and unperformed device runs remain explicit.

## Evidence to attach

`/Users/yaowei/Desktop/zhuda-crowd-acceptance-20261105`: source hashes, model
inventory/license, browser screenshots/reports, test/pack/type/build logs, raw
performance streams and any deliberate failure results. Complete verification.md.

## Unverified limits

Target i5-12400/RTX3060 and GTX1650 PCs, physical iOS/Android, Windows Native,
Steam Overlay, true 2,000 CCU, production game artwork and latency/quality SLA.

## Rollback

Pin 1.7.0 commit/immutable browser bundle. Preserve default 120 Hz particles,
legacy model URL entry and default profiler capacity. New features are opt-in.
