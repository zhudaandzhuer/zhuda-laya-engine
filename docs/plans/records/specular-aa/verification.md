# Verification record: specular-aa

Task document: `docs/plans/records/specular-aa/task.md`\
Commit: the commit that reworks the patch after review, on top of `7eb53c2`\
Date: 2026-11-14

This record replaces the first one (commit `7eb53c2`), whose measures a
review found wanting; the task document lists the review's points.

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome
  157.0.8103.39 headless through the repository's `chromeFixture`. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`. WebGPU: the WebGPU build
  of the browser SDK, adapter `apple metal-3`, not a fallback adapter.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `7eb53c2`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 320; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/specular-aa-evidence/review-fix/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 541 of 541 (13 in `tests/specular-aa.test.mjs`) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Specular AA, WebGL | `npm run verify:specular-aa` | PASS | `EV/webgl.log`, `EV/webgl/evidence/report.json`, `specular-aa-webgl-*.png` |
| Specular AA, WebGPU | `SPECULAR_AA_RENDERER=webgpu npm run verify:specular-aa` | PASS | `EV/webgpu.log`, `EV/webgpu/evidence/report.json`, `specular-aa-webgpu-*.png` |
| Existing draws, now with it on, WebGL | `verify-grass`, `-live-look`, `-camera-effects`, `-film-finishes`, `-film-model`, `-film-shapes`, `-procedural-draw`, `-film-look`, `-film-highlights`, `-film-reflections`, `-film-point-shadow`, `-film-variation`, `-film-environment`, `-film-colours`, `-film-bounce`, `-film-decals` | PASS, 16 of 16 | `EV/regress/*.log`, `EV/regress/summary.txt` |
| Existing draws, WebGPU | `verify-grass`, `-live-look`, `-camera-effects` with their renderer switches; `verify-film-webgpu` (the 20 film verifications, finishes, model, shapes and point shadows among them) | PASS | `EV/regress/*-webgpu.log` |

The unit tests read the vendored `laya.d3.js` and `laya.gltf.js`: each anchor
is found exactly once (the `getPixelInfo` signature and the line that sets
the energy gain in `PBRFrag.glsl`; Laya's `specularAA` and the head of
`specularLobe` in `PBRLighting.glsl`; the normal-map read and store in the
`PBR`, `glTFPBR` and engine lit forward passes); every caller of the PBR
`getPixelInfo` passes a surface of its own (so `inout` compiles); the patched
texts keep directives at line starts, add no `#else`, and apart from `inout`
and one local everything new sits behind the define; a missing or doubled
anchor in either include leaves the text alone with the reason and the
define off; a forward pass that reads its normal map another way is left
alone, named in the status and warned of once; a material given a normal
map without mipmaps gets `ZHUDA_NORMAL_NOMIPMAP`, and loses it again; the
installer works in either include order; `setZhudaSpecularAA` refuses what
is not a scene and says when LayaAir is not loaded. Two checks of the
arithmetic: the normal-map term adds twice the variance of the normals, and
the Gaussian lobe sums to one over the hemisphere.

## What is drawn

A ball of 1 m at 6.5 m (68 pixels in radius), a normal map of 256 by 256
made in the fixture (bumps two to eight texels across), tiled 8 times round
and 4 from pole to pole: about four texels to a pixel at the middle of the
ball (the first record said seven; a pixel there is 0.0125 m of the ball,
the map 326 texels to a metre), and about twice as many across the way it is
squeezed at 0.85 of the disc. Also tiled 16, 4 and 2 times: eight, two and
one texel to a pixel. With mipmaps (the GPU's own, trilinear, 8×
anisotropic) and without (as `createSurfaceTexture` makes a map unless
asked; LayaAir then filters it anisotropically at level 4). Roughness 0.2;
metal (no diffuse light) and painted (a dark grey dielectric). Smooth metal
balls of roughness 0.05 to 0.4 at 68 pixels in radius and 0.1 to 0.4 at 17.

The scene has **no ambient light**: every number is the sun's light alone.
The camera is moved through 16 sub-pixel offsets (Halton 2, 3).

**The truth** is the same ball, patch off, drawn with 256 samples spread
over the pixel (1024 for the narrowest highlights) and averaged in linear
light, at each of eight camera offsets for the bumpy balls, so the truth's
own change from frame to frame is known. Its map has no mipmaps and no
anisotropic filtering. It is read in 8 bits under the measuring sun: what
would show under about 5 of 255 under the game's sun is missing from it
(its smooth balls look tighter in the pictures than they are); no sample
clipped.

