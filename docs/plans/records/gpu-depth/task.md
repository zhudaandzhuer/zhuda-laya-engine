# Agent task: gpu-depth

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP16): three.js on WebGPU has compute passes and storage buffers
(`ComputeNode`, `StorageBufferNode`), uniforms of any type, a shared
function library, and per-object velocity for temporal anti-aliasing and
motion blur. LayaAir 3.4.2 has a compute shader, device buffers, a G-buffer
and motion vectors of its own, none of them reachable from the engine's
public API: custom shaders take five uniform types, every feature carries
its own noise, screen reflections guess a surface's normal from depth and
know nothing of its roughness, and a thing that moves is drawn into the
velocity picture as if it stood still.

## Goal

A game can run a step for a hundred thousand things on the GPU and draw
them without the numbers coming back to the CPU, with the same code on a
backend that has no compute; write a shader with an integer, a matrix, an
array or a cube map; use the engine's noise instead of pasting one; have
reflections that follow the surface's own normal and fade with its
roughness; and have a moving thing leave no trail under temporal
anti-aliasing.

## Invariants

- Vendor files are not modified. What LayaAir already has is used through
  its own objects; includes are changed as text before `Laya.init`, as for
  lighting, and compile to LayaAir's own code until switched on.
- A compute pass says which backend it runs on. Without WebGPU it runs its
  declared JavaScript step, or refuses with `COMPUTE_UNAVAILABLE` when none
  was declared: it never pretends.
- Every buffer, shader data and pass has an owner that releases it.
- A scene that asks for none of this draws as before.

## Dependencies

- LayaAir 3.4.2: `ComputeShader`, `ComputeCommandBuffer`, `DeviceBuffer`,
  `GBuffer`, `Camera.opaqueMRT`, `CameraTAA`, the motion vector includes.
- `ZhudaShaderMaterial`, `ZhudaInstancedMesh`, `ZhudaScreenReflections`,
  `ZhudaFilmicPipeline` (`temporalAA`).

## Scope

### Engine

- `runtime3d/ComputePass.ts` (new): `ZhudaComputePass` (buffers, uniforms,
  dispatch, read back, a JavaScript step for backends without compute) and
  `ZhudaComputedInstances` (one draw of copies whose places a pass writes).
- `shaders/ShaderMaterials.ts`: uniforms of type `int`, `mat4`,
  `textureCube`, and arrays of floats and vectors.
- `shaders/ZhudaCommon.ts` (new): the include `ZhudaCommon.glsl` (hash,
  value noise, fractal noise, triplanar weights and sampling) and the same
  arithmetic in JavaScript; `common: true` in a shader spec.
- `runtime3d/ScreenReflections.ts`: `surfaces: true` reads LayaAir's
  G-buffer (world normal, roughness) where a material writes it.
- `runtime3d/ObjectMotion.ts` (new): the place a moving thing was at the
  frame before, for the velocity picture.
- `tests/gpu-depth.test.mjs`, `tests/fixtures/gpu-depth.ts`,
  `scripts/verify-gpu-depth.mjs`, `npm run verify:gpu-depth`,
  `docs/gpu-depth.md`.

### Consumer or adapter

A game writes its own step and decides how many things it steps.

## Non-goals

- A node graph for shaders (the plan's "not worth closing").
- Compute on WebGL by transform feedback.
- Storage textures, indirect draws from a pass, render bundles.
- Previous-frame bone poses: a skinned thing's velocity is its node's.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. Unit: the spec checks, the generated compute source, the JavaScript
   step, the common functions against known values, the new uniform types.
3. Draw: a compute step for many particles on WebGPU against the same step
   in JavaScript, drawn without a read back; the same page on WebGL through
   the JavaScript step, and `COMPUTE_UNAVAILABLE` without one; every new
   uniform type and the common functions on both backends against the
   arithmetic; reflections with and without the G-buffer; a moving thing
   under temporal anti-aliasing with and without its velocity.
4. The existing draws still pass on both backends.

## Unverified limits

See the verification record.
