# Verification record: combat-runtime-contracts

Task document: `docs/plans/records/combat-runtime-contracts/task.md`
Base engine commit: `0347bbe15db058234f4077f3354fc5ce026eac3f`
Date: 2026-11-04

## Environment

- OS: macOS desktop
- Node: `v26.12.0`
- npm: `11.20.0`
- Browser/device: no consumer browser or mobile device run

## Checks

| Check | Exact command | Result | Artifact |
| --- | --- | --- | --- |
| Runtime declaration generation | `npm run types:runtime3d` | PASS | `packages/types/runtime3d/ActionFrames.d.ts`, `InputBuffer.d.ts`, updated `Clocks.d.ts` and `Runtime.d.ts` |
| Strict engine typecheck | `npm run typecheck` | PASS | generated declarations and TypeScript diagnostics |
| Focused runtime tests | `node --test tests/runtime3d.test.mjs` | PASS; 18 tests, 0 failures | command output |
| Full regression suite | `npm run test` | PASS; 118 tests, 0 failures | command output |
| Public SDK export/type checks | included in `npm run test` | PASS; strict consumer and ESM/CJS export checks | `tests/fixtures/public-runtime3d.ts`, `tests/compiler-and-mcp.test.mjs` |
| Compiler build | `npm run build` | PASS; SDK and web bundles regenerated | `dist/sdk/`, `dist/web/`, `dist/build-manifest.json` |
| Doctor | `npm run doctor` | PASS; 0 blocking errors | command output |
| Required gate | `npm run verify` | PASS; build, typecheck, doctor and 118 tests | command output |
| Diff hygiene | `git diff --check` | PASS | command output |

## Implemented contracts

- `ZhudaLayeredClock` uses one real-time source with named world/player/enemy/
  vfx/ui channels, global and per-layer scales, pause state and reusable layer
  deltas.
- `ZhudaRuntimeSession.layers` is driven by the existing RAF and inherits the
  session `clock.timeScale`; layer timers share the existing scheduler.
- `ZhudaActionFrameSpec`, `validateActionFrameSpec` and
  `ZhudaActionStateMachine` validate contiguous startup/active/recovery windows,
  deterministic events, cancel windows and renderer-neutral bone sockets.
- `ZhudaInputBuffer` bounds age/capacity, rejects time regression, supports
  one-shot action consumption and ordered combo consumption, and disposes its
  retained state.

## Unverified limits

- No real Laya animation adapter or model bone matrix was exercised; consumers
  must connect declared sockets to their own model provider and feed the existing
  `ZhudaCombatWorld.sampleRect()` contract.
- No browser/WebGL or mobile latency/performance check was run. Passing Node
  tests and generated bundles does not establish device performance.

## Rollback

Revert the task changes to return to the existing runtime3d contracts at
`0347bbe15db058234f4077f3354fc5ce026eac3f`.
