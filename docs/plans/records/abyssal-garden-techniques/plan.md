# Techniques from Abyssal Garden

Status: In progress (AG2, AG5, AG3, AG4 and AG1 implemented; the other packages as listed under Progress)\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

Owner's request of 2026-11-16, after reading
[Noniv/abyssal-garden](https://github.com/Noniv/abyssal-garden): write the
full plan for what that project shows that would strengthen this engine, and
leave it waiting to be taken up. Standing goal: surpass three.js, and take
over what others do better.

## What was read

Abyssal Garden (MIT, first commit 2026-11-12, 11 commits read at `a596354`)
is a procedural underwater world in one 96 KB HTML file: hand-written WebGPU
and WGSL, no engine, no texture, model or sound file. About 150 KB of source
(`source/src/main.js`, `shaders.js`, `world.js`, `quality.js`, `math.js`,
`audio.js`) bundled by esbuild. Its `prompt.txt` is the brief an agent built it
from: target 2560×1440 on an RTX 5070 Ti, GPU frame ≤ 11 ms average and no
frame over 16.7 ms on a scripted 60 s fly-through, no per-frame JavaScript
allocation, and a separate critic agent that sees only renders.

The figures below are the author's; none was run here.

| What it does            | How (file in that repository)                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Water as a medium       | Per-channel extinction `SIG`/`KD` and a water colour `WCOL`: cyan near the surface, deep blue far off; a second tint `PCOL` for one region (`shaders.js`)                                                                                                                                                                                |
| Caustics                | An animated texture each frame, `r` = caustic, `ba` = the surface's slope (`W_WATER`), mipmapped, sampled on rock, leaves and animals by world position and fading with distance (`caus`, `caus2`)                                                                                                                                       |
| Surface seen from below | Its own pass using the same slope texture (`W_SURF`)                                                                                                                                                                                                                                                                                     |
| Light shafts            | Half-size ray march, then a blur (`W_RAYS`, `W_RBLUR`), 34 steps on High, 12 on Low                                                                                                                                                                                                                                                      |
| Terrain                 | A density volume computed on the GPU at load (`W_DENS`), read back, rock not connected to the sea floor turned to water (no floating specks), then surface nets (`main.js` 143–170)                                                                                                                                                      |
| Collision               | Distance to rock in 4×4×4 bricks near the surface within the camera's reach, int8 in 1/127 m, about 2 MB; the camera slides along rock and still fits through arches (`main.js` 171–190)                                                                                                                                                 |
| Frame budget            | Every second (0.4 s behind the start menu) a scale `k`: with GPU timestamps it holds 9.8..13.6 ms; without, two slow periods in a row lower it and the wait before trying up again doubles. It lowers pixels to half first, then draw distance (`det` ≥ 0.4), then the remaining pixels; it climbs back the same way (`main.js` 532–552) |
| Remembering             | Level, pixels and draw distance kept in `localStorage` for the next visit; a flag set during the load and still set on the next visit means the load crashed the tab, and the next visit starts one level lower (`quality.js`)                                                                                                           |
| Levels                  | High / Medium / Low by `deviceMemory` and coarse pointer: every 2nd / 4th leaf, shadow 4096 / 2048, MSAA 4 / 1, water 512 / 256, shaft steps 34 / 12                                                                                                                                                                                     |
| Scale                   | About two million leaves, tens of thousands of rocks; author reports ~180 fps at 2560×1440 on a 5070 Ti and ~20 fps at 670×372 on Low on a Galaxy A16                                                                                                                                                                                    |

## Current baseline here

| Area           | What the engine has                                                                                                                                                                                 | Gap                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame budget   | `ZhudaQualityGovernor` (steps down at once, back up after calm, doubling wait), `zhudaQualitySteps`, `ZhudaRenderScale` 0.5..1 with FSR 1 ([frame cost](../frame-cost/task.md))                     | No draw-distance rung; steered by CPU frame time only; nothing kept between visits; no load-crash fallback; settles only once the game runs |
| GPU timing     | `EffectBudget` WebGPU timestamp pairs per render pass (`packages/types/effects/EffectBudget.d.ts`)                                                                                                  | Not fed to the governor; no fly-through report                                                                                              |
| Draw distance  | `ZhudaGrassField` `distanceM`, model `lod`/`cullMeters`, `ZhudaFoliageWind`                                                                                                                         | No single scale the governor can turn                                                                                                       |
| Water          | `ZhudaWaterSurface` from above: depth colour, `zhudaWaterAbsorption` (one channel), waves, mirror, foam, ripples ([film nature](../film-nature/task.md), [water ripples](../water-ripples/task.md)) | No camera below the surface, no per-channel extinction of the whole view, no caustics, no surface seen from below                           |
| Fog and shafts | `ZhudaLightFog` height fog with shafts ([film light fog](../film-light-fog/task.md), [half-size shafts](../half-size-shafts/task.md))                                                               | Shafts reused as they are; the medium colour model is missing                                                                               |
| Isosurface     | `createZhudaIsosurfaceMesh` (surface nets, CPU), `ZhudaSdfField` ([procedural hand](../procedural-hand/task.md))                                                                                    | No removal of disconnected pieces; no GPU density; no distance query kept for collision                                                     |
| GPU compute    | `ZhudaComputePass` with a JavaScript fallback ([GPU depth](../gpu-depth/task.md))                                                                                                                   | Not used for a density volume                                                                                                               |
| Acceptance     | `measureZhudaFrame`, film verify scripts, [phone checks](../phone-checks/task.md)                                                                                                                   | No blind critic gate; no scripted fly-through with GPU average/p99/max                                                                      |

## Progress

| Package | State                                               | Record                                                        |
| ------- | --------------------------------------------------- | ------------------------------------------------------------- |
| AG2     | Implemented; desktop WebGL and WebGPU; no phone yet | [quality-governor-memory](../quality-governor-memory/task.md) |
| AG5     | Implemented; desktop WebGL and WebGPU; no phone yet | [flythrough-critic](../flythrough-critic/task.md)             |
| AG3     | Implemented; desktop WebGL and WebGPU; no phone yet | [isosurface-density](../isosurface-density/task.md)           |
| AG4     | Implemented; pure data, checked by fixtures         | [distance-bricks](../distance-bricks/task.md)                 |
| AG1     | Implemented; desktop WebGL and WebGPU; no phone yet | [underwater-look](../underwater-look/task.md)                 |
| AG6     | Proposed                                            |                                                               |

## Work packages

Each package is its own task record (`TASK-TEMPLATE.md`) when taken up, in
this order. AG2 and AG5 help every scene and come before the underwater work.

### AG2 — Governor: draw distance, GPU time, memory, warm start

1. A `detail` rung beside `renderScale` in `ZhudaQualityStep` (proposal: a
   number 0.4..1 a scene multiplies into its own distances). The order of
   descent is chosen per ladder: the default follows Abyssal Garden (pixels
   to a middle size, then detail, then the rest of the pixels), and a ladder
   can say otherwise.
2. The governor takes a GPU frame time when there is one (`EffectBudget` on
   WebGPU) and holds a band (proposal: budget ×0.84..1.16) instead of only
   reacting to overruns; without one it keeps today's CPU rule.
3. `ZhudaQualityMemory` (proposal): keeps level, scale and detail under a key
   the consumer names, through a storage the consumer passes (never a second
   store of its own); reads it to start from. Storage that throws or is empty
   starts from the default.
4. A load sentinel: set before the heavy build, cleared when the first frame
   draws or the page is hidden; still set on the next start means start one
   level lower. Pure state; the consumer chooses where it lives.
5. Warm start: the governor may sample during a start screen at a shorter
   interval, so the level is settled before play. Uses the session's clock,
   no timer of its own.

Evidence (Input/camera/clock and Public API rows): unit tests for band,
descent order, storage failure and the sentinel; a draw on WebGL and WebGPU
with a forced slow frame showing the rung order; one phone record.

### AG5 — Fly-through benchmark and blind critic

1. A scripted camera path (film timeline or a list of poses) run for a fixed
   time, logging CPU frame time and, on WebGPU, GPU time per frame; report
   average, p99 and max as JSON beside the frames. Proposal: `npm run
verify:flythrough -- <scene>`.
2. Fixed poses rendered at a stated size, plus a short recording, handed to a
   critic agent that receives only the pictures and returns defects ranked
   (shimmer, aliasing, popping, banding, flat light). Its report is kept as
   evidence; "minor only" is the gate it proposes, not a pass by itself.
3. Add both to `VERIFICATION-TEMPLATE.md` and to the quality route as an
   optional gate for 3D scenes.

Evidence (Compiler/MCP/Doctor row): a passing run and a deliberately failing
one (a frame over budget, a critic defect above minor) with file guidance.
WebGL has no timestamp query: the report says GPU time unavailable, never 0.

### AG1 — Underwater medium

1. `look.underwater` on a film scene and `ZhudaSceneLook` (proposal): water
   colour, per-channel extinction (three numbers per metre), scattering
   colour, surface height. The view is attenuated per channel by distance and
   lit by in-scattered colour; above the surface nothing changes.
2. Caustics: one small tiling texture drawn each frame (proposal 256/512 by
   look level) from summed waves, sampled by lit surfaces through the lit
   hook by world position projected along the sun, faded with depth and with
   distance from the eye. Shared with `ZhudaWaterSurface`'s waves so the two
   agree.
3. The surface from below: `ZhudaWaterSurface` drawn from underneath with
   total internal reflection past the critical angle and the sky window
   inside it.
4. Shafts: `ZhudaLightFog` shafts tinted by the medium; no second shaft
   pass.
5. One film example scene (engine fixture, procedural only) and a route in
   `docs/routes/` once it is drawn and checked.

Evidence (Shader/material/VFX row): validator tests; drawn on WebGL and
WebGPU (WebGPU first for film work); `measureZhudaFrame` hue and contrast
checks at fixed poses; one phone record or an explicit unavailable.

### AG3 — Isosurface cleanup and GPU density

1. `removeFloating` on `ZhudaIsosurfaceOptions` (proposal): before meshing,
   inside cells not connected to a named anchor (the box's floor by default)
   become outside. Deterministic fixture: a slab with three loose specks
   gives one closed piece.
2. A density volume through `ZhudaComputePass` (its JavaScript fallback keeps
   WebGL working), read back once at load; cancelable and with a time limit,
   as every load is.
3. Meshing stays on the CPU; the 2 000 000-vertex refusal and
   `splitZhudaMesh` stay.

Evidence (2D/3D terrain/query row): geometry fixtures for connectivity and
equality of GPU and fallback volumes; load cancelled, timed out, failed and
disposed; 30 load/unload cycles.

### AG4 — Distance query near a surface

A sparse, quantized distance kept in bricks around the surface within a
radius (proposal `ZhudaDistanceBricks`): `distance(x, y, z)` and `normal`.
The engine answers queries; whether the camera or a character slides, stops
or takes damage stays the consumer's rule (`CameraCollision` and
`SceneQueries` may sample it). Evidence: deterministic raycast and
slide fixtures, memory bound reported.

### AG6 — Route

After AG1 is drawn and checked, an underwater route from
`docs/routes/TEMPLATE.md`: steps, pitfalls, measured cost, limits.

## Non-goals

- Copying Abyssal Garden's code, shaders or scene. Ideas and published
  constants are re-derived here; any code adapted keeps its MIT notice.
- A hand-written WebGPU renderer, or a single-HTML build as an engine target
  (the [browser SDK](../../../browser-sdk.md) already covers one HTML file).
- Its scale (two million leaves) as a target: budgets come from phone
  records.
- Audio synthesis beyond `IframeSoundAdapter`; gameplay, swimming rules or
  collision response.

## Risks and rollback

- WebGL has no GPU timing: the governor and the benchmark must keep a CPU-only
  path and label it.
- LayaAir 3.4.2 post chain: attenuating the whole view may need its own pass
  after the look's fog; measure before choosing a hook.
- Caustics on phones: one more texture per frame and a lookup per lit pixel;
  off at the lowest look level unless measured.
- Persisted state from an older engine version: the key carries a version and
  an unknown version is ignored.
- Any package whose measurement shows no gain on the phone record is marked
  Rejected here instead of shipping.
