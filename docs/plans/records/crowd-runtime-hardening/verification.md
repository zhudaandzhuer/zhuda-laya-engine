# Verification: crowd-runtime-hardening / 1.8.0

Task: [task.md](task.md). Date: 2026-11-05. Baseline commit:
`70c7e000eb9f4eb8eda64d8093626e30da441bb3` (1.7.0).
Implementation commit: `222b29cf4922d960c534480cab2015aa2a65347f`.
The following documentation-only commit records this identity and final release evidence.

Decision: **Implemented; desktop verified. Target-platform acceptance Deferred.**
The runtime/toolchain changes have reproducible public-consumer and desktop
WebGL evidence. They do not certify the national-war game's content, 1080p
target PCs, mobile, Windows Native, Steam, or 2,000 concurrent connections.

## Environment and artifact identity

- Apple M4, 24 GiB unified memory; macOS 27.0.1 / build 26A434, Darwin 27.0.0.
- Google Chrome 156.0.8078.80, headless, actual ANGLE Metal Apple M4 renderer.
  Not SwiftShader. Viewport/backing 1280 × 720, DPR 1; no 1080p claim.
- Node 26.12.0. Public package 1.8.0; esbuild 0.27.1. Strict independent
  consumer uses `skipLibCheck:false`; ESM/CJS exports checked.
- Artifact root **E**:
  `/Users/yaowei/Desktop/zhuda-crowd-acceptance-20261105`.
  Media/model bytes remain outside the engine repository.
- Final-runtime 10-minute package: `E/long-run/zhuda-laya-engine-1.8.0.tgz`,
  SHA-256 `53a3f427b9dccf816962d8ae893d05318aade522d83f47427444dd48253bd22f`.
  Source/fixture hashes are in `E/long-run/evidence/identity.json`.
  The earlier 20-second matrix has its own identity and preserved extracted SDK
  at `E/consumer/node_modules/zhuda-laya-engine`; its original tarball path was
  subsequently reused. Do not associate its old tarball hash with that newer file.
- `E/runtime-parity.json` compares the measured long-run runtime, public types,
  vendor and built SDK with the final checkout. Documentation/MCP updates and a
  stronger quaternion evidence probe followed the long run; runtime did not change.

## Reproducible checks

Run commands from the repository root unless an external path is specified.
Set `CROWD_FIXTURE_DIR` to a fresh directory to preserve historical evidence.

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, typecheck, full declarations, Doctor, tests | `npm run verify` | PASS: 189 tests; 0 declaration diagnostics | `E/verify-final.log` |
| SDK installation | `npm pack`; `npm install --ignore-scripts` in external consumer | PASS | `E/pack.json`, `E/install.log`, `E/installed/` |
| Strict model consumer / exports | `node scripts/verify-crowd-browser.mjs` prepares packed independent consumer, public compiler build, strict types and ESM/CJS checks | PASS | Per-run `consumer/`, `evidence/identity.json` |
| Consumer Doctor | Installed `zhuda-laya-doctor --project E/final-check/consumer` | PASS: 2 TS files, 5 libraries, no violations | `E/consumer-doctor.log` |
| 20-second workload matrix | `CROWD_SECONDS=20 CROWD_FIXTURE_DIR=E node scripts/verify-crowd-browser.mjs` (historical scenario list in summary) | PASS: real draws and no browser errors | `E/evidence/summary.json`, per-case raw JSON/PNG |
| Final runtime selections, lifecycle, equipment | `CROWD_SECONDS=10 CROWD_SCENARIOS=selection-character,selection-equipment,selection-warning,selection-sparks,selection-ribbon,bare-25,equipped-100,unique-100 CROWD_FIXTURE_DIR=E/final-check node scripts/verify-crowd-browser.mjs` | PASS | `E/final-check/evidence/` |
| Long profile | `CROWD_SECONDS=600 CROWD_SCENARIOS=budget-100 CROWD_FIXTURE_DIR=E/long-run node scripts/verify-crowd-browser.mjs` | PASS: 600.1094 measured seconds, 36,008 retained samples, zero dropped samples | `E/long-run/evidence/budget-100.json` |
| Actual skeletal pose | `CROWD_SECONDS=3 CROWD_SCENARIOS=bare-25,budget-100 CROWD_FIXTURE_DIR=E/pose-check node scripts/verify-crowd-browser.mjs` | PASS: local joint quaternion rotates > .001 radians over 250 ms; timeline advances | `E/pose-check/evidence/*-25.json`, `budget-100.json` |
| Browser package parity | `npm run build:browser`; installed `zhuda-laya-browser-sdk --out E/installed-browser` | PASS: byte-identical manifests/files | `E/packed-browser-parity.json` |
| Browser runtime | Local and hosted 2D/3D draw, toggle state, 30 cycles, dispose; hosted cross-origin script + SRI and launch iframe | PASS, including both sandbox examples | `E/local-browser-release.json`, `E/hosted-browser-release.json` |
| Whitespace / local links / status | `git diff --check`; check changed Markdown file targets; `git status --short` | Recorded in final checks | `E/final-checks.json` |

