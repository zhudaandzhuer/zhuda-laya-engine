# Agent task: a dynamic particle/ribbon mesh kept its first drawn index count

Status: Implemented; real draw on macOS, WebGPU and WebGL ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-20

## Source requirement

Found by a consumer (a ninja's flowing-blade skill, a `ZhudaRibbonPath3D`
swept along the sword): the white trail did not show on WebGPU. Its point
count grew from 2 to about 54 over the sweep, and the band drew one quad. The
CPU vertex and index data and the bounds were right, the submesh's
`_indexCount` read 318, and uploading the whole vertex buffer again changed
nothing. Submitting a constant 64 points every frame made the band draw, and
ribbons of a constant count were always right. The consumer works around it
by always submitting a fixed point count. The owner: fix it in the engine so
ribbons with changing point counts draw for every consumer.

## Cause

`DynamicParticleMesh3D.submit()` (`packages/core/particles/LayaParticleRenderer3D.ts`)
set a new count with `subMesh._setIndexRange(0, count)`. In LayaAir 3.4.2
that stores the range on the submesh only. What the draw call uses is the
geometry element's draw parameters (`setDrawElemenParams`, read by
`WebGPURenderGeometry.applyToEncoder` and by WebGL's `drawGeometryElement`),
and `SubMesh._updateRenderParams` copies the range into them. `MeshRenderer`
calls that only in `renderUpdate` while `_meshChange` is set, which only
assigning a mesh does. So the first drawn count stayed for good. This is not
WebGPU only: the check below shows the same on WebGL. The consumer saw it on
WebGPU because that is where it ran.

Affected: everything submitted through `DynamicParticleMesh3D` whose index
count changes between drawn frames: `ZhudaLayaRibbonRenderer3D` with
`ZhudaRibbonPath3D` or `ZhudaRibbonTrail3D`, and `ZhudaLayaParticleRenderer3D`
(a particle count that grows after its first draw). `ZhudaDynamicMesh` keeps
its indices and is not affected.

## Change

When the count changes, `submit()` also calls `subMesh._updateRenderParams(null)`
(it reads only the mesh's index format), which clears the element's draw
parameters and sets the new range. The render element holds that same geometry
element, so the next draw uses it on both backends. Still version-pinned to
LayaAir 3.4.2, like the buffer uploads around it.

## Invariants

- The vertex and index capacity stays the first allocation; only the live
  range is uploaded and drawn.
- No second draw path, cache or per-frame allocation.
- A static-count submission is unchanged (the range is set once).

## Non-goals

- Changing LayaAir's `MeshRenderer`.
- The consumer's workaround (a fixed point count): that is the consumer's to
  drop after re-pinning.

## Acceptance evidence

- `tests/particles3d.test.mjs`: the Laya fake now draws only what
  `_updateRenderParams` copies; a later, larger burst must reach the draw.
  Fails without the change.
- `npm run verify:ribbon-growth`: a real draw on WebGPU and WebGL of a ribbon
  that goes 3 → 54 → 10 → 40 points; the render element's drawn index count
  and the lit extent of the screenshot are compared with each step. Fails
  without the change on both backends.
