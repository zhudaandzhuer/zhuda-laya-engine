# Verification record: quality-defaults

Task document: `docs/plans/records/quality-defaults/task.md`  
Commit: none (worked from the source archive of package version 1.18.0)  
Date: 2026-11-13

## Environment

- OS / browser / device: Linux container (Ubuntu 24), headless Chromium
  (Playwright build 1243) through the repository's own `chromeFixture`, WebGL2
  on ANGLE over SwiftShader: a **software GPU**. No real GPU, no WebGPU
  adapter, no phone.
- Node and package manager: Node 22.23.4 (the repository requires 24); no
  network, so no `npm install`.
- Toolchain stand-ins, outside the tree: TypeScript 6.0.3 where 5.9.3 is
  pinned (the declaration generator reported "0 stale" on the untouched tree,
  so its output is byte-identical here); esbuild 0.28.2 behind a shim that
  reports the pinned 0.27.1; a minimal PNG codec in place of `pngjs`; a typed
  stub of `meshoptimizer/decoder`; no `@webgpu/types`, `prettier` or `eslint`.
- DPR, viewport and network mode: DPR 1; frames of 480 by 270 and 640 by 360;
  offline.

Every figure below is from that software GPU. Pixel results stand on their
own; no timing is evidence of performance.

## Checks

| Check                    | Exact command or procedure                                                    | Result      | Artifact                                                      |
| ------------------------ | ----------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| Build                    | `node packages/compiler/zhuda-build.mjs`                                      | PASS        | SDK (ESM) 916.5 KB; 828 KB before                             |
| Declarations             | `node packages/compiler/runtime3d-types.mjs` (type-checks core and demo)      | PASS        | 0 stale after regeneration                                    |
| Types, whole repository  | `npm run typecheck`                                                           | UNAVAILABLE | needs the pinned TypeScript and `@webgpu/types`               |
| Doctor                   | exercised by the unit tests that run it                                       | PASS        | `tests/compiler-and-mcp.test.mjs`, `tests/doctor-target.test.mjs` |
| Format, lint             | `npm run format:check`, `npm run lint`                                        | UNAVAILABLE | no prettier or eslint; lines over 100 columns fixed by hand   |
| Regression               | `node --test tests/*.test.mjs`                                                | PASS, see below | 483 tests, 476 pass                                       |
| New unit suites          | `node --test tests/look-defaults.test.mjs tests/film-lint.test.mjs tests/quality-route.test.mjs tests/screen-reflections.test.mjs` | PASS | all pass |
| Real WebGL, new          | `npm run verify:film-remount`                                                 | PASS        | five mounts byte-identical, no stray hue, no WebGL error      |
| Real WebGL, new          | `npm run verify:quality-route`                                                | PASS        | numbers below                                                 |
| Real WebGL, changed      | `npm run verify:film-reflector`                                               | PASS        | floor and `ground` under the mirror no longer block it        |
| Real WebGL, regression   | `verify:film`, `verify:film-look`, `verify:film-fog`, `verify:film-environment`, `verify:film-water`, `verify:film-model`, `verify:film-animation`, `verify:procedural` | PASS | each exit 0 |
| Real WebGL, regression   | `npm run verify:prefab-models`, `npm run verify:live-look`                    | UNAVAILABLE | both fail the same way on the untouched tree in this sandbox  |
| Whole gate               | `npm run verify`                                                              | UNAVAILABLE | pinned toolchain not installable offline                      |
| WebGPU                   | `npm run verify:film-webgpu`                                                  | UNAVAILABLE | no hardware adapter                                           |

Regression detail: seven tests fail here on the untouched tree and on the
changed tree alike, none of them touched: six strict-consumer and declaration
tests that need `@webgpu/types`, and `tests/meshopt-model.test.mjs`, which
needs the real `meshoptimizer`. No test that passed before fails now. Three
tests were updated for intended changes (the resolved grade has `antialias`;
the default fog colour; the in-place update switches multisampling) and one
for the two new MCP tools.

