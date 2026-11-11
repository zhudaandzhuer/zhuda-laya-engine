# Verification record: film-look

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `451e505`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Look, light and emission schema | `node --test tests/film-scene.test.mjs` | PASS, 8 tests: presets resolve with overrides, plain scenes keep the phase 1 look, every bad field reported with a path, 33 lights refused, nested look patches merge |
| Real GPU look features | `npm run verify:film-look` | PASS (below) |
| Film loop regression | `npm run verify:film` | PASS |
| Full gate | `npm run verify`, lint, format | PASS (see the commit) |

### `verify:film-look` (switch each feature on and off, assert the pixel change)

| Feature | Result |
| --- | --- |
| Nine remounts alternating plain, day and dusk | every frame draws geometry (luminance spread 11.9–29.5) |
| Sun shadows (low side sun) | 2.65 % of the frame darker by > 12, 0 % brighter |
| Procedural sky | top row 133.1 vs horizon 167.1 |
| Linear fog | 42 % of the frame changes |
| Point light at night | 23 % of the frame brighter by > 15 |
| `--film-pack` prop | listed (`test-kiosk`) and drawn (5.5 % of the frame changes) |

## Defects found and fixed

- **Captures right after mounting could miss every mesh** (since phase 1).
  Laya registers new meshes on its next native frame, and the capture freezes
  the scene; depending on timing a frame contained only the clear colour. A
  test that remounted five scenes reproduced it in 1–2 of 5 frames per run.
  `ZhudaFilmRenderer` now runs two native frames before pausing; three runs
  then matched exactly. Two earlier explanations (stale shadow state, a shared
  sky dome) were ruled out by experiment; the stage still owns its sky dome and
  switches shadows and fog off before disposal, which is harmless.
- **`sideEffects: false` dropped the film page script.** The pack entry
  imported the page script only for its side effects, which the bundler
  removed under the package's `sideEffects: false`; the page never started.
  The script now exports `startFilmHost(packs)` and the entry calls it.
- A look override such as `sun: { elevationDeg: 20 }` was refused because both
  sun angles were required; they now default to the preset.

## Follow-up: filmic grade

`look.grade` mounts the existing `ZhudaFilmicPipeline` on the film camera (HDR,
ACES, bloom, ambient occlusion); it is off unless a scene asks for it. The host
bundle moved from `3d` to `3d-gltf` because post-processing lives there.
`verify:film-look` asserts that the grade changes the frame and that bloom
brightens pixels around an emissive lamp; unit tests cover defaults, paths and
patch merging.

## Use in a film

The ancient-city test film (a consumer pack outside this repository: houses
with stepped gables, gate tower, city walls, lanterns with 20 point lights,
night preset with fog) was built and rendered entirely through the MCP tools
with `--film-pack`; 864 frames re-rendered byte-identical in size.

## Limits and decision

- No animated look or light tracks; point lights cast no shadows; no reflections.
- Shadows use two cascades over 60 m by default; long views lose distant
  shadows.
- Desktop WebGL only; WebGPU and mobile are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**

## Follow-up: lens finish (2026-11-11)

`grade.grain`, `grade.vignette` and `grade.fringe` add film grain, darker
corners and colour fringing after tone mapping (`ZhudaLensFinish`), off by
default. `verify:film-look` measures on a flat grey frame: grain raises the
standard deviation of a patch from under 0.5 to over 2.5 with the mean
within 1.5, and the same frame renders with identical grain; the vignette
leaves the centre within 1.5 and takes a corner below 60 % of it; fringing
separates red and blue by more than 40 at a bright bar's edge near the side
(under 6 without it). Unit tests cover the vignette curve and validation.

## Follow-up: panorama sky (2026-11-11)

`look.panorama` draws a 2:1 picture from the asset directory as the sky with
Laya's native `SkyPanoramicMaterial`, replacing the procedural sky. Pictures
load through the asset provider like models and lightmaps. `verify:film-model`
generates a picture (blue top, green bottom, one red band) and measures:
looking up shows blue, looking down green, the band appears in exactly one of
four compass views and in a different one with `rotationDeg: 90`; a missing
picture is refused by name. The sky does not light the scene by itself.

## Follow-up: mixed lighting pieces (2026-11-11)

For scenes that bake only part of their light: `ZhudaEngine.boot({ maxLights })`
sets Laya's real-time light capacity (it is fixed at initialisation; default
32), film scenes accept up to 128 real-time lights and refuse a scene that
asks for more than the runtime has, `shadows.cascades` picks 1, 2 or 4 shadow
splits, and one spot light may cast shadows (`castsShadow`). `verify:film-look`
measures: with 59 distant lights the ground under the camera is black and a
60th light over it lights it (192); a slab under a downward spot leaves the
ground at 0 with `castsShadow` and lit without; with four cascades over 150 m
the shadows of a near and a far pillar darken 0.69 % of the frame. Point
lights still cast no shadows (Laya 3.4.2 has no point shadow maps).
