# Agent task: windows-acceptance DEP-01, dependency advisories

Status: Implemented within scope ([verification](dep-01-verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), DEP-01: `npm audit` reported 7
moderate advisories for the engine and 27 for the desktop host example
(`examples/windows-webgpu`: 1 critical `tar`, 21 high).

## What was found

- Engine: all seven came from one development chain, typescript-eslint
  8.46.4 → `@typescript-eslint/*` → `minimatch` (ReDoS). Nothing reaches the
  published SDK or a consumer build.
- Desktop host, Electron 36.9.5 with Forge 7.8.3: the build tools (Forge
  and its makers: `tar`, `@electron/get`, `extract-zip` and others) carried
  most; Electron itself carried the shipped ones. With Forge 8.0.1 and
  Electron kept at 36.9.5, two high remain: Electron (fixed after 42.11.15
  and from 43.0.0) and `extract-zip` (through Electron's download). Electron
  45.3.3 with Forge 8.0.1: 0.

## Goal

0 advisories on both, each upgrade checked by the checks it can break, no
`npm audit fix --force`.

## Invariants

- The engine's public SDK and its consumers are unchanged.
- The desktop host still packages, installs, runs its hooks fast, verifies
  WebGPU when installed, and uninstalls clean (DIST-01, DIST-02).

## Scope

- Engine: `package.json` / `package-lock.json` (typescript-eslint 8.73.0).
- Host: `examples/windows-webgpu/package.json` and lock (Electron 45.3.3,
  Forge 8.0.1, pinned), `main.mjs` (Squirrel hooks start no GPU process;
  `--verify` waits for the renderer to settle, shows its window and keeps
  drawing, and reports what the page said), `README.md`.

## Acceptance checks

1. `npm audit` 0 for the engine and the host.
2. Engine: lint, format, typecheck, `npm run verify`.
3. Host on the Windows host's desktop session: package, install, the
   install / updated / obsolete hooks well inside Squirrel's 15 s, the
   installed `--verify` passing WebGPU on hardware (several times, started
   hidden), uninstall leaving no executable, shortcut or uninstall key.

## Rollback

Revert the commits; the host goes back to Electron 36 and its advisories.
