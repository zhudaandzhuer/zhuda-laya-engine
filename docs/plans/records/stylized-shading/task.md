# Agent task: stylized-shading

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP8): three.js has `MeshToonMaterial` (a gradient map over N·L),
`MeshMatcapMaterial`, `MeshNormalMaterial` and `OutlinePass` (selected
objects outlined, another colour where hidden). The engine had none: its lit
template was physically based only, its recipes were terrain, textured,
dissolve and a 2D tint. WP8 asks for a toon material with ramp-quantized N·L
that reads LayaAir's lights and shadows, an inverted-hull outline from the
same spec, a matcap and a normal-view recipe, and a selection-outline post
effect with visible and hidden colours.

## Goal

A character drawn in bands, with a cast shadow that has the bands' hard
edge, lit by a sun, a lamp and a spot, outlined, with its bones moving; a
ball drawn from a picture of a lit ball; a selected prop with a line round
it that changes colour behind a wall: on WebGL and on WebGPU, each colour
predicted from the numbers the scene was built with.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- The toon material follows LayaAir's light loop (directional, clustered
  point and spot, with their shadows), its fog, skinning and instancing: it
  is the lit template with one function replaced, not a second lighting.
- No second clock: the pulse of a selection is a function of the seconds it
  is given.
- A material or an effect that is refused leaves nothing behind; disposal
  leaves no resource.
- The pure parts (ramp checks, the band arithmetic, the outline programs,
  option checks, the pulse) need no runtime.

## Dependencies

- `ZhudaLitSurfaceMaterial` and its templates (`LitSurfaceMaterial.ts`,
  `LitSurfaceTemplates.ts`); `ZhudaShaderMaterial` and `shaderRecipes`.
- `ZhudaFilmicPipeline` (`finishEffects`), `zhudaShaderRegistrar`.
- LayaAir 3.4.2: `PBRFrag.glsl`'s light loop, `Lighting.glsl`,
  `globalIllumination.glsl`, `ShaderPass.statefirst`, `CommandBuffer.drawRender`
  and `addCustomCMD`, `PostProcessEffect`.

## Scope

### Engine

- `packages/core/shaders/ToonMaterial.ts` (new): `ZhudaToonMaterial`,
  `validateZhudaToonSpec`, `validateZhudaToonRamp`, `zhudaToonRamp`,
  `zhudaToonBand`, `ZHUDA_TOON_DEFAULT_RAMP`, `buildZhudaToonOutlinePass`.
- `packages/core/shaders/LitSurfaceMaterial.ts`: `ZhudaLitShading`, a
  lighting that replaces the physical one and may add forward passes.
- `packages/core/shaders/ShaderMaterials.ts`: recipes `matcap3D` and
  `normalView3D`.
- `packages/core/runtime3d/SelectionOutline.ts` (new):
  `ZhudaSelectionOutline`, `validateZhudaSelectionOutline`,
  `zhudaOutlinePulse`.
- Found while drawing it, and fixed because the outline depends on it:
  - `Filmic.ts`: `finishEffects` ran before the grade (LayaAir keeps its
    colour grade last and puts a later effect before it). They are now
    added after it.
  - `LensFinish.ts`: works in the colours the screen shows and hands the
    picture back linear, as the end of the chain holds it.
- `tests/stylized-shading.test.mjs`, `tests/helpers/toon-fixture.mjs`,
  `tests/fixtures/stylized-shading.ts`, `scripts/verify-stylized-shading.mjs`,
  `npm run verify:stylized-shading`; `tests/look-defaults.test.mjs` orders a
  chain as LayaAir does.
- `docs/stylized-shading.md`.

### Consumer or adapter

A game brings its own models, matcap pictures and selection rules. None is
checked in: the check makes a skinned limb and a matcap picture.

## Non-goals

- Outline normals baked for hard-edged meshes; the outline in the depth
  texture.
- A gradient texture for the ramp (the bands are uniforms: no sampler).
- Banded falloff of point and spot lights.
- A glow, or a line wider than 6 pixels, round a selection.
- Toon or matcap materials for film scene JSON.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:stylized-shading` on WebGL and with
   `STYLE_RENDERER=webgpu`.
3. The same page, and its timing page, on a vivo V40.
4. The existing draws that use the filmic chain's finishing effects still
   pass on both backends.

## Unverified limits

See the verification record.
