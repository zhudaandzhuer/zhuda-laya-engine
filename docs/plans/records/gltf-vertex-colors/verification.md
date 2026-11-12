# Verification: glTF vertex colours

Base commit `74f01f5` plus this change (uncommitted at the time of the run).
macOS (Apple Silicon), headless Chrome, 2026-11-12.

| Command                                                     | Result                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`                                            | pass, 419 tests                                                                                                                            |
| `npm run lint`, `npm run format:check`, `git diff --check`  | pass                                                                                                                                       |
| `node --test tests/vertex-colors.test.mjs`                  | pass: the define is set once per material and only for meshes with a colour channel; colour accessors of every storage become RGBA floats  |
| `npm run verify:film-water` (WebGL)                         | pass; step 5c draws a white floor under ambient light with and without `COLOR_0` 0.2: the coloured one is darker than 0.7 of the plain one |
| `npm run verify:film-webgpu`                                | pass, 8 verifications, the same step on WebGPU                                                                                             |
| `npm run verify:film-model`, `npm run verify:prefab-models` | pass                                                                                                                                       |

Consumer run (outside this repository): a game scene whose houses carry baked
shade as normalized 16-bit and as three-float `COLOR_0` draws dim rooms and
unchanged streets on WebGPU; before the accessor conversion the same files drew
blown-out white and tinted surfaces.

## Also in this change: prefab check command time limit

`packages/compiler/prefab-check.mjs` gave every browser command ten seconds.
A prefab of large models (one 97 MB file among 42, 562 MB in all) holds the
page's thread longer than that while a file is parsed, and the check failed
with `CDP timeout: Runtime.evaluate` although the prefab then drew correctly.
A command may now wait as long as the whole check (`browserTimeoutMs`).
`npm run verify:prefab-browser` passes; in the consumer the 562 MB prefab is
captured in 87 s and compared in 28 s, where it timed out before.

## Not verified

- Windows, mobile, and any GPU other than the one above.
- Skinned meshes with vertex colours (the code path is shared; no fixture).
- Sparse colour accessors.
