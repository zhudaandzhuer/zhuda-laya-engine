# Agent task: film-light-fog

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-11

## Source requirement

The user's colleague asked for more light, fog, depth of field and bloom in
the night town. Bloom, distance fog and depth of field already exist; what
is missing is fog that sits near the ground and is lit by lamps (halos
around lanterns, glow in a candle-lit room). The user asked for both the
tuning and the new capability.

## Goal

A camera can have height fog whose density falls off with height and which
scatters light from point sources along the view ray. Film scenes switch it
on in `look.lightFog`; lights that are already baked into lightmaps can light
the fog without lighting surfaces a second time.

## Invariants

- Laya 3.4.2 only: one `MaterialPostProcessEffect` in the existing
  post-process chain of `ZhudaFilmicPipeline`, reading the camera depth
  texture. No second renderer, no ray marching, no shadow maps.
- The integrals are closed-form and the same formulas exist in TypeScript,
  so the shader's numbers can be checked without a GPU.
- Scenes without `lightFog` render exactly as before.
- Every GPU object (material, data texture, effect) has a release path.

## Scope

### Engine

- `ZhudaLightFog` (public) with `zhudaFogOpticalDepth` and `zhudaFogAirlight`
  (pure). `ZhudaFilmicPipeline` accepts it between ambient occlusion and
  bloom.
- `ZhudaFilmScene`: `look.lightFog`; `fogOnly` on light nodes.
- Film stage wiring, unit tests, a real-GPU check, docs, MCP descriptions.

### Consumer or adapter

- None.

## Non-goals

Shadows in the fog (light shafts cut by geometry), fog lit by the sun or
moon, animated or noisy fog, fog in the reflector's mirrored view.

## Acceptance checks

1. Validation reports bad fog fields with paths; fog-only lights do not
   count against the 32 real-time lights; more than 128 fog lights refused.
2. Pure functions: optical depth matches a numeric integral; airlight
   matches a numeric integral of 1/r² along a ray.
3. Real WebGL: a fog-only light in a dark scene glows at its projected pixel
   and fades with distance from it; nothing changes without `lightFog`;
   distant surfaces take the fog colour more than near ones; a wall in front
   of the light cuts the glow.
4. `npm run verify`, lint, format and the film GPU checks pass.

## Result

See [verification.md](verification.md).
