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
- Engine commit: on top of `09a840c`. No consumer, no phone.
- DPR, viewport and network mode: DPR 1; 480 by 300 (shadows), 600 by 360
  (render scale); loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/frame-cost-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 540 of 540 (528 before; 12 new in `tests/frame-cost.test.mjs`) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Shadow updates, WebGL | `npm run verify:shadow-updates` | PASS | `EV/shadow-updates-webgl/evidence/` |
| Shadow updates, WebGPU | `SHADOW_UPDATES_RENDERER=webgpu npm run verify:shadow-updates` | PASS | `EV/shadow-updates-webgpu/evidence/` |
| Render scale, WebGL | `npm run verify:render-scale` | PASS | `EV/render-scale-webgl/evidence/` |
| Render scale, WebGPU | `RENDER_SCALE_RENDERER=webgpu npm run verify:render-scale` | PASS | `EV/render-scale-webgpu/evidence/` |
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
  material's: from the next frame that draws the maps it is wholly in shadow
  (tile sunlit share 1, 1, 0, 0, 0), for good.
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
LayaAir frame (`Stat.loopCount`), the same for every view drawn in it.

What `verify:shadow-updates` asserts, with the same numbers on both backends
(overlap: shared over joined shadow pixels, leaving out where the post
stands):

- `update: 'interval', interval: 3`, the post moving 0.3 m a frame: 3 of 9
  frames draw the maps. On those the shadow matches the every-frame
  reference at that place (overlap 1.000); on the two between it matches the
  shadow of the frame that drew (1.000) and not the post's place now
  (0.517, 0.263; 0.528, 0.246; 0.530, 0.249). The post moves on every frame
  (its centre 157.2, 169.5, 181.8 ... 256.4 px): the frames are drawn. The
  shadow covers 538 to 1554 pixels on every frame (the reference 538 to
  1101; more on kept frames because the post no longer hides part of it).
- A floor tile whose material is first drawn on a frame that keeps the maps:
  sunlit share 1.000 on all five frames after, through a frame that draws.
- `'manual'`: the shadow stays where it was drawn on all nine frames
  (overlap 1.000) while the post walks out of it (0.044, then 0); after
  `redrawShadows()` it is the post's (1.000); a sun turned by 40 degrees in
  place draws it again by itself (0.103 like before).
- Back to `'every'`: the look is rebuilt, the rule is gone, the scene's
  frequency is 1 and the shadow is the reference (1.000). Disposal leaves no
  accessor on the scene.
- No page, console, renderer or GPU errors; an interval of 1 is refused.

Pictures: `every.png` (every frame), `interval.png` (every third frame: the
shadow lags in steps), `manual.png` (kept, kept, kept, asked, sun moved),
`tile.png` against `native-tile.png` (the tile in shadow under LayaAir's
own skipping), `native-interval.png` (WebGPU: the post stands still and the
frames darken). Looked at for this record.

Desktop time a frame, the GPU made to finish by a read each frame, 30
frames: 2.3 to 3.5 ms for every frame, every third and on request in the
small scene; with four splits of 4096 over 400 casters 8.27 against 6.67 ms
(WebGL) and 6.08 against 6.08 ms (WebGPU). These say nothing about a phone
and not much about this desktop: the read-back dominates.

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

| At 0.67 (402 by 241) | sharpness | difference |
| --- | --- | --- |
| full size (reference) | 17.21 | 0 |
| LayaAir's plain stretch | 12.02 | 2.70 |
| bilinear + RCAS | 13.68 | 2.82 |
| EASU alone (sharpness 0) | 14.00 | 1.98 |
| FSR (EASU + RCAS 0.8) | 15.90 | 2.50 |

- FSR is 32 % sharper than the plain stretch and nearer the full-size
  picture; RCAS on a filtered upscale is 14 % sharper and 4 % further. EASU
  alone is the nearest; the sharpening moves it 0.5 further and makes it
  14 % sharper. Neither is sharper than full size.
- At 1, 0.9, 0.85, 0.75, 0.67, 0.6 and 0.5, with each of the three
  upscales: no pixel of the stage's magenta background shows, the outermost
  row and columns are the scene's colour (within 12 of full size), the
  picture is the scene (difference at most 4.15, plain at 0.5; FSR 3.10).
  The output fills the canvas on both backends: the plan's open question is
  answered.
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

Pictures: `scale-reference.png`, `scale-plain.png`, `scale-bilinear.png`,
`scale-easu.png`, `scale-fsr.png` (all 0.67), `scale-half.png` (FSR at 0.5),
`scale-rich.png` (the whole chain at 0.67), and `detail-*.png`: the finest
stripes and slanted bars three times enlarged. Looked at for this record:
the plain stretch is soft; RCAS on the filtered upscale sharpens but shows
the steps of slanted bars more; FSR keeps the bars smooth and the stripes
crisp. The 3 cm stripes alias at 0.67 with every upscale (finer than the
smaller picture can hold).

Desktop time a frame, the GPU made to finish by a read, 20 frames: WebGL
6.77 ms at full size, 5.75 plain, 5.63 bilinear, 5.75 FSR at 0.67; WebGPU
4.38, 3.78, 4.11, 4.29. Not phone evidence.

## Unit tests (`tests/frame-cost.test.mjs`)

Options and their refusals for both levers; which frames draw (every,
interval 2 and 3, requests that restart the count, manual); one answer a
frame for every view, a view with shadows off neither drawing nor counting,
a request within a frame (a capture's next sample); the repair adding the
shadow uniforms only on a kept frame with shadows on and maps in use; one
rule a scene; the look field validated and resolved, `every` against the
others rebuilding, in place otherwise; the rule set and the maps redrawn on
a moved sun or changed settings; the FSR passes, their places and the
WebGPU turn, target reuse and release, LayaAir's stretch at `'plain'`, at 1
and with its own FXAA; the ladder and its refusals; a governor stepping
down the ladder through the scales before any effect goes and back up.

## Limits and decision

- No phone. The 3.5 to 6.7 ms of shadows and the 40 to 64 ms frames of look
  level 2 on the vivo V40 are not measured again; whether interval shadows
  or 0.67 with FSR save what they should there is the next step, in
  `films/river-town-prefab`.
- The ladder's rungs are a proposal until then.
- Not drawn: a second camera drawing the sun's shadows in the same scene
  with a rule (a mirror with shadows of its own would read maps fitted to
  the other camera on kept frames); the spot light's shadow under a rule
  (LayaAir skips it with the sun's; only the sun was drawn); a canvas
  resized while scaled (the target follows the viewport; not drawn); DPR
  above 1.
- `'manual'` does not follow the camera: a camera that moves far needs
  `redrawShadows()` or `'interval'`.
- Stills and videos of a film always draw the maps; a film preview in the
  editor follows the rule.
- Art approval: the pictures are for the owner.

Decision: **Implemented within scope**: both levers drawn and checked on
desktop WebGL and WebGPU. Not Accepted: the phone measurement it is for is
missing.
