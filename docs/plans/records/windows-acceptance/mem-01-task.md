# Agent task: windows-acceptance MEM-01, WebGPU objects kept after content is destroyed

Status: In progress\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), MEM-01 (report section 5): on the
report's Windows host, after warm-up, the JS heap after GC grew about
22 MiB per 3 000 create/destroy cycles on WebGPU (3.6 MiB on WebGL), 16 MiB
for 2D only and 6.3 MiB for 3D only, 167 MiB over a 30-minute churn against
0.7 MiB idle. Heap snapshots (30 → 3 030 cycles) showed `ShaderData`,
`SubUniformBuffer` and `OneBatchMark` up by 6 000 each and `BindGroup` by
9 726, retained through `gpuBufferMgr → SubUniformBuffer._observers →
ShaderData`, `bindGroupCache → BindGroup` and the batch renderer's
`_batchOpaqueMarks`. The report's own churn tool and snapshots are no
longer on the host; the cycle is rebuilt here.

## Goal

Live counts of the WebGPU objects that belong to destroyed content stop
growing with the number of create/destroy cycles, 2D and 3D, on WebGPU,
without clearing caches every frame, forcing GC or restarting the renderer.

## Invariants

- No per-frame cache clearing, forced GC, renderer restart or feature
  turned off as the fix.
- A vendor change goes through the existing LayaAir adapter layer
  (`packages/core/runtime3d/WebGPU342Adapters.ts`, as the other WebGPU
  fixes do) with its reason; vendor files keep their SHA.
- Drawing, resource borrowing and cancellation unchanged (existing draw
  checks pass on both backends).

## Scope

### Engine

- New churn fixture and check (`tests/fixtures/webgpu-churn.ts`,
  `scripts/verify-webgpu-churn.mjs`): one page, N cycles of create → draw
  one frame → destroy, 2D (sprite with graphics and text) and 3D (scene,
  camera, light, mesh with material); after each block, GC through CDP and
  live instances counted with `Runtime.queryObjects` for
  `WebGPUShaderData`, `WebGPUSubUniformBuffer`, `WebGPUBindGroup`,
  `OneBatchMark` and the JS heap.
- The fix, in the adapter layer, with a unit test where it can be tested
  without a GPU.

### Consumer or adapter

- None.

## Acceptance checks

1. Before the fix, on macOS WebGPU: the counts grow with cycles (reproduce,
   or record that they do not).
2. After: counts flat across blocks after warm-up on macOS WebGPU, on the
   Windows host's desktop session (Chrome, default GPU) and on the vivo V40
   (Chrome, `ZHUDA_PHONE_CHROME`); WebGL as comparison.
3. Existing draw checks on both backends and `npm run verify` pass.

## Unverified limits

- VRAM is not measured; process private memory only if read.
- The report's 30-minute churn is not repeated unless the short churn
  leaves a doubt.
