# Verification record: scene-uniform-order

Task document: `docs/plans/records/scene-uniform-order/task.md`\
Commit: the commit that adds this file, on top of `1e75db1`\
Date: 2026-11-17

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's film host. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`.
  WebGPU: `WebGPU apple metal-3 (ready)`, not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `1e75db1`; no consumer.
- DPR, viewport and network mode: DPR 1; the checks' own sizes (480 by 270
  for `verify:film-remount`); loopback.
- Evidence (outside the repository): `EV` =
  `<workspace>/audits/scene-uniform-order-2026-11-17/`:
  the remount frames of `1e75db1` (with the stray pixels marked), `777f04c`,
  the fix on WebGL and on WebGPU; the bisect summary; the three sweeps; the
  foliage logs; the `npm run verify` log.

## Finding the commit

`git bisect start 1e75db1 49586e0`, each step `npm run build` then
`npm run verify:film-remount` (about 5 s a step):

| Commit    | Stray green on the five mounts |
| --------- | ------------------------------ |
| `49586e0` | 0 on each                      |
| `89e29af` | 1265 on each                   |
| `e71da33` | 0 on each                      |
| `3b63fee` | 0 on each                      |
| `45f8664` | 1265 on each                   |
| `777f04c` | 0 on each                      |

First bad commit: `45f8664`. On `1e75db1`, with `declareWind` reduced to
`propertyNameToID` the check passed, and with the map entry it failed: the
entry, not the new property, is what breaks the frame.

## Checks

| Check                                       | Exact command or procedure                                                | Result                                                                                                                                    | Artifact                                                |
| ------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Build, types, declarations, doctor, tests   | `npm run verify`                                                          | PASS, 875 of 875                                                                                                                          | `EV/verify.log`                                         |
| Lint, format, whitespace                    | `npm run lint`, `npm run format:check`, `git diff --check`                | PASS                                                                                                                                      | —                                                       |
| The new unit test                           | `node --test tests/foliage.test.mjs`                                      | PASS, 7 of 7; with the `Foliage.ts` of `1e75db1` it fails (`the map is LayaAir's to make`)                                                | —                                                       |
| Remount, WebGL                              | `npm run verify:film-remount`                                             | PASS: stray green 0 on all five mounts, five mounts byte-identical, no WebGL error                                                        | `EV/remount-webgl-fixed/`                               |
| Remount frame against the last good commit  | mount 1 of the fix against mount 1 of `777f04c`, byte for byte            | identical                                                                                                                                 | `EV/remount-webgl-777f04c/`                             |
| Remount, WebGPU                             | `ZHUDA_FILM_RENDERER=webgpu node scripts/verify-film-remount.mjs`         | PASS (it also passed before the fix)                                                                                                      | `EV/remount-webgpu-fixed/`                              |
| The 20 film draws, WebGPU                   | `npm run verify:film-webgpu`                                              | PASS, 20 of 20                                                                                                                            | `EV/sweep-webgpu.txt`                                   |
| The same 20 film draws, WebGL, with the fix | each script of `verify-film-webgpu.mjs` run without `ZHUDA_FILM_RENDERER` | PASS, 20 of 20                                                                                                                            | `EV/sweep-fixed.txt`                                    |
| The same 20, WebGL, without the fix         | the same, built with the `Foliage.ts` of `1e75db1`                        | 14 of 20; FAIL: film-look, film-environment, film-remount, quality-route, film-point-shadow, film-finishes                                | `EV/sweep-unfixed.txt`                                  |
| The wind still reaches the shaders          | `node scripts/verify-foliage.mjs`; `FOLIAGE_RENDERER=webgpu` the same     | PASS on both: marked card 3513 leaf and 3487 shadow pixels moved, unmarked 0; far coverage 0.532 against 0.072, as recorded for `45f8664` | `EV/fix-foliage-webgl.log`, `EV/fix-foliage-webgpu.log` |

## Lifecycle and failure cases

- Installed before `Laya.init` (the boot path): the wind is declared right
  after `Scene3D.shaderValueInit`, and `shaderValueInit` is put back.
- Installed after LayaAir made its map: added at once, at its end (unit test).
- No `Scene3D` and no map: nothing is declared, `zhudaFoliageStatus().wind`
  is false, so `ZhudaFoliageWind` refuses to start (unit test).
- Repeated create and destroy: `verify:film-remount` mounts the yard five
  times with another scene between; frames byte-identical on both backends.

## Limits and decision

- Desktop only (Apple M4). No phone and no Windows run of this change.
- WebGL 1 was not run.
- The reading of which member took which bytes follows from the std140
  offsets of the two layouts; the map order itself was read in the page.

Decision: **Accepted within scope** on the desktop, both backends: the
check passes without any change to its threshold or reference, and the
frame is the one the engine drew before `45f8664`.
