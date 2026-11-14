# Agent task: game-services

Status: Implemented within scope; desktop Chrome verified (audio render, WebGL and WebGPU draws)\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

Work package WP14 "Small game services" of the three.js gap audit plan
(`docs/plans/records/threejs-gap-audit/plan.md`, outside this branch), from the
findings `runtime/positional-audio`, `animation/raycasting`,
`animation/extrude-shapes`, `animation/sweeps-curves-lathe` and
`animation/primitive-geometries`:

- spatial audio: a `spatial` option on `playSample` (a PannerNode between the
  voice gain and the channel gain, HRTF where available) and `setListener(pose)`,
  one AudioContext, a gain-only fallback where PannerNode is missing;
- a triangle BVH for picking meshes without the physics engine, with a
  `QueryProvider` for `ZhudaSceneQueries`;
- extrusion holes and bevel, a Catmull-Rom feed (including LayaAir
  `CurvePath`) into sweep and tube, torus and ring primitives.

## Goal

A game can place a sound in its world and hear it move with the camera, pick
the triangle under the pointer on any mesh it has data for, and build walls
with windows, bevelled edges, pipes along curves, rings and washers, all from
the public SDK.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- Audio keeps one authority (`docs/audio.md`): one AudioContext per adapter,
  master and channel gains applied once, the panner inside the existing voice
  lifetime and disposal. No clock of its own: listener and voice moves come
  from the game's frame; ramps use AudioContext time.
- Picking is pure data: no GPU read-back, no physics engine, no second scene
  graph. A moving mesh is a new matrix, not a rebuild.
- Geometry builders stay pure, validated (`validate*` returns the issues),
  metres for positions and UVs, the engine's winding, 16-bit index chunks.
- No claim beyond what was rendered, drawn or measured.

## Dependencies

- `IframeSoundAdapter`, `ZhudaSceneQueries`/`QueryProvider`,
  `ZhudaCameraCoordinates`, `MeshData`/`ZhudaDynamicMesh`, `Math3D`.
- `scripts/lib/chrome-fixture.mjs`, the browser SDK build.

## Scope

### Engine

- `packages/core/audio/Spatial.ts` (new): Web Audio azimuth, distance, cone
  and equal-power formulas, panner and listener placement.
- `packages/core/IframeSoundAdapter.ts`: `playSample({ spatial })`,
  `setListener`, `setVoicePosition`, `spatialVoices`/`spatialBackend` in the
  diagnostics. Types in `packages/types/zhuda-audio.ts` and `zhuda-2d-ui.ts`.
- `packages/core/runtime3d/MeshQuery.ts` (new): `ZhudaTriangleBvh`,
  `createZhudaMeshQueryProvider`, `readZhudaLayaMeshTriangles`; one export line
  in `packages/core/runtime3d/index.ts`.
- `packages/core/procedural/Geometry.ts`: `holes`, `bevel`, `bevelSegments`,
  `bevelBottom` on `createZhudaExtrudeMesh`; `sampleZhudaCurve`,
  `sampleZhudaCurvePath`, `createZhudaCurveTubeMesh`, `createZhudaTorusMesh`,
  `createZhudaRingMesh` and their validators.
- Tests `tests/audio-spatial.test.mjs`, `tests/mesh-query.test.mjs`,
  `tests/geometry-shapes.test.mjs`; checks `scripts/verify-geometry.mjs` (with
  `tests/fixtures/geometry-shapes.ts`) and `scripts/verify-spatial-audio.mjs`
  (with `tests/fixtures/spatial-audio.ts`); docs `audio.md`,
  `procedural-assets.md`, `3d-integration.md`.

### Consumer or adapter

- None in this task. A game calls `setListener` from its camera and
  `setVoicePosition` from its own entity state.

## Non-goals

- Spatial tones and streams, spatial cues in `renderOffline`, reverb or
  occlusion.
- Picking skinned or morphing meshes, sphere or capsule sweeps against
  triangles, GPU picking.
- Film scene nodes for the new shapes; partial arcs of a torus or ring; a
  check that a tube's radius fits its tightest bend.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`: pass.
2. `node --test tests/audio-spatial.test.mjs`: the graph is voice gain → panner
   → channel gain on one context; left/right worked out from the recorded
   panner and listener values follows the source and the listener's facing;
   the fallback places voices by gain and stereo pan; bad options refused.
3. `node --test tests/mesh-query.test.mjs`: the BVH returns the brute-force
   nearest hit (distance, triangle, barycentrics, point) on random soups and a
   transformed torus, including a mirroring matrix.
4. `node --test tests/geometry-shapes.test.mjs`: closed shapes are watertight
   with outward normals and the expected volume; holes fill exactly on random
   concave outlines; failing inputs name the place.
5. `npm run verify:spatial-audio`: Chrome's OfflineAudioContext renders the
   placement; the fallback matches an equal-power PannerNode.
6. `npm run verify:geometry` and `GEOMETRY_RENDERER=webgpu npm run verify:geometry`:
   pixels and BVH picks agree, holes show through, bevel and torus are shaded;
   pictures looked at.

## Evidence to attach

- Test/build output: verification record.
- Browser/WebGL/WebGPU report: `report.json` and pictures, outside the repository.
- Resource/lifecycle report: panner disconnection on end, stop and dispose (unit tests).

## Unverified limits

- Speakers, headphones, phones and mini-game hosts; how HRTF sounds.
- Picking cost inside a running game; skinned meshes.
- Art approval of the shapes.

## Rollback

`9c91a26` is the last commit before this task. Every addition is optional:
without `spatial`, `holes` or `bevel` the existing calls behave as before,
except that the caps of an extrusion or a sweep come from the new filler
(the same area and number of triangles, possibly cut along other diagonals).
