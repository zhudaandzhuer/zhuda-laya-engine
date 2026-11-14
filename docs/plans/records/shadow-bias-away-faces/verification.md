# Verification record: shadow-bias-away-faces

Task document: `docs/plans/records/shadow-bias-away-faces/task.md`  
Commit: the commit that adds this file, on top of `714dc9f`  
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build on the same adapter.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `714dc9f`. Consumer:
  `films/river-town-prefab` (not a git repository), built against this
  worktree: WebGL for the first measurements, WebGPU for the rest.
- DPR, viewport and network mode: DPR 1; 1280 by 720; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/shadow-bias-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 517 of 517 (514 before, 3 new in `tests/shadow-bias.test.mjs`) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Shadow-related GPU checks, WebGL | `verify:film-scene`, `-look`, `quality-route`, `film-model`, `film-animation`, `film-point-shadow`, `grass`, `prefab-models` | PASS, all eight | `EV/webgl/` |
| The same on WebGPU | with `ZHUDA_FILM_RENDERER=webgpu` | PASS, all eight | `EV/webgpu/` |
| The game's road, before and after | the game's check hooks: a held camera on the road at ten in the morning, mean brightness of the road in the frame | see below | `EV/game/` |

Measurements in the game (mean of the road's part of the frame, 0..255):

| Engine | As shipped | Road model casts no shadow | Sun's shadows off |
| --- | --- | --- | --- |
| Before (`714dc9f`) | 60 | 84 | 110 |
| With the patch | 83 | 84 | not measured again |

- Before, the sun's normal bias decided it: bias 0 gave 83, 0.3 gave 80, the
  default 1 gave 60 (depth bias 1 throughout).
- With the patch the tree's shadow lies on the road as in the three.js
  picture of the same scene (`EV/game/road-after.png`,
  `films/compare-three/evidence/`).
- A house wall with a roof's shadow across it shows no banding after the
  patch (`EV/game/house-wall-after.png`). Looked at, not measured.

## What was tried and did not work

- First guess: the shadow camera stands too close (LayaAir's
  `shadowNearPlane`, 0.1 m) and clips tall trees. Setting it to 120 m changed
  nothing; the change was taken out again.
- Two isolated reproductions, each run with and without the patch: a closed
  8 cm slab with a two-sided material (browser SDK fixture), and a floor
  modelled upside down as a glTF model in a film scene. Neither showed the
  self-shadow without the patch, so neither would have caught the defect and
  both were removed. What the game's road has that they lack was not found.

## Limits and what is not verified

- No GPU check in this repository fails without the patch. The drawn
  evidence is one consumer scene; the unit tests cover the patch's text and
  arithmetic and that the vendored line is still there.
- Phones: not run.
- The vendored renderer appears to compute one bias from the furthest split
  and use it for every split; that was read, not measured, and is not
  changed here.
- A face that looks away from the light now gets no normal bias as a caster.
  Where such a face is lit from its back (a leaf card, the flipped deck) only
  the depth bias keeps it from banding; none was seen in the scenes drawn.
