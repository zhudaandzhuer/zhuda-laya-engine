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
