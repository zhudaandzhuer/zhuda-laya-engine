# Verification record: stylized-shading

Task document: `docs/plans/records/stylized-shading/task.md`\
Commit: the commit that adds this file, on top of `a4ea9b3`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Adreno 720, Chrome, WebGL 2, driven through its Chrome debugging port.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `a4ea9b3`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300 for the pictures, 1280
  by 720 (desktop) and 823 by 1749 (phone) for the timings; loopback (the
  phone through `adb reverse`).
- Evidence (outside the repository): `batch2-evidence/stylized-shading/` in
  the session's notes folder: the three reports, their pictures and the logs.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 665 of 665 (9 in `tests/stylized-shading.test.mjs`) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| Stylized shading, WebGL | `npm run verify:stylized-shading` | PASS |
| Stylized shading, WebGPU | `STYLE_RENDERER=webgpu npm run verify:stylized-shading` | PASS |
| Stylized shading, phone | the check's page and its timing page served to the phone | drawn and measured (below); no assertion script on the phone |
| Draws through the filmic chain's finishing effects and the lit template, WebGL | film-look, film-finishes, live-look, camera-effects, cinematic, render-scale, grass, physical-surfaces, specular-aa, webgpu, film-clouds, film-colours, film-decals, film-point-shadow, shadow-updates, shader-warm-up, film-scene, film-highlights | PASS, 18 of 18 |
| On WebGPU | live-look, camera-effects, cinematic, render-scale, grass, physical-surfaces, specular-aa, shadow-updates, shader-warm-up, film-scene with the WebGPU switches; `verify:film-webgpu` (20 film checks, film-look and film-finishes among them) | PASS, 10 of 10 and 20 of 20 |

## What is drawn

Nothing is checked in. The check builds a ball, a floor with a block, three
lights, a skinned capsule (`tests/helpers/toon-fixture.mjs`, bent by one
bone) and a matcap picture of four coloured quarters. Flat (orthographic)
views put a scene unit on a known number of pixels, so each expected colour
is worked out in the page from the numbers the scene was built with: the
sun's direction as LayaAir reports it, `zhudaToonBand`, the engine's colour
conversion and the 2.2 curve of the output.

## Results

The same numbers on desktop WebGL, desktop WebGPU and the phone unless
given.

- **Bands.** 2,709 sampled pixels of a white ball under one sun, three
  bands with hard edges: every one within 0.9 of 255 of the band its N·L
  falls in (pixels within 0.035 of an edge are not asked to land on one
  side), and three flat levels with nothing between. Five bands from
  `zhudaToonRamp(5)`: 0.9 (1.0 on the phone), five levels. A soft ramp
  (`softness` 0.2), every pixel: within 5.4, 0.8 on average.
- **Highlight and rim**, placed by the same arithmetic (the view direction
  of each pixel, the cosine of the highlight's size, the rim's width):
  within 0.9 (1.6 on the phone). Switched off again the ball is as before.
- **Ambient light**, flat: 54 on the top, the bottom and the middle of the
  ball for an ambient colour of 0.2; 74 at strength 2.
- **A cast shadow is the darkest band with a hard edge.** On a toon floor
  the block's shadow reads 89 (expected 89.5; 90 on the phone) and the lit
  floor 142 (141.8); along a line from inside the shadow out past its tip
  no pixel lies between the two, where the same floor drawn physically
  based has 10 (6 on the phone).
