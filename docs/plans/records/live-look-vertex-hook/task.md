# Agent task: live-look-vertex-hook

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-12

## Source requirement

The Larkhollow probe (an independent consumer page outside this repository,
built on the HEAD 3d-gltf browser bundle) checked whether a code-only
first-person farm scene can be built on the public SDK. Two gaps needed code
outside the engine contract:

1. Grass and leaves that move in the wind. `ZhudaLitSurfaceMaterial` cannot
   move vertices, and a `createCustomSurfaceMaterial` shader has no shadow
   caster, depth-normal pass or PBR lighting.
2. A day that passes. `ZhudaFilmStage` and `ZhudaSceneLook` fix the look at
   construction, so the probe rotated the native `DirectionLightCom` itself.
   The sky, fog, water glints and beams then no longer matched the sun.

The user asked for both APIs ("補這兩個 API").

## Goal

- `ZhudaLitSurfaceMaterial` takes an optional `vertex` hook. It moves
  world-space positions and normals the same way in the forward,
  `ShadowCaster` and `DepthNormal` passes.
- `ZhudaFilmStage.setLook(look)` and `ZhudaSceneLook.setLook(look)` change
  the look while the scene runs. Continuous values are updated in place.
  Structural changes rebuild only the look.

## Invariants

- Without `vertex` the generated shaders are byte-identical to before, so
  existing materials and their program caches are unchanged.
- The vertex hook is a bounded function-body contract (`zhudaVertex`) with the
  same `u_Zhuda` uniform rule as the surface hook. It cannot change alpha,
  UVs, clip-space output or lighting.
- `setLook` validates the whole look with the scene validator before it
  changes anything. A rejected look leaves the stage as it was.
- Panorama and environment probe need assets or a capture. `setLook` refuses
  to add, remove or change them.
- In-place updates allocate no GPU resource. A rebuild releases everything the
  previous look created, and 30 rebuilds leave resource counts bounded.
- The water glint and the light-shaft sun follow the sun after either path.

## Dependencies

- `ZhudaLitSurfaceMaterial`, `LitSurfaceTemplates` (Laya 3.4.2 PBR passes).
- `applyResolvedFilmLook`, `resolveZhudaFilmLook`, `validateZhudaFilmScene`,
  `ZhudaFilmicPipeline.setExposure`, `ZhudaLightFog.attachSun` (repeatable),
  `applyZhudaHemisphereAmbient`, `ZhudaWaterSurface`.

## Scope

### Engine

- `packages/core/shaders/LitSurfaceMaterial.ts`
- `packages/core/film/FilmScene.ts`: pure structural comparison.
- `packages/core/film/FilmStage.ts`: `setLook`, the look handle and the
  water sun.
- `packages/core/film/SceneLook.ts`: `setLook`.
- `packages/core/shaders/WaterSurface.ts`: `setSun`.
- `packages/core/runtime3d/EnvironmentProbe.ts` and `Filmic.ts`: the
  hemisphere ambient is recoloured in place (`prefilterZhudaHemisphere`,
  the handle's `update`, the environment's `update`).
- `packages/compiler/runtime3d-types.mjs`: normalise emitted paths, so
  declarations are generated and checked on Windows.
- Public declarations, docs, unit tests, and a real-WebGL verification script.

### Consumer or adapter

- The Larkhollow probe (outside this repository) switches to the new APIs.

## Non-goals

- Motion vectors for displaced vertices. The film chain runs without TAA, and
  `ZhudaFilmicPipeline` with `temporalAA` stays a consumer choice.
- Changing panorama/environment at runtime.
- Automatic bounds growth for displaced meshes. The consumer pads the bounds.
- A day/night preset curve. The consumer decides how a look changes with time.

## Acceptance checks

1. `node --test tests/live-look.test.mjs`: structural comparison, vertex hook
   validation and template injection, all with no Laya runtime.
2. `npm run verify:live-look` (real WebGL, desktop Chrome):
   - A vertex hook that lifts a plane moves its pixels and its shadow. The
     shadow moves because the `ShadowCaster` pass uses the hook.
   - A continuous `setLook` (sun elevation, ambient, fog, exposure) changes
     the frame and keeps the same pipeline and sky material, so nothing is
     rebuilt.
   - A structural `setLook` (grade off, then on) changes the frame and
     restores it.
   - 30 alternating structural `setLook` calls leave scene resources bounded.
   - A look with a panorama is refused and the frame is unchanged.
3. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.

## Evidence to attach

- Test/build output: the verification record.
- Browser/WebGL report: JSON written by `verify:live-look`.

## Unverified limits

- WebGPU, mobile, Linux/macOS.
- Program-cache growth when a consumer creates many differently named
  hooked materials. Names are stable per contract, as for the surface hook.

## Rollback

Base commit `74f01f5`. Both features are opt-in: a material without `vertex`
and a stage without `setLook` calls behave exactly as before.
