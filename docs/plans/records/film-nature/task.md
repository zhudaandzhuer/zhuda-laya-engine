# Agent task: film-nature

Status: Implemented within scope; desktop WebGL and WebGPU (Apple Metal) verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-11

## Source requirement

The user showed a forest shot (beams of light between trees, dense ferns)
and a river shot (clear green water over stones, banks, reeds) and asked for
that realism outside the walled town, on WebGPU, with scanned assets feeding
the engine. The engine lacked: many copies of one model, leaves that let
light through, and water.

## Goal

A film scene can scatter scanned models by the thousand, light leaves from
behind, and hold a river: clear water with a visible bed, depth colour,
waves that flow, a mirrored scene, sun glints and foam.

## Invariants

- Laya 3.4.2 only; one renderer; vendor files unmodified. Upstream seams are
  contained in the adapters.
- Scenes stay data: placements are numbers in the scene, not code.
- Scenes without the new fields render as before; every new GPU owner has a
  disposal path; water time comes from shot time, not a wall clock.
- No consumer assets in this repository. The scans used for the look work
  live in the film folder outside it.

## Scope

### Engine

- `model.placements`, `model.translucent`; `ZHUDA_FILM_LIMITS.placements`.
- `installLaya342Translucency` (before `Laya.init`) and the
  `ZHUDA_TRANSLUCENT` define.
- `ZhudaWaterSurface`, film `water` node; `ZhudaPlanarReflection`
  `clipBelowPlane` (oblique near plane).
- WebGPU adapter: 32-bit indices in merged batches.
- `verify:film-water`, unit tests, docs, MCP descriptions.

### Consumer or adapter

- None. Terrain, scans and the scatter rule are asset work outside the repo.

## Non-goals

Level of detail, wind, GPU-driven culling of our own, caustics, underwater
views, waterfalls, sloped or curved water, shore waves, wet banks,
translucency through several leaf layers, sub-surface scattering.

## Acceptance checks

1. Real GPU, both backends: bed visible through shallow water and hidden by
   deep water; the surface mirrors a lamp above it at the mirrored pixel and
   not one below the surface; foam in the shallows only; waves change with
   shot time; every placement drawn at its place; 30 mounts leave no residue.
2. Unit: water options, depth tint, schema for water, placements and
   translucency; the translucency include patch; the 32-bit index merge.
3. `npm run verify`, lint, format, `git diff --check`, `verify:film-webgpu`.
