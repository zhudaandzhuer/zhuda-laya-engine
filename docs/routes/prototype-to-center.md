# Route: an outside prototype moved into the game centre, through the prefab gates first

A 2D prototype made in a folder outside the workspace (carrying its own copy of the engine, a
vendor folder and old evidence) becomes ZhudaGameCenter `games/<game>/client` and `server/`
(outside this repository). It depends only on the public engine package; every picture is first
registered with its hash and made a prefab that is compared alone in a browser, and only then
does the scene mount the same definition; the prototype is deleted only when every gate has
passed. Dungeon Spin (迷宮一閃; the workspace's `games/dungeon-spin`, the original game, removed
after it was taken apart) was moved this way on 2026-11-06, and on 2026-11-25, when it was taken
apart into shared modules, its gates were run again on the newer engine. Checked only in
headless Chrome on a desktop.

- **Id:** `prototype-to-center`
- **Kind:** workflow
- **For:** A prototype from outside the workspace (or any 2D project that is not in the game centre) is to become a game in the workspace's `games/`, pinned to an engine commit, whose picture has passed the prefab gates.
- **Checked on:** desktop WebGL (Apple M4, headless Chrome 158); no phone
- **Status:** 2026-11-25: Dungeon Spin's gates run again on engine `def94aa`. After a new
  acceptance the build, the types, the Doctor and the tests all pass; three prefabs at 0 pixels
  from the original reference pictures, 30 cycles each; the module taken out of it passed once
  more in a minimal game.
- **Reference consumer:** `prefabs/2d/dungeon-spin/source/prefab-check/` (the smallest game that
  passes the gates), `prefabs/2d/dungeon-spin/prefabs.ts`, `prefabs/tests/dungeon-spin.test.mjs`
  (the boundary test and the asset-manifest test).
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c` (the
  original move was at `dd9b5fd`)

Everything on this page was done and checked on or before 2026-11-25, when the prefab library
was still in the ZhudaGameCenter workspace, beside the engine. The paths are written as they are
in this repository; nothing was run again from them.

## When to take this route

- Fits: a project outside the workspace (a loose folder, someone else's repository, a
  single-file prototype) that is to move into the workspace's `games/` and claim to be "made
  with the engine"; its picture is images, atlases and `.lh` nodes.
- Does not fit:
  - A new game: [new-game-project](new-game-project.md), [game-2d](game-2d.md).
  - A game already in the workspace that is only to be retired:
    [game-to-prefabs](game-to-prefabs.md).
  - Prefabs of 3D models: [visual-content-prefab](visual-content-prefab.md),
    [model-from-dcc](model-from-dcc.md).
- This route does not repeat the five gates of
  [visual-content-prefab](visual-content-prefab.md); it gives only what a move really takes, and
  what was measured.

## Tools

- The engine, pinned in `package.json` (`github:<owner>/zhuda-laya-engine#<commit>`):
  `zhuda-laya-build` (`--candidate`), `zhuda-laya-accept` (`-- --capture` only makes the
  reference pictures), `zhuda-laya-doctor`.
- `node --test`: the boundary test and the asset-manifest test (example:
  `prefabs/tests/dungeon-spin.test.mjs`).
- Go (when there is a server): `go test ./...`, `go vet ./...`.

## Steps

1. **Bring only what is the game's own.** Not the engine's `packages/`, `vendor/laya-*`,
   `dist/`, the old `legacy/` runtime or archives of old evidence (Dungeon Spin left one of
   227 MB behind). Keep: the game's code, its pictures, its data tables and its prefab
   definitions.
2. **The project's shape.** The workspace's `games/<game>/client` (`package.json` pinned to a
   commit, `zhuda.config.json`, `src/Main.ts`, `public/index.html` with
   `<meta charset="utf-8">`, `<!-- ZHUDA_LIBS -->` and `<!-- ZHUDA_ENTRY -->`) and the
   workspace's `games/<game>/server`. Confirm with `tsc --strict` and `zhuda-laya-doctor`:
   imports from the root of `zhuda-laya-engine` only, no `packages/core`, `packages/types` or
   `vendor/`, and no `declare const Laya: any` (written as a test: the boundary case in
   `prefabs/tests/dungeon-spin.test.mjs`).
3. **Register every file.** `assetManifest`: `{ id, kind: 'image' | 'scene', bytes, sha256 }`,
   given to
   `new DirectoryAssetProvider({ baseUrl, manifest, timeoutMs: 15_000, maxBytes: 20_000_000 })`;
   a test works out each file's size and SHA-256 again, and confirms that every picture that
   ships is in the manifest and that the manifest lists nothing more.
