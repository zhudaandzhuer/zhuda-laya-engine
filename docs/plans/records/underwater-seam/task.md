# Agent task: underwater-underside-seam

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-21

## Source requirement

A consumer film (`ZhudaGameCenter/films/pelagic-grove`, not a git
repository) shot under clear water on `0a003e9` and found a level line across
the frame toward the horizon: lighter above it, darker below, following the
view's pitch and not the scenery, on WebGL and WebGPU. Its session wrote the
task this record follows, with seven isolating shots:
`films/pelagic-grove/ENGINE-TASK-underwater-seam.md` (2026-11-21). The owner
passed it on the same day ("另一邊遇到問題，你去看").

## Cause

As that document found: the surface seen from below is a plane of side twice
`maxDistance`, centred over the eye. Past its edge the frame showed what was
behind the water (the look's sky, or the camera's clear colour), dimmed by
`maxDistance` of water and no more. With the default extinction
(0.45, 0.12, 0.08 a metre) nothing survives 150 m and the edge cannot be
seen; with (0.02, 0.014, 0.012) an eighth of the blue does.

Two things the document did not have:

- The same held below the horizon, where no plane is: open water with
  nothing in it showed the sky through `maxDistance` of water.
- The camera's far plane cuts the plane as well: a camera whose range is
  `maxDistance` loses the surface at the same angle.

## Goal

In clear water a view toward the horizon is continuous from the surface down
through open water, whatever `maxDistance` and the camera's far plane are.

## Change

`packages/core/runtime3d/Underwater.ts`:

- **Something of the water's own stands behind everything.** With the
  surface drawn (`surface`, the default), a sphere round the eye, at 0.95 of
  the camera's far plane, on the layer of the plane
  (`ZHUDA_UNDERWATER_LAYER`): above level it shows the still surface by the
  plane's formula (the sky through the window, the water's colour where light
  is totally reflected); level and below, the water's own light at the eye's
  depth. It is opaque and writes depth, so the look's sky is not drawn over
  it, and things drawn without depth (additive beams, particles) lie on it as
  they lie on the plane.
- **The view** (the post effect): where nothing under water is in the way of
  a ray going up (nothing drawn at all, or what is drawn lies beyond the
  surface), the water between the eye and the surface is all of it, not
  `maxDistance` at most. A ray nearly level with the surface ends in the
  water's own light.
- `update(eye, target, fieldOfViewDeg, aspect, farMeters?)`: the camera's far
  plane. `ZhudaFilmStage` and `ZhudaSceneLook` pass it; left out, it is taken
  from the camera that draws the effect, a frame late.

A first attempt worked the surface out in the post effect wherever the plane
did not reach, replacing the frame's colour there. It removed the line in the
engine's own scene and left a step in the consumer's: its additive light
beams, which are not in the depth picture, were replaced with the rest.
Hence a backdrop that is drawn before them.

## Invariants

- Above the surface nothing changes (byte for byte; checked).
- The window at 48.6 degrees and the plane's waves are as before (the frame
  looking up is byte for byte the one before).
- With `surface: false` there is no plane and no backdrop, and the view is
  worked out as before.
- The backdrop is on `ZHUDA_UNDERWATER_LAYER` and casts no shadow; `dispose()`
  destroys its node, mesh and material.
- Public declarations follow (`packages/types/runtime3d/Underwater.d.ts`:
  `update`'s fifth parameter).

## Behaviour changes to note

- Clear water: the line is gone; open water below the horizon is the
  water's own light where it used to carry a share of the sky.
- Nothing is drawn in the last twentieth of the camera's range while the eye
  is under water.
- The engine's own underwater pictures change in the one or two rows where
  the floor's far edge meets open water (193 pixels of 129,600 in the
  example's main view): an edge pixel is mixed with the water now, not with
  the sky.

## Non-goals

- Sunbeams in open water (light gathered into shafts by the waves): the
  consumer's document lists it as a separate gap.
- Things beyond `maxDistance` are still seen through `maxDistance` of water:
  in clear water a far thing is plainer than it should be.
- The surface seen from above matching the one from below.
- A warning in the validator for clear water: not needed once it is drawn
  right.

## Acceptance checks

As the consumer's document lists them: see the [verification](verification.md).

## Rollback

`dcd667f` is the last commit without it. The consumer's way round it there:
`maxDistance` of 5.5 over the smallest extinction, and a camera range to match.
