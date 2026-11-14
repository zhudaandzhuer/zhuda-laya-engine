# Agent task: shadow-bias-away-faces

Status: Implemented within scope; verified in one consumer scene on desktop WebGL and WebGPU  
Owner: Engine/toolchain  
Last reviewed: 2026-11-14

## Source requirement

Owner's request of 2026-11-14 ("look into the shadow"), after a side-by-side
of the city-walk game with the same scene drawn by three.js: three.js showed
a tree's shadow on the paved road and the engine did not.

## Finding

The tree was not left out. The whole road lay in shadow, all day: with the
sun's shadows switched off its brightness in the frame went from 60 to 110,
and with only the road model's own shadow casting switched off from 60 to 84
(the rest is the tree's shadow, which was there all along).

The road's deck in that model is a face modelled upside down: one layer whose
normals point at the ground, shown from its back by a two-sided material.
LayaAir 3.4.2 draws a shadow caster with every vertex pulled back along its
normal (`applyShadowBias` in `DepthVertex.glsl`), by the full bias where the
normal looks away from the light. For this deck "back along the normal" is
up, toward the sun: in the shadow map the deck stood above itself. The same
happens to the underside of any thin slab once the bias is as large as the
slab is thick; the bias grows with the size of a shadow-map split.

## Goal

A face that looks away from the light is not moved toward it when it is
drawn as a shadow caster.

## Invariants

- LayaAir 3.4.2 vendor files are not modified: the include is patched as it
  is registered, like the translucency and point-shadow patches.
- A face turned to the light is drawn into the shadow map exactly as before.
- If the vendored line changes, the patch does nothing and a unit test says so.

## Scope

### Engine

- `installLaya342ShadowBias`, `zhudaPatchShadowBias`
  (`packages/core/runtime3d/Laya342Adapters.ts`), installed by
  `ZhudaEngine.boot` before `Laya.init`.
- `tests/shadow-bias.test.mjs`.

### Consumer or adapter

- None. `films/river-town-prefab` is where it was found and measured.

## Non-goals

- The bias of the furthest split being used for every split (seen in the
  vendored code, not measured).
- Repairing models: a deck modelled upside down still draws, as it does in
  other renderers.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- The shadow-related GPU checks on WebGL and WebGPU, unchanged in result.
- The game's road before and after, with the measurements above repeated.
