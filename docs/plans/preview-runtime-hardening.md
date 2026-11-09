# Agent task: preview-runtime-hardening

Status: Accepted  
Owner: Codex  
Last reviewed: 2026-11-07  

## Source requirement

User request: strengthen the current 2D/Scene/3D preview-edit stack after the global runtime audit. The required fixes are foreign Laya realm protection, a selectable hidden-preview resource release policy, and an explicit lightweight 2D editor profile.

## Goal

A preview cannot silently attach to an already initialized foreign Laya realm; the shared showcase can release hidden Scene/3D preview resources by default; and the 2D editor's minimal feature/module profile is explicit and regression-tested.

## Invariants

- The public runtime remains LayaAir 3.4.2 and uses one renderer/backend per realm.
- DOM/SVG editor chrome remains outside the Laya canvas.
- Stable asset IDs, provider/cache leases, cancellation and disposal contracts remain unchanged.
- Existing consumers can boot and dispose the same Zhuda realm repeatedly.
- No consumer game assets are added to the engine source tree.

## Dependencies

- `packages/core/DeclarativeSDK.ts`
- `packages/core/TopologyGraph.ts`
- `packages/compiler/prefab-editor-server.mjs`
- `examples/slot-symbol-prefab/src/Main.ts`
- Existing runtime/editor tests and public type declarations.

## Scope

### Engine

- Add a runtime-realm inspection/guard used by `ZhudaEngine.boot`.
- Keep the 2D editor on the `core + 2d + ui` profile and make its files explicit.

### Consumer or adapter

- Update the engine-owned slot showcase's shared preview switch to release hidden Scene/3D handles by default, with an explicit retain query for fast iteration.

## Non-goals

- Do not merge multiple Laya realms into one page.
- Do not implement a full DCC editor or GPU-resource hot unload for arbitrary consumer scenes.
- Do not claim iframe/native context recovery is lossless.

## Acceptance evidence

1. A fake initialized foreign `Laya` realm is rejected with an actionable iframe/runtime-host error; an uninitialized Laya namespace remains boot-eligible.
2. The 2D editor server exposes exactly `laya.core.js`, `laya.webgl_2D.js`, and `laya.ui.js`, and its client boots only `core/2d/ui`.
3. The slot showcase defaults to release-hidden resource policy, accepts `?resources=retain`, and reports the policy.
4. `npm test`, `npm run typecheck`, `npm run verify`, and `git diff --check` pass.

## Evidence to attach

- Test/build output from the commands above.
- Runtime guard unit tests and editor/profile regression tests.
- Slot showcase typecheck/build result.

## Unverified limits

- A real external foreign Laya app and Windows/mobile device integration still require separate browser/device acceptance.
- DOM iframe rendering is not a substitute for native GPU lossless recovery.

## Rollback

Revert the files changed for this task to the last known good working tree state; the existing boot behavior and retained hidden preview resources remain the fallback.
