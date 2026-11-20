# Agent task: a scene drawn once before it is shown (`zhudaWarmUpByDrawing`)

Status: Implemented; real draw on macOS, WebGPU and WebGL; one consumer's prototype measured on a vivo V40 ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-20

## Source requirement

A consumer (a town of eleven figures, houses, a river with a mirror) on a
vivo V40 at its lightest setting: walking in right after loading gave frames
of 300 to 2500 ms, and the resolution governor pushed the picture down to
half; the same walk a second time held 60 FPS. A CPU profile of the worst
frame (469 ms near the town gate) was a shader compile
(`glsl450_to_spirv`) inside the water mirror's own draw. The owner asked
for the fix in the engine, for every game.

## Cause

Whatever is drawn for the first time compiles its shader for that mesh,
those defines and that pass; on WebGPU it also makes its render pipeline and
bind groups, and sends its buffers and textures. `zhudaWarmUpShaders`
covers the shader modules from a recorded list, but not the WebGPU
pipelines, nor a pass the list was not recorded with, and it needs a list
recorded per backend and device.

## Change

`packages/core/runtime3d/DrawWarmUp.ts` (exported from `runtime3d`):
`zhudaWarmUpByDrawing({ camera, eyes, directions?, fieldOfView?, beforeView?,
budgetMs?, signal?, onProgress?, draw?, wait?, now? })` draws the scene from
each eye the game names, four ways round a little down and once steeply
down (`ZHUDA_WARM_UP_DIRECTIONS`), with a 90° field of view, calling
`beforeView` before each view so the game can set its own things for that
eye (levels of detail, grass) and draw its own passes (a water mirror). It
gives the loading screen a frame after every `budgetMs` (default 50) of
drawing, stops between views when cancelled, and always puts the camera's
position, rotation and field of view back. `zhudaWarmUpViews` is the pure
list of views. At most `ZHUDA_WARM_UP_VIEW_LIMIT` (512) views.

## Invariants

- The camera is as it was after the warm-up, whether it ends, throws or is
  cancelled.
- No cache, list or file of its own: what it warms lives in LayaAir's own
  caches, as a first draw would leave it.
- No change to `zhudaWarmUpShaders`; the two can be used together (a list
  for changes of look level, drawing for the first sight of the scene).

## Non-goals

- Warming what no view sees (behind walls, past the far plane, switched off
  by the game): the game names its eyes and turns things on for the warm-up.
- The steady slowness of the first 20 s after loading the consumer also
  measured on the V40 (about 50 FPS in place of 60, gone after a 30 s wait,
  not changed by more warm-up rounds nor by turning the governor off): not
  explained yet, recorded in the verification.

## Acceptance evidence

- `tests/draw-warm-up.test.mjs`: views and their order, the camera put back
  after success, a throw and a cancel, slicing by budget, refusals.
- `npm run verify:shader-warm-up` (WebGL) and with
  `WARM_UP_RENDERER=webgpu`: mode `draw` draws the fixture scene from three
  eyes; its first frame compiles nothing, the camera is back, the picture
  is the cold one.
