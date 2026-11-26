# The prefab library

[`prefabs/`](../prefabs/README.md) holds what several games use: interface components, input and
system modules, whole 2D games and 3D scenes taken apart into modules, their models, pictures and
sounds, two viewers, and the Go packages a game server is built from. It came into this repository
on 2026-11-26 from the game centre workspace, where it was `commonPrefabs/` (version 0.10.0); its
own pages are written in Traditional Chinese.

A game does not import the library. It takes **copies** of the modules it names, and a lock file
records what it took:

```sh
# in a game that depends on the engine
npx zhuda-prefab-sync . ui/dialog systems/i18n      # add or update these modules and what they need
npx zhuda-prefab-sync .                             # update the modules already in the lock
npx zhuda-prefab-sync . --check                     # exit 1 if a copy differs from the library

# the same from a checkout of this repository
node prefabs/scripts/sync.mjs <game dir> ui/dialog
```

TypeScript goes to `<game>/src/common/<path>`, CSS and every other file (models, sounds, pictures)
to `<game>/public/common/<path>`, and `<game>/common-prefabs.lock.json` holds the library version,
the modules and a SHA-256 for each copy. Change a module in `prefabs/`, never in a game's copy,
then sync again.

## What is where

| Path | What |
| --- | --- |
| [`prefabs/catalog.json`](../prefabs/catalog.json) | every module: its kind, its files, what it needs, which games use it |
| `prefabs/ui`, `input`, `systems` | DOM interface components, input, saving, languages, slot rounds, combat rules, cloth presets, circle physics with merging, the mini-game host bridge |
| `prefabs/audio` | sounds a game plays through the engine's audio authority: 41 synthesised casual-game effects |
| `prefabs/2d` | 2D games as modules: a side-view duel, a dungeon line slot, a cascade slot's client, pose-atlas motion; a Spine 4.2 rig of tights under a pleated skirt with the hand that pulls, tears and lifts it |
| `prefabs/3d` | three islands, their characters, walking, sound, a day's light, quality tiers, a low-poly rigged figure, a seaside with a pier, layered hosiery on a modelled body (stockings, garments and skirts that are pulled and torn) |
| `prefabs/server` | one Go module: slot mathematics and simulation, gateway, wallet seam, JWT, replay, matchmaking and relay |
| `prefabs/viewer2d`, `viewer3d` | consumers of the engine in this checkout that show any module: `?scene=<id>` |
| `prefabs/tools` | `detplay.mjs`, a scenario player on a virtual clock for comparing two builds pixel by pixel, and `pixdiff.py` |
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
npm run verify:prefabs       # the library's type check and tests; both viewers: sync, build, tsc, Doctor, tests
npm run verify:prefabs:go    # the same, then go vet and go test in prefabs/server (needs Go)
```

The library and the viewers depend on the engine in this checkout (`file:` links), as the
reference games do, so an engine change is run against them. The viewers' copies under
`src/common` and `public/common` are made by the sync at verify time and are not kept in Git.

## What the npm package carries

The modules, the catalog, the sync script, the tools and the Go packages: about 49 MB (5 MB of it
the two hosiery modules, added after 2.0.0), most of it the 3D modules' models and sounds. Not the viewers, the tests, or any module's `source/` and
`preview/`. A game's Go server points its `replace` directive at
`node_modules/zhuda-laya-engine/prefabs/server` or at a checkout; the Go module keeps the path it
had (`zhudagamecenter/commonprefabs/server`).

## Boundaries

A module holds no game's content: no lines of dialogue, character names or picture paths of one
game; colours are `--cp-*` variables a game overrides. A new module has tests, a row in the
catalog and, when it is seen, a preset in a viewer. Art in the library is the owner's; where each
picture, model and sound came from is in the module's own README.
