# Verification record: procedural-draw-splash

Task document: `docs/plans/records/procedural-draw-splash/task.md`\
Commit: `ed3e66b` plus the changes of this record (committed after these runs)\
Date: 2026-11-16

## Environment

- macOS 27.0.1, Apple M4; headless Google Chrome 157.0.8103.39 through the
  repository's `chromeFixture`; WebGL renderer `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4, Unspecified Version)`.
- Node 26.12.0, npm 11.20.0.
- 960 x 600 CSS pixels, DPR 1, local HTTP server.
- Load average 2.6 to 27 during the runs.

Evidence, kept outside the repository: `EV` =
`<workspace>/audits/procedural-draw-splash-2026-11-16/`
(pictures and `report.json` per run, `logs/` with the bisect script, the
pixel-compare script and every run's output).

## Bisect

Each commit built (`npm run build`) in a temporary detached worktree with
`node_modules` linked, then `node scripts/verify-procedural-draw.mjs` run
twice with the check of that commit.

| Commit                                               | Run 1                    | Run 2                    | Artifact              |
| ---------------------------------------------------- | ------------------------ | ------------------------ | --------------------- |
| `a83ed1a` (last recorded pass, `character-surfaces`) | PASS, U 0.986, V 0.998   | PASS, U 0.986, V 0.998   | `EV/pass-a83ed1a/`    |
| `e835b26` (parent of `e71da33`)                      | PASS, U 0.986, V 0.998   | PASS, U 0.986, V 0.998   | `EV/pass-e835b26/`    |
| `e71da33` (the splash waits for the page)            | FAIL, `relief-u`, 3 of 2 | FAIL, `relief-u`, 3 of 2 | `EV/failing-e71da33/` |
| `ed3e66b` (main), check unchanged                    | FAIL, `relief-u`, 3 of 2 | not run                  | `EV/failing-ed3e66b/` |

First bad commit: `e71da33`. Every failing picture shows the grey LayaAir
tribute splash, part-faded, over the whole page (logo, caption and bar over
the two panels). The passing pictures show the dark background and the two
panels only.

## Checks

| Check                                     | Exact command or procedure                                                      | Result                                                                                                     | Artifact                           |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Procedural draw, WebGL, with the fix      | `PROCEDURAL_EVIDENCE_DIR=<dir> node scripts/verify-procedural-draw.mjs`, twice  | PASS both: U 0.986, V 0.998; spreads 140.6/175.2 (U), 139.5/176.6 (V); flat 1.0                            | `EV/fixed-ed3e66b-run1/`, `-run2/` |
| Same pictures as the last pass            | `node logs/cmp.mjs EV/pass-a83ed1a EV/fixed-ed3e66b-run1` (per-pixel RGB)       | 0 pixels differ in each of `yard`, `relief-u`, `relief-v`, `flat`                                          | `EV/logs/cmp.mjs`                  |
| Failing pictures against fixed            | `node logs/cmp.mjs EV/failing-ed3e66b EV/fixed-ed3e66b-run1`                    | 576,000 of 576,000 pixels differ in each view (the overlay covered the whole page)                         | as above                           |
| Splash timing as the check relies on it   | `node --test tests/engine-splash.test.mjs`                                      | PASS, 5 (new: `completed` is set while the node is in the page; removed at 460 ms; the CSS fade is 420 ms) | —                                  |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                | PASS, 857 of 857                                                                                           | —                                  |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check`                      | PASS                                                                                                       | —                                  |
| Other checks that screenshot the page     | `node scripts/verify-geometry.mjs`, `node scripts/verify-developer-tooling.mjs` | PASS; their pictures looked at: no splash in them                                                          | not kept                           |

## Why one panel or three

`panels()` reads the middle row (y = 300) and keeps runs brighter than 45
(luma) and wider than 50 pixels. With the splash's `#8a8a8a` at part opacity
over the page, the dark background (31 in a passing picture) read 107 to 124
in the failing ones, above 45, so the row is
one long run, or three when the logo's black hexagon cuts it. Which view
failed and with how many runs depended on how far the 420 ms fade had got
when the picture was taken. The threshold matches the correct pictures and
was left as it is.

## Limits and decision

- The other draw checks that wait for `completed` read the canvas
  (`readPixels`, `getImageData`), which the overlay does not reach;
  `verify-physical-surfaces` waits 600 ms after it. `verify-geometry` and
  `verify-developer-tooling` screenshot the page without waiting for the node:
  clean in this run because their pages work for longer than 460 ms after
  `completed`, but not guarded.
- WebGL only (the check has no WebGPU mode). No phone.
- The check still proves only the named fixtures on a desktop GPU.

Decision: **Accepted** for the check. The engine drew correctly throughout;
the splash change of `e71da33` behaves as its record says. Fast-forwarded into
`main` and pushed on the user's word ("快轉並推送").
