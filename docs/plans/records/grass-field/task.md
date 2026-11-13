# Agent task: grass-field

Status: Implemented within scope; desktop WebGL and WebGPU verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-14

## Source requirement

Owner's requests of 2026-11-13: the grass of the city-walk game ("this
low-quality grass should not be used": three-vertex blades that read as green
triangles on bare earth) was taken out, followed by "make new grass".

## Goal

A grass field in the engine, good enough to stand beside scanned models at a
player's eye level, that a game plants by saying where the ground is and
where nothing grows.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- The game owns the ground, the exclusions and the time; the engine draws.
  Time comes from the caller (`update(eye, seconds)`): no clock of its own.
- Nothing is updated per blade on the CPU after a patch is made; a patch is
  made in bounded work a frame.
- Every mesh and the material have a disposal path; a disposed field refuses
  further calls.
- The same seed, area and options grow the same grass.
- No claim beyond what a script drew: desktop WebGL and WebGPU on one Apple
  M4. Phones, frame budgets and art approval are not part of this task.

## Dependencies

- `ZhudaLitSurfaceMaterial` (vertex and surface hooks), `zhudaDecodeColor`.
- `scripts/lib/chrome-fixture.mjs`, the browser SDK build.

## Scope

### Engine

- `packages/core/runtime3d/Grass.ts`: `ZhudaGrassField`, `validateZhudaGrass`,
  `resolveZhudaGrass`, and the pure parts `zhudaGrassShown`, `zhudaGrassLevel`,
  `zhudaGrassPatchBlades`, `zhudaGrassMeshes`, `zhudaGrassTurf`.
- `ZhudaLitSurfaceMaterial`: `backFaces: 'same'`, so that the back of a
  two-sided surface is lit with the normal its vertex gave.
- `tests/grass.test.mjs`, `scripts/verify-grass.mjs` with
  `tests/fixtures/grass-field.ts`, `docs/grass.md`.

### Consumer or adapter

- `films/river-town-prefab` (outside this repository) plants the field in
  place of its own blades. Its record is its `HANDOFF.md`.

## Non-goals

- Blades pushed aside by characters, blade shadows, light through a blade.
- A grass node for film scenes.
- Flowers, weeds or any model scattering (`placements` does that).
- Phones and mini-game hosts; a frame budget.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- `npm run verify:grass` on WebGL and with `GRASS_RENDERER=webgpu`, with
  pictures a person can look at.
- The city-walk game's own checks with the field planted, and pictures from
  the player's height.
