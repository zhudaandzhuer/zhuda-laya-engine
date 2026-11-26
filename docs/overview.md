# Engine overview

A tour of what the engine adds to LayaAir 3.4.2, moved from the README as it was written. For
how to build something, start from a [route](routes/README.md); for one subsystem, find its guide
in the [documentation index](README.md); for what each release added, see the
[changelog](../CHANGELOG.md).

## Fast visual Prefab workflow

The [`examples/slot-symbol-prefab`](../examples/slot-symbol-prefab/) workbench is a
small, reusable 2D symbol route for artists: replace one logical image, run a
manifest update, and open the generated browser Prefab preview with the same
definition used by the Scene. It includes isolated `Art` and composite-state
evidence, a 30-cycle lifecycle gate, and a local image replacement control.
includes fixed URLs, SRI, 2D/3D HTML templates and sandbox limits. The existing
consumer/Prefab/device gates still apply to a complete game.

For artists who need to adjust a consumer-owned 2D `.lh` Prefab or `.ls` Scene, start the
engine's local Web editor with
`npx zhuda-prefab-editor --project /absolute/game --prefab assets/prefabs/item.lh`.
It uses the real Zhuda/Laya canvas, a named hierarchy, common 2D properties,
design-pixel dragging, undo/redo, revision-checked saves and a `.bak` backup.
The lower Assets workspace scans the consumer `assets/` tree, shows folders and
file cards with metadata, and opens `.lh`/`.ls` cards in the same editor so the
preview, hierarchy and Inspector always follow the selected source.
See [Web Static Asset Editor](prefab-editor.md). For the same workflow on a
consumer-owned self-contained `.glb`/`.gltf`, run
`npx zhuda-model-editor --project /absolute/game --asset assets/models/item.glb`.
The [3D Model Editor](model-editor.md) uses the public model library,
shows the live Sprite3D hierarchy and source inventory, and switches the same
instance between Raw, Gameplay and Cinematic presentation. It does not replace
a DCC authoring tool or turn importer support into device acceptance.

## SVG layout wireframes

Use [`zhuda-layout`](layout-wireframe.md) to mark any Scene or Prefab UI
with stable SVG rectangle IDs before implementing artwork. It generates a
source-hashed JSON layout contract, a self-contained responsive preview and an
optional consumer build gate. Model or OCR suggestions remain optional; the
reviewed SVG/JSON coordinates are the authority.

## Film scenes for agents

