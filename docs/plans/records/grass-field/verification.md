# Verification record: grass-field

Task document: `docs/plans/records/grass-field/task.md`  
Commit: the commit that adds this file, on top of `4af5936`  
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK on the
  same adapter.
- Node and package manager: Node 26.12.0, npm 11.20.0 (`engines` asks `>=24`).
- Engine and consumer commits: on top of `4af5936`. Consumer:
  `films/river-town-prefab` (not a git repository), built against this
  worktree for the pictures and against `main` after the merge.
- DPR, viewport and network mode: DPR 1; 960 by 540 (engine fixture), 1280 by
  720 (the game); loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/grass-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 514 of 514 (504 before, 10 new in `tests/grass.test.mjs`) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Grass field, WebGL | `npm run verify:grass` | PASS | `EV/webgl/evidence/report.json`, `grass-*.png` |
| Grass field, WebGPU | `GRASS_RENDERER=webgpu npm run verify:grass` | PASS | `EV/webgpu/evidence/report.json`, `grass-*.png` |
| The game with the field planted | in `films/river-town-prefab`: build, `node tools/day.mjs` (WebGPU build, eight pictures, its own assertions) | PASS | `EV/city/day-*.png`, `EV/city/day.json` |
| Frame cost in the game | `cost()` of the game at quality 3 and 2, tiers high and medium, with and without `?grass=0`, two rounds | Coarse only, see below | `EV/city/grass-cost2.log` |

What `verify:grass` asserts, on both backends with the same numbers unless
noted:

- Bare earth has no green pixel; with the field 98 % of the lower part of the
  frame is green (86 % before the turf was added: earth showed between
  blades seen from above).
- Level with the horizon, the band 30 to 90 rows under it is fully green
  (thinned, widened blades and turf); the rows just under the horizon, past
  60 m, have none.
- No green on a 3 m road the game excludes; grass stands beside it.
- The same time draws the same picture (difference 0); 0.9 s later the mean
  brightness difference is 5.6 (5.55 on WebGPU); with wind strength 0 it is 0.
- The box's shadow darkens grass pixels.
- Default options, eye in open land: 308 patches, 701 048 blades, 3 741 940
  vertices.
- Running 80 m at 6 m a second, 6000 blades a call: at most 3 patches short
  of a mesh, none of the blades a field made on the spot would have missing;
  at most 394 patches held against 308 standing still.
- A density of 5 is refused; a disposed field refuses `update`; after
  `dispose` the earth is bare and the scene holds as many resources as
  before (38).

## Found and fixed while drawing

- The back of a blade was lit from below: LayaAir turns the normal of a back
  face round. `ZhudaLitSurfaceMaterial` has `backFaces: 'same'` for this now.
- Seen from above, earth showed between clumps at any density a game can
  afford. The turf under the blades was added for this.
- Making a whole patch again each time it crossed a distance came to about
  220 000 blades for every metre walked (computed from the ring sizes). The
  blades of a patch are kept in five meshes by rank instead: coming nearer
  makes only the new ones (about 87 000 a metre by the same sum), going
  away drops a mesh.
- A mesh of tens of thousands of blades took 10 to 20 ms to make on a loaded
  machine: it is made over several calls and shown when whole.

## Limits and what is not verified

- Phones and mini-game hosts: not run.
- Frame times: the engine's check measures none. In the game, in a headless
  browser, `cost()` with grass against without: high tier 23.5 against
  20.4 ms and 24.9 against 23.0 ms; medium 20.6 against 19.2 ms, and a
  second round under load (27.4 against 29.3 ms) that says nothing. Read as
  "one and a half to three milliseconds on this machine", no more.
- The ultra tier of the game takes about 200 ms a frame in the headless
  browser with or without grass (its model pack): the grass at 900 blades a
  square metre was drawn there but its cost could not be told apart.
- Art approval: the pictures are for the owner to judge.
- Not built: blades pushed aside by a character, blade shadows, light
  through a blade, a grass node for film scenes.
