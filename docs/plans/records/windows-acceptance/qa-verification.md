# Verification record: windows-acceptance QA-01..04

Task document: `docs/plans/records/windows-acceptance/qa-task.md`\
Commits: `28b744a` (GPU time by stretches of passes, QA-03), `2133c3c`
(render-scale strips and patches, QA-02), `5306416` (where pictures
differ, QA-01 and QA-02), `d57c0cf` (light scene by its mean, QA-03),
`c4c0409` (film-water's baseline frame, QA-01)\
Date: 2026-11-17

All Windows runs: the report's host, signed-in desktop session, Intel UHD
770, Chrome's default adapter.

## QA-02 render-scale: a counting accident

The one "uncovered" pixel on rung 2 was at (356, 102), colour 8,7,7: a dark
pixel of the scene within 8 of the bare canvas's 0,0,0 (opaque black on
WebGPU), not canvas the scaled view failed to reach. Canvas a view does not
reach is a strip or a patch, so a bare-coloured pixel now counts only with
at least two of its four neighbours bare too (a one-pixel strip along an
edge still counts), and each rung keeps the first twelve bare pixels with
place and colour.

| Run                                                     | Result                                   |
| ------------------------------------------------------- | ---------------------------------------- |
| Windows Intel WebGPU, before                            | FAIL: rung 2 `uncovered=1` at (356, 102) |
| Windows Intel WebGPU, after                             | PASS: every rung 0                       |
| Negative control (a quarter view), both backends, macOS | still counts all 138 000 bare pixels     |
| macOS WebGL and WebGPU                                  | PASS                                     |

## QA-03 GPU time 0 ms: a rounding accident, then a measurement rule

Chrome rounds WebGPU timestamps to 0.1 ms. A light frame's passes each
began and ended within one step, so the profiler's sum of pass lengths was
0 while the steps fell between passes. `zhudaPassesBusyNs` joins passes
that follow each other within one step into one stretch and sums the
stretches (idle time between stretches is still not counted). A light frame
shorter than one step still reads 0 or 0.1, so the check now requires the
light scene's mean over 40 frames above 0 (its median below 20 ms), and the
heavy scene 0.5 ms above the light one by the medians.

| Run                                            | Light median / mean                                                            | Heavy median | Result        |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ------------ | ------------- |
| Windows Intel WebGPU, before                   | 0 / —                                                                          | positive     | FAIL (`0 ms`) |
| Windows Intel WebGPU, after                    | 0 / 0.031 ms (40 frames)                                                       | 36.37 ms     | PASS          |
| Unit test (`tests/developer-tooling.test.mjs`) | a quantized light frame: old sum 0, now 0.2 ms; 3 + 1.5 ms idle case unchanged |              | PASS          |

## QA-04 CDP timeout: not reproduced

The report's single `Runtime.evaluate` timeout passed on its own rerun.
With the shared launcher of WIN-04 (`packages/compiler/browser-process.mjs`),
`verify:instanced-mesh` WebGL (twice) and `verify:physical-surfaces` WebGPU
pass on the host's desktop session with no timeout. Nothing changed for it.

## QA-01 film-water: the session's first frames, not the mounts

With `5306416` the check says where it differs: one pixel, (294, 218),
blue −1, `water.png` (the run's first wet frame) against `water-again.png`
(after thirty mounts). Probing that pixel at every wet frame of a run, one
browser session per run (Intel WebGL, ANGLE Direct3D 11, commit `b98ec03`):

| Session (runs)        | First                      | Second | After a dry frame | Before the mounts | After 30 mounts |
| --------------------- | -------------------------- | ------ | ----------------- | ----------------- | --------------- |
| probe 1, 4            | 38                         | 38     | 38                | 38                | 38              |
| probe 2               | 39                         | 39     | 38                | 38                | 38              |
| probe 3               | 39                         | 38     | 38                | 38                | 38              |
| unmodified check 1    | 38                         | —      | —                 | —                 | 38 (PASS)       |
| unmodified check 2, 3 | 39                         | —      | —                 | —                 | 38 (FAIL)       |
| exploration 1, 2      | equal to every later frame |        |                   |                   | PASS            |

In 4 of 9 sessions the first one or two frames were 1/255 off and then
settled; the frame after the thirty mounts equalled the settled frame in
all nine. The mounts leave nothing behind. macOS (both backends) never
showed it. The check now compares the frame after the mounts with the
one drawn just before them, still byte for byte, and keeps the first
frame's difference in the report (`firstFrame`). Why the first frames
of a session differ on Direct3D 11 was not found (the scene has a black
sky and no environment bake).

| `verify:film-water` at `c4c0409` | Result                                                                     |
| -------------------------------- | -------------------------------------------------------------------------- |
| Windows Intel WebGL, 4 runs      | 4 PASS; `remount` 0 pixels each; `firstFrame` (294, 218) blue −1 in 3 of 4 |
| macOS WebGL and WebGPU           | PASS; `firstFrame` 0, `remount` 0                                          |

## Other checks

| Check                    | Result |
| ------------------------ | ------ |
| `npm run verify` (macOS) | PASS   |

Decision: **Implemented within scope** for QA-01 (as a measurement of
the mounts; the cold-session variance recorded, not fixed), QA-02 and
QA-03; QA-04 **not reproduced**.
