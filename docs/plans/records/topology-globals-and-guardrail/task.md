# Agent task: topology-globals-and-guardrail

Status: Implemented within scope; unit tests and gates only (nothing to draw)\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

WP0 ("Housekeeping") of the three.js gap audit plan
(`docs/plans/records/threejs-gap-audit/plan.md` in the review worktree):

- `packages/core/TopologyGraph.ts` declares `providesGlobals`
  `Laya.TrailSprite3D` (module `trail3d`) and `Laya.IKConstraint` (module
  `ik`). Neither name exists in `vendor/laya-3.4.2/libs/laya.trail3D.js` or
  `laya.ik.js`. Correct them, and prove every `providesGlobals` entry against
  the lib that is supposed to define it, so that the table cannot drift again.
- The MCP guardrail `GUARD_SCENE_QUALITY_ROUTE` still lists point-light
  shadows as not built, while `docs/quality-route.md` and
  `packages/core/runtime3d/PointShadow.ts` now give eight shadowed point
  lights and a lamp that follows a model.

## Goal

Every `providesGlobals` entry of every module of both renderer tables names a
global that the module's own vendored file defines when it loads, a unit test
checks this from the files' text, and what the MCP server says about
point-light shadows (the guardrail and `get_quality_route`) matches the
engine and `docs/quality-route.md`.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- The module order, dependencies, conflicts and features of the topology
  table do not change; only the names it declares and the two file sizes that
  differ from the files.
- `EngineGuard.inspectEngineHealth().loadedGlobalModules` keeps its meaning:
  a module counts when every name it declares is present. A name that no lib
  defines made its module never count; a name that another lib defines made
  it count without being loaded.
- The MCP text claims only what the quality route document and its
  verification records already claim. Nothing is drawn by this task.

## Dependencies

- `ZHUDA_ENGINE_MODULES`, `TopologyResolver` (public, `packages/core/TopologyGraph.ts`).
- `typescript` (a runtime dependency) to parse the vendored libs as JavaScript.
- `ZHUDA_FILM_LIMITS.pointShadows` (`packages/core/film/FilmScene.ts`) and
  `ZHUDA_POINT_SHADOW_MAX_LIGHTS` (`packages/core/runtime3d/PointShadow.ts`).
- `docs/plans/records/render-gaps/verification.md`: where the point-shadow
  claims were drawn.

## Scope

### Engine

- `packages/core/TopologyGraph.ts`: `providesGlobals` and `sizeBytes`.
- `packages/mcp-server/corpus.mjs`: `GUARD_SCENE_QUALITY_ROUTE`.
- `packages/mcp-server/quality-route.mjs`: `limits.shadowCastingPointLights`
  and `evidence.rule`.
- New tests: `tests/topology-globals.test.mjs`,
  `tests/quality-route-guardrail.test.mjs`.

### Consumer or adapter

- None. A consumer reads the corrected names through
  `EngineGuard.inspectEngineHealth()` only.

## Non-goals

- `EngineGuard.checkSpine42()` in `packages/core/RuntimeGuards.ts` reads
  `Laya.Spine3DRenderNode`, which no lib defines either; the file is outside
  this package's scope (recorded under unverified limits).
- The fix text of the lint rule `lights.unshadowed`
  (`packages/core/film/FilmLint.ts`) still says up to four point lights may
  cast; outside this package's scope (recorded).
- Wrapping LayaAir's IK or trail runtimes, packaging `laya.vfx.js` or
  `laya.ui2.js` (not in the topology table).
- Any GPU check: nothing here draws.

## Acceptance checks

1. `node --test tests/topology-globals.test.mjs`: every entry of the 31
   modules of the WebGL table and the 33 of the WebGPU table is defined at
   the top level of the module's own file; each module has at least one entry that no other file
   of its table defines; every `sizeBytes` and the WebGPU support files match
   the files on disk; the old names (`Laya.TrailSprite3D`,
   `Laya.IKConstraint`, `Laya.PostProcess` for `laya.postProcess.js`) are
   reported missing, and a name assigned only inside a function or a class is
   not counted.
2. `node --test tests/quality-route-guardrail.test.mjs`: the guardrail and
   `get_quality_route` give eight shadow-casting point lights (the validator's
   and `ZhudaPointShadow`'s limit), name the lamp that follows a model, and no
   longer list point-light shadows as not built; the document says the same
   number.
3. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.

## Evidence to attach

- Test/build output: the gates above, recorded in `verification.md`.
- Browser/WebGL or device report: none; not visual.

## Unverified limits

- The health count is checked against the files' text, not by loading the
  libs in a browser and walking `globalThis`.
- The point-shadow claims repeated in the MCP text rest on the render-gaps
  verification record (desktop WebGL and WebGPU, Apple M4); this task did
  not draw them again.

## Rollback

Last known good commit: `9c91a26`. Reverting the commit restores the old
names; nothing else reads them except the health count.
