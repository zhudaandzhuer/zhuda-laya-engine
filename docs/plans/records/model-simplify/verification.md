# Verification record: model-simplify

Task document: `docs/plans/records/model-simplify/task.md`  
Commit: the commit that adds this file, on top of `f307bf7`  
Date: 2026-11-14

## Environment

- macOS 27.0.1, Apple M4; Node 26.12.0, npm 11.20.0; meshoptimizer 1.3.0.
- Phone measurements: vivo V40 (Adreno 720, Android 16, Chrome 156, WebGL2),
  driven from the Mac through the phone's Chrome debugging port; canvas
  1280 by 720, DPR 1.
- Evidence (outside the repository): `films/compare-three/evidence/phone-v40/`
  and `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/model-lod-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 524 of 524 (517 before, 7 new in `tests/model-lod.test.mjs`) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/` |
| Two consumer trees through the tool | `node packages/compiler/model-lod.mjs <tree>.glb --ratio 0.4,0.15,0.05` | jacaranda 77 575 -> 30 904, 11 418, 3 749 triangles; island tree 19 147 -> 7 652, 2 848, 1 069 | `EV/tool.log` |
| The 15 % versions drawn beside the originals | the same scene in three.js (`films/compare-three`, `?swap=`), road view | Crowns a little thinner, trunks alike; a person's judgement | `EV/road-pair.png` |
| Cost with the 15 % trees, desktop | the same three.js scene, road view, tuned variant | 36.2 ms and 40.9 M triangles before, 21.9 ms and 18.0 M after | `EV/three-lod2.json` |

Phone measurements that led here (the engine's look in the game, effects
switched off one at a time, town view, 1280 by 720): all on 78.6 ms; without
shadows 55.2; shadows at 2048 in two splits 64.6; without multisampling 64.7;
without light fog 64.8; without ambient occlusion 68.6; without bloom 74.7;
none of them 23.3. Road view: 127.4 with all, 63.1 with none.

## Later the same day: lighter trees drawn by the engine, the town cut into squares

Commits `e12d075` (pictures made smaller), `167f544` (`castShadow: false`,
`splitGlb`). `npm run verify` 528 of 528; lint, format and whitespace checks
pass. The game (`films/river-town-prefab`) regenerates its prefab with them;
its own six prefab checks and its day check pass, and cutting the town into
squares changes at most 59 of 921 600 pixels in the views compared.

vivo V40, milliseconds a frame (median of three), the game's medium setting
as shipped, portrait 617 by 1200:

| View | Before | Lighter trees | And the town in squares, paving casting no shadow |
| --- | --- | --- | --- |
| road | 33.7 | 27.6 | 21.3 |
| gate | 29.5 | 24.8 | 19.9 |
| town | 24.9 | 17.8 | 12.2 |
| wide | 41.5 | 28.2 | 25.3 |

The same content with every effect on at 1280 by 720: 126, 93, 77, 176 before;
96, 88, 77, 106 with the lighter trees; 87, 79, 55, 99 with the town in
squares. Draw calls in that setting went from about 770 to 2700..4200.

What each group of scenery costs as a shadow caster (town view, every effect
on, 77.2 ms): without the town casting 55.2; without trees 76.8; without
small plants and stones 77.0; without the land 77.0; without shadows 53.5.

## Limits and what is not verified

- Only one square size (16 m) was tried; larger squares would be fewer draws.
- Looks at 40 % and 5 % were not judged; only 15 % was looked at.
- The trunk of the jacaranda only simplifies across seams; its UVs were not
  inspected up close.
