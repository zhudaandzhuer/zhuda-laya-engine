# Verification record: live-look-vertex-hook

Task document: `docs/plans/records/live-look-vertex-hook/task.md`  
Commit: uncommitted on `feat/lit-vertex-hook-and-live-look` (base `74f01f5`)  
Date: 2026-11-12

## Environment

- OS / browser / device: Windows 11 Pro 10.0.26200, Chrome (headless via `chrome-host`), ANGLE Intel UHD Graphics 770 (D3D11)
- Node and package manager: Node 23.9.0, npm
- Engine and consumer commits: engine base `74f01f5` plus this change; consumer probe `D:\claude-workstation\larkhollow-probe` (outside the repo)
- DPR, viewport and network mode: DPR 1, 480×300, local HTTP

## Checks

| Check      | Exact command or procedure             | Result     | Artifact                                      |
| ---------- | -------------------------------------- | ---------- | --------------------------------------------- |
| Unit       | `node --test tests/live-look.test.mjs` | PASS (7/7) | console                                       |
| Real WebGL | `npm run verify:live-look`             | PASS       | `%TEMP%/zhuda-live-look/evidence/report.json` |
| Full gate  | `npm run verify`                       | see below  | console                                       |

Measured by `verify:live-look`:

- Vertex hook shifting a plate 3 m along +X: plate centroid moved 92 px, its
  shadow centroid moved 72 px (ShadowCaster runs the hook; the shadow falls
  on the floor at a steeper angle, so it moves fewer pixels).
- Continuous `setLook` (day → dusk): returned `'updated'`, mean luminance
  127.3 → 49.5, same `postProcess` and sky material objects, 0.04 ms per call
  averaged over 60 calls.
- Structural `setLook` (light fog off, then on): both `'rebuilt'`, new HDR
  chain each time, back to the first frame within 0.17 mean luminance.
- 30 off/on rebuild cycles: `inspectSceneResources()` identical before and
  after (52 resources); frame within 0.01 of the first.
- Panorama change and an out-of-range sun refused with a message; look and
  frame unchanged (0.03 mean difference).
- Grade off while water is on the stage is refused by validation (water
  needs the HDR chain).

- Sky light recoloured in place (`ambientGround` set): 0.17 ms per call
  (was 3.3 ms with a full CPU prefilter), resource count unchanged, and the
  frame matches a stage freshly mounted with the same colours (0.11 mean
  difference). `prefilterZhudaHemisphere` equals a full prefilter within
  1e-5 (unit test).

Consumer probe (`larkhollow-probe`, 135 nodes, 60 000 hooked grass blades,
1250×937, same GPU): grass casts and receives shadows; `setLook` per call
0.36 ms (sun only) and 0.41 ms with `ambient` changing (3.33 ms before the
in-place hemisphere). Forced frame 32.0 / 27.6 / 16.8 ms at quality 3 / 2 / 1
through `setLook(zhudaLookForQuality(...))`; the governor stepped down and
held through a full day cycle with no errors. Level 0 removes the grade and
is refused while water is on the stage, so the probe stops at 1.

`runtime3d-types.mjs` normalises emitted paths: on Windows it generated
nothing and `types:check` passed vacuously; it now reported 3 stale
declarations before regeneration and 0 after.

## Lifecycle and failure cases

Repeated rebuilds (60), refusals before any change, and rollback to the
previous look on a failed rebuild (code path; not forced on GPU) are covered.
Context loss is not exercised.

## Limits and decision

- WebGPU, mobile GPUs and Safari are not exercised.
- Rollback after a GPU-side failure mid-rebuild is not forced in the browser.
- The first hemisphere ambient of a page still pays one CPU prefilter
  (~3 ms) for the bases.
- Quality level 0 cannot be applied to a stage with water (validation).
- The vertex hook does not update mesh bounds; large displacement needs
  larger bounds from the caller (documented).

Decision: **Accepted for desktop WebGL**; other backends and devices remain
unverified.

## Merge into the main line (2026-11-12)

The working copy (on `74f01f5`, never committed) was reviewed and applied on
top of `404e8bc` plus later changes; nothing conflicted. Rerun on macOS (Apple
M4, headless Chrome):

- `node --test tests/live-look.test.mjs`: 8 pass. `npm run verify`: 431 pass.
- `npm run verify:live-look` (WebGL): the same figures as above.
- `LIVE_LOOK_RENDERER=webgpu npm run verify:live-look`: pass, same figures, no
  device errors. The fixture reads the frame through a 2D canvas on WebGPU and
  the script serves the bundle's shader compilers. This closes the first item
  of "not verified" for desktop WebGPU.
- A consumer game that uses `ZhudaSceneLook` (quality levels, hemisphere
  ambient, water) passes its own checks on the merged code.
