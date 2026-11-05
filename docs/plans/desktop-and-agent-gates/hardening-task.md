# Agent task: usable desktop, sequence and asset delivery

Status: Implemented; macOS consumer and packaged-host verification passed; Windows hardware unavailable
Owner: engine maintainers
Last reviewed: 2026-11-05

## Source requirement

User: 「好，依序去直接優化到底」. Follow-up review of the additions at
`70e35f9` found incomplete async cancellation, shallow timeline validation,
permissive evidence checks and source-only SDK updates.

## Goal

Deliver usable public APIs and packaged artifacts, with bounded failure paths
and independent consumer evidence, before expanding the next roadmap item.

## Invariants

- Reuse AssetProvider and ZhudaAssetCache; one authority per resource.
- Abort/timeout settles even when an adapter ignores its signal. Late owned
  results release once; disposal cannot resurrect a request or a cache entry.
- Timeline samples are finite, immutable and exact at a key boundary.
- A report with missing evidence or invalid gate settings must fail.
- A declared decoder hash is metadata, never proof its implementation matches.
- Rendering, device support and package installation are distinct evidence.

## Dependencies

- Existing provider/model cache, runtime session, compiler and Chrome fixtures.
- Meshoptimizer 1.3.0 (MIT) for an optional embedded glTF Meshopt adapter.
- Pinned Electron host; Windows hardware remains external acceptance.
- pngjs 7.0.0 for bounded Node-side PNG sequence comparisons.

## Scope

### Engine

- Harden the new provider, decoder, timeline and sequence APIs and tests.
- Wire a real pinned Meshopt adapter into the existing provider model path.
- Correct desktop bundle staging and package public artifacts consistently.
- Compare keyframe PNG pixels against separate references and fail on frame
  substitution, missing approval metadata, invalid budgets and escaped paths.
- Update MCP discovery, documentation and reproducible verification records.

### Consumer or adapter

- Independent temporary consumer imports only the packed public SDK.
- Reuse neutral engine geometry as a regression fixture; no game assets.

## Non-goals

- Claiming KTX2/Draco, GPU-driven/HLOD, XR or physical-camera postprocessing
  without implementing and measuring those separate pipelines.
- Moving game rules, Slot RNG/payout/RGS/wallet or certification into core.

## Acceptance checks

1. Regression fixtures reproduce stuck callbacks, stale release, malformed
   settings, immutable inputs and exact timeline sampling; fixes pass.
2. `npm run verify`; `git diff --check`; `git status --short`.
3. Independent packed consumer typecheck, ESM/CJS exports and public compiler
   build; actual neutral Meshopt model rendering on WebGL and WebGPU.
4. 30 repeated load/unload cycles, deliberate corrupt compressed bytes,
   cancellation and recovery; output report outside the repository.
5. Desktop staging test verifies files are embedded in package resources and
   rejects traversal/symlink escape. Windows GPU result stays UNAVAILABLE here.
6. Packed sequence CLI compares real repeated camera captures and rejects an
   intentionally wrong frame. Official browser profiles retain real WebGPU draws.

## Evidence to attach

- Log and reports under `/tmp/zhuda-next-round-hardening/`.
- Strict consumer source, fixture hashes, actual renderer diagnostics and PNGs.
- A verification document with measured results and remaining boundaries.

## Unverified limits

Windows physical GPU, physical mobile, XR hardware and production seller models
are not available for acceptance in this checkout.

## Rollback

Baseline `70e35f9`. Keep directory delivery and uncompressed embedded GLB usable;
do not bypass a failed evidence gate.
