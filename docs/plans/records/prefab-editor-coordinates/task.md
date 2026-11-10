# Agent task: prefab-editor-coordinates

Status: Implemented within scope; macOS Chromium verified
Owner: Engine tooling
Last reviewed: 2026-11-09

## Source requirement

User report against SDK 1.15.0 / `77acfc78846080ec7b60c65ca58c1740562b2edc`:
1. DPR 2 renders a nominal 434 CSS px canvas at 217 px, separating artwork from selection.
2. Nested selection ignores ancestor translation, scale and rotation.
3. Dragging must convert the cursor to parent-local coordinates.
4. Browser regression must assert positions at DPR 1 / 1.5 / 2, browser zoom,
   resize, Agent View, nested selection and drag, including save/reload.

Source: `packages/compiler/prefab-editor-client.ts`, and the external read-only
reproduction `<external-evidence>/README.md`.
Handoff: Codex chat `01a1a481-8fdb-77f3-9c6e-f815f5940cad` confirms editor tooling is on upstream main.

## Goal

The real editor canvas, selected rectangle, pivot and dragged point agree in
client CSS coordinates at every tested DPR and ancestor transform.

## Invariants

- Authored Prefab/Scene design coordinates remain unchanged unless the user edits them.
- Runtime retains ownership of Retina backing resolution and Laya input transforms.
- Editor saves retain revision checks, backup, validation and undo/redo.
- Consumer art and production assets remain outside this engine repository.

## Dependencies

- Existing `ZhudaEngine.boot` fixed design/container sizing and runtime resize.
- Laya 3.4.2 public `Sprite.localToGlobal` / `globalToLocal` declarations.
- Existing editor server, real WebGL engine files and isolated Chrome CDP helper.

## Scope

### Engine

- Editor client and overlay CSS; neutral browser fixture and npm verification entry.
- Managed runtime Retina CSS transform composition, regression tests and regenerated SDK/showcase bundles.
- Editor docs and task/verification records; existing sizing seam only if a
  measured defect requires it.

### Consumer or adapter

- Read-only independent consumer reproduction/build, with evidence outside engine.

## Non-goals

- Game rules/art/scene changes, consumer vendor patches, new runtime APIs,
  3D editing, full DCC functionality, version bump or release publishing.

## Acceptance checks

1. A failing pre-fix neutral WebGL fixture proves canvas/overlay position errors.
2. `npm run verify:prefab-editor`: actual pixel bounds and transformed rectangle
   corners/pivot agree within raster tolerance; pointer drag stays attached with
   nested translated, rotated, scaled and reflected parents. Cover `.lh` / `.ls`,
   DPR 1 / 1.5 / 2, resize, Agent View, desktop browser zoom, save/reload,
   undo/redo, cancel/focus and multiple pointers where relevant.
3. `node --test tests/prefab-editor.test.mjs`; `npm run verify`; `git diff --check`.
4. Independent consumer build and read-only editor replay with upgraded engine
   bundle; do not modify authored UI to compensate for the defect.

## Evidence to attach

- Task-local verification record, commands, base commit and changed-source hashes.
- Neutral WebGL JSON measurements and screenshots in an external temporary directory.
- Independent consumer report in its existing evidence tree.
- Explicit limits for unavailable devices and browser engines.

## Unverified limits

- Physical mobile/Windows and non-Chromium browsers require separate acceptance.

## Rollback

Base commit `77acfc7`. Common runtime correction also addresses the measured
DPR-2 Prefab-preview failure in GitHub Actions run `42596012076`. Revert this scoped patch if regression gates fail; preserve
failing measurements and keep the consumer's authored asset positions unchanged.
