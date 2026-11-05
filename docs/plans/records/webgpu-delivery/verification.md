# Verification record: webgpu-delivery

Task: [task.md](task.md). Date: 2026-11-05. Package: 1.11.0.
Baseline: `ba0ebf2ba08741c2deb078483fc91df22b1e6ff8`.
Decision: **Implemented; macOS hardware verified; Windows/device acceptance open**.
Final release identity is recorded after immutable publication.

## Environment and evidence

macOS darwin 27.0.0, Chrome 156.0.8078.80, Apple Metal-3 hardware adapter
(`isFallbackAdapter:false`), Node 26.12.0. CDP emulated DPR 1/2/3 at 720×480;
consumer canvas 640×360 CSS px. Browser SDK matrix at DPR 2, 1100×1000.
No Windows GPU host or physical mobile device was used.

External evidence root: `/Users/yaowei/Desktop/zhuda-webgpu-acceptance-20261105/`.
Neutral authored geometry/text only; no customer art or game logic.

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Full build/types/Doctor/regressions | `npm run verify` | PASS, 216 tests; complete declarations clean | `verify.log` (copied from `/tmp/zhuda-webgpu-verify-final.log`) |
| Independent package | `WEBGPU_OUT=<root>/packed-dev5 node scripts/verify-webgpu-consumer.mjs` | PASS | `packed-dev5/evidence/identity.json`, `results.json`, `failures.json`, Doctor logs |
| Prefab isolation | Same script; Icon, Label, 2D root, Body, 3D root; WebGL/WebGPU × DPR 1/2/3 | PASS, 30 preview/Scene PNG pairs byte-identical within each backend | `packed-dev5/evidence/*.png` |
| Lifecycle/input | Same script; 30 cycles, mouse coordinates, resize, blur/focus, device.destroy, fresh-page recovery | PASS | `packed-dev5/evidence/results.json` |
| Failure paths | Missing GPU/adapter/compiler, timeout, pre-abort, cancellation with late device | PASS, no mounted late Scene, late device destroyed, no uncaught exception | `packed-dev5/evidence/failures.json` |
| Browser bundle | `WEBGPU_BROWSER_DIR=<release> WEBGPU_BROWSER_OUT=<root>/browser-final node scripts/verify-webgpu.mjs` | PASS | `browser-final/results.json`, PNGs |
| Shader and particles | `backend.shader+particles`, terrain surface recipe, sphere, 16 particles, seed 42, 0.1 seconds | PASS, real WebGPU draw, zero validation errors | `browser-final/3d-webgpu-shader-particles.png` |
| Model pipeline | Same browser script: glTF/Morph, raw/gameplay/cinematic, AO/Bloom/ACES, 30 reloads | PASS | `browser-final/3d-gltf-webgpu-*.png` and report |
| Windows hardware | `npm run verify:webgpu` on Windows Chrome/Edge | UNAVAILABLE | Reproducible entry documented in `docs/webgpu.md`; Windows CI is contracts only |
| Diff/status | `git diff --check`, `git status --short` | PASS before implementation commit | Git working tree |

## Bugs reproduced and repaired

1. Upstream catches glslang fetch failure and can continue with an empty compiler.
   The official loader now performs abortable SHA-verified fetches before native
   compiler initialization; boot rejects missing/malformed compiler data.
2. Stage.renderingEnabled alone still calls WebGPU startFrame after disposal.
   Realm retirement pauses native Render before unconfigure/device.destroy.
3. WebGPU's skipped cull frames can retain destroyed model render elements after
   asynchronous remove/reload. The pinned seam consumes pending structural changes
   at the actual cull frame, invalidating camera and light results. The initial
   30-model-cycle failure is retained in `browser-matrix-dev2`; the same case passes
   after the adapter fix. Unchanged scenes keep upstream cull reuse.

## Source and visual scope

Six vendor artifacts are unchanged and SHA-pinned. Four shader JS/WASM files
also match the official v3.4.2 source tree byte-for-byte. Laya IDE backend JS
artifacts have independent hashes; the source tag is not a reproducible-build
claim. Notices accompany package, consumer and browser distributions.

`tests/fixtures/webgpu/prefabs.ts` is the single definition used by official
preview and Scene. The external identity records its SHA and package SHA;
selection/provenance and reference/actual hashes are in each result. Composition
is captured separately. Cross-backend images are not asserted identical.
Browser shader/particle probes use named deterministic existing engine recipes;
no claim of arbitrary GLSL, Spine or consumer art acceptance follows.

## Limits

Windows hardware/driver, native EXE/Electron/WebView2/Steam, physical mobile,
Safari/Firefox, arbitrary Spine/plugins, long sessions and production performance
remain unverified. CDP DPR is emulation. Resource counts/bytes are estimates, not
GPU driver memory. The WebGL profiler's GPU timing is not a WebGPU measurement.

WebGPU initialization/disposal owns one realm. After device loss/disposal or a
partially initialized failure, recreate it. Existing RuntimeHost is the consumer
recovery entry; the measured recovery in this fixture is a fresh document.
No fallback is silently counted as WebGPU. Default WebGL behavior is retained.
