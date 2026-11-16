# Agent task: underwater-look (AG1)

Status: Implemented; desktop WebGL and WebGPU verified, no phone
Owner: Engine/toolchain
Last reviewed: 2026-11-17

## Source requirement

Work package AG1 of
[Techniques from Abyssal Garden](../abyssal-garden-techniques/plan.md),
taken up on the owner's request of 2026-11-17: water as a medium the camera
is in, caustics, the surface seen from below, light shafts tinted by the
medium, and an example scene.

## Goal

`look.underwater` on a film scene and `ZhudaSceneLook`: below `surfaceY`
the view is dimmed per channel and filled with the water's colour, sunlight
under water is dimmed and gathered into caustics, the surface is seen from
below with the sky in its window, and nothing changes above the surface.

## Invariants

- No change to `Filmic.ts` (another session owns it): the medium joins the
  HDR chain through `sceneEffects`, after the light fog.
- A scene without water compiles and draws as before (the lighting patch is
  behind `ZHUDA_UNDERWATER`; the 20 film draws pass, and the film-remount
  frame is byte-identical with and without the install).
- The scene's numbers go after LayaAir's own `Scene3D` uniforms (the lesson
  of `scene-uniform-order`); no new scene texture (WebGPU's sampler budget,
  see `PointShadow.ts`).
- Colours of the look are display values, decoded where the water is made.

## Dependencies

- `ZhudaFilmicPipeline` (`sceneEffects`), `ZhudaLightFog`,
  `ZhudaShaderMaterial`, LayaAir 3.4.2's `PBRFrag.glsl` and
  `BlinnPhongFrag.glsl`.

## Scope

### Engine

- `packages/core/runtime3d/Underwater.ts` (new): `ZhudaUnderwater`,
  `installLaya342Underwater`, `validateZhudaUnderwater`,
  `resolveZhudaUnderwater`, `zhudaUnderwaterTransmittance`,
  `zhudaUnderwaterWaves`, `zhudaCausticIntensity`,
  `zhudaPatchUnderwaterInclude`.
- `LightFog.ts`: `excludeFromShafts(layer)`.
- `DeclarativeSDK.ts`: installed at boot.
- `film/FilmScene.ts`, `FilmStage.ts`, `LiveLook.ts`, `LookQuality.ts`,
  `SceneLook.ts`: `look.underwater`.
- `tests/fixtures/film/underwater.json` (the example),
  `scripts/verify-film-underwater.mjs`, `tests/underwater.test.mjs`,
  `docs/film-scenes.md`.

### Consumer or adapter

None; a game sets `underwater` on its `ZhudaSceneLook`.

## Deviations from the plan

1. **Caustics without a texture.** The plan proposed a tiling texture drawn
   each frame and sampled by lit surfaces. On WebGPU every texture a scene
   declares takes a sampler in every lit shader (16 a stage; the point
   shadows already hit this), so the caustics are worked out per pixel from
   four wave trains in the lighting itself: the focusing of light by the
   waves' curvature (`1 / |det(I + d·κ·H)|`), a few sines a lit pixel under
   water.
2. **All lit surfaces, not only the lit hook.** The patch is in LayaAir's
   PBR and Blinn-Phong sun lighting, so the starter props, grounds and
   boxes of a film scene take caustics too. `ZhudaLitSurface` materials are
   not checked.
3. **The surface from below is the water look's own plane**, not
   `ZhudaWaterSurface` (whose river shader is made to be seen from above and
   reads the camera's opaque picture and a mirror). Its waves are the
   underwater module's four trains, shared with the caustics; they are not
   `ZhudaWaterSurface`'s waves.
4. **Level 0 has no water**: the medium is part of the HDR chain, which
   level 0 drops.

## Non-goals

- A water surface seen from above that matches (`ZhudaWaterSurface` is
  unchanged), swimming, buoyancy or any game rule.
- Light from lamps dimmed on its way through the water (only the sun is).

## Acceptance checks

1. Unit tests: transmittance, caustic intensity (none at the surface,
   lines a few metres down, moving), the patch against the vendored LayaAir
   text, the scene vectors after LayaAir's own, film validation, rebuild
   reasons, quality levels.
2. `npm run verify:film-underwater` on WebGL and WebGPU: per-channel
   dimming, bluer far off, caustics that add spread and move with time,
   the window brighter than the reflected surface, byte-identical above the
   surface, no WebGL error, `measureZhudaFrame` without flags.
3. The 20 film draws on both backends and `verify:foliage` unchanged;
   `npm run verify`.

## Unverified limits

- No phone (requested from the owner's session); the cost of the caustics
  per lit pixel is not measured.
- `ZhudaSceneLook` with water is not drawn (it shares the stage's code path,
  which is).

## Rollback

Last good commit: `b945c03`. Without `underwater` in a look nothing
changes; reverting the commit removes it.