Two suns. The **measuring** sun is set for each finish so that nothing
clips (0.02 for metal, 0.4 for paint) and light is compared in linear terms.
The **game's** sun (0.6 and 2.4) clips the sparkles: these are the frames as
a player sees them, in shown values 0..255. **Flicker** is the mean absolute
change of a pixel from one jittered frame to the next. **Pops** are pixels
whose shown value jumps by more than 48 of 255. Bumpy balls are measured
inside 0.85 of the disc (10 636 pixels), where what changes is the shading
(nearer the edge the silhouette itself steps on any ball lit to its edge),
and separately on the rim (4 940 pixels) and the whole ball. **Against the
truth**, under the game's sun: the mean absolute difference of a pixel, and
of a block of four by four pixels (920 blocks), in shown values.

## Results

Off → on, WebGL / WebGPU, with the truth's own number where it has one. The
`glTFPBR` shader and the lit material are within 3 % of `PBR` (same code).

### A bumpy ball with mipmaps, four and eight texels to a pixel

Inside 0.85 of the disc:

| Case | Flicker in light (thousandths of white) | Flicker as shown, game's sun | Pops a frame, game's sun | Clipped pixels |
| --- | --- | --- | --- | --- |
| Metal, 4 texels | 3.41 → 0.58 (−83 %) / 3.30 → 0.52; truth 1.53 | 13.5 → 10.6 (−21 %) / 12.8 → 9.5 (−26 %); truth 27.9 | 733 → 21 / 696 → 9; truth 2325 | 97 → 0.1 / 94 → 0 |
| Metal, 8 texels | 3.42 → 0.39 (−89 %) / 3.32 → 0.35; truth 1.33 | 11.0 → 7.0 (−37 %) / 10.2 → 6.1 (−40 %); truth 25.0 | 600 → 3 / 557 → 3; truth 1751 | 104 → 0.1 / 103 → 0.1 |
| Paint, 4 texels | 6.94 → 4.08 (−41 %) / 6.48 → 3.68; truth 4.35 | 11.1 → 9.5 (−15 %) / 10.0 → 8.4 (−16 %); truth 9.6 | 325 → 160 / 252 → 91; truth 29 | 37 → 0, both |
| Paint, 8 texels | 5.75 → 2.71 (−53 %) / 5.36 → 2.37; truth 2.92 | 7.6 → 5.9 (−23 %) / 6.8 → 5.1 (−25 %); truth 6.3 | 175 → 14 / 159 → 3; truth 0.1 | 41 → 0 / 40 → 0 |

The truth of the bumpy metal is not steady: it glitters (27.9 of 255 a
frame). Unpatched changes less than the truth only because its sparkles
clip; patched changes less than either.

Against the truth, over the whole ball, rim included:

| Case | The sun's light, as a share of the truth's | A block of 16 pixels (of 255) | A pixel (of 255) | Rim, mean shown (truth) |
| --- | --- | --- | --- | --- |
| Metal, 4 texels | 1.16 → 1.04 / 1.14 → 1.04 | 25.5 → 15.8 / 26.2 → 15.9 | 23.9 → 29.3 / 23.9 → 29.7 | 5.1 → 26.8 / 27.2 (6.2) |
| Metal, 8 texels | 1.23 → 1.04 / 1.22 → 1.05 | 31.7 → 13.2 / 32.2 → 13.2 | 28.7 → 24.3 / 28.7 → 24.5 | 5.0 → 27.2 / 27.5 (8.2) |
| Paint, 4 texels | 1.10 → 1.09 / 1.10 → 1.10 | 5.2 → 5.8 / 5.4 → 6.1 | 8.2 → 8.6 / 8.1 → 8.5 | 60.3 → 61.2 (65.9) |
| Paint, 8 texels | 1.13 → 1.12, both | 6.4 → 7.2 / 6.5 → 7.3 | 7.9 → 8.5, both | 61.2 → 62.1 (66.3) |

So: metal's light is 4 % over the truth's where unpatched is 16 % and 23 %
over, and a block of pixels is nearer the truth. Pixel for pixel the patch
is **not** nearer the truth at four texels (it is at eight): a sheen stands
where the truth glitters. Paint is not nearer the truth by either measure
(under one level further). The **rim of the bumpy metal ball is brighter
than the truth's** (27 of 255 against 6 and 8): the ball is lit to its edge
like a rough metal.

