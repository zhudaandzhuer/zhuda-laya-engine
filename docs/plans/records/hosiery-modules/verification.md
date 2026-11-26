# Verification: hosiery-modules

Run on 2026-11-26 on the owner's Mac: Apple M4, macOS 27.2.1, Node 26.13.1, npm 11.20.0,
Chrome 158 (headless, on the graphics card: `ANGLE Metal Renderer: Apple M4`), the pinned
toolchain. Done by the session on the Mac (Claude, Fable 5.2). **No person looked at a picture; no
phone.** The engine under the modules is `e4ba0212` (`744aa606` on top of it changes two route
pages only). Notes, logs and contact sheets: [`local-results/hosiery-modules/`](../../../../local-results/hosiery-modules/notes.md).

## What was moved

| From the Desktop folder | To |
| --- | --- |
| `3D-分層絲襪/src/` (`Main.ts` 1,044 lines, `meshleg.ts`, `patterns.ts`, `bottoms.ts`, `hud.ts`) | `prefabs/3d/layered-hosiery/`: `layered-hosiery.ts` (`createHosieryWearer` and the bench's light, framing and pointer ray), `shaders.ts` (the three surface hooks), `meshleg.ts`, `patterns.ts`, `bottoms.ts` (as they were), `bench-hud.ts`; the wiring a game writes is the viewer's preset. `Main.ts` as it was: `source/Main-2026-11-15.ts` |
| `3D-分層絲襪/public/assets/legs.json` | `assets/legs.json`, byte for byte |
| `3D-分層絲襪/blender/`, `attic/`, `tools/`, `HANDOFF.md`, `精選截圖/` | `source/`, `preview/2026-11-15/` |
| `2D-Spine褲襪/src/Main.ts` (207 lines) | `prefabs/2d/spine-tights/spine-tights.ts` (`createSpineTights`); the wiring is the viewer's preset |
| `2D-Spine褲襪/public/assets/spine/` | `assets/` (rig, atlas, page, background, sites), byte for byte |
| `2D-Spine褲襪/spine/outfit/` (scripts, parts, reports, stress pictures), `blender/` (generated pictures, prompts, records), `attic/`, `tools/`, `HANDOFF.md`, `精選截圖/` | `source/` with the old relative layout, `preview/2026-11-15/` |

Not carried, and why, is listed at the end of each module's README (duplicates of files already
in `assets/`, two blank templates, the old projects' package scaffolding). Changed on the way in:
five image generation records lost their paths and their login block; two tool reports and four
tool scripts lost a home path; six phone screenshots lost the strip with the status bar and the
address bar; eight PNG screenshots of the 2D bench became JPEG. Each module's README says so.

## Checks

| Check | Result |
| --- | --- |
| The 3D bench's own sources against this engine | build with no change (`zhuda-laya-engine` linked to this checkout); WebGPU |
| The 3D bench and the module, one script, two runs each (WebGPU, 1280 × 720, real mouse): as worn, both thighs torn, lace top, jeans, long skirt, fishnets under ripped shorts | in each of the six pictures 0.000% of the pixels differ by more than 8 of 255; jeans and ripped shorts identical; the largest single difference is 26, against 18 between the bench's own two runs |
| `source/look-book.mjs` of the 3D module, WebGPU build, panel pass and bench pass | 39 pictures, no renderer error, no page error; thighs torn by drags (`[1,1]`); jeans torn (`[0,0,1,0]`), then the fishnet through the hole (`[1,0,1,0]`); the long skirt's hem from 0.285 m to 0.435 m held, 0.286 m 1.2 s after release |
| The same on the WebGL build | the same counts and the same results; hem 0.285 → 0.435 → 0.286 m |
| WebGL against WebGPU, the 36 pictures of the bench pass | at most 0.05% of the pixels differ by more than 32 of 255, but for the picture taken while the skirt is held (3.33%) |
| The 2D bench's own sources against this engine | build with no change; WebGL |
| The 2D bench and the module in three still states (whole, ten small holes, ten large), WebGL, 600 × 900 | from row 342 down (legs, tights, holes, shoes) no pixel differs by more than 8 of 255; 17 to 18% of the frame differs, all on the skirt, which sways by itself |
| `source/look-book.mjs` of the 2D module, WebGL | 8 pictures, no renderer, page or input error; a 60 pixel pull carries the nylon 55 and springs back to 0.1 in 0.9 s; `L_knee:1`, `L_knee:2`, `R_calf:1` by drags; hem (515, 565) → (559, 277) held with IK mix 1 on that chain only; back in its idle range 0.7 s after release; a double tap mends all |
| `prefabs/viewer2d` with and without `spine42`, its four other presets' scenarios | 42 pictures: 38 identical; 4 differ, 3 of them below 8 of 255 everywhere, the fourth an animated title screen that differs as much between two runs of one build |
| The viewers' own `tools/play.mjs` with the new `drag` step | `scenarios/layered-hosiery.json`: both thighs torn; `scenarios/spine-tights.json`: the left knee torn twice |
| `node --test prefabs/tests/layered-hosiery.test.mjs prefabs/tests/spine-tights.test.mjs` | 9 and 8 pass |
| Personal data in the new files (text and bytes of pictures): home paths, logins, the owner's site names | none found |

The repository's own checks, run after all of the above was in place, are in the last section.

## What a frame costs (not settled)

With a skirt on, the cloth took about 5 ms a frame in one run at 60 fps (the viewer's `play.mjs`)
and 12 to 48 ms in others where frames ran slow and each made up more steps; the bench's own
sources gave the same spread in the same minutes. The Mac's load average was about 6 throughout
(other sessions were working). The bench's record of 2026-11-15 says 3 to 9 ms. `Cloth.ts` and
`ParticleCore.ts` are the same files at `ed1ddbc` and now. Nothing here says the engine or the
move made it slower, and nothing says it did not: it was not measured on a quiet machine.

## Found on the way

- A test page's first press goes to the engine's splash, not to the scene: a preset that says
  `ready` after a few frames is pressed too early by a script. Both new presets wait for
  `whenZhudaSplashGone()`. The older presets say `ready` as before (their scenarios start with a
  wait).
- The rig's `idle` is not a still pose: the skirt sways 13 pixels each way at the hem over four
  seconds. A check that expects the hem back at one point fails; the look-book measures the range
  of one cycle first.
- `games/tools/shot.mjs` could not drive a viewer page (it waited for `window.__GAME__`): it takes
  `--hook __SCENE__` now, and logs what the hook's `state()` returns.

## Not verified

- A phone, at this engine: the benches' phone numbers are of 2026-11-15, on engine 1.18.0, and
  the Spine rig was never on a phone.
- The 2D module on WebGPU (`prefabs/viewer2d` is WebGL only).
- The scripts that made the body (Blender 5.2.2 with MPFB 2.0.18) and the rig (zhuda-spine2D):
  not run again. The body file, the rig, its atlas and its parts are the benches', byte for byte.
- A game using either module: none does.
- No person looked at a picture.

## The repository's checks

Run last, with every file of this work in place (logs in `local-results/hosiery-modules/verify/`):

| Check | Result |
| --- | --- |
| `npm run verify` | exit 0: build, typecheck, declaration audit, Doctor; 1028 of 1028 tests (no test was added at the root; the route audit covers the three changed pages) |
| `npm run lint`, `npm run format:check` | exit 0 (neither covers `prefabs/` or `games/tools/`) |
| `npm run verify:prefabs:go` | the library: typecheck, 206 of 206 tests (189 before, 9 and 8 new); `viewer2d` and `viewer3d`: sync, build, typecheck, Doctor, 3 tests each; Go: 10 packages |
| `npm run verify:games` | nine of nine (run before the last edits to the documents and to `games/tools/shot.mjs`; no game's file was touched) |
| `npm pack --dry-run` | 1,120 files, 46.6 MB packed. `prefabs/3d/layered-hosiery`: its README, six programs and `assets/legs.json`; `prefabs/2d/spine-tights`: its README, one program and five assets (5.4 MB for the two). None of their `source/` or `preview/`, no viewer, no test |
| `git diff --check` | clean |

A first run of `npm run verify` failed one test of 1028: the changelog linked this page before it
was written. Nothing else failed at any point.

## State when this was written

Shown to the owner uncommitted; committed and pushed to `unified` on the owner's word ("好，推上去")
the same day, the files of this work only and by path. Another session's work was in the same
checkout and is not part of this: `docs/routes/laya-ide-project-cli-web.md` and two lines of the
route index stayed uncommitted; its local commit `744aa606` (two route pages) went up with the
push, which the owner was told beforehand.

## Before the folder went to the Trash (2026-11-26, after the push)

The owner said to move the Desktop folder to the Trash. Before that, every one of its 159 files
(47 MB, untouched since 2026-11-25) was hashed as Git hashes a file and looked for in the tree of
`origin/unified` at `6b6f1cfc`:

| Files | What |
| --- | --- |
| 116 | on the remote, byte for byte |
| 2 | the two route pages as they were at `def94aa`: the same bytes are in this repository's history |
| 12 | text changed on purpose: five generation records, the 2D bench's handoff, two tool reports and four tool scripts lost a home path, a login block or another project's site name |
| 10 | pictures changed on purpose: six PNG screenshots of the 2D bench became JPEG (two of them cropped), four phone sheets of the 3D bench were cropped |
| 15 | package scaffolding and blank templates, listed as not carried (`package.json`, lock files, `tsconfig.json`, `zhuda.config.json`, `public/index.html`, the template's `AGENTS.md`, `README.md` and `.gitignore`, the kit's `BRIEF.md` and `WORKLOG.md`) |
| 4 | **in neither list**: the 2D bench's `src/Main.ts` (rewritten into `spine-tights.ts` and the preset, the original not kept), the 3D bench's `src/hud.ts` (kept only as the changed `bench-hud.ts`) and `test/patterns.test.mjs` (folded into the module's test), and the folder's own `README.md` |

The module READMEs and what the owner was told ("not carried: duplicates, two blank templates,
package scaffolding") left those four out. They were copied into the working tree before the move,
each compared with `cmp`: `prefabs/2d/spine-tights/source/Main-2026-11-15.ts`,
`prefabs/3d/layered-hosiery/source/hud-2026-11-15.ts`,
`prefabs/3d/layered-hosiery/source/old-patterns-test-2026-11-15.mjs`,
`local-results/hosiery-modules/digest-README-2026-11-25.md`; the two READMEs' lists were corrected.
None of the four holds a home path or a login. The originals of the 22 files changed on purpose are
in the Trash only: that is what the scrubbing was for.

The folder was moved by Finder (`tell application "Finder" to delete`), so it can be put back
until the Trash is emptied: `~/.Trash/撕襪技術精華-2026-11-25`, 159 files, 47 MB.

These last changes (the four files, the two READMEs, this section, the handoff and the notes)
were committed and pushed later the same day, on the owner's word.
