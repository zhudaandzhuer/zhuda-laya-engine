# Verification record: windows-acceptance batch 2, desktop delivery (DIST-01, DIST-02)

Task document: `docs/plans/records/windows-acceptance/batch-2-task.md`\
Commits: `481866a` and `e21ce91` (DIST-01), `6cc7a98` (DIST-02); base
`2d7fc04`\
Date: 2026-11-16

## Environment

The Windows host and Node of [batch 1](batch-1-verification.md), session 0
(packaging needs no GPU). `examples/windows-webgpu` installed with `npm ci`
(Electron 36.9.5, Forge 7.11.2). `ZHUDA_WEB_ROOT` is the WebGPU build of
the consumer that `verify:webgpu-consumer` made in batch 1. Logs in
`D:\claude-workstation\zhuda-windows-batch1\logs\` (`host-*`, `stage-*`).

## Checks

| Check                  | Command                                                                   | Result                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mac tests              | `node --test tests/desktop-host.test.mjs`                                 | PASS 3/3: metadata present and checked, a BOM accepted; Squirrel events parsed (install, updated, uninstall, obsolete; firstrun, other arguments and non-Windows not), `..\Update.exe --createShortcut=`/`--removeShortcut=` the exe, exit 0 after Update.exe or after the limit, startup only behind `!squirrel` |
| Mac verify             | `npm run verify`                                                          | PASS 870/870 (before `e21ce91`; its test added after)                                                                                                                                                                                                                                                             |
| Win package, base      | `npm run package` at `2d7fc04`                                            | FAIL as reported: `Authors is required.` `Description is required.`                                                                                                                                                                                                                                               |
| Win package            | `npm run package` at `6cc7a98`                                            | PASS, 71 s: `zhuda-windows-webgpu-host-1.0.0 Setup.exe` (120 578 048 bytes), `…-full.nupkg`, `RELEASES`                                                                                                                                                                                                           |
| Win staging, BOM       | `node bundle.mjs` with the real package.json saved with a BOM             | first FAIL (`JSON.parse`), found here and fixed in `e21ce91`; then PASS                                                                                                                                                                                                                                           |
| Win staging, no author | `node bundle.mjs` with `author` removed (no BOM)                          | FAIL as intended: `package.json needs author for the Windows installer`, before the maker                                                                                                                                                                                                                         |
| Win unit               | `node --test tests/desktop-host.test.mjs` (s1, standard token, `7483578`) | PASS                                                                                                                                                                                                                                                                                                              |

## Not run

- Install → run installed `--verify` → update → uninstall → later check →
  reinstall. Installing creates Start-menu and desktop shortcuts and an
  uninstall entry for the signed-in user of the owner's machine, which
  still holds the report's leftover install folder
  (`%LOCALAPPDATA%\zhuda_windows_webgpu_host`, 243 937 681 bytes: the
  executable the report's uninstall left). Waiting for the owner's go-ahead;
  DIST-02's acceptance (hook time, exit codes, no executable left) rests on
  that run.

## Limits and decision

DIST-01: **Implemented within scope**, verified on Windows (base fails,
fix packages, the check stops a missing field). DIST-02: **Implemented,
unit-tested; Windows install lifecycle not run.**
