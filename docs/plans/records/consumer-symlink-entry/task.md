# Agent task: consumer-symlink-entry

Status: Done within scope (macOS; no Windows)  
Owner: the session on the owner's Mac  
Last reviewed: 2026-11-26

## Source requirement

Found on 2026-11-26 while adding scripts-only rebuilds to the watcher
([watch-scripts-only](../watch-scripts-only/verification.md), "Found, not fixed", item 1): a
consumer whose path goes through a symbolic link is built without its component class registry,
and nothing says so. The owner asked for the fix the same day ("在這裡執行此任務").

## Goal

A consumer's `app.js` registers its component classes whichever way the project's directory is
reached, and is the same file either way.

## Invariants

- A build of a project whose path has no link writes the bytes it wrote before.
- A file that the entry imports and the registry imports is one module in the bundle.
- The watcher's kept bundle and the mini-game tool, which use the same plugin, behave as the
  full build does.

## Dependencies

- `zhudaConsumerPlugin` in `packages/compiler/consumer-build.mjs`; esbuild 0.27.1, which names
  every file by its real path.

## Scope

### Engine

- Changed: `packages/compiler/consumer-build.mjs` (how the plugin knows the entry).
- New: `tests/consumer-symlink.test.mjs`. Changed: `tests/watch-scripts-only.test.mjs` (the
  workaround for this defect is gone).
- Documents: `docs/consumer-tooling.md`, `CHANGELOG.md`, `HANDOFF.md`, the watch-scripts-only
  record and notes (the item is marked fixed).

### Consumer or adapter

- None.

## Non-goals

- A project whose entry file is itself a link to a file elsewhere: the source guards do not read
  linked files and refuse such a project before anything is bundled, as before.
- The engine workbench reached through a link (see the verification record's limits).

## Acceptance checks

1. `node --test tests/consumer-symlink.test.mjs`: fails before the fix (no class registered
   through the link), passes after; the bundle through the link has the hash of the bundle
   through the real path.
2. The candidates of `games/zhuda-match`, `games/zhuda-hunt` and `prefabs/viewer3d` keep the
   fingerprints in `local-results/watch-fast-path/after-fingerprints.txt`.
3. `npm run verify`, `npm run lint`, `npm run verify:games`, `npm run format:check` for the files
   touched.

## Evidence to attach

- Test/build output: in [verification](verification.md).
- Browser/WebGL or device report: none (no runtime code changed).

## Unverified limits

- Windows (junctions, drive-letter case, substituted drives) and Linux.

## Rollback

`44228176` is the commit before this task; reverting this task's commit restores the old
comparison and the test's workaround together.
