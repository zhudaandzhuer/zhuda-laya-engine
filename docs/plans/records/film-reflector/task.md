# Agent task: film-reflector

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-11

## Source requirement

The first film built on baked lightmaps lost every highlight: a lightmap
holds diffuse light only and no real-time light is left to make a glint, so
the wet paving looked matt. The user asked to close the gap in the engine.

## Goal

A horizontal surface in a scene can show a real reflection of the scene
above it: lanterns, lit windows, buildings and sky, stronger at grazing
angles and in puddles, broken up on damp stone. It works for games through
a public class and for film scenes through a `reflector` node.

## Invariants

- Laya 3.4.2 only: the mirrored scene camera is the existing
  `ZhudaPlanarReflection`; the surface is a `ZhudaShaderMaterial` on an
  engine mesh. No second renderer, no screen-space pass.
- The reflection adds light on top of whatever is under it; it never
  replaces the lit surface, so lightmaps and materials keep working.
- Film renders stay deterministic: the reflection is rendered for every
  sample of every frame, before the main camera.
- Every GPU object has a release path; a disposed stage leaves no camera,
  target, mesh or material.
- Scenes without a reflector render exactly as before.

## Scope

### Engine

- `ZhudaReflectiveSurface` (public): owns the mirrored camera, target,
  surface mesh and material; `update` and `render` per frame; `dispose`.
- `CinematicFrameRequest.prepare`: a synchronous hook before the main draw.
- `ZhudaFilmScene` node `reflector`, validated with paths; one per scene.
- Film stage: mounts it, hides named model nodes from the mirrored camera
  (the ground itself), renders it before each sample.
- Unit tests, a real-GPU check, docs and MCP descriptions.

### Consumer or adapter

- None.

## Non-goals

Reflections on walls or sloped surfaces, glossy highlights from the bake,
reflection probes, screen-space reflections, refraction, animated ripples.

## Acceptance checks

1. Validation reports every bad reflector field with a path; a second
   reflector is refused.
2. Real WebGL: a lit object above the surface appears mirrored below it at
   the projected position; the frame is unchanged where nothing reflects;
   removing the node restores the plain frame; a hidden ground model does not
   block the reflection.
3. After 30 mount cycles the frame is identical to the first one.
4. `npm run verify`, lint, format and the film GPU checks pass.

## Result

See [verification.md](verification.md).
