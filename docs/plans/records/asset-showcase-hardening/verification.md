# Verification: asset-showcase-hardening / 1.9.0

Task: [task.md](task.md). Date: 2026-11-05.
Baseline: `2e92e5932cac9128f3e33309719a0e035af9ca5e` (1.8.0).
Implementation commit: `a4ef85b573dec77f1280440fb94642dff939d836`.
The following documentation-only commit records this implementation identity.

Decision: **Implemented; desktop verified. Seller/device acceptance Deferred.**
The three reproduced importer defects, compatibility/inspection APIs, same-model
presentation controller and HTML delivery are implemented. This is not universal
glTF conformance, Unreal parity or an offline movie pipeline.

## Environment and identity

- Node 26.12.0; macOS / Darwin 27.0.0; Chrome 156.0.8078.80 headless WebGL.
- Viewport 800 × 600; model CSS canvas 720 × 480; actual DPR 1 / 2 / 3.
  Backing canvas 720 × 480, 1440 × 960 and 2160 × 1440 respectively.
- Evidence root **E**: `<external-evidence>/zhuda-asset-showcase-acceptance-20261105`.
  Media remains external; checked-in glTF files are engine-authored neutral fixtures.
- Final measured consumer tarball: `E/release-final/zhuda-laya-engine-1.9.0.tgz`, SHA-256
  `5a08c87876d5639366aa5c50ce3f7bc63948b841e0c3586974c0e54ae1d24458`.
  `E/release-final/evidence/identity.json` contains fixture hashes and environment.
  Later edits affect documentation, hosted example URLs and acceptance scripts;
  final runtime/declaration parity is checked against this measured package
  (`E/runtime-parity.json`: 178 files match).

## Commands and results

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, strict types, full vendor declarations, Doctor, regression | `npm run verify` | PASS: 197 tests, 0 declaration diagnostics | `E/verify-final.log` |
| Independent packed consumer | `SHOWCASE_OUT=E/release-final node scripts/verify-model-showcase.mjs` (expand E to the absolute path above) | PASS: strict `skipLibCheck:false`, public compiler, ESM/CJS and real browser | `E/consumer-acceptance-final.log`, `E/release-final/consumer/` |
| Consumer Doctor | `node E/release-final/consumer/node_modules/zhuda-laya-engine/packages/compiler/zhuda-doctor.mjs --project E/release-final/consumer` | HEALTHY, 0 blockers | `E/consumer-doctor-final.log` |
| Official file validation | `gltf-validator@2.0.0-dev.3.10.validateString` on 10 checked-in glTF fixtures | 0 errors / 0 warnings; expected unused mesh defaults info | `E/validator.json` |
| MCP route | `node packages/mcp-server/index.mjs --tool search_api_guardrails --args '{"query":"showcase"}'` | Returns GUARD_MODEL_SHOWCASE | `E/mcp-showcase.json` |
| Browser packaging | `node packages/compiler/browser-sdk.mjs --out E/browser-1.9.0-final` | 2d / 3d / 3d-gltf, immutable output, SRI and input hashes | `E/browser-build-final.json` |
| Local browser delivery | `SDK_BROWSER_DIR=E/browser-1.9.0-final SDK_EVIDENCE_DIR=E/browser-evidence-final node scripts/verify-browser-sdk.mjs` | PASS all 3 profiles, controls and 30 reloads | `E/browser-local-final.log`, `E/browser-evidence-final/local-browser.json` |
| Hosted delivery | Same command plus SDK_RELEASE_URL below | PASS: 3 cross-origin/SRI + 3 real launch sandbox scenarios | `E/browser-hosted-final.log`, `E/browser-evidence-final/hosted-browser.json` |
| Hosted bytes | Fetch every payload-manifest file and compare SHA-256 | PASS: all 9 payload files match local release | `E/remote-integrity-final.json`, `E/*.final.headers` |
| Whitespace and links | `git diff --check`; changed Markdown local-target check | PASS | Final handoff |

