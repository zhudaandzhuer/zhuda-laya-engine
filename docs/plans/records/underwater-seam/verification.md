# Verification record: underwater-underside-seam

Task document: [task](task.md)\
Commit: the one that carries this record, on `dcd667f`\
Date: 2026-11-21

## Environment

- macOS (Darwin 27.2), Apple M4. Chrome 157 headless. WebGL: `ANGLE (Apple,
  ANGLE Metal Renderer: Apple M4)`; WebGPU: adapter `apple`, `metal-3`.
  Node 26.13.1.
- The engine before the change: a clone at `87ab247` (its `Underwater.ts` is
  that of `dcd667f`).
- The consumer: `films/pelagic-grove`, built for WebGPU against this
  checkout into a folder of its own (`dist/webgpu-engine-fix`); its own
  `dist/webgpu` and its sources were not touched.
- Pictures (outside this repository):
  `ZhudaGameCenter/audits/underwater-seam-2026-11-21/`.

## Checks

| Check                                     | Exact command or procedure                                                                                             | Result                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Verify, lint, format, whitespace          | `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`                                           | PASS, 951 tests                                                                                |
| Unit                                      | `node --test tests/underwater.test.mjs`                                                                                | PASS, 8 of 8                                                                                   |
| The underwater draw check, WebGL          | `npm run verify:film-underwater`                                                                                       | PASS                                                                                           |
| The same, WebGPU                          | `ZHUDA_FILM_RENDERER=webgpu npm run verify:film-underwater`                                                            | PASS                                                                                           |
| The new steps against the engine before   | the changed `scripts/verify-film-underwater.mjs` run in the clone at `87ab247`, WebGL and WebGPU                       | FAIL on both, as it should: "clear water is one colour down to the horizon with maxDistance 150 (at the horizon 28,100.2,121.9, above it 6,61,76.6)" |
| Neighbouring draw checks, WebGL           | `verify:film`, `verify:film-look`, `verify:film-water`, `verify:film-fog`, `verify:film-clouds`, `verify:film-remount`, `verify:live-look` | PASS, seven of seven                                                                           |
| Film checks, WebGPU                       | `npm run verify:film-webgpu`                                                                                           | PASS, 25 verifications                                                                         |
| Fly-through, WebGL                        | `npm run verify:flythrough -- tests/fixtures/flythrough/underwater.json`                                               | PASS; GPU average 6.89 ms, p99 9.49 (6.76 to 6.85 and 10.4 to 10.9 in `docs/routes/underwater.md`): no cost that shows |

## The line, before and after

`verify:film-underwater`'s new steps, 480 by 270, the eye 4 m under the
surface looking a little above level, extinction (0.02, 0.014, 0.012):

| What                                                         | Before (`87ab247`), WebGL and WebGPU | After, WebGL and WebGPU |
| ------------------------------------------------------------ | ------------------------------------ | ----------------------- |
| Mean colour over the floor's far end, `maxDistance` 150      | 28, 100.2, 121.9                     | 6, 59, 74.3             |
| The same, `maxDistance` 170                                  | 17.9, 88.9, 110.5                    | 6, 59, 74.3             |
| Open water above it                                          | 6, 61, 76.6                          | 6, 61, 76.6             |
| Bright water: pixels that differ between a plane of 170 m and of 600 m | 3,940 of 71,040             | 3 of 71,040             |

The window and the surface looking up (the document's fourth check): the
frame `look-up` is byte for byte the one before, on WebGL. So are the frames
above the surface. The main view differs in 193 pixels of 129,600 and the
floor view with caustics in 278, all in the one or two rows where the floor's
far edge meets open water (an edge pixel was 0,70,109 and is 0,75,117); the
floor view without caustics differs as little (504 channel values) and its
pixels were not counted.

## In the consumer

`station=5`, `tier=game`, WebGPU, 960 by 540, the light fog off, green
channel down a column at x = 230 from row 422 every third row:

| Build and settings                              | Values                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Engine before, `md=170&far=1300`                | row means 51, 49, 49, 52, 56, 56, 56: the step up at the plane's edge |
| After, `md=170&far=1300`                        | 62 60 58 55 52 51 49 48 47 46 45 44 43 42 42 41                    |
| After, `md=600&far=1300`                        | the same within 1                                                  |
| After, `md=170` and the camera's own far of 170 | the same within 1                                                  |
| After, as shipped (fog on, far 170)             | 82 79 76 72 67 64 61 58 55 52 49 47 46 44 43 42: no step           |

Before the backdrop, with the surface worked out in the post effect, the same
column read 52 then 44 across the plane's edge where `md=600` read 52, 51,
50: the consumer's additive beams were replaced with the background.

## Lifecycle

`dispose()` destroys the backdrop's node, mesh and shader material beside the
plane's. `verify:film-remount` (a scene mounted again draws the same and
leaves no WebGL error) passes; no count of GPU objects across mounts of an
underwater scene was taken for this change.

