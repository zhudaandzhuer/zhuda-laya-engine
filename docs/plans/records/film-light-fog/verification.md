# Verification record: film-light-fog

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `3187eca`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check            | Exact command or procedure                                                               | Result                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fog formulas     | `node --test tests/light-fog.test.mjs`                                                   | PASS, 3 tests: optical depth within 1e-4 of a 20 000-step integral for four rays (level, up, down, nearly level); airlight within 0.2 % of a 200 000-step integral of 1/r² for four cases; a light on the ray stays finite; options validated and defaulted |
| Scene schema     | `node --test tests/film-scene.test.mjs`                                                  | PASS, 14 tests: `lightFog` needs `grade`, bad fields reported with paths, 96 fog-only plus 32 lit lights accepted, 129 lights and 33 lit lights refused, `fogOnly` refused on spot lights, patches merge                                                    |
| Real GPU fog     | `npm run verify:film-fog`                                                                | PASS (below)                                                                                                                                                                                                                                                |
| Film regressions | `npm run verify:film`, `verify:film-look`, `verify:film-model`, `verify:film-reflector`  | PASS                                                                                                                                                                                                                                                        |
| Full gate        | `npm run verify` (377 tests), `npm run lint`, `npm run format:check`, `git diff --check` | PASS                                                                                                                                                                                                                                                        |

### `verify:film-fog` (480×270, one warm fog-only light 14 m away, black scene)

Mean colour of a 5×5 patch at pixels from an independent pinhole projection.

| Case                                              | Measured                                |
| ------------------------------------------------- | --------------------------------------- |
| No `lightFog`                                     | black at the light's pixel (below 3)    |
| Fog, at the light's pixel                         | 240, 227, 204                           |
| Fog, 1.2 m beside the light                       | 98, 69, 39                              |
| Fog, 4.7 m from the light                         | 31, 19, 6                               |
| `scatter: 0.25`, 1.2 m beside                     | 33, 20, 7                               |
| Fog but no lights                                 | black                                   |
| Blue fog colour, wall at 8 m against wall at 76 m | 27, 42, 63 against 92, 120, 157         |
| A wall on the ray in front of the light           | 1, 1, 0                                 |
| Fog thinning over 1 m, light at 3 m, 1.2 m beside | 8, 3, 1                                 |
| After 30 mounts with and without fog              | both frames byte-identical to the first |

## Defects found and fixed

- The first shader did not compile (a `vec4` uniform added to a `vec3`); the
  frame was simply unchanged, with no error reaching the caller. The film
  host now exposes the page console (`consoleMessages()`), which is how the
  compile error was read. A fog whose shader fails to compile still fails
  silently at run time: that is Laya's fallback and is not changed here.

## Follow-up: light range (found in the first film use)

With 95 fog-only lamps in the town scene, the unbounded 1/r² tails added up
to a brown wash over the whole sky while single halos stayed weak. Each fog
light now has a `range` (the light node's `range`, default 12 m): a view ray
that passes farther from the light gets no glow, with a smooth window.
`zhudaFogAirlight` takes the range and is tested (zero at and beyond the
range, a quarter at half the range); `verify:film-fog` passes unchanged.
Seen in the town stills: the sky keeps its colour and lanterns get separate
halos.

## Follow-up: light shafts (2026-11-11)

Source: the user asked for the realism of a forest shot with beams of light
between trees. `ZhudaLightFog` takes `shafts` and `attachSun`; film scenes
switch it on with `look.lightFog.shafts`.

The fog marches along each view ray (8..96 steps, jittered per pixel and per
frame) and looks every step up in a depth picture drawn by an orthographic
camera placed toward the sun. Scattering uses the Henyey-Greenstein phase
function. The projection for the lookup is computed in TypeScript: Laya
refreshes a camera's own matrices only when it draws, one frame late.

| Check                                                                | Result |
| -------------------------------------------------------------------- | ------ |
| `node --test tests/light-fog.test.mjs tests/film-scene.test.mjs`     | PASS   |
| `npm run verify:film-fog` (WebGL)                                    | PASS   |
| `npm run verify:film-webgpu` (the same check on WebGPU, Apple Metal) | PASS   |
| `npm run verify` (399 tests), lint, format, `git diff --check`       | PASS   |

`verify:film-fog`, step 8 (480×270, sun in the east at 30°, a wall 6 m high
at x = 5, black fog colour, no lamps), identical on both backends:

| Pixel                                         | Value (R, G, B)  |
| --------------------------------------------- | ---------------- |
| Fog under the wall's shadow for the whole ray | 0, 0, 0          |
| Fog where the ray rises above the shadow      | 94.9, 87.9, 73.4 |
| Fog past the end of the shadow                | 57.8 red         |
| The first pixel without the wall              | lit (> 20)       |
| Without `shafts`                              | below 3          |
| After 20 mounts with and without shafts       | byte-identical   |

The check fails for a reversed light direction or a mirrored depth picture
(both happened during development: `getForward` of Laya's light is the
direction the light travels, and the camera's stale matrix put the picture
in the wrong place).

Also changed: only point lights count against the 128 lights of the fog;
spot lights never shone into it, and a street of 100 baked lamps (fog-only
points) plus 100 real-time spots is a valid scene.

Limits of the shafts: one directional light; the depth picture covers the
stretch of view given by `distance` (default 60 m) at 2048², so edges are
about 4 cm coarse at 70 m and softer with longer distances; alpha-tested
leaves cut the light only as far as Laya's depth pass honours their cut-out
(not measured); halos of point lights stay unshadowed; the step count is the
cost and was not profiled.

## Limits and decision

- Halos of point lights are not shadowed: a wall beside a lamp does not cut
  its halo. The sun or moon is shadowed (see the follow-up above).
- Only point lights and the sun or moon shine into the fog; spot cones do not.
- The fog is uniform apart from its height falloff; it does not move.
- The mirrored view of a reflector is drawn without fog.
- One full-screen pass with a loop over the lights for every pixel; the cost
  with 128 lights at high resolution was not measured.
- Desktop WebGL and WebGPU (Apple Metal); mobile is not covered.

Decision: **Implemented within scope; desktop WebGL and WebGPU verified.**
