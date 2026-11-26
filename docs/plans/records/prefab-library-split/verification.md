# Verification record: prefab-library-split

Task document: [`task.md`](task.md)\
Commit: `ad8332d8` on `unified` (this line and the export's result were filled in by the commit after it)\
Date: 2026-11-26

## Environment

- macOS 27.2 on an Apple M4; Node 26.13.1, npm; Go 1.26.5. The library's workflow ran on GitHub's
  Linux runner with Node 24.
- The library: `zhuda-engine-prefabs` at `7039eb7` (public) and `09f855b` (one commit ahead,
  local). The released engine it pins: 2.0.1 (`57b3acec` on the public repository).
- This repository: `unified` at `a23c4d45` plus this change.

## The library standing alone (first step)

Taken from `prefabs/` of the public repository at `764e46f`, which is this repository's tree
after the public export: the git bundle that must stay private was not in it.

| What | Result |
| --- | --- |
| What had to change to stand alone | 12 files reached out of `prefabs/` by a relative path: the two viewers' build and play tools and `tools/detplay.mjs` (now the engine's public entries `zhuda-laya-engine/compiler/consumer`, `/chrome-host`, `/stage-probe`), and the stickman's builders (the character kit under this repository's `games/tools/characters`, now found through `ZHUDA_ENGINE_CHECKOUT`). The package is `zhuda-engine-prefabs` with the command `zhuda-prefabs-sync`; the viewers are npm workspaces; a lock it writes says `library: zhuda-engine-prefabs` |
| `node scripts/verify.mjs --go` on the released engine 2.0.1 | library 209 of 209, viewer2d and viewer3d (sync, build, types, Doctor, 3 tests each), 10 Go packages |
| The stickman's default build with the kit of this repository | `assets/stickman.glb` byte for byte; without `ZHUDA_ENGINE_CHECKOUT` an error that names it |
| What a game installs (`npm pack --dry-run`) | 399 files, 47 MB: no viewer, no `source/`, no test |
| An existing game's lock (synced from the engine package at 2.0.0, one module) against the library | `--check` ok: "synced at 2.0.0; library is 2.0.2 (these modules unchanged)" |
| Installed from GitHub into an empty project | 90 s; `npx zhuda-prefabs-sync . ui/virtual-stick systems/i18n` copies four files (one module it needs came with them), `--check` ok |
| Its workflow, first run | **failed**: `node --test tests/` runs every test under the folder on Node 26 and is "Cannot find module" on Node 24. The scripts were so while the library was here; nothing here ran them on Node 24 |
| Its workflow after `7039eb7` (`tests/*.test.mjs`) | passed: the same 209, 3 and 3 on Linux with Node 24; 10 Go packages |

## This repository without the library (second step)

| What | |
| --- | --- |
| Removed | `prefabs/` (844 files); from `package.json` the `zhuda-prefab-sync` bin, the fourteen `files` entries, `verify:prefabs` and `verify:prefabs:go` |
| Kept | the git bundle, moved to `archive/ashfall-duel/` (the export leaves `archive/` out); `stickman.glb` and `zhuda.glb` as fixtures of the motion audit's tests (`tests/fixtures/characters/`, 3.9 MB) |
| Tests | `tests/stage-probe.test.mjs` no longer reads the viewers' scenarios and players: the library's `tests/scenarios.test.mjs` does (2 tests; the library has 211). `tests/character-motion-audit.test.mjs` reads the fixtures |
| Documents | 38 current documents and routes rewritten by rule (258 paths, 39 bare mentions, 12 uses of the command, 10 links, 15 installed paths, 8 uses of the check), then `AGENTS.md`, `README.md`, `docs/prefab-library.md`, `docs/release-policy.md` and the routes index by hand. Records are untouched; links from the changelog and the handoff into the library point at its repository |
| Version | 2.1.0 in `package.json`, the lockfile and `zhuda.config.json`; not released |
| Export rules | the bundle's exclusion is `archive/`; the rewording of the module's README is gone with the file |

## The cross-check

`npm run verify:library` (`scripts/verify-prefab-library.mjs`): the library is cloned into a
temporary folder, its dependencies are installed without the engine, this checkout is linked
where the pinned engine would be, and the library's `scripts/verify.mjs` runs.

- The first form pointed the library's package files at `file:<this checkout>`. The viewers'
  builds refused it (`ENGINE_DEPENDENCY_UNPINNED`: a consumer's engine must be pinned to a
  commit), which is the engine's own rule doing its work. The package files now keep their pin
  and only the installed folder is replaced.
- Result on this checkout (2.1.0, no `prefabs/`): library `09f855b`, 211 of 211, both viewers,
  10 Go packages, in 27 s with npm's cache warm.

## Checks here

| Check | Result |
| --- | --- |
| `npm run verify` | build, typecheck, declaration audit, Doctor, 1,099 tests of 1,099 (1,100 before; one test left with the library) |
| `npm run lint`, `npm run format:check` | clean |
| `npm run verify:games` | nine of nine |
| `npm run verify:library -- --go` | as above |
| `node --test tests/docs-index.test.mjs tests/implementation-routes.test.mjs tests/agent-contract-package.test.mjs` | 11 of 11 after the changelog's one link into `prefabs/` was pointed at the library |
| The public export of the commit (`ad8332d8`) into an empty folder | exit 0, every rule's count met, nothing that must not remain: 2,179 files and 114 MB (3,005 and 220 MB before), no `archive/`, no `prefabs/` |

## Not checked

- The workflow's new `library` job on GitHub: it runs when this is pushed to the public
  repository. Its script was run here only.
- Windows. The script links with a junction and uses `npm` and `git` by name.
- The engine's browser batches on this change: nothing they draw was touched, and they are run
  in the public checkout before a push.
- A game moved to engine 2.1.0 with its lock taken from the library: none was moved.
- Whether every one of the 258 rewritten paths reads well in its sentence: they were replaced by
  rule and sampled, not read one by one.
