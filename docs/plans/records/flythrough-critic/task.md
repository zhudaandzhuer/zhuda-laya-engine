# Agent task: flythrough-critic (AG5)

Status: Implemented; desktop WebGL and WebGPU
Owner: Engine/toolchain
Last reviewed: 2026-11-17

## Source requirement

Work package AG5 of
[Techniques from Abyssal Garden](../abyssal-garden-techniques/plan.md),
taken up on the owner's request of 2026-11-17 to finish the plans waiting
list: a scripted fly-through timed against a frame budget with GPU time, and
a critic that sees only pictures, as optional gates for 3D scenes.

## Goal

`npm run verify:flythrough -- <file>` times a film scene along a camera path
frame by frame on either backend, reports average, p99 and max of CPU and
GPU time as JSON beside pose pictures, a short recording and a critic brief,
and fails with `file:line` guidance when a frame is over budget;
`npm run flythrough:critic` gates a critic's report on those pictures.

## Invariants

- GPU time that was not measured is reported unavailable with its reason,
  never 0; a GPU limit that could not be checked is `unavailable`, not a
  pass.
- Frames are drawn as a game draws them (one sample) and timed outside any
  readback; pose pictures are drawn after the timed run.
- The critic receives only pictures and the brief; "minor only" is a
  proposal for a person, not a pass.
- One time source: the profiler's frames; no timer of the run's own beyond
  yielding to the browser between frames.

## Dependencies

- `ZhudaCinematicCapture` (film capture), `ZhudaRuntimeProfiler` (GPU
  timing), `sampleZhudaFilmCameraPath`, the film host and its MP4 export
  (`ffmpeg`).

## Scope

### Engine

- `packages/core/runtime3d/CinematicCapture.ts`: `drawFrame` (one sample, no
  readback) and `readFrame`, sharing the existing draw.
- `packages/core/film/Flythrough.ts` (new): `runZhudaFlythrough`.
- `packages/core/film/FlythroughReport.ts` (new): `summarizeZhudaFlythrough`,
  `validateZhudaFlythroughBudget`, `zhudaCriticBrief`,
  `validateZhudaCriticReport`, `gateZhudaCriticReport`.
- `packages/compiler/film-host-client.ts`, `packages/mcp-server/film-host.mjs`
  (`flythrough`), `packages/mcp-server/runtime.mjs`.
- `packages/compiler/json-locate.mjs`, `packages/compiler/flythrough-file.mjs`
  (file checks and guidance with lines).
- `scripts/verify-flythrough.mjs`, `scripts/flythrough-critic.mjs`, fixtures
  in `tests/fixtures/flythrough/`, `tests/flythrough.test.mjs`.
- `docs/flythrough.md`, `docs/plans/VERIFICATION-TEMPLATE.md`,
  `docs/quality-route.md`, the MCP quality route's last step.

### Consumer or adapter

A consumer writes a fly-through file for its scene with the budget of its
target device and keeps the critic report with its verification record.

## Non-goals

- Running a critic agent from the engine (the brief and the gate are the
  engine's; who looks is the caller's choice).
- A game's own scene graph: the runner takes a film stage. A game uses
  `summarizeZhudaFlythrough` on frames it times itself.
- Phone runs (requested from the owner's session).

## Acceptance checks

1. Unit tests: summary and budget (average, p99, max, the frames over a
   limit), GPU unavailable never 0 and never a pass, critic brief, report
   validation and gate, file checks with lines, guidance lines.
2. `npm run verify:flythrough` passes on WebGL and WebGPU with the yard
   fixture; `over-budget.json` fails with `file:line` guidance.
3. A critic given only the pictures returns a report that
   `npm run flythrough:critic` gates; `critic-major.json` blocks with
   `file:line`.
4. `npm run verify`, lint, format, `git diff --check`.

## Unverified limits

- No phone. WebGPU's GPU time is a sum over render passes; on a tiled GPU
  passes may overlap, so it is not directly comparable with WebGL's
  frame-level timer.

## Rollback

Last good commit: `33f11be`. The additions are new entry points; reverting
the commit removes them.
