# Verification: sky-island effects

Date: 2026-11-16
Branch: `feat/sky-island-effects` (worktree `engines/zhuda-laya-engine-island`), from `3b63fee`; merged into `main` the same evening (below)
Machine: Apple M4, macOS, Chrome 157 (headless, ANGLE Metal)

| Command                                      | Result                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run verify`                             | pass: build, typecheck, declarations audit, doctor, 841 tests             |
| `git diff --check`                           | clean                                                                     |
| `npm run verify:grass`                       | PASS on webgl (701,048 blades; wind, shadowed grass, far cover as before) |
| `GRASS_RENDERER=webgpu npm run verify:grass` | PASS on webgpu                                                            |
| `npm run verify:film-clouds`                 | ok: true, no GL errors                                                    |
| `npm run verify:film-fog`                    | ok: true                                                                  |

## Consumer draw (outside this repository)

`games/zhuda-sky-island`, built with `ZHUDA_ENGINE_ROOT` set to this worktree,
`RENDERER=webgpu` and `RENDERER=webgl`, scenario `tools/scenarios/hero.json`:
no renderer errors and no page errors on either backend. Its `evidence/`
holds the frames: the cloud sea below the island (`c-sea-day.png`,
`hero-day-*.png`), stars and rain after `lightFog.maxDistance` (`hero-night-*`,
`hero-storm-*`), and the light-fog comparison that found the problem
(`p-rain-q0.png` rain shown with no grade, `p-rain-q2.png` gone with the
grade, `p-rain-off=fog.png` back with the light fog off).

## After the merge into `main` (2026-11-16, evening)

Committed on its branch, rebased onto `f21d10e` (water ripples, foliage, light
shafts) without conflicts, and fast-forwarded into `main`. On the merged code:

| Command                                                                                                                     | Result                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                                                                                            | pass, 853 tests                                                                                                                        |
| `npm run lint`, `git diff --check`                                                                                          | clean                                                                                                                                  |
| `npm run format:check`                                                                                                      | failed: `Grass.ts`, `tests/film-scene.test.mjs` and `tests/grass.test.mjs` had never been through Prettier; formatted, no other change |
| `verify:grass`, `verify:film-clouds`, `verify:film-fog`, `verify:film-water`, `verify:shaft-turn`, `verify:foliage` (WebGL) | PASS                                                                                                                                   |
| `verify:shaft-turn` (WebGPU)                                                                                                | PASS                                                                                                                                   |
| `verify:grass` (WebGPU)                                                                                                     | failed twice: the page did not answer within 20 s                                                                                      |

The WebGPU grass page was not stuck. It builds the whole field (701,048
blades) in one long task. The longest time it did not answer, under the same
machine load, was 16.4 s on `f21d10e`, 17.6 s on this branch before the rebase,
and 18.4 to 19.1 s on the merge; every one became ready. Paused in the
debugger it was building patches (`fill`, `_createMesh`) and compiling the
culling compute shader in LayaAir's WASM preprocessor. With the machine's load
average at 46 the merge crossed 20 s.

The check asked for 180 s (`waitFor(..., 180000)`), but the headless harness
(`packages/compiler/chrome-host.mjs`) ignored the time it was given: 150 asks,
each failing at 20 s. It now honours a given time as the whole wait, and one
ask may take what is left (`zhudaWaitFor`, `tests/chrome-wait.test.mjs`);
a wait without a time behaves as before. `verify-live-look`,
`verify-camera-effects` and `verify-procedural-draw` also pass a time and had it
ignored. With that, `GRASS_RENDERER=webgpu npm run verify:grass` passes on the
merge.

Final round on the merge with the harness fix: `npm run verify` 856 of 856;
lint, format and whitespace clean; `verify-camera-effects` and
`verify-live-look` PASS. `verify-procedural-draw` FAILS ("relief-v: expected
the normal-mapped panel and the geometry panel", 1 found of 2), and fails the
same way on `3b63fee`, `777f04c` and `45f8664` (once on `relief-u` instead):
it was broken before this merge and before today's commits, and is left open
(see the progress file).

Not changed: building a large field blocks the page for 16 to 19 s on this
machine before the first frame. That is the fixture building everything at once
(`fill`); a game that grows its field over frames does not see it.

## Not verified

- No phone.
- No draw check in this repository for a cloud layer below the eye or for
  `setBenders` (the consumer's frames are the only drawn evidence); the
  engine's own draw checks were run to show nothing else changed.
- Frame cost of the benders (four more vec4s and four calls a vertex) not measured.
