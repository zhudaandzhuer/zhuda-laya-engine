# Agent task: prefab-editor-play

Status: Implemented within scope; desktop Chrome verified
Owner: Engine tooling and consumer preview adapter
Last reviewed: 2026-11-09

## Source requirement

User requests the missing interactive Agent View shown in their screenshot:
Edit/Play switching, editing drag disabled in Play, and a consumer-owned preview
controller interface. First real selection: Game305 `assets/prefabs/ui/sound.lh`,
including `Panel/Mute` and `Panel/Volume`.

## Goal

An artist can enter Play in either Editor or Agent View, click mute and drag
volume, then stop and recover the exact authored/unsaved edit state.

## Invariants

- Game behavior and assets stay in the consumer; the engine knows no Game305 rules.
- Play mutates only a disposable runtime clone, never source JSON or edit history.
- Save, undo/redo, Inspector and editing drag cannot mutate source during Play.
- One shared public SDK module/renderer; controllers never boot a second engine.
- Every controller listener/resource is disposed on Stop, failure, cancellation,
  timeout and stale async completion. Audio uses the existing mixer contract.
- Agent View controls layout independently of Edit/Play.

## Dependencies

- Existing revision-checked editor, public SDK, named Prefab hierarchy and DPR fix.
- Existing deadline helper and managed runtime lifecycle.
- Consumer Game305 sound panel and its existing visual control semantics.

## Scope

### Engine

- Editor client/server/CLI, public preview-controller types, lifecycle helper,
  strict consumer fixture, API/lifecycle/browser tests and documentation.
- Existing coordinate regression stays green.

### Consumer or adapter

- `<external-evidence>/zhuda.editor.mjs`:
  local preview adapter for original sound panel; game art/Prefab JSON unchanged.
- Evidence remains outside the engine repository.

## Non-goals

- RGS/wallet/spins, automatic execution of game Main, full-game Play/DCC,
  Spine timeline or new audio backend, arbitrary source serialization from Play.

## Acceptance checks

1. API tests: default no-controller behavior, safe project-relative controller
   resolution, deliberate missing/invalid/private-import controller errors.
2. Lifecycle tests: normal/failing/late/timeout mounts, abort, reverse cleanup,
   idempotent Stop and 30 cycles without retained listeners/controllers.
3. Real WebGL at DPR 1/1.5/2: click and drag modify preview state; no editing
   movement, save or history mutation. Agent View/resizing work in Play. Stop
   restores authored state plus existing unsaved edits. Repeated Play/Stop clean.
4. Real Game305 sound.lh: mute On/Off, percent/fill/grip track pointer; original
   source SHA-256 unchanged. Record audio diagnostics separately from speaker sound.
5. Strict public consumer typecheck, `npm run verify`, existing coordinate gate,
   `git diff --check`, independent consumer build and published CI where available.

## Evidence to attach

- Task verification record, exact commands/base commit/source and bundle hashes.
- Neutral browser report/screenshots and external Game305 replay/evidence.
- Lifecycle counts and deliberate failing cases.

## Unverified limits

- Physical mobile, Safari/Firefox, speaker/autoplay and complete game parity need
  separate acceptance. Controller code changes require restarting the editor.

## Rollback

Base `391db934e6103ba873ff518d9d4159ecca2288a0`; revert this scoped editor change.
The existing static Edit workflow and authored game data remain available.
