# Task: gaps reported by a procedural 3D scene probe

Status: Implemented except B5 and B7, which stay open, and the release that B1 needs. See the table.

## Source requirement

A report from a consumer probe ("Larkhollow": a procedural farm with wind-blown
grass, a pond and a day-night cycle, built on v1.17.0, Windows, WebGL). Its
part A describes changes made on a branch `feat/lit-vertex-hook-and-live-look`
that was never committed or pushed. The owner later brought the working copy
over; it was reviewed file by file, applied on top of this repository and its
checks rerun here, on WebGL and (new) on WebGPU. Part B lists gaps; B10 to B12
come from the probe's own request file.

| Item                                                    | State                                | Note                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 vertex hook for lit materials                        | **Merged**                           | See [live look and vertex hook](../live-look-vertex-hook/task.md)                                                                                                                   |
| A2 `setLook` on a mounted stage / scene look            | **Merged**                           | Same record                                                                                                                                                                         |
| A3 in-place hemisphere ambient                          | **Merged**                           | Same record                                                                                                                                                                         |
| A4 `ZhudaWaterSurface.setSun`                           | **Merged**                           | Same record                                                                                                                                                                         |
| A5 declaration generator on Windows                     | **Merged**                           | Not run on Windows here; the repository's Windows CI job covers it                                                                                                                  |
| B1 hosted 1.17.0 SDK differs from HEAD                  | **Guarded; release pending**         | `npm run browser:drift` fails when the source differs from the release of its own version; the version is now 1.18.0. The hosted 1.17.0 itself changes only when 1.18.0 is released |
| B2 terrain meshes have no tangents                      | **Done**                             | `Terrain3DOptions.tangents` (opt-in)                                                                                                                                                |
| B3 `ZhudaFilmStage.setQuality`, level 0 with water      | **Done**                             | `stage.setQuality`; with water, level 0 keeps a bare HDR chain                                                                                                                      |
| B4 `bakeCache` key is private                           | **Done**                             | `zhudaBakeKey(recipe, size)`, stable under property order                                                                                                                           |
| B5 ground-snapped placement in film scenes              | Open                                 | A schema change; needs a design for how a film scene names a heightfield                                                                                                            |
| B6 vertex hook and mesh bounds                          | **Done**                             | `ZhudaDynamicMesh.padBounds(meters)`                                                                                                                                                |
| B7 CPU texture baking                                   | Open                                 | Measure first, as the report says                                                                                                                                                   |
| B8 doc example breaks the shader name rule              | **Done**                             | `ZhudaWetStone`                                                                                                                                                                     |
| B9 13 tests fail on Windows without symlink rights      | **Done, unverified on Windows here** | Directory links are junctions; tests that need a file link skip that part with the reason                                                                                           |
| B10 lights cannot be switched after mounting            | **Done**                             | `stage.setLight(id, { enabled, intensity, color, range })`; the fog glow follows                                                                                                    |
| B11 `setLook` rebuilds for any grade or light-fog value | **Done**                             | Strengths are set in place; only switching an effect on or off, or the beams' distance, resolution or steps, rebuilds                                                               |
| B12 lit materials ignore `doubleSided`                  | **Done**                             | Culling is set again after the shader switch; lighting of the back face is unchanged                                                                                                |

## Changes

- **B2** `ZhudaTerrain3D` takes `tangents: true`: each vertex gets a unit
  tangent on the ground along the direction u grows, with the handedness the
  engine's `computeMeshTangents` gives for the same cell. It is analytic, so
  both sides of a chunk border carry the same tangent. Vertices hold 12 floats
  instead of 8; `chunkSnapshot()` reports `stride`; the shell builder takes the
  stride. Off by default: the 8-float layout is what existing callers read.
- **B4** `zhudaBakeKey` in `film/BakeKey.ts`, exported with the stage.
- **B8** `docs/filmic-rendering.md`.
- **B12** `ZhudaLitSurfaceMaterial` set two-sided culling before switching to
  its own shader, and the switch resets the render state: every lit material
  declared `doubleSided` was drawn one-sided, with no error. The culling is now
  set again afterwards. Lighting of the back face (the report's
  `twoSidedLighting`) is not addressed.

- **B3** `stage.setQuality(level)` keeps the authored look and draws it at a
  level; `setLook` takes the authored look and the level stays on top.
  `zhudaLookForQuality(look, 0, { keepGrade: true })` keeps the HDR chain with
  bloom, ambient occlusion and the lens finish at zero; a stage with a water
  node uses it. Visiting the lower levels once leaves one pooled render target
  behind; further changes add nothing.
- **B6** `padBounds` grows a dynamic mesh's bounds on every side and keeps the
  padding through vertex updates.
- **B9** `tests/helpers/links.mjs`; five directory links became junctions.
- **B10** `stage.setLight`. A light that is off has zero intensity and keeps
  its component, so nothing is rebuilt and the light count does not change.
- **B11** `ZhudaFilmicPipeline.setGrade`, `ZhudaLensFinish.setFinish`,
  `ZhudaLightFog.setFog`; `zhudaFilmLookRebuildReason` compares only what is
  built (which effects exist; the beams' distance, resolution and steps).
- **B1** `releaseDrift` and `npm run browser:drift`; version 1.18.0.

## Invariants

Terrain heights, normals, UVs, raycasts and the shell are unchanged with or
without tangents; a terrain without the option is byte-for-byte what it was.

## Acceptance evidence

See [verification](verification.md).
