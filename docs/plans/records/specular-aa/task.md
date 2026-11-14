# Agent task: specular-aa

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP2; finding `materials/core-pbr-brdf`): LayaAir 3.4.2 ships a GLSL
`specularAA(roughness, normalWS)` that nothing calls, so dense normal maps
sparkle, worst on phones. three.js widens roughness on every physical
material. WP2 asks for a text patch like `installLaya342Translucency` that
calls Laya's `specularAA` in the PBR surface set-up (PBR, glTFPBR,
`ZhudaLitSurface`) behind a `ZHUDA_SPECULAR_AA` define, and optionally a
`ZHUDA_DITHER` 8-bit dither.

## Goal

A ball with a dense normal map, seen from a few metres under a camera that
moves by less than a pixel, flickers clearly less with the patch, and a
smooth surface looks the same; on by default for lit materials.

## Invariants

- LayaAir 3.4.2 vendor files are not modified; the patch is applied to the
  text as LayaAir registers it (`Shader3D.addInclude`,
  `SubShader.addShaderPass`), installed before `Laya.init`.
- Every anchor is checked exactly once; a missing anchor changes nothing and
  says why (`zhudaSpecularAAStatus().reason`, one console warning).
- The define gates everything new but the `inout` surface of `getPixelInfo`
  and one local in the forward pass; without it the shaders draw what they
  drew.
- Derivatives are taken where WebGPU's uniformity rule allows: outside any
  branch, before any discard.
- Light is moved about by the widened highlight, not made or lost.
- No claim beyond what a script drew: desktop WebGL and WebGPU on one Apple
  M4. Phones, frame cost and art approval are not part of this task.

## Dependencies

- LayaAir 3.4.2 `PBRFrag.glsl` (`getPixelInfo`), `PBRLighting.glsl`
  (`specularAA`), the `PBR` and `glTFPBR` forward passes; the engine's
  `LitSurfaceTemplates` forward pass.
- `Shader3D._configDefineValues`, which every new `Scene3D` copies.
- `scripts/lib/chrome-fixture.mjs`, the browser SDK build.

## Scope

### Engine

- `packages/core/runtime3d/Laya342Adapters.ts`: `installLaya342SpecularAA`,
  `zhudaPatchSpecularAA`, `zhudaPatchNormalLength`, `zhudaSpecularAAStatus`,
  `setZhudaSpecularAA`, `ZHUDA_SPECULAR_AA_DEFINE`.
- `packages/core/DeclarativeSDK.ts`: installed with the other 3.4.2 patches.
- `packages/core/runtime3d/index.ts`: the define, the status and the scene
  switch are public; regenerated `packages/types`.
- `tests/specular-aa.test.mjs`; `scripts/verify-specular-aa.mjs` with
  `tests/fixtures/specular-aa.ts`; `npm run verify:specular-aa`.

### Consumer or adapter

None. A game turns it off for a scene with `setZhudaSpecularAA(scene, false)`.

## Decisions

- **Default on, through a define.** The define is added to LayaAir's
  configuration defines once both includes are seen, so every scene made
  after boot has it; a scene can drop it. A material can add it for itself in
  a scene that dropped it, not remove it in one that has it.
- **Two terms, not Laya's call alone.** Laya's `specularAA` on the shading
  normal was drawn first, as WP2 asked. It removed most pops but left a
  mottled shimmer (see the verification record). The normal map's own
  filtering is added: a mipmap averages the bumps under a pixel into a
  shorter normal (Toksvig; a von Mises-Fisher lobe). That needs the length
  before LayaAir normalises it, so the forward passes of `PBR`, `glTFPBR`
  and `ZhudaLitSurfaceMaterial` are patched too, and it is faded out where
  the map is magnified, where a shorter normal between two texels drew their
  grid.
- **No dither.** The engine's looks draw into an HDR target and grade it
  (`Filmic.ts`); a dither in the lit fragment would add noise in linear
  light, not at the 8-bit write. It belongs in the grade's output pass,
  outside this package. Proposed, not built.

## Non-goals

- Clear-coat roughness, sheen and anisotropy lobes keep their own roughness
  (anisotropy reads the widened base roughness).
- Blinn-Phong and unlit materials.
- Mipmaps for normal maps made with `createSurfaceTexture` (its default is
  none); the record shows what that costs.
- Phones, frame budgets, art approval.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- `npm run verify:specular-aa` on WebGL and with
  `SPECULAR_AA_RENDERER=webgpu`, with pictures a person can look at.
- Existing draws that use the PBR shaders still pass with it on by default.
