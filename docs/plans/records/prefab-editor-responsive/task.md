# Agent task: prefab-editor-responsive

Status: Implemented within scope; desktop Chrome verified
Owner: Editor tooling
Last reviewed: 2026-11-09

## Source requirement

User screenshot: an embedded preview window clips the title and right toolbar
controls while displaying `sound.lh` in Agent View. User asks for adaptation to
the actual available window. Source image remains outside this repository.

## Goal

All toolbar actions remain visible and reachable; the complete canvas fits the
available preview area after resize, zoom, layout changes and Agent/Edit/Play
switches. Narrow Editor panels remain accessible through vertical scrolling.

## Invariants

- Authored design coordinates/assets, DPR backing resolution and saved data stay unchanged.
- Play input, cleanup, unsaved edits, history and revision-checked save semantics remain intact.
- The runtime owns canvas sizing/input; the editor fits its container.
- Game-specific screenshots/artifacts remain outside this engine repository.

## Dependencies

- Existing fixed-design runtime, canvas/overlay coordinate fixes and Play controllers.
- Current editor uses a 54px toolbar subtraction, minimum grid column widths,
  an extra Agent View grid row and window-resize-only fitting.

## Scope

### Engine

- Editor layout CSS and responsive sizing observers/scheduling.
- Browser viewport tests plus existing Play/coordinate regressions; docs/evidence.

### Consumer or adapter

- Read-only Game305 sound-panel replay at real project dimensions.
- Refresh local editor services after verifying the replacement, without changing game source or forcing browser reloads.

## Non-goals

- Reauthoring UI coordinates, new gameplay, changing SDK runtime scaling or Play API,
  redesigning art or approving full game/device parity.

## Acceptance checks

1. Pre-fix browser measurements fail for the unused Agent row at 800px and clipped toolbar controls in a 600px embedded pane.
2. `npm run verify:prefab-editor-responsive`: widths 320–1440, short windows,
   DPR 1/1.5/2, real browser zoom, embedded/container-width changes without an
   outer window resize, dynamic toolbar height and Editor/Agent/Play switches.
   Assert toolbar bounds/hit targets, no horizontal overflow, panel accessibility,
   complete canvas bounds and actual corner pixels; native Play clicks still work.
3. Existing 174 coordinate checks, Play lifecycle gate, engine `npm run verify`,
   strict client typecheck and `git diff --check` remain green.
4. Actual Game305 sound.lh stays byte-identical; narrow/zoomed snapshots and native
   interaction are stored in external consumer evidence. Existing consumer build passes.

## Evidence to attach

- Pre/post browser JSON, screenshots, source hashes and exact commands.
- Verification record, unit/full verification output, consumer evidence and CI.

## Unverified limits

- Physical devices, OS accessibility zoom and non-Chromium engines need separate checks.

## Rollback

Base `186eecbed6b03144fef453b0fdda2e3f86b052e7`; revert the scoped layout change.
