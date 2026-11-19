# Agent task: ten patches from the outside review

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-20

## Source requirement

An outside review of `e453b60` (a cloud session on another account, started
2026-11-18; see `HANDOFF.md`) handed over a report, eleven film scenes, model
sets and ten patches with a reproduction each. Its work is in the private
repository `VerifyZhuda`, branch `claude/zhuda-engine-review-scenes-w8btzs`
(`deliverables/engine-patches/`), outside this one. The review ran on Linux with
software rendering only.

The owner asked for the ten to be judged together on 2026-11-20, and on the
result decided that `COLOR_0` is to be read as glTF specifies ("改成照規格").

## Goal

The ten patches in the engine, each defect reproduced here first on a real GPU
or, where it does not reproduce there, said so.

## What was reproduced here first

On macOS (Apple M4, Chrome 157, ANGLE Metal), `a5dfc6b`, with the review's
`run-repros.sh`. `a5dfc6b` differs from `e453b60` in documents only.

| Patch | Finding                                                                        | On the M4 before the patch                                            |
| ----- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 01    | SCN-02: `ZhudaLensFinish` tints the frame's outermost pixels with `fringe` 0   | not reproduced (seen on SwiftShader only)                             |
| 02    | SCN-01: the film host's page gives up a capture after 30 s, the host waits 600 | the limit is there; a 1080p still of 24 samples takes about 1 s       |
| 03    | LIFE-01: the shared manifest load belongs to its first caller's signal         | reproduced                                                            |
| 04    | LIFE-02: `ZhudaPrefabLibrary.dispose()` throws with a model still loading      | reproduced                                                            |
| 05    | LIFE-03: `ZhudaFilmAssets.dispose()` cannot be tried again after a refusal     | reproduced (Node 24; the test needs `--experimental-transform-types`) |
| 06    | GPU-05: FXAA reads the other side of the frame at its edge                     | reproduced                                                            |
| 07    | SCN-12: a line down the panorama sky where the picture's edges meet            | film `look.panorama`: reproduced; `ZhudaHdrEnvironment`: not          |
| 08    | SCN-13: an identity colour table changes smooth gradients                      | not reproduced (seen on SwiftShader only)                             |
| 09    | SCN-14: solids beyond about 2.2 km are drawn behind `look.clouds`              | reproduced                                                            |
| 10    | SCN-15: a mesh's primitives with different attributes are packed out of step   | reproduced                                                            |
| 10    | SCN-16: `COLOR_0` drawn as a display value, not glTF's linear one              | reproduced                                                            |

## Change

The patches as handed over, unchanged:

- `AssetProvider.ts` (03): the manifest load carries no caller's signal; a
  caller's signal ends that caller's wait.
- `PrefabLibrary.ts` (04): caches and the model library go when the last
  pending acquisition has ended.
- `FilmStage.ts` (05, 07): `ZhudaFilmAssets.dispose()` asks every part and
  counts as disposed once none refused; the panorama texture has no mip levels,
  bilinear filtering and `anisoLevel` 1.
- `HdrEnvironment.ts` (07), `ColorLut.ts` (08): `anisoLevel` 1. The cause is
  the one of GFX-03 (`installLaya342PointFilterFix`): LayaAir asks for 4x on
  every WebGL texture.
- `EdgeSmoothing.ts` (06), `LensFinish.ts` (01): reads stay inside the frame.
- `Clouds.ts` (09): sky is where the linear depth reaches the far plane
  (`depth < far * 0.998`), as `GroundTruthAO.ts` works its far plane out;
  `u_ZhudaCloudForward.w` is no longer read.
- `Laya342GltfAdapter.ts` (10): `unifyLaya342SubMeshAttributes` gives every
  primitive of a mesh the union of their attributes before LayaAir packs them;
  `zhudaGltfColors` hands red, green and blue over raised to 1/2.2, which
  LayaAir's shader raises to 2.2 again.
- `film-host.mjs`, `film-host-client.ts` (02): the page is given the time the
  host waits, less 10 s; a review sheet gets 120 s a shot.
- New checks: `verify:lens-finish`, `verify:edge-smoothing`,
  `verify:film-panorama`, `verify:film-lut`, `verify:film-cloud-depth`,
  `verify:film-gltf-vertex-data` (the last four also in `verify:film-webgpu`),
  `tests/film-host-timeout.test.mjs`, and the new cases of
  `tests/vertex-colors.test.mjs`.

## Invariants

- Engine only. No vendor file is modified; LayaAir is changed through the
  existing glTF adapter and by texture settings on textures the engine owns.
- Public runtime and declarations stay in step (`PrefabLibrary.d.ts`,
  `FilmStage.d.ts`, `Laya342GltfAdapter.d.ts` regenerated in the patches).
- The scenes, models and reports of the review are consumer content and stay
  outside this repository.

## Behaviour changes to note

- **`COLOR_0` draws brighter.** A value of 0.2 used to draw near 0.03 and now
  draws as 0.2. Shade, wetness or tint baked into a model's vertex colours and
  judged by eye under the old reading will look lighter: bake again, or raise
  the stored values to the power 2.2 to keep the old picture. A
  `ZhudaDynamicMesh`'s `colors` are not changed (still display values, as
  `docs/filmic-rendering.md` says).
- A mesh whose primitives differ in attributes now draws all of them.
- A caller that cancels no longer ends the manifest load for the others (03).
- `ZhudaPrefabLibrary.dispose()` no longer throws in that case; the model
  library goes when the last pending instantiate ends (04).
- The panorama sky has no mip levels: a picture far larger than the frame is
  not filtered down (07).
- A film still's page-side timeout follows the host's (02).

## Non-goals

- The review's findings without a patch (LIFE-04..12, SCN-04..06, SCN-09,
  BND-12, CI-06..09 and the rest of its report).
- A panoramic sky that keeps its mip levels (a sky shader of the engine's own,
  or a cube map made from the picture).
- One rule for LayaAir's default anisotropy on every texture without mip
  levels, in place of the three settings made here.
- Putting the film draw checks into CI (the review's CI-01).

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`: pass.
2. The review's `run-repros.sh --patched` against this tree: every
   reproduction a patch fixes passes.
3. Every `verify:film*` check and `verify:lens-finish`, `verify:edge-smoothing`,
   `verify:live-look`, `verify:gltf-intake`, `verify:prefab-models`,
   `verify:hdr-environment` on WebGL, and `verify:film-webgpu`: pass.

## Unverified limits

See the [verification](verification.md).

## Rollback

`a5dfc6b` is the last commit without the patches. Each patch touches its own
lines and can be reverted alone; reverting the `zhudaGltfColors` change restores
the old reading of `COLOR_0`.
