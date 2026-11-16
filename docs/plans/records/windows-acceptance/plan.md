# Windows acceptance fixes

Status: In progress: WIN-01..04, DIST-01, DIST-02, MEM-01 and GFX-01
implemented and verified on the Windows host (MEM-01 and GFX-01 also on a
phone); GFX-02..06, QA, CI and DEP not started\
Owner: Engine/toolchain\
Last reviewed: 2026-11-16

## Source requirement

Owner's request of 2026-11-16: read the engine test report on the Windows
host's desktop and turn it into a plan in the waiting list.

The report is a Windows acceptance run of engine **1.18.0 at `e835b267`**
(14 commits behind `main` when this plan was written), delivered as
documents with no fix. It lives outside this repository with its evidence:

- Windows host (`win-bdl`): `C:\Users\user\Desktop\Zhuda引擎_Windows驗收與優化_2026-11-16\`
  - `閱讀版/windows-issues-and-remediation.md` — the 19 items, facts, cause
    strength, proposed fix, acceptance;
  - `閱讀版/reproduction-guide.md`, `case-index.md`, `cases.json` — 313 runs
    with commands and evidence paths;
  - `閱讀版/evidence/verification-notes.md` — corrections to earlier rounds;
  - ZIPs: documents (3.7 MB), full images and raw values (421 MB), heap
    snapshots (27.8 MB); SHA-256 in `desktop-package-check.json`.
- The folder was no longer on that desktop by the evening of 2026-11-16
  (moved by someone else); copies of its readme, report, reproduction
  guide and case index were read before that.
- The same folder holds an `engine/` checkout on `fix/windows-acceptance`
  and a task note addressed to another agent. This plan does not use either:
  work happens on this repository's `main` line, from current source.

## What the report measured

|                    |                                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| Host               | Windows 11 Pro 10.0.26200, Core i7-12700                                        |
| GPUs               | Intel UHD 770 (32.0.101.7088), RTX 3060 (32.0.16.1088)                          |
| Browsers / runtime | Chrome 157.0.8103.78, Edge 157.0.4341.60, Node 24.22.3, Electron 36.9.5         |
| Base checks        | `npm ci`, `verify` (826 pass, 4 skip, 0 fail), lint, format, browser build pass |
| Matrix             | 65 entries, 109 scenarios, 313 runs: 163 pass, 150 fail                         |

150 failing runs are not 150 defects: each check ran three times, and 58
fail only on an optional compression-capability warning. Of the original 8
Windows cases, 7 stopped at launching npm and 1 at a symlink permission; the
rest of the matrix ran through an external Windows adaptation that changed
no engine source, so those passes do not show that unmodified source runs on
Windows. No macOS run was part of it.

Corrections the report keeps and this plan inherits: the Electron shutdown
stderr also appears in a bare Electron control; the Prefab entries pass
8/8 on real GPUs; WebGPU TAA is 0 in every repeated run (one diagnostic
non-zero was not reproduced); RTX specular 1.122 / 1.130 are the 4tx / 8tx
cases on both backends; the animation one-pixel difference did not
reproduce; render-scale `uncovered=1` is a background-colour count with no
PNG of that rung.

## Items and where they stand on `main`

Checked against `main` on 2026-11-16 by reading source, not by running on
Windows.

| ID      | Pri.    | Item                           | Report's finding                                                                                                                                                                                                  | On `main` now                                                                                                                                                     |
| ------- | ------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WIN-01  | P1      | Launching npm                  | `execFileSync('npm', …)` → `spawnSync npm ENOENT` on Windows                                                                                                                                                      | Still: `scripts/verify-{webgpu-consumer,cinematic,crowd-browser,model-showcase,next-round,slot-foundation,minigame}.mjs`, `packages/compiler/minigame-bridge.mjs` |
| WIN-02  | P1      | Directory symlinks             | `fs.symlinkSync` EPERM for a standard user; junctions work                                                                                                                                                        | Still: `verify-runtime-feedback-browser.mjs`, `verify-webgpu-consumer.mjs`                                                                                        |
| WIN-03  | P1      | Dynamic import of a drive path | `await import(path.join(…))` is not a portable specifier                                                                                                                                                          | Still in the same seven `verify-*.mjs` scripts                                                                                                                    |
| WIN-04  | P1      | Two browser launchers          | Start, CDP ready, GPU identity and cleanup differ; `child.kill()` on Windows leaves the tree; Edge relaunch keeps the profile locked                                                                              | `chrome-host.mjs` changed since (wait honours its time) but still `child.kill()` on win32; `prefab-check.mjs` separate                                            |
| DIST-01 | P1      | Installer metadata             | `make` fails without author / description                                                                                                                                                                         | `examples/windows-webgpu/package.json` has none                                                                                                                   |
| DIST-02 | P1      | Squirrel events                | install/uninstall hooks time out; uninstall exit 0 leaves the main executable (243 937 681 bytes)                                                                                                                 | `main.mjs` has no early Squirrel branch                                                                                                                           |
| MEM-01  | P1      | WebGPU JS heap growth          | +22 MiB per 3 000 cycles (WebGL +3.6); 30 min churn +167 MiB, idle +0.7; 2D-only +16, 3D-only +6.3; retained via `gpuBufferMgr → SubUniformBuffer._observers → ShaderData`, `bindGroupCache`, `_batchOpaqueMarks` | Not looked into; vendored LayaAir 3.4.2                                                                                                                           |
| GFX-01  | P2      | ETC2/ASTC capability warning   | Optional features filtered with `console.warn` fail checks that allow no warning (58 runs)                                                                                                                        | Not changed                                                                                                                                                       |
| GFX-02  | P2      | Wet reflection                 | wet/rough gain 9.1..10, required > 20, both backends                                                                                                                                                              | Not changed                                                                                                                                                       |
| GFX-03  | P1      | WebGL TAA                      | still 7.81..11.19 (required 0), tracked 8.25..9.28 (< 3); WebGPU 0                                                                                                                                                | Not changed                                                                                                                                                       |
| GFX-04  | P2      | WebGL Basis/KTX2               | mean 2.87 / 2.76 vs PNG, required ≤ 2.5; WebGPU 0.46 / 0.29                                                                                                                                                       | Not changed                                                                                                                                                       |
| GFX-05  | P1      | WebGL SMAA                     | 4° mean 0.0523 (none 0.085, FXAA 0.0335); other angles, long search, box corners (changed 68, worst 183) fail                                                                                                     | Not changed                                                                                                                                                       |
| GFX-06  | P2      | Specular AA                    | RTX energy 1.122/1.130 (±12 %); Intel highlight area 12.6 vs 8 (±4)                                                                                                                                               | Not changed                                                                                                                                                       |
| QA-01   | P2      | Exact equality                 | Water: 1 pixel, 1/255, reproducible on Intel; animation not reproduced                                                                                                                                            | —                                                                                                                                                                 |
| QA-02   | P2      | Render-scale coverage          | rung 2 `uncovered=1` on Intel WebGPU; no PNG                                                                                                                                                                      | —                                                                                                                                                                 |
| QA-03   | P2      | GPU timer 0 ms                 | Light-load WebGPU median 0 ms on three setups; heavy load positive                                                                                                                                                | —                                                                                                                                                                 |
| QA-04   | P2      | CDP timeout                    | One `Runtime.evaluate` timeout; isolated rerun passed                                                                                                                                                             | —                                                                                                                                                                 |
| CI-01   | P1      | Acceptance layers              | Windows CI runs build and unit tests only; 4 verify skips plus file-symlink subchecks skipped inside passes                                                                                                       | `.github/workflows/verify.yml` has the `windows-latest` job only                                                                                                  |
| DEP-01  | P1 inv. | Advisories                     | engine 7 moderate; desktop host 27 (1 critical `tar`, 21 high)                                                                                                                                                    | Not looked into                                                                                                                                                   |

## Progress

| Batch / item                         | State                                                                                                 | Record                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| WIN-01..04                           | Implemented within scope; Windows verified                                                            | [task](batch-1-task.md), [verification](batch-1-verification.md) |
| DIST-01                              | Implemented within scope; Windows verified                                                            | [task](batch-2-task.md), [verification](batch-2-verification.md) |
| DIST-02                              | Implemented within scope; install, update, uninstall verified on Windows                              | same                                                             |
| MEM-01                               | Implemented within scope; churn check passes on macOS, Windows and the vivo V40, both backends        | [task](mem-01-task.md), [verification](mem-01-verification.md)   |
| GFX-01                               | Implemented within scope; 16 of the report's 17 checks pass on Windows WebGPU (render-scale is QA-02) | [task](gfx-01-task.md), [verification](gfx-01-verification.md)   |
| GFX-02..06, QA-01..04, CI-01, DEP-01 | Not started                                                                                           |                                                                  |

Found while verifying: on that host the SSH job context (session 0) is not
a GPU context: WebGPU screenshots come out white and the Prefab page gets
no context, at the base commit too. GPU checks run in the signed-in
desktop session.

## Work order

Separate commits per ID, so each can be reviewed and reverted alone. Every
item starts with a task record from `TASK-TEMPLATE.md` and ends with
`VERIFICATION-TEMPLATE.md`; the report's original failures stay failures in
its own folder, and new results go to a new evidence folder outside this
repository.

### Batch 1 — unmodified source runs on Windows (WIN-01..04)

1. One process helper in `scripts/lib/` (proposal `runNpm(args, options)`):
   `process.execPath` plus the npm CLI resolved from `npm_execpath` and
   checked, argument arrays, no shell strings; returns stdout, stderr, exit
   code, signal, cwd and timeout cause; a missing CLI fails with a message.
   Every caller listed above moves to it.
2. Dependency links: a directory link that is a junction on Windows and a
   dir symlink elsewhere, target checked to be a directory, realpath
   resolved, cleanup limited to what the run made. The file-symlink escape
   tests stay a separate lane that reports unavailable without the right,
   never pass by junction.
3. `await import(pathToFileURL(abs).href)` in every script; fixtures with
   spaces, CJK, `&`, `#` and `%` in the path.
