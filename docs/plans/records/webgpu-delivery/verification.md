# Verification record: webgpu-delivery

Task: [task.md](task.md). Date: 2026-11-05. Package: 1.11.0.
Baseline: `ba0ebf2ba08741c2deb078483fc91df22b1e6ff8`.
Decision: **Implemented; macOS hardware verified; Windows/device acceptance open**.
Implementation commit: `418d93ad657e25b19917ca7a654df6b9b72c1a8f`.
Independent package SHA-256: `457933d89449026a33bfeebbe5e882f2aef824b835ca1bdab0f05a9318c13294`.
Hosted release: [`00b72197334c12e756e8c7e812c927fd`](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/00b72197334c12e756e8c7e812c927fd/).
ZIP SHA-256: `bea3d74df412b300c566348a7a009211ec19f220b254eabf1d70a1f1baedbb8d`.
The follow-up docs commit adds fixed URLs and this identity; runtime/bundle bytes
are those tested from the implementation commit.

## Environment and evidence

macOS darwin 27.0.0, Chrome 156.0.8078.80, Apple Metal-3 hardware adapter
(`isFallbackAdapter:false`), Node 26.12.0. CDP emulated DPR 1/2/3 at 720×480;
consumer canvas 640×360 CSS px. Browser SDK matrix at DPR 2, 1100×1000.
No Windows GPU host or physical mobile device was used.

External evidence root: `<external-evidence>/zhuda-webgpu-acceptance-20261105`.
Neutral authored geometry/text only; no customer art or game logic.

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Full build/types/Doctor/regressions | `npm run verify` | PASS, 216 tests; complete declarations clean | `verify.log` |
| Independent package | `WEBGPU_OUT=<root>/final node scripts/verify-webgpu-consumer.mjs` | PASS | `final/evidence/identity.json`, `results.json`, `failures.json`, Doctor logs |
| Prefab isolation | Same script; Icon, Label, 2D root, Body, 3D root; WebGL/WebGPU × DPR 1/2/3 | PASS, 30 preview/Scene PNG pairs byte-identical within each backend | `final/evidence/*.png` |
| Lifecycle/input | Same script; 30 cycles, mouse coordinates, resize, blur/focus, device.destroy, fresh-page recovery | PASS | `final/evidence/results.json` |
| Failure paths | Missing GPU/adapter/compiler, timeout, pre-abort, cancellation with late device | PASS, no mounted late Scene, late device destroyed, no uncaught exception | `final/evidence/failures.json` |
| Browser bundle | `WEBGPU_BROWSER_DIR=<root>/browser-1.11.0-release WEBGPU_BROWSER_OUT=<root>/browser-final node scripts/verify-webgpu.mjs` | PASS | `browser-final/results.json`, PNGs |
| Shader and particles | `backend.shader+particles`, terrain surface recipe, sphere, 16 particles, seed 42, 0.1 seconds | PASS, real WebGPU draw, zero validation errors | `browser-final/3d-webgpu-shader-particles.png` |
| Model pipeline | Same browser script: glTF/Morph, raw/gameplay/cinematic, AO/Bloom/ACES, 30 reloads | PASS | `browser-final/3d-gltf-webgpu-*.png` and report |
| Hosted payload | Download and hash all 16 immutable files; compare archive SHA response | PASS | `deployment.json`, `hosted-hashes.json` |
| Hosted cross-origin/SRI and sandbox | `SDK_BROWSER_DIR=<root>/browser-1.11.0 SDK_EVIDENCE_DIR=<root>/hosted SDK_RELEASE_URL=<fixed-release> node scripts/verify-browser-sdk.mjs` | PASS, 12 scenarios (six profiles × cross-origin/sandbox) | `hosted/hosted-browser.json`, PNGs |
| Hosted hardware GPU pipeline | `node scripts/verify-webgpu.mjs --url <fixed-release> --out <root>/hosted-gpu` | PASS, all three GPU profiles | `hosted-gpu/results.json`, shader/particle and model PNGs |
| Windows and Linux CI | [Repair run](https://github.com/zhudaandzhuer/zhuda-laya-engine/actions/runs/41995476456), commit `695c0580ecfb2631c71932603b398a70d50882bd` | PASS, both jobs | `ci-repair.json`, `ci-repair.log`, `ci-prefab-evidence/` |
| Windows hardware | `npm run verify:webgpu` on Windows Chrome/Edge | UNAVAILABLE | Reproducible entry documented in `docs/webgpu.md`; Windows CI is contracts only |
| Diff/status | `git diff --check`, `git status --short` | PASS before implementation commit | Git working tree |

## Cross-platform CI follow-up

The first [release CI run](https://github.com/zhudaandzhuer/zhuda-laya-engine/actions/runs/41994590337)
failed two checks. Windows Git checkout converted the pinned WebGPU JavaScript
from LF to CRLF, changing its bytes; `.gitattributes` now preserves upstream
artifacts verbatim and uses LF for source files. The existing Linux Prefab
comparison captured the default logo splash over the Scene while its reference
contained only the panel. That isolated fixture now explicitly sets
`branding.mode: "none"`; production branding defaults and comparison gates are
unchanged. Its package version follows the tested engine version.

Local follow-up checks pass: `npm run verify` (216 tests, `verify-ci-fix.log`) and
`PREFAB_FIXTURE_DIR=<root>/legacy-prefab-ci-fixed node scripts/verify-prefab-browser.mjs`
(`legacy-prefab-ci-fixed.log`, `legacy-prefab-ci-fixed/evidence/summary.json`).
This includes deliberate pixel/provenance/checksum/DPR failures and 30 resource
cycles. The failed CI log is retained as `ci-first-failure.log`. The repair run
at `695c0580ecfb2631c71932603b398a70d50882bd` passed both jobs: Windows build,
typecheck, complete declaration audit and all 14 selected tests; Linux full
verification and the complete browser Prefab comparison. The subsequent record
update changes documentation only. Windows hardware acceptance remains unavailable.

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
