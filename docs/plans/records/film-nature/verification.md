# Verification record: film-nature

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `19c70ee`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome headless; WebGL through ANGLE Metal on Apple M4 and
  WebGPU on the adapter reported as `apple metal-3` (hardware).
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check                     | Exact command or procedure                                                                                                 | Result |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| Water, placements (WebGL) | `npm run verify:film-water`                                                                                                | PASS   |
| All film checks on WebGPU | `npm run verify:film-webgpu` (eight verifications, water and placements included)                                          | PASS   |
| Film regressions on WebGL | `npm run verify:film`, `:film-look`, `:film-model`, `:film-reflector`, `:film-fog`, `:film-animation`, `:film-environment` | PASS   |
| Options, schema, adapters | `node --test tests/water-surface.test.mjs tests/film-scene.test.mjs tests/webgpu.test.mjs`                                 | PASS   |
| Full gate                 | `npm run verify` (405 tests), `npm run lint`, `npm run format:check`, `git diff --check`                                   | PASS   |

### `verify:film-water` (480×270; sand bed at y = 0, a sand shelf 10 cm under the surface, water level 1 m, clarity 0.5 m)

| What                                                        | Measured (R, G, B)                                  |
| ----------------------------------------------------------- | --------------------------------------------------- |
| Sand without water, shelf and bed                           | 207, 175, 85 both                                   |
| Shelf through 10 cm of water                                | 175.8, 145.8, 60.2                                  |
| Bed through 1 m of water                                    | 44, 72.1, 37                                        |
| Mirrored pixel of a red lamp above the water, reflection on | red well above the frame without it                 |
| A green lamp below the surface                              | not mirrored (green stays below red)                |
| Foam with `foamDepth` 0.4 against none                      | more than 150 brighter pixels, none over deep water |
| Waves at shot time 0 and 2 s                                | frames differ                                       |
| Three placements of one model                               | drawn at each projected place, nothing between      |
| After 30 mounts with and without water                      | frames byte-identical to the first                  |

Both backends give the same result.

## Defects found and fixed

1. **Scrambled trees on WebGPU.** A scanned tree drawn twice came out as a
   fan of shards. Laya 3.4.2 reads every index buffer as 16-bit when it
   merges a batch (`IndexFormat.UInt16 ? … : …` tests the enum constant).
   The adapter copies 32-bit index buffers again, correctly; WebGL was
   never affected.
2. **Mirror cut at the water level.** Without a clip the bed, seen from
   below, covered the whole mirrored view. The mirrored camera now uses an
   oblique near plane. Laya's projection maps depth to 0..1, so the plane
   replaces the third row (the −1..1 formula clipped everything).
3. **`half` is a reserved word** in the WebGPU shader compiler; the water
   shader failed to compile there until it was renamed.
4. **Copies and sub-mesh materials.** Clones take their materials from the
   source renderers; Laya's clone is not relied on for that.

## Unverified limits

- Leaf translucency has no automated real-GPU check: the fixtures have no
  cut-out material. It was seen working in stills (ferns and tree leaves lit
  from behind) and its include patch is unit-tested. Leaves shadowed by
  other leaves stay dark; there is no scattering through several layers.
- Placements are separate Laya nodes that share meshes and materials; the
  engine does no level of detail and no culling of its own. Seen: about
  5 000 copies and roughly 25 million triangles draw a 1280×720 preview in
  under a second on the M4 after loading; not profiled, not a real-time claim.
- Water is one flat, level rectangle; no slopes, waterfalls, caustics,
  underwater view or shore waves. Foam and waves are procedural noise.
- The mirrored view has less depth precision near the water plane (oblique
  near plane); distant mirrored geometry was not checked for depth fighting.
- Windows, Linux, mobile and other browsers: not run.

## Follow-up: calmer water, reflection-only probe (2026-11-11)

Source: the user found the foreground of the first river still noisy. The
surface was value noise without a direction and mirrored the scene sharply.

- Waves are four trains fanned around the flow direction, each with its own
  length and speed, plus a little noise; finer ripples only move the sun
  glints. The mirrored scene is read with five taps.
- Foam is a soft line at the waterline, modulated along it, instead of
  patches over all shallow water.
- `look.environment.reflectionOnly` (and `ZhudaEnvironmentProbe` capture
  option `reflectionOnly`) keeps the scene's ambient light and takes only
  reflections from the capture.

`npm run verify:film-water` and `npm run verify:film-webgpu` pass unchanged;
`npm run verify` passes (405 tests). `reflectionOnly` is covered by the schema
test only; its picture was checked by eye in the river still.

## Follow-up: water glow and bent wave fronts (2026-11-12)

Source: the user found the water colour close but not right (dark green
with hard blue patches of mirrored sky) and the foreground surface showed a
regular lattice of dark spots.

- `glow` (water option and film `water` node, 0..4, default 0.25, the former
  fixed value): how much deep water shines in its own colour from light
  scattered inside it.
- The wave trains are bent by low-frequency noise and carry more noise, so
  they no longer cross into a lattice.

`npm run verify` (405 tests), lint, format and `git diff --check` pass;
`npm run verify:film-water` passes on WebGL and WebGPU. The look itself was
judged by eye in the river still; no pixel check covers the lattice.

## Follow-up: water that takes its colour from the scene (2026-11-12)

Source: the user and their colleagues found the water unreal: an even green
that did not belong among the trees, and ripples with a mechanical rhythm.

- Ripples are five layers of drifting noise, each turned and moving at its
  own pace and drawn out along the flow, plus one faint wave train. The
  earlier wave trains showed as stripes far away and a lattice close by.
- The surface estimates where the sun reaches it from the brightness of the
  scene behind it. Glow, sun glints and the brightness of foam follow that
  estimate, so water in the shade is dark and clear instead of glowing.
- Glints are smaller (finer ripples, tighter highlight).

`npm run verify` (405 tests), lint, format and `git diff --check` pass;
`npm run verify:film-water` passes on WebGL and WebGPU (foam brightens 620
pixels of the shallows in the fixture).

Limits: the sunlit estimate is a heuristic on scene brightness, not a shadow
lookup: a dark bed in full sun reads as shade and a pale bed in shade may read
as lit. In the river still almost no sun glints remain; whether that is the
estimate being too strict was not measured. Judged by eye only.

## Follow-up: emission scale on model nodes (2026-11-12)

Source: a town built and baked for night stood in a daytime river shot with
its windows lit. Model nodes take `emission` (0..8, default 1), which scales
the emissive strength of the model's glTF materials for that stage and
restores it on disposal (the materials are shared through the library).

`npm run verify:film-water` (WebGL and WebGPU), step 5b: an emissive floor
reads 149, 89, 39; with `emission: 0` it is 0, 0, 0; with `emission: 2` it
is 203, 124, 56; mounted again without the option it is 149, 89, 39.
`npm run verify` passes with the schema test.

Limit: only materials that carry Laya's glTF `u_EmissionStrength` are
scaled; emissive textures are scaled with them, engine-built film materials
(`materials` of the scene) are not touched.
