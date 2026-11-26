# Agent task: hosiery-modules

Status: Done on a desktop; not accepted (no device, no person)  
Owner: the repository owner (decision of 2026-11-26); carried out on the owner's Mac by Claude (Fable 5.2)  
Last reviewed: 2026-11-26  

## Source requirement

The owner, 2026-11-26, after 2.0.0 was pushed:

> 還有這個要融掉成為路線，你先看看 〈桌面上的資料夾 撕襪技術精華-2026-11-25〉

(the folder's full path is left out of this record)

and, shown what the folder holds and asked where its programs should go (reference games, or
prefab modules):

> 做成共用元件

In English: the folder kept on the Desktop since 2026-11-25 (the two stocking-tearing benches,
`games/stocking-tear` and `games/stocking-tear-2d` of the game centre workspace, judged then to
have "no reusable code" and tidied away outside the workspace) is to be folded into this
repository, as modules of the prefab library.

## Goal

The two benches are modules of `prefabs/` that a game takes with `zhuda-prefab-sync`, each with a
viewer preset, tests, a README, its sources and its pictures; they run on the engine of this
repository; the routes `layered-cloth-on-body` and `spine-character` name them as their reference
consumers; nothing of the Desktop folder exists only there, except what the module READMEs list as
not carried.

## Invariants

- The Desktop folder is read, not changed and not deleted: deleting it is the owner's step.
- The move changes no behaviour and no picture of the benches: shown by running the benches' own
  sources, unchanged, against this engine beside the modules.
- MPFB (the Blender add-on the body was made with, GPL-3) does not enter the repository. Its
  output, the body file, is CC0 and does.
- No home path, login, account id or host name of the owner's sites in what is committed: the
  image generation records and the tool reports are scrubbed, and say so.
- Adult styles only, as the benches were made: an adult body, no school-uniform skirt.
- The engine's API is not changed. The viewers and their tools may be.

## Dependencies

- The Desktop folder (47 MB): `3D-分層絲襪/`, `2D-Spine褲襪/`, the two route pages as they were.
- Chrome on the graphics card through `games/tools/shot.mjs --gpu` (Playwright from outside the
  repository), for the pictures and the real-mouse checks.

## Scope

### Engine

- `prefabs/3d/layered-hosiery/`, `prefabs/2d/spine-tights/` (new), `prefabs/catalog.json`,
  `prefabs/README.md`, `prefabs/tests/` (two files), `prefabs/viewer3d` and `prefabs/viewer2d`
  (a preset and a scenario each; `viewer2d` builds with `spine42`; `tools/play.mjs` takes a `drag`
  step), `games/tools/shot.mjs` (`--hook`).
- `docs/routes/layered-cloth-on-body.md`, `spine-character.md`, `game-to-prefabs.md`,
  `docs/prefab-library.md`, `CHANGELOG.md`, `HANDOFF.md`, this record, `local-results/hosiery-modules/`.

### Consumer or adapter

- None: no workspace game uses the modules.

## Non-goals

- New kinds of stocking, new garments, new rigs; tuning what the benches left open (the pale band
  at a stretched leg's edge, the 2048 × 4096 atlas, the feet's sheen).
- An engine API for the per-vertex layer (`meshleg.ts`): it stays a module.
- A phone run. A release: the version stays 2.0.0 and the changelog says "not released".
- Deleting the Desktop folder; committing or pushing without the owner's word.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check` at the root: exit 0.
2. `npm run verify:prefabs:go`: the library's type check and tests with the two new files, both
   viewers' `verify`, Go.
3. `npm run verify:games`: nine of nine (nothing of theirs was touched).
4. Each module on a graphics card with a real mouse: every step of its `source/look-book.mjs`
   passes, no renderer or page error.
5. Each bench's own sources against this engine, beside the module: the same pictures where the
   scene is still.
6. `npm pack --dry-run`: the modules' programs and `assets/` are in the package, their `source/`
   and `preview/` are not.
7. No `/Users/`, login or site host name in the new files.

## Evidence to attach

- Test/build output and the comparisons: [verification](verification.md).
- Browser/WebGL or device report: `local-results/hosiery-modules/` (logs of every run, contact
  sheets), the modules' `preview/`. No phone.

## Unverified limits

- No person looked at a picture; no phone; no sound (the benches have none).
- The scripts that made the body (Blender with MPFB) and the rig (zhuda-spine2D) were not run
  again.
- What a frame costs was measured on a busy machine.

## Rollback

`744aa606` is the last commit before this work. Remove the two module folders, the two test files,
the two presets and scenarios, and revert the other files of the commit; the Desktop folder still
holds the benches.
