# Task: bind a part's skinned meshes to another model's skeleton

- Id: `skin-binding`
- Asked by: the owner, 2026-11-25 (outfit creation and replacement for 3D characters), found while
  building `games/zhuda-wardrobe`
- Base: the unified branch after [repo-unification](../repo-unification/task.md)

## Why

A character dressed at run time keeps each garment as its own model on the body's joints. The
engine could load such a model but not make it follow the body: a consumer had to reach into
LayaAir's `SkinnedMeshRenderer` itself, and the obvious way (find joints by node name) fails when
a region of the body is named like the joint under it.

## Change

- `packages/core/runtime3d/SkinBinding.ts`: `bindZhudaSkinToSkeleton(part, skeleton)` and
  `ZhudaSkinBindingReport`, `releaseZhudaSkinBinding`. Joints are taken from the skeleton's own
  skinned meshes, by node name only when it has none; all of the part's meshes are bound or none.
  Where a part's joint rests differently from the body's (bones turned, an armature turned or
  scaled), the part is bound to an offset node under the body's joint holding the body's inverse
  bind times the part's rest; the part's culling box is moved into the body's space.
- `docs/animation-control.md`: "Wearing a part on another model's skeleton".
- `tests/skin-binding.test.mjs`.
- Consumer: `games/zhuda-wardrobe` and the kit under `games/tools/characters/`; routes
  `outfit-swap-3d` and `humanoid-from-shapes`.

## Not in this change

- No refitting of a part made for other proportions and no check of it; the body's own mesh is
  assumed to be in its model space; no merging of the shown regions and parts
  into one mesh; no level of detail per part; no cloth simulation on a worn part.
- The kit is a consumer tool under `games/tools/`, not part of the engine's API.
