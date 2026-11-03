# Agent task: no-sleep

Status: In progress  
Owner: Codex  
Last reviewed: 2026-11-03

## Source requirement

User decision: 「可以，我直接內建nosleep，但是不要fairygui，有專案需要fairygui，他們應該自己引入」.

## Goal

Ship a small built-in screen wake-lock service in the public SDK so consumers
can keep gameplay awake without adding a third-party NoSleep dependency, while
leaving FairyGUI entirely consumer-owned.

## Invariants

- The service never claims a lock when the browser API is unavailable or a
  request fails; diagnostics expose the reason.
- Wake locks are acquired only from an explicit user gesture or an explicit
  consumer call and are released on page hide, blur/pagehide and disposal.
- A visible page with an enabled owner reacquires a released native sentinel
  after visibility returns, with stale sentinel results ignored.
- All browser listeners and sentinels have an explicit cleanup path.
- FairyGUI runtime, packages, assets and topology nodes remain outside this
  engine repository and SDK bundle.
- The public `.ts` and `.d.ts` declarations, ESM/CJS exports and docs stay in
  sync.

## Dependencies

- `packages/core/NoSleepAdapter.ts`
- `packages/types/zhuda-core.ts` and `.d.ts`
- `packages/core/index.ts` and `packages/types/index.d.ts`
- `docs/audio.md` / new platform lifecycle guidance
- Node fake-browser regression fixtures

## Scope

### Engine

- Add `NoSleepAdapter` with native `navigator.wakeLock` support, lifecycle
  guards, bounded request generation and diagnostics.
- Export public options/types and add focused tests for support, rejection,
  visibility, stale results and disposal.
- Update package version and generated SDK artifacts if the public surface
  changes.

### Consumer or adapter

- None. FairyGUI remains an optional consumer integration.

## Non-goals

- Bundling FairyGUI or adding its runtime to the engine topology.
- Vendoring FairyGUI assets or writing a FairyGUI scene/prefab converter.
- Claiming a wake lock is available on browsers/devices that do not expose the
  Screen Wake Lock API.
- Replacing OS power settings or keeping a hidden/background tab awake.

## Acceptance checks

1. `NoSleepAdapter` acquires a native screen sentinel after an explicit call,
   reports `unsupported`/`denied` failures and releases it on disable/dispose.
2. Visibility/pagehide and blur release the lock; a visible enabled owner can
   reacquire it; stale promises cannot install a sentinel after disable.
3. Rejected requests and sentinel `release` failures are captured in
   diagnostics without unhandled promises.
4. A strict consumer imports the adapter and public types from the package root.
5. `npm run verify`, `git diff --check` and `git status --short` pass.
6. Real browser/device wake-lock output is reported as PASS only after an
   actual supported browser run; otherwise it remains UNAVAILABLE.

## Evidence to attach

- Test/build output: full verify and focused no-sleep test logs.
- Browser/device report: actual Screen Wake Lock check or explicit UNAVAILABLE.
- Resource/lifecycle report: fake sentinel request/release/stale counters.
- Screenshots/video/logs: only if a real device run is available.

## Unverified limits

- Browser permission policy, OS battery policy and vendor-specific wake-lock
  behavior on iOS/Android.
- Fallback behavior on browsers without `navigator.wakeLock`.

## Rollback

Last known good commit: `1dc91e6` (audio hardening on `main`). Revert the
no-sleep commit to remove the service; existing audio and UI behavior remains.
