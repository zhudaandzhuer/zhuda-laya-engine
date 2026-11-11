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

## Limits and decision

- No shadows inside the fog: a wall beside a lamp does not cut its halo and
  there are no light shafts. Only geometry on the camera ray ends the glow.
- Only point lights shine into the fog, at most 128; the sun or moon and
  spot cones do not.
- The fog is uniform apart from its height falloff; it does not move.
- The mirrored view of a reflector is drawn without fog.
- One full-screen pass with a loop over the lights for every pixel; the cost
  with 128 lights at high resolution was not measured.
- Desktop WebGL only; WebGPU and mobile are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**
