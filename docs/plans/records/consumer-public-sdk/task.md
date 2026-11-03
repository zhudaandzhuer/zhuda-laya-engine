# Task: migrate consumer prefab pipeline to the public SDK

Status: In progress  
Owner: Engine tooling and consumer integration  
Last reviewed: 2026-11-03

## Source requirement

The Gates of Olympus consumer still contains a copied `packages/` engine and
imports engine source paths directly. Its previous dynamic Scene workflow must
use the verified Prefab definition in both the isolated preview and the game,
through the pinned public `zhuda-laya-engine` entry.

## Goal

Build and typecheck the consumer with a pinned public SDK while preserving the
Prefab-first control-bar provenance and the existing game behavior gates.

## Invariants

- `ui/control-bar` remains the same verified Prefab definition in preview and
  the main Scene.
- Game rules, assets, audio, and scene-specific renderers remain consumer-owned.
- Consumer source code does not import engine private paths or declare an
  untyped global `Laya` binding.
- Provider IDs, resource leases, cancellation, and disposal stay on the
  existing public contracts.

## Dependencies

- Engine commit `012d6ff4b50545b4300bc71daf695acb1d3a50eb` on GitHub.
- Consumer `/Users/yaowei/Desktop/game1` and its `AGENTS.md`.
- `docs/prefab-workflow.md`, `packages/compiler/consumer-build.mjs`, and the
  public declarations under `packages/types/`.

## Scope

### Engine

- Resolve a relative consumer `engineRoot` against the consumer project root in
  the public build entry, and make the published CLI shims execute their
  entrypoints when installed through `node_modules/.bin`.
- Add a regression test for that resolution.

### Consumer or adapter

- Replace copied-engine imports with `zhuda-laya-engine` public imports.
- Point build, doctor, and prefab checks at the installed pinned SDK.
- Remove the copied `packages/` tree after the migration is verified.
- Keep the existing Prefab definitions, provenance bridge, and visual evidence.

## Non-goals

- No game-rule rewrite or asset relocation.
- No automatic conversion of every dynamic renderer into serialized content in
  this change; migrate each visual component through the Prefab gate.
- No device-performance claim from desktop browser evidence.

## Acceptance checks

1. `npm run build` and `npm run typecheck` from the consumer use the pinned
   SDK and produce the same Prefab preview and Scene bundle.
2. `node <sdk>/packages/compiler/zhuda-doctor.mjs --project <consumer>` passes
   with no `COPIED_ENGINE`, `PRIVATE_ENGINE_IMPORT`, or `UNTYPED_LAYA` issues.
3. The control-bar isolated check and main Scene CDP check report the same
   Prefab ID, source hash, provider, and passing visual comparison.
4. Existing consumer unit and game gates remain passing.
5. Engine `npm run verify`, `git diff --check`, and a clean `git status --short`
   pass from the engine repository.

## Evidence to attach

- Engine verification record and commit SHA.
- Consumer build/type/doctor output.
- Isolated control-bar report and main Scene provenance report.
- Existing consumer gate and browser reports.

## Unverified limits

- Real iOS/Android device rendering and performance.
- Full migration of every dynamic renderer to a serialized Prefab.

## Rollback

Return the consumer to the last working copied-engine checkout and keep
`012d6ff4b50545b4300bc71daf695acb1d3a50eb` as the engine rollback point.
