# Agent task: round-9-consumer-fixes

Status: Implemented within scope; pure checks pass; one software-WebGL draw; no device.

## Source requirement

`ENGINE-REQUESTS-3.md` in the VerifyZhuda repository (2026-11-25): what five
consumer games built on `def94aa` ran into. The owner asked for the engine
side to be fixed directly.

## Goal

Close the items of that list that are engine defects with a small, checkable
fix:

1. Grass can add hundreds of draws from one node and nothing says so.
2. A page that draws markers over a film scene has to write its own
   world-to-screen projection, and the handedness is easy to get wrong.
3. A clip cannot be played "in N seconds" without looking up its length.
4. A `ground` node cannot lie over the level part of a `terrain`.
5. `onResize` runs before `ZhudaEngine.boot` returns and nothing says so.

## Invariants

- No existing scene changes: every new field and option is optional and
  defaults to what was drawn before.
- Lint stays pure (no browser, no GPU); the grass count is the arithmetic of
  `ZhudaGrassField.update`, not a second rule for what is kept.
- `ZhudaModelInspector.play` and `crossFade` without the new option set the
  animator's speed exactly as before.

## Dependencies

None added.

## Scope

### Engine

- `zhudaGrassMeshCount(options, eye)` (`runtime3d/Grass.ts`) and the advice
  rule `grass.draws` (`film/FilmLint.ts`), listed in `docs/quality-route.md`.
- `projectZhudaFilmPoint(camera, point, aspect)` (`film/Projection.ts`) and
  `ZhudaFilmStage.worldToScreen(point, size)`.
- `durationSeconds` on `ZhudaModelInspector.play` and `crossFade`.
- `y` on the `ground` node; the "surface in the ground plane" advice compares
  with it.
- The comment on `onResize`.
- `docs/film-scenes.md`, `docs/grass.md`, `docs/animation-control.md`.

### Consumer or adapter

Nothing. The games keep their pin until this is merged.

## Non-goals

- Making grass cheaper (fewer meshes for far patches, no depth pass). Only
  the count and the advice are added.
- The 2D batching drop seen in one game (item 2 of the source list): not
  reproduced in isolation, cause unknown, not touched.
- The prefab evidence fingerprint, the Doctor's view of the 2D route, a wider
  `ZhudaUI`, TypeScript 6 support: decisions for the owner, not small fixes.
- Deferring the first `onResize` call: existing consumers may lay out in it.

## Acceptance checks

- `tests/grass.test.mjs`, `tests/film-lint.test.mjs`,
  `tests/film-projection.test.mjs`, `tests/model-inspector-pacing.test.mjs`,
  `tests/film-scene.test.mjs` pass.
- The whole suite fails nothing it did not fail before.
- A consumer scene using `stage.worldToScreen` and `ground.y` draws with its
  markers on the things they mark.

## Evidence to attach

[verification.md](verification.md).

## Unverified limits

See the verification record.

## Rollback

Revert the commit. No data format changes shape: a scene using `ground.y`
is refused by an older engine ("unknown field"), which is the only way back
that needs an edit.
