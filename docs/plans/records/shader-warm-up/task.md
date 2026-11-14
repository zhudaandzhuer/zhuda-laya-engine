# Agent task: shader-warm-up

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP3): three.js has `renderer.compileAsync(scene, camera)`; LayaAir 3.4.2
compiles a shader at its first draw, and nothing in the engine compiles
ahead. WP3 asks for a warm-up that records `ShaderVariantCollection` entries
per material and quality level and compiles them behind the splash, with a
draw of every variant into a small target as the fallback.

## Goal

A scene whose shaders were listed once compiles nothing at its first frame
and nothing when its look changes level, on WebGL and on WebGPU, and is the
same picture as without the warm-up.

## Invariants

- LayaAir 3.4.2 vendor files are not modified. LayaAir's own switches
  (`Shader3D.debugMode`, `ShaderVariantCollection.active`) are given back
  when the recorder stops.
- A warm-up changes no picture: a shader it compiled is the shader the draw
  would have compiled.
- A warm-up cannot keep a game from starting: a bad or foreign list is
  refused in the report, a compile that throws is reported and the rest go
  on, a cancelled signal rejects between two compiles.
- Loading time is not gameplay time: the wait between slices is a frame of
  LayaAir's system timer, never a game clock.

## Dependencies

- LayaAir 3.4.2: `Shader3D.compileShaderByDefineNames`, `ShaderPass`,
  `ShaderVariantCollection`, `preDrawUniformMaps` of the 3D render context
  on either backend.
- The engine's effect modules, which now leave their shader registration in
  `ShaderRegistry.ts`.

## Scope

### Engine

- `packages/core/runtime3d/ShaderWarmUp.ts` (new): `ZhudaShaderVariantRecorder`,
  `zhudaWarmUpShaders`, `validateZhudaShaderVariantList`,
  `zhudaSortShaderVariants`, `zhudaMergeShaderVariants`,
  `zhudaShaderVariantKey`, `zhudaShaderBackend`.
- `packages/core/runtime3d/ShaderRegistry.ts` (new): `registerZhudaEffectShaders`.
- The effect modules register through it: `CameraEffects`, `Clouds`,
  `EdgeSmoothing`, `Filmic`, `LensFinish`, `LightFog`, `PointShadow`,
  `ProbeVolume`, `RenderScale`, `ScreenReflections` (the registration code is
  unchanged; two of them had it inline in a constructor).
- `tests/shader-warm-up.test.mjs`, `tests/fixtures/shader-warm-up.ts`,
  `scripts/verify-shader-warm-up.mjs`, `npm run verify:shader-warm-up`.
- `docs/shader-warm-up.md`.

### Consumer or adapter

A game records its own list (its scenes, its look's levels, its lamps) and
ships it; nothing is recorded for a game here.

## Non-goals

- Compiling off the main thread or in parallel (`KHR_parallel_shader_compile`,
  `createRenderPipelineAsync`): needs changes inside LayaAir's backends.
- Making WebGPU render pipelines ahead of the first draw.
- A build-time tool that records without running the game.
- The fallback the plan names (drawing every variant once into a small
  target): not built. It would also make the WebGPU pipelines, but it needs
  every object of every state in view of one camera, which a game has to
  arrange itself; the list covers what the plan wanted it for.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:shader-warm-up` on WebGL and with
   `WARM_UP_RENDERER=webgpu`: the cold mount compiles at its first frame and
   at changes of level; after the warm-up the same frames compile nothing;
   the warmed-up picture equals the cold one at look levels 3 and 0.
3. The same page on a vivo V40.

## Unverified limits

See the verification record.