An agent builds a film scene as JSON (props, materials, sun and camera), changes it under revision checks, gets PNG previews and four-shot review grids back over MCP, and renders final stills or MP4 through the same cinematic capture. Start the server with `npx zhuda-laya-mcp --film-output ./films`. See [film scenes](film-scenes.md); the loop follows the agent workflow of [67js](https://github.com/codepawl/67.js), re-implemented on our renderer.

## Build a real consumer

Use the engine checkout for SDK work. Put a game in its own repository and
start from the canonical [consumer route](consumer-route.md):

```sh
# after npm install in this engine checkout
node packages/compiler/zhuda-init.mjs /absolute/path/to/my-game
cd /absolute/path/to/my-game
npm install
npm run verify
```

The starter pins this engine to a commit, creates `public/index.html` with the
`ZHUDA_LIBS` / `ZHUDA_ENTRY` markers, and creates `src/Main.ts` that imports
the public SDK and calls `ZhudaEngine.boot`. The consumer then owns its rules,
assets, prefabs, scenes and deployment. Read [AGENTS.md](../AGENTS.md) and the
[visual prefab workflow](prefab-workflow.md) before adding authored
visuals. A static pass does not establish real WebGL or device support.

Do not use a Three.js renderer, an inline `ZhudaEngine` facade, a copied
`packages/core`, or a deep engine import and call the result Zhuda-backed. The
consumer Doctor reports these cases with a file and line. Use the claim levels
in the [consumer route](consumer-route.md) when writing project reports.

## Explore the engine

### Particles and effects

Seeded 2D and 3D particles with pooling, ribbons, flipbooks, collision events, VFX materials, timelines, anchors and quality budgets. Presets and their art belong to the consuming project.

[Particle API and limits](../packages/core/particles/README.md) · [Effects API](../packages/core/effects/README.md)

### Terrain and shaders

Editable 2D tile maps and 3D heightfields, chunk streaming, LOD 1/2/4, closed sides/undersides and camera boom collision probes. PBR, textured, fog, dissolve and 2D tint/atlas variants are checked in real WebGL draws; sky materials can opt out of scene fog.

[Terrain and shader API](terrain-shader.md) · [Verification scope](3d-acceptance.md)

## What the fork adds

| Area                   | Public tools and behavior                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module loading         | `TopologyResolver` orders 29 runtime modules and selects the required features. The 2D light profile reduces the included library payload by about 83%.                                                                                                                                                                                          |
| CLI builds             | `zhuda-laya-build` uses esbuild and TypeScript AST scanning; it emits Web builds and ESM/CJS SDK bundles.                                                                                                                                                                                                                                        |
| Component registration | `@zhudaComponent` and the AST scanner register classes before prefab deserialization.                                                                                                                                                                                                                                                            |
| Runtime guards         | `EngineGuard` handles known 3.4.2 integration issues, including the `Graphics.setState` / `Button` failure.                                                                                                                                                                                                                                      |
| Typed construction     | `ZhudaEngine`, `Zhuda3D`, `ZhudaUI` and `ZhudaPrefab` provide code-first construction. Public types omit IDE-only declarations.                                                                                                                                                                                                                  |
| Agent integration      | The MCP server supplies API guardrails, dependency resolution, examples, diagnostics and asset/particle validators.                                                                                                                                                                                                                              |
| Visual migration       | Asset audits compare Spine 4.2 presentation data and require explicit mappings for Unity animation/material wrappers.                                                                                                                                                                                                                            |
| Visual state contracts | `SpineVisualContract` rejects incomplete fallback presentation; `VisualFocusContract` gives focus, empty selection and reset distinct meanings.                                                                                                                                                                                                  |
| Static assets and UI   | `.lh` / `.ls` serialization, explicit `percent:false`, pixel bounds and color comparison, nine-slice checks and safe-area fixtures.                                                                                                                                                                                                              |
| Effects                | Seeded 2D/3D particles, pooling, ribbons, flipbooks, collision events, VFX materials, timelines, anchors and quality budgets.                                                                                                                                                                                                                    |
| Runtime hardening      | Scaled/unscaled and layered clocks/timers, deferred scene mutations, explicit local/world/overlay render passes, defensive Graphics calls, bounded object pools, consumer-owned combat queries, action frame data and buffered input. See [runtime hardening](runtime-hardening.md) and [combat runtime contracts](combat-runtime.md). |

### 3D terrain, shaders and integration

The public 3D SDK adds independent consumer builds, resource leases, PBR/custom surfaces, dynamic meshes, camera/input/query contracts, clocks, 2D tile terrain and 3D heightfields with chunk streaming, editing and LOD 1/2/4.

`npm run verify` runs the full automated engine suite and prints the current test count (it is not fixed in this README). The existing integration has 41 real WebGL checks covering atlas UVs, tint, alpha, clipping, textured/fog/dissolve variants and compiler diagnostics. [Documentation](3d-integration.md), [terrain/shader contracts](terrain-shader.md) and [acceptance limits](3d-acceptance.md) describe that scope. Small-scene results do not establish full-game map or server performance.

The [filmic rendering API](filmic-rendering.md) adds native-lit procedural PBR hooks, UV-derived tangents, explicit normal-map conventions, offline GGX/SH HDR lighting, an HDR/AO/bloom/ACES/TAA camera pipeline and horizontal planar reflections. This is an initial quality slice, with further scene and asset work required.

### Asset source boundary

Consumer code addresses assets with stable logical IDs through `AssetProvider`. `DirectoryAssetProvider` is the current development and web default: it provides timeout, cancellation, bounded reads, manifest checksums and progress reporting. A future CDN-chunk, ZIP or Rust/WASM provider can implement the same contract without changing gameplay or scene code. See the [asset loading contract](asset-loading.md).

### Audio lifecycle

Embedded consumers use [`IframeSoundAdapter`](audio.md) as one WebAudio
authority. It bounds the pre-gesture queue, applies master/channel gain once,
checks bridge origins and disposes voices and listeners with the owner.
Consumers must not create a second `AudioContext` for an event.

### Platform adapters

[`NoSleepAdapter`](platform-adapters.md) is built into the SDK for native
Screen Wake Lock. FairyGUI stays consumer-owned: projects that need it install
their own compatible runtime and adapter.

Planned engine work is tracked in the [development plans](plans/README.md) directory. Plans are proposals until their measurements and acceptance gates pass.

## Migrate assets before gameplay

Build each visual component as a consumer-owned prefab. Verify its named
nodes against source references in an isolated preview, verify the assembled
panel, then mount that same definition in the scene. The
[prefab workflow](prefab-workflow.md) includes rules to adopt in a
consumer project. The [tooling roadmap](plans/prefab-toolchain.md)
distinguishes the current built-in examples from planned consumer tooling.

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
  "animations": [{ "sourcePath": "Art/BigWin_in.anim", "targetAnimation": "BigWin_in" }],
  "materials": [
    {
      "sourcePath": "Art/BigWin_Additive.mat",
      "targetMaterial": "SpineStandard",
      "blendMode": "additive"
    }
  ]
}
```

## Particles and effects

`ZhudaParticleSystem` / `ZhudaParticleSystem3D` provide deterministic fixed-step simulation, seeded replay, bounded pools, local/world space and distance emission. Laya renderers support textured particles, 3D billboards, historical ribbons and authored flows that reveal along a path.

Additional APIs cover VFX materials, camera pass budgets, flipbooks, plane collisions, event chains, effect timelines, 3D anchors and draw-call profiling. Game-specific effect recipes and artwork remain in consumer repositories.

[Particle API and limits](../packages/core/particles/README.md) · [Effects API](../packages/core/effects/README.md)