- **A lamp and a spot.** Under a red point light the floor reads 154
  (expected 153.6, from the top band and LayaAir's falloff); where its light
  grazes the floor at N·L 0.275, under the first edge, 43.2 (43.8); out of
  its reach 0. Under a blue spot 139 (138.6); outside its cone 0. With the
  sun as well each adds to the sun's band.
- **Outline.** Round a ball the ring of pixels just outside it is the line's
  colour (within 0.7 of 255; 1.2 on the phone) and the ring past the line is
  the background, with a width in pixels, a width in scene units and
  through a lens; three balls of one mesh and one material (an instanced
  batch) each have theirs; a width of 0 draws none; the ball inside keeps
  its bands.
- **A skinned limb.** Bent by its bone the upper half is drawn where the
  bone took it and no longer where it stood; the line is 3 pixels on each
  side of it there and absent where the limb is not.
- **Matcap**: the four quarters of the picture are on the four quarters of
  the ball, exactly, flat and off-centre through a lens. **Normal view**:
  four points within 1 of `(n * 0.5 + 0.5) * 255`.
- **Selection outline.** Round a prop half behind a wall, flat and through
  a lens: `[255, 182, 31]` where it is seen and `[54, 152, 255]` where it
  is behind the wall, both the colours asked for; 3 and 5 pixels wide when
  asked for 3 and 5; a half fill and a half strength are the mixes worked
  out from the picture without the effect (within 1); nothing changes away
  from the line; with nothing selected the picture is the one without the
  effect, bit for bit; a prop moved, moved back and deselected between two
  frames is drawn where it is; the bent limb's mask is bent with it; without
  occlusion one colour all round and no depth texture.
- **Refused**: a ramp out of order, a second meaning for a shader name, a
  width of 20, a uniform name the material owns.
- **Left behind**: nothing (resources counted before and after, the pool
  of render targets aside).

### Timings

Median of 60 frames, each drawn to the end, 36 balls and a floor under a
shadowed sun. Desktop numbers are at the limit of what the timer tells
apart and are not a result.

| Drawn as | Phone, 823 by 1749 (two runs) | Desktop WebGL, 1280 by 720 |
| --- | --- | --- |
| physically based | 17.4, 17.5 ms | 1.9 to 3.2 ms |
| toon | 15.4, 18.2 | 1.9 to 3.3 |
| toon with an outline | 17.2, 19.8 | 1.7 to 4.2 |
| graded chain, no selection | 21.0, 22.0 | 2.8 to 3.0 |
| selection outline, nothing selected | 21.5, 21.8 | 2.9 to 4.1 |
| six balls selected | 25.1, 25.0 | 3.3 to 4.0 |
| six selected, no occlusion | 24.3, 24.6 | 3.4 to 4.3 |

## Found on the way

- **The outline's programs must not use LayaAir's depth include.** Its
  projection is only declared while a depth or shadow pass is drawn. The
  first outline compiled on a scene with shadows and failed silently on one
  without: the pass was skipped and no error reached the console. The check
  now collects shader compile messages and draws the outline both ways.
- **Finishing effects ran before the grade.** LayaAir 3.4.2 keeps its
  colour grade last and puts an effect added afterwards before it, so
  `ZhudaFilmicPipeline`'s `finishEffects` (edge smoothing, the lens finish)
  worked on the scene's unbounded light, against what their documents say.
  The selection colours came out tone-mapped; that is how it was seen. They
  are added after the grade now. The unit test's stand-in chain ordered
  effects by arrival, which is why it had passed: it now orders them as
  LayaAir does. With the order right, `verify:film-look` failed once
  ("grain keeps the mean"): the end of the chain holds linear colours, and
  grain added there lifted the dark tones. The lens finish now works in the
  screen's colours and hands the picture back linear.
- **A command that draws a renderer stamps it as moved "now".** A move made
  before the next frame begins carries the same stamp and is taken for one
  already seen: on WebGPU a prop moved back and deselected between two
  frames stayed where it had been. The effect puts each stamp back after
  its draws.
- **A phone reads the depth texture at low precision.** LayaAir asks for
  high precision in numbers but not in texture reads. Through a lens, depth
  near 1 lost the digits that tell a prop from the wall before it: on the
  Adreno 720 every seen pixel came out hidden. The mask's shader now reads
  depth at high precision. The engine's other effects that read depth (fog,
  depth of field, reflections, point shadows, probes, water) still read it
  at the default: smooth effects hide it, and it is not changed here.

## Deviations and unverified limits

- One desktop GPU and one phone; no iPhone, no WebGPU on a phone.
- The check's meshes are balls, boxes and one capsule: no authored
  character, no hard-edged mesh in an outline (documented as a limit), no
  cut-out or two-sided toon surface, no vertex hook on a drawn toon surface
  (the outline program with a hook is checked as text only).
- The toon material under lightmaps, probe volumes, a reflection probe or
  LayaAir's deferred path was not drawn; its ambient term uses LayaAir's
  own irradiance function and should follow them.
- The selection outline was drawn in `finishEffects` only: not in
  `sceneEffects`, not on a camera without the filmic chain, not with
  temporal anti-aliasing or a render scale below 1.
- Films and games that used grain or edge smoothing look a little
  different from before: both now work on the graded picture. No film was
  rendered again to compare.
- The timing scene is 37 meshes; a crowd, or a selection of hundreds, was
  not timed.