## Second round: a step at the horizon (2026-11-21)

The consumer built against `7cdf0a7` and drew frame 1380 of its film (the
eye in mid-water, open water below the horizon, light fog on): the old line
was gone and a new one stood at the horizon, a band above it darker than
the water below (its `ENGINE-TASK-underwater-seam.md`, section 複驗). The
first round's checks never crossed the horizon over open water: the
engine's floor reached past it, and the consumer's station 5 did not look
there.

Cause, reproduced in the engine: with the surface drawn, a view above the
horizon with nothing in the way was counted through all the water up to the
surface (endless near level), and one below it through `maxDistance`. The
water's own colour is the same either way, but the light fog's light, which
the medium dims by the length it counts, was taken away above the horizon
and kept below it.

Change (`packages/core/runtime3d/Underwater.ts`): the medium counts
`maxDistance` wherever nothing is drawn (the far plane's depth, or within
six hundredths of it, where the backdrop is), on both sides of the horizon,
and never more than the way to the surface. The backdrop above level is the
surface seen through the water that lies beyond that `maxDistance`, so it
runs into the water's own colour toward the horizon.

| Check                                                                                         | Before (`7cdf0a7`)            | After                         |
| --------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| `verify:film-underwater`, new case: open clear water, light fog, eye 27 m deep, largest step between two rows of a column (of 255) | 20.68: the check fails | 1.53 on WebGL, 1.53 on WebGPU |
| The same: darkest row above the horizon against the water below                                | (not reached)                 | 58.2 against 58.4             |
| Consumer, frame 1380, 1920 by 1080, x = 1700, green at rows 452, 476, 500, 524, 548, 554, 560, 584, WebGPU | 69 56 48 45 44 65 66 66 | 69 66 66 66 66 66 66 66       |
| The same, WebGL                                                                                | 67 56 48 45 44 65 66 66       | 67 65 65 65 66 66 66 66       |
| Consumer, largest step between two rows of that column, rows 380 to 700 (mean of RGB)          | 11.7 (WebGPU), 12.0 (WebGL)   | 1.0, 1.0                      |

The other cases of `verify:film-underwater` read as before (the window, the
level view over the floor, bright water with the plane at 170 m and 600 m:
7 of 71,040 pixels differ, as in the first round).

Not looked at in this round: with the eye a few metres under the surface and
a strong light fog, the fog's light changes fast just above the horizon (the
way to the surface shortens quickly there). It is a steep gradient, not a
step (9.5 of 255 a row at 270 rows with the eye 4 m down in the fixture's
fog); whether it reads as a line in a real scene was not judged. The medium
dims the fog's light by the whole length it counts, though that light is
made within the fog's own reach: a model's limit, not changed here.

Run for this round, on the Apple M4: `npm run verify` (963 tests),
`npm run lint`, `npm run format:check`, `git diff --check`,
`node --test tests/underwater.test.mjs`; on WebGL `verify:film-underwater`,
`verify:film-fog`, `verify:film-look`, `verify:film-water`, `verify:film`;
`npm run verify:film-webgpu` (33 checks). All pass. No phone.

The consumer's own `dist/webgpu` and `dist/webgl` were not touched; it was
built into `dist/webgpu-engine-fix` and `dist/webgl-engine-fix`, and the two
frames are in its `evidence/engine-fix2-webgpu/` and `engine-fix2-webgl/`.

## Limits and decision

- One desktop GPU. No phone, no Windows.
- A camera whose far plane is left to `update`'s caller and never told
  (neither the film stage nor `ZhudaSceneLook`) is read from the effect a frame
  late: the first frame under water uses 4000 m. Not drawn in a check.
- The backdrop hides what stands in the last twentieth of the camera's
  range; no check draws a thing there.
- Clouds (`look.clouds`) with the eye under water were not looked at: the
  backdrop, like the plane, is not in the depth picture clouds read.
- The consumer's film was not shot again; four stills of one station were.
- The consumer's builds read this checkout: until it is committed and they
  build again on purpose, theirs carry whatever is in this working tree.

Decision: **Implemented within scope**; device runs keep it from Accepted.
