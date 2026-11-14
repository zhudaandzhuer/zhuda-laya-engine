# Agent task: lit-hook-inputs

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

Relayed on 2026-11-15 from a consumer study outside this repository that
redoes a three.js page (a sheer knitted cloth on a body) with the engine's
public API. It listed what the study had to work around, as WP17 of
`records/threejs-gap-audit/plan.md` now records:

- A1: `ZhudaLitSurface` has no `alpha` and no `normalTS`.
- A2: the hook is not given the view direction, nor the normal before the
  normal map bends it.
- A3: `ZhudaLitSurfaceMaterial` drops `material.blend` (alpha, cut-out,
  depth write).
- A4: no cut by a hash of alpha.
- A5: sheen is only on a `physical` surface, the hook only on a lit one.
- B1: a `ZhudaDynamicMesh` takes no colour a vertex, so a number the mesh
  knows (how far the cloth is stretched) cannot reach the hook.

and the gates G1 (A1 to A3), G2 (A4) and G3 (B1) this record's verification
answers. A1, A3 and A4 were already in the tree when the request arrived
(`records/physical-surfaces/`, the section of 2026-11-15, commit `befc96b`);
their gates had not been drawn in the form the request names.

## Goal

A sheer cloth can be written as one lit surface with no workaround: its
alpha from how steeply each place is seen, blended, added or cut as the
material says, with the glow cloth has at its edges, reading a number each
vertex carries.

## Invariants

- Vendor files are not modified.
- A surface that reads none of the new fields is lit as before; a mesh
  without colours is laid out as before (eight numbers a vertex, twelve with
  tangents).
- The shadow and the depth of a cut surface are cut by the same hook, with
  the same fields to read.
- A shader name is a contract: `sheen` is part of it.
- The engine decides nothing about the cloth: the alpha line, the stretch
  and the colours are the consumer's.

## Dependencies

- LayaAir 3.4.2: the PBR templates (`LitSurfaceTemplates.ts`), its sheen
  lobe (`SHEEN` in `PBRLighting`), `VertexMesh.getVertexDeclaration`.
- `ZhudaLitSurfaceMaterial`, `ZhudaDynamicMesh`, `applySurfaceBlend`.

## Scope

### Engine

- `shaders/LitSurfaceMaterial.ts`: `s.viewDirection`, `s.vertexColor`,
  `sheen` (`s.sheenColor`, `s.sheenRoughness`, `setSheen`,
  `resolveZhudaLitSheen`, `ZHUDA_LIT_SHEEN_UNIFORM`); `set` takes a LayaAir
  vector and says what a uniform wanted.
- `runtime3d/Surfaces.ts`: `MeshData.colors`, `ZhudaDynamicMesh.setColor`,
  `offsets`, the vertex declaration with `COLOR`.
- `tests/lit-surface.test.mjs`, `tests/fixtures/lit-surface.ts`,
  `scripts/verify-lit-surface.mjs`.
- `docs/filmic-rendering.md`, `docs/film-scenes.md`, `docs/3d-integration.md`,
  the MCP guard `GUARD_LIT_SURFACE_INPUTS`.

### Consumer or adapter

- The study itself (gate G4 of the request) is redone outside this
  repository, by its own session. This record gives it the public interface
  and nothing else.

## Non-goals

- A hook on a `physical` surface (LayaAir's glTF shader). Thin film, glass,
  coat and turned highlights stay without a hook; see "Unverified limits".
- A tangent frame for the hook (an iris seen through a cornea, a highlight
  along a hair): WP20 of the plan.
- Cloth that moves (WP18) and spring bones (WP19).

## Acceptance checks

1. `node --test tests/lit-surface.test.mjs`: the programs that are
   generated (the fields in all three passes, the sheen flow in place of
   LayaAir's, the uniform map), the material's state after its shader is put
   on (blend, cut-out, depth write, the sheen define and vector), `set`, and
   the layout and upload of a mesh with colours.
2. `npm run verify:lit-surface` and
   `LIT_SURFACE_RENDERER=webgpu npm run verify:lit-surface`:
   - G1: a ball with `blend: 'alpha'` and
     `alpha = 1 - exp(-0.35 / pow(max(0.23, dot(N, V)), 0.52))` is clearer
     in the middle than at the edge, within 0.02 of the line at four radii;
     a plate at alpha one half is mixed with `'alpha'`, added with
     `'additive'`, whole when opaque, with nothing set by hand; a tilt
     written to `normalTS` moves a highlight, with tangents and without;
     the shadow and the depth-normal pass read the same fields (a plate cut
     by its vertices' number and by how steeply it is seen).
   - G2: two sheets through each other, cut by chance: the upper one is
     seen on about half the pixels and the lower on about a quarter on both
     sides, and the picture is the same whichever is made first.
   - G3: a dynamic mesh with colours whose alpha the hook draws; after two
     vertices are changed and their range uploaded the picture follows, and
     not before.
3. The older draws on both backends (the films, looks, effects and models),
   `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`.

## Evidence to attach

- Test/build output: in the verification record.
- Browser/WebGL or device report: `report.json` and pictures of each
  backend, outside the repository.
- Resource/lifecycle report: what each part of the check leaves behind
  (nothing).

## Unverified limits

- No phone.
- `sheen` with a `ZhudaLitShading` of one's own is refused, not built.
- A `physical` surface has no hook: its lobes are LayaAir's glTF shader,
  whose program this template does not produce. A cloth that needs a hook is
  a lit surface with `sheen`.
- On a skinned mesh the new fields were not drawn (the template is the
  same; no skinned fixture has colours).

## Rollback

`3926386` is the last commit before this work. A surface that reads none of
the new fields and a mesh without colours are unchanged, so reverting the
commit of this record removes only the additions.
