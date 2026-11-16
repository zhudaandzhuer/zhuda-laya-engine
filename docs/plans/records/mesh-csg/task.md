# Agent task: mesh-csg

Status: Implemented; desktop WebGL and WebGPU, no consumer and no phone
Owner: Engine/toolchain
Last reviewed: 2026-11-17

## Source requirement

[Mesh boolean operations (CSG)](plan.md), deferred there until a consumer
game asked for it; taken up on the owner's request of 2026-11-17 to finish
every item of the plans waiting list.

## Goal

`zhuda-laya-engine/csg`, an entry of its own: `zhudaCsg(a, b, 'union' |
'subtract' | 'intersect')` on `MeshData` with a report, and
`validateZhudaCsgInput`, without three.js, drawn through `ZhudaDynamicMesh`.

## Invariants

- The core entry does not import it; the main bundle does not contain it.
- Inputs and outputs are `MeshData`; the BSP base sits behind that seam.
- Closed inputs only; a mesh with a hole or a shared edge is refused with
  what is wrong; the result's open and non-manifold edges are reported.
- Ported code keeps its licence notice (csg.js, MIT, in `Bsp.ts`).

## Scope

### Engine

- `packages/core/csg/Bsp.ts` (the port), `packages/core/csg/index.ts`
  (conversion, restoring whole triangles, snapping, mending seams,
  triangulation, welding, report, validation); `packages/types/csg/`
  generated; `package.json` `exports["./csg"]`; the SDK build makes
  `dist/sdk/zhuda-laya-csg.{esm.js,cjs}`; the types generator takes the
  entry as a root.
- `tests/csg.test.mjs`, `tests/types-module-resolution.test.mjs` (a
  consumer imports the subpath under Bundler, Node16 and NodeNext),
  `tests/disclosure-contracts.test.mjs`, `scripts/verify-csg.mjs`,
  `tests/fixtures/csg.ts`, `docs/procedural-assets.md`.

## Deviations from the plan

1. **No consumer failing fixture first.** The plan waits for a consumer;
   the owner asked for it now. The engine's own fixtures stand in.
2. **No coplanar merge option.** Instead, every input triangle that the
   other mesh's planes split but kept whole comes back as one triangle
   (always on; the geometry is unchanged). Faces that were really cut stay
   splintered.
3. **No worker.** Measured synchronous times are 2 to 80 ms for the cases
   here; a worker is left until a consumer's sizes need it.
4. **Not robust under repeated curved cuts** (see the verification
   record): the plan's risk, reported and refused rather than hidden.

## Non-goals

As in the plan: gameplay, colliders for the result, skinned meshes,
replacing offline booleans.

## Acceptance checks

1. Geometry fixtures: box minus sphere volume (exact against the faceted
   sphere), closed, outward normals; the three operations on overlapping
   boxes; coplanar and touching faces; a corner cut checked by
   A − B + A ∩ B = A and A ∪ B + A ∩ B = A + B; a degenerate triangle left
   out; an open input refused with a message; a wall with a door; five
   windows in succession.
2. Public API: strict consumer typecheck of the subpath under three
   resolutions; ESM and CJS bundles export it; the main bundle does not.
3. A draw on WebGL and WebGPU: the background through the door, the wall
   round it, a box with a sphere cut from its corner.
4. `npm run verify`, lint, format, `git diff --check`.

## Rollback

A new entry: reverting the commit removes it; nothing else imports it.
