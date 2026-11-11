# Agent task: game-look

Status: Implemented within scope; desktop WebGL and WebGPU (Apple Metal) verified in a consumer game  
Owner: Engine/toolchain  
Last reviewed: 2026-11-12

## Source requirement

The user wants a game built on this engine (a Windows build for Steam is the
case named) to come close to the feel of a high-end engine "in the lightest
way" and with performance that "is always good", on WebGPU.

## Goal

A game Scene gets the look of the film stills from the same data, pays for
it only what it must, and steps quality down by itself when frames run over
the budget.

## Invariants

- One look implementation: games and film scenes share
  `applyResolvedFilmLook`; no second sky, fog or grade path.
- The governor decides and nothing else: it holds no engine state, uses the
  frame times it is given (the runtime's clock), and never touches timers.
- Film stills are unchanged: beams redraw every frame there, mirrors draw
  their own shadows unless told otherwise.
- Vendor files stay unmodified.

## Scope

### Engine

- `ZhudaSceneLook`, `zhudaLookForQuality`, `ZhudaQualityGovernor`.
- Auxiliary passes: `ZhudaPlanarReflection` `manual`/`shadows`/`draw()`,
  `ZhudaWaterSurface` `mirrorShadows`/`setScreenFlip`, `ZhudaLightFog`
  `setShaftRefresh`/`invalidateShafts`, shaft and water cameras out of the
  frame loop.
- `prepareLaya342ManualDraw`; depth-normal fog fix on WebGL as well;
  shader compile failures recorded with source lines.

### Consumer or adapter

- The river-town game (outside this repository) uses the look, the governor
  and the water, and is where frame cost was measured.

## Non-goals

Level of detail, occlusion or distance culling, resolution scaling, GPU
timing, a panorama sky or environment probe in `ZhudaSceneLook`, Windows or
Steam packaging.

## Acceptance checks

1. Unit: governor (step down, step up, back-off, hitches, bad input), look
   quality table, manual-draw preparation.
2. Film verifications unchanged on WebGL and WebGPU.
3. Consumer game: runs at every quality level on both backends without page
   or GPU validation errors; walk check passes on both; frame cost per level
   recorded.
4. `npm run verify`, lint, format, `git diff --check`.
