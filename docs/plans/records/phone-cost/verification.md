# Verification record: phone-cost

Task document: `docs/plans/records/phone-cost/task.md`  
Commit: the commit that adds this file, on top of `994c140`  
Date: 2026-11-14

## Environment

- Phone: vivo V40 (V2348), Android 16, Adreno 720, Chrome 156, WebGL2,
  driven from a Mac (Apple M4) through the phone's Chrome debugging port
  (adb forward) with the pages served through adb reverse.
- Consumer: `films/river-town-prefab` (not a git repository), built for WebGL
  against this engine. Method and tools: `films/compare-three/README.md`,
  `tools/phone-probe.mjs`, `tools/phone-profile.mjs`; numbers in
  `films/compare-three/evidence/phone-v40/`.
- Timing: frames drawn back to back with the camera held still, the GPU made
  to finish (a one-pixel read), median of three runs of 30 frames.

## Engine changes and their checks

| Change | Commit | Checks |
| --- | --- | --- |
| Lighter versions of a model, pictures made smaller | `c3528b9`, `e12d075` | `tests/model-lod.test.mjs`; record `model-simplify` |
| A model that casts no shadow; models cut into squares | `167f544` | `tests/prefab-models.test.mjs`, `tests/model-lod.test.mjs` |
| One-pass edge smoothing (`antialias: 'fxaa'`), used at quality level 1 | `3cfd15c` | `npm run verify:camera-effects` on WebGL and WebGPU: 3954 of 144 000 pixels changed along a slanted edge, stripes keep 89 % and 95 % of their contrast, off again gives the same frame |
| A reach for level-of-detail distances; a model's meshes culled one by one | `994c140` | `tests/prefab-models.test.mjs` |

`npm run verify` 528 of 528 after the last of them; lint, format and
whitespace checks pass.

## On the phone

The game's own settings, as shipped, portrait (medium 617 by 1200, low 411 by
800), milliseconds a frame:

| View | Medium at the start | Lighter trees | Town in squares, paving casts no shadow | Reach 0.5, town culled with distance |
| --- | --- | --- | --- | --- |
| road | 33.7 | 27.6 | 21.3 | 18.4 |
| gate | 29.5 | 24.8 | 19.9 | 17.9 |
| town | 24.9 | 17.8 | 12.2 | 13.0 |
| wide | 41.5 | 28.2 | 25.3 | 18.9 |

Low setting: 36.0, 27.9, 22.8, 43.1 at the start; 14.1, 11.8, 9.3, 17.6 at
the end.

**What these settings draw on this phone.** The game's quality governor
lowers the look's level while frames run over 16.7 ms. Read on the phone
over 24 s of play: medium settles at level 0 (sequence 0 1 0 0 0 0), high
at level 0 (2 0 0 0 0 0), low starts there. Level 0 has no HDR chain, one
shadow split of 1024 and no light fog. The table above is therefore the cost
of the lowest look level, at both ends: the improvements are real, but they
do not show what a higher level costs on this phone.

The look at fixed levels, medium setting, full game: level 2 59.4, 57.4,
40.2, 64.1 ms; level 1 (one-pass smoothing, no beams) 37.9, 36.2, 24.0,
37.5 ms; level 0 21.1, 19.2, 11.8, 23.2 ms. At level 2, switching off one
effect at a time (road, town): shadows 6.7, 3.5 ms; multisampling 7.2, 8.6;
light fog 3.4, 4.2; bloom 1.2, 2.3; ambient occlusion none measurable; all of
them 21.3, 16.8. The river's water 6.8, 6.1 ms; clouds 1.6, 3.2; grass none
measurable.

## Limits and what is not verified

- One phone. No iPhone, no other Android GPU, no WebGPU on a phone.
- 60 frames a second is reached at look level 0 in two of four views on the
  medium setting and in three of four on the low one. A higher look level on
  this phone needs the HDR chain itself to be cheaper: not done. Drawing the
  3D picture smaller came later (`records/frame-cost`, measured on this
  phone): at 0.67 level 2 falls from 39..51 ms to 28..38, level 1 from
  24..38 to 18..28; the game does not use it yet.
- Light fog at a lower resolution: not done.
- The pictures at the phone's settings were looked at only as screenshots of
  the measurement runs; no art judgement.
