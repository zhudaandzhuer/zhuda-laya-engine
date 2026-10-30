<a href="#support-this-engine"><img src="docs/assets/sponsor-pass.svg" alt="Support Zhuda — fund the next frame. SOL and USDC on Solana." width="1280" /></a>

## Support this engine

Help an independent developer keep building open-source game tools. Your support goes toward engine work, documentation and testing on real devices.

**SOL / USDC · Network: Solana** — scan the card above or copy this wallet address:

```text
E4ZEhFCYy4b5pYXJUbMC9KjRitkypyqtZvpSRerLWHCb
```

[View wallet on Solscan](https://solscan.io/account/E4ZEhFCYy4b5pYXJUbMC9KjRitkypyqtZvpSRerLWHCb) · [Open QR code](docs/assets/solana-qr.png) · [About supporting Zhuda](docs/SUPPORT.md)

---

# Play the skyline.

English · [简体中文](docs/zh-CN/README.md)

[![NEON APEX: drift, boost and race above a neon skyline. Actual 3D gameplay.](https://raw.githubusercontent.com/zhudaandzhuer/zhuda-neon-racer/main/docs/media/skyline-gameplay.gif)](https://zhudaandzhuer.github.io/zhuda-neon-racer/)

### NEON APEX · Skyline Tour

**Drift. Boost. Own the skyline.** Race three rivals on elevated city circuits, chain nitro out of corners, and earn your next car. A playable 3D game with four circuits, a garage and saved progress.

**[PLAY FREE →](https://zhudaandzhuer.github.io/zhuda-neon-racer/)** · [Watch the gameplay film](https://zhudaandzhuer.github.io/zhuda-neon-racer/showcase.html)

Keyboard and touch controls. No download or account. The animation above is captured from the actual game; the film is available at 1280 × 720 / 60 FPS.

---

# zhuda-laya-engine

**An agent-friendly game SDK and toolchain built on LayaAir 3.4.2.**

[![LayaAir 3.4.2](https://img.shields.io/badge/LayaAir-3.4.2-0ea5e9)](https://github.com/layabox/LayaAir) [![MIT](https://img.shields.io/badge/license-MIT-4ade80)](LICENSE) [![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-6cc24a)](package.json) [![Support on Solana](https://img.shields.io/badge/Support-Solana-9945ff)](#support-this-engine)

Build 2D, 3D and Spine 4.2 projects with TypeScript, a CLI and coding agents. This fork adds dependency ordering, component registration, public SDK types, visual migration checks and an MCP server to the upstream engine. The shipped workflows run without the LayaAir IDE.

Maintained by [Zhuda](https://github.com/zhudaandzhuer). Rendering and physics come from [LayaAir / Layabox](https://layaair.com/). This is an independent fork; donations support Zhuda's work on this repository.

[Play Neon Apex](https://zhudaandzhuer.github.io/zhuda-neon-racer/) · [Explore 100 particle effects](https://zhudaandzhuer.github.io/zhuda-particle-lab/) · [Try the 3D terrain lab](https://zhudaandzhuer.github.io/zhuda-3d-lab/?terrain=1)

## More games

Four more arcade games, each with keyboard/touch input, levels, a win/loss state and saved progress.

| Game | Play |
| --- | --- |
| STARFALL · space combat | [Launch](https://zhudaandzhuer.github.io/zhuda-arcade/?game=starfall) |
| EMBERBOUND · arena survival | [Enter](https://zhudaandzhuer.github.io/zhuda-arcade/?game=ember) |
| COREKEEP · tower defense | [Defend](https://zhudaandzhuer.github.io/zhuda-arcade/?game=corekeep) |
| TIDEBREAK · arcade rebounds | [Dive in](https://zhudaandzhuer.github.io/zhuda-arcade/?game=tidebreak) |

Game rules, art, media and deployment live in separate consumer repositories: [Neon Apex](https://github.com/zhudaandzhuer/zhuda-neon-racer) and [Arcade](https://github.com/zhudaandzhuer/zhuda-arcade). [Racing verification](https://github.com/zhudaandzhuer/zhuda-neon-racer/blob/main/docs/browser-verification.json) covers a complete live race, progress, touch input and bounded scene resources.

## Explore the engine

### 100 particle effects

[![Racing airflow, magic and explosions, rendered in WebGL](https://raw.githubusercontent.com/zhudaandzhuer/zhuda-particle-lab/main/docs/media/showcase-preview.gif)](https://zhudaandzhuer.github.io/zhuda-particle-lab/showcase.html)

91 2D and 9 true 3D effects: body-wrapping racing airflow, magic, explosions, weather, water and UI feedback.

[Try the effects](https://zhudaandzhuer.github.io/zhuda-particle-lab/) · [Watch the 60 FPS film](https://zhudaandzhuer.github.io/zhuda-particle-lab/showcase.html) · [Verification](https://github.com/zhudaandzhuer/zhuda-particle-lab/blob/main/VERIFICATION-100.md)

### Terrain and shaders

[![Terrain above and below: closed sides, underside and camera collision](https://raw.githubusercontent.com/zhudaandzhuer/zhuda-3d-lab/main/docs/terrain-solid.jpg)](https://zhudaandzhuer.github.io/zhuda-3d-lab/?terrain=1)

Editable 2D tile maps and 3D heightfields, chunk streaming, LOD 1/2/4, closed sides/undersides and camera boom collision probes. The inspector includes an explicit underground view. PBR, textured, fog, dissolve and 2D tint/atlas variants are checked in real WebGL draws; sky materials can opt out of scene fog.

[Open the terrain / shader lab](https://zhudaandzhuer.github.io/zhuda-3d-lab/?terrain=1) · [Terrain and shader API](docs/terrain-shader.md) · [Verification scope](docs/3d-acceptance.md)

## What the fork adds

| Area | Public tools and behavior |
| --- | --- |
| Module loading | `TopologyResolver` orders 29 runtime modules and selects the required features. The 2D light profile reduces the included library payload by about 83%. |
| CLI builds | `zhuda-laya-build` uses esbuild and TypeScript AST scanning; it emits Web builds and ESM/CJS SDK bundles. |
| Component registration | `@zhudaComponent` and the AST scanner register classes before prefab deserialization. |
| Runtime guards | `EngineGuard` handles known 3.4.2 integration issues, including the `Graphics.setState` / `Button` failure. |
| Typed construction | `ZhudaEngine`, `Zhuda3D`, `ZhudaUI` and `ZhudaPrefab` provide code-first construction. Public types omit IDE-only declarations. |
| Agent integration | The MCP server supplies API guardrails, dependency resolution, examples, diagnostics and asset/particle validators. |
| Visual migration | Asset audits compare Spine 4.2 presentation data and require explicit mappings for Unity animation/material wrappers. |
| Visual state contracts | `SpineVisualContract` rejects incomplete fallback presentation; `VisualFocusContract` gives focus, empty selection and reset distinct meanings. |
| Static assets and UI | `.lh` / `.ls` serialization, explicit `percent:false`, pixel bounds and color comparison, nine-slice checks and safe-area fixtures. |
| Effects | Seeded 2D/3D particles, pooling, ribbons, flipbooks, collision events, VFX materials, timelines, anchors and quality budgets. |

### 3D terrain, shaders and integration

The public 3D SDK adds independent consumer builds, resource leases, PBR/custom surfaces, dynamic meshes, camera/input/query contracts, clocks, 2D tile terrain and 3D heightfields with chunk streaming, editing and LOD 1/2/4.

The integration passes 81 engine tests and 41 real WebGL checks. Shader checks exercise atlas UVs, tint, alpha, clipping, textured/fog/dissolve variants and actual compiler diagnostics. [Documentation](docs/3d-integration.md), [terrain/shader contracts](docs/terrain-shader.md) and [acceptance limits](docs/3d-acceptance.md) describe the tested scope. The [independent consumer](https://github.com/zhudaandzhuer/zhuda-3d-lab) pins a specific engine commit and stores its device reports. Small-scene results do not establish full-game map or server performance.

## Quick start

Requires Node.js 24 or newer.

```sh
git clone https://github.com/zhudaandzhuer/zhuda-laya-engine.git
cd zhuda-laya-engine
npm install
npm run verify
npm start
```

Open `http://localhost:8890/` for the local workbench.

```ts
import { ZhudaEngine, Zhuda3D } from 'zhuda-laya-engine';

const { rootScene } = await ZhudaEngine.boot({
  width: 1280,
  height: 720,
  features: ['core', '3d'],
});
const scene = Zhuda3D.createScene3D(rootScene);
Zhuda3D.createCamera(scene, {
  position: [0, 4, 8],
  rotationEuler: [-25, 0, 0],
});
Zhuda3D.createDirectionalLight(scene);

const cube = new Laya.MeshSprite3D(
  Zhuda3D.createPrimitiveMesh('box', { width: 1.5, height: 1.5, depth: 1.5 }),
);
cube.meshRenderer.sharedMaterial = Zhuda3D.createMaterial({
  albedoColor: [0.2, 0.7, 1, 1],
  shininess: 48,
});
scene.addChild(cube);
```

Consumer projects must load the selected Laya runtime modules before booting the SDK. Use the compiler's dependency ordering rather than mixing engine generations. Clone this repository to work on the SDK; use a packaged build or a pinned Git commit in consumer projects.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Generate the demo build and SDK bundles |
| `npm run typecheck` | Check public/runtime types and application sources |
| `npm run doctor` | Check module order, registration and known legacy API usage |
| `npm test` | Run Node unit and integration tests |
| `npm run verify` | Run build, typecheck, doctor and tests |
| `npm run pack:tarball` | Create an installable package in `dist/` |

## Connect a coding agent

Add the bundled MCP server to your client configuration:

```json
{
  "mcpServers": {
    "zhuda-laya-engine": {
      "command": "node",
      "args": ["/absolute/path/to/zhuda-laya-engine/packages/mcp-server/index.mjs"]
    }
  }
}
```

The same tools can run directly from the terminal:

```sh
node packages/mcp-server/index.mjs --tool resolve_topology --args '{"features":["3d","spine42"]}'
node packages/mcp-server/index.mjs --tool get_golden_example --args '{"id":"boot-declarative-3d"}'
```

Use the guardrails and validators before generating a scene. Schema validation checks data contracts; successful rendering and shader compilation require an actual WebGL draw.

## Migrate assets before gameplay

Inventory the source assets first, map their presentation requirements, validate them in isolation, then connect existing game rules.

```sh
node packages/compiler/visual-asset-audit.mjs \
  --source /absolute/path/to/unity/Assets/Game \
  --target /absolute/path/to/consumer/assets \
  --strict \
  --report /absolute/path/to/consumer/dist/visual-migration.json

node packages/compiler/visual-contract-audit.mjs \
  --project /absolute/path/to/consumer
```

The asset audit checks Spine animations, skins, bones, slots, constraints, atlases and textures. Unknown shader mappings are blocked rather than silently replaced. Unity `.anim`, `.controller` and `.mat` wrappers need explicit target contracts; the converter does not promise compatibility with arbitrary Unity code.

A consumer's `visual-presentation-manifest.json` describes source/target presentation, scope, runtime states, non-focused targets and restoration. Declaring `visualContract` in `zhuda.config.json` makes these requirements part of the build gate.

```ts
import { VisualFocusContract } from 'zhuda-laya-engine';

VisualFocusContract.apply(targets, VisualFocusContract.focus(winningIds));
VisualFocusContract.apply(targets, VisualFocusContract.clear());
```

Explicit mappings can be saved in `visual-migration-manifest.json`:

```json
{
  "schemaVersion": 1,
  "animations": [
    { "sourcePath": "Art/BigWin_in.anim", "targetAnimation": "BigWin_in" }
  ],
  "materials": [
    { "sourcePath": "Art/BigWin_Additive.mat", "targetMaterial": "SpineStandard", "blendMode": "additive" }
  ]
}
```

## Particles and effects

`ZhudaParticleSystem` / `ZhudaParticleSystem3D` provide deterministic fixed-step simulation, seeded replay, bounded pools, local/world space and distance emission. Laya renderers support textured particles, 3D billboards, historical ribbons and authored flows that reveal along a path.

Additional APIs cover VFX materials, camera pass budgets, flipbooks, plane collisions, event chains, effect timelines, 3D anchors and draw-call profiling. Game-specific effect recipes and artwork remain in consumer repositories.

[Particle API and limits](packages/core/particles/README.md) · [Effects API](packages/core/effects/README.md)

## Repository map

```text
packages/core/          SDK, effects, particles and engine adapters
packages/compiler/      CLI builds, AST registration and visual audits
packages/mcp-server/    Agent tools, API guardrails and examples
packages/types/         Public and vendor runtime declarations
packages/ci-gate/       Browser first-frame checks and reports
vendor/laya-3.4.2/      Upstream runtime libraries
assets/                 Generic fixtures and serialized prefabs
src/                    Engine workbench and isolated asset preview
docs/                   Project documentation, support assets and translations
tests/                  Unit, integration and public-type checks
```

## License and upstream credit

[MIT](LICENSE). LayaAir is developed by [Layabox](https://github.com/layabox/LayaAir); visit [layaair.com](https://layaair.com/) for the upstream engine. This repository adds tooling and integration work maintained by [Zhuda](https://github.com/zhudaandzhuer).

If the engine saves you time, [support the next build](#support-this-engine). Thank you for keeping it open.
