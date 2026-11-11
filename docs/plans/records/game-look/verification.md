# Verification record: game-look

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `534835d`)  
Date: 2026-11-12

## Environment

macOS, Chrome headless, Apple M4; WebGL through ANGLE Metal, WebGPU on
`apple metal-3`. Node v26.12.0. Consumer game: `films/river-town-prefab`
(outside this repository), 1280x720, DPR 1, a prefab of 40 model nodes and
7 968 copies, water, a skinned character.

## Checks

| Check                         | Exact command or procedure                                                               | Result                             |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Governor, look table, adapter | `node --test tests/quality-governor.test.mjs tests/webgpu.test.mjs`                      | PASS                               |
| Full gate                     | `npm run verify` (416 tests), `npm run lint`, `npm run format:check`, `git diff --check` | PASS                               |
| Film on WebGPU                | `npm run verify:film-webgpu` (eight)                                                     | PASS                               |
| Film on WebGL                 | the same eight scripts with the default renderer                                         | PASS                               |
| Model prefabs                 | `npm run verify:prefab-models`                                                           | PASS                               |
| Game, every level, WebGL      | consumer `node tools/quality.mjs webgl` (WebGL build)                                    | Runs, no errors                    |
| Game, every level, WebGPU     | consumer `RENDERER=webgpu node tools/build.mjs && node tools/quality.mjs webgpu`         | Runs, no page or validation errors |
| Game, walk check, WebGPU      | consumer `node tools/walk.mjs` on the WebGPU build                                       | PASS                               |

## Frame cost in the consumer game

Time to run the game's update and submit one frame, averaged over 60 frames
while walking, drawn back to back:

| Level | WebGL (ms) | WebGPU (ms) |
| ----- | ---------- | ----------- |
| 3     | 19         | 17 to 21    |
| 2     | 22         | 9 to 12     |
| 1     | 16.5       | 5           |
| 0     | 6          | 0.4         |

Before the auxiliary passes were fixed, level 3 on WebGL took 145 ms.

**What these numbers are not.** They are CPU time to submit a frame, not GPU
time and not frame rate: the WebGPU figures in particular mostly measure
command encoding. Repeated WebGL runs differed by up to a factor of two.
They show the order of the levels and the size of the fix, nothing finer.

## Defects found and fixed

1. **Auxiliary cameras drawn twice.** The mirror and the beams' depth camera
   were scene cameras with render targets, drawn by the frame loop and again
   by hand. They are out of the loop now.
2. **Shadow maps redrawn for every auxiliary pass.** Each hand-drawn pass
   redrew four cascades. The beams' depth pass never needs them; the mirror
   can use the main view's (`mirrorShadows: false`).
3. **Beams' depth picture redrawn every frame.** With `moved` it is redrawn
   only when the camera leaves a grid cell.
4. **WebGPU: scenery loaded while the game runs broke the glTF shader.** See
   `docs/webgpu.md` (reflection probe not assigned before a hand-drawn pass).
5. **Depth-normal pass with fog on WebGL.** The pass logged a link warning
   and skipped glTF models, so they got no ambient occlusion in fogged
   scenes. The fix made for WebGPU now applies to both.
6. **Sky on a running scene.** Removing the look's sky from a scene that has
   drawn threw in Laya; the scene gets its previous sky mesh back.
7. **Texture destroyed while in use on WebGPU.** Changing quality rebuilt the
   sky-and-ground light and destroyed its cube texture inside a frame; it is
   now set up once per look.
8. **A frame of no time** made the governor throw; it is skipped.

## Unverified limits

- No GPU timing, no real frame-rate measurement on a visible window, no run
  on Windows, a discrete GPU, an integrated laptop GPU or a phone.
- The governor's behaviour is unit-tested with synthetic frame times; in the
  game it was seen to step down in headless Chrome, not studied further.
- `setShaftRefresh('moved')` and `mirrorShadows` have no engine-side real-GPU
  check; they were exercised only through the consumer game.
- With the look on, the water in the game is clearer and its mirror darker
  than in the film stills; that is tuning, not measured.
- No level of detail or culling: every copy is still submitted every frame.
