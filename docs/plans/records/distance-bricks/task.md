# Agent task: distance-bricks (AG4)

Status: Implemented; pure data, checked by fixtures
Owner: Engine/toolchain
Last reviewed: 2026-11-17

## Source requirement

Work package AG4 of
[Techniques from Abyssal Garden](../abyssal-garden-techniques/plan.md),
taken up on the owner's request of 2026-11-17: a sparse, quantized distance
kept in bricks round a surface within a region, answering `distance` and
`normal` (and the ray and sphere queries built on them) for a camera or a
character, with the response left to the consumer.

## Goal

`ZhudaDistanceBricks.build({ distance | volume, min, max, cellSize, band })`
keeps the distance to a surface in 4 × 4 × 4 bricks of signed bytes where
the surface is within `band`, a sign for every other brick, and answers
`distance(p)`, `normal(p)`, `raycast`, `sweepSphere`, and a
`ZhudaSceneQueries` provider, with its memory reported.

## Invariants

- The engine answers queries; whether the camera or a character slides,
  stops or takes damage is the consumer's rule.
- Pure data: no renderer, no timer, no second store; build is synchronous
  and deterministic for the same field.
- A distance read back is within the quantization step (`band` / 127) plus
  interpolation error of the field's within `band`; beyond `band` it says
  `±band` (at least that far), with the right sign.
- Outside `min..max` there is no answer but `band` (empty), documented.

## Dependencies

- `packages/core/procedural/Isosurface.ts` (`ZhudaDensityVolume`,
  `zhudaVolumeDistance`), `packages/core/runtime3d/SceneQueries.ts`
  (`QueryProvider`), `CameraCollision.ts` (samples through the queries).

## Scope

### Engine

- `packages/core/runtime3d/DistanceBricks.ts` (new): `ZhudaDistanceBricks`,
  `validateZhudaDistanceBricks`; exported from the runtime index;
  declarations regenerated.
- `tests/distance-bricks.test.mjs`: deterministic raycast, sweep and slide
  fixtures (a consumer's slide written in the test), an arch a small sphere
  passes and a large one does not, error against the exact field, memory.
- `docs/procedural-assets.md` (with the isosurface).

### Consumer or adapter

The consumer builds bricks round where its camera or characters can reach,
registers the provider with its queries if it wants `resolveCameraBoom` to
see the rock, and writes its own slide or stop rule.

## Non-goals

- A movement or collision response, physics, or damage.
- Streaming bricks as the camera moves (the consumer rebuilds a region).
- GPU building (the field can come from `computeZhudaDensityVolume`).

## Acceptance checks

1. Unit tests: distances against an exact sphere and box field within the
   stated error; normals; a ray to a sphere and along a box face; a sweep
   through an arch with a sphere smaller and larger than its opening; a
   consumer slide along a wall that never ends inside it; far bricks carry
   the sign; outside the region; bad options; memory against a dense grid.
2. `resolveCameraBoom` through `ZhudaSceneQueries` stops short of a rock
   built as bricks.
3. `npm run verify`, lint, format, `git diff --check`.

## Unverified limits

- No draw (pure data); no phone timing of a build.

## Rollback

Last good commit: the merge after `98e93f0`. A new module; reverting the
commit removes it.
