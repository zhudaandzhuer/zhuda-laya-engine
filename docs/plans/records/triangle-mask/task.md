# Task: hide triangles of a drawn mesh, and garments made so that nothing comes through

- Id: `triangle-mask`
- Asked by: the owner, 2026-11-25 ("keep improving until garments and objects without clipping can
  be made in number"), after [skin-binding](../skin-binding/task.md)
- Base: the unified branch at `59b2373`

## Why

The wardrobe's garments were the body's shapes grown by a few millimetres, and the body under them
was hidden a whole region at a time. Measured in 104 poses, the body or an inner part came through
in 14 of 26 pairs, up to 16 mm; most of the skin under a short sleeve or shorts was still drawn.
The engine had no way to stop drawing part of a mesh, so a consumer could not hide what a garment
covers except by cutting the body into ever smaller nodes.

## Change

Engine:

- `packages/core/runtime3d/TriangleMask.ts`: `setZhudaTriangleMask(node, mask, { order })`,
  `releaseZhudaTriangleMask`, `maskZhudaIndices`, and the helpers `createZhudaTriangleMask`,
  `hideZhudaTriangle`, `isZhudaTriangleHidden`, `countZhudaHiddenTriangles`,
  `unionZhudaTriangleMasks`, `encodeZhudaTriangleMask`, `decodeZhudaTriangleMask`. A masked
  triangle keeps its place in the index buffer with three corners the same. The first mask gives
  the node a copy of its mesh; a mesh with 32-bit indices is masked in place. A mask is in the
  file's order by default: LayaAir 3.4.2 holds each glTF primitive last index first, and the call
  turns it by sub-mesh.
- `docs/animation-control.md`: "Hiding what a part covers". `tests/triangle-mask.test.mjs`.

Consumer side (not engine API):

- `games/tools/characters/garment.mjs` (cloth from the body's distance field, loose volumes, closed
  edges, exact cover test), `clip-check.mjs` (skinning in Node, the pairing measure, cover masks),
  `raster.mjs` and `look-check.mjs` (the pixel measure), `islands.mjs`; `parts.mjs` gains
  `Regularize`, hair that follows the skin where it lies on it, and parts meshed alone that reach
  into the body.
- `games/zhuda-wardrobe`: a catalogue of 32 garments and objects (`tools/catalogue.mjs`), eight
  slots, masks and avoided pairs in the rules, both measures recorded and read by the tests.
- Routes `clip-free-garments` (new), `outfit-swap-3d`, `humanoid-from-shapes`.

## Not in this change

- The makers and the measures stay consumer tools tied to bodies made of the kit's shapes.
- No cloth simulation; no refitting to another body; no merging of a dressed character into one
  mesh; no packing of masks for a large catalogue.
- No change to how LayaAir loads a glTF file: the reversed order is turned in the call, not undone.
