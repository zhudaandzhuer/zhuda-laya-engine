# Task: levels of detail by distance for model copies

Status: Implemented within scope; drawn on desktop WebGL and WebGPU. Frame-rate gain not measured reliably.

## Source requirement

A consumer game offers a highest picture setting that loads film-quality
models: 7,293 copies, 94 million triangles when every copy draws its full
model. It ran at about 10 frames a second. The scenery needs to draw full
models near the player, lighter ones farther away and nothing beyond a limit.

## Change

- `runtime3d/ModelLod.ts`: `zhudaLodLevel` (the level for a distance, with
  hysteresis so a copy on a border does not flicker), `ZhudaModelLod`
  (switches the levels of many copies for one eye position; reads world
  positions once), `validateZhudaLodDistances`.
- `mountZhudaModel` options `lod` (lighter versions with the distance each
  begins at) and `cullMeters`; the mounted model exposes `lod`.
- `PrefabModelNode.lod` / `cullMeters` (at most four further levels, validated
  with the node's name) and `PrefabInstance.updateLod(eye)`, which returns how
  many copies draw each level, how many draw nothing and how many changed.

## Invariants

- The Scene says where the eye is. The engine reads no camera and no clock,
  and decides nothing about gameplay.
- Until `updateLod` is called every copy draws its full model: an isolated
  prefab preview is unchanged, and so is a prefab without `lod`/`cullMeters`.
- The lighter versions are ordinary logical asset IDs through the same
  `AssetProvider`; meshes and materials are shared by all copies.
- Disposal puts every copy back to its full model before the nodes are
  released.

## LayaAir 3.4.2 seam

A level is hidden with the renderer flag the LayaAir editor hides things with
(`RenderBitFlag_Editor`), not by deactivating its node. Deactivating removes
the renderer from the scene's lists; on WebGPU the renderers that stay were
then drawn with pipelines whose bindings no longer matched
("Binding doesn't exist in BindGroupLayout … group 2 binding 1"), which
invalidates the whole pass and leaves a black or unlit picture. The flag
skips a renderer in every pass and leaves the lists alone.

## Non-goals

Film scenes (one frame each); automatic generation of lighter models;
screen-size based selection; fading between levels; moving copies (call
`invalidate()` on the group after moving them; not exposed on a prefab
instance).

## Acceptance evidence

See [verification](verification.md).
