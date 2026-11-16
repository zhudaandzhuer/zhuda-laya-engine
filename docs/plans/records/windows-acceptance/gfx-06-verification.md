# Verification record: windows-acceptance GFX-06

Task document: `docs/plans/records/windows-acceptance/gfx-06-task.md`\
Commit: `52ddb7e` (the game-sun highlight sized against a truth taken under
that sun); base `d6287a8`\
Date: 2026-11-17

## `verify:specular-aa`, smallest smooth ball (`r0.05-68px`) under the game's sun

The patched highlight measures the same everywhere; the truth it is held
to was the GPU-dependent part. `scaled` is the old truth (a dim-sun truth
scaled to the game's sun, 8-bit readback), `direct` the new one (256
jittered unpatched frames under the game's sun, each clipped, averaged).

| GPU, backend                                  | Highlight off → on (pixels) | Truth scaled | Truth direct | Result (before → after) |
| --------------------------------------------- | --------------------------- | ------------ | ------------ | ----------------------- |
| Apple M4, WebGL                               | 11.3 → 12.6                 | 12           | 13           | PASS → PASS             |
| Apple M4, WebGPU                              | 11.3 → 12.6                 | 12           | 13           | PASS → PASS             |
| Intel UHD 770, WebGL (Windows host, desktop)  | 11.3 → 12.6                 | 8            | 13           | FAIL → PASS             |
| Intel UHD 770, WebGPU (Windows host, desktop) | 11.3 → 12.6                 | 8            | 13           | FAIL → PASS             |
| Adreno 720, WebGL (vivo V40)                  | 11.1 → 12.6                 | 10           | 13           | not run → PASS          |
| Adreno 720, WebGPU (vivo V40)                 | 11.1 → 12.6                 | 12           | 13           | not run → size passes¹  |

¹ The run stops later, at `a map at no strength widens nothing`
(largest change 2.8 levels, allowed 1), a normal-map check this change does
not touch. It fails the same, 2.8 levels, at `d6287a8` (before this
change): an Adreno WebGPU finding, not a GFX-06 result.

The other six balls agree between the two truths within two pixels on
every GPU (46/46, 157/157 or 156, 335/335, 4/4, 10/12, 18/18), so the
assertion moves only where the scaled truth was mostly rounding.

The RTX 3060 energy values of the report (1.122 / 1.130, ±12 %) are the
4tx / 8tx cases on both backends and within the bound the check asserts;
RTX was not selected on this host (Chrome's default adapter is Intel).

## Phone runs of GFX-03..05 checks and of AG3 (vivo V40, Chrome over `ZHUDA_PHONE_CHROME`)

| Check                         | WebGL (Adreno 720, ANGLE GLES)                              | WebGPU (Adreno 7xx)                                                               |
| ----------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `verify:gpu-depth`            | PASS (TAA still 0, tracked 0; reflections 96.1 / 164.3)     | PASS (compute 14.03 ms a million particles)                                       |
| `verify:basis-textures`       | PASS                                                        | not run                                                                           |
| `verify:post-quality`         | FAIL: `smaaLow leaves grain as it was` (202 pixels changed) | not run                                                                           |
| `verify:density-volume` (AG3) | PASS (JavaScript fill)                                      | PASS (largest difference 1.19e-6, no sign flips)                                  |
| `verify:specular-aa`          | PASS                                                        | sizes pass; stops at the zero-strength normal map (2.8 levels), same at `d6287a8` |

`verify:post-quality` fails identically at the base commit `4f66244`
(before the point-filter fix): 202 pixels of faint grain changed by SMAA
Low on Adreno WebGL. It is not a GFX-03 regression; the check is labelled
desktop evidence only and was never claimed for phones. Recorded as a
phone finding outside this plan, with the zero-strength normal map on
Adreno WebGPU: both are desktop checks run on a phone for the first time.

## Other checks

| Check                    | Result          |
| ------------------------ | --------------- |
| `npm run verify` (macOS) | PASS 889 of 889 |

## Limits

- RTX 3060 and Edge not run.
- The direct truth costs 256 extra frames a ball (Windows host: 46 s
  WebGL, 54 s WebGPU for the whole check).

Decision: **Implemented within scope**.