4. One browser launcher shared by `chrome-host.mjs` and `prefab-check.mjs`:
   CDP `Browser.close` first, then end only this run's process tree
   (executable, unique profile, PID and start time), profile removed after
   exit with bounded retries, the first error kept. GPU identity read from
   the canvas/adapter of that run. Software-renderer CI and hardware
   acceptance named as different modes.

Gate: on Windows without the external preload, the 8 original cases reach
their functional assertions; macOS consumer paths regress clean; normal
exit, failed start, CDP timeout and cancel each leave no owned process or
locked profile.

### Batch 2 — desktop delivery and memory (DIST-01, DIST-02, MEM-01)

5. `examples/windows-webgpu`: author and description (or maker `authors`),
   checked before build; product name, company and app IDs confirmed by the
   owner, not test values.
6. Squirrel install/updated/uninstall/obsolete handled before
   `app.whenReady` and anything else, then exit (ESM-safe; `firstrun`
   separate). Gate: clean VM, install → run → update → restart → uninstall
   → later check → reinstall, with timings, shortcuts, registry, processes
   and leftover files recorded.
7. MEM-01: counters for ShaderData, sub-buffers, observers, batch marks
   and bind groups (create/borrow/release/live) per cycle; 2D and 3D apart;
   find the owner that does not release. No per-frame cache clearing,
   forced GC or renderer restart as a fix. A vendor change goes through a
   traceable patch with provenance, SHA and SRI updated, and a minimal
   upstream reproduction. Gate: 3 000 cycles × 4 setups × 2 backends, 30 min
   churn and idle, after-dispose snapshot; object count stops growing with
   cycles.

