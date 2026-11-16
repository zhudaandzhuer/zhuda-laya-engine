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

## Install lifecycle (DIST-02)

Run on 2026-11-16, 23:50 to 23:56, with the owner's go-ahead, at `6cc7a98`
(the packages built above; 1.0.1 is the same app with the next version
number). Install, update and uninstall ran in session 0 (the SSH job, the
signed-in user's account, so no window reached the desktop); the installed
`--verify` ran in session 1. A snapshot after each step recorded the
install folder, the `zhuda-windows-webgpu-host.exe` files in it, the
uninstall registry entry, shortcuts and running processes
(`D:\claude-workstation\zhuda-windows-batch1\dist-lifecycle\`).

| Step                                                                             | Exit, time             | After it                                                                                                                                     |
| -------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Before                                                                           | —                      | the report's leftover: `app-1.0.0` with its 202 691 072-byte executable, `.dead`, `Update.exe` (243 937 681 bytes); no entry, no shortcut    |
| `Setup.exe --silent` (1.0.0)                                                     | 0, 5.7 s               | leftover replaced ("burning it to the ground"); entry 1.0.0; Desktop and Start-menu (`zhudaandzhuer`) shortcuts                              |
| The installed exe with `--squirrel-install` / `-updated` / `-obsolete`, directly | 0 in 0.7 / 0.3 / 0.1 s | the report's control with the old host had not exited after 7 s                                                                              |
| Installed `--verify`, session 1                                                  | 0, 4.4 s               | `passed:true`, `packaged:true`, root inside `app.asar\web`, WebGPU on Intel `gen-12lp`, not a fallback adapter                               |
| `Update.exe --update=releases-1.0.1`                                             | 0, 3.9 s               | `app-1.0.1` added, entry 1.0.1, shortcuts kept                                                                                               |
| `Update.exe --uninstall`                                                         | 0, 0.9 s               | no executable of the app, no entry, no shortcut, no process; left: Squirrel's own `Update.exe`, `squirrel.exe` and `.dead` (3 799 041 bytes) |
| Again 60 s later                                                                 | —                      | the same                                                                                                                                     |
| Reinstall `Setup.exe --silent`                                                   | 0, 5.5 s               | as after the first install                                                                                                                   |
| Final `Update.exe --uninstall`, checked 30 s later                               | 0, 0.8 s               | as after the first uninstall                                                                                                                 |

Squirrel's own logs on the same machine, before and after:

- `SquirrelTemp\Squirrel-Install.log`: the report's installs at 10:59 and
  12:04 end their hook with `Couldn't run Squirrel hook, continuing: …
OperationCanceledException` after 16 s; the installs at 23:50 and 23:55
  finish the hook within a second with no error.
- `Temp\Squirrel-Uninstall.log`: the report's uninstalls at 11:01 and 12:07
  `Failed to run cleanup hook … OperationCanceledException` after 10 s; the
  uninstalls at 23:54 and 23:55 log no failure.

Afterwards the test install's last three Squirrel files and the empty
Start-menu folder were removed, so the host ended with no install folder,
entry, shortcut or scheduled task of this work.

## Limits and decision

- One machine, the owner's signed-in account, not a clean VM or a test
  account. Install and uninstall from session 0; the firstrun start that
  Setup makes was not seen running (none of the app's processes 10 s after
  either install).
- Squirrel leaves its own `Update.exe`, `squirrel.exe` and `.dead` after an
  uninstall by design; the app's executable is what the report found left
  and is gone.
- Signing and a served update feed are outside this task.

DIST-01 and DIST-02: **Implemented within scope, verified on the report's
Windows host.**
