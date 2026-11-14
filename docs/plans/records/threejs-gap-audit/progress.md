# three.js gap plan: progress

Plan: `docs/plans/records/threejs-gap-audit/plan.md` (work packages WP0..WP16)\
Last updated: 2026-11-14, after WP9 (batch 2 is done one package at a time, by one agent, without a review agent)

## Where each package stands

| Package | State | Record |
| --- | --- | --- |
| WP0 housekeeping | Merged, reviewed, review points closed | `topology-globals-and-guardrail` |
| WP14 small game services | Merged, reviewed; five minor review points open, listed in its record | `game-services` |
| WP1 shadow maps every few frames or on request, render scale, FSR 1 | Merged, reviewed, one review round applied; measured on a vivo V40; no game uses it yet | `frame-cost` |
| WP2 specular anti-aliasing | Merged, reviewed, reworked after review; **off until a scene asks** (decided at the merge: worse than off between two and four texels to a pixel, a lit rim, up to 3 ms a frame on the phone) | `specular-aa` |
| WP4 glTF intake (quantized, KHR meshopt, WebP/AVIF, lights, cameras) | Merged, reviewed, one review round applied; `EXT_mesh_gpu_instancing`, texCoord 1 and Meshopt workers not done | `gltf-intake` |
| WP7 physical surfaces in code (sheen, thin film, glass, turned highlights) | Merged, reviewed, one review round applied (six textures a material at most, said and drawn at the limit); `ZhudaLitSurface` alpha, normal map and alpha hash not done | `physical-surfaces` |
| WP3 shader warm-up | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40 | `shader-warm-up` |
| WP5 KTX 2 / Basis textures | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; no encoder shipped and no encoder's output drawn (the check makes its own one-colour UASTC files) | `basis-textures` |
| WP6 HDR panoramas and the studio room | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; not wired into film scenes, no GPU prefilter | `hdr-environment` |
| WP8 toon material, matcap, normal view, selection outline | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; no outline normals for hard-edged meshes, the outline is not in the depth texture | `stylized-shading` |
| WP9 instanced meshes and baked crowds | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; the bake runs at load (no build-time baker), no blending in a crowd | `instanced-meshes` |
| WP10..WP13, WP15, WP16 | Not started | |

Each merged package's own record lists what it did not do; those lists are
the open work, not this table.

## How batch 1 was checked

- Each package was built in its own worktree by one agent, reviewed
  adversarially by a second (which wrote its own probes), and fixed by a
  third. The fixes were not reviewed a second time by an agent: at the merge
  each package's own checks, which now hold the reviewers' failing cases,
  were run again on the merged tree.
- Merged tree (`5f85f26`): `npm run verify` 628 of 628, lint, format and
  `git diff --check` pass. Sixteen real-draw checks on WebGL and on WebGPU
  (Apple M4), 32 of 32: the five new ones (`verify:gltf-intake`,
  `verify:physical-surfaces`, `verify:shadow-updates`, `verify:render-scale`,
  `verify:specular-aa`) and eleven older ones the merges touch.
- The consumer game `films/river-town-prefab`, built against the merged
  engine: its day pictures and its six prefab checks pass, unchanged (none
  of the new features changes a default).
- One phone (vivo V40), for WP1 and WP2: `records/frame-cost/verification.md`.

## What the phone said, in short

At 0.67 of the canvas with FSR the game's look level 2 costs 28 to 38 ms a
frame instead of 39 to 51, level 1 18 to 28 instead of 24 to 38; shadow
maps every third frame save 0.3 to 2.9 ms. The phone still does not hold 60
frames a second above look level 0. Whether a phone should aim at 30 with
the level 2 look or at 60 with the level 0 look is the game owner's choice;
the engine has both levers and a ladder (`zhudaQualitySteps`) for either.

## How WP3, WP5, WP6, WP8 and WP9 were checked

One agent wrote, drew and recorded each; there was no second agent to
review them. Each has unit tests, a real-draw check on WebGL and WebGPU with
pictures that were looked at, the same page on the vivo V40, the full gates,
and a rerun of the older draws its change touches. What each could not
check is in its own record.

## Next

In the plan's order: WP10 (animation), WP11 (post quality), WP13 (lighting
depth), WP12 (backend delivery), WP15 (tooling), WP16 (WebGPU-only).

## Found while doing WP9, beyond WP9

- On WebGPU LayaAir never draws its batches of identical renderers into a
  shadow map: repeated props cast no shadow there, in every scene so far.
  Shadow casters are kept out of the batches now and are a draw each. A
  game with many placements that cast should mark them `instanced: true`;
  none was run to see what the change costs it.

## Found while doing WP8, beyond WP8

- `ZhudaFilmicPipeline`'s `finishEffects` ran before the grade since they
  were introduced (LayaAir keeps its colour grade last). Fixed with WP8;
  edge smoothing and the lens finish now work on the graded picture, and
  the lens finish in the screen's colours. Films and games with grain or
  edge smoothing look a little different; none was rendered again.
- A phone reads the depth texture at low precision (LayaAir asks for high
  precision in numbers, not in texture reads). The selection mask reads it
  at high precision now. Still at the default: light fog, depth of field,
  screen reflections, point shadows, probe volumes, the water's depth fade
  and the clouds. To do with WP11, which adds another reader of depth.
- A pass of LayaAir's that fails to compile is skipped, and nothing
  reached the console as an error. A draw check should collect shader
  compile messages, as `verify:stylized-shading` does.

## Open from before the audit

- `inspectEngineHealth` counts loaded modules against the WebGL table only.
