# Verification record: windows-acceptance GFX-03, GFX-04, GFX-05

Task document: `docs/plans/records/windows-acceptance/gfx-03-task.md`\
Commits: `2286be3` (point-filtered WebGL textures carry no anisotropy),
`4249301` (an unset level is never sent); base `4f66244`\
Date: 2026-11-17

## Cause, once for all three

LayaAir 3.4.2 gives every WebGL texture `anisoLevel=4` when it is made,
point-filtered or not. Direct3D 11 (ANGLE on Windows) builds an
anisotropic sampler for that and ignores the point setting; Metal, GLES
and WebGPU keep it. Each of the three checks draws a point-filtered
texture, so each failed on Windows WebGL only. The fix
(`installLaya342PointFilterFix`, `Laya342Adapters.ts`) sends anisotropy 1
while a texture is point-filtered and the level it asked for otherwise;
`anisoLevel` still reports what was asked.

The first commit sent an unset level for a texture made before the fix
(NaN, refused as `GL_INVALID_VALUE`; seen as "WebGL errors" in
`verify:specular-aa`); `4249301` records the level the texture already
has and never sends an unset one.

## Before and after, Intel UHD 770, WebGL (ANGLE D3D11), Windows host desktop session

| Item   | Check                                                       | Before (base, same host)                                                        | After (`4249301`)                                                 |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| GFX-03 | `verify:gpu-depth`: TAA standing still / tracked moving box | fails: still 7.81..11.19 (required 0), tracked 8.25..9.28 (< 3) (report, rerun) | PASS: still 0, tracked 0 (untracked 62.16); sharp row `255×5 0×5` |
| GFX-04 | `verify:basis-textures`: KTX 2 model against its PNG model  | fails: mean 2.763 (required ≤ 2.5)                                              | PASS: model mean 0.29 (bc1); bc1 0.283, bc3 0.258, rgba8 0        |
| GFX-05 | `verify:post-quality`: edge error at 4°, none / FXAA / SMAA | fails: SMAA 0.0523 against 0.085 unsmoothed                                     | PASS: 0.085 / 0.0398 / 0.0096; all eight angles and corners pass  |
| —      | `verify:instanced-mesh` WebGL                               | PASS                                                                            | PASS                                                              |

## Other platforms

| Platform                 | Result                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Apple M4, WebGL          | `verify:gpu-depth` PASS; `verify:basis-textures` PASS (astc 0, bc1 0.296); `verify:post-quality` PASS (SMAA 4° 0.0095) |
| Apple M4, WebGPU         | `verify:gpu-depth` PASS (the fix leaves WebGPU alone)                                                                  |
| Adreno 720 (vivo V40)    | see the phone runs below                                                                                               |
| `npm run verify` (macOS) | PASS; `tests/point-filter.test.mjs` 3 of 3                                                                             |

Phone runs (vivo V40, Chrome over `ZHUDA_PHONE_CHROME`) are listed in
[gfx-06-verification.md](gfx-06-verification.md), which was run after all
four.

## Limits

- RTX 3060 not selected (Chrome's default adapter on the host is Intel).
- Edge not run.
- On the host, `verify:gpu-depth` once printed a browser-cleanup warning
  (Chrome had not quit 5 s after `Browser.close`; `taskkill` of two child
  processes reported they could not be ended, most likely already gone).
  The check passed and no browser was left; the warning is a WIN-04
  observation, not a GFX failure.

Decision: **Implemented within scope** for GFX-03, GFX-04 and GFX-05.