The pose probe uses local **rotation**, not root motion or insignificant local
translation noise. Historical matrix/long-run reports used a weaker local-position
check; their timing data remains valid, and the separate stronger check verifies
the unchanged runtime. The harness now saves before/after quaternions and angle.

## Measured workloads

Cesium Man source: Khronos glTF Sample Assets revision
`4995a638c96dbc94376d3d6164e70fee3ac7f7a2`,
`Models/CesiumMan/glTF-Binary/CesiumMan.glb`, 438,044 bytes, SHA-256
`b7001eaeea8254bd44773bcd247e78696d94169388fbb2a1800fc69434e777d9`.
4,672 triangles, 19 joints, one locomotion clip; Cesium 2017 CC-BY-4.0,
separate logo trademark notice retained in `E/assets/`. No attack/death animation
or commercial battle-art acceptance is implied.

All times below are milliseconds. CPU is the measured `Stage.render` scope
(including native animation/update and draw submission); consumer callback cost
is separately recorded. Frame interval includes scheduling; it is not CPU work.
GPU values come from completed valid disjoint timer queries.

| Workload | Duration | Mean draws | CPU P50 / P95 | GPU P50 / P95 | Frame P95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 25 bare skinned characters | 20 s | 26 | 0.9 / 2.3 | 1.78 / 2.16 | 17.5 |
| 50 bare skinned characters | 20 s | 51 | 1.6 / 3.2 | 2.47 / 2.90 | 17.4 |
| 100 bare skinned characters | 20 s | 101 | 2.0 / 3.5 | 3.18 / 3.88 | 16.9 |
| 100 + equipment + full effects | 20 s | 311 | 2.6 / 3.7 | 3.44 / 3.80 | 17.5 |
| 100 + equipment + budget/LOD | 20 s | 230 | 1.8 / 3.4 | 3.51 / 3.96 | 17.3 |
| 100 + HTTP snapshot presentation | 20 s | 201 | 2.2 / 3.2 | 3.39 / 5.79 | 17.5 |
| 100 / 300 / 500 ordinary instances | 20 s each | 2 each | 0.6 / 1.1; 0.7 / 1.5; 0.8 / 1.7 | Raw report | 17.4–17.5 |
| 100 + equipment, shared materials | Final 10 s | 201 | 2.0 / 3.1 | 3.47 / 4.04 | 17.5 |
| 100 + equipment, independent materials | Final 10 s | 201 | 2.0 / 3.5 | 3.47 / 8.72 | 17.4 |
| 100 budget/LOD, long run | 600.109 s | 230 | 1.9 / 3.5 | 3.58 / 5.72 | 17.4 |

Long-run P99: frame 17.6, CPU 4.1, GPU 8.47. This is **not** a pass of a
P95 ≤ 16.7 ms acceptance requirement. Ordinary instancing includes one screen
composition draw; it does not demonstrate skinned GPU batching. Independent
materials did not increase draw count in this particular skinned workload.
Reduced effects lowered submissions, but these data do not show a GPU-time win.

The scene uses small models, one locomotion clip, simple equipment, DOM name/health
labels and procedural effects. It has no production terrain, shadows, attack
mixing, damage-number storm or full-screen battle overdraw. Camera placement and
projected actor size are visible in the screenshots and fixed in the fixture.

The 10-minute JS heap spans 26,374,055–56,077,266 bytes; first/last minute medians
36,650,288 / 40,629,384 bytes. The profiler retains all 36,008 sample objects.
These are raw Chrome JS-heap observations, not post-GC retained-size measurements
or proof of zero leaks. Native decoder/GPU/driver memory was not measured.
`inspectSceneResources` byte totals remain explicit estimates.

## Lifecycle, failure and visual evidence

