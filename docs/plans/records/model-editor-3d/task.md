# 3D model editor and stability boundary

Status: In progress  
Owner: Codex  
Last reviewed: 2026-11-07

## Source requirement

User request: 「還有哪些不穩定的？另外還要3D。」 The existing Web Static Asset Editor
supports 2D `.lh`/`.ls` only, while the engine already exposes the public
`Zhuda3D`, `ZhudaModelLibrary`, `ZhudaAssetShowcase` and `ZhudaModelInspector`
contracts.

## Goal

Provide a reusable engine-owned Web 3D asset editor entry that loads a consumer
GLB/glTF through `AssetProvider`, displays the real Laya 3D runtime, exposes the
model hierarchy and compatibility/resource information, and switches the same
instance between Raw, Gameplay and Cinematic presentation modes.

## Invariants

- 2D `.lh`/`.ls` editing and its existing save gate remain unchanged.
- Model bytes use a logical asset ID and the existing provider/cache/release lifecycle.
- No Three.js renderer, inline engine facade, consumer game asset, or deep engine import.
- A successful importer report is not reported as full visual or device acceptance.
- Cancellation, timeout, stale replacement and disposal release the previous model.

## Dependencies

- Public runtime3d APIs in `packages/core/runtime3d` and `packages/types/runtime3d`.
- Pinned LayaAir 3.4.2 libraries: core, WebGL 2D/3D, d3, gltf and postProcess.
- Existing asset scan/static project route in `prefab-editor-server.mjs`.

## Scope

### Engine

- `packages/compiler/model-editor.mjs`
- `packages/compiler/model-editor-client.ts`
- package bin and model-editor documentation/tests.

### Consumer or adapter

- Consumer project supplies `assets/**/*.glb` or self-contained `.gltf` and its
  manifest; no production model is added to the engine repository.

## Non-goals

- Persisting arbitrary 3D transform edits or replacing a DCC scene editor.
- Certifying seller-model quality, complete PBR parity, Windows hardware,
  mobile WebGPU, Draco/KTX2 or every skeletal animation feature.

## Acceptance checks

1. `npx zhuda-model-editor --project <consumer> --asset assets/models/item.glb`
   serves a responsive three-pane editor with a real WebGL Laya canvas.
2. A self-contained model loads through `ZhudaModelLibrary`, and the same live
   instance switches Raw/Gameplay/Cinematic without a second renderer or cache.
3. Hierarchy selection, model inventory, material/animation counts, compatibility
   status, cache report and copyable JSON are visible; selecting another model
   replaces the old request safely.
4. Asset cards show `.glb`/`.gltf` files and open the 3D editor route.
5. Existing `npm run verify`, editor tests and TypeScript build pass.

## Evidence to attach

- Test/build output: `npm run verify`, model editor unit/build test.
- Browser/WebGL: local model editor load, mode switch, asset switch and dispose.
- Resource/lifecycle: model library report before/after replacement and pagehide.

## Unverified limits

- Windows hardware WebGPU and iPhone/Android long-run evidence remain consumer
  acceptance work.
- `gpuReady` remains `requires-first-draw`; source inventory does not predict GPU
  upload time. Meshopt still needs its decoder adapter and external URIs are rejected.

## Rollback

Remove the model-editor bin/files and revert this record; the existing 2D editor
continues to be the fallback for `.lh`/`.ls` assets.
