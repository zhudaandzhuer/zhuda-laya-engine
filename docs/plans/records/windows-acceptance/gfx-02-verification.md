# Verification record: windows-acceptance GFX-02

Task document: `docs/plans/records/windows-acceptance/gfx-02-task.md`\
Commits: `738a00f` (depth read at a depth pixel's centre), `28bd007` (the
check: bands, and wetness in linear blue); base `3cd1f46`\
Date: 2026-11-17

## `verify:gpu-depth` reflections, before and after

Values: 8-bit mean at the rough spot for `alike` (no surface pictures,
wetness 0.5), `surfaces` rough / smooth, `surfacesWet` (wetness 1); bands
down the reflection (largest row-to-row bend); `wetter` = wet over unwet
reflection in linear blue (must be > 1.08); `half` = smooth strip at half
wetness over unwet (must be < 1.05).

| GPU, backend                                          | Before (old shader)                                                                                   | After                                                                                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple M4, WebGL (ANGLE Metal)                         | alike 127.7, surfaces 92.8/159.7, wet 171.4; bands 46; old check passed (+43.7) on the banded picture | alike 167.8, 96.5/164.4, wet 177.6; bands 1; wetter 1.14, half 1.02; PASS                                                                                         |
| Apple M4, WebGPU                                      | alike 127.8, 91.8/156.0, wet 169.6                                                                    | same as WebGL: 167.8, 96.5/164.4, 177.6; PASS                                                                                                                     |
| Intel UHD 770, WebGPU (Windows host, desktop session) | alike 147, 84.5/147.6, wet 156.1; new check FAILS: half 1.114                                         | 167.8, 96.5/164.4, 177.6; bands 1; PASS                                                                                                                           |
| Intel UHD 770, WebGL (ANGLE D3D11)                    | alike 169.7, 97.2/165.9, wet 179; reflections pass, no bands                                          | 168.7, 96.8/165.1, 178.1; wetter 1.135, half 1.022; reflections pass. The run stops later at TAA (`standing still, the stripes are as without smoothing`): GFX-03 |
| Adreno 720, WebGPU (vivo V40)                         | not run                                                                                               | 167.7, 96.1/164.3, 177.5; bands 1; wetter 1.142, half 1.019; PASS                                                                                                 |
| Adreno 720, WebGL (ANGLE GLES)                        | not run                                                                                               | same; PASS                                                                                                                                                        |

The report's 9.1..10 on the Windows host is the old check on a correct
picture (Intel WebGL) or a slightly noisy one (Intel WebGPU): with the wall's
red and green clipped, wet and unwet 8-bit means differ by about 10
everywhere once no GPU bands.

## Other checks

| Check                                                                        | Result                                                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `verify:film-reflections` (a lamp beside a wall found at its mirrored place) | PASS, macOS                                                                                  |
| `npm run verify`                                                             | PASS 876/876, macOS                                                                          |
| `verify:gpu-depth` experiments ruled out                                     | 64 steps, a hit window twice as wide, `precision highp float`: no change to the banded value |

## Limits and decision

- RTX not selected (Chrome's default on the host is Intel).
- WebGL TAA on Intel still fails in the same check: GFX-03, next.

Decision: **Implemented within scope**: the reflection is the same on
Apple, Intel and Adreno, both backends.