- Models share one off-scene template/animation clip while retaining independent
  Animator state. The 30 complete library reloads maintain 126 counted resources
  in the loaded 25-character scene. Every temporary library ends at zero leases
  and instances. Final scene disposal leaves zero meshes and zero animation clips;
  global engine resources remain (20 total in this fixture).
- Unit regressions cover abort isolation, timeout, parsing failure, late result
  cleanup, owned component teardown, shared clip disposal, non-first default
  animation preservation, and partial independent-material clone failure.
- Matrix updates retain storage and reject invalid input atomically. Scheduler
  tests cover hysteresis, invisibility, fairness, bounded work, discarded visual
  time and single Animator owner/restoration. Snapshot tests cover sequence/epoch,
  stale teleport, loss, reconnect and entity removal.
- Particle tests cover actual reduced step count, bounded catch-up and dropped
  time. WebGL tests cover billboard/ribbon shrink, empty and growth. Empty initial
  meshes stay inactive. Critical-effect fallback is explicit when minimum budgets
  cannot fit; the consumer must implement the cheaper replacement.
- Profiler tests cover bounded rings, percentiles, unsupported/disjoint/context
  loss GPU queries, competing query ownership and disposal. A separate 2-second
  diagnostic Chrome trace is `E/evidence/bare-100-trace.json`; trace overhead is
  outside the performance sampling window.
- Branding regression checks fragment-only HTML: early UTF-8 declaration and
  valid document structure survive logo injection.

| Selection / state | Source | Reference, actual and comparison | Result |
| --- | --- | --- | --- |
| `cesium-character` / frozen pose | `character.ts` + pinned GLB | `E/final-check/evidence/selection-character-*` | PASS |
| `Equipment` / isolated mesh | Same recipe used on character hand | `selection-equipment-*` in same directory | PASS |
| `Warning` / ground marker | Same procedural definition | `selection-warning-*` | PASS |
| `neutral-sparks` / fixed seed | Same emitter spec and renderer | `selection-sparks-*` | PASS |
| `neutral-ribbon` / fixed inputs | Same ribbon definition | `selection-ribbon-*` | PASS |

Each selection is destroyed and rebuilt in a fresh page, compared against a
non-empty deterministic reference with >2 channel-value tolerance and <0.1%
changed pixels. Source hashes, model hash and selected state accompany the
comparison. These prove reproducibility, not art-director approval. The custom
model harness is not an official compiler `ZhudaPrefabLibrary` evidence report;
consumer games still require their own Prefab gate and approved references.

## Release and remaining acceptance

Browser SDK 1.8.0 was published through the existing static publishing API:

- [Launch](https://game.qianlongxundao.com/play/zhuda-engine-sdk/),
  [immutable release](https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/02b2dc8ba9dea9d1f1cd43a37226641c/).
- ZIP SHA-256 `a44039f29c410178fefac8ad6995ea3b27d98cf46a461300864f4e30f97c8209`; all eight hosted files
  exactly match local bytes. Correct JavaScript MIME, CORS and immutable caching
  verified in `E/hosted-http-validation.json`.
- Cross-origin + SRI and actual hosted sandbox 2D/3D examples passed state toggle,
  30 create/dispose cycles and final disposal without browser exceptions.
  `E/hosted-browser-release.json` and `hosted-sandbox-*.png` record results.
- Re-run via `SDK_RELEASE_URL=https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/02b2dc8ba9dea9d1f1cd43a37226641c/ node E/browser-release-check.mjs`.
  Initial launch checks mistakenly queried the transient main-process iframe
  context; the probe now attaches to the actual isolated iframe CDP target.
  The final rerun passes; no server sandbox policy was changed.
- Repository HTML examples now pin this URL and exact SRI. Previous 1.6.0/1.7.0
  hosted manifests still exactly match their local historical copies.
Old immutable 1.6.0/1.7.0 SDK releases remain available for pinned consumers.

Unavailable / not performed: specified i5/RTX3060 and GTX1650 PCs; physical
iOS/Android; 1080p crowd matrix; 10-minute **each-case** matrix; 30-minute
stability; native memory; attack/death and production artwork; Windows Native
packaging/Extension ABI; Steam launch/Overlay; production AOI/authority, real
100-player connections or 2,000 CCU. The HTTP snapshot fixture is local consumer
test transport with deterministic delay/loss/epoch changes, not an MMO backend.

Users can adopt the public capabilities via [crowd-runtime.md](../../../crowd-runtime.md)
and retain these limits in their own acceptance specification. Existing 1.7.0
audio/DPR/clock evidence keeps its previous scope; this release does not silently
upgrade those device results.