### Batch 3 — rendering, stage by stage (GFX-01..06)

Each with the same fixture, input and GPU before and after, intermediate
stages saved; no threshold lowered, no reference replaced, no effect
swapped for another.

8. GFX-01: structured capability events (required vs optional, chosen
   format, fallback reason); a missing required feature fails, an optional
   one is information only when its fallback really drew.
9. GFX-02: save none/alike/surfaces/surfacesWet/liveOffAgain in linear HDR
   and final; trace wetness → roughness/reflectance → reflection weight in
   `ScreenReflections.ts`.
10. GFX-03: color, history, velocity, depth and reprojection UV under a fixed
    jitter; check origin, motion sign, clip→UV, jitter removal, previous
    transform timing (`Filmic.ts` and the LayaAir TAA it drives).
11. GFX-04: decoded texels, shader input and final pixel per target, sRGB
    decode and mips (`BasisTexture.ts`).
12. GFX-05: edge, weight and blend passes on minimal shapes; table format,
    sampling, texel centre, search steps, corner rounding (`Smaa.ts`,
    `SmaaTables.ts`).
13. GFX-06: normal variance, roughness widening, energy compensation; check
    the supersampled reference on Intel before changing the shader
    (`Laya342Adapters.ts`).

Gate: each item's original assertions on both backends, four setups, three
runs; a macOS comparison so platform-specific and shared causes are told
apart.

