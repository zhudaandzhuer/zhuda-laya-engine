# Verification record: windows-acceptance batch 1 (WIN-01..04)

Task document: `docs/plans/records/windows-acceptance/batch-1-task.md`\
Commits: `e97b371` (WIN-01), `f413dcb` (WIN-03), `f6cc9bc` (WIN-02),
`82f07aa` and `7483578` (WIN-04); base for comparison `2d7fc04`\
Date: 2026-11-16

## Environment

- macOS: Apple Silicon, Node 26.12.0, Chrome (desktop install).
- Windows: the host the acceptance report ran on (Windows 11 Pro
  10.0.26200, Core i7-12700, Intel UHD 770 32.0.101.7088, RTX 3060
  32.0.16.1088), Chrome and Edge from Program Files, Node 24.22.3 from the
  official zip (SHA-256 `e612af99…7d9f` checked against nodejs.org) in
  `D:\claude-workstation\tools`, no preload, no `NODE_OPTIONS`. Clean
  clones from a bundle of `main`: `fixed` at the commit under test, `base`
  at `2d7fc04` sharing the same lockfile's `node_modules`.
- Two Windows contexts:
  - **session 0**: the SSH job runner (Task Scheduler, S4U logon, elevated,
    no desktop);
  - **session 1**: the signed-in user's desktop, through a scheduled task
    with interactive logon and a **standard (not elevated) token**, hidden
    window.
- Logs: `D:\claude-workstation\zhuda-windows-batch1\logs\`, summaries
  `summary*.tsv` beside them.

## Checks

| Check                                                       | Command                                                                | Result                                                                                         | Note                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Mac verify                                                  | `npm run verify`                                                       | PASS, 870/870                                                                                  | build, typecheck, declarations, doctor, tests                                                               |
| Mac lint / format                                           | `npm run lint`, `prettier --check` on changed files                    | PASS                                                                                           |                                                                                                             |
| Mac browser                                                 | `verify:webgpu-consumer`, `verify:prefab-browser`, `verify:next-round` | PASS                                                                                           | no profile or process left by these runs                                                                    |
| Win base, negative control                                  | `npm run verify:webgpu-consumer` at `2d7fc04`                          | FAIL as reported: `spawnSync npm ENOENT` at `verify-webgpu-consumer.mjs:22`                    | reproduces WIN-01                                                                                           |
| Win `npm ci`                                                | Node 24.22.3                                                           | PASS                                                                                           |                                                                                                             |
| Win unit, Chrome                                            | `node --test tests/node-tools.test.mjs tests/browser-process.test.mjs` | PASS 11/11 (s0), see s1 below                                                                  | junction, `#`/`%`/CJK paths, npm arguments, Browser.close and forced close                                  |
| Win unit, Edge                                              | same with `CHROME_BIN=msedge.exe`                                      | PASS 5/5 (s0)                                                                                  |                                                                                                             |
| Win `verify:webgpu-consumer` (npm run)                      | s0                                                                     | PASS, 92 s                                                                                     |                                                                                                             |
| Win `verify:webgpu-consumer` (plain `node`)                 | s0                                                                     | 1st FAIL `Browser condition timeout: window.lateDeviceRequested`; rerun PASS, 91 s             | npm CLI found beside Node; the timeout is in the check's late-device step, not in batch 1 code              |
| Win `verify:cinematic` webgl / webgpu                       | s0, `CINEMA_BACKEND`                                                   | PASS 57 s / PASS 59 s                                                                          |                                                                                                             |
| Win `verify:crowd`                                          | s0                                                                     | PASS, 292 s                                                                                    |                                                                                                             |
| Win `verify:model-showcase`                                 | s0                                                                     | PASS, 126 s                                                                                    |                                                                                                             |
| Win `verify:slot-foundation`                                | s0                                                                     | PASS, 85 s                                                                                     |                                                                                                             |
| Win `verify:runtime-feedback`                               | s0 (elevated)                                                          | PASS, 45 s                                                                                     |                                                                                                             |
| Win `verify:next-round`                                     | s0                                                                     | FAIL twice: WebGPU frames all white, `Camera timeline must move the visible model`; WebGL PASS | environment, see below                                                                                      |
| Win `verify:prefab-browser` Chrome / Edge                   | s0                                                                     | FAIL: page `TypeError … reading 'enable'`; **same at base `2d7fc04`**                          | environment, see below                                                                                      |
| Win `verify:prefab-browser` Chrome                          | s1, base `2d7fc04`                                                     | PASS, 49 s                                                                                     |                                                                                                             |
| Win `verify:prefab-browser` Chrome / Edge                   | s1, `82f07aa`                                                          | PASS 132 s / PASS 88 s                                                                         | 132 s led to `7483578`                                                                                      |
| Win `verify:next-round`                                     | s1, `82f07aa`                                                          | PASS, 52 s                                                                                     | WebGPU draws on the desktop session                                                                         |
| Win unit browser-process                                    | s1, `82f07aa`                                                          | PASS                                                                                           |                                                                                                             |
| Win round 2 at `7483578`, standard token (`elevated False`) | s1                                                                     | PASS all six                                                                                   | below                                                                                                       |
| — unit: node-tools, browser-process, desktop-host           | s1                                                                     | PASS, 8 s                                                                                      | junction made without the right to symlinks; Windows check that a gracefully closed browser left no process |
| — `verify:prefab-browser` Chrome / Edge                     | s1                                                                     | PASS 67 s / PASS 84 s                                                                          | base was 49 s: the 18 s are the graceful Browser.close and wait that replaced taskkill                      |
| — `verify:runtime-feedback`                                 | s1                                                                     | PASS, 47 s                                                                                     | the report's EPERM case, now as a standard user                                                             |
| — `verify:webgpu-consumer`                                  | s1                                                                     | PASS, 96 s                                                                                     |                                                                                                             |
| — `verify:next-round`                                       | s1                                                                     | PASS, 48 s                                                                                     |                                                                                                             |

