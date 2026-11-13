# Verification record: fable-batch-review

Task document: none in the repository; the brief is the review request of 2026-11-13
(review and locally verify the eight-batch delivery recorded in
`docs/plans/records/quality-defaults/`)  
Commit: `c964c76` on branch `claude/fable-batch8-review-8b8d41` (local only, not pushed)  
Date: 2026-11-13

Decision in one line: **merge with listed fixes**. The WebGPU defects found are
the `verify:live-look` regression and the scaffold's `.mcp.json` are fixed on
this branch (see "Fixes made after the review").

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157.0.8103.39
  headless (`--headless=new`) through the repository's `chromeFixture`.
  WebGL adapter reported by the scripts: `ANGLE (Apple, ANGLE Metal Renderer:
Apple M4)`, a real GPU. WebGPU adapter: `WebGPU apple metal-3 (ready)`.
- Node and package manager: **Node 26.12.0**, npm 11.20.0. The delivery asks for
  Node 24; no Node 24 is installed on this machine, `engines` is `>=24`.
  `npm ci` exit 0 (esbuild's postinstall was not run by npm's script policy; the
  build works).
- Engine commits: base of the delivery `d61f6db`; current `origin/main`
  `3b4acec`. Review branch: `1b1b1fb` (delivery zip laid over `d61f6db`,
  unmodified) merged into `3b4acec` as `183c11c` with **no conflict**, then
  `c964c76` (`npm run format`, 24 files, whitespace only). Baseline for
  comparisons: `git archive 3b4acec` built in a scratch directory.
