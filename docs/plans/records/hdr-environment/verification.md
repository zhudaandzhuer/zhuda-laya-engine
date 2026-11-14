# Verification record: hdr-environment

Task document: `docs/plans/records/hdr-environment/task.md`\
Commit: the commit that adds this file, on top of `e266787`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Adreno 720, Chrome 156, WebGL 2, driven through its Chrome debugging port.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `e266787`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300; loopback (the phone
  through `adb reverse`).
- Evidence (outside the repository): `batch2-evidence/hdr-environment/` in
  the session's notes folder: the three reports and their pictures.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 656 of 656 (10 in `tests/hdr-environment.test.mjs`) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| HDR environment, WebGL | `npm run verify:hdr-environment` | PASS |
| HDR environment, WebGPU | `HDR_ENV_RENDERER=webgpu npm run verify:hdr-environment` | PASS |
| HDR environment, phone | the check's page served to the phone | drawn and measured (below); no assertion script on the phone |
| Draws that use an environment, a probe volume or a model's textures, WebGL | film-environment, film-bounce, film-reflections, film-look, live-look, film-finishes, film-highlights, physical-surfaces, basis-textures, shader-warm-up, gltf-intake | PASS, 11 of 11 |
| The same on WebGPU, and `verify:film-webgpu` | as above with the WebGPU switches | PASS, 12 of 12 |

## The panorama

None is checked in. `tests/helpers/hdr-fixture.mjs` makes one and writes it
as a Radiance file (flat RGBE; the engine's own decoder reads it back within
RGBE's rounding): a sky that is lighter toward the top, a dark ground, a sun
five degrees across at 400 times white, and a patch 28 degrees across toward
each axis, each of its own colour. A second one has no patches and no sun,
for checks of light alone.

## Results

The same numbers on desktop WebGL, desktop WebGPU and the phone, to the
last digit unless given.

- **The sky is the panorama, the right way round and as bright as its
  numbers.** Looking from the middle toward each axis, the middle of the
  frame is that axis's patch: for example toward -Z `[228, 88, 88]` where
  the file's colour shows as `[230, 90, 90]`; every patch within 3 of 255.
- **The light is the same surroundings.** A mirror ball seen toward an axis
  shows in its middle the patch that stands behind the eye, within 2 of 255
  of that patch's colour (toward -Z the +Z patch, `[89, 122, 243]`).
- **Turned a quarter to the right**, the sky toward each axis is the patch
  that stood to its left, and the mirror shows the patch behind the eye of
  the turned surroundings: sky and light turn together, by the same amount
  and the same way. Nothing is filtered again.
- **A matte ball** is lighter and bluer above (`[129, 141, 166]`) than below
  (`[85, 94, 106]`).
- **Formats.** All three devices filter 32-bit floats, so `float` is the
  choice; forced, `half` differs from it by 0.001 of 255 on average (worst
  2) and `rgbd` by 0.14 (worst 102, in the sun's highlight) over the frame
  with the three balls.
- **Exposure and intensity.** Twice the exposure is 1.98 times the light on
  a matte ball; half the ambient intensity leaves 1/1.91 of it (the ball's
  faint reflection stays).
- **A soft sky** (`skyBlur` 0.8): the patch ahead has no hard edge left (776
  to 783 hard steps along the rows of the sharp frame, none in the soft
  one) and its middle is mixed with the sky round it.
- **The studio room**: the camera keeps its own background (black); where
  the mirror ball leans upward it shows the lamp overhead (`[255, 255,
  255]`) and where it leans downward the floor (`[101, 101, 104]`); a matte
  ball of 80 % white is `[206, 205, 208]`, short of clipping.
- **Given back**: the scene's ambient mode, light, rotation, sky and the
  camera's clear flag are as before, and no resource is left.
- **Refused**: a panorama and a cube picture together; a sky asked of a
  cube picture; `skyBlur` 2; `reflection` 9; something that is not a scene.
- **Time to make the light** (64, 64 samples, from a 1024 by 512 panorama):
  about 100 ms on the desktop (98 to 140), 285 ms on the phone.
- No page, console, renderer or GPU error or warning in the desktop runs;
  no page error on the phone.

## Found while drawing

- **LayaAir's panoramic sky is turned by half a turn against the light and
  turns the other way.** With the panorama's middle toward -Z in the light
  (as `zhudaEquirectUv` has it), the sky showed it toward +Z, and a larger
  `rotation` moved the sky left while a larger `GIRotate` moves the light
  right. The sky is set to `270 - degrees`; the check holds both to the
  patches.
- **Its brightness**: the material multiplies the texture by its tint, read
  as a display colour, and by 2 to the power 2.2. A tint of a half is
  therefore a factor of exactly one; a tint of one drew the sky 4.6 times
  too bright, and a tint of 1/4.59 five times too dark.
- **A refused option left a texture behind**: the constructor found out
  that a cube picture has no sky after it had uploaded the light. Options
  are now all checked before anything is made (the check counts resources).
- **The engine's output without a grade is a power of 1/2.2**, not the
  piecewise sRGB curve: the exposure ratio read 1.88 through the one and
  1.98 through the other.

## Lifecycle and failure cases

Unit-tested without a runtime: a direction and its place in a panorama and
back; a constant panorama stays constant; a lamp is found where it stands
on every face and across edges; rotation to the right and by any number of
turns; exposure and the largest value kept; the mean light of a panorama
and of its cube agree within 1 %; invalid panoramas and sizes; the studio
room the same every time, brightest above, scaled by intensity; half floats
to the nearest across the range of a scene's light, with the special
values; RGBD back within a step; the formats a device filters, in order; a
panorama made smaller by whole steps; a soft sky from the prefiltered
levels keeps the lamp where it is and spreads it.

## Limits and decision

- One desktop GPU and one phone, both of which filter 32-bit floats: the
  16-bit and RGBD paths of the environment were drawn by forcing them, not
  on a device that needs them (an iPhone was not run). The probe volume's
  16-bit path was not drawn at all.
- A panorama made of a gradient, a sun and patches, 1024 wide. No
  photograph was used: how a real sky, its clipping and its sun behave at
  `maxRadiance` and in the RGBD format is not shown.
- The sky's stair-stepped patch edges in the pictures are the 1024-wide
  panorama enlarged.
- WebGPU on a phone, other browsers, mini-game hosts: not run.
- Not built: a prefilter on the graphics card, `.hdr` in film scenes, EXR,
  ground projection, shadows from the panorama's sun.

Decision: **Implemented within scope**. Not Accepted: no consumer uses it,
and no photograph has been drawn with it.
