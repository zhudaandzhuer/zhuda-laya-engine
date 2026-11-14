# Verification record: post-quality

Task document: `docs/plans/records/post-quality/task.md`\
Commit: the commit that adds this file, on top of `3bade30`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Chrome, `ANGLE (Qualcomm, Adreno (TM) 720, OpenGL ES 3.2)`, WebGL, the page
  served from this machine over `adb reverse`.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `3bade30`; no consumer.
- DPR, viewport and network mode: DPR 1, 480 by 300, loopback on the
  desktop; on the phone the check's page at 480 by 300 and its timing page
  at the window's size (a picture of 823 by 1749).
- Evidence (outside the repository): `batch2-evidence/post-quality/` in the
  session's notes folder: the two desktop reports and their pictures, the
  phone's report, its pictures and its three timing runs, and the sweep's
  logs.

## Checks

| Check                                     | Exact command or procedure                                                                   | Result                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                             | PASS, 693 of 693 (12 in `tests/post-quality.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`                                   | PASS                                                   |
| Post quality, WebGL                       | `npm run verify:post-quality`                                                                | PASS                                                   |
| Post quality, WebGPU                      | `POST_RENDERER=webgpu npm run verify:post-quality`                                           | PASS                                                   |
| The check's page on the phone             | `live.html` in Chrome on the V40, the report read over the debugging port                    | Finished without an error; see Results                 |
| A colour table loaded with a film scene   | `npm run verify:film-model` (section 4d)                                                     | PASS on both backends                                  |
| The older draws, WebGL                    | the 38 film, look, effect and model draws listed below, and the nine that run on one backend | PASS, 47 of 47                                         |
| The older draws, WebGPU                   | the same 38 with the WebGPU switch                                                           | PASS, 38 of 38                                         |

The 38: post-quality, film-scene, film-look, film-model, film-reflector,
film-fog, film-animation, film-environment, film-water, film-remount,
quality-route, film-highlights, film-reflections, film-variation,
film-point-shadow, film-shapes, film-colours, film-bounce, film-decals,
film-clouds, film-finishes, prefab-models, live-look, camera-effects, grass,
geometry, gltf-intake, physical-surfaces, shadow-updates, render-scale,
shader-warm-up, basis-textures, hdr-environment, stylized-shading,
instanced-mesh, animation-control, specular-aa, procedural-draw. The nine:
webgpu, film-webgpu, webgpu-consumer, cinematic, crowd, model-showcase,
next-round, minigame, slot-foundation.

`verify:minigame` first stopped at once: `/tmp/zhuda-minigame-acceptance`
held a consumer made on 10 November for engine 1.15.0, and the check
requires the consumer to pin the engine it is run from. With
`MINIGAME_OUT` set to an empty folder it passed. Nothing of this change is
in that failure.

After the sweep one line of validation changed in `Filmic.ts` (an occlusion
strength above 4 is refused before anything is made); the gates and the
post-quality, film-look, live-look and camera-effects draws were run again
on both backends afterwards.

## What is drawn

Nothing is checked in. Pictures of known light are put through the display
part of a chain (`linearChain`), so the screen can be compared with the same
arithmetic on the CPU: a chart of 21 patches, hard-edged half-planes at six
angles with the true coverage of every pixel worked out beside them, flat
colour, a ramp, grain and a box. A floor, a wall, a ball and a post in plain
white under a white sky show the occlusion itself. The colour table is
written by the check as a grading tool writes a `.cube` file
(`tests/helpers/cube-fixture.mjs`). The flare is drawn on black with its
light placed by direction; a square that gives off light is the bloom's
source, and its dirt picture is made by the check.

## Results

The same on WebGL and on WebGPU unless given. What the phone gave is in its
own section.

- **Curves.** With AgX, the neutral curve and none, what the screen shows
  for each of the 21 patches (greys from black to 32 times white, dim and
  bright colours, one colour beyond the grade's table) is within 0.6 of 255
  of the curve's arithmetic, also at 2.5 times the exposure. Black is 0
  with every curve. A red four times white: ACES draws it `[255,179,158]`
  (toward orange), AgX `[253,187,179]`, neutral `[253,161,161]`. The curve
  changed while the chain runs, through all four and back to ACES, gives
  each curve's own picture exactly; so does a chain put together again for
  a capture.
- **White balance; lift, gamma, gain.** Greys turn warm (red over green
  over blue), cool, magenta and green as named, and come back exactly.
  `(colour * gain + lift) ^ gamma` is what the screen shows, within 0.5.
- **Colour table.** A table of 17 read from `.cube` text: ten colours within
  0.7 of the table's own lookup on the CPU; half strength within 0.8;
  tables of 2, 33 and 65 that change nothing change nothing (within 1.2,
  the chain's own rounding); a table that changes red, green and blue round
  does exactly that; a table over a quarter to three quarters takes the
  edge outside; another table set in place takes over.
- **Edge smoothing.** Mean distance from the true coverage, over the pixels
  an edge crosses and their neighbours (share of white):

  | Edge at      | 4°    | 12°   | 27°   | 45°   | 63°   | 83°   |
  | ------------ | ----- | ----- | ----- | ----- | ----- | ----- |
  | not smoothed | 0.085 | 0.083 | 0.082 | 0.063 | 0.082 | 0.084 |
  | FXAA         | 0.034 | 0.098 | 0.106 | 0.032 | 0.106 | 0.045 |
  | SMAA `high`  | 0.010 | 0.017 | 0.037 | 0.012 | 0.038 | 0.011 |

  A dim edge 0.006 against 0.025 unsmoothed, a coloured one 0.010 against
  0.042. `low` is twice as far off as the others at 4° (0.019). Flat
  colour, a ramp and faint grain: no pixel changed by SMAA at any quality;
  FXAA changed 56 591 pixels of the grain. A white box: 8 pixels changed by
  up to 2 of 255; with the reference's corner rounding 256 by up to 15,
  with full rounding 256 by up to 66. The quality set in place is the
  quality built with.

- **Occlusion by horizons.** Light left on the floor at 0.04, 0.1, 0.2,
  0.3, 0.45, 0.7, 1 and 1.6 from the wall, radius 0.5: 0.735, 0.872,
  0.968, 0.991, 1, 1, 1, 1; on the wall above the crease 0.687, 0.830,
  0.946, 0.985, 0.991, 1, 1, 1. Open floor, open wall and sky 0.991 to 1
  (one step of 255). At half size the floor reads 0.757, 0.833, 0.951,
  0.983, 1, 1, 1, 1. In a flat (orthographic) view 0.769 at the crease, 1
  beyond the radius. Strength 2 gives the square (0.544 for 0.735); a
  radius of 1 reaches 0.45 from the wall (0.974). Nothing is left of the
  dither along a row of the floor (standard deviation 0). LayaAir's own at
  0.65: 0.51 to 0.55 on the floor at every distance, 0.84 on the open
  floor, 0.87 on the sky, a standard deviation of 2 along the same row.
- **Lens flare.** A disc, a hexagon, a ghost, a ring and a streak are where
  `zhudaLensFlarePlace` says and as bright as asked (within 1 of 255); a
  ring is empty in its middle, a hexagon reaches its corners and not
  between them, a streak turned a quarter is long up and down. The light's
  colour and the strength multiply. Behind a wall nothing is drawn; with
  the wall's edge through the sun 0.56 of the light is left; a lamp in
  front of the wall flares and one behind it does not; a sun a little
  outside the frame leaves half; behind the camera and with the light put
  out, nothing.
- **Bloom.** A lamp of 13.9 times white: a halo with the threshold under
  it, none with the threshold over it, some with the knee at 1. Stretched
  sideways the halo is 179 beside the lamp and 99 above it; upright 109 and
  205; round 139 and 149. Spread 4 does not reach 14 pixels. A dirt picture
  shaped like the frame lights its spot where the halo falls (255 for 139)
  and nowhere else, and the round spot is 9 pixels across and 9 high.
- **A game's look.** `ZhudaSceneLook` with `toneMapping: 'agx'`,
  `antialias: 'smaa'`, `aoMethod: 'gtao'` and `lut`: the picture is as
  without a table until one is handed over, then the table's colours
  (within 0.5); the curve changes in place (`'updated'`); another way of
  smoothing builds the chain again (`'rebuilt'`) and the table is still on;
  the foot of the wall is darker with occlusion (157 for 167) and the open
  floor the same; looking toward the look's sun the flare adds light,
  away from it none.
- **Nothing left behind.** The count of live resources after the whole
  check equals the count before it; six looks made, drawn and let go leave
  nothing.
- **No shader or GPU message** on either backend.

## On the phone

The same page, 480 by 300, finished without an error or a renderer error,
with nothing left behind. Curves within 0.9 of 255 and exact when changed
in place; lift, gamma and gain within 0.5; the table within 0.9 (1.2 for a
table of 2); edge errors as on the desktop (SMAA 0.012 at 4°, 0.037 at 27°,
FXAA 0.037 and 0.105); occlusion on the floor 0.732, 0.867, 0.968, 0.989,
1, 0.999, 1, 0.997, the open floor and the sky 0.991, at half size 0.754,
0.830, 0.949, 0.983, 0.997 and on; the flare's and the bloom's values as on
the desktop within 1 of 255.

Two things differ. After SMAA 202 of the 144 000 pixels of the faint grain
are 1 of 255 off (none on the desktop; flat colour and the ramp are
untouched on the phone too): one more pass rounds once more there. And
LayaAir's own occlusion reads 0.86 on the open floor and 0.98 on the sky
on the phone, for 0.84 and 0.87 on the desktop.

Median of 60 frames each drawn to the end, a picture of 823 by 1749, 36
balls and a floor under a shadowed sun, three runs:

| Chain                             | ms a frame       |
| --------------------------------- | ---------------- |
| graded, ACES                      | 19.6, 17.4, 16.6 |
| AgX                               | 19.9, 15.0, 16.2 |
| neutral                           | 21.5, 20.5, 19.4 |
| FXAA                              | 19.9, 20.9, 20.5 |
| SMAA `low`                        | 21.8, 22.0, 22.6 |
| SMAA `high`                       | 21.9, 21.9, 21.9 |
| colour table of 33                | 20.8, 19.2, 20.6 |
| occlusion: LayaAir's              | 36.7, 36.9, 37.6 |
| occlusion: by horizons            | 25.7, 25.2, 25.5 |
| occlusion: by horizons, half size | 23.3, 21.5, 23.2 |
| lens flare                        | 20.7, 20.3, 19.9 |

The plain chain varies by 3 ms between the runs. SMAA is 1 to 2 ms over
FXAA. Occlusion by horizons is 11 to 12 ms a frame under LayaAir's.

## Third-party data

`vendor/threejs-post/README.md` records where the SMAA tables and the tone
curve constants come from, with the SHA-256 of the source files and of the
decoded tables; `tests/post-quality.test.mjs` checks the tables in the
bundle against those hashes and the record against the bundle.
`vendor/threejs-post/LICENSE.txt` (SMAA and three.js, both MIT) is in the
browser SDK's `LICENSE.txt` and in a consumer build's notices as
`POST-LICENSE.txt`.

## Unverified limits

- One desktop GPU and one phone. WebGPU on a phone and iPhone are not
  measured.
- The older effects that read depth (light fog, depth of field, screen
  reflections, point shadows, probe volumes, clouds, water, soft particles)
  were drawn again on the desktop after the change to high precision, not
  on the phone.
- The neutral curve reads 2 to 5 ms over AgX in all three phone runs, which
  its arithmetic does not explain; the order of the cases was the same each
  time, so it may be the phone warming. Not looked into.
- SMAA was measured on synthetic edges. On a scene it was looked at, not
  measured, and it has no diagonal patterns: 27° and 63° are its worst.
- Occlusion was measured on white surfaces. In a lit scene it darkens
  direct light too; how strong it should be there is a look's choice.
- The flare does not know about clouds or fog drawn after the scene.
- The default occlusion of a look is still LayaAir's, and the default edge
  smoothing still multisampling: no look in use was changed, and no game
  was rebuilt or rendered with the new parts.
- A colour table larger than 65 is refused for drawing; a `.cube` with a
  one-dimensional table or shaper is refused.
