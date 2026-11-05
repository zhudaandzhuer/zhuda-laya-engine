# Agent task: minigame-cli

Status: Implemented; macOS packaged; host/device acceptance deferred  
Owner: Zhuda engine maintainers  
Last reviewed: 2026-11-06

## Source requirement

User: “對接所有…官方支持的國內平台小遊戲打包…不用打開ide”;
“開始優化 可以拿mac os測試打包”. Official reference:
https://github.com/layabox/layaair-cli and
https://www.layaair.com/3.x/doc/released/minigame/.

## Goal

Provide a reproducible, pinned official LayaAir CLI route from an independent
Zhuda consumer to supported mini-game build targets, without opening the IDE.
Measure actual packaging on this macOS host, separately from host/device execution.

## Invariants

- Keep public SDK imports, consumer source guards, asset selection and existing
  Prefab evidence gates. Candidate packages must remain visibly unapproved.
- Keep consumer sources and previously successful output intact on failure.
- Pin and verify official CLI/runtime compatibility; never silently fall back
  to another version or replace vendor libraries with an unknown SDK.
- Discover real registered build targets; do not advertise Kuaishou by inference.
- Native applications, browser WebGPU and mini-game host acceptance are distinct.
- Keep logical assets, clocks, audio authority and disposal in existing contracts.

## Dependencies

- Official CLI 3.4.2 installed under a configured external toolchain directory.
- Existing consumer compiler, source audits, topology, package archive,
  staged publication, strict SDK declarations and runtime lifecycle.
- Platform build templates/SDKs supplied by the official toolchain.

## Scope

### Engine

- packages/compiler, public runtime/types only where integration requires them,
  package bins, tests, neutral fixtures, documentation and verification scripts.

### Consumer or adapter

- Generated official build workspace lives under consumer output staging.
- Independent neutral consumer and macOS packaging logs live outside the engine.
- Platform application IDs, signing and game assets stay consumer-owned.

## Non-goals

- Store submission, account registration, ads/payment gameplay, production assets.
- Claim mobile or platform execution from a successful archive/build alone.
- Native APK/IPA, Kuaishou without a verified adapter, universal WebGPU support.

## Acceptance checks

1. Discover exact-version CLI and available mini-game targets on macOS.
2. Package an independent public-SDK consumer through the real official CLI;
   inspect entry, adapter, SDK, selected assets and output checksums.
3. Reject missing/wrong CLI, unsupported targets, incompatible runtime features,
   compilation failures, timeout/cancellation and malformed output with guidance.
4. Demonstrate prior successful output survives deliberate failures.
5. Run strict independent consumer types/Doctor/build, targeted tests,
   `npm run verify`, `git diff --check` and `git status --short`.
6. Record each platform build and host/device execution separately. Unavailable
   SDK/account/device checks remain UNAVAILABLE, never PASS.

## Evidence to attach

- External neutral consumer, official CLI version/hash and command logs.
- Platform package manifests/hashes and failure-preservation regression results.
- Engine verification log and explicit platform execution limitations.

## Unverified limits

- Mini-game host/device runtime behavior, platform credentials and store acceptance.
- Availability of per-platform external packaging dependencies on macOS.

## Rollback

Baseline: 3f9650e. Existing browser builds remain available. New platform builds
publish only after their own checks; failures preserve the previous generation.
