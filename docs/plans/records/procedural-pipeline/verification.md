# Verification record: procedural-pipeline

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `472cea5`, SDK 1.16.0)  
Date: 2026-11-10

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, npm 11.20.0, TypeScript 5.9.3 (lockfile pin).

## Contribution as received

The archive matched `472cea5` plus 23 modified and 27 new files; nothing was
deleted. Its own report (332/343 in a Node 22 sandbox without three
dependencies) was not relied on; every check below was rerun here.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Install | `npm ci` | PASS |
| Format | `npm run format`, then `npm run format:check` | 13 contributed files needed formatting; PASS after |
| Declarations | `npm run types:check` | PASS, 0 stale under 5.9.3 |
| Type check | `npm run verify` | FAIL as received: `ModuleHarness.ts` iterated `URLSearchParams`, which needs lib `DOM.Iterable` (TypeScript 6 includes it in `DOM`). Fixed with `forEach`; PASS |
| Full gate | `npm run verify` | PASS, all tests (see commit) |
| Lint | `npm run lint` | PASS |
| Package | `npm pack --json --pack-destination <tmp>` without extra flags | PASS: valid JSON, one build, 418 files, no `.map`, no `packages/types/*.ts`, 10 procedural declarations |
| Remote editor sessions | `node --test tests/review-hardening.test.mjs` | Found while landing: the session cookie had one name for every port, so two remote editors on one host evicted each other. The name now carries the port; new test fails on the received code and passes now |
| Browser batches | `verify:prefab-browser`, `prefab-editor-responsive`, `prefab-editor`, `prefab-editor-play`, `slot-foundation`, `runtime-feedback`, `crowd`, `model-showcase`, `next-round`, `webgpu-consumer` | PASS, all 10 |
| Browser SDK pins | `npm run browser:check` | PASS |

## Real WebGL draw

`npm run verify:procedural` builds the `3d` browser bundle from this tree,
renders `tests/fixtures/procedural-draw.ts` and asserts on the frames.

| Scene | Result |
| --- | --- |
| Starter yard | 7 placed props merged into 4 material batches plus ground; no page or console errors; 512 maps upload with 10 mip levels; bake 80–210 ms per map on desktop |
| Normal decode, U axis (red) | Flat normal-mapped panel vs real geometry with the same relief under one light: correlation 0.986 |
| Normal decode, V axis (green, `directx`) | correlation 0.998 |
| Same panel without its normal map | shading spread 1 (flat), so the relief comes from the map |

Found while landing: the first draw showed no relief at all. The geometry kit
and merge produce `POSITION,NORMAL,UV`, so prop batches had no tangent frame and
the normal maps had no effect. `instantiateZhudaPropBatches` now adds tangents
with the existing `computeMeshTangents`; the received unit test had asserted
the tangent-less declaration and now asserts `POSITION,NORMAL,UV,TANGENT`
(fails on the received code). `docs/procedural-assets.md` tells authors of
custom `MeshData` to add tangents too.

Starter look (not an approval): corrugation and grime read correctly; rust
spots repeat visibly from tile to tile, and the container paint reads close to
white under this light.

## Limits and decision

- WebGPU, mobile devices and runtime baking cost on mobile are not measured.
- The starter recipes are samples; their art quality is not approved.
- Version stays 1.16.0 and no browser SDK is published by this change.

Decision: **Implemented within scope; desktop WebGL verified.**
