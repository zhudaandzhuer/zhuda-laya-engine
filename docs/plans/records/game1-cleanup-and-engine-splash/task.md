# Task: finish game1 handoff and add the engine splash mark

Status: Implemented; desktop/build scope verified; physical-device acceptance deferred
Owner: Codex
Last reviewed: 2026-11-06

## Source requirement

User request: finish the interrupted game1 handoff, remove redundant and stale
design artifacts, write the handoff documentation into the consumer project,
and ensure the engine `index.html` always plays a responsive Zhuda × LayaAir
logo animation before the workbench starts.

## Goal

Leave the consumer directory with a small, documented set of source assets and
canonical evidence, pin it to the current public engine revision, and make the
engine build emit a mandatory responsive splash overlay using an engine-owned
brand asset.

## Invariants

- Game rules, consumer art and consumer evidence stay in `game1/`; the engine
  owns only the generic splash asset and build template.
- The consumer continues to use public `zhuda-laya-engine` APIs and a pinned
  Git revision.
- Prefab and Scene evidence remains reproducible; canonical reports and their
  referenced inputs must not be deleted.
- The splash must cover the workbench until its fixed animation completes,
  adapt to portrait and landscape safe areas, and leave the existing app boot
  path unchanged.
- No autoplay audio, second timer authority or engine-private consumer import
  is introduced.

## Scope

Engine: `packages/compiler/zhuda-build.mjs`, `assets/branding/`, generated
`dist/web/index.html`, tests and verification records.

Consumer: `<external-evidence>/game1` cleanup manifest, handoff docs,
dependency metadata, canonical evidence and stale artifact removal.

## Non-goals

- Creating or guessing a GitHub remote for `game1`.
- Changing game rules, payout math, gameplay timing or consumer visual design.
- Reauthoring the existing game assets or deleting source references used by
  the final reports.

## Acceptance

- `npm run verify` and `git diff --check` pass in the engine.
- Generated engine `dist/web/index.html` contains the splash markup, asset and
  responsive animation markers.
- `game1` build, strict typecheck, doctor, unit gates and control-bar parity
  pass against the pinned engine revision.
- A handoff record states the exact engine revision, commands, retained and
  removed artifact classes, result and unverified browser/device limits.

## Evidence

- `docs/plans/records/game1-cleanup-and-engine-splash/verification.md`
- `game1/HANDOFF.md`
- `game1/CLEANUP-REPORT.md`
- `game1/evidence/prefabs/control-bar-parity-report.json`

## Unverified limits

- A real iOS/Android device is not available to this task.
- Browser splash timing is checked through generated HTML and local browser
  execution; device-specific compositor timing remains unverified.
