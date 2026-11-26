# The prefab library

The prefab library holds what several games use: interface components, input and system modules,
whole 2D games and 3D scenes taken apart into modules, their models, pictures and sounds, two
viewers, and the Go packages a game server is built from. **Since 2.1.0 it is a repository of its
own, [`zhuda-engine-prefabs`](https://github.com/zhudaandzhuer/zhuda-engine-prefabs)**; in 2.0.0 and 2.0.1 it lived under `prefabs/` here and
shipped in this package. Before that it was the game centre workspace's `commonPrefabs/`
(version 0.10.0). Its own pages are written in Traditional Chinese. Below, a path that starts
with `zhuda-engine-prefabs/` is a path in that repository.

A game does not import the library. It installs it beside the engine and takes **copies** of the
modules it names; a lock file records what it took:

```sh
# in a game that depends on the engine
npm install -D git+https://github.com/zhudaandzhuer/zhuda-engine-prefabs.git#<tag or commit>
npx zhuda-prefabs-sync . ui/dialog systems/i18n      # add or update these modules and what they need
npx zhuda-prefabs-sync .                             # update the modules already in the lock
npx zhuda-prefabs-sync . --check                     # exit 1 if a copy differs from the library

# the same from a checkout of the library
node scripts/sync.mjs <game dir> ui/dialog
```

TypeScript goes to `<game>/src/common/<path>`, CSS and every other file (models, sounds, pictures)
to `<game>/public/common/<path>`, and `<game>/common-prefabs.lock.json` holds the library version,
the modules and a SHA-256 for each copy. Change a module in the library, never in a game's copy,
then sync again. The check compares content: a game that synced from the copy inside the 2.0
packages (`npx zhuda-prefab-sync`, which this package no longer has) passes `--check` against the
library as long as its modules are unchanged.

## Versions

The library pins a released engine, and its version follows the engine line it was checked on:
library 2.0.x was checked on engine 2.0.x, 2.1.x on 2.1.x. A game pins a tag or a commit of each
and never a branch. When this engine is about to be released, `npm run verify:library` (below)
says whether the library still holds on it; the library then releases the same minor version
with its pin moved.

## What is where

| Path | What |
| --- | --- |
| [`zhuda-engine-prefabs/catalog.json`](https://github.com/zhudaandzhuer/zhuda-engine-prefabs/blob/main/catalog.json) | every module: its kind, its files, what it needs, which games use it |
| `zhuda-engine-prefabs/ui`, `input`, `systems` | DOM interface components, input, saving, languages, slot rounds, combat rules, cloth presets, circle physics with merging, the mini-game host bridge |
| `zhuda-engine-prefabs/audio` | sounds a game plays through the engine's audio authority: 41 synthesised casual-game effects |
| `zhuda-engine-prefabs/2d` | 2D games as modules: a side-view duel, a dungeon line slot, a cascade slot's client, pose-atlas motion; a Spine 4.2 rig of tights under a pleated skirt with the hand that pulls, tears and lifts it |
| `zhuda-engine-prefabs/3d` | three islands, their characters, walking, sound, a day's light, quality tiers, a low-poly rigged figure, a seaside with a pier, layered hosiery on a modelled body (stockings, garments and skirts that are pulled and torn) |
| `zhuda-engine-prefabs/server` | one Go module: slot mathematics and simulation, gateway, wallet seam, JWT, replay, matchmaking and relay |
| `zhuda-engine-prefabs/viewer2d`, `viewer3d` | consumers of the engine the library pins that show any module: `?scene=<id>` |
| `zhuda-engine-prefabs/tools` | `detplay.mjs`, a scenario player on a virtual clock for comparing two builds pixel by pixel, and `pixdiff.py` |
| `<module>/source`, `<module>/preview` | how a module was made and what it looks like; not in the npm package |

The routes that use it: [game-to-prefabs](routes/game-to-prefabs.md),
[shared-islands](routes/shared-islands.md), [side-view-duel](routes/side-view-duel.md),
[pose-atlas-motion](routes/pose-atlas-motion.md), [dungeon-line-slot](routes/dungeon-line-slot.md),
[cascade-slot](routes/cascade-slot.md), [go-game-server](routes/go-game-server.md),
[online-lockstep-match](routes/online-lockstep-match.md),
[low-poly-character-from-shapes](routes/low-poly-character-from-shapes.md),
[mobile-web-fullscreen](routes/mobile-web-fullscreen.md),
[mobile-always-landscape](routes/mobile-always-landscape.md).

## Checks

```sh
# in this repository: the library's own checks on this checkout of the engine
npm run verify:library            # its type check and tests; both viewers: sync, build, tsc, Doctor, tests
npm run verify:library -- --go    # the same, then go vet and go test in its server/ (needs Go)

# in a checkout of the library: the same checks on the engine it pins
npm install && npm run verify:all
```

`verify:library` (`scripts/verify-prefab-library.mjs`) takes a copy of the library from its
public repository (or `--library <checkout>`, or `ZHUDA_PREFABS`) into a temporary folder, links
this checkout where the pinned engine would be installed, and runs the library's
`scripts/verify.mjs`. The workflow runs it on every push, so an engine change that breaks a
module is seen before a release. It reads a checkout at its last commit, not with what is
uncommitted in it.

## What a game installs

The library's package carries the modules, `catalog.json`, the sync tool and the Go packages,
without the modules' `source/` and `preview/` folders, the viewers and the tests: about 47 MB
unpacked. This engine's package carries none of it since 2.1.0. The Go packages are one module
with the name they have always had (`zhudagamecenter/commonprefabs/server`); a game server
points a `replace` at a checkout of the library.

## Boundaries

A module holds no game's content: no lines of dialogue, character names or picture paths of one
game; colours are `--cp-*` variables a game overrides. A new module has tests, a row in the
catalog and, when it is seen, a preset in a viewer. Art in the library is the owner's; where each
picture, model and sound came from is in the module's own README.
