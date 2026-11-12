# Verification: levels of detail by distance

Base commit `74f01f5` plus uncommitted changes. macOS (Apple Silicon),
headless Chrome, 2026-11-12.

| Command                                                      | Result                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                             | pass, 421 tests                                                                                                                                                                                                                                                              |
| `npm run lint`, `npm run format:check`, `git diff --check`   | pass                                                                                                                                                                                                                                                                         |
| `node --test tests/prefab-models.test.mjs`                   | pass: borders, hysteresis in both directions, culling and return, invalid input, counts, disposal, definition errors named by node                                                                                                                                           |
| `npm run verify:prefab-models`                               | pass; step 4b draws three copies with the eye among them (plain model, 8,642 lit pixels), 8 m away (all three draw the glowing version: warm sum 276,544 against 112,346) and 12 m away (one copy culled: 6,040 lit pixels), and coming back gives the first picture exactly |
| `npm run verify:prefab-browser`, `npm run verify:film-model` | pass                                                                                                                                                                                                                                                                         |

Consumer run (outside this repository, WebGPU): a prefab of 7,293 copies with
two or three levels per model; at its start position 974 copies draw the full
model, 3,400 a lighter one and 2,741 nothing. The picture is correct and the
graphics device reports no error over the run. With node deactivation instead
of the render flag the same scene drew black (see the task's seam note).

## Not verified

- **Frame rate.** Back-to-back frame cost in headless Chrome varied by a
  factor of five between runs of the same scene (72 to 430 ms), with and
  without levels; one comparison showed about 30% less with levels, which is
  not enough to claim a number. No GPU timing exists.
- Windows, mobile, other GPUs.
- Skinned models as levels.
- Popping when a level changes is visible in principle; no fade.
