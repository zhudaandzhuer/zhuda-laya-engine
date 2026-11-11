# Verification record: film-reflector

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `87effc7`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check              | Exact command or procedure                                                               | Result                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reflector schema   | `node --test tests/film-scene.test.mjs`                                                  | PASS, 12 tests: ten bad fields reported with paths, a second reflector refused, `hides` accepts only model nodes of the scene                                                                                                                        |
| Mirror projection  | `node --test tests/reflective-surface.test.mjs`                                          | PASS, 2 tests: a point seen by the mirrored camera and its reflection seen by the real camera land at the same horizontal place and mirrored vertical place (1e-9), points on the plane coincide, straight-down views stay finite, options validated |
| Real GPU reflector | `npm run verify:film-reflector`                                                          | PASS (below)                                                                                                                                                                                                                                         |
| Film regressions   | `npm run verify:film`, `verify:film-look`, `verify:film-model`                           | PASS                                                                                                                                                                                                                                                 |
| Full gate          | `npm run verify` (370 tests), `npm run lint`, `npm run format:check`, `git diff --check` | PASS                                                                                                                                                                                                                                                 |

### `verify:film-reflector` (480×270, a red emissive box above a 30 m reflector)

Mean colour of a 5×5 patch at pixels computed by an independent pinhole
projection in the script.

| Case                                           | Lamp                                                              | Mirror position      | Surface away from the lamp |
| ---------------------------------------------- | ----------------------------------------------------------------- | -------------------- | -------------------------- |
| No reflector                                   | 255, 51, 14                                                       | 0, 0, 0              | 0, 0, 0                    |
| Reflector, all standing water                  | 255, 51, 14 (unchanged)                                           | 255, 15, 2           | 0, 0, 0                    |
| `strength: 0`                                  |                                                                   | below 5              |                            |
| `strength: 0.5`                                |                                                                   | 253, 8, 1            |                            |
| Damp only (`wetness: 0`)                       |                                                                   | 202, 5, 1            |                            |
| Double-sided floor model under the mirror      |                                                                   | 27, 27, 27 (blocked) |                            |
| Same floor listed in `hides`                   |                                                                   | 255, 32, 26          |                            |
| After 30 mounts with and without the reflector | frame byte-identical to the first; plain frame byte-identical too |                      |                            |

## Defects found and fixed

- **`ZhudaPlanarReflection` drew no geometry.** It aimed the mirrored camera
  with a flipped up vector; in Laya 3.4.2 that camera renders only its clear
  colour. Shown by putting the raw target on a surface: empty with the
  flipped up, the lamp visible with +Y up at the same position and target.
  The camera now keeps +Y up. The class had no consumer in the engine; its
  earlier check compared target pixels only, which a clear colour satisfies.
- Laya render targets are stored bottom row first; the surface flips V when
  sampling. Found by drawing the projected coordinates next to the raw
  target.
- The surface samples with its own matrix (`zhudaMirrorProjection`), tested
  in Node, instead of reading the camera's matrix.

## Use in a film

The ancient-city test film (kept outside this repository) was rendered again
with a 15 × 100 m reflector over the street (2048 px, 42 % standing water)
on top of the baked lightmaps: 864 frames at 1280×720 with 6 samples in
390 s, against 303 s without the reflector. Lanterns, lit windows, the gate
and the moon now show in the paving. In the same pass the asset script gave
emissive materials a separate display value, so lanterns keep their colour
under the grade, and a brighter moon in the bake.

Still open for that film: no characters, the reflection is the only
highlight (roof tiles and timber have none), and the puddle pattern does not
follow the paving joints.

## Limits and decision

- Horizontal planes only; one reflector per film scene; each is a second
  scene render per sample.
- Geometry below the plane that is not a hidden model node blocks the
  mirror (boxes, the `ground` node, props).
- The puddle pattern is procedural noise, not authored; ripples do not move.
- Blur is a five-tap filter scaled by `roughness`, not a roughness-correct
  convolution.
- GPU object counts across mounts were not measured; the evidence is
  identical frames after 30 mounts.
- Desktop WebGL only; WebGPU and mobile are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**
