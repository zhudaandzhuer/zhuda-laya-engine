# Agent task: consumer-route-hardening

Status: Implemented; static consumer route verified; browser/device acceptance deferred

Owner: Zhuda engine tooling

Last reviewed: 2026-11-06


## Source requirement

User request: 「去完整優化過來，把我們自己的部分做好」 after reviewing a
Three.js-only HTML prototype and a partially compliant Zhuda consumer ZIP.

## Goal

Make the canonical Zhuda consumer route discoverable from the repository root
and make the consumer build/Doctor reject common false integrations before an
agent can claim that a project is powered by `zhuda-laya-engine`.

## Invariants

- Consumers use stable public SDK imports and a pinned engine dependency.
- Game rules, assets and deployment remain consumer-owned.
- Static guards describe configuration only; real WebGL and device evidence remain separate gates.
- Existing engine builds and valid consumer builds retain their source and output lifecycle guarantees.

## Dependencies

- `packages/compiler/consumer-build.mjs`
- `packages/compiler/zhuda-doctor.mjs`
- `packages/compiler/consumer-guards.mjs`
- `docs/3d-integration.md`, `docs/prefab-workflow.md`, `AGENTS.md`
- Existing consumer-build and Doctor tests

## Scope

### Engine

- README and Chinese README consumer onboarding.
- New canonical consumer route documentation and starter scaffold CLI.
- Consumer guards, Doctor output and focused regression fixtures.
- Package exports and CLI metadata for the scaffold.

### Consumer or adapter

- No consumer repository or game asset changes.

## Non-goals

- Claiming real device support or WebGL performance from static checks.
- Rewriting the Prefab workflow or moving game assets into the engine repository.
- Blocking legitimate engine-owned Three.js tooling outside a consumer `src/` tree.

## Acceptance checks

1. `zhuda-laya-init` creates a runnable consumer skeleton with a pinned SDK
   dependency, required HTML markers and the documented verification scripts.
2. A fixture using Three.js, an inline Zhuda facade, an unpinned SDK or no SDK
   boot fails with file/line guidance from `auditConsumerSources` and Doctor.
3. A valid public-SDK fixture passes the consumer build and preserves its source.
4. `npm test`, `npm run verify`, `git diff --check` and `git status --short`
   complete from the repository root.

## Evidence to attach

- Test/build output: root `npm run verify` transcript.
- Browser/WebGL or device report: unavailable for this documentation and static
  tooling change; existing consumer reports remain the source of those claims.
- Resource/lifecycle report: existing consumer-build archive and source hash
  tests.

## Unverified limits

- The scaffold does not prove a consumer's real WebGL draw or device behavior.
- No static detector can prove that gameplay uses the engine for every frame;
  the generated route report must keep that evidence boundary explicit.

## Rollback

Revert this task's files to the last known good engine commit `0127bd2` if the
consumer build or Doctor gates regress. Existing consumers can continue using
the public SDK and explicit `runConsumerBuild` path.
