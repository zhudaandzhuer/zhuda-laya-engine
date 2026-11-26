# Agent task: watch-scripts-only

Status: Done within scope (macOS, one machine; no Windows, no phone on the LAN)  
Owner: the session on the owner's Mac  
Last reviewed: 2026-11-26

## Source requirement

The owner compared this engine's edit loop with a Cocos Creator set-up a friend described
(2026-11-26): first start 18.1 s, then a median of 0.39 s from saving one TypeScript file to the
build being ready to refresh. Measured here the same day (Apple M4, Node 26,
`zhuda-laya-watch --candidate`, `src/Main.ts` saved with the same bytes, the watcher's 120 ms
debounce included): `games/zhuda-match` 0.29 s, `games/zhuda-hunt` 0.88 s, `prefabs/viewer3d`
1.46 s. The script bundle is not the cost (`esbuild` with the consumer plugin and minify: 71 to
103 ms; a kept context's rebuild: 9 to 49 ms). The rest of each rebuild is the release-grade
build: assets and engine libraries copied again, pages written, every file hashed, the ZIP packed.

The task as given: a fast path in `zhuda-laya-watch` for saves that change only scripts, so that
a 3D project is ready to refresh in about 0.2 s; its output must not be mistaken for a release or
an accepted candidate; the time of each rebuild in the log; a failed fast build behaves as a
failed build does now; a plain `zhuda-laya-build` stays byte for byte what it is.

## Goal

With `zhuda-laya-watch --candidate`, saving a file under `src/` of a project with no prefab
preview tells the page to reload after the debounce plus the time of one script bundle, and what
the page then loads is the `app.js` a full build would write.

## Invariants

- The output directory, `game.zip` and `consumer-build.json` are written only by a full build:
  a scripts-only rebuild writes nothing.
- A fingerprint is served only with the files it was computed from.
- `zhuda-laya-build`, with or without `--candidate`, writes the bytes it wrote before.
- A failed build, of either kind, leaves what the page had and shows the error over it.
- A watcher without `--candidate` behaves as before: every build is a gated release.

## Dependencies

- `packages/compiler/prefab-watch.mjs`, `consumer-build.mjs` (`zhudaConsumerPlugin`, the source
  gates), `consumer-accept.mjs`, `prefab-check.mjs`, `prefab-dependencies.mjs`, `ast-scanner.mjs`;
  esbuild 0.27.1 (`esbuild.context`).
- `games/zhuda-match`, `games/zhuda-hunt`, `prefabs/viewer3d` for the measurement.

## Scope

### Engine

- New: `packages/compiler/consumer-scripts.mjs` (the classification, what keeps a project on the
  full build, the kept bundle, the stale manifest), `scripts/measure-watch.mjs`,
  `tests/watch-scripts-only.test.mjs`.
- Changed: `packages/compiler/prefab-watch.mjs` (the build loop, `--full-builds`, an in-memory
  overlay in the preview server, the log line), `consumer-build.mjs` (`consumerScriptOptions` and
  `auditConsumerGates` taken out as functions; the build calls them where the code was),
  `prefab-check.mjs` (refuses a manifest marked stale).
- Documents: `docs/consumer-tooling.md`, `docs/prefab-workflow.md`, the routes
  `new-game-project`, `game-2d`, `visual-content-prefab`, `CHANGELOG.md`, `HANDOFF.md`.

### Consumer or adapter

- None. No reference game is changed (one was edited and restored for the browser check).

## Non-goals

- Prefab preview bundles (`prefabPreview`): such a project keeps the full build on every save.
- A release watcher (no `--candidate`): unchanged.
- Hot replacement of modules in a running page: the page still reloads.
- A shorter debounce, a build on exit, a background full build after each save (each was weighed
  and left out: see the verification record).

## Acceptance checks

1. `node --test tests/watch-scripts-only.test.mjs tests/prefab-watch.test.mjs`: the path
   classification, the fallbacks to the full build, the stale manifest, the failed build, and a
   real consumer whose scripts-only bundle equals the next full build's `app.js`.
2. `node scripts/measure-watch.mjs --project <dir>` and the same with `--full-builds`, for the
   three projects, nine saves each: the median falls to about 0.2 s for the 3D projects.
3. A candidate build of `games/zhuda-match` and `games/zhuda-hunt` by the changed code has the
   fingerprint, the ZIP and the ZIP's sizes of the unchanged code.
4. In a browser on the watcher's page: a visible string of `games/zhuda-match` is edited, the
   page reloads by itself and shows it; the file is restored and `git status` is clean for it.
5. `npm run verify`, `npm run lint`, `npm run verify:games`, `npm run format:check` for the files
   touched.

## Evidence to attach

- Test/build output: the commands' results in [verification](verification.md).
- Browser/WebGL or device report: the stage's text read in the page before and after, the
  watcher's log, one picture (`local-results/watch-fast-path/edited-title.jpg`).
- Resource/lifecycle report: none (no runtime code changed).
- Measurements: `local-results/watch-fast-path/*.json`.

## Unverified limits

- Windows and Linux (file events, path separators are handled in code and by a unit test only).
- A phone on the LAN through `--host 0.0.0.0`.
- A project whose path is a symbolic link.
- A quiet machine for every run: see the load average beside each number.

## Rollback

`4d881cf6` is the last commit before this task. `zhuda-laya-watch --full-builds` gives the old
behaviour without reverting; reverting the task's commit removes the flag and the fast path
together, and no build output depends on either.
