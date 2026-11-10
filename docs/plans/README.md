# Development plans

This directory contains proposed work that is not part of the current public
runtime contract. A plan becomes an implementation only after its entry criteria,
device checks and acceptance gates pass.

## Statuses

- **Proposed** — a decision and measurement plan exists; no implementation is promised.
- **In progress** — the plan is actively being implemented; its acceptance scope is not yet complete.
- **Implemented within scope** — the documented implementation and stated environment checks passed; remaining device, product or follow-up work stays explicitly listed.
- **Accepted** — the implementation and the plan's acceptance evidence passed.
- **Deferred** — the work remains useful but is waiting for a dependency or decision.
- **Rejected** — measurements or constraints ruled out the approach.

## Planned work

| Plan | Status | Decision it prepares |
| --- | --- | --- |
| [Prefab isolation and consumer tooling](prefab-toolchain.md) | Implemented within scope | P0 consumer Prefab preview and evidence gate delivered; P1/P2 UI, lifecycle, media and device work remains |
| [Deferred asset packaging](asset-packaging.md) | Implemented within scope | Optional shared chunk delivery and embedded Meshopt adapter; production chunk split, Draco/KTX2 and mobile evidence remain pending |
| [Consumer delivery follow-ups](consumer-delivery-followups.md) | Implemented within scope | Sample/BGM audio, module-level dependency evidence and strict declaration audit are delivered; broader graph and device work remains |
| [WebGPU delivery](records/webgpu-delivery/task.md) | Implemented; desktop verified | Real backend, exclusive compiler/browser delivery, GPU lifecycle and Windows reproducible entry; Windows hardware unavailable |
| [White-label/theme foundation (historical pilot)](records/slot-factory-foundation/task.md) | Implemented; desktop verified | White-label, immutable themes, result presentation recovery and measured neutral 2D pilot; customer/native/device acceptance separate |
| [Asset showcase hardening](records/asset-showcase-hardening/task.md) | Implemented; desktop verified | Required glTF gates, Morph repairs, public inspector and same-instance presentation; seller/device limits explicit |
| [Crowd runtime hardening](records/crowd-runtime-hardening/task.md) | Implemented; desktop verified | Shared animation/model lifecycle, presentation LOD, VFX admission, GPU/raw profiler and independent skinned benchmark |
| [Consumer runtime feedback](records/runtime-feedback/task.md) | Implemented; desktop verified | DPR, streams, voice retirement, driver/recovery, backend seam and clean declarations; physical devices unavailable |
| [Browser SDK delivery](records/browser-sdk-delivery/task.md) | Implemented; desktop verified | Versioned browser bundles, SRI, hosted examples and cross-origin HTML; mobile unavailable |
| [Consumer integration feedback](records/lifecycle-feedback-hardening/task.md) | Implemented; desktop verified | Lifecycle completion, official candidate acceptance, component proofs and leased primitive resources; physical devices unavailable |
| [Cinematic production](cinematic-production/task.md) | Implemented; macOS verified | Synchronous native sampling, physical lens/shutter capture, shared offline audio and atomic MP4; scene-linear HDR and additional platforms remain separate |
| [Desktop and Agent gates](desktop-and-agent-gates/task.md) | Implemented; macOS verified | [Hardening and evidence](desktop-and-agent-gates/hardening-verification.md): packaged host, PNG sequence comparison, timeline/recorder and actual Meshopt; Windows hardware still pending |
| [Windows WebGPU feedback](records/windows-webgpu-feedback/task.md) | Implemented within scope; Windows hardware pending | Cross-platform Prefab cleanup/diagnostics, model complexity preflight and DCC axis contract; ReflectionProbe reproduction and Windows hardware remain unavailable |
| [Official mini-game CLI packaging](records/minigame-cli/task.md) | Implemented; macOS packaged | Official LayaAir 3.4.2 headless builds for registered mini-game targets; host/device and store evidence remain consumer-owned |
| [DPR CSS canvas sizing](records/dpr-css-canvas/task.md) | Implemented within scope | Keep responsive CSS coordinates separate from capped WebGL backing pixels |
| [Slot symbol Prefab example](records/slot-symbol-prefab/task.md) | Accepted; desktop WebGL verified | Reusable replace-art symbol Prefab, isolated browser preview, provenance and 30-cycle evidence |
| [SVG layout wireframes](records/layout-wireframe/task.md) | Accepted; CLI and consumer gate verified | Model-independent design-coordinate contracts, SVG overlays and self-contained layout preview |
| [Project asset workspace](records/asset-browser/task.md) | Implemented within scope; API and build verified | Unity/Laya-style asset folders and cards shared by the Web editor; browser/device visual acceptance remains consumer-owned |
| [3D model editor](records/model-editor-3d/task.md) | In progress; macOS WebGL verified | Public-provider GLB/glTF workspace with live Sprite3D hierarchy and same-instance presentation; Windows/mobile and seller-model acceptance remain pending |
| [Prefab editor responsive layout](records/prefab-editor-responsive/task.md) | Implemented within scope; desktop verified | Wrapping toolbar, scrollable narrow panels, full Agent canvas, container and height-driven fit with 37 browser checks |
| [Prefab editor Play preview](records/prefab-editor-play/task.md) | Implemented within scope; desktop verified | Disposable Edit/Play instances, public consumer controllers, interaction isolation and lifecycle cleanup |
| [Prefab editor coordinates](records/prefab-editor-coordinates/task.md) | Implemented within scope; 174 desktop checks | Retina container sizing, transformed selection/pivot, parent-local dragging and browser position assertions |
| [Disclosure hardening](records/disclosure-hardening/task.md) | Accepted within engine scope | Editor Host/Origin/capability defenses, working installed CLIs, strict generated types, truthful MCP/health, lean reproducible package and CI (Windows full tests pass) |
| [Procedural asset pipeline](records/procedural-pipeline/task.md) | Implemented within scope; desktop WebGL verified | CPU-baked seamless PBR recipes, geometry kit, props with colliders and per-material merging, synth audio and provider integration; WebGPU, mobile and art approval pending |
| [Film scene loop for agents](records/film-scene-loop/task.md) | Implemented within scope; desktop WebGL verified | Phase 1 of the 67js-style film workflow: JSON scenes with revisions, MCP previews, four-shot review grids, still and MP4 render jobs through the cinematic capture; shadows, sky, fog, splines and path tracing are later phases |
| [Film looks and packs](records/film-look/task.md) | Implemented within scope; desktop WebGL verified | Phase 2: time-of-day presets, native Laya shadows, procedural sky, fog, point/spot lights, emission and operator prop packs; fixes a capture race from phase 1 |
| [Preview runtime hardening](preview-runtime-hardening.md) | Accepted; desktop/browser verified | Foreign Laya realm guard, explicit 2D-only editor profile and release-hidden Scene/3D showcase policy; external device and foreign-app integration remain separate checks |

Slot-specific rules, RGS, math, wallet and Factory products are outside this
engine roadmap. Historical pilot documents retain their evidence; reusable
branding, theme and result-presentation APIs remain supported.

Use [TEMPLATE.md](TEMPLATE.md) for new decision plans. For an implementation
delegated to an agent, copy [TASK-TEMPLATE.md](TASK-TEMPLATE.md) and finish the
result with [VERIFICATION-TEMPLATE.md](VERIFICATION-TEMPLATE.md). Keep
game-specific art, rules and media in consumer repositories; this directory
describes engine and delivery contracts only.
