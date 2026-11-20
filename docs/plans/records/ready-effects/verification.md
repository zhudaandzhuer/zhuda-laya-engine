# Verification record: ready 3D effects and picture materials

Task document: [task](task.md)\
Commits: `c285127`, `115c37f`, `67088b0` and the one that carries this
record, on `b63cc20` (branch `feat/effect-presets`)\
Date: 2026-11-21

## Environment

macOS (Darwin 27.2), Apple M4, Chrome 157 headless (`ANGLE (Apple, ANGLE
Metal Renderer: Apple M4)` on WebGL; `WebGPU apple metal-3`), Node 26.13.1.

## Checks

| Check                     | Command                                                                                                                  | Result            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Verify, lint, format      | `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`                                             | pass (968 tests)  |
| Effects, WebGL            | `npm run verify:film-effects` (new)                                                                                      | pass              |
| Picture materials, WebGL  | `npm run verify:film-picture-material` (new)                                                                             | pass              |
| Neighbours, WebGL         | `npm run verify:film`, `verify:film-look`, `verify:film-terrain`, `verify:film-grass`, `verify:film-cutout`, `verify:film-model` | pass, each        |
| Film checks, WebGPU       | `npm run verify:film-webgpu` (the two new ones are in its list)                                                          | pass (35 checks)  |

## What the new checks measured

**Effects** (`verify:film-effects`, 320 by 240, WebGL; the WebGPU run agrees
within a few pixels): every one of the eighteen presets is drawn, is the same
bytes at the same shot time on the first drawing after the mount and on two
later ones with another time drawn between, moves or ends as its kind says,
and draws nothing before its `startSec`.

| Preset           | Pixels it changes | A quarter second on (loop) or after its time (burst) |
| ---------------- | ----------------- | ---------------------------------------------------- |
| campfire         | 7,548             | 4,597 differ                                         |
| torch            | 1,035             | 1,056                                                |
| smoke-column     | 21,341            | 13,001                                               |
| steam            | 17,531            | 17,876                                               |
| sparks           | 1,364             | 2,299                                                |
| explosion        | 11,445            | 0 left                                               |
| hit              | 5,399             | 0 left                                               |
| magic-aura       | 5,749             | 7,888                                                |
| heal             | 1,844             | 3,354                                                |
| portal           | 22,507            | 19,564                                               |
| fireflies        | 134               | 348                                                  |
| rain             | 8,339             | 17,054                                               |
| snow             | 632               | 1,327                                                |
| dust-motes       | 149               | 278                                                  |
| falling-leaves   | 519               | 1,121                                                |
| petals           | 290               | 542                                                  |
| bubbles          | 1,638             | 3,077                                                |
| embers           | 270               | 636                                                  |

(The table was taken before the draw-order fix below, which moves a few
pixels where two emitters overlap; the check's own report in its evidence
folder has the numbers of a run.) Twice the
scale covers 23,098 pixels against 7,548; another seed moves 6,250 pixels.

Unit tests (`tests/effect-presets.test.mjs`): each sprite is white with
alpha, clear at its corners and the same bytes twice; each preset is valid,
on built-in sprites, drops no particle over its time plus six seconds, holds
at most 1,000 particles, and a burst has none alive at the end.

**Picture materials** (`verify:film-picture-material`, 640 by 360, pictures
written by the check): a 4 m tile of four stripes shows 7 changes down a
6.9 m view and 13 at a 2 m tile; its red is drawn `[187, 0, 3]` and its blue
`[0, 2, 199]`; a tint without red leaves the brightest red at 2; a normal map
of ridges changes 47.8 % of the pixels under a low sun, the other convention
50.5 % against the first, a strength of 0.2 only 28.4 %; a picture that is
not there is refused by its name.

## A defect found and fixed on the way

On WebGPU the same shot time was not always the same picture: about three
runs in five, nine pixels of one ember differed by up to 16 of 255 between
two drawings (never on WebGL). Not mip levels (it stayed with them off). The
emitters of one effect are blended meshes at one place, sorted by distance
like any other, and two of them (smoke and embers) changed places from frame
to frame. `ZhudaEffect3D` now gives each emitter its own place in the render
queue, in the preset's order: six runs of six identical on WebGPU, and the
check compares bytes.

## Outside the repository (not part of its checks)

- 48 tileable texture sets (albedo, height, normal; 1024 and 512) were
  generated with an image model (gpt-image-2.6-flare, 96 pictures in two
  batches, none failed), made seamless by a script, and put in
  `ZhudaGameCenter/commonAssets/` with a catalogue. An example scene there on
  six of them and a campfire was drawn through the film host with
  `--film-assets` pointed at that folder: no graphics error.
- The 512 versions were copied to the outside review's repository
  (`VerifyZhuda/textures/`).

## Unverified limits

- **Nothing was removed from `assets/`**: every file there is referenced. The
  request to take out what is of no use is open.
- No phone and no Windows machine drew an effect or a picture material. A
  preset's cost on a phone (rain: 900 particles, one draw an emitter) was not
  measured.
- The presets were looked at as stills on a dark stage and tuned by eye
  once; none was judged in motion by a person. Smoke and steam read as
  separate puffs up close.
- Particles are unlit and unshadowed, do not fade where they meet geometry
  (a puff is cut by the ground), and are not sorted against other blended
  things in the scene (water, glass).
- `seek` simulates from the start: an effect asked for at minute ten of a
  shot steps 72,000 times once. Not timed.
- A picture material's memory (5.6 MB for a 1024 picture with mip levels)
  was worked out, not measured; pictures are not compressed (no KTX 2 path
  for them).
- There are no ready 2D effects.
- Whether the generated textures tile well was looked at on a preview sheet
  and measured at the seam (0.8 to 1.5 times the step between neighbouring
  pixels after processing); none was judged up close on a wall in a scene
  except the six of the example.
