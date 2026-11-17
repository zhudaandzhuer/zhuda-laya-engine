# Agent task: two Adreno findings from the Windows acceptance phone runs

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

Owner's request of 2026-11-17: test and fix the two phone findings recorded
in [the GFX-06 verification](../windows-acceptance/gfx-06-verification.md),
on the vivo V40 (Adreno 720, Chrome 157). Both were the same before the
Windows acceptance changes; both checks were desktop-only until then.

| Check                 | Backend on Adreno  | Finding                                                                                                                        |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `verify:post-quality` | WebGL (and WebGPU) | SMAA at every quality changes 202 pixels (WebGPU 227, and 2 of the ramp) of faint grain by one level where nothing is smoothed |
| `verify:specular-aa`  | WebGPU             | a normal map at strength 0 differs from no map by 2.8 levels at one pixel                                                      |

## What was found

1. SMAA: the same pixels changed at every quality, whose thresholds differ
   threefold, so no edge was found: the pass-through read moved them.
   Adreno interpolates the full-screen texture coordinate a little off each
   pixel's centre, and the bilinear read there mixes in some of the next
   pixel. Reading at the centre worked out from the coordinate
   (`(floor(uv / texel) + 0.5) * texel`) leaves 0 pixels changed on both
   backends.
2. Normal map at strength 0: with specular AA off, no map and a map at 0
   were identical; with it on, one pixel differed, only with the mipmapped
   map, and still when the normal-length block was skipped at run time.
   Fine derivatives in LayaAir's curvature term changed nothing. The spread
   of the bumps was read from the length of the stored normal, which LayaAir
   has `normalize`d; on Adreno's WebGPU that length came back a little off 1
   for some values, and was taken for bumps. The shortening the block works
   out now reaches `PBRFrag.glsl` as its own number (`zhudaNormalShort`),
   and the stored normal stays as LayaAir made it: 0 pixels differ.

## Invariants

- Desktop results unchanged (texture coordinates arrive at pixel centres
  there; the shortening is the same number either way).
- No threshold of either check loosened.
- SMAA's own reads (the quarter- and eighth-pixel offsets of the weights
  pass) keep their offsets, now from the centre.

## Scope

- `packages/core/runtime3d/Smaa.ts`: the three passes read at the pixel's
  centre.
- `packages/core/runtime3d/Laya342Adapters.ts`: `zhudaNormalShort`;
  `tests/specular-aa.test.mjs`.

## Acceptance checks

1. `verify:post-quality` and `verify:specular-aa` pass on the V40, WebGL
   and WebGPU.
2. The same on macOS and the Windows host (Intel), both backends;
   `verify:lit-surface` and `verify:physical-surfaces` unchanged.
3. `npm run verify`, lint, format.

## Rollback

Revert the commit.