Every Windows step counted `chrome.exe`/`msedge.exe` processes whose
command line names a check profile, and `zhuda-*browser-*` folders in
`%TEMP%`, after the step: 0 processes after every step; 8 folders before
the first step and 8 after the last (left by earlier runs on that host,
untouched). A headless Chrome started as "the user's browser" before the
checks was still running after all of them (s0 run).

## Session 0 is not a GPU acceptance context

In the SSH job context (session 0, no desktop) the same Chrome draws WebGL
(next-round WebGL frames differ as required; cinematic WebGL and WebGPU
pass through their own readback) but next-round's WebGPU screenshots are
plain white while the renderer reports ready and a non-fallback adapter,
and the Prefab page cannot get the context it asks for. The commit before
batch 1 fails the Prefab check the same way there, and both checks pass in
the signed-in desktop session. GPU checks on that host are therefore run
in session 1; session 0 results for them are recorded, not counted.

## Limits and decision

- Whether this host refuses symlinks to a standard user was not checked
  directly; `runtime-feedback`, which hit `EPERM` in the report, passes with
  a standard token through the junction.
- Closing is slower than force-ending: a Prefab run took 67 s against 49 s.
- Edge's self-relaunch was not observed on this host; the DevToolsActivePort
  path is covered by the readiness code but not by a forced relaunch.
- Only Chrome and Edge from Program Files, one Windows host, two GPUs as
  Chrome picks them by default (no per-GPU selection was made).
- The report's original evidence folder was no longer on the host's
  desktop when these runs were made; commands follow the npm scripts named
  in the plan.
- `verify:minigame` was not run (needs the official LayaAir CLI, absent on
  the host); its npm, import and link calls use the same helpers.

Decision: **Implemented within scope.** The unmodified scripts get past
npm, imports and links on the report's Windows host and reach their
functional assertions; every check closed its own browser and nothing
else. Not Accepted: the report's full matrix (two browsers × two GPUs ×
both backends, three runs each) and the file-symlink privileged lane
(CI-01) are not run here.
