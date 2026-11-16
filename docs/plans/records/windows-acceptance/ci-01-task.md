# Agent task: windows-acceptance CI-01, acceptance layers in CI

Status: Implemented within scope ([verification](ci-01-verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), CI-01: the Windows CI job ran build,
types, declarations and unit tests only, from a plain folder; the report's
Windows failures (npm launch, symlinks, file-URL imports, browser cleanup)
were in the consumer paths CI never reached. macOS, the engine's own
platform, had no job.

## Goal

Every push and pull request runs, on hosted runners:

- Linux: `verify`, lint, format, a repeated build, and the software-rendered
  browser batches (unchanged);
- macOS: `npm run verify`;
- Windows: the same base checks plus the consumer batches that pack the SDK
  through npm, link dependencies, import by file URL and start and close
  Chrome, from a folder whose name has spaces and CJK; then a check that
  no browser was left running.

The hardware lanes (Intel and NVIDIA, Chrome and Edge, WebGL and WebGPU),
a clean-VM desktop lane and a privileged symlink lane need machines with
those GPUs and rights; hosted runners are not evidence for them. They are
written down as a procedure, not faked in CI.

## Invariants

- No assertion is loosened to make CI pass; a flaky check is made to wait
  for the state it asserts.
- Software rendering in CI is labelled as such; it is not GPU acceptance.

## Scope

- `.github/workflows/verify.yml`.
- `docs/agent-development.md`, "Windows hardware runs".
- Fixes for what the new jobs found: the browser launcher's startup wait,
  the Prefab check's timeout, the runtime-feedback audio wait, the
  fly-through test's fixture paths.

## Acceptance checks

1. A push to `main` with all four jobs green.
2. The Windows job's consumer step fails when a check leaves Chrome
   running (it lists the command lines).

## Rollback

Revert the workflow commit; the fixes stand on their own.
