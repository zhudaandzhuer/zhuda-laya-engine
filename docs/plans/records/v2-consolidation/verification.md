# Verification record: v2-consolidation

Task document: `docs/plans/records/v2-consolidation/task.md`  
Commit: the commit tagged `v2.0.0` on the `unified` branch (this file is in it); the five commits after `3cc418ee`  
Date: 2026-11-26  

## Environment

- OS / browser / device: the owner's Mac, Apple M4, macOS 27.2.1; headless Google Chrome 158 through the
  engine's Chrome host. No phone.
- Node and package manager: Node 26.13.1, npm 11.20.0; Go 1.26.5 (darwin/arm64); Blender 5.2.2 LTS.
- Engine and consumer commits: this repository; the prefab library was the workspace's
  `commonPrefabs/` 0.10.0 as it stood on 2026-11-26; the workspace's games are listed with their
  pins under "The workspace's games".
- DPR, viewport and network mode: the viewers at 1280×720, DPR 1.

Done by Claude (Fable 5.2) on the owner's Mac. Thirteen subagents wrote route pages (four
translated the game centre's twelve, nine wrote one page each from a workspace game's own records);
their pages were checked by the route audit, their reports were read, and four pages were sent back
once (below). **No person took part**: nothing here was seen, played or heard by one.

## Checks

Run on the tree of the release commit, 2026-11-26.

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, Doctor, tests | `npm run verify` | PASS: 1016 of 1016 tests (three added: the glTF clip index, `layoutSize`, the Chrome host as a public entry); the route audit lists 47 routes | terminal |
| Lint | `npm run lint` | PASS | terminal |
| Format | `npm run format:check` | PASS | terminal |
| Reference games | `npm run verify:games` | PASS: nine of nine | terminal |
| Prefab library | `npm run verify:prefabs:go` | PASS: library 189 tests (169 that came with it, 20 for the five additions); `viewer2d` and `viewer3d` each sync, build, type-check, Doctor HEALTHY, 3 tests; Go `vet` and `test`, 10 packages with tests ok | terminal |
| A clean checkout | a second working tree of the release's content: `npm ci`, `npm run verify`, `npm run verify:prefabs:go`, `npm run verify:games`, `git status` | PASS: 1016 of 1016; library 189, both viewers, Go; nine of nine; nothing left changed | terminal |
| Package contents | `npm pack --dry-run --ignore-scripts --json` | PASS: every file the catalog lists is in the package; no `source/`, `preview/`, viewer or test file of the library is; see "The package" | terminal |
| The low-poly figure rebuilds | `cd prefabs && node 3d/stickman/source/build.mjs`, twice | PASS: the same file twice; against the workspace's model only `asset.generator` differs (geometry, skin, clips, textures byte for byte) | `prefabs/3d/stickman/source/build-report.json` |
| The seaside's models rebuild | `SEASIDE_OUT=<dir> blender -b --factory-startup -P prefabs/3d/seaside-pier/source/scene.py` and `gear.py` | `shore.glb`, `dock.glb` byte for byte; `props.glb`, `gear.glb` the same size and JSON, positions within 1.5e-8 m, about 1,200 to 1,600 bytes differ (not traced) | `prefabs/3d/seaside-pier/README.md` |
| The seaside in a browser | `cd prefabs/viewer3d && node tools/play.mjs scenarios/seaside-pier.json "scene=seaside-pier"` | PASS: three pictures, 0 renderer errors, 0 page errors; looked at by the agent only | `prefabs/3d/seaside-pier/preview/` |
| Real WebGL/device | a phone | UNAVAILABLE | — |

### What the engine changes were checked with

