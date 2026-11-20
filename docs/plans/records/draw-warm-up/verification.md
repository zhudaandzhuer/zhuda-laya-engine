# Verification record: a scene drawn once before it is shown

Task document: `docs/plans/records/draw-warm-up/task.md`\
Commit: the commit that adds this file; base `025dc21`\
Date: 2026-11-20

## Environment

- macOS, Apple M4, headless Chrome (`packages/compiler/chrome-host.mjs`).
  WebGPU: adapter apple / metal-3. WebGL: ANGLE Metal Renderer, Apple M4.
- vivo V40 (V2348), Android Chrome, WebGPU, through wireless debugging and
  `adb reverse`; the consumer `zhuda-spacetime-3d` at its `low` setting,
  880×297 CSS px, DPR 2.625.
- Node v26.13.1.

## Checks

| Check                                     | Command                                                 | Result         | Artifact                                            |
| ----------------------------------------- | ------------------------------------------------------- | -------------- | --------------------------------------------------- |
| Unit (LayaAir stand-in)                   | `node --test tests/draw-warm-up.test.mjs`               | 6 of 6 PASS    | console                                             |
| Real draw, WebGL                          | `npm run verify:shader-warm-up`                         | PASS           | `$TMPDIR/zhuda-shader-warm-up/evidence/report.json` |
| Real draw, WebGPU                         | `WARM_UP_RENDERER=webgpu npm run verify:shader-warm-up` | PASS           | same                                                |
| Build, types, declarations, Doctor, tests | `npm run verify`                                        | see the commit | console                                             |

### `verify:shader-warm-up`, first frame of the fixture scene

|                                           | WebGL                       | WebGPU                       |
| ----------------------------------------- | --------------------------- | ---------------------------- |
| cold                                      | 306.1 ms, 27 compiled       | 1252.2 ms, 27 compiled       |
| `zhudaWarmUpShaders` (list)               | 30.1 ms, 0 compiled         | 152.9 ms, 0 compiled         |
| `zhudaWarmUpByDrawing` (3 eyes, 15 views) | 7.0 ms, 0 compiled          | 31.6 ms, 0 compiled          |
| the warm-up itself                        | 318 ms, longest view 149 ms | 1191 ms, longest view 814 ms |

The picture after it equals the cold one (mean and worst cell difference 0);
the camera is back at `[0, 2.2, 7]` with its 50° field of view. Changes of
the look's level after it still compile (1 and 4 variants), as expected: no
view drew those levels; a recorded list covers them.

### Consumer prototype on the V40 (not this commit's code)

The consumer drew 30 views (6 eyes along its opening walk) with the same
method in its own code, the water mirror drawn in each view, then ran from
the landing into the town right after loading:

| Right after loading, running | no warm-up        | warm-up                                        |
| ---------------------------- | ----------------- | ---------------------------------------------- |
| longest frames               | 2582, 570, 553 ms | 151 ms                                         |
| worst second                 | 5 FPS             | 43 FPS                                         |
| warm-up cost                 | –                 | about 3.2 s of loading, longest view about 2 s |

Without the water mirror in the views a 469 ms frame stayed near the gate
(a shader compile inside the mirror's draw); with it, 134 ms.

Not explained: for about 20 s after loading the same run holds about 50 FPS
(alternate frames late) and then 60; after a 30 s wait it is 60 from the
start. Four warm-up rounds (120 views, 8.5 s more loading) and the governor
turned off did not change it. A profile shows LayaAir's `compareCahceFlag`
at 7 % self time only in that period.

## Limits

- Desktop GPU only for the engine's own check; the phone numbers are the
  consumer's prototype, before this API existed. The consumer's switch to
  this API is measured in the consumer's records.
- No iPhone run.