### Batch 4 — measurement quality, CI and dependencies (QA-01..04, CI-01, DEP-01)

14. QA-01..04: save the artefacts that tell a real defect from a counting
    accident (diff heatmaps, per-rung PNG and coverage mask, raw timestamps
    and availability, per-phase CDP timing). Exact-equality contracts stay;
    a perceptual tolerance, if wanted, is a new named check with a negative
    control.
15. CI-01: keep the Windows job; add a Windows/macOS ESM-CJS consumer and
    special-path step to every PR; hardware lanes (Intel and NVIDIA,
    Chrome/Edge × WebGL/WebGPU) on schedule or release candidates; a clean-VM
    desktop lane; a privileged lane for symlink-escape and long churn.
    SKIP and UNAVAILABLE listed apart, never inside a pass.
16. DEP-01: `npm explain` each advisory, split build-tool exposure from
    what ships in the installer, upgrade candidates one by one with the
    package, WebGPU, media and Squirrel checks rerun; no `npm audit fix
--force`.

## Hardware for acceptance

The Windows host reachable through `win-bdl` is a Windows 11 machine with an
RTX 3060; check with `winbdl doctor` whether it is the reported i7-12700 with
UHD 770 before relying on it for Intel results. Mac work covers source
reading, unit tests and most toolchain fixes; Windows behaviour is judged
only on Windows runs. Both sides use the same commit, lockfile, fixture and
resource SHAs and commands.

## Non-goals

- Compiling for the LayaAir IDE (the IDE compiles itself).
- Changing any consumer game or the report's checkout or evidence.
- Promising frame-rate or memory percentages before a measured fix.
- Claiming AMD, other drivers, ARM Windows, mini-game hosts or Safari from
  these runs.

## Done when

Every ID is reported as one of: fixed and measured, changed but not
measured, not reproduced, still failing, or environment unavailable — each
with root cause, base and fix commits, commands, exit codes, OS, browser,
GPU and backend, artefacts with SHA, and what remains. Closure needs the
unmodified source running on Windows, the original assertions passing,
memory and desktop lifecycle done, and no macOS regression.

## Risks

- Fixes in shared compiler, renderer and vendor code reach every consumer;
  batch 1 and MEM-01 need full consumer regression.
- A vendor runtime patch changes artefact SHA/SRI and must keep public API
  and shader anchors.
- Hardware lanes need a runner with known GPUs; a hosted runner is not
  evidence for Intel or RTX results.
