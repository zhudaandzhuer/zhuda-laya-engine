# Agent task: VRM 1.0 import

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-23

## Source requirement

`HANDOFF.md`, "Current priorities", item 2 (the owner's order, 2026-11-23):
"VRM import. The glTF loader, spring-bone simulation and toon shading exist,
but the loader does not read VRM extensions." The owner chose the version on
2026-11-23: "VRM用1.0" (VRM 1.0, not 0.x).

The extensions are those of the VRM Consortium's specification
(`vrm-c/vrm-specification`, `specification/`): `VRMC_vrm-1.0`,
`VRMC_springBone-1.0`, `VRMC_materials_mtoon-1.0`, `VRMC_node_constraint-1.0`.

## Goal

A `.vrm` file (a GLB with the VRM 1.0 extensions) loads through
`ZhudaModelLibrary` like any glTF model, and `ZhudaVrm` gives it what VRM
describes: its humanoid bones by name, its expressions (morph targets,
material colours, texture offsets) with the specification's override rules,
its gaze (bones or expressions), its spring bones and colliders on the
engine's spring solver, its node constraints, and MToon materials drawn by
the engine's toon material.

## Invariants

- One loader and one cache: the VRM data is read from the document
  `ZhudaModelLibrary` already parses, before LayaAir parses it; no second
  glTF parser, no second cache.
- One spring solver (`ZhudaSpringBoneSolver`), one toon shader
  (`ZhudaToonMaterial`), the engine's clock for time; no timer of its own.
- A model without VRM data loads and draws as before. A toon material
  without the new shade colour draws as before.
- Every reader is pure and gives each problem a JSON path; a file that is
  not VRM 1.0 (VRM 0.x's `VRM` extension) is refused by name, not misread.
- `ZhudaVrm` owns what it makes (toon materials, spring solvers) and
  releases it in `dispose()`; the model's nodes, meshes and textures stay
  the instance's.
- Licence fields of `meta` are passed through as the file states them, with
  the specification's defaults where absent; the engine never decides
  whether a use is allowed.

## Dependencies

- `ZhudaModelLibrary` / `ModelInstance` (`runtime3d/Assets.ts`), the glTF
  adapter (`Laya342GltfAdapter.ts`), `inspectGltfAsset`.
- `ZhudaSpringBones` / `ZhudaSpringBoneSolver`, `ZhudaToonMaterial`,
  `runZhudaAfterAnimation`, `ZhudaLayeredClock`.

## Scope

### Engine

- `packages/core/runtime3d/VrmDocument.ts` (pure reader and arithmetic),
  `packages/core/runtime3d/Vrm.ts` (`ZhudaVrm`), `Assets.ts` (the instance's
  glTF indices and its VRM data), `ModelCompatibility.ts` (the four
  extensions are the engine's), `simulation/SpringBones.ts` (a setting for
  each bone), `shaders/ToonMaterial.ts` (a shade colour), their declarations
  in `packages/types`, exports, tests, a draw check, `docs/vrm.md`.

### Consumer or adapter

- The avatar files, their licences and what a game does with them stay in
  the consumer. The test avatar is made by a program in the test itself; no
  third-party model is added.

## Non-goals

- VRM 0.x (`VRM` extension) and conversion from it.
- `VRMC_vrm_animation` (`.vrma` clips), `VRMC_springBone_extended_collider`,
  `VRMC_materials_hdr_emissiveMultiplier`.
- MToon's matcap, UV animation, outline width texture and the outline's
  lighting mix; a spring's `center` space; first-person mesh layers.
- Exporting VRM.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`.
2. `node --test tests/vrm.test.mjs`: the reader on a generated avatar (every
   section), deliberate failures with their paths, VRM 0.x refused, the
   expression override rules of the specification's examples, gaze angles
   and range maps, spring settings, constraints, MToon to toon.
3. `npm run verify:vrm` (new) on WebGL: the generated avatar loaded through
   `ZhudaModelLibrary`, drawn with its MToon materials as toon (bands, shade
   colour, outline), an expression that moves pixels, a gaze that turns the
   eyes, spring bones that swing behind a moving head and come back, a
   constraint that follows its source, thirty load-and-dispose cycles.
4. Neighbours on WebGL: `verify:stylized-shading`, `verify:spring-bones`,
   `verify:gltf-intake`.

## Evidence to attach

- Test/build output and the draw check's `report.json` (see verification).

## Unverified limits

See the [verification](verification.md).

## Rollback

`27c41b5` is the last commit without VRM. A model without VRM data takes no
new path; reverting the commit removes `ZhudaVrm` and the shade colour.
