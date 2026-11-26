# Verification: character-bar

Run on 2026-11-26 on the owner's Mac: Apple M4, macOS 27.2.1, Node 26.13.1, Blender 5.2.2 LTS
(headless), Chrome 158 on the graphics card. Done by the session on the Mac (Claude, Fable 5.2).
**No person looked at a picture; no phone.** The engine is `6b6f1cfc` with this work on top.
Notes, audits, reports and sheets: [`local-results/character-bar/`](../../../../local-results/character-bar/notes.md).

## What was taken from the other session, and what was added

The other session ("SuisuiLaya 專案研究", the same day) took an outside LayaAir project's
character showcase apart and wrote `docs/routes/smooth-character-motion.md`: seven causes of its
smoothness in order of weight, each with what this engine has. It measured by hand (Python on
the files, hooks in the running page). This work keeps that route as the reasons, and adds the
means: the same measures as a tool, a tool that does the first two items on a character of
ours, a page to look at the result in the engine, and the route that puts them in order
(`docs/routes/high-quality-character.md`).

## Checks

| Check | Result |
| --- | --- |
| `motion-audit.mjs` on the reference's main character (read where it lies) | 320 joints; 193 hair, skirt and ribbon bones, 18 twist and 16 corrective by name; 62,327 vertices, four joints a vertex at most; 12 clips at 30 keys a second; idle loops 18.667 s and 21.333 s closing within 0.234° and 0.174°; 184 of 193 secondary bones moving in the first. The other session's numbers by hand: 320, 70 + 32 + 91, 32 twist and corrective, 62 k, 30, 18.7 s and 21.3 s, under 0.25°, 70 + 32 + 82. They agree; the helper bones differ by what a name is taken to mean (two hand twist bones) |
| The same run, new | The reference's weapon loop (11.5 s) is open on 29 hair, ribbon and skirt bones; one ribbon bone turns 44° in a single key (1,322° a second). The other session's "every loop closes within 0.25°" holds for the two idles it measured |
| `raise-rig.py` on the wardrobe's body (`blender/examples/wardrobe-body.json`) | six twist bones (24 joints became 30); hair and cloth bones moving in every clip (0.25 of 4 became 1); every loop closed at 0°; Run rescaled from 19.8 to 20 frames. The audit: every must passes; weak: the idle is 3.2 s |
| The twist probe on it | hand turned 120° about the forearm: the wrist's thinnest ring 0.501 of its rest radius before, 0.866 after (cos 60° and cos 30°, as two and three influences along the limb must give); two stills |
| `raise-rig.py` on the pig Zhuda (`blender/examples/zhuda.json`) | 19 clips rewritten from 21 to 30 keys a second (resampled: no new motion in the body), ears and tail moving in every clip (0 of 3 became 3 of 3), loops closed. The audit: every must passes; weak: the idle is 3.8 s, the tail in Shake turns 1,800° a second (the body in that clip 1,200) |
| Both raised files in the engine, on the model stand (WebGPU, `games/tools/shot.mjs --gpu`) | load with their clips' lengths as written; no renderer error, no page error; 13 moments of the body and 10 of the pig photographed beside the same moments of the files as they were. The pig's left ear tip moves 18.7 mm to and from the head while the idle plays (0.2 mm before). Across a 0.18 s cross-fade the body's left hand, read every 60 ms, moves without a jump |
| The model stand's own scenario (`node tools/play.mjs scenarios/model-stand.json "scene=model-stand"`) | the library's stickman: frozen at 1.5 s the hand stays where it is; across a 0.18 s fade it moves; no renderer or page error |
| `node --test tests/character-motion-audit.test.mjs` | 9 pass |
| `npm run verify` | exit 0; 1037 of 1037 tests (1028 before, 9 new); the route audit covers the new page and the two rows of the index |
| `npm run lint`, `npm run format:check` | exit 0 |
| `npm run verify:prefabs:go` | the library 206 of 206; `viewer2d` and `viewer3d` (with the model stand): sync, build, typecheck, Doctor, 3 tests each; Go 10 packages |
| `git diff --check` | clean |

## Found on the way

- Blender's glTF importer places keys by the scene's frame rate: read at the default 24 and
  written at 30, the wardrobe's 3.2 s idle came out 2.567 s and its run no longer closed (a seam
  of 17.7°). The audit showed it at once.
- Exported through the NLA tracks the importer makes, every clip gained a frame (3.2 s became
  3.233 s) and held its last key.
- After import a bone's own axes need not lie along its limb (the wardrobe's all point up): a
  twist about "the bone's Y", or a spring on a point along it, goes the wrong way.
- The audit's first rule for a seam (within one and a half of the larger of a bone's first and
  last steps) let through a bone that jumps on its very last key: the reference has one. It is
  the smaller of the two now, with a test.
- The model stand first showed an empty grey page: `?height=` is the canvas's height in every
  viewer page and was read as the character's. It is `?tall=`.
- A chain simulated with one step too many at the seam never repeated; and a spring whose
  stiffness was a share of the gap closed each step barely moved. Both were this work's own
  mistakes, corrected before any number above was taken.

## Not verified

- A character made from nothing by the route. Steps 1 (the brief), 2 (the body), 6 (a long
  idle), 8 (the order at run time, beyond the model stand's cross-fade) and 9 (shading) were
  written from the reference and from other routes and not run.
- Any person's judgement. The pictures were looked at by the agent that made them.
- The wardrobe body's baked hair and cloth as skin: the file carries no hair and no cloth, so
  the keys were measured and not seen. The pig's were seen.
- The raised files in a game; a phone; WebGL; frame rate.
- The bar's thresholds against anybody's eye: 24 keys a second, 0.8, 0.5°, 8 s and 1,200° a
  second are choices set from one reference.

## State when this was written

Shown to the owner uncommitted; committed and pushed to `unified` on the owner's word ("好，推上去")
the same day, by path. Committed with it, each in a commit of its own: the other session's two
routes and their index rows (`smooth-character-motion.md`, which this work edits in two places,
and `laya-ide-project-cli-web.md`; the home path in each header was replaced by words), and the four files
and corrected notes of the hosiery record's last section. Left uncommitted in the same tree, not
part of this: other sessions' work on `prefabs/3d/stickman/` and a route `aqua-freeze-2d-minigame`
with its rows in the route index (the index was committed without those rows).
