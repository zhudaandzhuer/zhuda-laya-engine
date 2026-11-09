# Agent task: prefab-editor

Status: Accepted
Owner: Engine tooling
Last reviewed: 2026-11-07

## Source requirement

The engine currently provides isolated Prefab preview and watch reload, but no
generic Web editor that lets an artist select nodes, change layout properties,
drag the result in the real Laya preview, and save the same static definition.
The request is to provide that engine-owned workflow for any consumer `.lh`
Prefab and `.ls` Scene.

## Goal

`zhuda-prefab-editor` starts a local Web editor for one consumer `.lh` or `.ls`;
the editor renders the real Zhuda/Laya definition at its authored design size,
exposes a node tree and common 2D properties, supports pointer dragging plus
undo/redo, and saves atomically with revision conflict protection and a backup.

## Invariants

- The editor is a tool, not a consumer game or asset repository.
- The saved source remains logical `.lh`/`.ls` JSON; preview-only URLs never enter it.
- Project and prefab paths cannot escape the requested project root.
- Invalid JSON, duplicate child names, unsupported node types and stale writes
  are rejected without replacing the last good file.
- Runtime preview and saved source use the same hierarchy definition.
- CSS/design coordinates remain separate from backing-pixel DPR coordinates.

## Dependencies

- `ZhudaPrefab.instantiate`, `ZhudaEngine.boot`, public static asset types.
- Pinned LayaAir 3.4.2 libraries in `vendor/laya-3.4.2/libs`.
- Node's HTTP, filesystem and crypto APIs; esbuild for the browser editor bundle.

## Scope

### Engine

- `packages/compiler/prefab-editor-server.mjs`
- `packages/compiler/prefab-editor.mjs`
- `packages/compiler/prefab-editor-client.ts`
- package bin, tests and editor documentation.

### Consumer or adapter

- None. The editor serves a selected consumer project directory and never copies
  consumer content into the engine repository.

## Non-goals

- Full Unity-style 3D, Spine timeline, particle graph or scene editor.
- Gameplay rules, scene assembly, payout/network logic or deployment.
- Removing Prefab evidence gates or bypassing public SDK boundaries.

## Acceptance checks

1. Unit tests reject traversal, malformed hierarchies, duplicate names and
   stale revisions; a failed save leaves the original bytes unchanged.
2. A valid `.lh` and `.ls` can be fetched, edited, saved through the API,
   restored by undo/redo in the browser client, and receive a `.bak` containing
   the previous valid bytes.
3. The CLI serves a real Laya canvas, loads either source definition through
   `ZhudaPrefab`, and exposes stable named node paths and common inspector
   properties in authored design pixels.
4. `npm run verify`, `git diff --check` and the focused editor tests pass.

## Evidence to attach

- Test/build output: `tests/prefab-editor.test.mjs` and `npm run verify`.
- Browser/WebGL or device report: manual local URL and editor health overlay.
- Resource/lifecycle report: editor reload/dispose path and save revision.

## Unverified limits

- Spine and arbitrary 3D assets remain preview-only and are reported as such.
- Browser/device visual acceptance still belongs to the consumer Prefab gate.

## Rollback

If the editor build or API validation fails, the existing read-only Prefab
preview and `zhuda-laya-watch` remain the fallback. The server never writes a
new source file before validation and atomic replacement succeeds.