### Left as they were

- **A map without mipmaps** (four and eight texels, both finishes, three
  shaders): the picture changes by at most 0.08 of 255 on average; shown
  flicker 17.18 → 17.14, pops 902 → 900 (metal, 4 texels), light 1.105 →
  1.106. Its sparkle is as it was: 902 pops a frame.
- **One texel to a pixel**, inside 0.85 of the disc: metal's shown flicker
  11.90 → 11.88, pops 635 → 634; paint 12.41 → 12.42. On the rim, where the
  map is squeezed and its part fades in, the metal's mean shown value goes
  6.6 → 15.6 (truth 3.2).
- **Close up** (a texel about 12 pixels, game's sun): mean change 0.001 of
  255, at most 1.9 (metal) and 0.9 (paint), no pixel changed by more than 8.
- **A map at no strength** and **a map on a mesh without tangents**: the
  picture is that of the ball without the map, to the last bit (difference
  0 of 255 at most).
- **A flat ambient light alone** (0.06, no sun): the metal ball's mean
  3.962 → 3.962 (WebGPU 3.960 → 3.960).

### Smooth balls

Metal, no normal map, off → on with the truth; identical on both backends to
the digits shown. Peak and light are measured under a sun that clips nothing
and averaged over the 16 offsets; size is the pixels over half the peak
under the game's sun.

| Roughness, radius | Peak (truth) | Light summed, lowest to highest over the offsets (truth) | Size (truth) | Rim, brightest of 255 | Most a pixel changes |
| --- | --- | --- | --- | --- | --- |
| 0.05, 68 px | 0.067 → 0.036 (0.048) | 0.014..0.565 → 0.079..0.084 (0.091) | 11.3 → 12.6 (12) | 0 → 0 | 34 |
| 0.1, 68 px | 0.495 → 0.332 (0.312) | 1.18..1.48 → 1.29..1.32 (1.31) | 44.1 → 42.1 (46) | 8 → 0 | 8 |
| 0.2, 68 px | 0.787 → 0.744 (0.735) | 21.07..21.11 → 21.06..21.10 (21.08) | 157.8 → 157.0 (157) | 18 → 11 | 10 |
| 0.4, 68 px | 0.838 → 0.837 (0.834) | 365.4..365.6 → 365.3..365.6 (365.5) | 337.8 → 338.6 (335) | 36 → 33 | 7 |
| 0.1, 17 px | 0.097 → 0.058 (0.075) | 0.026..0.738 → 0.142..0.148 (0.150) | 2.4 → 7.0 (4) | 6 → 0 | 166 |
| 0.2, 17 px | 0.462 → 0.294 (0.281) | 1.06..1.37 → 1.17..1.18 (1.18) | 8.5 → 10.8 (12) | 14 → 8 | 44 |
| 0.4, 17 px | 0.801 → 0.748 (0.744) | 20.36..20.42 → 20.33..20.39 (20.40) | 18.6 → 19.3 (18) | 33 → 28 | 6 |

A highlight several pixels wide (roughness 0.2 at 68 pixels and 0.4 at
either size) looks as it did: at most 10 levels change in a pixel, 0.04 to
0.32 on average. The peak is nearer the truth's in every row. A highlight
narrower than a pixel is changed: unpatched, the light of the polished
small ball goes from 0.026 to 0.738 as the camera moves by less than a
pixel (the highlight is caught or missed); patched it stays at 0.142 to
0.148, where the truth has 0.150. Under the game's sun that ball's clipped
highlight is 7 pixels where the truth has 4. No line appears along a rim;
the faint glow there is a little dimmer than unpatched (18 → 11 at
roughness 0.2).

Also: an alpha-tested ball is drawn on both backends (WebGPU compiled it);
`setZhudaSpecularAA(scene, false)` and back takes the define off and puts it
on; a non-scene is refused; at boot two forward passes carry the normal-map
term (`PBR`, `glTFPBR`), three once the lit material is made, none skipped;
the PBR, glTF and lit materials carry `ZHUDA_NORMAL_NOMIPMAP` with the
unmipmapped map and not with the mipmapped one. No page, console, WebGL or
renderer error on either backend.

Pictures (`EV/<backend>/evidence/`), each read before this was written:
`specular-aa-<backend>-4tx-pbr-metal-mipmapped.png` and `-8tx-…` show the
truth (a broad highlight of fine glitter, fading to the rim), unpatched (a
cluster of white sparkles on a dark ball) and patched (a grey sheen with the
relief of the bumps, lit to the rim, its dark side's edge stepped), and each
one's change to the next frame; `-4tx-pbr-painted-mipmapped.png` (patched
looks like the truth: no white dots); `-2tx-…` the fade (below);
`-…-unfiltered.png` the maps left alone; `-smooth-large.png` and
`-smooth-small.png` the smooth balls with their truth and the change times
four; `-close-*.png`.

## Limits and what is not verified

- **Between two and four texels to a pixel the picture looks different, not
  better.** At two texels (at the middle of the ball, up to four at 0.85 of
  the disc), bumpy metal, game's sun: shown flicker 14.3 → 22.6 (+58 %; the
  truth 26.2), pops 785 → 1255 (truth 2160), mean shown 18 → 40 (truth 32);
  a block of pixels against the truth 21.1 → 21.6, a pixel 18.0 → 27.2. In
  light, flicker falls 3.42 → 2.82. The middle of the ball is still
  sparkles on dark and the outside already a grey sheen, and where one
  becomes the other can be seen (`-2tx-pbr-metal-mipmapped.png`). The
  unpatched ball changes less than the truth because it clips its light
  away; the patched one shows the light and its movement. Paint: 13.8 →
  14.5 (+5 %). Asserted as a bound, not fixed: every placement of the fade
  that was drawn moved this somewhere.
