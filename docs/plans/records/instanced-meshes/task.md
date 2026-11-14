# Agent task: instanced-meshes

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP9): three.js draws many copies with `InstancedMesh` (a matrix and a colour
a copy) and has no node for a copy. The engine made a node tree for every
placement of a model and left the batching to LayaAir. WP9 asks for a
node-free instanced renderer with a colour a copy, grouped by square, used
by `ModelPlacements` in an `instanced` mode; and for crowds of one animated
character from an animation texture, with a baker.

## Goal

Five thousand props and five hundred animated characters, each a handful
of draws, lit and shadowed like any mesh, on WebGL and on WebGPU: the
picture of the same copies as nodes, at a fraction of the frame.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- The copies go through LayaAir's ordinary passes (lighting, fog, shadow
  maps, the depth texture): a group is an ordinary renderer with another
  geometry, not a second pipeline.
- The mesh, the materials and the model belong to whoever gave them: an
  instanced mesh or a crowd never copies or destroys them, and lets go of
  them at once when disposed.
- No clock of its own: a crowd is told the time.
- What is refused leaves nothing behind.

## Dependencies

- `mountZhudaModel` (`ModelPlacements.ts`), `ZhudaModelLod`, the model
  prefabs and film scenes that pass placements to it;
  `ZhudaLitSurfaceMaterial` for the tint; `ZhudaModelAnimationSampler` and
  `ZhudaModelInspector` for the bake.
- LayaAir 3.4.2: `MeshInstanceGeometry`, `BufferState`, the instance vertex
  declarations of `VertexMesh`, `SimpleSkinnedMeshSprite3D` and its
  `SIMPLEBONE` shader path, `WebGPUMeshRenderBatchAgent`.

## Scope

### Engine

- `packages/core/runtime3d/InstancedMesh.ts` (new): `ZhudaInstancedMesh`,
  `zhudaPlacementMatrices`, `zhudaInstanceCells`, the tint attribute.
- `packages/core/runtime3d/BakedCrowd.ts` (new): `ZhudaBakedCharacter`,
  `ZhudaBakedCrowd`, `zhudaBakedLayout`, `zhudaCrowdFrame`.
- `ModelPlacements.ts`: `instanced` and `cellMeters`; levels by group.
  `PrefabLibrary.ts` and `FilmScene.ts` / `FilmStage.ts` / `FilmPrefab.ts`:
  `instanced` on a model node with placements (`cellMeters` on a prefab).
- `LitSurfaceMaterial.ts`: reads a copy's tint under a define only the
  instanced renderer sets.
- `WebGPU342Adapters.ts`: renderers that cast a shadow are kept out of
  LayaAir's WebGPU batches, which are never drawn into a shadow map.
- `tests/instanced-mesh.test.mjs`, `tests/helpers/prop-fixture.mjs`,
  `tests/helpers/toon-fixture.mjs` (a character on a chain of bones),
  `tests/fixtures/instanced-mesh.ts`, `scripts/verify-instanced-mesh.mjs`,
  `npm run verify:instanced-mesh`.
- Seven consumer checks unpack the engine into a clean directory (a file
  an older package shipped shadowed one the present package ships).
- `docs/instanced-meshes.md`.

### Consumer or adapter

A game brings its own models and says where they stand. None is checked
in: the check makes a prop of two meshes and a character on 12 and on 30
bones.

## Non-goals

- A build-time baker in `packages/compiler` (the plan's wording): the bake
  runs where the model is loaded, with LayaAir's own animation, so it
  cannot disagree with it; it took 2 to 5 ms for the check's characters.
- Blending between clips or frames in a crowd; attachments to its bones.
- Moving, hiding or picking one copy; mirrored copies.
- A tint on LayaAir's stock materials (a model's own glTF materials).
- Making LayaAir's WebGPU batches cast shadows themselves.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:instanced-mesh` on WebGL and with
   `INSTANCED_RENDERER=webgpu`.
3. The same page, and its timing page, on a vivo V40.
4. The existing draws that use the lit template, model placements, film
   scenes and WebGPU batching still pass on both backends.

## Unverified limits

See the verification record.
