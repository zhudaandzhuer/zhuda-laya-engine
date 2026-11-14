# Verification record: lighting-depth

Task document: `docs/plans/records/lighting-depth/task.md`\
Commit: the commit that adds this file, on top of `ea8dd19`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Chrome, `ANGLE (Qualcomm, Adreno (TM) 720, OpenGL ES 3.2)`, WebGL, the page
  served from this machine over `adb reverse`.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `ea8dd19`; no consumer.
- DPR, viewport and network mode: DPR 1, 480 by 300, loopback on the
  desktop; on the phone the check's page at 480 by 300 and its timing page
  at the window's size (a picture of 823 by 1749).
- Evidence (outside the repository): `batch2-evidence/lighting-depth/` in
  the session's notes folder: the two desktop reports and their pictures,
  the phone's report, pictures and three timing runs, and the sweep's logs.

## Checks

| Check                                     | Exact command or procedure                                                                             | Result                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                                       | PASS, 703 of 703 (10 in `tests/lighting-depth.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`                                             | PASS                                                     |
| Lighting depth, WebGL                     | `npm run verify:lighting-depth`                                                                        | PASS                                                     |
| Lighting depth, WebGPU                    | `LIGHTING_RENDERER=webgpu npm run verify:lighting-depth`                                               | PASS                                                     |
| The check's page on the phone             | `live.html` in Chrome on the V40, the report read over the debugging port                              | Finished without an error; the desktop's results         |
| Lamps in a film scene                     | `npm run verify:film-look` (a spot's penumbra, falloff by the square, the higher limit of `intensity`) | PASS on both backends                                    |
| The older draws, WebGL                    | the 39 film, look, effect and model draws, and the nine that run on one backend                        | PASS, 48 of 48                                           |
| The older draws, WebGPU                   | the same 39 with the WebGPU switch                                                                     | PASS, 39 of 39                                           |

The 39 are the 38 of `records/post-quality/verification.md` and
lighting-depth itself.

## What is drawn

Nothing is checked in. White floors, walls, kerbs and blocks are lit by
lamps and a sun the check places, under a chain without a tone curve, so a
pixel is the light itself. Where the arithmetic is known (the two falloffs,
a spot's cone) the picture is compared with it as shares, so that what the
surface does to the light cancels.

## Results

The same on WebGL, on WebGPU and on the phone unless given.

- **Falloff.** Light under a lamp of range 10 at 0.5, 1, 2, 4, 7, 9.5 and
  10.5 units, as shares of the light at one unit. LayaAir's: 1.167, 1,
  0.623, 0.249, 0.096, 0.020, 0 (its arithmetic: 1.176, 1, 0.625, 0.250,
  0.094, 0.021, 0). By the square: 3.896, 1, 0.248, 0.059, 0.012, 0, 0
  (4.001, 1, 0.249, 0.059, 0.012, 0, 0); read at two exposures, which agree
  at two units (0.247 and 0.249). A white floor one unit under a lamp of 1
  reads 0.996 with the square and 0.798 with LayaAir's. A scene without a
  `ZhudaLightingDepth`, one with it that asks for nothing, one set back and
  one after it is gone draw the same picture.
- **A spot's penumbra.** A cone of 60°, the light at 8, 15, 22, 27 and 29°
  as a share of a hard-rimmed cone's: penumbra 1: 0.986, 0.837, 0.446,
  0.097, 0.015 (the arithmetic: 0.985, 0.839, 0.435, 0.091, 0.012); 0.5:
  1, 1, 0.675, 0.166, 0.027 (1, 1, 0.665, 0.156, 0.021); 0.25: 1, 1, 1,
  0.419, 0.075 (1, 1, 1, 0.398, 0.060). Dark outside the cone at every
  value. A light without a penumbra draws as LayaAir's own, which is a
  half, and again after its penumbra is taken away. Two spots keep their
  own (0.82 of the middle at 22° for the hard one, 0.37 for the soft one
  beside it).
- **Spread.** The soft edge of a wall's shadow, from a tenth to nine tenths
  of the way from dark to lit: 7 pixels at 1, 15 at 2, 26 at 3.5, 7 again
  at 1. Looked at enlarged: a ramp with a fine grain, no steps.
- **Cascades.** Beside a wall 70 units long with two cascades over 24
  units, the shadow's darkness by distance: without the blend 1 up to 31
  units, 0.971 at 32, 0.675 at 33, 0 at 34; with it 0.982 at 31, 0.625 at
  32, 0.168 at 33, 0 at 34, the same as without it up to 30, never darker.
  Off again, the picture is the first one bit for bit.
- **Contact shadows.** A kerb 0.12 high, 4 units beyond the shadow map's
  distance, the sun 45° up; the ground at 0.06, 0.1, 0.16, 0.3 and 0.6 from
  it, lit ground 0.494: without them 0.494 everywhere; with a reach of 0.3:
  0, 0.083, 0.494, 0.494, 0.494; in a flat view 0, 0.044, then lit; with a
  reach of 0.1: 0.202, then lit; without an HDR chain the same pattern (0,
  0.119, then lit at 0.708). Flat ground far from anything reads the same
  with and without them. The camera's depth setting is as it was once the
  owner is gone.
- **Schedule.** Two lamps, one a frame: the first frame draws lamp 0, the
  second lamp 1, the third nothing. Both blocks move and the game names the
  first lamp: one draw, the first lamp's shadow is at the block's new place
  (0.05 of the open ground's light) and gone from the old one (0.89), the
  second lamp's is still at the old place. Named for all: two frames, both
  followed. A lamp moved by 1 unit is drawn again; a lamp taken away is
  not.
- **A game's look.** `shadows.contact`, `spread`, `blend` and
  `lightFalloff` set in a running `ZhudaSceneLook` (`'updated'`): the kerb
  shades the ground (0 for 0.494), a lamp's light at two units is 0.26 of
  its light at one (0.64 before). Quality level 1: no contact shadow, the
  lamp the same; level 3 again: back. The look set back: as at first.
- **A film scene.** The share of the picture at least half as bright as its
  middle under a spot of 60°: 0.0601 as LayaAir's own and with
  `penumbra: 0.5`, 0.0852 with 0.02, 0.0518 with 1. A lamp's light at two
  metres against one: 0.617 without, 0.242 with `lightFalloff: 'physical'`.
  An `intensity` of 60 is accepted with it and refused without.
- **Nothing left behind**, and no shader or GPU message, on either backend.

## On the phone

The same page finished without an error, with nothing left behind, and
with the desktop's numbers: the falloffs within 0.005 of the desktop's
shares (0.5 units by the square 3.922 for 3.896), the penumbra within
0.002, the spread 7, 15 and 26 pixels, the contact shadows 0, 0.083, lit,
the schedule the same; in the look a lamp's light at two units is 0.25 of
its light at one (0.26 on the desktop). A white floor one unit under a lamp
of 1 reads 0.990.

Median of 60 frames each drawn to the end, a picture of 823 by 1749, 36
balls and a floor under a soft-shadowed sun (2048, two cascades) and four
lamps, graded, three runs:

| Scene                                   | ms a frame       |
| --------------------------------------- | ---------------- |
| no `ZhudaLightingDepth`, measured first | 32.7, 31.3, 31.2 |
| one that asks for nothing               | 29.4, 29.0, 28.8 |
| `falloff: 'physical'`                   | 29.0, 28.4, 28.8 |
| `shadowSpread: 2`                       | 30.0, 28.3, 29.9 |
| `cascadeBlend`                          | 29.2, 28.4, 29.7 |
| `contactShadows: 0.3`                   | 31.6, 31.8, 32.3 |
| all four                                | 41.6, 38.5, 38.9 |
| no `ZhudaLightingDepth`, measured last  | 28.7, 28.9, 28.4 |

The first case of a run reads about 3 ms high. Contact shadows are about
3 ms; the falloff, the spread at 2 and the blend are inside the spread of
the runs. All four together are about 10 ms.

## Found on the way

- A shadow edge widened by laying LayaAir's nine-read filter out for a
  coarser map shows steps (four bands at 3.5). Dropped for sixteen reads on
  a turned disc.
- LayaAir changes the vector of its shadow strengths in place and puts the
  same object back. On WebGPU that uploads nothing: with the vector made
  before the first shadow pass, the sun's shadows had no strength at all
  (the film-look check failed on WebGPU until this was found). A scene
  with a `ZhudaLightingDepth` hands LayaAir a copy.
- `flat` is a word GLSL keeps for itself; a shader that used it as a name
  failed to compile, and LayaAir skipped the pass.
- The helper the older checks read a patch of pixels with takes the nearest
  pixel number, which is half a pixel off on average. Here a pixel is read
  as the one the point falls in.
- The first sweep of the older draws failed in `verify-render-scale` on
  both backends: a look disposed after its scene was destroyed threw,
  because LayaAir had taken the scene's values away. A
  `ZhudaLightingDepth` whose scene went first now changes nothing there,
  leaves a camera that is still there as it was, and goes quietly
  (unit-tested). The sweep's result above is with that fix.

## Unverified limits

- One desktop GPU and one phone. WebGPU on a phone and iPhone are not
  measured.
- Why all four together cost more on the phone than the parts add up to.
- Contact shadows were measured on one kerb. They see only what the depth
  picture holds; a thing thicker than half the reach is taken for thin;
  their eight steps are a grain at the shadow's end that nothing smooths.
- The blend was measured at the shadow's end. Between two cascades it was
  looked at, not measured.
- The spread above 1 is a grain; with an HDR chain nothing smooths it but
  the picture's own edge smoothing.
- The falloff by the square was not tried on a consumer's scene: every lamp
  there needs another number.
- A spot's penumbra follows the light through LayaAir's reordering of its
  lights (unit-tested); with LayaAir's single-light mode (`_multiLighting`
  off) it is LayaAir's own half.
- No game was rebuilt with the changed includes. The change to
  `Camera.glsl` (the depth picture read at high precision by every shader)
  was drawn by the sweep on the desktop only.
