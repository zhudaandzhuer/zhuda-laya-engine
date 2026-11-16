# Agent task: windows-acceptance batch 2, desktop delivery (DIST-01, DIST-02)

Status: In progress\
Owner: Engine/toolchain\
Last reviewed: 2026-11-16

## Source requirement

[Windows acceptance plan](plan.md), batch 2, items DIST-01 and DIST-02 of
the report (`windows-issues-and-remediation.md` section 4): the unmodified
`examples/windows-webgpu` failed `electron-forge make` for missing
Authors/Description; its Squirrel install/uninstall hooks timed out, and an
uninstall that exited 0 left the main executable (243 937 681 bytes)
behind. `main.mjs` reached `app.whenReady` with no Squirrel branch before
it. MEM-01 of the same batch is a separate investigation and record.

## Goal

The example host packages from a clean checkout, and a Squirrel install,
update or uninstall start does its shortcut work and exits within the hook
time without starting the host.

## Invariants

- The host's verify behaviour, origin, staging and evidence are unchanged.
- A Squirrel event start never opens a window, loads the renderer or
  registers the normal lifecycle handlers.
- `--squirrel-firstrun` stays a normal start.
- No new runtime dependency (`electron-squirrel-startup` is not added; the
  same work is done in `squirrel.mjs`, ESM-safe and bounded).

## Scope

### Engine

- `examples/windows-webgpu/package.json` (`description`, `author`),
  `bundle.mjs` (`missingPackageMetadata`, checked when staging, which runs
  before every package build), new `squirrel.mjs`, `main.mjs`.
- `tests/desktop-host.test.mjs`.

### Consumer or adapter

- A consumer that ships this host sets its own product name, author and
  app ID; the values here are the engine example's.

## Non-goals

- Signing, auto-update service, WebView2, Steam.
- MEM-01.

## Acceptance checks

1. `node --test tests/desktop-host.test.mjs`: metadata present and checked;
   event parsing (install, updated, uninstall, obsolete handled; firstrun and
   other arguments not; non-Windows never); shortcut arguments passed to
   `..\Update.exe`; exit 0 after Update.exe ends or after the time limit;
   startup code only behind `!squirrel`.
2. On the Windows host from a clean checkout: `npm ci` and `npm run package`
   in `examples/windows-webgpu` with `ZHUDA_WEB_ROOT` set to a consumer
   build; the installer is produced.
3. On Windows: install → run installed `--verify` → uninstall → check again
   after a delay: event timings and exit codes, shortcuts, processes and
   the install folder recorded; no main executable left after uninstall.

## Unverified limits

- Run on the owner's Windows host under the SSH administrator account, not a
  clean VM or a test account; update and reinstall are recorded only if run.

## Rollback

Revert the DIST commits; the example then fails packaging as before.
