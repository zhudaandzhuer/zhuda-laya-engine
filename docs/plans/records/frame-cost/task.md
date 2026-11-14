# Agent task: frame-cost

Status: Implemented within scope; desktop WebGL and WebGPU verified, no phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

WP1 of the [three.js gap audit](../threejs-gap-audit/plan.md) ("Phone frame
cost: shadow caching and render scale"), from the owner's goal of 2026-11-14
to surpass three.js, phones first. The [phone-cost record](../phone-cost/verification.md)
measured on a vivo V40: sun shadows 6.7 and 3.5 ms of a frame at look level
2; look level 2 at 40 to 64 ms a frame at 617 by 1200, most of the rest in
the HDR chain. Findings `lighting/shadow-caching`,
`runtime/shadow-update-caching`, `post/upscaling`, `post/sharpen`,
`runtime/resolution-upscaling` and `runtime/adaptive-quality`.

## Goal

A game can (a) draw its sun shadows less often than every frame, also when
other cameras draw the same scene (a water's mirror, a probe), (b) draw
its 3D picture smaller than the canvas while the interface stays sharp, and
(c) bring that picture up to the canvas with an edge-adaptive upscale and
sharpening, on WebGL and WebGPU, with the quality governor able to use the
scale as a step.

## Invariants

- LayaAir 3.4.2 vendor files are not modified; its behaviour is changed
  from engine code only, scoped to what the new options switch on.
- `shadows.update: 'every'` (the default) and render scale 1 are LayaAir's
  own paths, unchanged.
- One frame source and one clock: the shadow rule counts LayaAir's frames
  (`Stat.loopCount`); nothing schedules work on timers.
- LayaAir has one set of sun shadow maps, fitted to the camera that drew
  them last and read by every camera. The rule keeps them for one camera,
  the view: that camera never reads maps drawn for another. A camera that
  draws maps of its own makes the view draw its maps again; a camera named
  a borrower (the engine's mirrors by default) reads the view's.
- Every resource made has a release: the rule gives the scene its own frame
  test back, the render scale restores `Config3D.pixelRatio` and the scene's
  own stretch and destroys its target and shader data, also when the scene
  is destroyed with the look left undisposed.
- No claim beyond what was drawn: the checks are desktop draws on one Apple
  M4. Desktop frame times are reported as such and are not phone evidence.

## Dependencies

- LayaAir 3.4.2 `Scene3D._ShadowMapupdateFrequency` (private field behind
  `shadowMapFrequency`), `WebRender3DProcess._initRenderPass` (both
  backends), `Scene3D.blitMainCanvas`, `BlitFrameBufferCMD`,
  `Config3D.pixelRatio`, `RenderContext3D.clientWidth/clientHeight`.
- `ZhudaSceneLook`, `applyResolvedFilmLook`, `updateZhudaLookInPlace`,
  `ZhudaQualityGovernor`, `zhudaLookForQuality`.
- three.js r187 `examples/jsm/tsl/display/FSR1Node.js` read as the
  reference for EASU and RCAS (three ships it on WebGPU/TSL only).

## Scope

### Engine

- `packages/core/runtime3d/ShadowUpdates.ts` (new): `ZhudaShadowUpdates`
  (the view camera, `stats` with `taken`, `lends`),
  `zhudaShadowUpdateOptions`, `zhudaShadowFrameDraws`,
  `zhudaShadowBorrower`, `installLaya342SkippedShadowFrames`.
- `packages/core/runtime3d/Filmic.ts`, `packages/core/shaders/WaterSurface.ts`:
  a mirror whose `shadows` / `mirrorShadows` is left out is a borrower;
  `true` and `false` are as before.
- `packages/core/runtime3d/RenderScale.ts` (new): `ZhudaRenderScale`, the
  EASU, RCAS and bilinear-plus-RCAS passes, `zhudaRenderScaleOptions`,
  `zhudaRenderScaleSize`.
- `packages/core/runtime3d/QualityGovernor.ts`: `ZhudaQualityStep`,
  `zhudaQualitySteps`.
- `packages/core/film/FilmScene.ts`: `shadows.update`, `shadows.interval`
  (validated, resolved; switching to or from `'every'` rebuilds the shadows).
- `packages/core/film/FilmStage.ts`: the rule made with the look; a film
  still or video sample always draws the maps.
- `packages/core/film/LiveLook.ts`: the rule changed in place; a moved sun or
  changed shadow settings draw the maps again.
- `packages/core/film/SceneLook.ts`: `scale`, `upscale`, `sharpness`
  options, `setRenderScale`, `setStep`, `redrawShadows`, `shadowStats`.
- `packages/core/runtime3d/index.ts`: two export lines.
- Tests `tests/frame-cost.test.mjs`; draws `scripts/verify-shadow-updates.mjs`
  (`tests/fixtures/shadow-updates.ts`) and `scripts/verify-render-scale.mjs`
  (`tests/fixtures/render-scale.ts`); docs `docs/film-scenes.md`,
  `docs/quality-route.md`.

### Consumer or adapter

- None in this task. `films/river-town-prefab` is where a phone measurement
  would be made.

## Non-goals

- Point-light shadows (already drawn on demand by `ZhudaPointShadow`) and a
  separate rule per light: LayaAir draws one sun and one spot shadow, both
  under the scene's rule.
- Temporal upscaling (TAAU) and sharpening at full size as its own effect.
- Changing what the look quality levels drop: the levels are as before;
  the scale is a separate, opt-in lever.
- Phones: none was touched.

## Acceptance checks

1. `npm run verify` passes with the new unit tests (rules, failing paths,
   the ladder walked by the governor).
2. `npm run verify:shadow-updates` and
   `SHADOW_UPDATES_RENDERER=webgpu npm run verify:shadow-updates` pass:
   with an interval of 3, a moving post's shadow matches the every-frame
   reference on the frames that draw (overlap above 0.95), stays exactly
   where it was drawn on the two between (above 0.95), and those frames are
   new (the post has moved); a material first compiled on a kept frame is
   lit and shadowed as when drawn every frame (a tile under the post's
   shadow, overlap above 0.95); `'manual'` waits for `redrawShadows()` and
   redraws by itself when the sun moves; no page, console or GPU errors.
   The same page with LayaAir's own `shadowMapFrequency` is loaded too and
   must show what goes wrong there. With a pond whose mirror the game draws
   from its tick (`?water`): the shadows on land are there on every frame
   for each `mirrorShadows`; left out, three of nine frames draw the maps
   and none is taken, and the mirror's picture shows the main view's
   shadow; `true`, nine of nine draw; `false`, three of nine; after a probe
   capture the land has its shadows on every frame. Stills of a film stage
   (`?film`) under `'manual'` and `'interval'` are the stills drawn every
   frame.
3. `npm run verify:render-scale` and
   `RENDER_SCALE_RENDERER=webgpu npm run verify:render-scale` pass: what an
   uncovered pixel reads like on the backend is measured from a view over a
   quarter of the canvas, and each upscale fills that view and no more; at
   every scale 0.5..1 and every upscale the canvas has no uncovered pixel
   and its border is the scene's; the interface strip is the same as at full
   size; at 0.67, FSR is sharper than LayaAir's plain stretch (by more than
   10 %) and not sharper than full size, in the page's look and in three
   others, and about as near the full-size picture (nearer in the page's
   look); the ladder walks in place; one scale for the stage; disposal, and
   the destruction of a scene whose look was left undisposed, restore
   LayaAir's own path.
4. `npm run lint`, `npm run format:check`, `git diff --check`.

## Evidence to attach

- Test and gate output, `report.json` and pictures of both draws on both
  backends: see [verification](verification.md).

## Unverified limits

- Any phone: the 3.5 to 6.7 ms shadow cost and the 40 to 64 ms frames are
  not measured again. Whether interval shadows or a 0.67 scale with FSR save
  what they should on the V40 is the next step.
- The ladder's rungs (`zhudaQualitySteps`) are a proposal.
- Other cameras of the scene under a rule. Drawn: a water's mirror drawn
  from the game's tick with each `mirrorShadows`, and an environment probe
  capture. Not drawn: a mirror the engine's frame loop draws itself (the wet
  surface; its camera borrows by the same rule, unit-tested on fakes), a
  bounce-light (`ZhudaProbeVolume`) capture, two cameras on the canvas (each
  takes the maps from the other: right picture, nothing saved, unit-tested
  on fakes), and a game's own camera drawn into a target.
- A mirror that borrows shows the main view's shadows where the main view's
  cascades reach; what it mirrors beyond them has no shadow.
- `'manual'` follows a sun turned through `setLook`; a game that turns
  `look.sun` itself must call `redrawShadows()`. It does not follow the
  camera either.
- The `'fsr'` and `'bilinear'` passes write alpha 1 where LayaAir's stretch
  copies the picture's alpha: a see-through canvas would turn opaque below
  scale 1. Not drawn (the engine boots an opaque canvas).
- Found while drawing the pond, both older than this task and not changed
  by it: a water's mirror with shadow maps of its own (the default while
  shadows are drawn every frame) shows no sun shadow on what it mirrors in
  the fixture's scene, though it pays for the maps (a mirror without the
  water's clipping plane shows them); and a mirror with `mirrorShadows:
  false` is drawn without the sun's shadows, where the option's
  description said it used the main view's (corrected).

## Rollback

Before this task: `09a840c`. Without the options nothing of this runs:
`shadows.update` defaults to `'every'` and the render scale to 1.
