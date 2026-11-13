# Verification: model glow while running

Base commit `d61f6db` plus uncommitted changes. macOS (Apple M4), headless Chrome, 2026-11-12.

| Command                                                    | Result                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                           | pass, 435 tests                                                                                                                                                                                                                                   |
| `npm run lint`, `npm run format:check`, `git diff --check` | pass                                                                                                                                                                                                                                              |
| `npm run verify:prefab-models` (WebGL)                     | pass; step 4c: with the lamp's emission at 0 the frame is darker than authored (6,206,750 against 6,246,190 summed brightness), at 3 brighter (6,257,070), and back at 1 exactly the authored frame; an unknown node and a scale of 9 are refused |

Consumer run (outside this repository, WebGPU): thirteen town models at scale
0.04 by day and 1 at night; the night street shows lit windows and lanterns,
and the graphics device reports no error across eight hours and weathers.

## Not verified

- A drawn check of `setEmission` on WebGPU inside this repository (the
  consumer run above is the only WebGPU evidence).
- Two prefab instances of one library that share an asset and want different
  scales: they cannot have them; not tested.
