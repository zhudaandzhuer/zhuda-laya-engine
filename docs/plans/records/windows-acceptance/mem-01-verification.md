# Verification record: windows-acceptance MEM-01

Task document: `docs/plans/records/windows-acceptance/mem-01-task.md`\
Commits: `bd03844` (the churn check, before the fixes), `1e098b7` (the
fixes)\
Date: 2026-11-17

## What was found

`npm run verify:webgpu-churn` makes, draws one frame of and destroys 2D
panels (a sprite with graphics and a label) and small 3D scenes (camera,
light, a box and a sphere with their own materials), in blocks, and counts
live LayaAir renderer objects after a collection. Heap snapshots taken
between blocks and walked back from the objects that kept growing gave the
owners:

| Kept per cycle (before)                                                                       | Kept by                                                                                                                                                                   | Repair (engine adapters)                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2D: 2 `WebGPUShaderData`, 2 `WebGPUSubUniformBuffer`                                          | `Sprite._shaderData` is never destroyed (neither `Sprite.destroy` nor its render struct does it); on WebGPU its uniform block from `gpuBufferMgr` keeps it as an observer | `Sprite.destroy` destroys it after its own teardown (WebGPU)                                                                            |
| 3D: 8 `WebGPUBindGroup` (2D: 1)                                                               | `bindGroupCache` keeps every group made; 960 of 962 were invalid after 120 cycles                                                                                         | invalid groups dropped when the cache has doubled since the last sweep (WebGPU)                                                         |
| `WebGPUGlobalPipeLineCacheInfo`, `OneDrawPassCacheInfo`, `OneDrawCacheInfo`, their `Vector2`s | pass keys built from scene and camera data ids: the render context's map and every long-lived (pooled) render element's `_passRenderInfo`                                 | `installLaya342PassCacheBounds`: keys unused for 600 frames dropped, an element drops what its context no longer has (WebGPU and WebGL) |
| per-material `Vector2` flags                                                                  | static `WebGPURenderElement3D._matChangeFlagMap`                                                                                                                          | a destroyed shader data's entry removed (WebGPU)                                                                                        |

The report's `OneBatchMark` growth was not reproduced: this fixture's
meshes do not batch. `_batchOpaqueMarks` is keyed the same way (material
and geometry ids) and is still unbounded; recorded as open.

## Results

Settings: 300 cycles a block (200 on the phone), 6 blocks, 300 to 400
warm-up cycles. KiB a cycle is the rise of the lowest heap of the later
blocks over the lowest of the earlier ones; the check fails above 1.5 KiB
or when a counted class keeps rising.

| Device, browser, backend                                                         | Before (`bd03844`)                                   | After (`1e098b7`)      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| macOS, Apple M4, Chrome, WebGPU (Metal)                                          | 2D 5.3, 3D 4.8 KiB; classes +2/+2/+1 and +8          | 2D 0.05, 3D 0.19; PASS |
| macOS, Chrome, WebGL (ANGLE Metal)                                               | 3D rising steadily 14.38 → 15.71 MiB in 1 800 cycles | 2D 0.08, 3D 0.24; PASS |
| Windows host, Intel UHD 770, Chrome 157, WebGPU, desktop session, standard token | 2D 4.99, 3D 4.29; FAIL (7)                           | 2D 0.04, 3D 0.18; PASS |
| same, WebGL (ANGLE D3D11)                                                        | 2D 0.08, 3D 0.78 (passes the 1.5 limit, rising)      | 2D 0.08, 3D 0.25; PASS |
| vivo V40, Adreno 720, Chrome 157 Android, WebGPU                                 | 2D 5.09, 3D 4.19; FAIL (7)                           | 2D 0.22, 3D 0.28; PASS |
| vivo V40, WebGL (ANGLE GLES 3.2)                                                 | not run                                              | 2D 0.13, 3D 0.38; PASS |

The Windows numbers match the report's: 2D on WebGPU about 15 MiB per 3 000
cycles before (report 16 MiB), WebGL 3D about 2.3 MiB per 3 000 (report 3.6).

Evidence: macOS and phone reports in the session scratch folder; Windows
`D:\claude-workstation\zhuda-windows-batch1\out\churn-{base,fixed}-{webgpu,webgl}\report.json`.

## Other checks

| Check                                                                                                                                    | Result                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` (macOS)                                                                                                                 | PASS 874/874, including `tests/render-cache-bounds.test.mjs` (each repair without a GPU)                                                                    |
| `verify:geometry` WebGL and WebGPU, `verify:lit-surface`, `verify:prefab-browser`, `verify:next-round`, `verify:webgpu-consumer` (macOS) | PASS                                                                                                                                                        |
| `verify:film-remount` (macOS)                                                                                                            | FAIL, 1 265 stray green pixels on every mount, **also at `bd03844` without the fixes**: a failure already on `main`, not from MEM-01; left for its own task |

The `verify:film-remount` failure came from `45f8664` and is fixed and
recorded in `docs/plans/records/scene-uniform-order/`.

## Limits and decision

- No run on the RTX 3060: Chrome picked the Intel adapter by default.
- VRAM and process private memory were not measured; JS heap and live
  objects only. The report's 30-minute churn was not repeated.
- `_batchOpaqueMarks` (batched meshes) not exercised here; exercised and bounded on
  2026-11-17 ([engine defects](../engine-defects/verification.md)).
- The remaining 0.2 to 0.4 KiB a cycle levels off in the series; code
  compiled by V8 during the run is part of it.

Decision: **Implemented within scope**, verified on macOS, the report's
Windows host and the vivo V40, both backends.
