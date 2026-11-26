# Route: An outdoor landscape on terrain, placed by query, for phones

A film scene of a mountain, ridge or dune landscape hundreds of metres to kilometres across: the
ground is the engine's `terrain` node built from the consumer's own height function, steep rock is
laid on by place with something else on what faces up, grass grows on the terrain, and every tree,
person, decal and eye-level camera stands where the mounted scene says the surface is. Driven by
data (a `scenes-src/*.mjs` file written into a `ZhudaFilmScene`), drawn by the film host and by
the consumer's page. Checked only in software (SwiftShader) on a Linux container; no phone.

- **Id:** `outdoor-landscape`
- **Kind:** scene
- **For:** building a large outdoor film scene (ridge, peaks, dunes, sea bed) on terrain nodes with triplanar rock, grass, query-placed props and people, inside a phone budget
- **Checked on:** desktop WebGL (Chrome's ANGLE on SwiftShader, Vulkan 1.3.0, Linux); no phone
- **Status:** scene 05 (雲海山門) built and measured end to end on 2026-11-24 in software only, then scenes 04 (snow), 07 (dunes), 08 (sea bed) and 02's far mountain the same way (draft; written against an earlier engine commit and not re-run on this one)
- **Reference consumer:** the owner's verification repository (not published; the tools and scene files named below are not in this repository): `epic-scenes/scenes-src/05-cloud-sea-gate.mjs` with `src/pack/kit/heights.ts` and `tools/place.mjs`
- **Engine version:** zhuda-laya-engine `6f467bba1b4a4052be66d4cee9b9346742a276dc`

## When to take this route

Take it when the ground of a scene is a height function (a ridge, dunes, a sea bed, peaks) that
the camera sees from metres to kilometres, and things must stand on it. It does not fit ground
with caves or overhangs (a terrain node is a heightfield: keep those as the pack's own mesh, as
scene 07's cliff and scene 08's isles do), interiors (take `film-as-data` and ask heights with
`place.mjs`'s `{ from, points }` under the roof), or a single hero object (`model-from-dcc`).

## Tools

- Node 22 (the repository's), the engine at the commit above through the project's
  `package.json` pin; no other tool.
- Engine: `ZhudaFilmHost` from `zhuda-laya-engine/packages/mcp-server/film-host.mjs`
  (`raycast` = the MCP tool `film_scene_query`, `preview`, `review`, `flythrough`); the scene
  types in `packages/types/film/FilmScene.d.ts`.
- Consumer tools (MIT-style, in the reference consumer): `tools/place.mjs` (asks the mounted scene
  where its surfaces are), `tools/build-scenes.mjs`, `tools/render.mjs`,
  `review-work/scenes-mobile/measure-scenes.mjs` and `review-work/round-8/breakdown.mjs` (counts).
- Commit the scene sources, the answers (`scenes-src/places/<id>.json`) and the built
  `scenes/<id>.json`; renders as JPEG.

## Steps

1. **Move the height function out of the prop.** The function a pack prop used to build its own
   heightfield goes into a module that the scene file can import in Node
   (`src/pack/kit/heights.ts`: `ridgeShape`, `spiresHeight`, `palaceMountainShape`,
   `fieldHeight`). The prop keeps its stairs, buildings and trees and gets a switch to leave its
   ground out (`mountain-gate`'s `ground: 0`), and both take the same `heightSeed`. Check: the
   prop alone (`ground: 0`) and the terrain alone line up in a preview.
2. **The ground as `terrain` nodes.** `terrainHeights(height, centre, size, cells)` gives the
   `heights` array (`(cells+1)²` numbers, row by row from -Z, each row from -X); at most 254
   cells a side. Scene 05: the ridge 188×254 cells (about 2.1 m); near peaks 96, far peaks 48.
   Check: `film_scene_lint` advice empty, the preview's `metrics.flags` empty.
3. **Rock laid on by place.** Materials on steep ground take `projection: "triplanar"` and a
   `top` recipe for what faces up (`{ recipe: "moss", from: 0.62, to: 0.86 }`). Not with
   `variation`, `detail`, `blend` or `doubleSided`; the recipes must be the pack's own (the
   engine ships five, none of them rock). Check: no streaks down the slopes in the review grid.
4. **Grass on the terrain.** A `grass` node with `on: "<terrain id>"`, an `area`, `density` and
   `distanceM` (05: 260 and 55 m); what stands on the ground (the stair prop) keeps it clear.
5. **Ask where to put things.** The scene file exports `baseScene` (without what is to be placed)
   and `queries` (`{ name: [[x, z], …] }`, or `{ from: y, points }` from under a roof);
   `node tools/place.mjs <id>` mounts the base scene in `ZhudaFilmHost` and writes every answer
   `[x, y, z, node]` to `scenes-src/places/<id>.json`. The scene filters by the node a ray met
   (pines only on the terrain, people only on the stair) and puts eye-level cameras 1.7 m above
   the answer. 05: 81 questions, none unanswered. Rerun after any change to the ground.
6. **People.** Rigged glTF figures (`assets/people/`, 4,000 and 2,000 triangles) as `model` nodes
   with `animation` (and `motion` to walk them); the far ones `castShadow: false`.
7. **Trees and foliage.** Cut-out cards (`blend: "cutout"`) with an outline drawn by a pack
   recipe (`base.alpha` 0, a `shape: "disc"` layer with `alpha` 1, a noise layer with `alpha` 0
   for a ragged edge): fewer, larger cards than opaque ones.
8. **Decals and effects.** `decal` nodes for stains and moss at the feet of buildings, at the
   heights the queries gave; `effect` presets for smoke, dust, snow; review shots at `time: 8`
   (an effect has no particles at 0 s).
9. **Count.** `measure-scenes.mjs` for the scene's own camera (as written, no shadows, no AO);
   `breakdown.mjs` to find which nodes the triangles belong to; the page
   (`tools/browser-run.mjs`, ZhudaRuntimeProfiler) for the phone budget. 05: 140 draws,
   1,356,144 triangles in the host; 142 and 1,356,278 in the page. A scene with a `reflector`
   counts hundreds of thousands of triangles more in the page than in the host
   (`ENGINE-REQUESTS-2.md` item 5): trust the page.

## Pitfalls

- **A terrain is drawn five times.** Main view, two shadow cascades and two AO passes; a low sun
  puts far terrain into the cascades. 05's first version (near peaks 128 cells, far 80) was
  1,805,984 triangles. Fix: few cells for far terrain (48), none of the shadow options exist yet.
- **Rays from 10 km hit the roof.** In a hall the first surface is the roof; ask from under it
  (`{ from: 20, points }`). A ray straight down at a lamp or a burner hits the lamp: ask beside it
  and use only the height.
- **Effects are empty at 0 s.** A review or still at time 0 shows no smoke, snow or petals; give
  the shots `time`.
- **The page's 50 MB.** The consumer build packs `dist/web` as one archive limited to
  50,000,000 bytes unpacked; terrain heights in the scene JSON and glTF people add up. Quantize
  big models (`KHR_mesh_quantization`) before dropping quality.
- **A moving thing redraws every shadowing point light.** Effects (snow, dust, petals) and walking
  people make each point light with `castsShadow` draw its six faces again every frame, and a prop's
  `castShadow: false` does not keep it out of them (`ENGINE-REQUESTS-2.md` item 3): 02 went to 951
  draws. Light outdoor scenes by the sun; lamps without shadows.
- **Weather over the camera.** The `rain` and `snow` presets are to be put over the camera, but a
  drop that passes within half a metre of the lens is a white bar a tenth of the frame wide: keep
  the volume a few metres in front of each review camera.
- **Single cones read as pyramids under triplanar.** Streaks down a slope had been doing the work
  of crags; with the rock laid on by place, the shape has to carry it (05's peaks became clusters
  of fluted pillars).

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| Point-light shadows redrawn every frame once anything moves; `castShadow: false` ignored by them (item 3) | No `castsShadow` on point lights |
| `terrain` has no `castShadow`, `cullMeters` or `lod` (`ENGINE-REQUESTS-2.md` item 1) | Few cells on far terrain; or keep a far mountain as a pack prop with `castShadow: false` |
| No quantizing option in `zhuda-laya-lod` (item 2) | glTF Transform's `quantize()` in a consumer script |
| The reply's sample recipes (`rock-grain`, `cliff-stone`, `moss`) are not in the engine | Recipes in the consumer's pack |

## Checks

- `node tools/render.mjs scenes/<id>.json --preview` → `advice: []`, `metrics.flags: []`, no GL
  errors (05: all three).
- `bash review-work/round-8/review-pair.sh <id>` → the four-shot review before and after with the
  same cameras (05: `epic-scenes/renders/round-8/05-cloud-sea-gate-review-before-after.jpg`).
- `measure-scenes.mjs` and `browser-run.mjs` counts under 300 draws and 1.5 million triangles
  (05: 140 / 1,356,144 host, 142 / 1,356,280 page; software drawing, counts only).
- `npm run verify` in the consumer: 57 of 57.

## Not checked

- Any phone, any frame time: every number here is a count from software drawing.
- WebGPU.
- The cost of triplanar with `top` (twelve texture reads a pixel) on a phone's GPU.
- Grass counts from the eye-level camera (the budget was measured from the scene's own camera).
- Terrain larger than 254 cells a side split across several nodes (not needed here).

## Boundaries

The consumer owns the height functions, the pack's props and recipes, `place.mjs` and the
placement rules (which node a thing may stand on), the people's models and the budget. The engine
owns the terrain, grass, effect and decal nodes, triplanar projection, the raycast behind
`film_scene_query`, and the counts its profiler reports.