## Native animation, failure and ownership evidence

`E/release-final/evidence/results.json` records all three DPR runs:

- 36 native sampled poses: LINEAR / STEP / CUBICSPLINE × ordinary / skinned mesh
  × normalized times .25 / .75 × DPR 1 / 2 / 3. Two morph targets and a mixed
  translation track retain 2-second clip duration. Cubic tangents include nonzero
  slopes and time scaling; expected Hermite values match within 1e-5.
- Node weights override mesh defaults. Two simultaneous clones retain independent
  `bend` weights (.3 vs 1). Inspector enumerates native clips, nodes and materials.
- Unsupported required extension rejects and retains the previous model. Explicit
  cancellation, 10ms deadline against delayed delivery, newer-request replacement
  and late-result discard are checked. Each DPR also rejects 30 malformed cubic
  imports after partial native tree creation without resource growth (90 total).
  Unit tests also cover disposal during a pending request, unavailable Filmic
  and opaque-input rejection.
- Mode switching preserves mesh and material IDs on the same instance. Final
  disposal restores the borrowed camera's opaque/HDR/MSAA/depth/postprocess state.
- 33 full reload + three-mode cycles at DPR 1: every cleared cycle has zero model
  cache entries, leases and instances. Native resource totals plateau after warmup:
  35 resources, 0 meshes, 0 animation clips, 5 materials, 12 textures and 17 pooled
  render targets. This is bounded native pooling, not a zero-GPU-memory claim.
  Memory fields are estimates, not driver memory measurements.
- No browser exceptions in the accepted runs. Context loss, physical device
  suspension and constrained-GPU/OS memory pressure were not newly exercised.

## Isolated visual evidence

The same model definition is mounted in all modes. Selection `Probe` remains
independently runnable; both rest and weighted states are replayed before
raw/gameplay/cinematic composition. Source hashes are in `identity.json`.

| Selection | Exact inputs | Reference / actual | Result |
| --- | --- | --- | --- |
| asset-probe / Probe | multi-cubicspline.gltf; authored weights; paused native Animator | `E/release-final/evidence/{1,2,3}-node-Probe-{reference,actual}.png` | Exact deterministic canvas replay |
| asset-probe / Probe weighted | same definition; bend = 1 | `E/release-final/evidence/{1,2,3}-node-Probe-state-weighted-{reference,actual}.png` | Exact replay; silhouette changes |
| Raw / Gameplay / Cinematic | same asset, camera and material; explicit presentation mode | `E/release-final/evidence/{1,2,3}-mode-{raw,gameplay,cinematic}-{reference,actual}.png` | Exact replay for each mode |

15 reference/actual pairs match. Pixel inspection confirms visible magenta geometry
and 13,036 / 52,177 / 117,375 changed pixels for weighted vs rest silhouettes at
DPR 1 / 2 / 3 (`E/release-final/evidence/pixel-check.json`). References are regression
baselines generated from this authored geometry, not seller or artistic approval.
The standalone browser inspector also supports animation, morph, local self-contained
model files, mode switches and 30 cycles. Screenshots and reports are under
`E/browser-evidence-final`.

## Release and limits

Fixed release:
`https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/c61d0a83b7094ff5055302d2f8235b8b/`

ZIP SHA-256: `85c3cba08a4a7b7f1b8b5b2ebcc9087c8bf72c24fb2e5d24630f7a8ff77e96e6`.
Old immutable releases remain available. `3d-gltf` adds glTF and postProcess;
basic 2d/3d topologies retain their existing boundaries.

No seller models / DCC / UE project were provided. Full material-extension visual
conformance, Khronos corpus, compressed geometry/textures, complex transparency,
hair/cloth/skin, studio HDR art, GI/reflection authoring, physical iOS/Android,
WebGPU/native platforms and offline movie/EXR/Path Tracer output remain unverified
or out of scope. Raw/Gameplay/Cinematic names do not remove these limits.
