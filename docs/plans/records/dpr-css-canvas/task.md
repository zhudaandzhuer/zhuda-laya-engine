# Agent task: dpr-css-canvas

Status: In progress  
Owner: Engine runtime and SDK  
Last reviewed: 2026-11-06

## Source requirement

Deep Tide Survival browser acceptance at
`/Users/yaowei/Documents/ZhudaGameCenter/games/deep-tide-survival/artifacts/browser/report.json`
measured a 390×844 CSS viewport at DPR 2 with a 780×1688 canvas whose CSS box
was also 780×1688. This reopens the DPR defect described by
`docs/plans/records/astra-runtime-feedback/task.md` and violates the public
platform contract in `docs/platform-adapters.md`.

## Goal

Keep the browser canvas and pointer/DOM overlay coordinates in CSS pixels while
retaining the capped DPR backing buffer for WebGL rendering.

## Invariants

- `canvas.width`/`canvas.height` are backing pixels; `getBoundingClientRect()` is CSS pixels.
- `dprCap` affects rendering resolution only and never doubles design units.
- Laya 3.4.2 stage/input transforms remain the single coordinate authority.
- Native/mini-game sizing and engine lifecycle behavior remain unchanged.

## Dependencies

- `resizeLaya342Stage` and `ZhudaRuntimeSession.resize()`.
- Consumer browser acceptance report and the existing runtime sizing fixtures.

## Scope

### Engine

- `packages/core/runtime3d/Laya342Adapters.ts`
- `tests/runtime-sizing.test.mjs`
- this task's verification record and public sizing documentation if required.

### Consumer or adapter

- Deep Tide consumer is only a regression fixture; no game-specific sizing fork.

## Non-goals

- Changing game rules, renderer quality profiles, native platform packaging or
  claiming physical-device acceptance.

## Acceptance checks

1. `node --test tests/runtime-sizing.test.mjs` passes and asserts CSS/backing
   separation.
2. `npm run verify` passes from the engine root.
3. The Deep Tide browser harness runs with SwiftShader at DPR 2 portrait and
   landscape resize; CSS canvas dimensions equal the viewport while backing
   dimensions equal viewport × DPR, WebGL boots, and Go authority still joins.
4. `git diff --check` and `git status --short` are recorded.

## Evidence to attach

- Engine verify output.
- Consumer browser report and PNGs under the consumer artifact directory.

## Unverified limits

- Real mobile GPUs, iOS/Android native hosts and WebGPU are outside this local
  WebGL regression.

## Rollback

Revert the implementation commit and pin consumers to the prior SDK commit;
the previous runtime still boots but fails the DPR acceptance described above.