4. **One prefab for each picture.** The `.lh`: a Sprite root with one `Image` child (its name is
   the `node` of the check, its `skin` is the picture's id). The definition:
   `{ id: 'visual/…', asset: 'prefabs/….lh', textures: ['….png'], states: { idle: { <node>: { visible: true } } } }`.
5. **The preview module.** `prefabPreview` in `zhuda.config.json` points to a module that
   exports `definitions` and `createAssetProvider()`. The engine's preview page calls
   `createAssetProvider()` **with no arguments**, so its default `baseUrl` must be a place the
   preview page can see (`./assets/`, or `./common/…/assets/` for what came by sync).
6. **Write the checks.** Each entry of `prefabChecks`: `id`, `state`, `node`, `width`, `height`
   (the size that picture has in the game), `dpr: 1`, `cycles: 30`, `baseline`, `output`.
7. **Pass the gates.** `npm run build:candidate`; then, the first time,
   `npm run accept:prefabs -- --capture` (it only makes `references/*.png`, which a person must
   look at); then `npm run accept:prefabs` (it publishes only when all three pass, and writes
   `evidence/prefab-*.json` in schema 2); then `npm run build` (the release build accepts only
   passing evidence that matches this build).
8. **The scene mounts the same one.** The scene uses the same `definitions` and the same
   `createAssetProvider()`; the pictures a moving picture needs are taken from the mounted
   prefab instance (`mountAtlasPrefab` of `prefabs/2d/prefab-atlas`), with no other URL and no
   `Laya.loader`. A test checks that every id is `instantiate`d in the scene's source.
9. **The server is verified apart.** `go test ./...`, `go vet ./...`, a health check; recorded
   apart from the client's results.
10. **Evidence is recorded apart, and deleting the prototype comes last.** One record each for
    the prefabs, the scene, the server and the devices (each written only up to the level it
    claims); delete the prototype only when all have passed, and write in the report what was
    deleted and how to restore it.

## Pitfalls

- **Evidence goes stale with any change of code.** The release build reports
  `missing, failed or stale prefab evidence`. Adding one comment line to the entry file does it;
  putting one more unrelated file under `public/` does not (measured on 2026-11-25). After every
  change of code: `build:candidate`, then `accept:prefabs`, then `build`. This is why the shared
  viewer carries no `prefabChecks`, and a module is checked in a minimal game of its own.
- **A changed engine pin makes it stale in the same way.** Dungeon Spin went from `dd9b5fd` to
  `def94aa`: with not one line of code changed, acceptance was run again, the three prefabs were
  at 0 pixels from the original reference pictures over 30 cycles, and the build passed. Try
  this first, before suspecting the code.
- **Written in the spec is not the same as done.** Dungeon Spin's spec said "sound goes through
  the engine's `IframeSoundAdapter`; there is no second mixer", and the code in fact opened its
  own `AudioContext`; `zhuda.config.json` said `dprCap: 1.5`, boot never passed it, and the
  canvas stayed 572×1024 scaled by CSS; a 3D stone corridor that was built besides was wholly
  covered by an opaque background (taking it out gave 0 pixels of difference). The gates look
  after prefabs only and stopped none of these. When moving, go through the spec against the
  code item by item, and measure whatever can be measured (take one layer out and compare
  pixels).
- **Top-level `await` fails the build.** The build target is ES2020: use
  `async function main()`.
- **Giving `container` at boot changes show-all.** A fixed portrait design either gives no
  `container` (Laya scales by itself) or gives `designSize`; the two draw differently (920,000
  pixels of difference at 1280×720). Do whichever the prototype did.

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| Prefab evidence is bound to the built code, so several projects cannot share one set of it | Every module that is to be shared carries a minimal game made of it alone (`prefabs/2d/dungeon-spin/source/prefab-check/`), where its checks run and its evidence is kept |
| The gates do not check the other promises of a spec (a single sound output, the DPR cap, whether a layer can be seen) | Compare by hand when moving; write what can be measured as a test or a comparison |

## Checks

```sh
cd <workspace>/games/<game>/client                    # the game is in the workspace, outside this repository
npm run build:candidate && npm run accept:prefabs     # every prefabChecks entry: passed, differentPixels 0, lifecycle 30
npm run build && npm run typecheck && npm run doctor && npm test
cd ../server && go test ./... && go vet ./...
```

2026-11-25 (a copy of Dungeon Spin with only the pin changed, to `def94aa`): all three accepted,
0 pixels, 30 cycles; the build, the types, the Doctor (HEALTHY, 0 violations), 6 tests, the Go
tests and vet all pass. The module taken out of it was run once more with
`prefabs/2d/dungeon-spin/source/prefab-check/`: the same three at 0 pixels and 30 cycles, with
definition hashes and source SHA-256 equal to those of the original evidence.

## Not checked

- The prototype itself (`DungeonSpin-zhuda-laya-engine`, a folder outside the workspace) was
  deleted on 2026-11-06; the two steps "what to leave behind" and "delete the prototype" rest
  only on the report of that time and were not done again on 2026-11-25.
- No phone, no packaging; the prefab checks ran at DPR 1 only.
- `accept:prefabs -- --capture` was not used on 2026-11-25 (the original reference pictures were
  kept).

## Boundaries

- The game: its pictures, `.lh` files, definitions, reference pictures and evidence, its rules,
  its server and its device records.
- The prefab library (`prefabs/`): reusable pictures and systems (taken out by
  [game-to-prefabs](game-to-prefabs.md)).
- The engine: the prefab runtime library, `AssetProvider`, the preview page, the acceptance and
  build commands. Do not change the engine or import from deep inside it in order to pass a
  gate.
