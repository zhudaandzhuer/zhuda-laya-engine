# Verification: a look rebuild keeps the water; a phone does not stay paused

Base commit `e71da33` plus uncommitted changes. macOS, headless Chrome, 2026-11-16.

| Command                                                                                                        | Result                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                                                                               | pass, 835 tests                                                                                                                                                                                                                 |
| `node --test tests/runtime-driver.test.mjs`                                                                    | pass, 6; the two new tests (input resumes a blur pause, a manual pause stays; touch-only ignores blur, hiding still pauses) fail without the Runtime change                                                                     |
| `npm run build && node scripts/verify-lighting-depth.mjs`                                                      | pass; new checks: with `cameraPasses` the depth picture and opaque pass survive `setQuality(0)` and `setQuality(3)` and go with `dispose`. Without the SceneLook change it fails at "cameraPasses survive a rebuild to level 0" |
| `LIGHTING_RENDERER=webgpu node scripts/verify-lighting-depth.mjs`                                              | pass                                                                                                                                                                                                                            |
| `npm run lint`, `git diff --check`                                                                             | pass                                                                                                                                                                                                                            |
| Consumer game built against this checkout, headless Chrome WebGPU, `?tier=high`, levels 3→2→1→0→3 at the river | the water draws at every level (before: gone at level 0)                                                                                                                                                                        |

## Not verified

- On the iPhone itself with this change (the evidence of the pause is from
  the iPhone before the change: the game clock stood still on a visible page).
- Android Chrome blur behaviour; WeChat's web view.
