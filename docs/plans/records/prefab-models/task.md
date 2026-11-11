# Agent task: prefab-models

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-12

## Source requirement

The user asked for the river-and-town scene, so far a film scene of about
sixty model files, to be made into a prefab. The engine's 3D prefabs held
primitive meshes only; model files could not be part of one.

## Goal

Scenery made of model files is a prefab: defined as data, instantiated
through `ZhudaPrefabLibrary` in the isolated preview and in a Scene from the
same definition, and released completely. A film scene's scenery converts to
it.

## Invariants

- One mounting path: film scenes and model prefabs place models, copies,
  translucent leaves and emission through the same code.
- Models come through the library's `AssetProvider` and the existing model
  cache and leases; cancellation, timeout and disposal as for other prefabs.
- A prefab is scenery only. Lighting, sky, fog, water and cameras stay with
  the Scene (see `docs/prefab-workflow.md`).
- No consumer assets in this repository; fixtures are generated.

## Scope

### Engine

- `PrefabModelsDefinition`, `validatePrefabModels`, the `models` branch of
  `ZhudaPrefabLibrary`; `runtime3d/ModelPlacements.ts` shared with the film
  stage; `zhudaPrefabFromFilmScene`.
- The generated prefab preview boots with `gltf` when a model prefab exists.
- `verify:prefab-models`, unit tests, docs.

### Consumer or adapter

- The river-town consumer project and its assets live outside this
  repository.

## Non-goals

Level of detail, culling, streaming, lightmaps or animation inside a model
prefab, per-copy state, nested prefabs, converting the look or water of a
film scene.

## Acceptance checks

1. Real browser, independent consumer build: preview matches its reference,
   30 cycles leave no instance, a state and a single node select correctly,
   a moved copy fails.
2. Unit: definition validation with node names, converter output and its
   list of what is left to the Scene.
3. Film verifications still pass on WebGL and WebGPU after the shared
   mounting path.
4. `npm run verify`, lint, format, `git diff --check`.
