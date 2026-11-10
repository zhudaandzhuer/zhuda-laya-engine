# Agent task: film-look

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-11

## Source requirement

Phase 2 of the film workflow. The phase 1 test film ("夜班") showed the
largest quality gaps: no shadows, a flat single-colour sky with a hard
horizon, no fog, no practical lights at night, and no quick way to set a time
of day. The user asked to start phase 2.

## Goal

A film scene can name a look preset (night, dawn, day, dusk, overcast) and
override its parts: sun shadows, a procedural sky, distance fog, point and
spot lights, and emissive materials, all rendered by native Laya 3.4.2
features through the same cinematic capture.

## Invariants

- Native Laya only: `DirectionLightCom` shadows, `SkyProceduralMaterial` on a
  `SkyRenderer`, `Scene3D` fog, `PointLightCom`/`SpotLightCom`, PBR emission.
  No custom shader, second renderer or post stack is added.
- Phase 1 scenes keep working and render as before unless they opt in
  (a flat `sky` colour and no preset keep the old look).
- Every new value is validated with a path; limits are explicit (light count
  within `Config3D.maxLightCount`).
- Every Laya object the stage creates is released by `dispose()`.

## Scope

### Engine

- `ZhudaFilmScene` look: `preset`, `shadows`, `atmosphere` (procedural sky),
  `fog`; `light` nodes; `emission` on flat materials. Presets resolve to plain
  values that `resolveZhudaFilmLook` reports.
- `mountZhudaFilmScene` applies them; meshes cast and receive shadows.
- Film host `--film-pack`: operator modules add props and recipes (needed to
  build scenes beyond the starter set).
- Tests, real-GPU checks, docs, MCP tool descriptions.

### Consumer or adapter

- None.

## Non-goals

Animated look tracks, bloom and tone-mapping in film renders, volumetric fog,
spline camera paths and shot lists (phase 3), audio in render jobs.

## Acceptance checks

1. Validation reports every bad look, light and emission field with a path.
2. Phase 1 scenes resolve and render unchanged.
3. Real WebGL: a shadow lands on the ground on the side away from the sun
   and disappears with `shadows: false`; the procedural sky has a vertical
   gradient; fog makes distant objects converge to the fog colour; a point
   light brightens the ground near it at night.
4. The test film re-rendered with presets, shadows and lights.
5. `npm run verify`, lint, format and `verify:film` pass.

## Result

See [verification.md](verification.md).
