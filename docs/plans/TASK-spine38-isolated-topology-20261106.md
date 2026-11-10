# Agent task: spine38-isolated-topology-20261106

Status: In progress  
Owner: Zhuda engine / consumer integration  
Last reviewed: 2026-11-06

## Source requirement

the Spine 3.8 consumer game has real Spine 3.8.99 source assets and must remain isolated from
the existing Spine 4.2 package. The consumer migration is blocked because the
engine vendor contains `spine-core-3.8.js`, but the public topology and boot
contracts do not expose a `spine38` feature.

## Goal

Expose a deterministic, mutually exclusive Spine 3.8 topology that loads the
real 3.8 runtime before the existing Laya Spine adapter, lets a consumer build
an isolated package, and reports the selected Spine version at boot.

## Invariants

- A page loads exactly one Spine core runtime; Spine 3.8 and 4.2 cannot coexist
  in one topology.
- `laya.spine.js` is loaded after the selected Spine core and WebGL 2D module.
- Game assets stay in the consumer repository; this engine change only exposes
  public runtime/compiler contracts and tests.
- A topology PASS proves ordering and package composition only. It does not
  claim the Spine 3.8 consumer game visual or device parity.
- Every async Spine load remains subject to the consumer lifecycle and release
  gates.

## Dependencies

- `vendor/laya-3.4.2/libs/spine-core-3.8.js`
- `vendor/laya-3.4.2/libs/spine-core-4.2.js`
- `vendor/laya-3.4.2/libs/laya.spine.js`
- consumer the Spine 3.8 consumer game source probe and real Spine 3.8 assets

## Scope

### Engine

- `packages/core/TopologyGraph.ts`
- `packages/core/DeclarativeSDK.ts`
- `packages/types/zhuda-bootstrap.d.ts`
- `packages/compiler/consumer-build.mjs`
- `packages/compiler/zhuda-build.mjs`
- isolated topology/compiler tests and this plan

### Consumer or adapter

- consumer updates its feature tag, runtime probe, manifest and pinned
  engine SHA after the engine commit is created.

## Non-goals

- Do not port consumer game rules, HUD, audio, or Unity scene behavior here.
- Do not convert the 3.8 asset to Spine 4.2 or draw a PNG fallback.
- Do not claim acceptance gates or device parity from a build-only result.

## Acceptance checks

1. `npm run typecheck` passes with the public `spine38` type.
2. `npm test` covers Spine 3.8 ordering, conflict rejection, and compiler
   script composition.
3. `npm run build` emits the SDK with the updated public topology.
4. `npm run verify` passes, including Doctor and all existing regressions.
5. The consumer builds the Spine 3.8 consumer game with `spine-core-3.8.js` and
   `laya.spine.js`, with no `spine-core-4.2.js` in that artifact.
6. A browser probe parses the real Spine 3.8 JSON/atlas with the isolated runtime;
   if rendering or lifecycle evidence is unavailable, the package remains
   `asset-migration` and the acceptance report remains BLOCKED.

## Evidence to attach

- Engine test/build output and `dist/build-manifest.json`
- Consumer the Spine 3.8 consumer game build report and ordered library list
- Browser console/runtime probe report, including parse and disposal results

## Unverified limits

- Device GPU behavior, exact Unity frame parity, audio, input and all 13
  acceptance gates remain unverified until consumer runtime evidence exists.

## Rollback

Revert to engine commit `cb02e44e048451a14282c07faa24b617b3c3483d` and keep
the Spine 3.8 consumer game on the source-only probe if any topology, compiler, or runtime
regression appears.
