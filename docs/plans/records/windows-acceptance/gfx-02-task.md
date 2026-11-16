# Agent task: windows-acceptance GFX-02, wet reflections

Status: Implemented within scope; verified on macOS, the Windows host and the vivo V40 ([record](gfx-02-verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), GFX-02 (report section 6): in
`verify:gpu-depth`, `surfacesWet.rough` rose only 9.1 to 10 over
`alike.rough` on the Windows host, both backends, where the check asks for
more than 20 (`scripts/verify-gpu-depth.mjs:182`).

## What was found

On macOS the same check gives 43.7 (WebGL) and 41.8 (WebGPU). The wet
value is about the same everywhere (171 to 179); the difference is the
`alike` baseline (screen reflections without the surface pictures): 127.7
on Apple M4 (both backends), 147 on Intel WebGPU, 169.7 on Intel WebGL.
The pictures show why: on Apple the reflection has dark horizontal bands
every 3.24 rows of the half-size trace (the period of the per-pixel jitter
along y), on Intel WebGPU a diagonal pattern, on Intel WebGL none.

The trace runs at half size and reads the full-size depth picture at its
own pixel centres, which fall on the corner of four depth pixels; which one
a read returns is the GPU's choice. Where it returns the farther one, the
ray starts behind the surface it leaves and, for small jitter values, hits
that surface at once; the normal built from the same reads is tilted.
Ruled out on the way: step count (64 steps: no change), hit window (twice
as wide: no change), float precision (`highp`: no change), depth format
(`DEPTH_32`, near 0.1, far 1000).

So the defect is the banding on Apple and Intel WebGPU, and the check's
`+20` on 8-bit means was set on a banded baseline: drawn right, the wall's
red and green clip at 255 both unwet and wet, and the 8-bit mean barely
moves.

## Goal

The same reflection on every GPU (no bands), and a wetness check that
measures the reflection where it does not clip.

## Invariants

- Reflection formula unchanged (fresnel, gloss, wetness polish).
- `alike` still reflects rough and smooth alike; `surfaces` still makes
  rough reflect less and smooth more; off again returns to `alike`.
- The new wet check fails on a case that is not wetter (negative control).

## Scope

- `packages/core/runtime3d/ScreenReflections.ts`: depth read at a depth
  pixel's centre in the trace pass.
- `tests/fixtures/gpu-depth.ts`, `scripts/verify-gpu-depth.mjs`: the wet
  check in linear light on the blue channel, reflection above `none`.

## Acceptance checks

1. `verify:gpu-depth` on macOS WebGL and WebGPU, the Windows host's
   desktop session (Intel) both backends, and the vivo V40: all pass; the
   `alike` values agree across GPUs; pictures have no bands.
2. `verify:film-reflections` (a lamp beside a wall still found at its
   mirrored place) and `npm run verify` pass.

## Rollback

Revert the commits; the bands return and the old check passes on Apple only.
