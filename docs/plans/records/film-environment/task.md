# Agent task: film-environment

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-11

## Source requirement

The user judged the baked town still "3D-model-like". One cause is in the
engine: a lightmap holds diffuse light only, so roof tiles, lacquer, timber
and metal have no highlights or reflections at all, and characters in a
baked scene get only a flat ambient colour.

## Goal

A scene can capture its own surroundings from one point and use the result
as its environment: glossy and metallic surfaces reflect what is around
them, and surfaces without a lightmap get ambient light with the colour and
direction of the surroundings. Film scenes switch it on with
`look.environment`.

## Invariants

- Laya 3.4.2 only: the capture is six renders with a Laya camera; the
  result goes through the existing `createPrefilteredEnvironment` into
  `Scene3D.iblTex` and `ambientSH`. No second renderer.
- Convolution (GGX mip chain, spherical harmonics) is pure TypeScript and
  tested without a GPU.
- One probe per scene: reflections are right at the probe and approximate
  elsewhere. This is stated, not hidden.
- The previous ambient setup is restored and every GPU object released on
  disposal. Scenes without an environment render as before.

## Scope

### Engine

- `prefilterZhudaEnvironment` (pure) and `ZhudaEnvironmentProbe` (capture,
  apply, dispose).
- `ZhudaFilmScene`: `look.environment { position, reflection, ambient }`;
  `loadZhudaFilmScene` captures after the stage is built.
- Unit tests, a real-GPU check, docs, MCP descriptions.

### Consumer or adapter

- None.

## Non-goals

Several probes, box projection, real-time updates while things move,
screen-space reflections, reflections of the probe's own position being
exact elsewhere.

## Acceptance checks

1. Pure: a uniform environment stays uniform at every mip and gives a flat
   ambient; a bright direction ends up at the right place in the cube and
   brightens surfaces facing it; mips get blurrier with roughness.
2. Real WebGL: a mirror-like box shows a lit object in the direction a
   mirror would (tested behind the camera, to the side and above), and not
   one placed at the mirrored-wrong side; a rough white box is tinted by a
   coloured light source on the side facing it.
3. 30 mounts leave the frame identical.
4. `npm run verify`, lint, format and the film GPU checks pass.

## Result

See [verification.md](verification.md).
