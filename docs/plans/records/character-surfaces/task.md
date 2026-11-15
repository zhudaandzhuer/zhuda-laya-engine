# Agent task: character-surfaces

Status: Implemented within scope; desktop WebGL and WebGPU verified; no phone\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

WP20 of `records/threejs-gap-audit/plan.md` (C3 of the request relayed on
2026-11-15 from a consumer study outside this repository: skin, eyes, hair
highlights, hair cards). On 2026-11-15 the user asked for WP19 and WP20 to be
finished first, for a product derived from that study: a body under sheer
cloth, seen close.

## Goal

A character's surfaces can be written as lit surfaces with no workaround:
skin that a light reaches round and through, a pattern that lies under the
surface (an iris under a cornea), a highlight along hair. Each on LayaAir's
own lighting, beside `sheen`, so that one surface can have several.

## Invariants

- Vendor files are not modified.
- A surface that asks for none of this is the program it was: the same
  struct, the same flow, the same shader name contract.
- `sheen` alone keeps the flow it had.
- The passes that draw no colour (shadow, depth) compile for a hook that
  reads the new fields.
- No second light loop of the engine's own beside LayaAir's for the base
  lighting: the lobes are added after `PBRLighting`, light by light, with
  LayaAir's own light getters.
- Every value has a range and a refusal that names it; the material's own
  uniform names cannot be taken by a user's uniform.

## Dependencies

- `ZhudaLitSurfaceMaterial` and its hook (`records/lit-hook-inputs/`).
- LayaAir 3.4.2's `PBRMetallicFrag.glsl` flow, `PixelParams.TBN`,
  `getDirectionLight`, `getPointLight`, `getSpotLight`, `getClusterInfo`
  (MIT, Layabox), as the toon shading already uses them.

## Scope

### Engine

- `packages/core/shaders/LitSurfaceMaterial.ts`: `s.tangent`, `s.bitangent`,
  `s.viewTS` (given when the hook's text reads them, or `strands` needs
  them); `subsurface` with `s.subsurfaceColor`, `s.thickness`,
  `setSubsurface`, `resolveZhudaLitSubsurface`; `strands` with
  `s.strandShift`, `setStrands`, `resolveZhudaLitStrands`; the four uniform
  names.
- `packages/types/shaders/LitSurfaceMaterial.d.ts` (generated).
- `tests/lit-surface.test.mjs`, `tests/fixtures/lit-surface.ts`,
  `scripts/verify-lit-surface.mjs`: three more parts.
- `docs/filmic-rendering.md`, `packages/mcp-server/corpus.mjs`
  (`GUARD_CHARACTER_SURFACES`), the plan, its progress and the plan index.

### Consumer or adapter

- The textures (an iris, a thickness map, hair cards), the meshes and the
  choice of values are the consumer's. None is in this repository.

## Non-goals

- A screen-space blur of the skin's light (the diffuse light in a picture of
  its own, several full-screen passes).
- A cornea's refraction, a caustic on the iris, a tear line.
- One strand's shadow on another, light through hair (Marschner's lobes).
- A soft blended fringe round a cut-out core for hair cards; sorting a
  mesh's triangles by the camera.
- An eye, skin or hair class: they are options and a recipe on the lit
  surface.

## Acceptance checks

- Unit: the struct, the frame's call before the hook, the fixed frame in
  the other passes, a hook that reads none of it unchanged; defaults and
  ranges; the flow with each lobe alone and all together, sheen alone as it
  was; a `ZhudaLitShading` refused; the uniform map, the values, the setters,
  the name contract, disposal.
- Real draw, WebGL and WebGPU (`npm run verify:lit-surface`):
  - a disc drawn by a hook under the surface is seen where a point that deep
    is, from two places, with tangents and without, within one pixel;
  - a ball lit from the side: past the edge of the light it is black
    without `subsurface` and as the wrap formula says with it, in the
    subsurface colour, the hook's colour when the hook sets one; lit from
    behind, only the half the hook calls thin glows, by the formula, and
    half the `back` is half the glow; within 0.01;
  - a strand band where the half vector is square to the strand, moved by a
    shift as the formula says, the same from the hook and from the
    material; the second band in its colour; none for strands the other
    way; within 0.05 of a metre (two pixels).
- `npm run verify`, `npm run lint`, `npm run format:check`,
  `git diff --check`; the other draw checks once on both backends.

## Evidence to attach

- The check's output and pictures (`under.png`, `skin.png`,
  `skin-thin.png`, `strands.png`) for both backends, outside the repository.

## Unverified limits

- No phone. No point or spot light in the draw (the loops are LayaAir's own,
  as in the toon shading, and are compiled, but not measured here).
- No light with a shadow in the draw: that a light's shadow removes the
  wrapped light is read from the formula (the light's attenuation carries
  its shadow), not measured.
- No character: the parts are a plate and a ball. How skin, an eye or hair
  look on a face is the consumer's to judge with its own assets.

## Rollback

Revert the commits named in the verification record. Nothing else reads the
new fields.
