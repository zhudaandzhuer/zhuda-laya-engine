# Verification record: character-surfaces (WP20)

Task document: `docs/plans/records/character-surfaces/task.md`\
Commits: `542e17b` (code, tests, the draw) and the commit that adds this file\
Date: 2026-11-15

## Environment

- macOS 27.0.1, Apple M4; Google Chrome 157 headless through the
  repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal Renderer:
Apple M4)`. WebGPU: adapter apple / metal-3. Node 26.12.0, npm 11.20.0.
- DPR 1, 320 by 240, loopback. No consumer. No phone.
- Evidence (outside the repository): `batch2-evidence/character-surfaces/`.

## Checks

| Check                                     | Exact command or procedure                                 | Result                                                |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                           | PASS, 795 of 795 (15 in `tests/lit-surface.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check` | PASS                                                  |
| Lit surface, WebGL                        | `npm run verify:lit-surface`                               | PASS                                                  |
| Lit surface, WebGPU                       | `LIT_SURFACE_RENDERER=webgpu npm run verify:lit-surface`   | PASS                                                  |
| The other draw checks, both backends      | each `scripts/verify-*.mjs` once, WebGL then WebGPU        | Not run at this commit                                |

## What is drawn

Three parts added to the lit surface's page (fourteen now), each in a scene
of its own that is destroyed before the next; the eleven earlier parts pass
unchanged. The numbers are the same on WebGL and on WebGPU to the last digit
shown. Colours are as light (a display value to the power 2.2).

### The frame: a disc under the surface

Two plates of two metres, one with tangents and one without, one metre up.
The hook draws a disc of 0.3 m as if it lay 0.4 m under the plate:
`below = uv - s.viewTS.xy / max(s.viewTS.z, 0.2) * depth * 0.5`. The middle
of what is bright against where a point that deep under the plate's middle
is on the screen, from the fixture's eye and from (4, 4, 3):

| Mesh          | Eye   | On top: found, wanted (px)      | 0.4 under: found, wanted (px)   |
| ------------- | ----- | ------------------------------- | ------------------------------- |
| With tangents | front | 98.57, 120.12 / 98.66, 120      | 100.02, 134.02 / 100.13, 133.86 |
| With tangents | side  | 116.66, 90.58 / 116.74, 90.33   | 118, 107.47 / 118, 107.2        |
| Without       | front | 221.43, 120.12 / 221.34, 120    | 219.98, 134.02 / 219.87, 133.86 |
| Without       | side  | 221.99, 163.09 / 221.79, 162.39 | 219.38, 183.88 / 219.25, 183.23 |

The worst is 0.73 of a pixel (the nearest plate, where the disc is 840
pixels and its middle is not quite its centre's picture). The depth moves
the disc 14 to 21 pixels, the right way along both axes: the frame's
directions and their signs are the texture's.

### Subsurface: round the edge of the light, and through

A white ball (0.8) of one metre seen from forty, no other light.

Lit from the right (`skin.png`), `wrap` 0.5, colour 1, 0.35, 0.25. At a
share of the radius from the middle (negative: past the edge of the light):

| Share | Plain ball          | With subsurface     | The formula         |
| ----- | ------------------- | ------------------- | ------------------- |
| -0.6  | 0, 0, 0             | 0, 0, 0             | 0, 0, 0             |
| -0.3  | 0, 0, 0             | 0.104, 0.037, 0.027 | 0.107, 0.037, 0.027 |
| 0.3   | 0.243, 0.243, 0.243 | 0.426, 0.311, 0.293 | 0.430, 0.308, 0.290 |
| 0.6   | 0.488, 0.488, 0.488 | 0.592, 0.523, 0.511 | 0.595, 0.525, 0.515 |

A hook that sets `s.subsurfaceColor` to green gives 0, 0.104, 0 at -0.3.

Lit from behind (`skin-thin.png`), `wrap` 0, `back` 0.5, `power` 6,
`distortion` 0.3, the hook's `s.thickness = step(0.0, p.x)`: the left half
is 0, 0, 0; the right half 0.482, 0.167, 0.119 at 0.3 and 0.437, 0.154,
0.109 at 0.6 (the formula: 0.479, 0.168, 0.120 and 0.433, 0.152, 0.108).
After `setSubsurface({ back: 0.25 })`: 0.239, 0.085, 0.06 and 0.216, 0.076,
0.055.

Every reading is within 0.004 of its formula.

### Strands: a band across them

A black plate of four by two metres under a sun straight overhead,
`strands: { along: 'u', strength: 0.5, color: [0, 0, 0], shift: [0, 0],
exponent: [2000, 24] }` (`strands.png`). Along the row through the plate's
middle:

- the band is at 0 m (the formula: 0), its light 0.5 (its strength);
- with `s.strandShift = 0.05` from the hook it is at 0.608 m toward where u
  grows (the formula: 0.604); with the hook's shift back at 0 and
  `setStrands({ shift: [0.05, 0] })` it is at 0.608 m again;
- the second band alone (`strength: 0`, `color: [0.5, 0.25, 0]`) is at 0 m
  and 0.5, 0.251, 0.005;
- the same plate with `along: 'v'` shows 0.005 at most on that row.

## Lifecycle and failure cases

- Every part leaves no resource behind (`left` is 0 for each of the
  fourteen).
- Unit tests: values out of range, a string for an option, a user's uniform
  with one of the material's names, a `ZhudaLitShading` with either lobe,
  the same name with another contract, a setter on a material made without
  the lobe, `along` in `setStrands`, a setter after `dispose` are each
  refused with a message that names the cause.
- Found while drawing: the first strand measurement put the band 0.25 m
  from the formula. The band (exponent 200) was wider than the plate and its
  bright part was cut by the plate's edge; the measurement was wrong, not
  the shader. The part now uses a narrow band in the plate's middle. No
  tolerance was changed.

## Prefab evidence (visual work)

Not applicable: no consumer prefab. The parts are engine fixtures.

## Limits and decision

- Desktop only; no phone run. No point or spot light and no shadowed light
  in the draw (see the task's unverified limits).
- Skin is a wrap and a glow through thin parts, not a blur. The eye is a
  recipe without refraction. Hair has no shadowing of its own. A soft fringe
  for hair cards is not built.
- Decision: accepted within this scope for the desktop backends.
