# Agent task: v2-consolidation

Status: Done on a desktop; not accepted (no device, no person)  
Owner: the repository owner (decision of 2026-11-26); carried out on the owner's Mac by Claude (Fable 5.2)  
Last reviewed: 2026-11-26  

## Source requirement

The owner, 2026-11-26, in the session that had just surveyed the game centre's routes:

> 行，先把中心的已有路線融入，然後把原本缺失的修復；再把剩餘的遊戲不融入不修改，但每一款遊戲都融化成為路線，
> 確保現在開發過的每一款遊戲都能作為fable5.2的穩定開發路線。不包含win主機的ＢＤＬ。能融化出來的3d場景和資產，
> 都可以搬運，這是一次大整理。後面應該共用prefab目錄也會刪除，被融入到這個庫。全部只剩下這個庫，以及games/
> 擺放各種依賴這個庫的遊戲。然後這就叫 zhuda-laya-engine 2.0.0 版本。到上面都完成以後，推版紀錄，然後去幫每一款
> 遊戲升級到2.0.0版本，去驗測有沒有遇到問題，讓全部遊戲都升級上去2.0.0版本以後，就休息。

In English: fold the game centre's routes into this repository; repair what was found missing; turn
every game of the workspace into a route without merging or changing the game; leave out the BDL
platform on the Windows host; 3D scenes and assets that can be taken out of games may be moved in;
the shared prefab library (`commonPrefabs/`) is to live in this repository and its folder will later
be deleted; in the end there is this repository and a `games/` folder of games that depend on it;
that state is zhuda-laya-engine 2.0.0; when it is done push the release with its record, then move
every game to 2.0.0 and test it.

## Goal

This repository at version 2.0.0 holds the engine, every route (the engine's, the game centre's
twelve, one per workspace game), and the prefab library; every game in the workspace's `games/`
pins 2.0.0 and its own `verify` has been run on it.

## Invariants

- The engine's public API is not broken for the nine reference games (`npm run verify:games`).
- A workspace game is read, not changed, until its upgrade; the upgrade keeps a copy of every file
  it replaces (the workspace has no version control).
- Nothing is deleted in the workspace (`commonPrefabs/`, `routes/`, games): deleting is the owner's
  step, after this is checked.
- Nothing of the BDL platform enters the repository: no path, code or text of it. It is named in
  this record and the handoff only, as the rule.
- No secrets, account ids or host names of the owner's sites in the repository.
- A route claims only what was run; what a game's records say is quoted with its date.

## Dependencies

- The game centre workspace beside this checkout: `routes/` (twelve pages), `commonPrefabs/` 0.10.0
  (35 modules, two viewers, Go packages), `games/` (nine games pinned to six engine commits between
  2026-11-12 and 2026-11-22).
- Go 1.26.5 for `prefabs/server`; Chrome for the viewers.

## Scope

### Engine

- `docs/routes/` (pages and index), `prefabs/` (new: the prefab library), `packages/` and `tests/`
  for the engine gaps the routes list, `package.json` (version, `files`, `exports`, scripts),
  `AGENTS.md` (the repository boundary), `CHANGELOG.md`, `HANDOFF.md`, `games/tools/characters/`.

### Consumer or adapter

- The nine workspace games: only their engine pin, lock file, synced prefab copies and what the
  upgrade breaks. Each game's `HANDOFF.md` gets the result.

## Non-goals

- Merging the workspace games into the repository, or changing their rules, art or releases.
- Publishing anything to a portal; pushing to the engine's own GitHub repository (the owner has
  not said to: the release is pushed to the verification repository's `unified` branch).
- Deleting `commonPrefabs/`, `routes/` or `commonAssets/` in the workspace.
- `commonAssets/` (644 MB of textures): not asked for, and too large to ride in every clone
  without the owner deciding so.

## Acceptance checks

1. `npm run verify` at the root: exit 0 (the route audit covers every page and the index).
2. `npm run lint`, `npm run format:check`: exit 0.
3. `npm run verify:games`: nine of nine.
4. `npm run verify:prefabs`: the prefab library's type check and tests, both viewers' `verify`;
   `npm run verify:prefabs:go` where Go is installed.
5. `npm pack --dry-run`: the package holds the prefab modules and their sync script, not their
   `source/`, `preview/` or the viewers.
6. Each workspace game at 2.0.0: `npm install`, prefab copies synced from the installed package,
   the game's own `npm run verify`: exit 0, or the failure recorded with its cause.

## Evidence to attach

- Test/build output: [verification](verification.md).
- Browser/WebGL or device report: the viewers' checks are headless Chrome on this Mac; no phone.
- Per-game upgrade results: in [verification](verification.md) and in each game's `HANDOFF.md`.

## Unverified limits

- No phone, no person playing, no sound heard: unchanged from before.
- Routes written from a game's records were not re-run step by step.

## Rollback

`3cc418ee` is the last commit before this work. A game's upgrade is undone from the copies kept in
its `evidence/upgrade-2.0.0/before/`.

## Progress (kept current while the work runs; the result is in [verification](verification.md))

All of it is committed and pushed.

- [x] `prefabs/` copied from the workspace's `commonPrefabs/` 0.10.0 (no `node_modules`, `dist`, viewers'
      synced copies); home paths, the old folder name, one person's handle and a commercial game's
      title replaced in text files; `ui/page-lock` comments reworded without the source platform's
      name; `tools/detplay.mjs`, `pixdiff.py` added from the workspace's `routes/tools/`.
- [x] The library and both viewers depend on this checkout (`file:` links); library 169 tests,
      viewers build + Doctor HEALTHY + tests, Go `vet` and `test` all packages ok (2026-11-26).
- [x] Engine: `indexLaya342ClipNodes` (glTF cross fade), `boot({ layoutSize })`,
      `./compiler/chrome-host` export, bin `zhuda-prefab-sync`, `files` with `prefabs/` (minus
      `source/`, `preview/`, viewers, tests), scripts `verify:prefabs`, `verify:prefabs:go`.
- [x] Kit: `sampler`/`generator` on `writeRiggedGlb`, `pngBytes`; the stickman builds from the kit.
- [x] Version 2.0.0 in `package.json`, lock, `zhuda.config.json`, `prefabs/catalog.json`; CHANGELOG,
      release policy, README, AGENTS (repository boundary), `docs/prefab-library.md`.
- [x] Twelve workspace routes translated into `docs/routes/` (by four subagents; gap rows closed
      in 2.0.0 rewritten by hand).
- [x] Nine game routes (by nine subagents, from the games' records).
- [x] Route index rows and "which route for which task"; `npm run verify` green.
- [x] Prefab candidates the game routes named: five moved in with tests (`systems/circle-merge`,
      `systems/minigame-host`, `audio/casual-sfx`, `3d/seaside-pier`, `zhuda-lite`); the rest listed
      in the verification record with the reason.
- [x] Committed, tagged `v2.0.0` (`91d21f79`), pushed `unified` and the tag to the verification repository.
- [x] The nine workspace games moved to the 2.0.0 commit, each `verify` run, each `HANDOFF.md` updated.
- [x] `verification.md`, `HANDOFF.md` here, the workspace's `AGENTS.md`.
