# Agent task: prefab-live-preview

Status: Implemented; engine watcher verified; consumer/device acceptance deferred
Owner: Codex
Last reviewed: 2026-11-06

## Source requirement

User request: the engine should provide a small live preview window so an
agent can see Prefab and Scene asset edits immediately, and the consumer
`/game1` control bar must match its visual reference without stretched buttons
or color drift.

## Goal

Provide a reusable `zhuda-laya-watch` development command that rebuilds a
consumer and reloads its isolated Prefab preview after source changes, while
keeping the preview and Scene on the same Prefab definition. Fix the consumer
control bar's capsule rendering and reference palette, then prove both paths
with browser evidence.

## Invariants

- Prefab IDs, named child paths and `AssetProvider` logical IDs remain stable.
- The Scene instantiates the same definition used by the isolated preview.
- Consumer gameplay rules and assets remain in `/game1`; the engine exposes only
  generic tooling and runtime support.
- A failed rebuild never reloads a stale preview or reports a passing visual
  result.

## Dependencies

- `packages/compiler/consumer-build.mjs` and `packages/compiler/prefab-preview.mjs`.
- Consumer public SDK pinned to the engine commit containing the implementation.
- `<external-evidence>/game1` assets and its Prefab evidence workflow.

## Scope

### Engine

- `packages/compiler/prefab-watch.mjs`, package bin export, preview workflow
  documentation, and focused tests.
- `packages/core/prefabs/PrefabLibrary.ts` texture-ID hydration for serialized
  `DrawTextureCmd` commands.

### Consumer or adapter

- `<external-evidence>/game1`: control-bar Prefab, runtime dependency pin,
  watch script, evidence and verification report.

## Non-goals

- No game-specific rendering or gameplay logic in the engine repository.
- No FairyGUI integration or second asset/audio authority.
- No claim of device/WebGL parity beyond the recorded browser checks.

## Acceptance checks

1. `npm run verify` passes in the engine repository.
2. A consumer can run `zhuda-laya-watch --project . --port 8891`; editing a
   watched source causes a successful rebuild and an SSE-triggered reload in
   `prefab-preview.html` and `index.html`.
3. `ui/control-bar` isolated preview and Scene use the same source hashes and
   render the capsule nodes without native nine-slice distortion.
4. `/game1` `npm run verify` passes and records the isolated and Scene evidence.

## Evidence to attach

- Engine verify output and focused watch/library tests.
- Consumer Prefab report, Scene report and before/after screenshots.
- Watch server log showing one successful reload and one retained failure.

## Unverified limits

- Real iOS/Android device rendering and long-running file watcher behavior on
  non-macOS filesystems remain unverified.

## Rollback

Last known good engine commit: `09007128b4acfca9636feeedfafa175c040a2f7b`.
If a gate fails, remove the watch command and keep the existing build-only
preview; do not mount an unverified Prefab into the Scene.
