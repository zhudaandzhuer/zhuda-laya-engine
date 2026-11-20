# Agent task: the rest of the outside review's requests

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-21

## Source requirement

`ENGINE-REQUESTS.md` in the private repository `VerifyZhuda` (branch
`claude/zhuda-engine-review-scenes-w8btzs`, `3c182f0`) lists eight things the
engine or the film scene format kept the review's scenes and models from.
Three were done first ([record](../review-requests/task.md)). The owner then
asked for the rest ("去把他們都完成"), on 2026-11-21:

1. A material has no close-range detail texture.
2. A program prop cannot be cut out to a silhouette or be truly two-sided.
3. Prop nodes have no distance settings (levels, cull distance, shadow
   switch); model nodes got theirs in the first record.
4. The scene format has no grass and no terrain, and a ground material
   cannot be projected from the side; a recipe cannot tell which way is up.
5. (done) 6. (done)
7. Tools: no ground-height or ray query in the film host; a pack edited
   while the host runs is drawn stale; the page and the film host count
   draws differently.
8. No real transparency, and what glows lights nothing.

## Goal

Each of them in the engine or the scene format, with a draw check on a real
GPU, or an answer with what the engine already has and a check that shows it.

## Change

| Request | What                                                                                                                                                                                                                                                                                                                      | Where                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 3       | A prop node takes `castShadow`, `cullMeters` and `lod: [{ fromMeters, params }]` (up to four levels, rising; gone beyond `cullMeters`). Props with neither stay merged a material.                                                                                                                                        | `FilmScene.ts`, `FilmStage.ts`                                                                  |
| 2, 8    | Both kinds of material take `blend` (`opaque`, `cutout`, `alpha`, `additive`), `alphaCutoff` and `doubleSided`; a flat one `opacity`. A recipe's base and layers take `alpha`, and a mask may be a `shape` (`disc`, `leaf`, `blade`, `petal`), so a recipe draws its own silhouette.                                      | `TextureRecipe.ts`, `ProceduralMaterial.ts`, `FilmScene.ts`, `FilmStage.ts`                     |
| 1       | A recipe material takes `detail: { recipe, meters, size, albedo, normal }`: a second recipe as LayaAir's detail map, repeating every `meters`.                                                                                                                                                                            | `ProceduralMaterial.ts` (`zhudaDetailPixels`), `FilmScene.ts`, `FilmStage.ts`                   |
| 4       | A `grass` node (`ZhudaGrassField`): an area, `clear` strips, kept off what stands on the ground; on level ground at `y` or on a terrain with `on`.                                                                                                                                                                        | `FilmScene.ts`, `FilmStage.ts`                                                                  |
| 4       | A `terrain` node: a grid with heights, from numbers or from fractal noise with flattened plots (`createZhudaTerrainMesh`, `zhudaTerrainHeights`, `zhudaTerrainHeightAt`). One mesh, drawn, lit, shadowed and asked like a box.                                                                                            | `procedural/TerrainMesh.ts` (new), `FilmScene.ts`, `FilmStage.ts`                               |
| 4       | A recipe material takes `projection: 'triplanar'` (laid on by place, three projections mixed by facing) and `top: { recipe, from, to }` (a second recipe on what faces up): `createZhudaTriplanarMaterial`, a `ZhudaLitSurfaceMaterial`.                                                                                  | `procedural/TriplanarMaterial.ts` (new), `FilmScene.ts`, `FilmStage.ts`                         |
| 7       | `film_scene_query` (MCP), `ZhudaFilmHost.raycast`, `stage.raycast`: heights at places and rays against the scene's props, boxes, shapes, ground and terrain.                                                                                                                                                              | `FilmStage.ts`, `film-host-client.ts`, `film-host.mjs`, `film-tools.mjs`                        |
| 7       | The film host notes every file a pack is built from, starts its page again when one is written (before the next session and the next mount), and reports `packs: { fingerprint, files, loadedAt }`. The tools read the page's props and recipes each time, so a prop added to a pack is accepted without a restart.       | `film-host.mjs`, `film-tools.mjs`                                                               |
| 7       | The film page says how the two counts differ and which to budget with. No code.                                                                                                                                                                                                                                           | `docs/film-scenes.md`                                                                           |
| 8       | Light from what glows: `look.bounceLight` already carries it (the probes capture emission with the rest of the scene). Now said in the film page, drawn by a check, and advised: a large glowing surface without bounce light is the tip `emission.lights-nothing`.                                                       | `FilmLint.ts`, `docs/film-scenes.md`, `docs/quality-route.md`                                   |

## Invariants

- Engine only. No vendor file is modified. The review's scenes, models,
  packs and tools stay outside this repository.
- A scene without the new keys mounts as before. Props without distance
  settings are merged a material as before.
- The stage's time, cache and release paths are the existing ones: a terrain
  and a triplanar material are released with the stage; baked sets go
  through the stage's bake cache; grass is filled by the stage's camera and
  shot time.
- A query draws nothing and reads the scene's own mesh data; it is not a
  physics engine and decides no gameplay.

## Non-goals

- A recipe mask that reads height above ground or which way is up inside the
  bake (the bake is a flat tile): `top` answers "moss on the top of a stone"
  in the shader instead. Height above ground ("damp at the foot of a wall")
  is not done; a `decal` node is the existing answer.
- Area lights and line lights with their own falloff and shadow. Glow through
  bounce light is as coarse as the probes.
- Models, water, mirrors, grass and decals in a query.
- Bringing the page's and the film host's draw counts together: the
  difference is explained as far as it was traced, not removed.
- Terrain that is streamed, edited or has caves (`ZhudaTerrain3D` and meshes
  of one's own).

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`.
2. On WebGL: `verify:film-model-distance`, `verify:film-cutout`,
   `verify:film-detail`, `verify:film-grass`, `verify:film-query`,
   `verify:film-pack-reload`, `verify:film-triplanar`, `verify:film-terrain`,
   `verify:film-glow` (all but the first new), and the neighbours
   `verify:film`, `verify:film-look`, `verify:film-model`,
   `verify:film-underwater`, `verify:instanced-mesh`.
3. `npm run verify:film-webgpu` (the new checks are in its list).

## Unverified limits

See the [verification](verification.md).

## Rollback

`a2d95f7` is the last commit without these. Each request is a commit of its
own on `feat/review-requests-2` and can be reverted alone, except that the
terrain commit holds the triplanar material and grass `on` as well.
