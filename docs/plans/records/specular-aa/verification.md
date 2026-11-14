# Verification record: specular-aa

Task document: `docs/plans/records/specular-aa/task.md`\
Commit: the commit that adds this file, on top of `9c91a26`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome
  157.0.8103.39 headless through the repository's `chromeFixture`. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`. WebGPU: the WebGPU build
  of the browser SDK, adapter `apple metal-3`, not a fallback adapter.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9c91a26`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 320; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/specular-aa-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 536 of 536 (8 new in `tests/specular-aa.test.mjs`) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Specular AA, WebGL | `npm run verify:specular-aa` | PASS | `EV/webgl/evidence/report.json`, `specular-aa-webgl-*.png` |
| Specular AA, WebGPU | `SPECULAR_AA_RENDERER=webgpu npm run verify:specular-aa` | PASS | `EV/webgpu/evidence/report.json`, `specular-aa-webgpu-*.png` |
| Existing draws, now with it on | `verify:grass`, `verify:live-look`, `verify:camera-effects`, `verify:film-finishes`, `verify:film-model`, `verify:film-shapes` on WebGL; `verify:grass`, `verify:live-look`, `verify:film-finishes`, `verify:film-model` on WebGPU | PASS | `EV/regress/*.log`, `EV/regress/summary.txt` |

The unit tests read the vendored `laya.d3.js` and `laya.gltf.js`: each anchor
is found exactly once (the `getPixelInfo` signature and the line after the
shading normal in `PBRFrag.glsl`, Laya's `specularAA` in `PBRLighting.glsl`,
the normal-map read and store in the `PBR`, `glTFPBR` and engine lit forward
passes); every caller of the PBR `getPixelInfo` passes a surface of its own
(so `inout` compiles); the patched text keeps directives at line starts, adds
no `#else`, and apart from `inout` everything new sits behind the define; a missing or
doubled anchor leaves the text alone with the reason; the installer works in
either include order, warns once, and refuses to switch on what is not in
place.

## What is drawn

A ball of 1 m at 6.5 m (68 pixels in radius), a normal map of 256 by 256
made in the fixture (bumps two to eight texels across), tiled 8 times round
and 4 from pole to pole: about seven texels to a pixel at the middle. Once
with mipmaps (the GPU's own, trilinear, 8× anisotropic) and once without.
Roughness 0.2; metal (no diffuse light) and painted (a dark grey
dielectric). The camera is moved through 16 sub-pixel offsets (Halton 2, 3);
everything is measured inside 0.85 of the disc (10 636 pixels).

The sun is set for each finish so that nothing clips (0.02 for metal, 0.4
for paint) and light is compared in linear terms. **Flicker** is the
asked-for measure, the mean absolute change of a pixel from one jittered
frame to the next, in thousandths of white. **Pops** are pixels whose shown
value jumps by more than 48 of 255 between frames; **sparkles** are pixels
at a fifth of white or more. A second sun as a game would set it (0.6 and
2.4), where sparkles clip, gives the shown numbers and the pictures.

## Results

Off → on, WebGL / WebGPU (`PBR`; `glTFPBR` and the lit material are within
about 2 % of these, as they share the code):

| Case | Flicker (light) | Pops a frame | Sparkles a frame | Mean light |
| --- | --- | --- | --- | --- |
| Metal, mipmapped | 3.38 → 1.38 (−59 %) / 3.27 → 1.28 (−61 %) | 126 → 0 / 122 → 0 | 25 → 0 / 26 → 0 | 6.01 → 6.03 / 5.96 → 6.03 |
| Paint, mipmapped | 6.89 → 4.74 (−31 %) / 6.43 → 4.30 (−33 %) | 84 → 0 / 83 → 0 | 30 → 0 / 30 → 0 | 25.75 → 25.74 / 25.84 → 25.88 |
| Metal, no mipmaps | 3.10 → 2.25 (−27 %), both | 119 → 0.2 / 118 → 0.2 | 23 → 0, both | 5.76 → 5.71, both |
| Paint, no mipmaps | 10.62 → 9.81 (−8 %), both | 89 → 14, both | 26 → 0, both | 23.41 → 23.30, both |

The same frames in shown values (0..255), mean change: metal mipmapped
2.12 → 2.22 (+5 %), paint mipmapped 4.94 → 4.50 (−9 %), metal without
mipmaps 2.15 → 3.53 (+64 %), paint without 9.58 → 10.14 (+6 %). Where it
rises, many small changes have taken the place of a few large ones.

Under the game's sun (shown values, WebGL / WebGPU):

- Metal, mipmapped: mean change 11.36 → 17.63 / 10.76 → 16.29; pops
  660 → 974 / 624 → 836; mean shown 24 → 68; clipped pixels 98 → 0.1. The
  sparkles hid most of their light in clipping; spread out it shows, and so
  does its movement.
- Paint, mipmapped: 10.95 → 10.44 / 9.89 → 9.32; pops 302 → 141 / 234 → 77.

Left as they were:

- Smooth balls: mean change 0.04 (metal) and 0.02 (paint) levels under the
  measuring sun, 0.33 and 0.04 under the game's; at most 6 levels; the
  highlight keeps its peak (255) and grows from 255 to 258 and from 321 to
  336 pixels.
- Close up (a texel about 12 pixels, game's sun): metal mean change 2.5
  levels, 8 % of a 200 by 200 window changed by more than 8 levels (the rims
  of the bumps' highlights are a little softer); paint 0.35 and 0.9 %.

Also: an alpha-tested ball is drawn on both backends (the discard comes
before the derivatives; WebGPU compiled it); `setZhudaSpecularAA(scene,
false)` and back takes the define off and puts it on; a non-scene is
refused; at boot two forward passes carry the normal-map term (`PBR`,
`glTFPBR`), three once the lit material is made. No page, console, WebGL or
renderer error on either backend.

Pictures (`EV/<backend>/evidence/`): `specular-aa-<backend>-pbr-metal-mipmapped.png`
and `-pbr-painted-mipmapped.png` show the game's sun, the measured frames
and the change to the next frame, off and on; `-smooth-*.png` and
`-close-*.png` the surfaces left alone; `-pbr-*-unfiltered.png` the case
without mipmaps.

## Found while drawing

- Measured first in shown values under a bright sun, Laya's `specularAA`
  alone nearly doubled the metal ball's flicker (18 → 33): the clipped
  sparkles had hidden their light. The measure moved to an unclipped sun in
  linear light; the game's sun is kept as a second, recorded number.
- Laya's `specularAA` alone, as WP2 was written (`EV/experiments/exp-Q-shade`):
  flicker −41 % metal and −21 % paint with mipmaps, −24 % and −6 % without;
  pops 126 → 7 and 84 → 2; under the game's sun the metal's shown change
  ×1.86 and its pops ×2.1, and the ball looked mottled. The normal-map term
  was added for this.
- The normal-map term without the fade drew the map's texel grid close up:
  mean change 16.1 levels and 48 % of the window (an intermediate run whose
  report was overwritten; the numbers are from its printout). With the fade
  where the map is magnified: 2.5 and 8 %, the same as Laya's term alone.
- With the cap on the normal-map term at 0.12 or 0.3 the results were the
  same: no pixel of this map asked for more. 0.12 stays as a guard.
- The fixture's first ball was wound the wrong way and showed its inside;
  LayaAir's front faces wind the other way from the first guess.

## Limits and what is not verified

- Phones: not run. That is where the sparkle matters most; mediump
  precision (Laya's larger minimum roughness, the derivatives of the
  texture coordinates) is not exercised on desktop.
- Frame cost: not measured. Per pixel of a PBR pass: four derivatives, a
  `textureSize`, a length, a square root and some arithmetic.
- Under a game's sun, a metal with a dense map shows more change from frame
  to frame with the patch than without, because light clipping used to hide
  now shows. Measured, not fixed. No supersampled reference was drawn to say
  which is nearer the truth.
- Without mipmaps the normal-map term has nothing to read: on metal, sparse
  white sparkles become denser, dimmer grain (shown change +64 %).
  `createSurfaceTexture` makes no mipmaps unless asked; changing that
  default is outside this task.
- One map, one ball, one roughness, one light direction. Not drawn: maps
  whose mipmaps were renormalised by a tool (KTX2 and the like give the
  normal-map term nothing), detail normal maps (the term is off for them),
  clear coat and sheen (not widened), WebGL 1 (no `textureSize`: the term is
  compiled out; Laya's function needs `OES_standard_derivatives`).
- Switching a scene off or on compiles its shaders again; the time is not
  measured.
- Whatever reads the roughness LayaAir writes to its G-buffer (`LAYA_MRT`)
  now reads the widened value; not drawn.
- Dither (`ZHUDA_DITHER`): not built. The engine's looks draw into an HDR
  target and grade it; a dither belongs in the grade's 8-bit output, not in
  the lit fragment. Proposed.
- Art approval: the pictures are for the owner to judge.

Decision: **Implemented within scope**, not Accepted: phones and frame cost
are unmeasured.
