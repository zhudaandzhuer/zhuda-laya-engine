# Agent task: consumer-review-reliability

Status: Complete within the scope below; local verification recorded, no package release claimed

Owner: Engine compiler and acceptance tooling

Last reviewed: 2026-11-04

## Source requirement

User supplied the 2026-11-04 consumer engine review and asked us to examine the other
agent's optimization suggestions as part of improving our engine responsibilities.
Source: `<external-evidence>/ENGINE_MAIN_REVIEW_20261104.md`,
sections B (requested DPR 2, measured DPR 1 nevertheless PASS), C (failed build
replaced successful web output but retained the old ZIP), D–F (audio, provider,
evidence dependency and declaration gaps). Review base: `0127bd2`.

## Goal

Fail environment-inaccurate evidence and preserve the complete last successful
consumer output when compilation, evidence or package checks fail. Provide a
shared preview provider seam and explicit asset inclusion while accurately
tracking the larger audio, dependency graph and vendor declaration work.

## Invariants

- Requested browser metrics and measured metrics remain distinct; desktop
  emulation never certifies a phone.
- Pixel equality cannot override a failed environment or provenance check.
- All gates run on staging output before publishing web, payload manifest,
  build report and ZIP; a failed build leaves last-good bytes unchanged.
- Reuse public AssetProvider and existing prefab cache/lease lifecycle.
- Preserve previous consumer-route working-tree changes; no game assets or
  consumer source edits in this task.

## Dependencies

- Consumer builder, prefab checker/preview/watcher, existing public
  DirectoryAssetProvider/AssetProvider and PrefabDefinition declarations.
- Installed Chrome for real desktop WebGL regression; neutral fixture only.
- Existing consumer-build, prefab and provider regression tests.

## Scope

### Engine

- `packages/compiler/consumer-build.mjs`, output publication helper, checker,
  preview, watcher diagnostics, tests, docs and version metadata.

### Consumer or adapter

- Temporary independent neutral consumer used for actual browser checks.
- consumer review is read-only; no pin change, game modification or deployment.

## Non-goals

- Implementing MP3/BGM or per-component evidence invalidation in this patch.
- Certifying physical mobile hardware or resolving all upstream vendor types.
- Claiming a multi-path filesystem transaction is power-loss atomic.

## Acceptance checks

1. `node --test tests/consumer-publication.test.mjs`: compile, missing/stale
   evidence and package-limit failures preserve HTML, manifest, report and ZIP
   hashes, watcher HTTP last-good output, and permit a subsequent good build.
2. `node --test tests/prefab-environment.test.mjs`: a DPR 2 request with measured
   DPR 1 fails even with identical pixels; malformed metrics fail early.
3. `PREFAB_FIXTURE_DIR=/tmp/zhuda-consumer-reliability node scripts/verify-prefab-browser.mjs`:
   real Chrome neutral Prefab root/child at landscape/portrait and DPR 1/2;
   same-size wrong integrity fails, same provider factory used for Scene/preview.
4. `npm run verify`, `git diff --check`, `git status --short`; store logs and
   exact replay commands in verification.md. Verify changed local links.

## Evidence to attach

- Test/build logs and output byte hashes.
- Browser/WebGL report with requested/measured metrics, provenance and actual,
  baseline and diff images in the external temporary fixture directory.
- Explicit unavailable physical iOS/Android results.

Results and remaining limits are recorded in [verification.md](verification.md).

## Unverified limits

- Browser DPR emulation is not device performance or compositor evidence.
- Publication rollback covers caught errors, not power loss or external writers.
- Full payload evidence remains conservative; audio sample APIs and vendor
  declaration repair need separate measured work.

## Rollback

Base `0127bd2` plus the existing consumer-route working tree. Revert only this
task's changes on regression; keep failure evidence and do not weaken gates.