- **The rim of a bumpy metal ball** is brighter than the truth's (above),
  and at one texel to a pixel the rim alone changes (6.6 → 15.6).
- **Pixel for pixel** the patched bumpy metal is further from the truth at
  four texels; paint by both measures, under one level.
- **A normal map without mipmaps still sparkles** exactly as it did.
  `createSurfaceTexture` makes none unless asked. A map set by a path that
  does not go through `Material.setTextureByIndex` (a `.lmat` file) is not
  noticed: where LayaAir filters it anisotropically its normals are
  widened. Drawn in an experiment, before the define on the material
  (`EV/experiments/x-ac`): shown flicker 17.2 → 21.4, pops 909 → 1143;
  `x-dbg` shows where on the ball.
- **Phones: not run.** That is where the sparkle matters most; mediump
  precision (Laya's larger minimum roughness, the derivatives of the
  texture coordinates, the Gaussian lobe's exponent) is not exercised on
  desktop.
- **Frame cost: not measured.** Per pixel of a PBR pass: two derivatives of
  the mesh normal; with a normal map (WebGL 2, WebGPU) one more read of it,
  two derivatives of its coordinates, a `textureSize`, two lengths; per
  light a cross product, a square root, an exponential and a second
  visibility term.
- One map, one ball, one roughness for the bumpy cases, one light
  direction. Not drawn: maps whose mipmaps were renormalised by a tool (KTX2
  and the like give the normal-map term nothing: such a map sparkles as it
  did), detail normal maps (the term is off for them), clear coat, sheen,
  iridescence and anisotropy (their lobes are not reshaped), a light from
  behind, point and spot lights, WebGL 1 (no `textureSize`: the normal-map
  term is compiled out), an environment map (a flat ambient colour only).
- The truth is 256 samples a pixel in 8 bits: its pictures still show noise,
  and its dimmest light is missing (above).
- Switching a scene off or on compiles its shaders again; the time is not
  measured. Whatever reads the roughness LayaAir writes to its G-buffer
  (`LAYA_MRT`) reads the widened value; not drawn.
- `createSurfaceTexture`'s comment says a map without mipmaps gets
  anisotropic level 1; LayaAir's default of 4 is what it has (measured in
  the fixture). Not changed here.
- Dither (`ZHUDA_DITHER`): not built. Proposed.
- Art approval: the pictures are for the owner to judge.

## Found while drawing

Kept in `EV/experiments/` (reports and pictures; the harness that drew them
in `harness/`). Numbers are bumpy metal, mipmapped, four texels, game's sun,
WebGL, at the state the patch was in when each was drawn; the first rows
are inside 0.85 of the disc.

