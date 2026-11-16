# Agent task: windows-acceptance QA-01..04, measurement quality

Status: Implemented within scope ([verification](qa-verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), QA-01..04 (report sections 7 and 8):

| ID    | Report's finding                                                                     |
| ----- | ------------------------------------------------------------------------------------ |
| QA-01 | `verify:film-water` WebGL: one pixel, 1/255, after 30 mounts, reproducible on Intel  |
| QA-02 | `verify:render-scale` WebGPU: rung 2 `uncovered=1` on Intel, no picture of that rung |
| QA-03 | Light-load WebGPU GPU time median 0 ms on three setups; heavy load positive          |
| QA-04 | One `Runtime.evaluate` timeout; an isolated rerun passed                             |

## Goal

Each one is told apart as a real defect or a counting accident, from
evidence the check itself keeps, not from a rerun.

## Invariants

- Exact-equality contracts stay exact (film-water: 0 pixels; render-scale:
  every rung covered). A different counting rule needs a negative control
  that still fails the real defect.
- No GPU time reads 0 because of how it was rounded.

## Scope

- `scripts/verify-film-water.mjs`: where pictures differ (count, largest
  difference, first ten with channel differences, a diff picture).
- `tests/fixtures/render-scale.ts`, `scripts/verify-render-scale.mjs`:
  where bare canvas is, and a bare pixel counted only as part of a strip
  or patch.
- `packages/core/effects/EffectBudget.ts` (`zhudaPassesBusyNs`), the
  profiler that uses it, and `scripts/verify-developer-tooling.mjs`.
- QA-04: the browser launcher of WIN-04; nothing new unless it
  reproduces.

## Acceptance checks

1. On the Windows host's desktop session, Intel WebGPU: render-scale and
   developer-tooling pass; film-water says where it differs.
2. Negative controls: a quarter view still counts every bare pixel; a heavy
   scene still costs more than a light one.
3. `npm run verify` on macOS.

## Rollback

Revert the commits; each is separate.
