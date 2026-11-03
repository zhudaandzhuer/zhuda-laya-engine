# Verification record: no-sleep

Task document: `docs/plans/records/no-sleep/task.md`  
Commit: `82c4614`  
Date: 2026-11-03

## Environment

- OS / browser / device: macOS host; Node test runner; no real mobile browser
- Node and package manager: Node 24+; npm
- Engine and consumer commits: engine `82c4614`; no consumer FairyGUI runtime
- DPR, viewport and network mode: not applicable to headless wake-lock fixtures

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, Doctor and regression | `npm run verify` | PASS; 106/106 tests, 0 Doctor blockers | `/tmp/zhuda-no-sleep-verify-final.log` |
| Focused wake-lock lifecycle | `node --test tests/no-sleep.test.mjs` | PASS; 6/6 tests | `/tmp/zhuda-no-sleep-focused-final.log` |
| Public consumer types | Temporary strict TypeScript consumer imports `NoSleepAdapter`, options, provider and diagnostics from package root | PASS | `/tmp/zhuda-no-sleep-public-types-final.log` |
| FairyGUI exclusion | Dependency and topology scan over `package.json`, `packages/core/TopologyGraph.ts` and `zhuda-build.mjs` | PASS; no FairyGUI dependency/topology reference | `/tmp/zhuda-no-fairygui-scan.log` |
| Diff hygiene | `git diff --check` | PASS | `/tmp/zhuda-no-sleep-diff-check-final.log` |
| Real browser/device | Use a supported mobile browser, tap a user gesture, verify screen stays awake, background/foreground recovery and OS release | UNAVAILABLE; no device/browser capture in this run | none |

## Lifecycle and failure cases

The fake browser fixtures cover:

- successful native `screen` request and explicit disable/dispose release;
- unsupported provider and `NotAllowedError` denial without claiming enabled;
- visibility hidden, blur and focus release/reacquire;
- stale in-flight request resolved after disable and released safely;
- native sentinel `release` event reacquisition while the owner remains enabled;
- rejected sentinel release captured in diagnostics without an unhandled promise;
- one-shot gesture auto-enable and listener cleanup.

## Prefab evidence (visual work)

Not applicable. This task adds a platform lifecycle adapter only.

## Limits and decision

The adapter uses the browser Screen Wake Lock API and does not override OS power
policy or keep hidden tabs awake. Browser permission policy, iOS/Android vendor
behavior and unsupported-browser fallback remain unverified. FairyGUI remains a
consumer dependency as documented in [`platform-adapters.md`](../../../platform-adapters.md).

Decision: **In progress** because the engine and type checks pass, but the
required real browser/device wake-lock check is unavailable.