## The two defects, before and after

Reverting one line at a time and running `npm run verify:film-remount`:

| Tree                                              | Result                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| As changed                                        | PASS: stray-hue pixels 0, 0, 0, 0, 0; `glErrors` empty          |
| Without `this.ao.aoColor = …`                     | FAIL: "mount 2 draws the frame of mount 1"                      |
| Without the in-place `setLights`                  | FAIL: `GL_INVALID_OPERATION: glTexStorage2D: Texture is immutable` |

Measured before the fix, same scene remounted five times: green-dominant
pixels 0.00, 2.93, 2.78, 2.63, 2.58 percent. The uniform is in the `Material`
uniform block (`getUniformLocation('u_AOColor')` is null, no upload is ever
made for it) and LayaAir's block manager reuses blocks with their bytes. A
quality round trip 3 → 2 → 3 on one stage did not show it; a remount did,
every time.

In-place updates before the fix: ten `setLook` calls with `ambientGround`
raised ten errors, ten `setLight` calls ten.

## Measurements behind the defaults

Fog colour. Each preset's sky was drawn with tone mapping off and read 5 to 10
degrees above the horizon, four azimuths averaged (scene-linear):
day 0.37 0.54 0.77, dawn 0.66 0.50 0.12, dusk 0.43 0.23 0.01,
night 0.021 0.034 0.076, overcast 0.51 0.61 0.47. Distance in RGB (0..255)
between the fogged horizon and the sky 8 degrees above it:

| Preset   | Old default | New default |
| -------- | ----------- | ----------- |
| day      | 199         | 3 to 19     |
| dawn     | 189         | 25 to 37    |
| dusk     | 147         | 24 to 38    |
| night    | 9           | 8 to 13     |
| overcast | 223         | 10 to 14    |

Edge smoothing. Share of hard steps along edges (`hardEdgeShare`), the day
example at 640 by 360, one sample:

| Look                                          | Share |
| --------------------------------------------- | ----- |
| No multisampling, no light fog                | 0.49  |
| Multisampling, no light fog                   | 0.18  |
| Multisampling with light fog, before the fix  | 0.47  |
| Multisampling with light fog, after the fix   | 0.06  |

`camera.fxaa` had no measurable effect in this chain (identical metrics).

Anisotropic filtering, a ground texture seen from 0.9 m: detail energy in the
far band 8.2 at level 1 and 12.0 at 16 (+46 %); middle band +26 %; near band
unchanged. The default is 8.

Reflector over a `ground` node: mean luminance difference in the ground area
between the scene with and without the reflector was 1.75 of 255 before (grain
level, no reflection) and is 6.7 in `verify:quality-route` now.

Bake cost of a two-layer recipe on this CPU: 256 in 0.17 s, 512 in 0.44 s,
1024 in 1.8 s (12 MB), 2048 in 6.5 s (48 MB).

`verify:quality-route`: day example `hardEdgeShare` 0.087, no flag; night
example 0.121, no flag, one vivid hue (orange, the lamp); difference made by
the day shadows 1.63, by the night reflection 6.7; no WebGL error.

Scaffold: `zhuda-laya-init --engine 1.18.0` (3D). `src/Main.ts` type-checks
under the scaffold's strict settings against the public declarations
(`skipLibCheck` on, since `@webgpu/types` is missing here) and ran in the
browser with no error: HDR on, multisampling on, four post effects, a shadowed
physically based cube under a procedural sky.

## Second batch

| Check                  | Exact command or procedure            | Result | Artifact                                                    |
| ---------------------- | ------------------------------------- | ------ | ----------------------------------------------------------- |
| Real WebGL, new        | `npm run verify:film-highlights`      | PASS   | disc centre 255 of 255, `scene-linear`; same still twice    |
| Real WebGL, new        | `npm run verify:film-reflections`     | PASS   | mirrored pixel 0 without, 255 with; aside 0; no WebGL error |
| Real WebGL, regression | the eleven verifications listed above | PASS   | each exit 0, with both changes in place                     |

