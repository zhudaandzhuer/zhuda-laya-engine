# Verification record: underwater-route (AG6)

Task document: `docs/plans/records/underwater-route/task.md`\
Commit: the commit that adds this file, on top of the merge after `3a594cb`\
Date: 2026-11-17

## Environment

macOS 27.0.1, Apple M4, Google Chrome 157 headless through the film host;
WebGL (ANGLE Metal, disjoint timer query) and WebGPU (apple / metal-3,
timestamps). Evidence (outside the repository): `EV` =
`/Users/yaowei/Documents/ZhudaGameCenter/audits/underwater-route-2026-11-17/`.

## Checks

| Check                                     | Exact command or procedure                                                                                               | Result                                                           | Artifact   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| Fly-through with water, twice a backend   | `npm run verify:flythrough -- tests/fixtures/flythrough/underwater.json` (with and without `ZHUDA_FILM_RENDERER=webgpu`) | PASS each; GPU average WebGL 6.76, 6.85 ms; WebGPU 4.16, 4.15 ms | `EV/wet-*` |
| The same without water                    | the same file with `look.underwater: false` (made in the session's scratch folder)                                       | PASS each; GPU average WebGL 6.72, 6.61 ms; WebGPU 4.06, 4.06 ms | `EV/dry-*` |
| Links of the route                        | a script over its relative links and anchors                                                                             | all resolve                                                      | —          |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                                                         | see the commit's record of the run                               | —          |

## Limits and decision

Desktop only; no phone and no consumer game. **Done** as documentation; the
route's own status line carries the same limits.
