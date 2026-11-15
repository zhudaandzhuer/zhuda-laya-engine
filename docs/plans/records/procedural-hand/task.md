# Agent task: procedural-hand

Status: Implemented within scope; desktop WebGL and WebGPU drawn; no phone\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

The owner asked on 2026-11-15 whether anyone has used Claude to build a
good-looking human by procedural modelling, and then: "先做手" (start with the
hand). The approach agreed in that conversation: bones as data, sections round
each bone, joined smoothly, real proportions as parameters, the engine's skin
surface (WP20) for the look, and a render-and-compare loop.

## Goal

The engine can make a human hand from numbers alone: a signed distance field
built from a skeleton of the hand (bone lengths and radii from published
adult proportions, a pose given as joint angles), turned into a mesh, with
separate nails, drawn with the lit surface's `subsurface`, and judged from
real draws.

## Invariants

- Pure data, as the rest of `procedural/`: builders return `MeshData`, never
  touch Laya, and are deterministic for the same options.
- No asset enters the repository: the hand is made from numbers in code.
- Vendor files are not modified. No new shader feature: the look uses the
  lit surface as WP20 left it.
- Every option has a range and a refusal that names it.

## Dependencies

- `MeshData`, `ZhudaDynamicMesh`, `ZhudaLitSurfaceMaterial` (`subsurface`,
  `s.vertexColor`), the browser SDK and `scripts/lib/chrome-fixture.mjs`.

## Scope

### Engine

- `packages/core/procedural/Isosurface.ts`: signed distance shapes (round
  cone, ellipsoid), a smooth union with a broad phase, and a surface-nets
  mesher that projects its vertices onto the surface and takes normals from
  the field's gradient.
- `packages/core/procedural/Hand.ts`: the hand's skeleton, proportions and
  pose; `createZhudaHandMesh` returns the skin and the nails, with a colour
  a vertex (a tint as display colour, and how thin the body is there in
  alpha).
- Generated declarations, `tests/isosurface.test.mjs`, `tests/hand.test.mjs`,
  `tests/fixtures/hand.ts`, `scripts/verify-hand.mjs`, the docs.

### Consumer or adapter

- None. A game's own characters, skins and poses stay in its repository.

## Non-goals

- Skinning weights and a rig (the pose is baked into the mesh).
- A forearm, an arm, a body.
- Skin detail textures (pores, prints, veins). Creases are cut into the mesh (added in the second round, the same day).
- A judgement that it is photographic: the draw is judged by eye and by
  measured proportions only.

## Acceptance checks

1. Unit: the mesher on a sphere (vertex distance to the surface, normals,
   watertight: every edge shared by two triangles), refusals, determinism;
   the hand's measured length, breadth and finger lengths against the
   proportions it was given, within 3 mm; a closed mesh; vertex budget.
2. Real draw, WebGPU and WebGL (`npm run verify:hand`): the hand drawn front,
   back, side and backlit, no GPU warning; the pictures kept as evidence.
3. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`.

## Evidence to attach

- The check's pictures and report, outside the repository.

## Unverified limits

- No phone. Not compared with a photograph pixel by pixel.
