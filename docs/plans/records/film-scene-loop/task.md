# Agent task: film-scene-loop

Status: Implemented within scope; desktop WebGL verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-10

## Source requirement

The user asked to strengthen the engine's film-scene building with the agent
workflow of 67js (codepawl/67.js, MIT): an agent authors a scene as data,
changes it under revision checks, sees PNG previews, compares several shots in
one review image and renders stills and MP4 video. Phase 1 of four; look
presets, camera language and path tracing are later phases.

67js uses its own WebGL2 renderer, so its renderer code does not apply. This
task re-implements the workflow on the existing Laya-backed pipeline; no 67js
source is copied.

## Goal

An MCP client can create a film scene from JSON, apply atomic revisions, get a
preview image back in the tool result, review up to four labelled shots in one
image, and render a still or an MP4 into a configured output directory, all
through the public browser SDK and `ZhudaCinematicCapture`.

## Invariants

- No agent-written code runs: scenes are schema-checked data only.
- Every render goes through `ZhudaCinematicCapture` with a physical lens, so a
  preview, a review shot and a final frame share one deterministic path.
- A failed apply leaves the scene and its revision unchanged; a stale
  `expectedRevision` is rejected.
- Files are written only inside the configured output directory.
- The browser host binds to loopback, checks Host and is closed with the server.
- Procedural assets keep their existing contracts; scene props come from a
  registry, never from file paths in the recipe.

## Scope

### Engine

- `packages/core/film`: `ZhudaFilmScene` schema, validation, normalization,
  patches and camera-path sampling (pure); `mountZhudaFilmScene` (browser).
- `packages/compiler/chrome-host.mjs`: packaged headless Chrome launcher (the
  test fixture re-exports it).
- `packages/mcp-server/film-*.mjs`: session store and browser host; MCP tools
  `film_scene_create`, `film_scene_apply`, `film_scene_get`,
  `film_scene_preview`, `film_scene_review`, `film_render_job`; async tool calls
  and image content in the stdio server.
- Tests, a real-GPU verification script and documentation.

### Consumer or adapter

- None. A game's own scenes, props and art stay in its repository.

## Non-goals

Physical sky, fog volumes, look presets, spline camera paths, shot lists, path
tracing, audio in render jobs, glTF imports into film scenes.

## Acceptance checks

1. Schema validation rejects malformed scenes with a path for each problem.
2. Apply is atomic and revision-checked; a failed apply keeps the old scene.
3. Through the MCP stdio server: create, preview (PNG image block), apply,
   preview again (the image changes), review four labelled shots in one PNG.
4. A still job writes a PNG; two identical jobs give identical bytes.
5. A video job writes a playable MP4 with the requested frame count.
6. Output outside the configured directory and remote URLs are refused.
7. `npm run verify`, lint and format pass; existing browser batches still pass.

## Evidence to attach

Exact commands, preview/review/still images, MP4 probe output, protocol log.

## Result

See [verification.md](verification.md).
