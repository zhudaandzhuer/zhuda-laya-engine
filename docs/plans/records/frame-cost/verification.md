# Verification record: frame-cost

Task document: `docs/plans/records/frame-cost/task.md`  
Commit: the commit that adds this file, on top of `09a840c`  
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  `apple` / `metal-3`, not a fallback adapter.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine commit: on top of `09a840c` (the first round is `e6badce`; the
  review round's commit is on top of that). No consumer, no phone.
- DPR, viewport and network mode: DPR 1; 480 by 300 (shadows), 600 by 360
  (render scale); loopback only.
- Where the review round ran: in a clone of the repository at `e6badce` with
  the round's changes, `node_modules` linked from the repository. Everything
  below marked "review round" was measured there.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/frame-cost-evidence/`;
  the review round's is in `EV/review-round/` (`RR` below). The first
  round's evidence is kept beside it and matches `e6badce`.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 544 of 544 (528 before the task, 540 at `e6badce`; 16 in `tests/frame-cost.test.mjs`) | `RR/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `RR/format.log`, `RR/lint.log` |
| Shadow updates, WebGL | `npm run verify:shadow-updates` | PASS | `RR/shadow-updates-webgl/evidence/` |
| Shadow updates, WebGPU | `SHADOW_UPDATES_RENDERER=webgpu npm run verify:shadow-updates` | PASS | `RR/shadow-updates-webgpu/evidence/` |
| Render scale, WebGL | `npm run verify:render-scale` | PASS | `RR/render-scale-webgl/evidence/` |
| Render scale, WebGPU | `RENDER_SCALE_RENDERER=webgpu npm run verify:render-scale` | PASS | `RR/render-scale-webgpu/evidence/` |
| The pond page against the engine as first committed | `tests/fixtures/shadow-updates.ts?water` of the review round, served with the browser SDK built from `e6badce`, WebGL and WebGPU | FAIL, as the review found: see "Other cameras" | `RR/before-webgl/evidence/`, `RR/before-webgpu/evidence/` |
| Neighbouring draws | `verify:film-water`, `verify:film-reflector`, `verify:live-look`, each on WebGL and WebGPU | PASS, six of six | `RR/neighbours/*.log` |
| Phone (vivo V40) | not run: no phone was touched in this task | UNAVAILABLE | none |

## (a) Shadows drawn less often

### What LayaAir's own skipping does (measured, before the repair)

`Scene3D.shadowMapFrequency = 3`, nothing of the engine's in the way (the
`?native` page of `verify:shadow-updates`):