Scene-linear accumulation. A lamp of emission 8 at exposure 4, 30 m away,
focus at 1.5 m, 85 mm at f/1.4, 64 samples at 640 by 360: the disc centre was
0.169 of white (display-linear) before and is 1.0 now; the light summed over
the disc was 289.7, the lamp's own clipped 289, before. A still scene drawn
with 4 samples and no aperture differs from its single frame by 0.79 of 255 on
average (edges, which the samples anti-alias). Without a grade the result
says `display-linear`, as before.

Screen reflections. A lamp 3.35 m from a dark wall, camera along the wall:
the pixel where the lamp's mirror image meets the wall is 0, 0, 0 without and
255, 255, 255 with `{ strength: 2, wetness: 1, steps: 64 }`; a wall pixel
with nothing to mirror stays 0; the frame is byte-identical after six other
mounts. Strength 0 is not byte-identical to the frame without the effect (the
extra pass changes rounding), only dark where nothing is mirrored.

## Third batch

| Check           | Exact command or procedure           | Result | Artifact                                              |
| --------------- | ------------------------------------ | ------ | ----------------------------------------------------- |
| Real WebGL, new | `npm run verify:film-variation`      | PASS   | places three tiles apart: 0.23 plain, 9.09 at 0.5, 17.13 at 1 |
| Real WebGL      | `npm run verify:film-highlights`     | PASS   | now also: a red lamp at 1, 3, 6, 8 keeps its red      |
| Real WebGL      | the other twelve verifications       | PASS   | each exit 0                                           |

Bright coloured light. Centre pixel of a red emissive box (`[R, R/15, R/60]`)
through the grade, and the scene-linear value that reached the grade:

| `emission` R | Scene value | Before, exposure 1 | After, exposure 1 | After, exposure 0.5 | After, exposure 4 |
| ------------ | ----------- | ------------------ | ----------------- | ------------------- | ----------------- |
| 1            | 1.0         | 212, 0, 0          | 212, 0, 0         | 150, 0, 0           | 255, 116, 22      |
| 3            | 14.0        | 255, 208, 128      | 255, 208, 128     | 255, 164, 64        | 255, 244, 219     |
| 5            | 47.6        | 255, 242, 212      | 255, 242, 212     | 255, 227, 173       | 255, 244, 219     |
| 5.6          | 62.5        | 232, 224, 200      | 255, 244, 219     | 255, 234, 191       | 255, 244, 219     |
| 6            | 73.7        | 140, 146, 120      | 255, 244, 219     | 255, 237, 200       | 255, 244, 219     |
| 8            | 147.0       | 0, 112, 2          | 255, 244, 219     | 255, 244, 219       | 255, 244, 219     |

The scene value is the 2.4th power of the authored one above 1 (8 gives 147).
The table of `ColorGradEffect` itself was read back and is sound along its red
axis up to its end at 58.9; the fault was the lookup beyond that end. Switching
colour adjustment off changed nothing.

Colour values, read from the scene-linear picture: a surface colour of 0.5
gives 0.2256 of what 1 gives; ambient colour 0.2144; sun colour 0.2148;
emission 0.214; sun intensity 0.502. Ambient 0.5 with `ambientGround` 0.5
gives 0.5005 on a floor facing up, against 0.2144 without `ambientGround`.

## Fourth batch

| Check           | Exact command or procedure            | Result | Artifact                                               |
| --------------- | ------------------------------------- | ------ | ------------------------------------------------------ |
| Real WebGL, new | `npm run verify:film-point-shadow`    | PASS   | numbers below; identical frames after remounts         |
| Real WebGL      | `npm run verify:quality-route`        | PASS   | now also: lamps change the night frame by 28.05, spot by 5.04 |
| Real WebGL      | the other thirteen verifications      | PASS   | each exit 0                                            |

