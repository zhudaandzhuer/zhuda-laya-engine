# Agent task: ui-test-probe

Status: Done within scope (desktop headless Chrome; no phone)  
Owner: the session on the owner's Mac  
Last reviewed: 2026-11-26

## Source requirement

The owner asked (2026-11-26) whether this repository already has what a friend's "LayaQA" test
scheme has: a probe that reads the Laya UI node tree and global coordinates, structured JSON test
cases that click a named control and assert per step, zero model tokens at run time,
deterministic repeats, and capture over the Chrome protocol of exceptions, the stage node count
and the JS heap. An inventory the same day found most of it as a convention of each game (the
`hot` map of `src/ui/kit.ts`, each game's own `tools/play.mjs`) and not as a tool. This task
closes the gaps.

## Goal

A test of a game's interface is a JSON scenario of clicks on controls found by name or by label
and of expectations, played without any code of the game's own, failing with the step and what
was found, and giving the same files every run on the virtual clock.

## Invariants

- Nothing is added to the engine's runtime or to a release build.
- Scenario files written before this task play as before, unchanged.
- The two viewers' `tools/play.mjs` stay one file.
- A check that was not run is said not to have been run.

## Dependencies

- `packages/compiler/chrome-host.mjs`, `prefabs/tools/detplay.mjs`, the viewers' `play.mjs`,
  `games/tools/device-measure.mjs`, `games/zhuda-match`.

## Scope

### Engine

- New: `packages/compiler/stage-probe.mjs` (package entry `./compiler/stage-probe`),
  `prefabs/tools/detrepeat.mjs`, `scripts/verify-stage-probe.mjs` (`npm run verify:stage-probe`),
  `tests/stage-probe.test.mjs`, the route `docs/routes/ui-test-by-probe.md`.
- Changed: `prefabs/tools/detplay.mjs` and the two `play.mjs` (steps `click` by selector,
  `expect`, `probe`; `hold` on a click; `READY` for `detplay.mjs`; a failed step exits 1),
  `games/tools/device-measure.mjs` (`stageNodes`, `stageNodesShown`).

### Consumer or adapter

- `games/zhuda-match`: a named control's name is also its node's name (`src/ui/kit.ts`); two
  scenarios under `tools/scenarios/`. `prefabs/viewer2d/scenarios/dungeon-spin-named.json`.

## Non-goals

- A phone, iOS, a mini-game runtime, a model-driven runner: listed as missing in the route.
- Named drags; Laya's own hit test before a click; the other reference games' names.

## Acceptance evidence

- Tests for the probe's tree and rectangles and for the new steps; the reference game's scenario
  20 times identical on this Mac; `npm run verify`, `npm run lint`, `npm run verify:prefabs`,
  `npm run format:check` for the files touched. See [verification](verification.md).
