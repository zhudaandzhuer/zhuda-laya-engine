# Agent task: developer-tooling

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP15): three.js ships helpers that draw what a scene's lights, cameras,
bounds and bones are (`src/helpers`), a transform gizmo
(`TransformControls`), a statistics panel, GPU timestamps on WebGPU
(`TimestampQueryPool`) and the source lines of a shader that does not
compile on WebGL. The engine has LayaAir's line sprite and `Stat.show`
unexposed, a profiler that counts draws and times the GPU on WebGL only, and
shader excerpts on WebGPU only.

## Goal

A person or an agent looking at a scene that is wrong can see what is in
it: where its lights point and reach, what a camera sees, how big a thing
is, where its bones are, what the sun's shadow map covers, how many draws
and how many milliseconds of GPU a frame is on either backend, and which
line of which shader failed. And can move a thing by its axes.

## Invariants

- Nothing here runs unless asked for: no helper, counter or wrapper is
  installed by `ZhudaEngine.boot`, except the shader report, which only
  reads what a failed compile left behind.
- Every wrapper put on a browser object (a context's or an encoder's
  methods) is taken off again on disposal, and only if it is still the one
  that was put there.
- A helper owns its lines and material and releases them; it never changes
  the thing it shows. The gizmo changes only the node it was given, and
  only while it is dragged.
- GPU time is what the GPU measured or it is absent, with the reason: CPU
  time never stands in for it.
- The gizmo takes pointer positions from its caller: it listens to no DOM
  event itself and has no clock.

## Dependencies

- LayaAir 3.4.2: `PixelLineSprite3D`, `PixelLineMaterial`, `Stat.show`,
  the WebGL engine's context, `GPUCommandEncoder.beginRenderPass`.
- `ZhudaRuntimeProfiler` (`effects/EffectBudget.ts`), `Renderer.ts`,
  `Math3D.ts`, the model editor (`packages/compiler/model-editor-client.ts`).

## Scope

### Engine

- `runtime3d/ShaderErrors.ts` (new): one excerpt format for both backends;
  WebGL compile and link failures recorded in `context.renderer.errors`.
- `runtime3d/DebugDraw.ts` (new): axes, grid, box and bounds, light, camera
  frustum, skeleton, as lines that follow what they show; the spheres the
  sun's shadow cascades cover (the map itself is a comparison texture and
  cannot be shown as a picture on either backend).
- `runtime3d/DebugStats.ts` (new): LayaAir's statistics panel, shown and
  hidden.
- `effects/EffectBudget.ts`: draws and triangles counted on WebGPU; GPU
  time from timestamp queries on WebGPU.
- `runtime3d/TransformGizmo.ts` (new): move, turn and scale a node by its
  axes; in the model editor for the selected node. The model editor's
  camera is kept, so that its orbit and zoom work.
- `tests/developer-tooling.test.mjs`, `tests/fixtures/developer-tooling.ts`,
  `scripts/verify-developer-tooling.mjs`, `npm run verify:developer-tooling`,
  `docs/developer-tooling.md`.

### Consumer or adapter

A game decides when its debug drawing is on and what its pointer does.

## Non-goals

- Camera controls (the engine has `CameraRig`), a tweak panel, a node
  inspector.
- A gizmo in the film host: it has no pointer, an agent drives it.
- Per-pass GPU times, or GPU time of compute passes.
- Saving what the gizmo moved: the model editor inspects, it does not write.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. Unit: the excerpt format from both compilers' logs; the helpers'
   geometry; the profiler's WebGPU counting and timing; the gizmo's drag
   arithmetic.
3. Draw on WebGL and WebGPU: a sheet of every helper, the statistics
   panel, a shader that does not compile, the profiler's numbers against a
   known scene, the gizmo dragged along each axis.
4. The existing draws still pass on both backends.

## Unverified limits

See the verification record.