- **The first version's normal-map term was a quarter of the spread.**
  Normals spread with variance v to each side shorten the mean normal by
  about v and widen a lobe to alpha² + 2 v; the first version added v / 2.
  Shown flicker and pops of the first version: 18.4 and 1005 (unpatched
  13.4 and 726). With the rest of this patch, at one, two and three times
  v: 14.2 and 384, 9.3 and 12, 6.6 and 13 (`x-c-k1.0`, `x-c-cap0.5`,
  `x-c-k3.0`). Twice is the arithmetic; it is not tuned.
- **The gain for multiple scattering followed the widened roughness** and
  made the ball 1.54 times the truth's light; kept at the material's, 1.11
  (`e2-k2v`, `x-ac`).
- **Laya's `specularAA` on the shading normal** turns a map without mipmaps
  into grain: shown flicker 17.2 → 32.4, against 21.4 on the mesh's normal
  at the same state, before such a map was told apart (`x-ac-shading`,
  `x-ac`).
- **The spread read at the shading's own mipmap level** leaves more
  sparkle than one level up: pops 94 against 12 (`x-ac`, `x-ac-coarse`).
- **A second read cannot tell a map without mipmaps**: LayaAir filters it
  anisotropically, so the two reads differ toward the rim (`x-dbg`, a
  diamond; `x-dbg2` with level 1). Hence the define on the material.
- **GGX's tail on the curvature term** drew a halo and a rim line on
  polished balls: the clipped highlight at roughness 0.05, 68 pixels, went
  11 → 45 pixels (truth 12), a pixel changed by up to 178 of 255 (`e4`);
  with the Gaussian fall-off 11 → 13 and 34 (`e4b`).
- **The same Gaussian for the map's spread** is nearer the truth and
  grainier (whole ball): shown flicker 9.6 → 14.1, pops 733 → 946, a pixel
  against the truth 23.9 → 21.2 (`dv-w1.0`); half and half 10.3 and 76
  (`dv-w0.5`); GGX 8.4 and 87 (`d2`). GGX is kept: the task is the sparkle.
- **The visibility term at the surface's angle** lit the rim to 0.65
  thousandths of white (truth 0.11) and the ball to 1.23 times the truth;
  at the bumps' angle 0.40 and 1.06 (`d2`, `dv-vmap`).
- **Cutting GGX's tail on the map's spread** darkens the rim to 14 and 18 of
  255 and brings back flicker: 13.8 and 12.6 inside the disc (`dv-taper8.0`,
  `dv-taper16.0`). Not kept.
- **Where the map's part fades in.** From one to two texels a pixel, a ball
  at one texel a pixel got worse (shown flicker 11.9 → 18.2, a block of
  pixels against the truth 14.8 → 22.7); from two to three, or two to four,
  a ball at two texels shows the rise recorded above (`dv-vmap`, `dv-vf49`,
  `dv-vf416`). Two to four is kept: nearer than that the bumps can be seen
  one by one.

Decision: **Implemented within scope**, not Accepted: phones and frame cost
are unmeasured, and the limits above stand.

## At the merge: off until a scene asks

The numbers above were measured with the define added to every new scene.
The merged code does not add it (the task document says why); the fixture
turns it on and off itself for every case, so the measurements are the same
ones. Checked again on the merged tree, on top of `ce8c810`:

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 628 of 628 (14 in `tests/specular-aa.test.mjs`: one new, for a plain install and a default asked for later) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| Specular anti-aliasing, WebGL | `npm run verify:specular-aa` | PASS; metal at four texels: shown 13.54 to 10.63, pops 732.6 to 21.4; a new scene has no define, `status.defaultOn` false |
| Specular anti-aliasing, WebGPU | `SPECULAR_AA_RENDERER=webgpu npm run verify:specular-aa` | PASS; metal at four texels: shown 12.77 to 9.50, pops 696.2 to 8.7 |
| Fifteen other draws with the patch installed and off | gltf-intake, physical-surfaces, shadow-updates, render-scale, live-look, camera-effects, film-water, film-reflector, film-point-shadow, film-model, prefab-models, film-finishes, film-highlights, grass, geometry; each on WebGL and on WebGPU | PASS, 30 of 30 |

Not checked: that a picture drawn with the patch installed and off equals,
pixel for pixel, the same picture without the patch installed. What the
patch adds is behind `#ifdef`; what is left outside it is `getPixelInfo`
taking its surface as `inout` and one unused local in the forward passes.
The fifteen draws above pass their own assertions with it installed.
