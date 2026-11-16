# Mesh boolean operations (CSG)

Status: Deferred (waiting for a consumer game that changes geometry while it
runs; nothing here is built by this document)\
Owner: Engine/toolchain\
Last reviewed: 2026-11-16

## Source requirement

Owner's questions of 2026-11-16 (session "豬大引擎 CSG 支持"): does the
engine support CSG; is it needed; does three.js or the LayaAir ecosystem
have it; and should a `zhuda-csg` built from three-csg live outside the
engine or inside it. Then on the same day: put that session's plan in the
waiting list.

Decisions taken in that session:

1. Not now. No current scene, film or action game changes geometry at run
   time; a boolean done in Blender and exported as glTF costs nothing at run
   time.
2. Not a three.js gap: three.js core and `examples/jsm` ship no CSG; what is
   called "three.js CSG" is third-party (`three-bvh-csg`, `@react-three/csg`,
   older `three-csg-ts` and `ThreeCSG`). A quick search found no LayaAir CSG
   package either (forum and GitHub not searched in depth).
3. When it is built: inside this repository as an optional entry, not a
   separate repository and not a wrapper of three-csg.

## When to take it up

A consumer game asks for one of:

- destructible scenery (a wall a hole is cut into, ground dug out);
- a level or building editor inside the game;
- buildings generated from parameters at run time (doors and windows cut
  into walls).

First the consumer records the gap with a failing fixture in its own
repository (AGENTS.md: API gaps are recorded with a failing consumer
fixture). Then check whether pre-cut pieces swapped in at run time, a decal
or a stencil mask answer it; general CSG is built only when they do not.

## Current baseline

| Need                  | What exists                                                                                      | File                                        |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Mesh data             | `MeshData` (positions, normals, uvs, tangents, colors, 16/32-bit indices), `computeMeshTangents` | `packages/types/runtime3d/Surfaces.d.ts`    |
| Upload to Laya        | `ZhudaDynamicMesh` (local range uploads, refreshed bounds)                                       | same                                        |
| Triangle acceleration | `ZhudaTriangleBvh` (positions, indices, world matrix, `winding` `cw`/`ccw`)                      | `packages/types/runtime3d/MeshQuery.d.ts`   |
| Inputs to cut         | Geometry kit: box, tube, rod, I-beam, lathe, extrude, sweep, curve tube                          | `packages/types/procedural/Geometry.d.ts`   |
| Large output          | `splitZhudaMesh` (cuts a mesh past 65 535 vertices into chunks)                                  | `packages/types/procedural/Isosurface.d.ts` |
| Implicit alternative  | Signed distance shapes and surface nets (`createZhudaSdfField`, `createZhudaIsosurfaceMesh`)     | same                                        |
| Boundary              | Consumer guard rejects `three`, `three/…`, `three-stdlib`, `@react-three/…` imports              | `packages/compiler/consumer-guards.mjs`     |

No CSG in source, types, plans or the vendored LayaAir 3.4.2.

## Design

- **Placement:** a renderer-free core in `packages/core/csg` with
  declarations in `packages/types/csg`, published as an optional subpath
  (proposal: `zhuda-laya-engine/csg`; `package.json` `exports` has no such
  entry today). The core entry does not import it, so a game that does not
  use it does not bundle it.
- **No three.js dependency:** inputs and outputs are `MeshData`; the Laya
  side is `ZhudaDynamicMesh`. Wrapping a three.js CSG package would pull
  `BufferGeometry` into the engine and trip the consumer guard.
- **API (proposal):**
  `zhudaCsg(a: MeshData, b: MeshData, op: 'union' | 'subtract' | 'intersect', options?)`
  returning `MeshData` plus a report (triangles in and out, open edges,
  time); `validateZhudaCsgInput(mesh)` naming open edges, degenerate and
  non-manifold triangles before any work. Options: tolerance, which input's
  UVs and material slot a cut face takes, whether to merge coplanar faces.
- **Cut faces:** keep normals and UVs interpolated from the source triangle;
  a face from the cutter takes the cutter's attributes or a slot the caller
  names; tangents recomputed with `computeMeshTangents`.
- **Runs off the frame:** a large operation may run in a worker and is
  cancelable, with a time limit, a stale-result guard and a dispose path, as
  every asynchronous load is.

### Algorithm candidates (measure before choosing)

| Base                                           | License    | For                                       | Against                                                    |
| ---------------------------------------------- | ---------- | ----------------------------------------- | ---------------------------------------------------------- |
| BSP, as csg.js / `@jscad/csg` / `three-csg-ts` | MIT        | Smallest port; enough for few triangles   | Slow; splinters triangles; float trouble on coplanar faces |
| BVH clip and classify, as `three-bvh-csg`      | MIT        | Much faster; can reuse `ZhudaTriangleBvh` | More code; still needs closed inputs                       |
| manifold-3d (WASM)                             | Apache-2.0 | Robust, guaranteed manifold output        | An extra WASM file and its loading lifecycle               |

Start from the BSP port unless the first consumer's sizes rule it out;
keep the MeshData seam so the base can be replaced. Ported code keeps the
original license notice.

## Staged work

1. Consumer failing fixture and the measured sizes it needs (triangles,
   operations a second, phone).
2. Types, `validateZhudaCsgInput`, and deterministic fixtures before code.
3. Core operation on `MeshData`; the `zhuda-laya-engine/csg` subpath.
4. Laya upload through `ZhudaDynamicMesh`; worker and cancellation if the
   measured time needs it.
5. A drawn example (box minus sphere, a wall with a door) on WebGL and
   WebGPU; documentation in `docs/procedural-assets.md`.

## Acceptance gates

- Public API row: strict consumer typecheck, runtime test, ESM/CJS export
  check of the new subpath, and a check that the core bundle does not
  contain it.
- Geometry row: deterministic fixtures — box minus sphere volume within a
  stated tolerance, closed output (no open edges), outward normals, union and
  intersection of overlapping boxes, coplanar faces, touching faces, a
  degenerate triangle, an open input refused with a message.
- Lifecycle row (if a worker is used): cancel, time out, fail, dispose, a
  stale result not applied; 30 build/release cycles with no growth.
- Real draw on WebGL and WebGPU, and timing of the consumer's case on one
  phone, or an explicit unavailable.

## Non-goals

- Gameplay: what breaks, when, and what damage it does stays in the consumer.
- Physics colliders for the result (a later step through the existing
  collider contract, if asked).
- Booleans on skinned or animated meshes.
- Replacing offline booleans in Blender for authored assets.

## Risks

- Floating-point robustness: coplanar and nearly touching faces give holes
  or slivers; the tolerance and the refusal of bad input are the guard.
- Triangle growth on repeated cuts (BSP splinters): report the count, and
  measure repeated operations, not one.
- Main-thread stalls on phones: measure before shipping a synchronous call.
- If the first consumer is served by pre-cut pieces, this plan is marked
  Rejected here instead of building general CSG.
