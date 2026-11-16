# Agent task: windows-acceptance batch 1 (WIN-01..04)

Status: Implemented within scope; verified on the report's Windows host ([record](batch-1-verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-16

## Source requirement

Owner's request of 2026-11-16: fix what the [Windows acceptance plan](plan.md)
lists, in order. Batch 1 is WIN-01..04 of the report on the Windows host
(`閱讀版/windows-issues-and-remediation.md`, sections WIN-01..WIN-04): of the
original 8 Windows cases, 7 stopped at `spawnSync npm ENOENT` and 1 at
`EPERM` creating a directory symlink; the scripts import drive paths as
module specifiers; two browser launchers start and clean up differently and
`child.kill()` on Windows leaves Chrome's process tree and a locked profile.

## Goal

The unmodified verify scripts reach their functional assertions on Windows
(no external preload), and every browser a check starts is closed with its
own processes only, on Windows and macOS.

## Invariants

- No functional assertion, threshold or reference changes.
- One helper per concern, every caller moved to it; no shell strings.
- npm is run as `node <npm-cli.js>`; a missing CLI fails with a message,
  never an empty result.
- A directory link is a junction on Windows and a dir symlink elsewhere; the
  target must be a directory. File-symlink security tests stay as they are
  (`tests/helpers/links.mjs` keeps skipping with a reason).
- Dynamic imports of files use `pathToFileURL(...).href`.
- A browser is closed by CDP `Browser.close` first; only processes started
  for this run's unique profile are ended; never by image name alone. The
  first error is kept; cleanup errors are reported beside it.
- `resolveChromeBinary` stays exported from `prefab-check.mjs`.

## Dependencies

- `packages/compiler/chrome-host.mjs` (film host, 50 checks through
  `scripts/lib/chrome-fixture.mjs`), `packages/compiler/prefab-check.mjs`
  (consumer CLI `zhuda-prefab-check`).
- `scripts/verify-{webgpu-consumer,cinematic,crowd-browser,model-showcase,next-round,slot-foundation,minigame,runtime-feedback-browser}.mjs`.

## Scope

### Engine

- New `scripts/lib/node-tools.mjs` (`runNpm`, `linkDirectory`, `importFile`)
  for the verify scripts.
- New `packages/compiler/browser-process.mjs` (resolve, launch, ready,
  close) shared by `chrome-host.mjs` and `prefab-check.mjs`; shipped with
  the package because both users are.
- The eight scripts above; tests for both helpers.

### Consumer or adapter

- None. `packages/compiler/minigame-bridge.mjs` runs inside the LayaAir IDE
  through `IEditorEnv.utils.exec` and is left alone (never compile for the
  IDE).

## Non-goals

- Batch 2..4 items; `tar` and `unzip` use in the scripts (the report's
  matrix ran through `tar` on Windows; `unzip` only in the mini-game check,
  which needs the official CLI the host does not have).
- A privileged lane for file-symlink escape tests (CI-01).

## Acceptance checks

1. `npm run verify` on macOS passes; `node --test` covers `runNpm` (missing
   CLI fails with a message; arguments with spaces, CJK, `&`, `#`, `%`
   reach npm unchanged), `linkDirectory` (refuses a file target, junction
   on Windows), `importFile` (a path with `#` and `%`), and the browser
   close (Browser.close path, no leftover process, profile removed).
2. On macOS: `verify:webgpu-consumer` and one film/Prefab check pass.
3. On the Windows host (i7-12700, UHD 770, RTX 3060), from a clean
   checkout of this commit with Node ≥ 24 and no preload: the report's 8
   original cases (`verify:webgpu-consumer`, `verify:cinematic` on both
   backends, `verify:crowd-browser`, `verify:model-showcase`,
   `verify:next-round`, `verify:slot-foundation`,
   `verify:runtime-feedback-browser`) get past npm, imports and links to
   their functional assertions; each result recorded as it is.
4. On Windows: after each check, no `chrome.exe`/`msedge.exe` with the
   check's profile in its command line remains, the profile directory is
   gone, and a Chrome the user started is still running.

## Evidence to attach

- Test/build output: `verification` record beside this file.
- Browser/WebGL or device report: Windows run logs, outside the repository
  (`D:\claude-workstation\zhuda-windows-batch1\` on the Windows host).

## Unverified limits

- The SSH session on the Windows host is an administrator; a standard user's
  `EPERM` on symlinks cannot be reproduced there. The junction path does
  not need the right either way.
- Edge's relaunch is handled by reading `DevToolsActivePort`; whether Edge
  relaunches on this host is recorded, not forced.

## Rollback

Last known good: `2d7fc04`. Each WIN item is its own commit and can be
reverted alone.
