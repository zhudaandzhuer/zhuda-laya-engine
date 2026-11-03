# Verification record: runtime-hardening

Task document: `docs/plans/records/runtime-hardening/task.md`  
Commit: `412ea2cceb0cec732225ff61318973247973dbe8`  
Date: 2026-11-03  

## Environment

- OS / browser / device: macOS desktop; browser/device checks not run.
- Node and package manager: Node `v26.12.0`, npm `11.20.0`.
- Engine and consumer commits: engine `412ea2c`; no consumer repository changed.
- DPR, viewport and network mode: UNAVAILABLE; no browser session.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build | `npm run build` | PASS | `dist/build-manifest.json`, `dist/sdk/`, `dist/web/` |
| Types | `npm run typecheck` | PASS | `packages/types/runtime3d/*.d.ts` |
| Doctor | `npm run doctor` | PASS; HEALTHY, 0 topology/legacy/contract errors | command output |
| Regression | `npm run test` | PASS; 111 tests, 0 failures | command output |
| Focused runtime | `node --test tests/runtime3d.test.mjs` | PASS; 15 tests, 0 failures | command output |
| Public consumer types | `node --test tests/public-types.test.mjs` | PASS; strict fixture imports all new contracts | command output |
| Real WebGL/device | Consumer browser and mobile procedure | UNAVAILABLE; no browser/device was run | none |

## Lifecycle and failure cases

- `ZhudaRuntimeSession.dispose()` cancels RAF, timers and mutation queues.
- `ZhudaTimerScheduler` supports per-handle cancellation, owner cancellation,
  scaled/unscaled channels and a bounded callback count per frame.
- `ZhudaSceneMutationQueue` defers nested writes to the next flush and drops
  pending work after disposal.
- `ZhudaObjectPool` bounds capacity, rejects duplicate release, resets on
  release and disposes active/free objects exactly once.
- `ZhudaCombatWorld` rejects invalid rectangles/layers/windows, samples dynamic
  socket rectangles, applies layer masks and deduplicates one swing ID per
  hurtbox.
- `ZhudaGraphicsGuard` rejects non-finite coordinates and clamps sizes/radii
  before forwarding to a Graphics-like target.
- Async asset/prefab lifecycle regression coverage remains green in the full
  suite; this change adds no new asynchronous resource loader.

## Prefab evidence (visual work)

No consumer visual content or prefab definitions changed. Prefab evidence is
not applicable; existing isolated prefab tests remain part of the 111-test pass.

## Limits and decision

The runtime contracts are implemented and verified in Node and strict public type
fixtures. Real Laya browser traversal, GPU Graphics backend behavior, and mobile
performance remain `UNAVAILABLE` until a consumer browser/device report runs.
Decision: **In progress** pending those consumer acceptance checks.

## Rollback

Revert commit `412ea2cceb0cec732225ff61318973247973dbe8` to return to the previous
public API and generated artifacts at `5d8e78b`.
