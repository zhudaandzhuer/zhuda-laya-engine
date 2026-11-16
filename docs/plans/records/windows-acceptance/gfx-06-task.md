# Agent task: windows-acceptance GFX-06, specular anti-aliasing on Intel and RTX

Status: Implemented within scope ([verification](gfx-06-verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), GFX-06 (report section 6): in
`verify:specular-aa` on the Windows host, RTX 3060 energy 1.122 / 1.130
(allowed ±12 %), and on Intel UHD 770 the smallest smooth ball's highlight
under the game's sun 12.6 pixels where the truth gave 8 (allowed ±4).

## What was found

- The RTX values are the 4tx / 8tx cases on both backends (the report's
  own correction) and sit inside the bound the check asserts; nothing to
  change.
- The Intel case: the patched highlight is 12.6 pixels on Intel, Apple and
  both backends alike. The truth differs: its game-sun size is a truth
  taken under a sun dim enough not to clip (7.8e-05 for `r0.05-68px`),
  read back in 8 bits and scaled up by `0.6 / dim`. At that sun most of
  the highlight is a few 8-bit steps, and how a GPU rounds them decides
  which pixels pass half the peak: Intel 8, Apple 12.
- A truth taken under the game's sun itself (unpatched frames at 256
  sub-pixel offsets, each clipped as the screen clips it, averaged) gives
  13 on Intel and Apple; the other six cases agree with the scaled one
  within one or two pixels.

## Goal

The highlight-size assertion compares against a truth that does not
depend on a GPU's 8-bit rounding at a near-black sun. The shader is not
changed.

## Invariants

- The bound (±max(4, 15 %)) and every other assertion stay as they are.
- The scaled truth stays in the report next to the new one.

## Scope

- `tests/fixtures/specular-aa.ts`: `truth.gameSizeDirect`.
- `scripts/verify-specular-aa.mjs`: the size assertion and its message.

## Acceptance checks

1. `verify:specular-aa` passes on the Windows host's desktop session,
   Intel, WebGL and WebGPU.
2. macOS both backends pass; `npm run verify` passes.

## Rollback

Revert the commit; the Intel case fails again on the scaled truth.
