# Verification record: two Adreno findings

Task document: `docs/plans/records/phone-findings-adreno/task.md`\
Commits: `d6d8130` (SMAA reads at each pixel's centre), `13441d2` (specular
AA takes the normal map's shortening as a number); base `7790ee2`\
Date: 2026-11-17

Phone: vivo V40 (V2348, Adreno 720), Chrome 157.0.8103.78 over
`ZHUDA_PHONE_CHROME` (wireless adb), Chrome in the foreground. Windows: the
acceptance host, desktop session, Intel UHD 770. Mac: Apple M4.

## SMAA leaves what it does not smooth

`verify:post-quality`, pixels changed against no smoothing (flat / ramp /
grain / box):

| Run                              | Before (`7790ee2`)              | After                                                  |
| -------------------------------- | ------------------------------- | ------------------------------------------------------ |
| V40 WebGL, every SMAA quality    | grain 202 (1 level each) → FAIL | 0 / 0 / 0 / box 0..8 → PASS                            |
| V40 WebGPU, every SMAA quality   | ramp 2, grain 227 → FAIL        | 0 / 0 / 0 / box 0..8 → PASS                            |
| V40 edge error at 4° (SMAA high) | —                               | 0.0106 WebGL, 0.0103 WebGPU (Mac 0.0095)               |
| Mac WebGL and WebGPU             | PASS                            | PASS; WebGL's edge errors compared: the same as before |
| Windows Intel WebGL and WebGPU   | PASS (GFX-05)                   | PASS                                                   |

The same 202 pixels at every quality (edge thresholds 0.05 to 0.15) showed
it was the pass-through read, not an edge. An experiment that moved only
the blend pass's reads to the centre already gave 0 on both backends; the
commit does it in all three passes.

## A normal map at no strength widens nothing

`verify:specular-aa`, a mipmapped normal map at strength 0 against no map,
specular AA on (largest change on the ball, of about 14 700 pixels):

| Run                            | Before                                                              | After                                        |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------- |
| V40 WebGPU                     | 2.8 levels at one pixel, (281, 184): (6,6,9) against (9,9,9) → FAIL | 0 → PASS                                     |
| V40 WebGL                      | PASS                                                                | 0 → PASS                                     |
| Mac WebGL and WebGPU           | PASS                                                                | PASS; every highlight size and peak the same |
| Windows Intel WebGL and WebGPU | PASS (GFX-06)                                                       | PASS                                         |

What was ruled out on the V40 WebGPU first (each a full run):

| Experiment                                          | Largest change    |
| --------------------------------------------------- | ----------------- |
| no map drawn twice                                  | 0 (deterministic) |
| specular AA off, no map against map at 0            | 0                 |
| the map without mipmaps (no normal-length block)    | 0.9               |
| fine derivatives in LayaAir's curvature term        | 2.8 (no change)   |
| the normal-length block skipped when the scale is 0 | 2.8 (no change)   |
| the shortening passed as `zhudaNormalShort`         | 0                 |

The Mac's "through LayaAir's pass" line of the temporal check moves from run
to run (1.741..1.78 before these commits, 1.756 after); every other number
of the check is unchanged.

## Other checks

| Check                                                                | Result          |
| -------------------------------------------------------------------- | --------------- |
| `verify:lit-surface`, `verify:physical-surfaces`, Mac, both backends | PASS            |
| `verify:physical-surfaces`, V40, both backends                       | PASS            |
| `npm run verify`                                                     | PASS 927 of 927 |
| lint, format                                                         | clean           |

## Limits

- One phone (Adreno 720). Mali, Apple GPUs in Safari and other Adreno
  generations not run.
- Why Adreno's interpolated coordinate and `normalize` land where they do
  was not taken further than these effects.

Decision: **Implemented within scope**.
