# Verification record: film-model-gi

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `09f12da`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check                         | Exact command or procedure                                                               | Result                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model node schema             | `node --test tests/film-scene.test.mjs`                                                  | PASS, 11 tests: asset ids must be logical and end in `.glb`/`.hdr`, paths outside the directory, URLs and absolute paths refused, unknown assets listed against the host's files, 65 models refused, patches upsert models, the bundled host without an asset directory refuses models |
| HDR and RGBM                  | `node --test tests/lightmap.test.mjs`                                                    | PASS, 3 tests: flat and run-length rows decode identically, six kinds of bad input refused with a reason, RGBM round-trip within 3 % from 0.02 to 30, clamped at the format range                                                                                                      |
| Real GPU models and lightmaps | `npm run verify:film-model`                                                              | PASS (below)                                                                                                                                                                                                                                                                           |
| Film regressions              | `npm run verify:film`, `npm run verify:film-look`                                        | PASS                                                                                                                                                                                                                                                                                   |
| Full gate                     | `npm run verify` (367 tests), `npm run lint`, `npm run format:check`, `git diff --check` | PASS                                                                                                                                                                                                                                                                                   |

### `verify:film-model` (generated GLB floor and 64 px HDR lightmap, 320×200)

Mean display colour of a 9×9 patch; expected values are `255 · linear^(1/2.2)`.

| Case                                              | Measured                                                             | Expected               |
| ------------------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| Model under ambient 0.5, no lightmap              | 128                                                                  | drawn (empty scene: 0) |
| Model with no light and no lightmap               | 0                                                                    | 0                      |
| Lightmap quadrants 0.5 red, green, blue; 0.2 grey | 188, 188, 188, 123 in the matching quadrant, 0 in the other channels | 186, 186, 186, 123     |
| `lightmapIntensity: 0.5`                          | 137, 137, 137, 89                                                    | 136, 136, 136, 90      |
| `yawDeg: 180`                                     | quadrants swap diagonally                                            | same                   |
| `scale: 0.25`                                     | frame edge unlit                                                     | same                   |
| Missing `.glb`                                    | rejected: `model floor: cannot load set/missing.glb`                 | rejected               |
| Lightmap on a model without `TEXCOORD_1`          | rejected, names `TEXCOORD_1`                                         | rejected               |
| A `.glb` named as a lightmap                      | rejected by validation                                               | rejected               |
| 30 mounts alternating lightmap and look           | one live instance each cycle; cache: 2 entries, 3 loads              | no growth              |
| Scene without the model afterwards                | 0 instances                                                          | 0                      |
| Lightmap rewritten on disk                        | next mount shows the new quadrants                                   | same                   |

The second UV set follows glTF: UV (0, 0) is the picture's top-left texel,
and the model is not mirrored on screen.

## Defects found and fixed

- None in shipped code. During the work an edit truncated `FilmStage.ts`;
  the build caught it and the file was restored before any check ran.

## Use in a film

The ancient-city test film (kept outside this repository) was rebuilt on this
feature. A Blender 5.2 script models the city (about 150 000 faces in eight
GLB models), using textures baked from the engine's own texture recipes, and
bakes seven lightmaps with Cycles (36 lantern lights, lit windows, moon and
sky; 256 samples; two at 4096 px, four at 2048 px, one at 1024 px; about 15
minutes on an Apple M4). The engine rendered all 864 frames at 1280×720 with
6 samples in 303 s through `film_render_job`, with the sun at 0 and no
real-time lights.

Observed against the earlier procedural version: bounce light on walls and
under eaves and soft shadows from every lantern are new. Worse than before:
the paving has no highlights (the bake is diffuse only and no real-time light
is left to make them), and emissive lanterns and windows clip to white under
the grade.

Lightmap unwrapping note for asset authors: island unwraps of models made of
thousands of small parts lose most of the picture to margins (measured
coverage under 1 %). One rectangle per face (Blender `lightmap_pack`) gave
47–81 % coverage.

## Next steps (not started)

1. Highlights with baked lighting: a reflection probe or image-based
   specular for film scenes, or directional lightmaps.
2. Emission that keeps its colour under the grade.
3. glTF characters in film scenes (animation playback in renders).

## Limits and decision

- Lightmaps hold diffuse light only, as 8-bit RGBM (clamped near 34 linear);
  no directional lightmaps, no reflection probes, no real-time global
  illumination. Baking happens outside the engine.
- Props, boxes and the ground are not lightmapped.
- Models are static in film renders; animations are not played.
- The asset cache keeps up to 16 unused models warm; very large scenes are
  bounded by GPU memory, which is not measured here.
- Desktop WebGL only; WebGPU and mobile are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**