A lamp 3 m over a floor, with a wall and three boxes, seen from above
(luminance 0..255 where each caster's shadow must fall, and where it must not):

| Place                                    | Without `castsShadow` | With it |
| ---------------------------------------- | --------------------- | ------- |
| floor beyond the east box                | 191                   | 0       |
| floor beyond the north box               | 147                   | 0       |
| wall behind the floating box             | 184                   | 0       |
| floor behind the wall                    | 89                    | 0       |
| floor to the south                       | 159                   | 159     |
| floor to the north-west                  | 173                   | 173     |
| wall, the mirror of the shadowed place   | 183                   | 183     |

The regression met on the way, mean luminance of the night example at 320 by
180:

| Build                                              | As shipped | Without its spot | Without its lamps |
| -------------------------------------------------- | ---------- | ---------------- | ----------------- |
| shader patch not installed                         | 67.2       | 62.2             | 39.0              |
| two vectors added to the scene's uniform map       | 38.9       | 38.9             | 17.3              |
| position and settings in a texture (as delivered)  | 67.2       | 62.2             | 39.0              |

## Fifth batch

| Check           | Exact command or procedure         | Result | Artifact                                                 |
| --------------- | ---------------------------------- | ------ | -------------------------------------------------------- |
| Real WebGL, new | `npm run verify:film-shapes`       | PASS   | numbers below; the same scene draws the same frame       |
| Unit, new       | `node --test tests/shapes.test.mjs` | PASS  | winding, normals, counts, areas, refusals                |

A cylinder of radius 0.5 m lit from the left, five places across its front:
184, 180, 165, 132, 72 (the floor there without it: 36). A raised square
beside it: top 176, its two visible sides 166 each (the sun stands at 45
degrees to both).

## Sixth batch

| Check                  | Exact command or procedure                     | Result | Artifact                                           |
| ---------------------- | ---------------------------------------------- | ------ | -------------------------------------------------- |
| Real WebGL, new        | `npm run verify:film-colours`                  | PASS   | numbers below; fails on the code before this batch |
| Real WebGL, extended   | `npm run verify:film-point-shadow`             | PASS   | numbers below                                      |
| Real WebGL, changed    | `npm run verify:film-water`                    | PASS   | its water colour carried over to a display value   |
| Real WebGL, regression | the other fourteen verifications               | PASS   | each exit 0                                        |
| Unit, new              | `tests/color-values.test.mjs`, `tests/material-default.test.mjs` | PASS | decoding, migration, default material |
| Types                  | a strict consumer file against `packages/types/index.d.ts` (`skipLibCheck`, TypeScript 6.0.3) | PASS | each overload's return type; a wrong expectation fails |

Colours, graded centre pixel (0..255): a floor under flat ambient light of 0.5
is 72, under ambient 0.5 with `ambientGround` 0.5 also 72 (before this batch
the second was brighter and the check failed); an empty view filled with fog
of 0.5 is 104, a sky of 0.5 is 104, a sky of 0.735 (half the light) is 166.
The route examples: day example identical in every metric (p05 0.129, p50
0.333, p95 0.761); night example p50 0.216 before, 0.192 now, its lamps'
halos in their own colours.

Point shadows: a 25 by 25 pixel patch of far floor lit at a grazing angle and
one across a seam of the cube's faces differ from the frame without shadows
by 0 (the first filtered version drew stripes there). Two lamps out of each
other's reach: the floor beyond each one's box 0 with both casting; with the
second not casting, the floor beyond its box 84.

## Seventh batch

| Check                  | Exact command or procedure                         | Result | Artifact                                   |
| ---------------------- | -------------------------------------------------- | ------ | ------------------------------------------ |
| Real WebGL, new        | `npm run verify:film-bounce`                       | PASS   | numbers below; identical after remounts    |
| Real WebGL, refactored | `npm run verify:film-environment`                  | PASS   | the shared capture code draws as before    |
| Real WebGL, regression | the other sixteen verifications                    | PASS   | each exit 0                                |
| Unit, new              | `tests/bounce-light.test.mjs`                      | PASS   | grid, octahedral decoding, atlas borders, tiles cut from a read-back, film field, default box |

A white cube 1.5 m from a sunlit red wall, its face toward the wall in shadow
(graded pixel): 80, 81, 81 with flat ambient light; 164, 32, 41 with
`bounceLight` at a spacing of 1.5 m; 108, 14, 23 at strength 0.5. Before
probes inside solids were switched off, one column of probes fell inside the
wall and the face drew 118, 52, 68. The scene-wide environment probe on the
same scene gives 169, 22, 33, which is what the volume's evaluation was
matched against. Mount and first frame on the software GPU: day example
5.5 s, with `bounceLight` 29.3 s (8 x 2 x 7 probes); night example 5.1 s and
30.8 s (7 x 4 x 8). Drawn eight probes to a read-back the times are 32.4 s
and 36.3 s: no faster on the software GPU. The probe in front of the wall
sees 0.841, 0.068, 0.084 toward it either way, read back one probe at a time
or eight.

## Eighth batch

| Check                  | Exact command or procedure            | Result | Artifact                                                  |
| ---------------------- | ------------------------------------- | ------ | --------------------------------------------------------- |
| Real WebGL             | all eighteen `verify:film-*` and `verify:procedural` | PASS | each exit 0 with the brighter presets and the new reflections |
| Unit, changed          | `tests/screen-reflections.test.mjs`   | PASS   | one frame: four passes, half-size targets, both released  |
| Unit, changed          | `tests/film-lint.test.mjs`, `tests/live-look.test.mjs` | PASS | presets now give ground light; `false` opts out |

Presets, luminance p05 / p50 / p95 (0..255) of the yard, before and after:
day 23 / 87 / 200 and 33 / 104 / 200; dawn 5 / 42 / 165 and 18 / 65 / 165;
dusk 2 / 10 / 107 and 9 / 29 / 107; overcast 18 / 63 / 185 and 27 / 83 / 185.
The bright end does not move: only what lay in shadow is lifted.

Reflections of the night example without its reflector, lower half of the
frame, columns where the reflections add light: separate lit pieces per
column 3.5 as delivered, 2.3 with the three passes, 2.1 with the tighter hit
window; the lamp's reflection is a few soft spots instead of a scattered line
of single pixels. The wall check still finds the lamp at its mirrored place
(254.9, 251.8, 247.6 where the wall is 0 without reflections).

## Lifecycle and failure cases

- Repeated create and destroy: five mounts with another scene between each,
  byte-identical frames (`verify:film-remount`); the reflector's own 30-cycle
  check still passes.
- Malformed data: `film_scene_lint` refuses an invalid scene with the
  validator's message and refuses a call with both or neither of `sessionId`
  and `scene`; `measureZhudaFrame` and `createSurfaceTexture` reject bad input
  (unit tests).
- Timeout: the capture timeout now names its length and `timeoutMs`; reached
  in practice on the software GPU at the default 30 s.
- Context loss, cancellation, stale completion: untouched and not re-tested.

## Prefab evidence (visual work)

Not applicable: no consumer prefab is changed. The two example scenes use the
neutral starter props and recipes of the engine.

## Limits and decision

- `npm run verify`, the pinned TypeScript, prettier and eslint: not run.
- No real GPU, no WebGPU, no mobile device, no mini-game host.
- The frame-time cost of multisampling: not measured.
- Colour values: two fields are scene-linear where the rest are display values; documented,
  not changed.
- Screen reflections and the scene-linear path: software GPU only; cost not measured.

**In progress.** The changes pass every check that could run here, including
the repository's own real-WebGL verifications on a software GPU. Acceptance
needs `npm run verify` on the pinned toolchain and the same draws on the
owner's GPU.
