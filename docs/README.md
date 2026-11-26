# Documentation

Three kinds of page, for three questions.

| You want to | Read |
| --- | --- |
| Build something: a game, a scene, a film, a model, a release | A **route**: [`routes/`](routes/README.md). One page per kind of thing, all in one format, each checked by building it. Start here. |
| Know how one subsystem works and what its API promises | A **guide**: the list below. |
| See what the engine adds to LayaAir at a glance | The [overview](overview.md); what each release added is in the [changelog](../CHANGELOG.md). |
| Change the engine | [`AGENTS.md`](../AGENTS.md), then [`HANDOFF.md`](../HANDOFF.md) and the [plans](plans/README.md). |

The reference games under [`games/`](../games/README.md) are the routes' worked examples: real
consumers of the engine in this checkout, rebuilt and tested by `npm run verify:games`.
The [prefab library](prefab-library.md) under [`prefabs/`](../prefabs/README.md) holds the modules
several games share; `npm run verify:prefabs` checks it against this checkout.

## Guides

### Building with the engine

- [Canonical consumer route](consumer-route.md)
- [Consumer build and browser evidence](consumer-tooling.md)
- [單一 HTML 的 Browser SDK 路線](browser-sdk.md)
- [Backend delivery: one page for WebGPU and WebGL](backend-delivery.md)
- [Official mini-game packaging without the IDE](minigame-packaging.md)
- [White-label, themes and presentation recovery](white-label-themes.md)
- [Developer tooling: what is in a scene, what it costs, what went wrong](developer-tooling.md)
- [Agent development guide](agent-development.md)
- [Release and version policy](release-policy.md)

### 2D, layout and prefabs

- [Layout, art text and video contracts](layout-and-media.md)
- [SVG layout wireframes](layout-wireframe.md)
- [遊戲視覺開發規則：先驗 Prefab，再組 Scene](prefab-workflow.md)
- [Zhuda Web Static Asset Editor](prefab-editor.md)
- [Primitive 3D Prefabs](procedural-prefabs.md)
- [The prefab library: shared modules a game copies in](prefab-library.md)

### 3D scenes and how they look

- [Quality route: a 3D scene that looks good](quality-route.md)
- [3D 消費專案接入與驗收契約](3d-integration.md)
- [3D 接入補強接收矩陣](3d-acceptance.md)
- [Film scenes for agents](film-scenes.md)
- [Filmic surfaces and HDR rendering](filmic-rendering.md)
- [Post quality: curves, colour tables, edges, occlusion, flare](post-quality.md)
- [Lighting depth: falloff, penumbra, shadow width, cascades, contact shadows](lighting-depth.md)
- [GPU depth: compute passes, wider shaders, surface pictures, object motion](gpu-depth.md)
- [HDR panoramas and the studio room](hdr-environment.md)
- [Stylized shading and the selection outline](stylized-shading.md)
- [Agent-friendly 2D／3D 地形與 Shader 契約](terrain-shader.md)
- [Grass](grass.md)
- [Many copies: instanced meshes and baked crowds](instanced-meshes.md)
- [Shader warm-up](shader-warm-up.md)
- [WebGPU delivery (1.11.0)](webgpu.md)

### Films and cameras

- [Deterministic presentation timelines](cinematics.md)
- [Fly-through benchmark and blind critic](flythrough.md)

### Models and characters

- [Blender / glTF / Laya model pipeline](model-pipeline.md)
- [Model compatibility, inspection and presentation (1.9.0)](model-showcase.md)
- [3D Model Editor](model-editor.md)
- [Model levels of detail](model-lod.md)
- [Animation control: mixing clips and bending bones](animation-control.md)
- [Spring bones](spring-bones.md)
- [Cloth](cloth.md)
- [VRM 1.0 avatars](vrm.md)
- [群體角色、特效預算與效能驗收（1.8.0）](crowd-runtime.md)

### Assets

- [Asset loading boundary](asset-loading.md)
- [KTX 2 / Basis textures](basis-textures.md)
- [Procedural assets](procedural-assets.md)

### Runtime

- [Combat runtime contracts](combat-runtime.md)
- [Walking: a walk grid, path finding and a character controller](walking.md)
- [Runtime hardening contracts](runtime-hardening.md)
- [Platform adapters](platform-adapters.md)
- [Audio contract](audio.md)

## Where the code is

| Path | What it holds |
| --- | --- |
| `packages/core/` | The SDK. `index.ts` is the public entry; `runtime3d/` is the runtime session, time layers, input, actions, models, cameras, look and most 3D features; `film/` is scenes as data; `procedural/` textures, props and synthesised sound; `particles/`, `effects/`, `terrain/`, `shaders/`, `audio/`, `csg/`, `simulation/`, `prefabs/` are what their names say. Files directly under `core/` are the 2D, layout, Spine, platform and audio adapters. |
| `packages/types/` | Public declarations, generated from `packages/core` by `npm run build`. Read these before using a helper. |
| `packages/compiler/` | Every command-line tool: build, init, Doctor, prefab and model editors, level-of-detail, mini-game packaging, the audits. |
| `packages/mcp-server/` | The MCP server and the film host: routes, guardrails, examples and validators for agents. |
| `packages/ci-gate/` | Sequence and film export checks. |
| `packages/demo/` | Legacy samples behind `zhuda-laya-engine/demo`. |
| `vendor/` | LayaAir 3.4.2 runtime libraries and the pinned third-party pieces, with their licences. |
| `src/`, `assets/` | The engine's own workbench app and its fixtures (`npm start`). Not a place for a game. |
| `examples/` | Small runnable hosts: browser SDK, model inspector, film capture, Windows WebGPU, a prefab workbench. |
| `games/` | The reference games and their recording tools. |
| `scripts/` | One `verify-*.mjs` per browser check, each behind an `npm run verify:<name>`; `lib/` is what they share. |
| `tests/` | Node tests: `npm test`. |

## Process records

[`plans/`](plans/README.md) holds the plan index, the task and verification templates every engine
change fills in, and under `plans/records/` one folder per finished task with what was done and how
it was checked. They are evidence for maintainers, not reading for someone building a game.

[Supporting the engine](SUPPORT.md).
