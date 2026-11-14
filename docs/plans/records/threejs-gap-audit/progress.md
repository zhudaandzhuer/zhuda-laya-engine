# three.js gap plan: progress

Plan: `docs/plans/records/threejs-gap-audit/plan.md` (work packages WP0..WP16)\
Last updated: 2026-11-15, after WP16 (batch 2 is done one package at a time, by one agent, without a review agent)

## Where each package stands

| Package                                                                                                                                                                                                                                           | State                                                                                                                                                                                         | Record                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| WP0 housekeeping                                                                                                                                                                                                                                  | Merged, reviewed, review points closed                                                                                                                                                        | `topology-globals-and-guardrail` |
| WP14 small game services                                                                                                                                                                                                                          | Merged, reviewed; five minor review points open, listed in its record                                                                                                                         | `game-services`                  |
| WP1 shadow maps every few frames or on request, render scale, FSR 1                                                                                                                                                                               | Merged, reviewed, one review round applied; measured on a vivo V40; no game uses it yet                                                                                                       | `frame-cost`                     |
| WP2 specular anti-aliasing                                                                                                                                                                                                                        | Merged, reviewed, reworked after review; **off until a scene asks** (decided at the merge: worse than off between two and four texels to a pixel, a lit rim, up to 3 ms a frame on the phone) | `specular-aa`                    |
| WP4 glTF intake (quantized, KHR meshopt, WebP/AVIF, lights, cameras)                                                                                                                                                                              | Merged, reviewed, one review round applied; `EXT_mesh_gpu_instancing`, texCoord 1 and Meshopt workers not done                                                                                | `gltf-intake`                    |
| WP7 physical surfaces in code (sheen, thin film, glass, turned highlights)                                                                                                                                                                        | Merged, reviewed, one review round applied (six textures a material at most, said and drawn at the limit); `ZhudaLitSurface` alpha, normal map and alpha hash not done                        | `physical-surfaces`              |
| WP3 shader warm-up                                                                                                                                                                                                                                | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40                                                                                                                             | `shader-warm-up`                 |
| WP5 KTX 2 / Basis textures                                                                                                                                                                                                                        | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; no encoder shipped and no encoder's output drawn (the check makes its own one-colour UASTC files)                          | `basis-textures`                 |
| WP6 HDR panoramas and the studio room                                                                                                                                                                                                             | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; not wired into film scenes, no GPU prefilter                                                                               | `hdr-environment`                |
| WP8 toon material, matcap, normal view, selection outline                                                                                                                                                                                         | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; no outline normals for hard-edged meshes, the outline is not in the depth texture                                          | `stylized-shading`               |
| WP9 instanced meshes and baked crowds                                                                                                                                                                                                             | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; the bake runs at load (no build-time baker), no blending in a crowd                                                        | `instanced-meshes`               |
| WP10 animation control (blend, overlay, cross-fade, IK)                                                                                                                                                                                           | Merged; desktop WebGL and WebGPU verified; the engine's own IK solvers, not LayaAir's module                                                                                                  | `animation-control`              |
| WP11 post quality (AgX and neutral curves, `.cube` table, SMAA, occlusion by horizons, lens flare, grade and bloom values)                                                                                                                        | Merged; desktop WebGL and WebGPU verified; the same page on the phone; the flare is the engine's own, not a wrapper                                                                           | `post-quality/`                  |
| WP13 lighting depth (falloff by the square, a spot's penumbra, wider and blended sun shadows, contact shadows, a schedule for point-light shadows)                                                                                                | Merged; desktop WebGL and WebGPU verified; the same page and a timing page on the phone; off until a scene asks; no game's lamps were renumbered for the square                               | `lighting-depth/`                |
| WP12 backend delivery (a loader that asks the browser and loads one backend, `"renderer": "auto"`, compilers fetched once for an origin, sizes)                                                                                                   | Merged; desktop WebGL and WebGPU verified; **no phone** (not reachable); no SDK release holds the loader yet; `ui` can leave the 3D bundles for 25 KB gzipped and was left in                 | `backend-delivery/`              |
| WP15 developer tooling (helper lines, the statistics panel, draws and GPU time on WebGPU, WebGL shader excerpts, a transform gizmo, also in the model editor)                                                                                     | Merged; desktop WebGL and WebGPU verified; the sun's shadow map is shown as what it covers, not as a picture; no gizmo in the film host                                                       | `developer-tooling/`             |
| WP16 GPU depth (a compute pass and copies drawn from its buffer, integer, matrix, array and cube-map uniforms, a common GLSL library, reflections by each surface's normal and roughness, a moving thing's velocity under temporal anti-aliasing) | Merged; desktop WebGL and WebGPU verified; **no phone**; compute is WebGPU only (the same step in JavaScript elsewhere); no `texture3D`, no velocity for instanced copies or bones            | `gpu-depth/`                     |

Each merged package's own record lists what it did not do; those lists are
the open work, not this table.

## How batch 1 was checked

- Each package was built in its own worktree by one agent, reviewed
  adversarially by a second (which wrote its own probes), and fixed by a
  third. The fixes were not reviewed a second time by an agent: at the merge
  each package's own checks, which now hold the reviewers' failing cases,
  were run again on the merged tree.
- Merged tree (`5f85f26`): `npm run verify` 628 of 628, lint, format and
  `git diff --check` pass. Sixteen real-draw checks on WebGL and on WebGPU
  (Apple M4), 32 of 32: the five new ones (`verify:gltf-intake`,
  `verify:physical-surfaces`, `verify:shadow-updates`, `verify:render-scale`,
  `verify:specular-aa`) and eleven older ones the merges touch.
- The consumer game `films/river-town-prefab`, built against the merged
  engine: its day pictures and its six prefab checks pass, unchanged (none
  of the new features changes a default).
- One phone (vivo V40), for WP1 and WP2: `records/frame-cost/verification.md`.

## What the phone said, in short

At 0.67 of the canvas with FSR the game's look level 2 costs 28 to 38 ms a
frame instead of 39 to 51, level 1 18 to 28 instead of 24 to 38; shadow
maps every third frame save 0.3 to 2.9 ms. The phone still does not hold 60
frames a second above look level 0. Whether a phone should aim at 30 with
the level 2 look or at 60 with the level 0 look is the game owner's choice;
the engine has both levers and a ladder (`zhudaQualitySteps`) for either.

## How WP3, WP5, WP6, WP8 to WP13, WP15 and WP16 were checked

One agent wrote, drew and recorded each; there was no second agent to
review them. Each has unit tests, a real-draw check on WebGL and WebGPU with
pictures that were looked at, the same page on the vivo V40, the full gates,
and a rerun of the older draws its change touches. What each could not
check is in its own record. WP12 and WP16 have no phone run (the phone was
not reachable).

## Next

Every package of the plan has been built. What the merged packages left
open (WP14, WP7, WP4, WP2) is being closed next, each in its own record.

Owed to WP12 when a phone is reachable: the auto page on the vivo V40
(which backend its Chrome is given, whether WebGPU starts on the Adreno
720, how long the compilers take inside the bundle and beside it).

## Found while doing WP16, beyond WP16

- LayaAir decides `#ifdef NAME` itself, from its own defines, before the
  GLSL compiler sees a `#define NAME` written in the source: a shader
  cannot switch a block of itself on that way (it compiles, and the block
  is simply absent). `#if defined(NAME)` is left to the compiler. Two
  variants of an engine shader are two shader texts under two names.
- LayaAir's `DeviceBuffer.destroy()` destroys a storage buffer that is
  also a vertex buffer twice and throws. Destroy its vertex side only.
- The shader glTF models are drawn with never wrote LayaAir's surface
  pictures (normal, roughness): to anything that reads them a glTF model
  was not there. `ZhudaEngine.boot` teaches it to, with LayaAir's own code.
- LayaAir's surface pictures and its velocity picture work on WebGL as on
  WebGPU. Only compute is WebGPU's alone.
- LayaAir's velocity picture holds the camera's motion only: under its
  temporal anti-aliasing anything that moves by itself smears (62 of 255
  on a striped box at four pixels a frame). `ZhudaObjectMotion` writes
  where each tracked node was the frame before.
- A camera that asked for the surface pictures keeps LayaAir's group of
  two render textures after the effect is gone; they are pooled as a group
  and not in the pool the engine's leak checks count.

## Found while doing WP15, beyond WP15

- The model editor (`zhuda-model-editor`) never kept its camera: its drag
  to turn the view and its wheel to zoom did nothing since it was written,
  and nothing checked it in a browser. It orbits and zooms now, and the
  draw check drives it with the browser's own pointer.
- LayaAir leaves the material of a line sprite behind when the sprite is
  destroyed. Anything that makes a `PixelLineSprite3D` has to destroy its
  material itself.
- A frame that throws on WebGPU (a shader that failed) leaves LayaAir's
  frame target unreturned; `showZhudaStats` makes LayaAir's text atlas,
  which LayaAir keeps. Neither was changed.
- Two lines drawn within a pixel of each other at nearly the same depth
  (the world's axes on two lines of a grid) win by turns from run to run.
  A check that samples one of them has to keep them apart.
- GPU times of a light frame vary from run to run by more than the frame
  itself (0.26 to 1.57 ms by WebGL's timer for the same scene). A check
  has to compare against a load that is several milliseconds, not a ratio.

## Found while doing WP12, beyond WP12

- The Doctor's check of a built page's library order looked at script tags
  only. A page that loads its libraries another way passed with nothing
  looked at; it now reads both orders out of an auto page's loader call.
- `verify-webgpu`, `verify-browser-sdk` and `verify-branding-browser` read
  `dist/browser/<version>` as it lies, and the builder refuses to overwrite
  a folder that differs. After a change to the bundles that folder has to
  be removed and built again before they mean anything.
- LayaAir swallows the error its adapter request throws and rejects with
  "Could not get WebGPU device"; the engine's `WEBGPU_ADAPTER` code never
  reaches a page. On WebGL `nativeEngine` is a minified class name (`Le`).
  Neither was changed.
- Carrying the WebGPU compilers as text in the bundle costs about 0.2 s of
  decoding at every start on the desktop; the same compilers as files are
  22 % fewer gzipped bytes. The browser SDK's default was left as it is
  (one file, one integrity value); `--wasm external` is the other way.

## Found while doing WP13, beyond WP13

- LayaAir changes the vector of its shadow strengths in place and puts the
  same object back. On WebGPU a vector put back as the same object uploads
  nothing. LayaAir gets away with it only because the first write happens
  to come before the first draw; anything that makes that vector earlier
  leaves the sun's shadows without strength on WebGPU. A scene with a
  `ZhudaLightingDepth` hands LayaAir a copy. The same holds for any vector
  of LayaAir's the engine reads, changes and sets: set a new one.
- A soft shadow edge made wider by stretching LayaAir's nine-read filter
  over more texels shows steps. Sixteen reads on a disc turned in every
  pixel do not; that is what `shadowSpread` above 1 is.
- `flat` is a word GLSL keeps for itself. A shader that names a variable so
  fails to compile and LayaAir skips the pass without a word in the log.
- The helper most draw checks read a patch of pixels with takes the nearest
  pixel number to a point, which is half a pixel off on average. The
  lighting check reads the pixel the point falls in; the older checks were
  left as they are (their limits were set with it).
- The sweep of the older draws found what the package's own check did not:
  a look disposed after its scene was destroyed threw, because LayaAir had
  taken the scene's values away. An owner that puts something on a scene
  has to go quietly when the scene went first; `verify-render-scale` holds
  that case for every part of a look.
- On the phone all four switches together cost about 10 ms where the parts
  add up to about 4. Not looked into.

## Found while doing WP11, beyond WP11

- LayaAir's own ambient occlusion (`ScalableAO`, the engine's default at
  0.65) darkens open ground by 16 % and the sky by 13 %, and costs 17 to
  20 ms a frame on the phone (it has the scene drawn once more for
  normals). `aoMethod: 'gtao'` leaves both as they are for 6 to 9 ms. The
  default was not changed: looks in use would change. A game should try it.
- One of LayaAir's shader-data objects drawn with one shader, then another,
  then the first again, draws the first with stale values (the first run
  of the curves showed ACES as no curve at all). Each shader keeps its own
  material or shader data here; nothing swaps a shader on one of LayaAir's.
- LayaAir lays a bloom dirt picture over the frame wrongly when the two
  have the same shape (it keeps the cover of whatever was there before).
  The pipeline sets the cover for that case.
- LayaAir's `CUSTOMLUT` path does not compile and its `LensFlareEffect`
  draws through walls and multiplies its elements' values each time one is
  set. Neither is used.
- The depth picture is read at high precision in every effect of the engine
  now (the item carried from WP8). The whole post-quality page gave the
  desktop's results on the phone; the older effects were not drawn on the
  phone again after the change.

## Found while doing WP9, beyond WP9

- On WebGPU LayaAir never draws its batches of identical renderers into a
  shadow map: repeated props cast no shadow there, in every scene so far.
  Shadow casters are kept out of the batches now and are a draw each. A
  game with many placements that cast should mark them `instanced: true`;
  none was run to see what the change costs it.

## Found while doing WP8, beyond WP8

- `ZhudaFilmicPipeline`'s `finishEffects` ran before the grade since they
  were introduced (LayaAir keeps its colour grade last). Fixed with WP8;
  edge smoothing and the lens finish now work on the graded picture, and
  the lens finish in the screen's colours. Films and games with grain or
  edge smoothing look a little different; none was rendered again.
- A phone reads the depth texture at low precision (LayaAir asks for high
  precision in numbers, not in texture reads). The selection mask reads it
  at high precision now. Still at the default: light fog, depth of field,
  screen reflections, point shadows, probe volumes, the water's depth fade
  and the clouds. To do with WP11, which adds another reader of depth.
- A pass of LayaAir's that fails to compile is skipped, and nothing
  reached the console as an error. A draw check should collect shader
  compile messages, as `verify:stylized-shading` does.

## Open from before the audit

- `inspectEngineHealth` counts loaded modules against the WebGL table only.
