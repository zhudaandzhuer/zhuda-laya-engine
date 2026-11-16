# Verification record: quality-governor-memory (AG2)

Task document: `docs/plans/records/quality-governor-memory/task.md`\
Commit: the commit that adds this file, on top of `486d60f`\
Date: 2026-11-17

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`, with
  `EXT_disjoint_timer_query_webgl2`. WebGPU: apple / metal-3, not a
  fallback, with `timestamp-query`.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `486d60f`; no consumer.
- DPR, viewport and network mode: DPR 1, 480 by 270, loopback.
- Evidence (outside the repository): `EV` =
  `/Users/yaowei/Documents/ZhudaGameCenter/audits/quality-governor-memory-2026-11-17/`:
  `webgl/` and `webgpu/` (report and a picture of each rung), the two run
  logs, the `npm run verify` log.

## Checks

| Check                                     | Exact command or procedure                                                                                | Result                                                                                                  | Artifact        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                                          | PASS, 885 of 885                                                                                        | `EV/verify.log` |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check`                                                | PASS                                                                                                    | —               |
| Unit tests                                | `node --test tests/quality-governor.test.mjs tests/quality-memory.test.mjs tests/frame-cost.test.mjs`     | PASS: band, CPU rule unchanged, descent order with detail rungs, warm start, storage failures, sentinel | —               |
| Draw, WebGL                               | `npm run verify:quality-governor`                                                                         | PASS                                                                                                    | `EV/webgl/`     |
| Draw, WebGPU                              | `GOVERNOR_RENDERER=webgpu npm run verify:quality-governor`                                                | PASS                                                                                                    | `EV/webgpu/`    |
| Repeatability                             | the final fixture three times on each backend before the last assertion was added, then once each with it | 4 of 4 on each backend; the frame-time twin stepped 7, 6, 5, 4 every time                               | —               |

## What the draw shows (both backends the same unless said)

Ladder `zhudaQualitySteps({ details: [0.7, 0.4] })`, nine rungs. Frames held
to 40 ms by the CPU against 16.7 ms, window 6, CPU rule:

| Rung         | Look level | `Config3D.pixelRatio` | Pillars kept | Red pixels in the middle 30 columns |
| ------------ | ---------- | --------------------- | ------------ | ----------------------------------- |
| `3@1/1`      | 3          | 1                     | 30           | 380 (WebGL), 379 (WebGPU)           |
| `3@0.85/1`   | 3          | 0.85                  | 30           | 379                                 |
| `3@0.85/0.7` | 3          | 0.85                  | 20           | 274                                 |
| `3@0.85/0.4` | 3          | 0.85                  | 12           | 0                                   |
| `3@0.7/0.4`  | 3          | 0.7                   | 12           | 0                                   |
| `2@0.7/0.4`  | 2          | 0.7                   | 12           | 0                                   |
| `1@0.7/0.4`  | 1          | 0.7                   | 12           | 0                                   |
| `0@0.7/0.4`  | 0          | 0.7                   | 12           | 0                                   |
| `0@0.5/0.4`  | 0          | 0.5                   | 12           | 0                                   |

Fast frames walked it back one rung at a time to `3@1/1`, all 30 pillars and
the same pixels (17 008 red, 380 in the middle; WebGPU 17 007, 379).

GPU times (WebGL timer query, WebGPU timestamps), final run:

|                                                 | WebGL                        | WebGPU                   |
| ----------------------------------------------- | ---------------------------- | ------------------------ |
| Frames of 40 with a GPU time                    | 39                           | 40                       |
| Top rung, median                                | 4.67 ms                      | 6.16 ms                  |
| Budget half of that: rungs walked, basis        | down to `0@0.7/0.4`, gpu     | down to `0@0.7/0.4`, gpu |
| 48 frames held to 40 ms, GPU median and max     | 3.48 ms, 7.25 ms             | 6.36 ms, 12.65 ms        |
| Governor on GPU times, budget 1.5 × that median | no change, basis gpu         | no change, basis gpu     |
| The same frames, same budget, frame times only  | 7, 6, 5, 4 (a rung a window) | 7, 6, 5, 4               |

Memory and sentinel in the page's `localStorage`: first start at the top
(8); sentinel set during the build, cleared after the first frame; the kept
level followed the governor (0 at the bottom, 1 at the end) and a new
`ZhudaQualityMemory` started at 1.

## Found while making the check

- Single GPU readings spike: up to 17.7 ms (WebGPU) and 10 ms (WebGL)
  against medians of 6 and 3.4. With a window of 6 frames one spike moved a
  governor out of its band. The check's GPU part uses windows of 12; the
  documentation says to keep the default 30.
- The top rung's GPU median varied between runs (WebGL 1.4 to 4.8 ms, WebGPU
  4.9 to 7.7 ms); a budget taken from one short measurement is not a fixed
  reference. The held-frames part takes its budget from the GPU time
  measured under the same hold.
- With the CPU holding frames to 40 ms, GPU medians were lower on WebGL
  (2.8 to 3.5 against 3.4 to 4.8 ms at the top rung) and about the same on
  WebGPU (5.0 to 6.4 against 4.9 to 7.7 ms). No sign here of a GPU clocking
  down between slow frames; not checked on a phone.

## Lifecycle and failure cases

- Storage that throws on every call, `null` storage, empty, corrupt JSON,
  another version, another ladder length, out-of-range levels: the default
  start (unit tests).
- A load that never ends: the next start one level lower and kept; again
  lower; a finished load does not lower; 0 stays 0 (unit tests).
- `takeGpuMs` never resolves WebGPU timestamps itself (that happens when the
  next frame begins, after the ended frame's passes were handed over).
- The profiler is disposed at the end of the draw check; no GPU error or
  console error on either backend.

## Limits and decision

- Phone (run from the owner's session on 2026-11-17, vivo V40, Adreno
  720, Chrome over `ZHUDA_PHONE_CHROME`): `verify:quality-governor` PASS on
  WebGL and WebGPU, the same steps down (pillars 30 → 20 → 12, far red
  379 → 274 → 0) as on the desktop. Its frame times there are the check's
  own synthetic load, not a game's.
- The warm start is unit-tested, not drawn.
- `detail` is applied by the scene; the engine's own distance users (grass,
  model LOD) do not read it.

Decision: **Implemented**, accepted for desktop WebGL and WebGPU and on
one phone (vivo V40).
