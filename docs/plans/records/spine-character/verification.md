# Verification record: spine-character

Task document: `docs/plans/records/spine-character/task.md`  
Commit: branch `docs/implementation-routes` (with the implementation-routes change)  
Date: 2026-11-15

## Environment

- OS / browser / device: macOS (Apple M4), Chrome headless through the repository's chrome host
  (`tools/shot.mjs` in the consumer), 600 x 900 CSS px, DPR 1.
- Node and package manager: Node v26.12.0, npm (the main checkout's `node_modules`, linked).
- Engine: this branch from `c076610`. Consumer: `games/stocking-tear-2d` built against this
  branch (its pinned engine copy set aside for the run and put back), then restored.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Unit | `node --test tests/spine-character.test.mjs` | PASS (5/5) | local log |
| Strict consumer types | `node --test tests/public-spine-character-types.test.mjs` | PASS | local log |
| Build, types, declarations, Doctor, tests | `npm run verify` | PASS (822/822 tests, Doctor HEALTHY) | local log |
| Lint / format / whitespace | `npm run lint`, `npm run format:check`, `git diff --check` | PASS | local log |
| Real WebGL | consumer `RENDERER=webgl`, real mouse drags: leg held (stretch), leg pulled twice (small then large tear), skirt held (IK mix 1) | PASS: tears `L_calf:2`, held `skirt`, `diagnostics()` physicsUpdate 2, useFastRender false, premultipliedAlpha false | `games/stocking-tear-2d/evidence/helper-sheet.jpg` |
| Real WebGPU | the same on the WebGPU build | PASS: tears `L_calf:2`, `R_shin:1`; skirt lifted | same sheet |
| Device | — | UNAVAILABLE: the vivo V40 was in use by another project | — |

The first consumer run through the class found two faults, fixed before the record:
`templet.checkPremultipliedAlpha()` said true for a `pma:false` atlas (the class now uses
straight alpha unless told otherwise, and the test's fake templet says true to hold that),
and the consumer passed bone objects where the class takes names.

The first `npm run verify` in this worktree failed two existing tests only because the worktree
had no `node_modules` (meshoptimizer, `@webgpu/types`); with the main checkout's linked, both pass.

## Limits and decision

- Not run on a phone; LayaAir's Spine physics not compared with spine-webgl's.
- One rig convention checked (zhuda-spine2D: bounds = the art's canvas).

Decision: **Implemented within scope.**
