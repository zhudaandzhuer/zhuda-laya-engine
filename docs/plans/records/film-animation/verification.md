# Verification record: film-animation

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `cd00c52`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check                      | Exact command or procedure                                                                                 | Result                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motion sampling and schema | `node --test tests/film-scene.test.mjs`                                                                    | PASS, 16 tests: linear position, yaw from 350° to 10° passes 360° and not 180°, first and last keys held, a key's missing yaw keeps the previous one; eleven bad animation, motion and follows fields reported with paths |
| Real GPU animation         | `npm run verify:film-animation`                                                                            | PASS (below)                                                                                                                                                                                                              |
| Film regressions           | `npm run verify:film`, `verify:film-look`, `verify:film-model`, `verify:film-reflector`, `verify:film-fog` | PASS                                                                                                                                                                                                                      |
| Full gate                  | `npm run verify` (379 tests), `npm run lint`, `npm run format:check`, `git diff --check`                   | PASS                                                                                                                                                                                                                      |

### `verify:film-animation` (480×270; a generated two-joint skinned strip, clip "Bend")

| Case                                       | Result                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Clip at 0 s                                | top of the strip straight up, nothing at the bent position                                                        |
| Clip at 1 s                                | top gone from above, strip at the bent position; lower half unchanged                                             |
| Clip at 0.5 s                              | at neither end position                                                                                           |
| Same time twice                            | frames byte-identical                                                                                             |
| `speed: 2` at 0.5 s, `offsetSec: 1` at 0 s | both byte-identical to 1 s                                                                                        |
| No `animation`                             | rest pose at any time                                                                                             |
| Unknown clip                               | refused: `has no clip Wave; it has: Bend`                                                                         |
| Motion 0 → 4 m in 2 s                      | at 1 s the model is at 2 m and not at 0; at 5 s it stays at 4 m                                                   |
| Light following 1.5 m in front             | at 0 s the ground in front is lit; after the model turned 90° the ground at its new front is lit (238 against 63) |
| After 30 mounts with and without the clip  | frame byte-identical to the first                                                                                 |

## Use with a real character

A 52 000-triangle skinned character with seven clips made in Blender (13
joints, sampled glTF animations) was mounted with `animation: { clip: 'Walk' }`
and previewed at four shot times: four different poses of the walk cycle,
with the lantern joined to the hand swinging.

## Limits and decision

- One clip per model at a time; no blending, no events, no root motion: the
  scene's `motion` moves the model and must match the clip's stride.
- Motion is linear between keys; there is no easing or path smoothing.
- Characters get no baked light: they need real-time lights and `ambient`.
- A following light is a point light without shadows.
- Desktop WebGL only; WebGPU and mobile are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**
