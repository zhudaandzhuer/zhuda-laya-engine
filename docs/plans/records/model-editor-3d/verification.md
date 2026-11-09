# Verification record: 3D model editor

Task document: `docs/plans/records/model-editor-3d/task.md`  
Commit: working tree (not committed)  
Date: 2026-11-07

## Environment

- OS / browser: macOS, Chrome headless with `--enable-unsafe-swiftshader`
- Node: `v26.12.0`; npm workspace dependencies already installed
- Engine: working tree `zhuda-laya-engine` 1.14.0
- Viewports: 1280×900 CSS emulation at DPR 1 and 2
- Fixture: neutral `examples/model-inspector/asset.gltf`, copied to a temporary
  consumer `assets/models/` directory; no consumer artwork is stored here

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Bundle | `node -e "import('./packages/compiler/model-editor.mjs').then(async m=>console.log((await m.buildModelEditorBundle()).length))"` | PASS; public 3D client bundle generated | stdout, 1.7 MB bundle |
| Types | `npm run typecheck` | PASS | command output |
| Editor tests | `node --test tests/model-editor.test.mjs` | PASS; 3 tests | command output |
| Static safety | model editor tests with traversal and project asset checks | PASS | `tests/model-editor.test.mjs` |
| Real WebGL / DPR 1 | `npx chromeFixture` browser procedure; load, mode switch, hierarchy select, asset replace, dispose | PASS; renderer `webgl`, importer `supported`, 2 nodes, no browser exceptions | `/tmp/zhuda-model-editor-evidence.json`, `/tmp/zhuda-model-editor-dpr1.png` |
| Real WebGL / DPR 2 | Same procedure with `Emulation.setDeviceMetricsOverride(... deviceScaleFactor: 2)` | PASS; CSS/backing dimensions reported and no browser exceptions | `/tmp/zhuda-model-editor-evidence.json`, `/tmp/zhuda-model-editor-dpr2.png` |
| Full engine regression | `npm run verify` | PASS; 276 tests (including model-editor and dispatch coverage) | command output |

## Lifecycle and failure cases

- Model replacement uses `ZhudaAssetShowcase.load`, which cancels stale
  requests and disposes the previous instance through `ZhudaModelLibrary`.
- The browser procedure switched `probe.gltf` to `probe-copy.gltf`; the library
  ended with `instances: 1`, `references: 1`, and no console exceptions.
- `dispose()` ended with `instances: 0`, `references: 0`, and no console
  exceptions. `inspectSceneResources()` remains an estimate of the disposed
  Laya context and is not treated as a zero-GPU-memory certificate.
- The legacy `zhuda-prefab-editor --prefab assets/**/*.gltf` entry was started
  against the same fixture and printed the selected model route, proving the
  compatibility command dispatches to the 3D editor.

## 3D evidence

| Asset / selection / state | Source and dependency revisions | Isolated replay | Result |
| --- | --- | --- | --- |
| `assets/models/probe.gltf` / `$`, `$/0` / Raw → Gameplay → Cinematic | Neutral engine fixture; public `ZhudaModelLibrary`, `ZhudaAssetShowcase`, `ZhudaModelInspector`; pinned LayaAir 3.4.2 libs | `npx zhuda-model-editor --project <temp-consumer> --asset assets/models/probe.gltf --port 8893`; Chrome WebGL DPR 1/2 | PASS within fixture scope; same live mesh IDs survived mode switch |

## Limits and decision

Decision: **In progress**. The engine editor route and macOS WebGL fixture are
verified. The importer report is not full visual acceptance. Windows hardware
WebGPU, mobile WebGPU, large seller models, meshopt without its adapter, Draco,
KTX2, external URI rejection on real hosting, full PBR/reflection fidelity,
skeletal animation coverage and long-run memory remain unverified consumer
checks. `gpuReady` remains `requires-first-draw` by contract.