- WebGPU: every frame that skips the maps is lost. LayaAir takes the shadow
  uniforms out of the scene's set on such a frame, every shadowed material's
  pipeline then fails validation ("Binding doesn't exist in
  BindGroupLayout ... @group(0) @binding(8)"), the command buffer is invalid
  and the canvas keeps the frame before: the moving post stands still on
  six of nine frames; 26 warnings from the GPU (the validation errors and
  the invalid command buffers they cause). A material whose shader
  is first compiled on such a frame throws in LayaAir's shader compile
  ("Cannot read properties of null (reading 'buffer')") on every frame after.
- WebGL: frames are drawn and kept maps are read, but a material whose shader
  is first compiled on a skipped frame files its shadow uniforms with the
  material's: the tile is drawn in the floor's colour, without the post's
  shadow, on the two skipped frames, and black from the next frame that
  draws the maps, for good (none of its pixels has its colour on any of
  the five frames).
- Its frame count runs on `Scene3D._updateMark`, which every hand-drawn view
  (a mirror, the beams' depth picture, a point shadow) also advances, so
  which frames draw depends on what else draws.

The plan's question ("whether `shadowMapFrequency` > 1 keeps receivers
shadowed") is answered: with already compiled shaders on WebGL, yes; on
WebGPU, no frame survives; on either, a shader first compiled on a skipped
frame is broken.

### The engine's rule

`installLaya342SkippedShadowFrames` keeps the shadow uniforms on a frame that
keeps the maps (only while shadows are on and the maps of an earlier frame
are in use); `ZhudaShadowUpdates` answers LayaAir's frame test itself, once a
LayaAir frame (`Stat.loopCount`) for the camera the maps are kept for.

What `verify:shadow-updates` asserts on its main page, with the same numbers
on both backends (overlap: shared over joined shadow pixels, leaving out
where the post stands):

- `update: 'interval', interval: 3`, the post moving 0.3 m a frame: 3 of 9
  frames draw the maps, none taken. On those the shadow matches the
  every-frame reference at that place (overlap 1.000); on the two between it
  matches the shadow of the frame that drew (1.000) and not the post's place
  now (0.517, 0.263; 0.528, 0.246; 0.530, 0.249). The post moves on every
  frame (its centre 157.2, 169.5, 181.8 ... 256.4 px): the frames are drawn.
- A floor tile lying under the post's shadow, whose material is first drawn
  on a frame that keeps the maps (review round; the first round's tile lay
  where no shadow reached): on all five frames after, through a frame that
  draws, 1075 of its 5363 pixels are in shadow, as when the same tile is
  drawn every frame (overlap of the two shadows 1.000, sunlit share 0.800
  in both).
- `'manual'`: the shadow stays where it was drawn on all nine frames
  (overlap 1.000) while the post walks out of it (0.044, then 0); after
  `redrawShadows()` it is the post's (1.000); a sun turned by 40 degrees
  through `setLook` draws it again by itself (0.103 like before).
- Back to `'every'`: the look is rebuilt, the rule is gone
  (`look.shadowStats` undefined), the scene's frequency is 1 and the shadow
  is the reference (1.000). Disposal leaves no accessor on the scene.
- No page, console, renderer or GPU errors; an interval of 1 is refused.

### Other cameras of the scene (review round)

LayaAir has one set of sun shadow maps. The camera that draws them fits
them to its own view, and the matrices and split spheres that go with them
are written to the scene, so every camera reads the last camera's set. The
rule as first committed gave every camera drawn in a frame the frame's
answer. A game draws its water's mirror from its tick, which LayaAir runs
after the frame is drawn and within the same LayaAir frame: on a frame that
drew the maps the mirror drew them again, for itself, and the frames that
kept them read the mirror's.

The pond page (`?water`): a pond with the engine's `ZhudaWaterSurface`,
its mirror drawn from a LayaAir frame timer as `ZhudaRuntime` calls a
game's tick; a wall beyond it with a bar's shadow across it; two cascades
(a look's default); the mirror's own picture shown in a corner of the
frame. Shadow pixels on land (outside the pond and that corner), a post
moving as above; drawn every frame they are 8031 to 9186.

With the engine as first committed (`e6badce`), the same page, WebGL and
WebGPU alike:

| `mirrorShadows` | every third frame | on request |
| --- | --- | --- |
| left out (then: true) | 453 pixels on 6 of 9 frames (the frames that keep the maps) | 453 on 9 of 9 |
| true | the same | the same |
| false | 8664 to 9814 on all nine | 8812 to 9868 on all nine |

The 453 are no shadows: the faces of the wall and the bar that are turned
from the sun. Picture `RR/before-webgpu/evidence/water-default.png` (third
and fourth frame: no shadow on land). After an environment probe's capture
under an interval of 3, one of the next four frames had lost the shadows
on WebGL (and two more had them elsewhere, overlap 0.904) and three of four
on WebGPU: the review's reading of the probes was right.

Now the maps are kept for one camera, the view (the look gives its own). A
camera that is not the view draws maps of its own whenever it draws with
shadows on, as it does without the rule, and the view then draws its maps
again the next time it is drawn: it never reads another camera's. A camera
named a borrower reads the view's maps while they are in place and no
drawing is pending; the engine's mirrors are borrowers unless their
`shadows` / `mirrorShadows` option is given. What `verify:shadow-updates`
asserts on the pond page, the same numbers on both backends:

| `mirrorShadows` | every third frame: frames, drew the maps, taken | on request | shadows on land | the mirror's picture |
| --- | --- | --- | --- | --- |
| left out | 9, 3, 0 | 9, 0, 0 | on every frame those of the frame that drew them (overlap 1.000, 8664 to 9868 pixels) | shows the bar's shadow on the wall from the second frame on (963 to 977 dark pixels; 121 drawn every frame) |
| true | 9, 9, 8 | 9, 9, 9 | on every frame those of that frame (overlap 1.000): right, and nothing saved | 121, as drawn every frame |
| false | 9, 3, 0 | 9, 0, 0 | as with it left out | 121: no shadow, as before the task |

- After an environment probe's capture under an interval of 3 (six views by
  another camera, each with maps of its own): the land has its shadows on
  each of the next four frames (overlap 1.000 with the scene drawn every
  frame after the same capture, 9032 pixels); the view drew its maps again
  (taken 1 on WebGL; 4 on WebGPU, where frames are drawn between the
  capture's views while it waits for its read-backs).
- Stills of a film stage with a water node and a plate moved between them
  (`?film`; one and four samples): under `'manual'` and under `'interval'`
  (30) every still is the still drawn every frame (difference 0.000) and
  the plate's shadow is under the plate (its centre at x 162.7, 315.6,
  160.8, 317.8 in all three). The first round stated this from a unit test
  on fakes; it holds when drawn, before and after this round.
- Reading the scene's `shadowMapFrequency` no longer uses up a frame of the
  rule: outside a camera's draw it is what the game set (unit test).

Found while drawing the pond, measured with `RR/mirror-probe/mirror.ts` (a
`ZhudaPlanarReflection` drawn by hand while shadows are drawn every frame,
its picture read down the mirrored wall; the build of `e6badce`, WebGL with
one and two cascades, WebGPU), both older than this task and not changed
by it:

- A mirror with the water's clipping plane and shadow maps of its own shows
  no shadow on the wall (brightness 233 to 223 down the wall, no dip); the
  same mirror without the clipping plane shows it (233, 232, 231, 152, 64,
  64, 226). A water's mirror always clips: while shadows are drawn every
  frame it pays for maps that, in this scene, show nothing (the pond page
  after this round agrees: 121 dark pixels in its picture with each
  setting). Not investigated further; the oblique near plane the clipping
  uses is where LayaAir takes its planes for choosing casters.
- A mirror drawn with `shadows: false` shows no shadow either, with or
  without the clipping plane. The option's description said it used the
  shadow maps of the main view; it and `docs/film-scenes.md` now say what
  is drawn. A camera whose first draws were made this way stays without
  shadows when later drawn the borrowing way (measured with an earlier
  state of this change, `RR/mirror-probe/borrow-after-shadowless/`; not
  kept as a check), so `false` keeps its own path under a rule and only a
  mirror left at its default borrows.

So under `shadows.update` a water left at its defaults mirrors the main
view's shadows, which it does not while shadows are drawn every frame: the
picture changes for the better between the two, and the two are not the
same picture.

Pictures (`RR/shadow-updates-*/evidence/`): `every.png` (every frame),
`interval.png` (every third frame: the shadow lags in steps), `manual.png`
(kept, kept, kept, asked, sun moved), `tile.png` (the tile under the post's
shadow on a kept frame, a drawn frame, a kept frame, and drawn every frame)
against `native-tile.png` (LayaAir's own skipping), `native-interval.png`
(WebGPU: the post stands still), `water-default.png`, `water-own.png`,
`water-main.png` (drawn every frame, the frame that draws, a frame that
keeps, on request with the post gone on), `water-probe.png`,
`film-stills.png`. Looked at for this record: with the pond left at its
defaults the land keeps every shadow on the kept frames and the corner
picture shows a dark band across the mirrored wall from the first kept
frame; with `mirrorShadows: true` the post's shadow is under the post on
every frame and the mirrored wall has no band.

Desktop time a frame, the GPU made to finish by a read each frame, 30
frames, review round: 2.5 to 3.8 ms for every frame, every third and on
request in the small scene; with four splits of 4096 over 400 casters 7.77
against 5.81 ms (WebGL) and 6.81 against 5.33 ms (WebGPU); the first round
read 8.27 against 6.67 and 6.08 against 6.08. These say nothing about a
phone and not much about this desktop: the read-back dominates and the
numbers move from run to run.

## (b) Render scale and (c) the upscale

The scale is LayaAir's `Config3D.pixelRatio`: the camera's target and every
picture of its post chain are drawn at that size and LayaAir's
`Scene3D.blitMainCanvas` stretches the result over the canvas. The
upscale replaces that stretch: `'fsr'` draws EASU (12 texels, an
approximate Lanczos-2 lobe shaped by the edge, clamped to the four nearest
texels) into an 8-bit target of canvas size holding square roots, then RCAS
(5 reads, sharpening limited to what keeps 0..1) onto the canvas;
`'bilinear'` runs RCAS on filtered reads of the small picture in one pass.
It cannot be an effect inside the chain: LayaAir sizes every picture of the
chain to the camera's smaller target. On WebGPU the canvas is upside down
against a target, so the EASU pass is turned over (found by drawing: the
first WebGPU run was upside down).

What `verify:render-scale` asserts, with the same numbers on both backends
to a few thousandths (sharpness: root mean squared brightness step between
neighbours over the 3D part; difference: mean absolute brightness
difference, 0..255, against the picture at full size):

| At 0.67 (402 by 241), the page's look (multisampled, no bloom) | sharpness | difference |
| --- | --- | --- |
| full size (reference) | 17.21 | 0 |
| LayaAir's plain stretch | 12.02 | 2.70 |
| bilinear + RCAS | 13.68 | 2.82 |
| EASU alone (sharpness 0) | 14.00 | 1.98 |
| FSR (EASU + RCAS 0.8) | 15.90 | 2.50 |

- In this look FSR is 32 % sharper than the plain stretch and nearer the
  full-size picture; RCAS on a filtered upscale is 14 % sharper and 4 %
  further. EASU alone is the nearest; the sharpening moves it 0.5 further
  and makes it 14 % sharper. Neither is sharper than full size.
- "Nearer" belongs to that look, not to the upscale (review round). Three
  other looks at 0.67, each against its own full size:

  | Look | sharpness: full, plain, FSR | difference: plain, FSR |
  | --- | --- | --- |
  | the page's look without edge smoothing | 21.01, 14.53, 18.52 | 3.55, 3.61 |
  | one-pass edge smoothing, bloom 0.4, ambient occlusion 0.5 | 16.19, 11.40, 15.22 | 3.54, 3.51 |
  | `preset: 'day'` as it is | 21.67, 15.02, 18.88 | 3.67, 3.81 |

  FSR is 26 to 34 % sharper than the plain stretch in all four and never
  sharper than full size; it is nearer the full-size picture in two of the
  four and further in two, by about 0.2 at most. The script asserts the
  first and, for the three looks, that the two differences are within 0.5.
- Uncovered canvas (review round). What a pixel no 3D camera covers reads
  like is measured first, from a view over a quarter of the canvas: the
  stage's magenta on WebGL, opaque black on WebGPU (the first round's test
  for magenta could not fail there). The test counts 138000 such pixels
  around that view (the canvas less the view and the interface strip) on
  both backends, and none in the full-size picture. At 0.67 each upscale
  fills that quarter and no more (138000 or 138001 again, difference from
  the full-size quarter 1.26 to 1.29).
- At 1, 0.9, 0.85, 0.75, 0.67, 0.6 and 0.5, with each of the three
  upscales: no uncovered pixel, the outermost row and columns are the
  scene's colour (within 12 of full size), the picture is the scene
  (difference at most 4.15, plain at 0.5; FSR 3.10). The output fills the
  canvas on both backends: the plan's open question is answered.
- The interface strip drawn by the 2D stage over the view is identical to
  full size at 0.67 with each upscale (difference 0).
- The whole chain at 0.67 with FSR (light fog with sun beams, screen
  reflections, clouds): canvas covered, no error.
- `zhudaQualitySteps()` walked by `setStep`, rung by rung: 3@1, 3@0.85,
  3@0.7, 2@0.7, 1@0.7, 0@0.7, 0@0.5; each draws at its scale and covers the
  canvas; back at the top, `Config3D.pixelRatio` is 1 and the picture is the
  first (difference 0).
- A second look asking for a scale is refused (one per stage); a scale of
  0.4, an unknown upscale and a sharpness of 2 are refused. Ten scale
  changes leave no resource held (LayaAir's pool of camera targets of each
  size is left out of the count: it keeps them until its memory cap).
  Disposal gives `Config3D.pixelRatio` 1 and LayaAir's own stretch back.
- A scene destroyed with its look left undisposed (review round; before,
  the stage stayed scaled and every later scaled look was refused): the
  look held 0.8; after `scene.destroy(true)` `Config3D.pixelRatio` is 1; the
  next look that asks for 0.75 gets it and covers the canvas; disposing the
  forgotten look afterwards changes nothing (0.75 still).

Pictures (`RR/render-scale-*/evidence/`): `scale-reference.png`,
`scale-plain.png`, `scale-bilinear.png`, `scale-easu.png`, `scale-fsr.png`
(all 0.67), `scale-half.png` (FSR at 0.5), `scale-rich.png` (the whole chain
at 0.67), `split.png` and `split-fsr.png` (the quarter view at full size
and at 0.67, bare canvas around it), and `detail-*.png`: the finest stripes
and slanted bars three times enlarged. Looked at for this record: the plain
stretch is soft; RCAS on the filtered upscale sharpens but shows the steps
of slanted bars more; FSR keeps the bars smooth and the stripes crisp. The
3 cm stripes alias at 0.67 with every upscale (finer than the smaller
picture can hold). On WebGPU the canvas around the quarter view is black
and the view sits exactly in its quarter.

Desktop time a frame, the GPU made to finish by a read, 20 frames, review
round: WebGL 5.53 ms at full size, 5.51 plain, 4.87 bilinear, 4.91 FSR at
0.67; WebGPU 3.33, 3.28, 3.36, 3.45 (the first round read 6.77, 5.75, 5.63,
5.75 and 4.38, 3.78, 4.11, 4.29). Not phone evidence.

## Unit tests (`tests/frame-cost.test.mjs`)

Options and their refusals for both levers; which frames draw (every,
interval 2 and 3, requests that restart the count, manual); the rule asked
as LayaAir asks it, through the render pass set-up of one camera: one answer
a frame for its view, a view with shadows off neither drawing nor counting,
a request within a frame, the game's own `shadowMapFrequency` read and set
without using up a frame; another camera drawing its own maps and the view
drawing again, a borrower reading the kept maps and drawing its own while a
drawing is pending or the maps are another camera's, a probe's six views,
maps taken within a kept frame; without a view of its own, a camera on the
canvas and two that take the maps from each other; a mirror left at its
default, told `true` and told `false`, with and without a rule; the repair
adding the shadow uniforms only on a kept frame with shadows on and maps in
use; one rule a scene; the look field validated and resolved, `every`
against the others rebuilding, in place otherwise; the rule set and the
maps redrawn on a moved sun or changed settings; the FSR passes, their
places and the WebGPU turn, target reuse and release, LayaAir's stretch at
`'plain'`, at 1 and with its own FXAA; a scene destroyed while it holds the
render scale; the ladder and its refusals; a governor stepping down the
ladder through the scales before any effect goes and back up.

## Review round: what was found and what was done

| Finding | Done |
| --- | --- |
| Major: with a water at its defaults the main view lost the sun's shadows on every frame that kept the maps; by reading, the same for probe captures | Reproduced with the repository's own page (table above), on both backends, the probe included. The maps are kept for the look's camera only; mirrors left at their default borrow them; any other camera draws its own and the view draws again. `docs/film-scenes.md`, the option's descriptions and the limits say so. |
| Minor: on WebGPU the test for uncovered canvas could not fail | The bare canvas's colour is measured per backend; the test is shown to count a quarter view's surroundings and is then applied; each upscale is also held to a quarter view. |
| Minor: the tile first compiled on a kept frame was only checked where no shadow reached | The tile lies under the post's shadow and its shadow is held to the one drawn every frame. |
| Minor: film stills under `'manual'` and `'interval'` were claimed from a unit test on fakes | Drawn (`?film`), with a water node, on both backends. |
| Minor: "FSR is nearer the full-size picture" read as a property of the upscale | Three more looks are drawn and reported; the claim is scoped to the page's look here, in the task, in `docs/plans/README.md` and in `docs/film-scenes.md`. The first commit's message says it unscoped and stays as it is. |
| Minor: a scene destroyed without its look disposed kept the stage scaled and the scale claimed | The scene's destruction gives both back; drawn and unit-tested. The alpha the upscale passes write and a sun turned outside `setLook` are listed as limits and in the docs, not changed. |

## Limits and decision

- No phone. The 3.5 to 6.7 ms of shadows and the 40 to 64 ms frames of look
  level 2 on the vivo V40 are not measured again; whether interval shadows
  or 0.67 with FSR save what they should there is the next step, in
  `films/river-town-prefab`.
- The ladder's rungs are a proposal until then.
- Other cameras under a rule, not drawn: a mirror the engine's frame loop
  draws itself (the wet surface; unit-tested on fakes), a bounce-light
  capture, two cameras on the canvas (unit-tested: right picture, nothing
  saved), a game's own camera drawn into a target. A borrowing mirror shows
  the main view's shadows only where the main view's cascades reach.
- A water's mirror with maps of its own shows no sun shadow in the
  fixture's scene, and a mirror with `mirrorShadows: false` shows none
  anywhere (both found here, both older than this task, neither changed).
  One scene, one sun direction; not investigated beyond the probe above.
- Not drawn: the spot light's shadow under a rule (LayaAir skips it with the
  sun's; only the sun was drawn); a canvas resized while scaled (the target
  follows the viewport); DPR above 1; a see-through canvas (the `'fsr'` and
  `'bilinear'` passes write alpha 1 where LayaAir's stretch copies it).
- `'manual'` follows a sun turned through `setLook` only; a game that turns
  `look.sun` itself calls `redrawShadows()`. It does not follow the camera:
  a camera that moves far needs `redrawShadows()` or `'interval'`.
- Stills and videos of a film always draw the maps; a film preview in the
  editor follows the rule.
- The review round's checks were run in a clone of the repository at
  `e6badce` with the round's changes, not in the work package's worktree,
  and not again after its commit was brought onto the branch.
- Art approval: the pictures are for the owner.

Decision: **Implemented within scope**: both levers drawn and checked on
desktop WebGL and WebGPU, with other cameras of the scene. Not Accepted:
the phone measurement it is for is missing.
