# Agent task: windows-acceptance GFX-03, WebGL temporal anti-aliasing on Windows

Status: In progress\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), GFX-03 (report section 6): in
`verify:gpu-depth` on the Windows host's WebGL, a still picture under
temporal anti-aliasing differed from one without by 7.81..11.19 (required 0) and a tracked moving box by 8.25..9.28 (required < 3); WebGPU 0.

## What was found

Recorded on the host (desktop session, Intel UHD 770, ANGLE D3D11): the
picture _without_ anti-aliasing is already wrong there. The test's stripe
texture is set to point filtering; its row reads `206 236 255 236 206 170
122 0 122 170` on Windows WebGL and `255×5 0×5` on Apple (both backends),
Intel WebGPU and Adreno. LayaAir 3.4.2 gives every WebGL texture 4x
anisotropic filtering at creation (`this.anisoLevel=4` in
`WebGLInternalTex`), point-filtered or not. Direct3D 11 builds an
anisotropic sampler for that, which ignores the point setting; Metal, GLES
and WebGPU keep it. A jittered frame of a filtered texture then never
equals the unjittered one. TAA, the jitter (Halton, ±0.5 px) and the
motion vectors (RGBA16F, location 4) are the same on all GPUs.

## Goal

A point-filtered texture is sampled point-wise on Windows WebGL too.

## Invariants

- What a texture asked for is kept and reported (`anisoLevel`); only what
  is sent to the GPU while it is point-filtered changes.
- Bilinear and trilinear textures keep their anisotropy.
- WebGPU untouched.

## Scope

- `packages/core/runtime3d/Laya342Adapters.ts` (`installLaya342PointFilterFix`),
  installed after `Laya.init` in `DeclarativeSDK.ts`.
- `tests/point-filter.test.mjs`.

## Acceptance checks

1. Unit: a LayaAir-like WebGL texture sends anisotropy 1 while point
   filtered, the asked level otherwise, and reports what was asked.
2. `verify:gpu-depth` WebGL on the Windows host's desktop session: TAA
   still 0 and tracked < 3; the sharp row is `255/0` stripes.
3. macOS, V40 and `npm run verify` unchanged (pass).

## Rollback

Revert the commit; point textures blur on Direct3D 11 again.
