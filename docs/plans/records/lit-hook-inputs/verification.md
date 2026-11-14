# Verification record: lit-hook-inputs

Task document: `docs/plans/records/lit-hook-inputs/task.md`\
Commit: the commit that adds this file, on top of `3926386`\
Date: 2026-11-15

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `3926386`; no consumer.
- DPR, viewport and network mode: DPR 1, 320 by 240, loopback.
- Evidence (outside the repository): `batch2-evidence/lit-hook-inputs/` in
  the session's notes folder: both reports and their pictures, and the
  sweep's logs.

## Checks

| Check                                     | Exact command or procedure                                                 | Result                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                           | PASS, 764 of 764 (11 in `tests/lit-surface.test.mjs`, five of them new) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`                 | PASS                                                                    |
| Lit surface, WebGL                        | `npm run verify:lit-surface`                                               | PASS                                                                    |
| Lit surface, WebGPU                       | `LIT_SURFACE_RENDERER=webgpu npm run verify:lit-surface`                   | PASS                                                                    |
| The older draws, WebGL                    | the 44 film, look, effect and model draws, and the thirteen on one backend | PASS, 57 of 57                                                          |
| The older draws, WebGPU                   | the same 44 with the WebGPU switch                                         | PASS, 44 of 44                                                          |

The 44 and the thirteen are those of `records/specular-aa/verification.md`
(the section of 2026-11-15): every draw that uses a lit surface, a dynamic
mesh, a shadow or the depth-normal pass is among them, the films included.
The sweep ran after the last change to the engine's code, against a browser
SDK built into a fresh folder (`--out`), which the three checks that read a
built SDK were pointed at (`SDK_BROWSER_DIR`, `WEBGPU_BROWSER_DIR`), and
with the mini-game check's folder set to a fresh one (`MINIGAME_OUT`).

## What is drawn

Eleven parts in one page, each in a scene of its own that is destroyed
before the next. The first four are the earlier ones (cut in strips, cut by
chance, a tilted normal, the dissolving plate of the guide); they pass
unchanged. The numbers below are the same on WebGL and on WebGPU to the
last digit shown. Colours are as light (a display value to the power 2.2).

### G1: alpha by how steeply a place is seen, blending, the highlight, the passes

- **A sheer ball** (`sheer.png`). A black yarn that takes no light, on a
  ball of one metre seen from forty metres through a four-degree lens,
  `blend: 'alpha'`, the hook's
  `s.alpha = 1.0 - exp(-0.35 / pow(max(0.23, dot(normalize(n), s.viewDirection)), 0.52))`,
  over a ground of 0.320. What is seen of the ground gives the alpha:

  | Share of the radius | Alpha measured | The line gives | Ground seen through |
  | ------------------- | -------------- | -------------- | ------------------- |
  | 0 (the middle)      | 0.303          | 0.295          | 0.697               |
  | 0.5                 | 0.315          | 0.314          | 0.685               |
  | 0.8                 | 0.376          | 0.366          | 0.624               |
  | 0.97 (the edge)     | 0.519          | 0.518          | 0.481               |

  The middle is clearer than the edge by 0.216 of alpha; the gate asks for
  0.02 of the line at each place and a rise from the middle outward.

- **`material.blend` with nothing set by hand** (`blends.png`). Three
  plates that only give off light (0.5, 0.1, 0.05) at a colour alpha of one
  half over a ground of 0.074: opaque 0.505, 0.099, 0.049; `'alpha'` 0.289,
  0.087, 0.062 (half the glow and half the ground: 0.287, 0.087, 0.062);
  `'additive'` 0.325, 0.125, 0.099 (half the glow on the ground: 0.324,
  0.124, 0.099). The blended and the added write no depth. The cut-out is
  the first part (a plate cut in strips, with its shadow and depth).

- **A normal the hook writes moves the highlight** (`highlight-flat.png`,
  `highlight-alongU.png`). A glossy plate under a sun the eye sees mirrored
  in its middle, at pixel 159.5, 138.0. With `s.normalTS = (0.12, 0, 1)`
  the highlight is at 114.0, 133.2 (45.5 pixels sideways); with
  `(0, 0.12, 1)` at 159.5, 80.6 (57.4 up the picture). A plate without
  tangents gives the same three places to a tenth of a pixel.

- **The shadow and the depth-normal pass read the same fields**
  (`passes.png`, `passes-unseen.png`). A plate facing up, cut where its
  vertices' alpha is under a half and where
  `dot(n, s.viewDirection)` is under a limit. The eye sees the plate at a
  cosine of 0.447, the sun overhead at 1. With a limit of 0.3: the half
  with the number is drawn and casts, the other half is not and casts
  none, and the camera's depth and depth-normal pictures hold the plate
  only on that half. With a limit of 0.7: the plate is not drawn and is in
  neither depth picture (too flat to the eye), and its shadow stays (the
  sun meets it squarely): in the pass that writes a shadow the view
  direction is toward the light.

### G2: sheets through each other, cut by chance

`cards-hash.png`, `cards-blend.png`. Two sheets of four metres by two,
tilted twenty degrees opposite ways about the line they share, each giving
off its own colour at alpha one half, seen from straight above.

| Cut by chance (`alphaHash`)  | Upper sheet seen on | Lower sheet seen on |
| ---------------------------- | ------------------- | ------------------- |
| The side where B is on top   | 0.429 of the pixels | 0.255               |
| The side where A is on top   | 0.485               | 0.255               |
| Expected (a half, a quarter) | 0.5                 | 0.25                |

Made A first or B first, the two pictures are the same picture (no pixel
differs). The same sheets with `blend: 'alpha'` come out 0.41, 0.16, 0.015
on both sides: right where A is on top (0.405, 0.16, 0.015) and wrong
where B is (0.21, 0.305, 0.015 would be right), whichever is made first:
LayaAir draws one whole sheet over the other.

### G3: a number a vertex, read in the hook, and a range changed

`vertex-value.png`. A `ZhudaDynamicMesh` of four vertices with `colors`
(sixteen numbers a vertex: the colour at 6, the texture coordinates at 10,
the tangent at 12), a display grey of 0.5 and an alpha of 0 on the left
edge and 1 on the right. The hook draws
`vec3(s.vertexColor.a, s.vertexColor.g, 1.0 - s.vertexColor.a)`.

| Place                                      | Red (the alpha) | Green (the grey as light) | Blue  |
| ------------------------------------------ | --------------- | ------------------------- | ----- |
| A quarter of the way in                    | 0.247           | 0.216 (0.5^2.2 = 0.218)   | 0.752 |
| Three quarters in                          | 0.752           | 0.216                     | 0.247 |
| After `setColor` on the two right vertices | unchanged       |                           |       |
| After `updateRange(1, 2)`: both places     | 0               | 0.216                     | 1     |
| A mesh without colours                     | 1               | 1                         | 0     |

### A5: sheen on a lit surface

`cloth.png`. A black ball of roughness one, lit from where the eye is. At
0.92 of the radius: 0.003 without sheen; 0.128 with
`sheen: { color: [1, 1, 1], roughness: 0.4 }`; 0.066 after
`setSheen({ color: [0.5, 0.5, 0.5] })`; 0.111, 0.002, 0.002 where the hook
writes `s.sheenColor = vec3(1.0, 0.0, 0.0)` over a material that said
white. The middle stays 0.003 in all of them.

## Lifecycle and failure cases

- Each of the eleven parts leaves nothing in `inspectSceneResources` once
  its scene is destroyed (the page's `left`, all zeros on both backends).
- No page error, console error, shader or GPU warning on either backend.
- Refused with a message (unit tests): a sheen that is not `true` or
  `{ color, roughness }`, a colour or roughness out of range, `sheen` with
  a `ZhudaLitShading`, a uniform named `u_ZhudaLitSheen`, one shader name
  with and without sheen, `setSheen` on a material without it or after
  `dispose`, `set` with the wrong number of values (the message names the
  uniform and what it wanted), `setColor` on a mesh without colours or on a
  vertex that is not there, colours that are not four a vertex or not
  finite.

## Prefab evidence (visual work)

Not applicable: engine fixtures only, no consumer prefab.

## Limits and decision

Not verified, not built:

- **No phone.** Nothing here was drawn on a device.
- A hook on a `physical` surface. Thin film, glass, coat and turned
  highlights have none; the lit surface has sheen.
- `sheen` together with a `ZhudaLitShading` (refused).
- The new fields on a skinned mesh, on instanced copies and in a film
  scene: the template is the one those draws use, and they pass as before,
  but none of them reads the new fields.
- The view direction in a spot light's shadow (read from that pass's view,
  as for the sun; only the sun was drawn).
- The shadow of a blended surface. The hook runs in the shadow and depth
  passes only for a cut-out (`'cutout'`, `alphaHash`): a surface with
  `blend: 'alpha'` or `'additive'` is not cut there, so its shadow does
  not thin with the hook's alpha. Read off the template, not drawn. A cloth
  whose shadow should thin is cut by chance.
- Gate G4 of the request (the consumer study redone without workarounds)
  is the consumer's and is not part of this record.

**Accepted within scope**: gates G1, G2 and G3 on desktop WebGL and
WebGPU. Not accepted for phones.
