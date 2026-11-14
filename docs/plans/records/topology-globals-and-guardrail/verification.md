# Verification record: topology-globals-and-guardrail

Task document: `docs/plans/records/topology-globals-and-guardrail/task.md`\
Commit: the commit that adds this file, on top of `9c91a26`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4. No browser: nothing in this
  task draws.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9c91a26`. No consumer.
- DPR, viewport and network mode: not applicable; no network.
- Evidence: the terminal output of the commands below; no pictures (none
  were made, none are needed).

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 538 of 538 (10 new: 6 in `tests/topology-globals.test.mjs`, 4 in `tests/quality-route-guardrail.test.mjs`) | terminal log |
| Lint | `npm run lint` | PASS | terminal log |
| Format | `npm run format:check` | PASS | terminal log |
| Whitespace | `git diff --check` | PASS | terminal log |
| The new drift test against the old table | a scratch copy of `tests/topology-globals.test.mjs` importing `git show 9c91a26:packages/core/TopologyGraph.ts` | FAIL as intended: 14 modules on each renderer table named globals their file does not define, `trail-common` named none of its own, two sizes differed; the other three tests pass | terminal log |
| The new guardrail test against the old MCP text | `tests/quality-route-guardrail.test.mjs` with the three `packages/mcp-server` files at `9c91a26` (restored afterwards, byte for byte) | FAIL as intended in 3 of 4: the route's limit was 0, and the guardrail listed point-light shadows as not built | terminal log |
| Real WebGL/device | not run | UNAVAILABLE by design: no GPU-side change | none |

### How the libs are read

Each vendored lib is parsed as JavaScript with the `typescript` package. What
counts as defined is what is assigned while the script loads: at its top
level, and inside a wrapper function called where it is written (LayaAir's
`!function(e,t){...}(window.Laya=window.Laya||{},Laya)`, the core's
`window.Laya=function(e){...;return ...,e}({})`, Spine's
`(function(spine){...})(spine||(spine={}))`), with each wrapper parameter
mapped to the global its argument stands for. Functions, methods, class
bodies and callbacks are not entered: they run later, if at all. A parameter
declared again in its wrapper is a local from there on. `window.` in a
`providesGlobals` entry is the global object, as `EngineGuard` walks it.

The test also checks, for each renderer table:

- every module names at least one global that no other file of the table
  defines, leaving out modules that may not share a page with it (the Spine
  3.8 and 4.2 cores both define `spine.AnimationState`);
- every `sizeBytes` equals the file's size, and the WebGPU support files
  (`shader_compiler_web.wasm`, `nagabind_bg.wasm`) add exactly what the
  resolver adds for them.

Failing paths covered: the old names `Laya.TrailSprite3D` and
`Laya.IKConstraint` are reported missing beside the real exports;
`Laya.PostProcess` is defined, but by `laya.d3.js`, and is reported missing
for `laya.postProcess.js`; `window.box2d` is not `window.Box2D`. A synthetic
script shows that assignments in a method, a static method, a function, a
callback, a wrapper whose argument is not a global, and a wrapper that
re-declares its parameter are not counted, and that `var x;` alone defines
nothing.

### What changed in the table

| Module | Before | Now | Why |
| --- | --- | --- | --- |
| `webgl2d` | `Laya.WebGLRenderEngineFactory` | `Laya.WebGLRenderDeviceFactory` | no such export; the device factory is what the file exports (WebGPU: `Laya.WebGPURenderDeviceFactory`) |
| `webgl3d` | `Laya.WebGL3DRenderPass` | `Laya.WebGL3DRenderPassFactory` | no such export (WebGPU: `Laya.WebGPU3DRenderPassFactory`) |
| `box2d` | `window.box2d` | `window.Box2D` | the file sets `window["Box2D"]` |
| `bullet` | `Laya.Physics3D` | `window.Physics3D`, `Laya.btPhysicsCreateUtil` | the file sets `window.Physics3D`, not a `Laya` member |
| `spine-core-42`, `spine-core-38` | `sizeBytes` 466015, 138800 | 466315, 138813 | the vendored files' sizes |
| `spine3d` | `Laya.Spine3DRenderNode` | `Laya.Spine3DRenderer` | no such export |
| `navmesh-common` | `Laya.RecastNavigation` | `window.Recast`, `Laya.BaseNavMesh` | no such export |
| `navmesh3d` | `Laya.NavMesh3D` | `Laya.NavMesh`, `Laya.NavAgent` | no such export |
| `particle2d` | `Laya.Particle2D` | `Laya.ShurikenParticle2DRenderer` | no such export |
| `trail-common` | `Laya.TrailFilter` | `Laya.TrailBaseFilter`, `Laya.TrailShaderCommon` | `TrailFilter` is exported by `laya.trail3D.js` |
| `trail3d` | `Laya.TrailSprite3D` | `Laya.TrailRenderer`, `Laya.TrailFilter` | no such export |
| `light2d` | `Laya.Light2DRender` | `Laya.BaseLight2D`, `Laya.LightOccluder2D` | no such export |
| `gltf` | `Laya.glTFLoader` | `Laya.glTFResource` | no such export |
| `ik` | `Laya.IKConstraint` | `Laya.IK_Comp` | no such export; `IK_Comp` is the registered component |
| `postProcess` | `Laya.PostProcess`, `Laya.BloomEffect` | `Laya.BloomEffect`, `Laya.MaterialPostProcessEffect` | `PostProcess` is exported by `laya.d3.js`; `MaterialPostProcessEffect` is what `ZhudaPointShadow` needs from this file |

Every other entry was already right. Order, dependencies, conflicts and
features are unchanged. `tests/disclosure-contracts.test.mjs` still counts
one loaded module for a stubbed core (the health count's own test).

### What the MCP server says about lamps' shadows

| Where | Before | Now |
| --- | --- | --- |
| `GUARD_SCENE_QUALITY_ROUTE.reason` | "Desktop WebGL evidence only; not built yet: real-time GI, reflections on walls, point-light shadows" | up to eight point lights and one spot light cast; more than four share their texture at half the sharpness; a lamp that follows a model casts from where the model carried it; drawn on desktop WebGL and WebGPU; not built: real-time GI, reflections of things off screen, more than eight point lights or a second spot light |
| `GUARD_SCENE_QUALITY_ROUTE.zhudaCanonicalApi` | no lamp | `new ZhudaPointShadow(scene3D, { lights })`, `shadow.render(position, range, index)` again after a move; film `{ kind: 'point', castsShadow: true }` with `follows: { node }` |
| `GUARD_SCENE_QUALITY_ROUTE.hallucinatedLegacyApi` | | `shadowMode` on a Laya point light (3.4.2 draws no point-light shadow) |
| `GUARD_SCENE_QUALITY_ROUTE.topic` | | adds "point light lamp" and 燈, so a search for lamps finds it |
| `get_quality_route` `limits.shadowCastingPointLights` | 0 | `ZHUDA_FILM_LIMITS.pointShadows` (8) |
| `get_quality_route` `evidence.rule` | "Desktop WebGL frames only. WebGPU ... need their own records" | the document's sentence: desktop WebGL, and the same checks on desktop WebGPU through `npm run verify:film-webgpu` (Apple M4) |
| `film_scene_create` description | "one spot light and up to four point lights with castsShadow" | up to eight |

`tests/quality-route-guardrail.test.mjs` ties these to the code: the
validator's `ZHUDA_FILM_LIMITS.pointShadows` equals
`ZHUDA_POINT_SHADOW_MAX_LIGHTS` (8), the route's limit equals both, the
document states the same number in its steps and limits, and no text of the
guardrails, the route or the film tool manifest gives a smaller "up to"
count or lists point-light shadows as not built. The old sentences are
caught by the same check.

The facts repeated here were not drawn again. They come from
`docs/quality-route.md` and the render-gaps verification record
(`verify:film-point-shadow` with eight lamps and `verify:film-animation` step
4b, PASS on desktop WebGL and WebGPU, Apple M4).

## Limits and decision

- The globals are checked from the files' text. No browser loaded the libs
  and walked `globalThis`, so an export removed at run time (none is known)
  would not be seen.
- `EngineGuard.inspectEngineHealth().loadedGlobalModules` still counts
  `spine` and `spine38` (one file) and both Spine cores together in a Spine
  realm: their names cannot tell them apart. Unchanged by this task.
- Not changed, outside this package's files: `EngineGuard.checkSpine42()`
  (`packages/core/RuntimeGuards.ts`) reads `Laya.Spine3DRenderNode`, which no
  lib defines (its `|| SpineTemplet` makes `layaSpine3DReady` true whenever
  the 2D adapter is loaded); the fix text of the lint rule
  `lights.unshadowed` (`packages/core/film/FilmLint.ts`) and a comment in
  `packages/core/film/FilmStage.ts` still say up to four point lights.
- Modules not in the table (`laya.ui2.js`, `laya.vfx.js`, `laya.bridge.js`,
  `laya.native-spine42.js`) are not checked.

Decision: **Implemented within scope.** Unit tests and every gate pass; no
GPU or device check applies.
