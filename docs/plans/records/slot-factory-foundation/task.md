# Agent task: slot-factory-foundation

Status: Historical engine foundation — reusable implementation retained; game-specific products excluded
Owner: engine maintainers  
Last reviewed: 2026-11-05

## Source requirement

User: 「讓他支持白牌…但預設還是我們的 logo，其他按照規劃優化」。
The Slot architect review compared 1.8.0 and 1.9.0; its external evidence is
`<external-evidence>/REVIEW.md`.

## Goal

Ship the first H5 factory foundation: independent brand configuration, immutable
theme/provider mappings, cancellable prepared theme replacement, and a typed
authoritative-result presentation/checkpoint contract. Demonstrate the same
neutral 2D consumer core with two themes and repeatable browser measurements.

## Invariants

- No configuration means the existing 豬大 × LayaAir responsive splash.
- Explicit `engine`, `custom`, `none` branding; notices survive all modes.
- Theme switching uses AssetProvider and existing cache/lease lifecycle.
- Failed, cancelled or stale preparations cannot replace the active theme.
- Results are supplied by the consumer/backend. No RNG, payout, wallet or
  transaction authority; presentation completion is not financial settlement.
- Gameplay uses the existing layered clock. Async deadlines are IO deadlines.
- White-label does not alter required third-party licensing notices.

## Dependencies

Existing branding compiler/browser bundles, AssetProvider, ZhudaRequestSlot,
Prefab library, Spine visual contract, runtime host/session and consumer gates.

## Scope

### Engine

Compiler/browser branding, public generic theme and presentation contracts,
tests, independent consumer verification script, public docs and release.

### Consumer or adapter

Neutral generated consumer and evidence outside the engine repository. One
same-core symbol grid fixture, theme A/B mappings, deterministic input/result
sequence. Caller owns real assets, backend validation and durable storage.

## Non-goals

Full Slot/Board rules kit, visual skin editor, AI game generator, Native signing,
multi-product commercial factory and customer adoption certification. These
belong in consumer products outside this engine repository. The historical
pilot does not authorize game-specific engine roadmap work.

## Acceptance checks

1. `npm run verify`: default/custom/none builds, unsafe config failures, strict
   public types and ESM/CJS exports, existing regressions remain green.
2. Theme tests: required mapping/integrity/compatibility, shared-provider
   ownership, abort/timeout/late release, concurrent replacement and 100 cycles.
3. Result tests: duplicate/out-of-order/gap/conflicting IDs, interrupted playback,
   persisted cursor restore, failed storage/reconciliation and disposal.
4. Independent packed SDK consumer: public build + Doctor, actual WebGL; two
   themes share unchanged core. Isolate neutral `factory.symbol` and grid paths
   before Scene composition using the same definition. Save reference/actual
   and comparison, hashes, viewport/DPR and draw/resource metrics externally.
5. Repeat 1000 known-result rounds and 100 mount/unmounts; measure frame-time
   percentiles separately from long-duration/physical-device acceptance.
6. Browser bundles: runtime branding in all profiles; hosted SHA/SRI checks.
7. `git diff --check` and `git status --short`; complete verification record.

## Evidence to attach

Tests/build logs, packed consumer, browser screenshots and raw measurements:
`<external-evidence>/zhuda-slot-foundation-acceptance-20261105`.

## Unverified limits

No real customer Slot, low-end phone 60-minute run, Native signing or actual
backend idempotency test. Synthetic presentation rounds do not prove these.

## Rollback

Last good version 1.9.0, commit `49358fff189ea09adc01368221a2b69c8ff7a8cd`.
Failed consumer builds retain previous artifacts; hosted releases immutable.
