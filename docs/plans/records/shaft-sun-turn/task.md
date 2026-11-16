# Task: light shafts that do not redraw for every step of a game's sun

Status: Implemented within scope; desktop WebGL and WebGPU verified; measured on one phone
Owner: engine
Last reviewed: 2026-11-16

## Source requirement

The user, 2026-11-16, after the foliage change: 「可以開始改，然後用 v40 去驗證」:
go ahead, and check it on the vivo V40.

On the V40 the consumer game (豬大時空3D, medium setting, WebGPU) ran at 11 to
12 frames a second whatever the foliage did (81 ms a frame with it, 80.6 ms
without). Taking parts of the look away on the phone (records in
`verification.md`) found about 40 ms a frame in the light shafts. Their step
count and size made no difference. Stopping the game's clock did: the frame
fell to about 45 ms.

The cause is the depth picture the shafts read: a whole scene drawn from the
sun. `ZhudaSceneLook` asks `ZhudaLightFog` to draw it only when something
moved (`setShaftRefresh('moved')`), but "moved" compared the sun's direction
exactly. A game whose day runs on its clock (this one: a day in 12 minutes,
the look re-applied every 0.12 s) turns the sun a little every few frames, so
the picture was drawn again nearly every frame. That extra scene draw is work
per object, not per pixel, which is why rendering smaller did not help. The
earlier half-size march (`half-size-shafts`) saved pixels that were not the
cost on this phone.

## Goal

- With the `moved` refresh, the depth picture is kept until the sun or moon
  has turned more than half a degree from the direction it was drawn from, or
  until the camera's box has moved on (as before).
- While a picture is kept, the light's camera and the projection the march
  reads stay on the direction the picture was drawn from, so the beams read the
  picture consistently. The brightness toward the sun (the phase) follows the
  live sun every frame.
- `always` (the default for `ZhudaLightFog` alone, and for film frames) is
  unchanged: a picture every frame from the live sun.

## Invariants

- No new option and no public API change; `ZhudaSceneLook` already chooses
  `moved` for games.
- A jump of the light (the moon taking over, a skipped hour, `setHour`) is
  larger than half a degree and draws a fresh picture at once.

## Dependencies

- `packages/core/runtime3d/LightFog.ts` (`update`, `renderShafts`).
- `ZhudaSceneLook.setLook` updates the look in place (the light fog is kept).

## Non-goals

- The cost of the picture itself (Laya's culling and draw submission per
  object), and the rest of the frame on phones: about 44 ms a frame of
  JavaScript on the V40 at the medium setting, mostly Laya's per-object
  culling for four shadow cascades and render-element preparation.
- Shadows of moving things in the beams under `moved` (unchanged: a game with
  still scenery).

## Acceptance checks

1. Unit test (fake Laya): a sun climbing 0.05 degrees a frame for 40 frames
   draws 4 pictures under `moved` and 40 under `always`; the projection stays
   while kept and changes when redrawn; the phase follows the live sun; a move
   to another box cell draws again from the sun of that moment.
2. Real draw, WebGL and WebGPU (`npm run verify:shaft-turn`): kept after 0.3
   degrees; a kept picture shows the same beams as a fresh one; a 3 degree
   climb in 60 frames draws about 6 pictures; a 10 degree turn draws a fresh
   one in which the shade line has dropped. The same check fails on the code
   before this change.
3. On the V40, in the consumer game built against this checkout: frame time
   and frames a second with the clock running.
4. `npm run verify`, lint, format and `git diff --check`.

## Unverified limits

- One phone (vivo V40, Chrome, WebGPU). No iPhone, no WebGL frame rate after
  the change.
- A redraw still costs what it cost (about 40 ms on the V40), now about once
  a second in this game (its sun turns about half a degree a second): an
  occasional long frame.
