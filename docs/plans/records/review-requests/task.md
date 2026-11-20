# Agent task: three requests of the outside review's scenes and models

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-21

## Source requirement

The outside review went on to make its fifteen characters and eleven scenes
for phones on engine `ba24ae4`, and wrote down what the engine or the film
scene format kept it from: `ENGINE-REQUESTS.md` in the private repository
`VerifyZhuda` (branch `claude/zhuda-engine-review-scenes-w8btzs`, `3c182f0`),
eight items, each with the source line and its own counts. The owner, shown
the list on 2026-11-21, asked for the three that are small and certain
("先做這三項"):

1. A film scene's model node cannot say `cullMeters`, `castShadow` or
   `cellMeters`, which the program interface has. A town, pines and lamps
   over 8 km, grouped by the default 32 m, drew 54,698 times a frame; the
   review merged them into meshes of its own to get 196.
2. A skinned model of more than 24 joints is cut into pieces by LayaAir, a
   draw each in every pass, and how many depends on the order of its
   triangles: 79 for a boss of 40 joints, 1,065 for a simplified fox of 36.
3. With ambient occlusion on, the whole scene is drawn once more each frame.

## Goal

The first two in the engine; the third answered with what the engine has.

## Change

**1. The model node** (`packages/core/film/FilmScene.ts`,
`packages/core/film/FilmStage.ts`): `cellMeters` (with `instanced`, 0.5 to
100000), `castShadow` (boolean) and `cullMeters` (above 0, at most 100000;
not with a lightmap). They go to `mountZhudaModel`, which had them. What a
cull distance leaves undrawn is chosen again whenever the stage's camera is
set, and when a model with `motion` has moved.

**2. Skins over 24 joints** (`packages/core/runtime3d/Laya342GltfAdapter.ts`):
`prepareLaya342GltfResource` orders a skinned primitive's triangles before
LayaAir's `splitSubMeshByBonesCount` walks them
(`orderLaya342SkinTriangles`, with `countLaya342SkinPieces` to say how many
pieces an order is cut into). Two things, neither of which changes a pixel:

- a joint a vertex names with no weight is replaced by the one it is
  weighted to most (LayaAir counts a named joint, weighted or not);
- the triangles are gathered a piece at a time: all whose joints the piece
  holds, then the one that adds the fewest, until no more fits in 24.

An order already cut as little is kept. It runs at load, in the engine, for
every glTF: no tool has to be run on an asset. The review's own tool
(`laya-split.mjs`, three sort orders tried at build time) gave the idea.

**3. Occlusion's extra pass.** No change to the runtime. The look already has
`grade.aoMethod: 'gtao'`, which reads the depth picture only: traced in the
measuring fixture, look level 3 draws the scene three times with `sao` (the
default) and twice with `gtao`, and takes 63 render targets a frame against 69. The scene format's page now says so beside `aoMethod`. Whether `gtao`
becomes the default is the owner's to decide: the two do not look the same,
and every approved scene would change.

Since `94eb400` occlusion that is switched off (look levels 1 and 2) costs
no pass with either method.

## Invariants

- Engine only. No vendor file is modified: LayaAir's loader is reached
  through the existing glTF adapter.
- A scene without the new keys mounts as before; a model of 24 joints or
  fewer is loaded as before, byte for byte in its index order.
- The review's scenes, models and tools stay outside this repository.

## Non-goals

The other five requests of the list: a close-range detail texture on
materials, cut-out and two-sided materials for program props, grass and
terrain nodes in the scene format, real transparency, light from what glows;
its tool requests (a ground-height query in the film host, a pack reloaded a
session, the page's and the film host's counts brought together); joints
beyond 24 in one draw (a bone texture).

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:film-model-distance` (new) on WebGL, and inside
   `npm run verify:film-webgpu`.
3. The review's models of more than 24 joints loaded before and after: the
   same picture, every clip moves, fewer draws.

## Unverified limits

See the [verification](verification.md).

## Rollback

`0a003e9` is the last commit without these. The ordering is one wrapped
method in `prepareLaya342GltfResource`; taking the wrap out restores the
file's order.
