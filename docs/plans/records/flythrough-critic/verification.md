# Verification record: flythrough-critic (AG5)

Task document: `docs/plans/records/flythrough-critic/task.md`\
Commit: the commit that adds this file, on top of `33f11be`\
Date: 2026-11-17

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the film host. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`, GPU
  time from the disjoint timer query. WebGPU: apple / metal-3 (ready), GPU
  time from timestamps summed over render passes.
- Node and package manager: Node 26.12.0, npm 11.20.0; ffmpeg from Homebrew
  for the recording.
- Engine and consumer commits: on top of `33f11be`; no consumer.
- DPR, viewport and network mode: frames of 960 by 540 (yard) and 480 by 270
  (over-budget); loopback; load average about 1.8.
- Evidence (outside the repository): `EV` =
  `/Users/yaowei/Documents/ZhudaGameCenter/audits/flythrough-critic-2026-11-17/`:
  `yard-webgl/`, `yard-webgpu/`, `over-budget-webgl/`, `over-budget-webgpu/`
  (report, poses, recording, brief, log each), `critic-webgl/` (what the
  critic was given, its report, the gate's output), `verify.log`.

## Checks

| Check                                     | Exact command or procedure                                                                                                | Result                                                                                             | Artifact                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                                                          | PASS, 894 of 894                                                                                   | `EV/verify.log`                      |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check`                                                                | PASS                                                                                               | —                                    |
| Unit tests                                | `node --test tests/flythrough.test.mjs`                                                                                   | PASS, 9                                                                                            | —                                    |
| Fly-through, WebGL                        | `npm run verify:flythrough`                                                                                               | PASS (exit 0)                                                                                      | `EV/yard-webgl/`                     |
| Fly-through, WebGPU                       | `ZHUDA_FILM_RENDERER=webgpu npm run verify:flythrough`                                                                    | PASS (exit 0)                                                                                      | `EV/yard-webgpu/`                    |
| Over budget, both backends                | `npm run verify:flythrough -- tests/fixtures/flythrough/over-budget.json` (and with WebGPU)                               | FAIL as intended (exit 1), the budget line and the slowest frames with their camera key, file:line | `EV/over-budget-*`                   |
| Critic                                    | an agent given only `brief.md` and ten pictures (four poses, six consecutive recording frames), told to read nothing else | report: 5 major, 4 minor                                                                           | `EV/critic-webgl/critic-report.json` |
| Critic gate                               | `npm run flythrough:critic -- EV/critic-webgl/critic-report.json`                                                         | BLOCKED (exit 1), each major defect with file:line                                                 | `EV/critic-webgl/gate.log`           |
| Critic gate, minor only                   | `npm run flythrough:critic -- tests/fixtures/flythrough/critic-minor.json`                                                | MINOR-ONLY (exit 0), worded as a proposal                                                          | —                                    |
| Guard: the film page draws through Laya   | `tests/film-scene.test.mjs`                                                                                               | PASS after the page stopped calling `getContext` (GPU time from LayaAir's own device or context)   | —                                    |

## The yard, 180 frames (6 s at 30 fps), budget of a 60 fps desktop

|                        | WebGL                 | WebGPU                 |
| ---------------------- | --------------------- | ---------------------- |
| CPU average, p99, max  | 0.75, 1.90, 2.10 ms   | 0.79, 2.30, 2.60 ms    |
| GPU average, p99, max  | 5.65, 12.39, 12.81 ms | 10.80, 18.42, 22.81 ms |
| Frames with a GPU time | 180 of 180            | 180 of 180             |
| WebGL errors           | none                  | —                      |
| Recording              | 72 frames at 24 fps   | 72 frames at 24 fps    |

Four more runs while building the check: WebGL GPU average 5.4 to 5.8 ms,
p99 11.9 to 15.5; WebGPU 10.6 to 11.3 ms, p99 18.3 to 28.0. Single frames
spike (16.7 ms on WebGL, 33.8 on WebGPU) without a costly stretch of the
path, which is why the documentation gives p99 the tight limit.

## What the critic found (kept as evidence, not acted on here)

Confirmed by looking at the same pictures:

1. The 80 m ground ends before the horizon, a dark band between it and the
   sky; no fog hides the edge (the fixture's scene: no `fog`, a small
   ground).
2. Container faces turned away from the sun are almost as bright as the
   sunlit roofs.
3. The container picture repeats its rust marks on a strict grid, and the
   roofs reuse the wall picture.
4. The asphalt repeats its lighter blotches on a grid.
5. No contact darkening under the barriers.

Items 2 to 5 are about the starter props and the look's ambient light, not
about this task; they are reported to the owner as follow-ups. The run shows
the gate doing its job: a real critic blocked a scene that passes its frame
budget.

## Lifecycle and failure cases

- A bad file (unknown field, keys out of order, a pose beyond the run, an
  unknown limit, malformed JSON) is refused before any draw, with file:line
  (unit tests).
- GPU time not measured: unavailable with the reason; a GPU limit asked for
  then gives exit 2, never a pass (unit tests).
- The capture and profiler are disposed after every run; the runtime's
  paused state is restored. Cancellation takes an `AbortSignal`, checked
  before every frame (not exercised in a draw).

## Limits and decision

- No phone run (requested from the owner's session).
- WebGPU's GPU time is a sum over render passes; on a tiled GPU passes may
  overlap, so its figure (about twice WebGL's here) is not directly
  comparable with WebGL's frame-level timer query. Not investigated further.
- The critic saw recording frames as pictures, not the MP4 (an agent reads
  pictures); a person can watch the MP4.
- The minor-only outcome is shown with a fixture report, not a real critic.

Decision: **Implemented**, accepted for desktop WebGL and WebGPU; phone
acceptance open.
