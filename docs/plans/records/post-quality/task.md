# Agent task: post-quality

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP11): three.js has AgX and Neutral tone mapping, a `.cube` loader and a 3D
LUT pass, GTAO, SMAA and a lens flare that the scene hides. The engine had
LayaAir 3.4.2's ACES grade, `ScalableAO`, FXAA and no flare, and a look
could not name white balance, lift, gamma, gain or the shape of bloom. WP11
asks for all of these, drawn on both backends, with SMAA's cost on a phone
against FXAA and the provenance of SMAA's tables recorded.

Carried from WP8: the depth picture is read at low precision on a phone
unless the shader asks otherwise; the selection outline was fixed there and
the other depth readers were left for this package.

## Goal

A look that names its tone curve, its colour table, how its edges are
smoothed, how creases are darkened and whether the sun flares, where each
does on the screen what its arithmetic says on the CPU: on WebGL, on WebGPU
and on a phone.

## Invariants

- LayaAir 3.4.2 vendor files are not modified. `aces` stays LayaAir's own
  path, bit for bit.
- A curve adds no pass. Nothing new runs unless a look asks for it.
- The grade's range clamp stays: what reaches the table is inside it.
- Each effect has a disposal path and leaves no resource behind; a look made
  and let go repeatedly leaves nothing.
- A `.cube` file named by a film scene loads through `ZhudaFilmAssets` with
  the scene's cancellation, timeout and failure handling; a game's scene
  look loads nothing and is handed the table.
- No assets in the engine: the flare's shapes are arithmetic, the checks
  make their own tables and pictures.
- Third-party data is pinned by hash with its licence carried into every
  bundle.

## Dependencies

- `ZhudaFilmicPipeline` and its `sceneEffects` / `finishEffects`, the film
  look (`FilmScene`, `FilmStage`, `LiveLook`, `SceneLook`, `LookQuality`).
- LayaAir 3.4.2: `ColorGradEffect` (its table builder and lookup pass, the
  balance and lift/gamma/gain values), `BloomEffect`, the camera's depth
  texture, `CommandBuffer.blitScreenQuad` / `blitScreenTriangle`.
- three.js 0.187.0 (MIT) for the SMAA tables and the tone curve constants;
  SMAA 2.8 (MIT). See `vendor/threejs-post/README.md`.

## Scope

### Engine

- `packages/core/runtime3d/ToneCurves.ts` (new): `ZhudaToneMapping`,
  `zhudaAgxToneMap`, `zhudaNeutralToneMap`, `zhudaToneMap`,
  `applyZhudaToneCurve`, `releaseZhudaToneCurve`.
- `ColorLut.ts` (new): `parseZhudaCubeLut`, `zhudaSampleCubeLut`,
  `zhudaIdentityCubeLut`, `validateZhudaCubeLut`, `zhudaCubeLutAtlas`,
  `ZhudaColorLut`.
- `Smaa.ts`, `SmaaTables.ts` (new): `ZhudaSmaa`, `ZHUDA_SMAA_QUALITIES`,
  the two tables; `scripts/build-smaa-tables.mjs` writes the tables.
- `GroundTruthAO.ts` (new): `ZhudaGroundTruthAO`, `zhudaHorizonVisibility`.
- `LensFlare.ts` (new): `ZhudaLensFlare`, `ZHUDA_LENS_FLARE_SUN`,
  `zhudaLensFlarePlace`, `zhudaLensFlareEdgeFade`.
- `Filmic.ts`: `toneMapping`, `temperature`, `tint`, `lift`, `gamma`,
  `gain`, `bloomThreshold`, `bloomSoftKnee`, `bloomAnamorphic`,
  `bloomDiffusion`, `bloomDirt` / `setBloomDirt`, `aoMethod`, `aoHalfSize`,
  `groundAO`, `validateZhudaFilmicGrade`.
- The film look: `grade.toneMapping`, `temperature`, `tint`, `lift`,
  `gamma`, `gain`, the four bloom fields, `antialias: 'smaa'`, `aoMethod`,
  `lut`; `look.lensFlare`; `ZhudaFilmAssets.colorTables`;
  `ZhudaSceneLook.setColorTable`; quality levels.
- The depth picture read at high precision in `LightFog`, `CameraEffects`,
  `ScreenReflections`, `PointShadow`, `ProbeVolume`, `Clouds`, the particle
  material and the lit template (water).
- `vendor/threejs-post/` (provenance and licences), carried into the
  browser SDK's `LICENSE.txt` and a consumer build's notices.
- `tests/post-quality.test.mjs`, `tests/fixtures/post-quality.ts`,
  `tests/helpers/cube-fixture.mjs`, `scripts/verify-post-quality.mjs`,
  `npm run verify:post-quality`; a colour table in
  `scripts/verify-film-model.mjs`.
- `docs/post-quality.md`.

### Consumer or adapter

A game brings its `.cube` files and, if it wants one, a picture of the marks
on its lens. None is checked in.

## Non-goals

- A wrapper for LayaAir's `LensFlareEffect` (the plan's wording): it draws
  through walls and multiplies its elements' values each time one is set.
  The flare here is the engine's own.
- Enabling LayaAir's dormant `CUSTOMLUT` path: its shader does not compile
  (it calls a lookup with three arguments that takes two).
- SMAA's diagonal patterns, its temporal and multisampled modes.
- Occlusion that darkens ambient light only (it needs the lighting split in
  the scene pass), bent normals, a multi-bounce term.
- A flare hidden by clouds or fog drawn after the scene.
- A colour table swapped in a running film look.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:post-quality` on WebGL and with `POST_RENDERER=webgpu`.
3. The existing draws of the HDR chain, the film look and everything that
   reads depth still pass on both backends.
4. The check's page on a phone: its results, and the cost of each part.

## Unverified limits

See the verification record.