- DPR, viewport and network mode: DPR 1; frames 480 by 270 and 640 by 360 as the
  scripts set them; 1920 by 1080 for timing; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/fable-batch-review-evidence/`

## The delivery as received

| Item | Finding |
| --- | --- |
| `zhuda-cumulative.pdf`, `zhuda-batch8-incremental.pdf` | Real PDFs (`file`: PDF 1.3; 284 and 18 pages), a `diff -ruN` printed to paper: lines wrapped, leading whitespace lost. No attachment, script or link inside. **Not appliable.** |
| `git apply --check` of the cumulative patch on `d61f6db` | **UNAVAILABLE**: there is no patch text to apply. |
| `zhuda-changed-files.zip` | 104 files, no path outside the archive root, no symlink, no binary. Same 104 paths as the 104 `diff` headers of the PDF. 37 new files, 67 changed, none deleted. Used in place of the patch. |
| Files were found in `~/Downloads/claudeGod/`, not `~/Downloads/` | noted |

## Checks

### 1. Tooling

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Merge onto `3b4acec` | `git merge fable-delivery-on-d61f6db` | PASS, no conflict; the retired showcase links removed by `3b4acec` stay removed (grep for the four retired repositories: 0 hits) | `git log` |
| Install | `npm ci` (Node 26) | PASS | `EV/tooling/npmci.log` |
| Format check as delivered | `npm run format:check` | **FAIL**: 24 files | `EV/tooling/format-check.log` |
| Format | `npm run format`, then `format:check` | PASS after `c964c76` | `EV/tooling/format-check2.log` |
| Lint | `npm run lint` | PASS, 0 problems | `EV/tooling/lint.log` |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS: `Public declarations: 0 stale`; **485 tests, 485 pass** (the seven sandbox failures pass here) | `EV/tooling/verify.log` |
| `createMaterial` overloads | covered by `npm run typecheck` and the strict-consumer tests inside `verify` | PASS | same log |
| Whitespace | `git diff --check` (work tree) | PASS | |
| Whitespace of the delivery | `git diff --check 3b4acec HEAD` | 6 notes: trailing double spaces in the two new record files (the template has the same hard breaks) and a blank line at the end of `docs/filmic-rendering.md` and `docs/procedural-assets.md` | |

### 2. Real GPU, WebGL (ANGLE Metal, Apple M4)

Procedure: `node scripts/<name>.mjs`, one after another, `TMPDIR` set to an
evidence folder (`EV/work/run-gpu.sh`). Logs `EV/webgl/logs/`, pictures and
`report.json` under `EV/webgl/zhuda-*/`, summary `EV/webgl/summary.txt`.

| Script | Result |
| --- | --- |
| `verify-film-scene`, `-look`, `-fog`, `-environment`, `-water`, `-reflector`, `-model`, `-animation` | PASS (8) |
| `verify-procedural-draw` | PASS |
| `verify-film-remount`, `verify-quality-route`, `-highlights`, `-reflections`, `-variation`, `-point-shadow`, `-shapes`, `-colours`, `-bounce` | PASS (9); no threshold was close enough to need a look |
| `verify-prefab-models` | PASS |
| `verify-live-look` | **FAIL**: `visiting the lower levels once keeps at most one pooled render target (53 -> 55)` |

`verify-live-look` passes on the untouched `3b4acec` (both backends,
`EV/baseline-live-look/`). With the delivery and only the default
`antialias: 'msaa'` in `packages/core/film/FilmScene.ts:1952` changed to
`'none'` it passes again (`EV/msaa-off-live-look/`). Cause: levels 0 and 1 switch
multisampling off, so the pool keeps one multisampled and one plain HDR target.
The ten-cycle check in the same script still passes: the growth is bounded, it
is one more full-size target held, not a leak. The gate was not changed.

### 3. WebGPU (apple metal-3)

Same scripts with `ZHUDA_FILM_RENDERER=webgpu` (and `LIVE_LOOK_RENDERER=webgpu`);
every film log reports `WebGPU apple metal-3 (ready)`. Logs `EV/webgpu/logs/`,
summary `EV/webgpu/summary.txt`.

| Script | Result |
| --- | --- |
| The eight scripts of `verify:film-webgpu` | PASS (8) |
| `verify-film-remount`, `verify-quality-route`, `-highlights`, `-reflections`, `-variation`, `-shapes`, `-colours` | PASS (7): reflections (multi-pass, pooled RGBA16F targets), the fog and reflection viewport, the range-limit pass, scene-linear accumulation and multisampled HDR targets compile and draw the asserted pixels |
| `verify-prefab-models` | PASS |
| `verify-film-point-shadow` | **FAIL**: `with them the floor beyond the north box is dark` |
| `verify-film-bounce` | **FAIL**: `light bounced off the red wall turns it red` |
| `verify-live-look` | **FAIL**, same pool count as WebGL |
| `verify-procedural-draw` | not a WebGPU run: the script has no WebGPU mode and drew on WebGL again |

Pictures: `EV/webgpu/zhuda-film-point-shadow/shadowed.png` against
`EV/webgl/zhuda-film-point-shadow/shadowed.png`: on WebGPU the shadows fall in
the wrong places (large black areas on the wrong side of the wall, the box
shadows displaced), consistent with the tiles being read upside down
(`packages/core/runtime3d/PointShadow.ts:101`, `p.y=1.0-p.y`, "measured on
WebGL"). The string patch of `Lighting.glsl` does apply on WebGPU (shadows are
drawn), it is their orientation that is wrong.
`EV/webgpu/zhuda-film-bounce/bounced.png` against the WebGL one: the cube's
face toward the red wall stays blue-grey instead of red.

A third WebGPU defect, found while timing at 1920 by 1080
(`EV/webgpu/bounce-sampler-limit.log`): the day example with
`bounceLight: { spacing: 3 }` raises `The number of sampled textures (17) in
the Vertex stage exceeds the maximum per-stage limit (16)`, the pipeline is
invalid and what uses it is not drawn. After such a scene the same invalid
pipeline was met again in later scenes of one session (`EV/perf/webgpu.log`:
the night example with point shadows and the plain day example failed on a
later pass). Not root-caused further.

Not examined one by one: `float32-filterable`, the `VolumetricGI` uniform block
and the reserved words; no compile error or validation error was reported by
the fifteen passing film scripts.

### 4. Performance

Procedure (`EV/work/perf.mjs`): the two route examples at 1920 by 1080, each
variant mounted, then 60 frames drawn in the page through the film renderer
(`state.renderer.render`), the first 10 dropped, median of the rest; three
passes. Results `EV/perf/webgl.json`, `EV/perf/webgpu.log`.

| Variant (WebGL) | Median ms per frame, three passes | Mount ms |
| --- | --- | --- |
| day as authored (multisampling, light fog) | 101.6, 99.8, 100.7 | 460 |
| day, `antialias: 'none'` | 99.0, 96.3, 98.6 | 455 |
| day, no light fog | 98.7, 99.1, 99.2 | 460 |
| day, neither | 91.5, 92.4, 94.5 | 460 |
| day with `bounceLight` spacing 3 | 100.4, 99.8, 103.2 | 840 to 890 |
| night as authored (one lamp casting, reflector) | 100.8, 101.1, 103.6 | 575 |
| night, lamp not casting | 102.4, 100.5, 103.9 | 570 |
| night, `antialias: 'none'` | 99.6, 99.7, 100.4 | 570 to 600 |
| night with `screenReflections` | 104.2, 104.5, 105.0 | 580 to 610 |
| night with `bounceLight` spacing 3 | 105.0, 102.3, 105.9 | 1210 to 1240 |

**How far to trust this: very little.** About 90 ms of every frame is the
capture path (a full read-back of the frame), the same with everything off, so
these are not frame rates. What can be read: multisampling and light fog
together cost about 7 to 9 ms on this path; screen reflections about 3 ms;
point shadows drawn once at mount cost nothing measurable per frame;
`bounceLight` adds 0.4 s (day) and 0.65 s (night) to the mount. Differences
under 3 ms are inside the run-to-run spread. WebGPU gave the same order
(90 to 104 ms) for the variants that drew.

**Not measured**: real-time frame time in a running game, the cost of each
item on a phone, point shadows re-rendered every frame, the range-limit pass
and the four-tap fog depth average in isolation. `ZhudaQualityGovernor`:
`packages/core/runtime3d/QualityGovernor.ts` is unchanged and its unit test
passes; that it steps down under a real overload on a live stage was not
measured. The step-down table changed (`packages/core/film/LookQuality.ts`):
level 1 and 0 now also switch multisampling off, level 1 drops screen
reflections, level 0 drops bounce light.

### 5. Behaviour changes for existing content

| Change | Checked how | Result |
| --- | --- | --- |
| `ambientGround`, `ambient` beside it, `lightFog.color`, a film water node's `color` are now display colours, decoded | read `packages/core/film/LiveLook.ts:39-64,147`, `FilmStage.ts:779,907,1249` | Confirmed. `films/river-town-prefab/src/Main.ts:37,42` and every key of `src/daylight.ts` set `ambientGround` and a mist colour: `[0.3, 0.3, 0.17]` becomes `[0.073, 0.073, 0.025]` as light, the mist `[0.05, 0.065, 0.07]` becomes `[0.004, 0.005, 0.006]`. That scene will be visibly darker in shade and mist until the values are wrapped in `zhudaEncodeColor`. Not rendered: a build of that project writes into its own folder. |
| `ZhudaWaterSurface` and `ZhudaLightFog` used directly | read the declarations | Unchanged meaning (scene-linear); river-town's direct `ZhudaWaterSurface` colour and `setSun` are not affected. |
| `createMaterial` and prefab materials with neither `type` nor `shininess` become PBR | scanned every JSON and TS fixture in the repository, the four film projects and the rainy-night client | No prefab JSON and no fixture is affected: all name a `type` or a `shininess`. `tests/material-default.test.mjs` passes. Type-level: such a call now returns `PBRStandardMaterial` where it returned `BlinnPhongMaterial`. |
| Graded looks multisample by default | `verify-live-look` | Causes the pool-count failure above. |
| Day, dawn, dusk, overcast presets carry ground light | `tests/live-look.test.mjs`, `verify-film-look` | PASS; river-town sets its own `ambientGround`, so the preset default does not reach it. |
| Fog colour follows the sky, anisotropy 8, reflector clips below the mirror, no look means the day preset, lamp glow takes the lamp's colour | the WebGL and WebGPU scripts above | Drawn and asserted by the scripts; not compared picture by picture with 1.18.0. |

### Also checked

| Item | Result |
| --- | --- |
| Public interfaces our content uses | PASS: strict typecheck of `films/river-town-prefab`, `hunyuan-girl`, `avatar-lab`, `doll-face` and `games/zhuda-rainy-night-murder/client` sources against the patched declarations gives the same result as against `3b4acec` (0 errors; river-town 2 errors on both, one of them `setEmission`, which is the uncommitted change in the main checkout). Logs `EV/content-tc/`. `LitSurfaceMaterial`, `DynamicMesh`, `ModelLibrary`, `PrefabLibrary`, `ModelPlacements`, `QualityGovernor`, the asset providers: not touched by the delivery. Only lines removed from declarations: the old `createMaterial` overload, comments, and `zhudaFilmLookRebuildReason`'s return type (widened). |
| Known defect: `createSurfaceMaterial` with `type: 'pbr'`, `blend: 'alpha'` | **Not fixed**: `packages/core/runtime3d/Surfaces.ts:144` is unchanged. Reach is the same: `createMaterial` does not pass `blend`. |
| Known defect: `ZhudaLitSurfaceMaterial`, two materials of one shader name with different starting values | **Not fixed**: the file is not in the delivery. |
| Depth of field from `ZhudaSceneLook` | **Not added.** Depth of field stays a film-capture option (`aperture`, samples); `ZhudaSceneLook` gained screen reflections and refuses `bounceLight` (`packages/core/film/SceneLook.ts:56`). |
| Vendor files | PASS: no file under `vendor/` or `assets/` changed. Laya's `Lighting.glsl` is patched in memory at start-up by wrapping `Shader3D.addInclude` (`PointShadow.ts:138-165`); the patch is skipped silently when the two anchor strings are not found. |
| Consumer assets | PASS: none added; no binary file in the delivery. |
| Runtime and declarations in sync | PASS: `Public declarations: 0 stale` in `npm run verify`. |
| Task spec, record and plan row | One record, `docs/plans/records/quality-defaults/`, covers all eight batches, with one row in `docs/plans/README.md`, status "In progress; desktop WebGL verified on a software GPU only". Its claims match what it ran; the docs say point shadows were "not tried on WebGPU". None of the three WebGPU failures is guarded in code: on WebGPU the features draw wrongly instead of refusing. |
| Reach outside the repository, network, credentials, build pipeline | Nothing unexplained. New scripts write only to `os.tmpdir()` or the folder an environment variable names. `chrome-host.mjs` adds `Log.enable`. One point: `zhuda-init` now writes `.mcp.json` with `npx zhuda-laya-mcp` and an `AGENTS.md` into every new consumer (`packages/compiler/zhuda-init.mjs:268`). `zhuda-laya-mcp` is a bin of this package, but that name is unclaimed on the public npm registry (404 today): in a project where the engine is not yet installed, `npx` would fetch whatever is later published under it. |
| The rainy-night game on itch.io | **Not run as a picture check.** Source found at `games/zhuda-rainy-night-murder/client`, pinned to `d61f6db`; it is built with `features: ["core", "2d"]` and uses none of the look, fog, reflection or shadow interfaces, so the glow, fog colour, wet-ground reflection and shadow brightness the other agent asks about are not drawn by the changed code. Its sources type-check unchanged against the patched declarations. |

### Merging with the uncommitted change in the main checkout

Of the files that change holds, the delivery touches only `docs/plans/README.md`
(one table row added). `ModelPlacements.ts`, `PrefabLibrary.ts`, their
declarations, `scripts/verify-prefab-models.mjs` and `docs/consumer-tooling.md`
are untouched by the delivery. Merging takes keeping both rows of the table.

## Fixes made after the review (same branch)

Asked for after the report: fix the WebGPU defects. Engine files changed:
`packages/core/runtime3d/PointShadow.ts`, `ProbeVolume.ts`, `Renderer.ts`
(and their generated declarations), `scripts/verify-film-webgpu.mjs`,
`docs/filmic-rendering.md`, `docs/quality-route.md`.

| Defect | Cause found | Change |
| --- | --- | --- |
| WebGPU point shadows in the wrong places | On WebGPU the viewport counts the rows of tiles from the other edge of the texture (measured by trying the four orientations) | The lookup counts the rows from that edge on WebGPU. |
| WebGPU error on the second `render` of a point shadow: the pictures were bound as a texture while drawn into | The scene kept `u_ZhudaPointShadowMap` bound during the six draws | A 1 by 1 texture is bound in its place while the tiles are drawn. |
| WebGPU bounce light does not tint | Same row order, in the read-back of the probe tiles | `ProbeVolume.bake` cuts its tiles from the other edge on WebGPU. |
| WebGPU: 17 sampled textures, then 17 samplers, in one stage | LayaAir requests the device with the default limit of 16 sampled textures; and the point-shadow patch declared two scene textures, each taking a sampler in every lit shader on WebGPU, used or not | `Renderer.ts` asks for the adapter's `maxSampledTexturesPerShaderStage` and `maxSamplersPerShaderStage`. The point shadow's settings (position, reach, bias, strength, texel, softness, light count) now travel in the green, blue and alpha channels of the pictures themselves; `u_ZhudaPointShadowInfo` and its RGBA32F texture are gone. The day example with `bounceLight` now has 16 samplers on this adapter, which allows 16: **at the limit**. |
| Nothing ran the new scripts on WebGPU | | The nine new scripts are in `verify:film-webgpu` (17 in all). |

Results after the fixes (logs `EV/after/`):

| Check | Result |
| --- | --- |
| `npm run verify` | PASS, 485 of 485 |
| `npm run format:check`, `npm run lint` | PASS |
| The 20 GPU scripts on WebGL | 19 PASS; `verify-live-look` FAIL as before (fixed in the second round, below) |
| The 20 GPU scripts with the WebGPU switches | 19 PASS; `verify-live-look` FAIL as before |
| `npm run verify:film-webgpu` | PASS: 17 verifications |
| 1920 by 1080, ten variants, three passes, WebGPU | no validation error in any (`EV/after/perf-webgpu.log`) |

Still true: a lit material with one more texture than the day example's ground
(for instance an emission map beside albedo, normal, metallic and the
`variation` map) together with `bounceLight` would need 17 samplers on an
adapter that allows 16. Point shadows with several lights where only a middle
one casts are covered by code (the other lights' tiles are written as "casts
nothing" first) but by no script. A position beyond 16 384 m from the origin
cannot be matched (half floats).

### `verify:live-look` (second round of fixes)

The two resources left behind were listed in the page: a pooled 1024 by 1024
shadow target (the one the gate allows) and a pooled 480 by 300 HDR target
with a depth buffer and one sample. LayaAir hands a camera its target from a
pool each frame; after multisampling is switched, the target of the other kind
is never asked for again and stays pooled: a full frame of memory, also at
the low levels, where the multisampled one stayed behind.

Change: `packages/core/runtime3d/Filmic.ts`, `setCameraMultisampling`: where
the pipeline switches the camera's multisampling (construction, `setAntialias`,
`dispose`) the pooled HDR targets with a depth buffer of the other sample kind
are taken out of the pool and destroyed. The gate and the default are
unchanged.

Results (logs `EV/after2/`): `npm run verify` PASS (485 of 485);
`format:check`, `lint` PASS; the 20 GPU scripts **20 of 20 PASS on WebGL and
20 of 20 with the WebGPU switches**, `verify-live-look` included
(`report.renderer` is `webgpu` in that run; the adapter line it prints is a
WebGL probe). Limit: a second camera in the same page that uses HDR with the
other sample kind loses its pooled target at that moment and gets a new one on
its next frame; not exercised by a script.

### The scaffold's `.mcp.json` (third round)

`packages/compiler/zhuda-init.mjs` now writes `command: "node"` with
`node_modules/zhuda-laya-engine/packages/mcp-server/index.mjs` in place of
`npx zhuda-laya-mcp`: nothing is looked up in a registry. Checked: a project
scaffolded into a scratch folder, the engine linked into its `node_modules`,
`node <that path> --tool get_quality_route` run from the project folder
returns the route; `npm test` 485 of 485, `lint`, `format:check` PASS. The
entry is relative to the project folder: a client that starts the server from
another working directory will not find it. `docs/film-scenes.md` still shows
`npx zhuda-laya-mcp` in three examples; those lines are in `d61f6db` already
and were left as they are.

### Merged, and tried on a consumer game (fourth round)

Asked for: merge, then apply the engine to the city-walk game
(`films/river-town-prefab`, "Zhuda City Explorer", WebGPU build). The pending
model-emission change of the main checkout was committed first (`159a074`),
this branch merged into `main` without conflict (`d9c56b4`); on `main`:
`npm run verify` 485 of 485, `format:check`, `lint`, and the 20 GPU scripts
20 of 20 on each backend (`EV/main/`). Nothing was pushed.

The game was built with its own `tools/build.mjs` and drawn with its own
`tools/day.mjs` (eight pictures over a day, 1280 by 720). Mean colour of each
picture, before (engine `159a074`) and after:

| Picture | Before | New engine, game unchanged | New engine, colours carried over |
| --- | --- | --- | --- |
| morning | 67, 65, 57 | 54, 54, 52 | 67, 65, 56 |
| noon | 86, 82, 67 | 76, 74, 63 | 86, 82, 67 |
| dusk | 44, 37, 34 | 25, 18, 18 | 44, 37, 34 |
| night | 21, 21, 25 | 13, 12, 14 | 21, 21, 25 |
| dawn, mist | 69, 66, 66 | 34, 31, 33 | 69, 66, 65 |
| overcast | 64, 63, 57 | 52, 50, 48 | 64, 63, 57 |
| town, night | 58, 45, 46 | 50, 35, 32 | 58, 45, 46 |
| town, day | 128, 123, 108 | 119, 115, 104 | 128, 123, 108 |

As predicted in section 5 the unchanged game is darker, the mist most of all.
With `ambient`, `ambientGround` and the mist colour passed through
`zhudaEncodeColor` in the game's `src/Main.ts` it draws what it drew.

A defect found by looking at those pictures: a pale one-pixel outline round
the canal at the end of the street, by day and by night, absent with the old
engine drawn the same day. Two causes, separated by switching each off:

1. The fog's averaging with its four neighbours (new in the delivery) ran
   whether or not the picture was multisampled, and drew a line along the
   water's edge. **Fixed**: `ZhudaLightFog.setEdgeSmoothing`, off by default,
   switched on by a film look and `ZhudaSceneLook` only with
   `grade.antialias: 'msaa'` (`packages/core/runtime3d/LightFog.ts`,
   `film/LiveLook.ts`, `film/FilmStage.ts`, `tests/live-look.test.mjs`).
2. With multisampling on, a pale line stayed along the same edge. This was
   first put down to `ZhudaWaterSurface` foam: wrong. With the water's shader
   made to draw black the pixels did not change; that "canal" is a bright
   area of the town model that only the fog hides (nearly white with the fog
   pass removed). Under multisampling an edge pixel holds some of it, and the
   fog of the pixel's one depth left that part unfogged. **Fixed in the fifth
   round, below.**

After the fog change: `npm run verify` passed 485 of 485 on three of four
runs; one run reported a single failure that did not repeat and was not
identified (the machine was under load). `format:check`, `lint`, and the 20
GPU scripts 20 of 20 on each backend (`EV/after3/`).

Frame cost of the game, its own `tools/quality.mjs` (60 frames drawn back to
back, WebGPU, headless), three interleaved rounds, milliseconds at level 3:
old engine 44.6, 42.9, 34.7; new with multisampling 37.2, 50.5, 42.5; new
without 35.0, 39.8, 45.8. No difference that the spread allows to be seen.
The game's own prefab comparison (`tools/check.mjs`) passes against its
existing references.

### Fog on multisampled edges (fifth round)

`packages/core/runtime3d/LightFog.ts`, under `ZHUDA_FOG_SMOOTH` only: the
delivery's average of the fog over four neighbours is replaced. For a pixel
whose neighbour has another fog, the pixel's own side is the purest of the
eight neighbours that share its fog (the darkest where the other side is the
brighter, the brightest where it is the darker); how much of the pixel the
other side covers is read from where its colour lies between the two; that
part takes the other side's fog, and the fog's own light is mixed by the same
share. A pixel that has the colour of the more fogged side is taken to be all
that side (a sliver thinner than a pixel can own the depth and no colour
sample).

How it was found, each step a build of the game and a picture
(`EV/city/`): the water drawn black (no change); the fog pass removed (the
area is white); every intermediate value of the pass shown as colours with
the later effects removed.

| Night street of the game, multisampling on, 1280 by 720 | Pixels round the gap brighter than 40 of 255 (lanterns left out) | Brighter than 80 |
| --- | --- | --- |
| Old engine, no multisampling | 0 (brightest 29) | 0 |
| As delivered (average over neighbours) | 603 | 19 |
| This round | 1 (69) | 0 |

The game's eight day pictures with multisampling on differ from the old
engine's by at most 0.2 in mean colour.

`hardEdgeShare` of the route's day example (`verify:quality-route`): 0.164
on both backends. The delivery's record gives 0.18 for multisampling without
fog, 0.47 with fog before its average and 0.06 to 0.09 with it. The average
also blurred pixels that were not on an edge; this keeps what multisampling
gives and no more. Night example 0.128 (0.126 before).

Results (`EV/after5/`): `npm run verify` 485 of 485, `format:check`, `lint`;
the 20 GPU scripts 20 of 20 on WebGL and 20 of 20 with the WebGPU switches;
`npm run verify:film-webgpu` 17 of 17.

Limits: the pass makes sixteen more texture reads a pixel under multisampling
(eight depths, eight colours); its cost was not measured. A real surface
whose edge pixel has the colour of a more fogged background behind it (a
white wall before white fog) is fogged as that background along one pixel.
No engine script draws a bright area behind fog at an edge: the case is
covered by the game's pictures only.

## Lifecycle and failure cases

- Repeated create and destroy: `verify-film-remount` passes on both backends;
  the ten quality cycles of `verify-live-look` leave resources unchanged.
- Pool growth: one more pooled render target than the gate allows (above).
- Cancellation, timeout, stale completion, context loss: not exercised here.

## Prefab evidence (visual work)

Not applicable: no consumer prefab is changed. `verify-prefab-models` passes on
both backends.

## Limits and decision

Defects to fix before merging:

1. (Fixed on this branch, see above.) WebGPU point-light shadows are drawn in
   the wrong places; `verify-film-point-shadow` fails on WebGPU.
2. (Fixed on this branch, see above.) WebGPU bounce light does not tint
   (`verify-film-bounce` fails) and at 1920 by 1080 exceeds 16 sampled
   textures in a stage, leaving an invalid pipeline.
3. (Fixed on this branch, see above.) `verify:live-look` fails on both backends because graded looks multisample
   by default (`FilmScene.ts:1952`): decide between pooling, the default and
   the gate; the gate was not loosened here.
4. As delivered `format:check` fails on 24 files (fixed in `c964c76`).
5. (Fixed on this branch.) The new nine film scripts are not in
   `verify:film-webgpu`, so nothing would catch 1 and 2.
6. (Fixed on this branch, see above.) `.mcp.json` in the scaffold: use a form
   that cannot reach the registry.

Unverified: `git apply --check` (no patch text); Node 24; real-time frame
times and every per-feature cost beyond the coarse table; phones, Windows,
mini-game hosts; the river-town scene drawn with the patched engine; the
rainy-night scene; a picture-by-picture comparison with 1.18.0.

7. (Fixed on this branch, fifth round.) Multisampling with light fog: a pale
   line along dark things in front of a bright, fogged background. Not the
   water surface, as first recorded.

**In progress.** Merged into `main` locally. Both backends pass every script;
items 1 to 7 are closed. What stays unverified is listed
above. Nothing was pushed.
