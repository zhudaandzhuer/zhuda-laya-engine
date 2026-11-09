# 3D Model Editor

`zhuda-model-editor` is the engine-provided browser workspace for a consumer's
self-contained `.glb` or `.gltf` asset. It complements the 2D `.lh`/`.ls`
editor; it does not pretend to be a DCC replacement or persist arbitrary 3D
scene edits.

Start it from the consumer project:

```sh
npx zhuda-model-editor \
  --project /absolute/path/to/game \
  --asset assets/models/rocket.glb \
  --host 127.0.0.1 \
  --port 8892
```

The existing `npx zhuda-prefab-editor --prefab ...` entry also dispatches to
this workspace when the selected extension is `.glb` or `.gltf`; the explicit
command above makes the 3D contract clear to agents and scripts.

The workspace uses the pinned LayaAir 3.4.2 WebGL 3D and glTF libraries. It
loads through the public `AssetProvider` and `ZhudaModelLibrary`, so a consumer
can later replace the directory provider with a verified CDN, ZIP or WASM
provider without changing the model or scene code.

This local editor deliberately uses the WebGL 3D libraries so that an agent can
open it without a GPU permission prompt. It does not claim a WebGPU preview.
For a WebGPU model acceptance run, use the consumer route or the `3d-gltf-webgpu`
Browser SDK profile with `renderer: 'webgpu'`; that path must report the actual
WebGPU adapter and must fail when the browser falls back or has no adapter.

The left panel shows the live `Sprite3D` hierarchy. The center is the real Laya
canvas: drag to orbit, scroll to zoom, and switch Raw, Gameplay or Cinematic
presentation. Those modes reuse the same `ModelInstance`. The Inspector reports
the importer status, source inventory, selected mesh/material/morph data,
animation clips, renderer, DPR, canvas backing size, cache state and native
resource snapshot. `Isolate selected` changes preview visibility only. `COPY`
copies the complete JSON report for an agent or review.

The lower asset workspace reads the consumer `assets/` directory. Selecting
another `.glb`/`.gltf` uses the same page and replaces the current request with
the existing cancellation, timeout, cache lease and disposal contracts. The
editor never copies consumer models into this repository and never writes model
bytes.

## What the editor proves

- The model is delivered through a logical ID and the provider manifest.
- The shipped importer can parse the bytes and the native Laya 3D runtime can
  instantiate and draw them in the current browser.
- The same instance can use the engine's three presentation modes.
- The selected hierarchy and source inventory are inspectable and repeatable.

## What remains a consumer acceptance check

`status: supported` is only the importer capability gate. It does not certify
seller-model fidelity, all PBR extensions, reflection probes, movie output,
Windows hardware WebGPU, mobile WebGPU, long-run memory, Draco/KTX2, meshopt
without its decoder adapter, or external URI dependencies. Follow
[`model-pipeline.md`](model-pipeline.md) and [`3d-acceptance.md`](3d-acceptance.md)
for those checks. A model's `gpuReady` report remains
`requires-first-draw`; the editor records the browser draw environment rather
than converting that limit into a pass.

