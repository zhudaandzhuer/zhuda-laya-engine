# Verification record: film-environment

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `2b42a01`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check                | Exact command or procedure                                                                                                          | Result                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefilter math       | `node --test tests/environment-probe.test.mjs`                                                                                      | PASS, 5 tests: cube direction and texel functions are inverses on all six faces; a uniform environment stays uniform at every mip (1e-5) and gives flat ambient (1–2 %); a bright world +X is stored on the cube's −X face (Laya mirrors X) and makes a surface facing +X brighter than one facing −X; a small bright spot gets dimmer and wider from mip to mip; bad input refused |
| Scene schema         | `node --test tests/film-scene.test.mjs`                                                                                             | PASS, 17 tests: environment fields validated with paths, resolved with defaults, merged by patches                                                                                                                                                                                                                                                                                  |
| Real GPU reflections | `npm run verify:film-environment`                                                                                                   | PASS (below)                                                                                                                                                                                                                                                                                                                                                                        |
| Film regressions     | `npm run verify:film`, `verify:film-look`, `verify:film-model`, `verify:film-reflector`, `verify:film-fog`, `verify:film-animation` | PASS                                                                                                                                                                                                                                                                                                                                                                                |
| Full gate            | `npm run verify` (390 tests), `npm run lint`, `npm run format:check`, `git diff --check`                                            | PASS                                                                                                                                                                                                                                                                                                                                                                                |

### `verify:film-environment` (480×270; a 2 m box of metal at roughness 0.03, probe at its centre)

For each view the script computes where a mirror would send the camera's
ray, puts a red lamp 12 m along it and a green lamp at the mirrored-wrong
place, and reads the pixel where the camera looks.

| View                                             | Wrong lamp at            | Pixel                                                        |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------ |
| Straight at the +Z face, lamp behind the camera  | mirrored in Z            | 255, 0, 0                                                    |
| +Z face from the side                            | mirrored in X            | 255, 0, 0                                                    |
| Top face from above                              | mirrored in Z            | 255, 0, 0                                                    |
| +X face from the east                            | mirrored in X            | 255, 0, 0                                                    |
| Top face nearly straight down, 2.5 m lamps       | mirrored in X, then in Z | 255, 0, 0 both                                               |
| No `environment`                                 |                          | 0, 0, 0                                                      |
| Rough white box, red lamp to the west            |                          | 255 on the west face, 139 on the east face, no green or blue |
| After 30 mounts with and without the environment |                          | frame byte-identical to the first                            |

## Defects found and fixed

- The first capture was upside down: render-target read-back in Laya 3.4.2
  starts at the top row, not the bottom. The views behind the camera and to
  the side passed (the lamps were level with the probe); the view from above
  showed nothing. Fixed in the resampling and covered by the top-face and
  zenith checks.

## Limits and decision

- One probe per scene, captured once when the scene loads. Reflections are
  exact only at the probe; far from it they show the wrong surroundings
  (a room would reflect the street if the probe is in the street).
- No box projection, no blending between probes, no update while things move.
- The convolution runs on the CPU when the scene loads (six 128 px views, a
  64 px cube); its time on large scenes was not measured.
- Lightmapped surfaces keep their baked diffuse light; only their reflections
  come from the probe.
- Desktop WebGL only; WebGPU and mobile are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**