| Change | Check | Limit |
| --- | --- | --- |
| glTF clips file their keyframe nodes (`indexLaya342ClipNodes`) | a clip as LayaAir's reader leaves it, and through the wrapped reader, in `tests/model-showcase.test.mjs`; `prefabs/tests/stickman.test.mjs` still passes with the figure's own repair in place | the cross fade itself was not measured again in a browser after the change; the last frame-by-frame reading is the figure's of 2026-11-25, with its own repair |
| `boot({ layoutSize })` | a turned container on a fake stage in `tests/runtime3d.test.mjs` | no browser, no phone; the game the gap came from still carries its own override |
| `zhuda-laya-engine/compiler/chrome-host` export, bin `zhuda-prefab-sync` | `tests/chrome-wait.test.mjs` (imported by the package's name), `tests/cli-entry.test.mjs` (every bin through a link in a path with spaces and Chinese) | — |

## The package

`npm pack --dry-run`: 1,092 files, 74.4 MB unpacked (a 40.5 MB tarball), of which the prefab
library is 379 files and 41.9 MB (models and sounds); 39 modules in the catalog. The exclusions are negated patterns in `files`
(`!prefabs/**/source`, `!prefabs/**/preview`); npm 11.20.0 honours them.

## The route pages

- Twelve translated from the workspace's `routes/` (all passed that library's own check before):
  header names, section names and paths changed to this repository's; nothing about the BDL
  platform kept (its name, paths and code are out of `mobile-web-fullscreen` and of
  `prefabs/ui/page-lock`'s comments; what each phone platform allows stayed); no host names,
  account names or people's names. Sent back once: `online-lockstep-match` (its text about
  deployment contradicted its own status; rewritten from the game's latest records) and
  `low-poly-character-from-shapes` (it described the figure of 2026-11-25; rewritten for the one in
  `prefabs/3d/stickman` now).
- Nine written from the workspace's games, each by one subagent that read the game and changed
  nothing in it: every statement of what was checked is the game's own record, with its date. Sent
  back once: the raft game's page, first written for the survival game the folder held on
  2026-11-18; the folder has held a four-pig raft brawl since 2026-11-19, and the page is now
  `raft-brawl-3d-minigame`.
- Gap rows that 2.0.0 closes were rewritten by hand in `game-to-prefabs`, `shared-islands`,
  `mobile-always-landscape` and `low-poly-character-from-shapes`.
- Routes whose reference consumer had been removed: `floating-island` now names
  `prefabs/3d/sky-island`; `layered-cloth-on-body` and `spine-character` name the folder outside
  the workspace that keeps those games (`撕襪技術精華-2026-11-25` on the owner's Mac).

Known to be stale inside translated pages, kept as their sources state them and dated there: test
counts of 2026-11-25 (the library has more tests now), "Go standard library only" (true of the slot
packages; `matchrelay` needs one module), and comparisons against original games that have since
been removed and cannot be repeated.

## Engine gaps the routes list: what was done with each

| Gap | In 2.0.0 |
| --- | --- |
| A glTF model cross fades towards the bind pose | fixed in the engine |
| `boot`/`resize` cannot be told the canvas's layout size | `layoutSize` |
| The headless Chrome host has no public entry | exported |
| No fixed clock for comparing two builds | `prefabs/tools/detplay.mjs` ships; the runtime itself has no such mode |
| A route names a removed game as its reference | three pages corrected |
| The stickman builds from a copy of the kit | the kit took its two additions; the copy is gone |
| No mobile page lock in `boot` | open; `prefabs/ui/page-lock` ships |
| No asset provider, host bridge or polyfills for a mini-game host | open in the engine; `prefabs/systems/minigame-host` ships |
| `zhuda-laya-minigame`: no subpackages, no ES2017 lowering, no orientation, one size number | open (the owner's helper does these) |
| No tree generator, no splat ground, one water mirror, no character controller or camera collision | open; the islands' modules carry the workarounds |
| 2D characters are Spine only; no in-between bake tool; no mesh-warped picture | open; `prefabs/2d/cel-motion` ships |
| Prefab evidence is bound to one built program; the gates do not check a spec's other promises | open |
| The splash runs on real time | by design; `{"branding":{"mode":"none"}}` for comparisons |
| Tweens and waits on the runtime clock | open; `prefabs/2d/slot-ui/frame-clock.ts` ships |
| From the nine game routes (integer per-tick action contract, one-way platforms, 2D scenes with height and light, a walk map from colliders, LOD by triangle range, freeing a destroyed scene's resources, more than 32 clips in a blend, a shadow switch on a model instance, a signal that the splash is gone, portal variants of the zip, and others) | open; each is in its route's gap table |

## Taken out of games into the library

| Module | From | Checked by |
| --- | --- | --- |
| `systems/circle-merge` | `zhuda-hehele` `src/physics.ts` | 5 tests |
| `systems/minigame-host` | `zhuda-raft-survival` `src/platform.ts`, `polyfills.ts`, `assets.ts` (one constructor rewritten so that Node runs the file) | 6 tests against a fake `wx` |
| `audio/casual-sfx` | `zhuda-counting-pigs`, 41 synthesised sounds and the page that makes them | 3 tests |
| `3d/seaside-pier` | `zhuer-fish-them-out`, four models and the two Blender scripts | 4 tests, the rebuild, the viewer preset |
| `zhuda-lite` in `3d/zhuda-characters` | `zhuer-fish-them-out` | 2 tests: the full model's joints and clips, 8,990 triangles |

The games were not changed and do not use these copies yet. Named by the game routes' authors and
**not** moved, with the reason:

- The apocalypse game's props, environment and characters (365 MB): no licence record for the
  models, and too heavy for a package every game installs.
- The town game's town (73 MB), townspeople (bases from a character tool whose terms were not
  checked) and fabrics (100 MB); the action adventure's characters (one carries a model licence
  that forbids redistribution) and monsters.
- Code that is still tied to one game's data and needs separating first: the fighter's lockstep
  client, the mystery's isometric rasteriser and walk map, the apocalypse game's effects, controls
  and primitive prefabs, the town's walker and daylight.

## The workspace's games

All nine were moved on 2026-11-26 to
`git+https://github.com/<owner>/VerifyZhuda.git#91d21f79203a092b7944adb20d51c8dc24cef1ca`:
one by the session itself, eight each by a subagent working in that game's folder only. In every
game: a copy of what the move replaced is in `evidence/upgrade-2.0.0/before.tar`; the prefab copies
were first checked against the game's lock (no game had edited a copy) and then synced from the
installed package; the result, the files changed and how to undo are in the game's `HANDOFF.md`
under 「2026-11-26：引擎升到 2.0.0」. Afterwards the session checked each game's pin, the installed
version (2.0.0), the archive and the handoff section. **No game needed a change to its own code
because of the engine.** Nothing was published, uploaded or committed; no phone.

| Game | Pin before | `npm run verify` at 2.0.0 | Also run | Size |
| --- | --- | --- | --- | --- |
| `pigfall-apocalypse` | `d61f6db` | PASS: 44 of 44, Doctor HEALTHY (no run before: nothing was installed) | prefab acceptance 3 of 3 at 0 different pixels against the kept baselines; Go `vet` and `test`; a boot, walk and shots in headless Chrome on WebGPU with 0 errors | zip 388,281,766 to 388,450,022 bytes (limit 500,000,000) |
| `zhuda-counting-pigs` | `693f69b` | PASS: 28 of 28, HEALTHY (no run before) | `panel-check` 88 of 88 at four screen sizes | zip 5,474,459 to 5,512,978 |
| `zhuda-dao` | `def94aa` | PASS: 125 of 125 before and after, HEALTHY | `roll-check` 7 of 7, `aim-check` 8 of 8 | `app.js` +1,633 bytes |
| `zhuda-hehele` | `a5dfc6b` | PASS: 5 of 5, HEALTHY (no run before) | `build:wx` ok | wxgame folder 4,152 to 4,260 KB |
| `zhuda-raft-survival` | `a5dfc6b` | PASS: 8 of 8, HEALTHY (no run before) | mini-game build, lowering, subpackage and syntax check; a match played in headless Chrome with 0 errors | main package 3,199,416 to 3,283,566 bytes (limit 4 MiB) |
| `zhuda-rainy-night-murder` | `d61f6db` | PASS: 33 of 33 before and after, HEALTHY | Go `vet` and `test`; the Node playthrough | zip 37,950,321 to 38,004,431 (limit 45,000,000) |
| `zhuda-spacetime-3d` | `0a003e9` | PASS: 61 of 61 before and after, HEALTHY | the twelve browser checks, all in one round, on WebGPU; old and new builds alternated through the same checks | 164,550,539 to 164,669,023 bytes (limit 165,000,000: 330,977 left) |
| `zhuda-whirlwind-1` | `def94aa` | PASS: 61 of 61 before and after, HEALTHY | Go tests (the game's 6; the shared relay's 56 at its new place); rotate, zoom, swipe-up and controls checks; local relay and peer matches with every hash equal; 21 desktop screenshots pixel for pixel as before | only `app.js`, `prefab-preview.js` and headers differ |
| `zhuer-fish-them-out` | `3c15fdc` | PASS: 15 of 15, HEALTHY (no run before) | the play check's three layouts on WebGPU and on WebGL, every round ended, 0 renderer and page errors; a 92 s round on WebGPU at quality 3 | zip 8,198,792 to 8,219,326 (limit 40,000,000) |

What the moves turned up:

- **The engine's bundle is larger**: a game's `app.js` grew by about 66 to 300 KB from the pins of
  2026-11-12 to 11-20, and by 1.6 KB from `def94aa`. Where a limit is near it matters: the town
  game has 331 KB left under its cap.
- **`zhuda-dao` cannot build its mini-game package**, and not because of the engine: code the game
  gained on 2026-11-25 uses `window.addEventListener`, which the mini-game build refuses, and
  behind that the package is over its limits (main about 255 KB over 4 MiB once packaged, 37.5 MiB
  in all). Left as found; in the game's handoff.
- **Timeouts under load, not from the engine**: while eight upgrades ran at once the Mac's load
  average was 40 to 180, and screenshot and navigation timeouts appeared in four games' browser
  checks; every one passed when rerun at normal load. The mystery's playthrough test took 70 s
  under that load and 19 s after it, the same as before the upgrade.
- **One all-black 3D frame**, once, in the town game on the new engine (1 of the 13 pictures of
  one run; the interface drawn, no renderer error); it did not come back in 228 more. Cause not found; the
  picture is in that game's `evidence/upgrade-2.0.0/`.
- **A glTF cross fade that changes**: three games mix clips with `ZhudaAnimationBlend`, which the
  fix does not touch. `pigfall-apocalypse` calls `Animator.crossFade` on GLB models, so its walk,
  stop and run transitions now blend clip to clip instead of dipping to the bind pose: the intended
  effect of the fix, and nobody has looked at it.
- **The package had no `CHANGELOG.md`** (every upgrade noted it): added to `files` after the tag.
- **Each game's `dist/` is now a 2.0.0 build** and no longer what is live on a portal; in three
  games the build overwrote `dist/game.zip`, the package last uploaded (kept in the archive where
  the subagent saw it in time).
- **`pigfall-apocalypse`'s own `AGENTS.md` asks for the owner's explicit word before subagents are
  used**; its upgrade was done by one. Reported to the owner.
- A game's lock file records the engine as `git+ssh://…` (npm's form); installing needs read
  access to the private verification repository.
- The fighter's `server/go.mod` now takes the shared Go packages from the installed engine package,
  so `npm install` comes before `go build`; its Windows build script's version stamp will change
  (the same code, a different `go.mod`).

## Limits and decision

- No phone, no person, no sound heard. The seaside and the changed viewers were looked at by the
  agent only.
- The nine game routes report their games' records; no game was rebuilt from its route.
- The engine's own GitHub repository is public and still at `def94aa`: this release is on the
  private verification repository only. Moving it there would publish the library's art, voices and
  songs and is the owner's decision. Until then `zhuda-laya-init` needs `--engine` with the
  verification repository's URL and commit, because its default names the engine's repository.
- CI has still never run on this line.
- `commonAssets/` (644 MB of textures) is still in the workspace; so are `commonPrefabs/` and
  `routes/`, which this release supersedes and which nobody has deleted.
- `mobile-web-fullscreen` here names no source for its practice. The workspace's original page
  (`routes/mobile-web-fullscreen.md`) names the platform it was learned from and the files in it;
  the owner's instruction was read as keeping that out of this repository. Whether the pointers
  come back here, or that page is kept apart, is the owner's: until then that page is the only
  place that has them and must not be deleted with the rest of the old folder.

Decision: **Done as far as a desktop without a person can check it**: the release is tagged and
pushed and the nine games are on it. It stays short of Accepted for want of a device, a person's
eyes on the games at 2.0.0, and the owner's decisions listed above.
