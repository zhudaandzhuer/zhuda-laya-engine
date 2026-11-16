# Verification record: windows-acceptance DEP-01

Task document: `docs/plans/records/windows-acceptance/dep-01-task.md`\
Commits: `6c0b1cb` (engine: typescript-eslint 8.73.0), `5644630` (desktop
host: Electron 45.3.3, Forge 8.0.1, the verify window)\
Date: 2026-11-17

## Advisories

| Package                                     | Before                                     | After |
| ------------------------------------------- | ------------------------------------------ | ----- |
| Engine                                      | 7 moderate (typescript-eslint → minimatch) | 0     |
| Host, Electron 36.9.5 + Forge 7.8.3         | 27 (1 critical `tar`, 21 high)             | —     |
| Host, Electron 36.9.5 + Forge 8.0.1 (tried) | 2 high: Electron, `extract-zip`            | —     |
| Host, Electron 45.3.3 + Forge 8.0.1         | —                                          | 0     |

Engine after the upgrade: lint, format, typecheck and `npm run verify`
pass (880 tests then; 919 on the current tree).

## Desktop host on the Windows host (desktop session, Intel UHD 770)

Packaged from the same consumer web as DIST-02
(`out\webgpu-consumer\consumer\dist\webgpu\web`).

| Step                                                                  | Electron 45.3.3 (`5644630`)                                                                                                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run package` (Forge 8.0.1, Squirrel)                             | exit 0; Setup 157.6 MB, nupkg 156.9 MB                                                                                                                     |
| Setup `--silent`                                                      | 5.9 s, exit 0; desktop and Start-menu shortcuts, uninstall key 1.0.0                                                                                       |
| `--squirrel-install` / `-updated` / `-obsolete`                       | 0.5 / 0.3 / 0.1 s, exit 0 (Squirrel allows 15 s)                                                                                                           |
| Installed `--verify`, started hidden, 3×                              | all PASS in 1.3..1.4 s: WebGPU, `WebGPURenderEngine`, ready, hardware adapter, Chromium 156.0.8078.100                                                     |
| Packaged folder `--verify`, 8× (normal and hidden starts alternating) | 8 of 8 PASS, 2.2..2.8 s                                                                                                                                    |
| `Update.exe --uninstall`                                              | 0.5 s, exit 0; 30 s later no executable, shortcut, uninstall key or process; `app-1.0.0`, `.dead` and `Update.exe` (4.5 MB) remain, Squirrel's own markers |

## The verify that never reported

With Electron 45 the installed `--verify` at first failed: no renderer after
30 s, the console ending after the shader compiles, no error. It was not the
upgrade:

| Runs on the host (old `main.mjs`, same web)    | Passed |
| ---------------------------------------------- | ------ |
| Electron 36.9.5 (DIST-02's installer), 8×      | 1      |
| Electron 45.3.3, 8×                            | 0      |
| Electron 45.3.3 with the fix, 8× + 3 installed | 11     |

Earlier the same night single runs had passed on both. The test page waits
for four animation frames before it reports; Chromium draws none for a
window it takes as not seen. That night the host's new windows were taken
so; why was not found (its display is set never to sleep on mains power,
and no one was at the desk). In `--verify` only, the window is now shown
and keeps drawing (`backgroundThrottling: false`), which made every run
pass; a player's window still rests when hidden. A failed verify now also records `pageError` and
`pageState` (frames drawn in a second, visibility, booted), which it could
not say before.

## Limits

- One machine (Intel UHD 770 selected); RTX, other drivers and a clean VM
  not run.
- The host's consumer web is the one built for DIST-02, not rebuilt from
  the current engine.
- Unsigned local Squirrel package only, as before.

Decision: **Implemented within scope**.
