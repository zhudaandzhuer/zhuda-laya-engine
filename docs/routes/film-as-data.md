# Route: a film or a still authored as data and rendered to PNG or MP4

A scene written as JSON (`ZhudaFilmScene`): camera, look, materials and nodes. An
agent creates it through the MCP server, previews it on a real GPU after every
change, reads advice and metrics in place of judging the picture, and renders the
final still or video as a job. The same scene mounts in a game through
`mountZhudaFilmScene`. Drawn on a desktop with both backends.

- **Id:** `film-as-data`
- **Kind:** workflow
- **For:** Building a 3D scene, a still or a film without writing engine code: the scene format's nodes and materials, the preview loop, asking the scene where its surfaces are, packs of one's own props and recipes, and the final render.
- **Checked on:** desktop WebGL; desktop WebGPU; no phone
- **Status:** every node, material option and tool named here is drawn by a check of
  its own (`npm run verify:film` and the `verify:film-*` family) on an Apple M4,
  WebGL, and on WebGPU through `npm run verify:film-webgpu` (33 checks,
  2026-11-21). No phone.
- **Reference consumer:** the outside review's eleven scenes (`VerifyZhuda`,
  `epic-scenes/`, outside this repository); the engine's fixtures under
  `tests/fixtures/film/`.
- **Engine version:** 1.18.0 at `1c8c08d` or later (terrain, grass, triplanar,
  query and pack reload are from that commit).

## When to take this route

For a film, a still, a level laid out as data, or a 3D scene an agent builds and
looks at in a loop. For the order of look settings take
[good-looking-3d-scene](good-looking-3d-scene.md) beside it. For a timeline of
shots, sound and MP4 export from a game's own scene, read
[cinematics](../cinematics.md). For authored models inside the scene take
[model-from-dcc](model-from-dcc.md).

## Tools

- `npx zhuda-laya-mcp --film-output ./films` with `--film-pack <module>` (your
  props and recipes), `--film-assets <dir>` (models, lightmaps, pictures) and
  `--film-renderer webgpu`.
- MCP: `film_scene_create`, `film_scene_get`, `film_scene_apply`,
  `film_scene_preview`, `film_scene_review`, `film_scene_query`,
  `film_scene_lint`, `film_render_job`, `film_scene_close`.
- In a program: `ZhudaFilmHost` (preview, review, raycast, flythrough),
  `loadZhudaFilmScene`, `mountZhudaFilmScene`.

## Steps

The format in full is [film scenes](../film-scenes.md#scene-format).

1. **Start the server and create a session**: `film_scene_create` with a scene of
   `schemaVersion: 1`. The reply lists the props, recipes and assets the host can
   use, the pack fingerprint, and `advice`.
2. **Ground first.** A `ground` node, or a `terrain` node for ground with heights
   (`noise` with `flatten` rectangles for plots and roads, or `heights` of your
   own). Give steep ground a recipe with `projection: "triplanar"`, and `top` for
   moss or snow on what faces up.
3. **Ask where things are.** `film_scene_query` with `heights: [[x, z], ...]` before
   placing cameras, lamps and objects on a terrain or on props; never work a height
   out by hand.
4. **Objects.** `prop` nodes from the starter set or your pack (with `castShadow`,
   `cullMeters` and `lod` for large or distant ones), `box`, `lathe`, `extrude`,
   `sweep`, `model` (a `.glb`, with `animation`, `motion`, `placements`),
   `decal` for stains and marks.
5. **Materials.** Recipes sized for the camera (`size`), `variation` on large
   floors, `detail` for close range, `blend: "cutout"` with a `shape` mask for
   leaves and cards, `blend: "alpha"` and `opacity` for mist, glass and falling
   water, `doubleSided` for thin things.
6. **Plants, water and effects.** A `grass` node on level ground (`y`) or on a
   terrain (`on`); one `water` or one `reflector` node; `effect` nodes for fire,
   smoke, sparks, explosions, magic, rain, snow, leaves and bubbles from the
   built-in presets (put a point light in a fire: particles light nothing).
7. **Look.** Follow [good-looking-3d-scene](good-looking-3d-scene.md): preset,
   grade, sun from the side, shadows, fog, `bounceLight`.
8. **Preview after every change**: `film_scene_apply` with `expectedRevision` and
   `preview: true`; `film_scene_review` for two to four cameras in one grid. Stop
   when `advice` is empty, `metrics.flags` is empty and `glErrors` is absent.
9. **Your own props and recipes** go in a pack
   ([your own props and recipes](../film-scenes.md#your-own-props-and-recipes)). An
   edited pack is read again by itself; record `packs.fingerprint` with every
   measurement.
10. **Render**: `film_render_job` with `kind: "still"` or `kind: "video"` along a
    camera path. The file is written once into `--film-output`.

## Pitfalls

- **Colours are display values**, as a colour picker shows them: 0.5 is 21 % of the
  light, and emission above 1 grows as the 2.4th power
  ([colour values](../film-scenes.md#colour-values)).
- **Emission lights nothing by itself**: add `bounceLight` or lamps.
- **One reflector or one water node** a scene; one spot light and eight point
  lights with shadows.
- **Blended surfaces write no depth** and are sorted by mesh: sheets that cross
  each other can draw in the wrong order. Prefer `cutout` where it will do.
- **Triplanar costs three times the texture reads**: use it where stretching shows.
- **Props with `lod` or `cullMeters` are not merged** with the others: each is its
  own draws. Keep them for large pieces.
- **A stale revision is refused**: read the scene again and apply to the current one.
- **Counting draws**: the film host counts the capture path, a game page counts the
  engine's loop; they differ. Budget a phone with the page's count.

## Engine gaps and their workarounds

- No caves or overhangs in a `terrain` node: author them as meshes.
- No recipe mask by height above ground (damp at the foot of a wall): use a `decal`.
- No area or line lights: `bounceLight` for the glow, point lights for a sharp pool
  of light.
- A query does not see models, water, mirrors, grass or decals.
- In a dark scene lit by a glow through `bounceLight`, thin lines show between probe
  cells (seen, not fixed).

## Checks

`npm run verify:film`, `verify:film-look`, `verify:film-model`,
`verify:film-terrain`, `verify:film-triplanar`, `verify:film-grass`,
`verify:film-query`, `verify:film-pack-reload`, `verify:film-cutout`,
`verify:film-detail`, `verify:film-glow`, `verify:film-effects`,
`verify:film-model-distance`, and all of
them on WebGPU with `npm run verify:film-webgpu`. Records:
[film scene loop](../plans/records/film-scene-loop/verification.md),
[the review's requests](../plans/records/review-requests-2/verification.md).

## Not checked

No phone drew a film scene in these checks. A preview is one sample on one GPU; a
render job is the final picture. Whether a scene looks good to a person is not
measured: advice and metrics only name known defects.

## Boundaries

The scene, its pack, its models and its pictures belong to whoever makes the film.
The engine draws it and checks the data; a pack is written against the public SDK
like any consumer code.
