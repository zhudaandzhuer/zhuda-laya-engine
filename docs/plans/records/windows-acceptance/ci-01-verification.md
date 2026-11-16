# Verification record: windows-acceptance CI-01

Task document: `docs/plans/records/windows-acceptance/ci-01-task.md`\
Commits: `65040bb` (macOS job; Windows consumer batches from
`zhuda engine 測試`), `d6287a8` (launcher tests allow 30 s), `e5b7530`
(launcher waits 30 s; the Prefab check passes its own timeout), `b98ec03`
(runtime feedback waits for the audio state), `fdf0981` (fly-through test
fixture paths)\
Date: 2026-11-17

## What the new jobs found, and what was done

| Run (commit)             | Failure                                                                                                      | Cause                                                                                                                                        | Fix                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 43926645426, 43941921467 | Linux `browser`, Prefab gate: `Chrome startup timeout` after 10 s                                            | WIN-04's shared launcher took the old film host's 10 s; the Prefab check had allowed 30 s (`browserTimeoutMs`) and lost it                   | `e5b7530`: launcher default 30 s; the Prefab check passes `browserTimeoutMs`    |
| 43941921467              | Windows consumer batch, runtime feedback: audio context `suspended`, `running` expected                      | the fixture read the state a fixed 50 ms after `resume()`; a runner with no sound card took longer (the same check passed on the run before) | `b98ec03`: wait up to 2 s for the state; still requires suspended, then running |
| 43945140430              | Windows unit tests: 3 in `tests/flythrough.test.mjs`, `ENOENT D:\D:\…\zhuda%20engine%20%E6%B8%AC%E8%A9%A6\…` | `new URL(…).pathname` as a file path (WIN-03's class), in AG5's new test                                                                     | `fdf0981`: `fileURLToPath`                                                      |

## Green runs

| Run         | Commit    | verify (Linux) | browser (Linux, SwiftShader) | macos   | windows (spaces + CJK) |
| ----------- | --------- | -------------- | ---------------------------- | ------- | ---------------------- |
| 43944417217 | `b98ec03` | success        | success                      | success | success                |
| 43946436044 | `fdf0981` | success        | success                      | success | success                |
| 43947210738 | `6d3d362` | success        | success                      | success | success                |

The Windows job: `npm ci`, build, typecheck, declarations, 911 unit tests,
then `verify:slot-foundation` and `verify:runtime-feedback` (packed SDK
through npm, dependency junctions, file-URL imports, Chrome started and
closed by the shared launcher), then no `zhuda-*-browser-` Chrome left.

## Not in CI, and why

- Hardware lanes (Intel and NVIDIA; Chrome and Edge; WebGL and WebGPU):
  hosted runners have no such GPUs, and a software renderer is not
  evidence for them. The procedure is `docs/agent-development.md`,
  "Windows hardware runs" (desktop session, not session 0; which GPU ran;
  no browser left), used for every GFX item of this plan.
- A clean-VM desktop lane and a privileged symlink-escape lane: no such
  runner. DIST-02 was checked on the host (install, update, uninstall).
- SKIP and UNAVAILABLE are not reported by the workflow separately; a step
  either runs or is absent.

Decision: **Implemented within scope** for the hosted layers; hardware,
clean-VM and privileged lanes remain a documented manual procedure.
