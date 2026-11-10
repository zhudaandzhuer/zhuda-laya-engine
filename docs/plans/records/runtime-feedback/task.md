# Agent task: runtime-feedback

Status: Implemented; desktop verified; physical-device acceptance in progress  
Owner: Engine runtime and SDK  
Last reviewed: 2026-11-05

## Source requirement

User: “開始優化”, after the six-item Codex consumer review: high-DPR design
coordinates, streaming BGM, configurable voice retirement, Worklet backend or
extension contract, pluggable background clock/recovery, and vendor declarations.
Independent baseline evidence is outside the engine at
`<external-evidence>/REVIEW.md`.
Baseline: 1.6.0 / `4ce9255`; 198-unit Prefab renders at 198/99/66 CSS px for
DPR 1/2/3; vendor audit fails with 506 diagnostics.

## Goal

Provide stable design coordinates across DPR, shared bounded audio lifecycle
for samples/streams/extensions, and explicit runtime driver/recovery behavior.
Repair vendor declarations against shipped runtime, retaining a failing audit
for any unresolved group. Report measured support rather than SOP compliance.

## Invariants

- Consumer rules, production assets and authority remain outside this repo.
- One AudioContext, one mixer and one runtime clock/timer authority.
- Provider logical IDs, leases, abort/timeout/stale result/disposal paths persist.
- Streams never silently bypass manifest SHA integrity; native streaming has an
  explicit delivery policy and fallback for full-byte verified resources.
- Voice hard bounds include fades and crossfades; protected voices survive.
- Drivers never produce duplicate ticks; background recovery is explicit and bounded.
- No any, empty declarations or diagnostic suppression to hide vendor defects.

## Dependencies

Existing RuntimeSession, LayeredClock, TimerScheduler, AssetProvider/cache,
IframeSoundAdapter, public declarations, official preview/checker, neutral
fixtures and Chrome WebGL. Required contracts read: README, AGENTS,
agent-development, prefab-workflow, audio, platform-adapters, asset-loading,
3d-integration, consumer-delivery-followups and verification template.

## Scope

### Engine

Runtime sizing/driver adapters; audio policy/stream/backend contracts; provider
stream leases; public types/vendor corrections; compiler evidence checks;
focused regression and independent browser harnesses; docs and migration notes.

### Consumer or adapter

External neutral fixture and media only, stored under Desktop acceptance folder.
Actual game assets and SOP remain consumer-owned. No game-specific migration.

## Non-goals

Game rules, transactions, a second mixer, a guarantee of unthrottled background
execution, universal sandbox autoplay, physical-device acceptance without devices.
Worklet extension support is not a claim of a production DSP mixer or latency SLA.

## Acceptance checks

1. Preview and Scene share a 198-unit fixture; actual CSS width/anchor and input
   agree at DPR 1/2/3, capped DPR, resize; regression includes 3D overlay/picking.
2. Streaming/source failures: abort, timeout, late completion, load/play failure,
   switch, loop, focus, dispose, 30 cycles; real Chrome media integration.
3. >24 events: FIFO/priority/protected policy, hard voice bound, rejection and
   retirement diagnostics; fade overlap accounted and resources released.
4. Backend extension connects only through existing voice gain; abort/dispose
   tested. Worklet reference integration measured under main-thread load, with
   unsupported behavior and unmeasured mobile latency explicitly recorded.
5. Foreground/background driver switching, stale callbacks, long suspension,
   bounded recovery and no double-ticks/replayed timer burst.
6. Declaration audit, strict independent public consumer, ESM/CJS regression;
   npm run verify, git diff --check, git status --short.

## Evidence to attach

Task-specific tests, full verify log, full declaration audit, neutral independent
consumer build/browser reports, raw measurement/screenshots and source revision.
External artifacts: `<external-evidence>/runtime-feedback-acceptance-20261105`.

## Unverified limits

Original game BGM/41.28 MB measurement; full SOP; real iOS/Android; device speakers,
mobile memory and long OS suspension; production Worklet mixer/latency target.

## Rollback

Keep 1.6.0 immutable browser URLs. New behavior ships as a new release; default
audio overflow remains reject and runtime background policy remains pause.
