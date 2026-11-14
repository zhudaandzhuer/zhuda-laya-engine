# Agent task: hdr-environment

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP6): three.js lights a scene from an HDR panorama (`RGBELoader`,
`PMREMGenerator`, `scene.environment`, `environmentRotation`,
`backgroundBlurriness`, `RoomEnvironment`). The engine decoded Radiance HDR
for lightmaps only, drew PNG/JPEG panoramas as skies, prefiltered a capture
of the scene (`ZhudaEnvironmentProbe`), and required 32-bit float textures
with linear filtering for both. WP6 asks for an HDRI environment, its
rotation, a fallback where float textures do not filter, a procedural studio
room, and a blurred background.

## Goal

A scene lit by an HDR panorama shows the panorama's own surroundings in its
reflections and in its sky, the same way round, at the brightness the
file's numbers say, and turns them together; on WebGL and on WebGPU, and on
a device that cannot filter 32-bit floats.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- One owner for the scene's environment at a time: disposal gives the scene
  back what it had (light, ambient mode, intensities, rotation, sky,
  camera clear flag) and leaves no resource behind. A refused option leaves
  the scene untouched.
- A format the device does not have is refused when named, never silently
  replaced; without a name the best available is used and reported.
- The panorama's bytes come from the game (its `AssetProvider`); nothing is
  fetched here.
- The pure parts (panorama to cube, the studio room, half floats, RGBD,
  the prefilter that joins them) need no runtime.

## Dependencies

- `decodeRadianceHdr` (`Lightmap.ts`), `prefilterZhudaEnvironment`
  (`EnvironmentProbe.ts`), `createPrefilteredEnvironment` (`Filmic.ts`).
- LayaAir 3.4.2: `Scene3D.iblTex`, `iblTexRGBD`, `GIRotate`,
  `SkyPanoramicMaterial`, `SkyDome`, `TextureCube`.

## Scope

### Engine

- `packages/core/runtime3d/HdrEnvironment.ts` (new): `ZhudaHdrEnvironment`,
  `zhudaEquirectToCube`, `zhudaEquirectUv`, `zhudaEquirectDirection`,
  `zhudaStudioEnvironment`, `prefilterZhudaHdrEnvironment`,
  `zhudaShrinkPanorama`, `zhudaBlurredPanorama`.
- `packages/core/runtime3d/HalfFloat.ts` (new): `zhudaFloatToHalf`,
  `zhudaToHalfFloats`, `zhudaToRgbd`.
- `Filmic.ts`: `createPrefilteredEnvironment(spec, pixels, format?)`,
  `zhudaEnvironmentFormats`, `ZhudaEnvironmentFormat`.
- `ProbeVolume.ts`: 16-bit float atlases where 32-bit ones do not filter.
- `tests/hdr-environment.test.mjs`, `tests/helpers/hdr-fixture.mjs`,
  `tests/fixtures/hdr-environment.ts`, `scripts/verify-hdr-environment.mjs`,
  `npm run verify:hdr-environment`.
- `docs/hdr-environment.md`.

### Consumer or adapter

A game brings its own panorama. None is checked in: the check makes one.

## Non-goals

- A prefilter on the graphics card (the plan's "later").
- `.hdr` panoramas in film scenes (`look.panorama`), EXR, ground projection.
- Shadows from the panorama's sun.
- An SH-only hemisphere fallback: `rgbd` is the last format instead, and
  the existing hemisphere ambient is unchanged.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:hdr-environment` on WebGL and with
   `HDR_ENV_RENDERER=webgpu`.
3. The same page on a vivo V40.
4. The existing draws that use an environment or a probe volume still pass
   on both backends.

## Unverified limits

See the verification record.
