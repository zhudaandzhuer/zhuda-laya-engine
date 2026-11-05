# Verification record: minigame-cli

Task document: `docs/plans/records/minigame-cli/task.md`  
Commit: `6907c8052b8f38e45427e44dd0badedd2855b8bc`  
Date: 2026-11-06

## Environment

- OS: macOS Darwin 27.0.0, arm64
- Node: v26.12.0; official LayaAir CLI 3.4.2 at `~/.layaair/3.4.2`
- Independent consumer: `/Users/yaowei/Desktop/zhuda-minigame-acceptance-20261106/consumer`
- Consumer and engine source stayed outside each other's production assets.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Toolchain and consumer | `MINIGAME_OUT=/Users/yaowei/Desktop/zhuda-minigame-acceptance-20261106 node scripts/verify-minigame.mjs` | PASS | `.../evidence/identity.json`, `platforms.json` |
| Strict types | same command (`tsc --noEmit -p consumer`) | PASS | `.../evidence/typecheck.log` |
| Doctor | same command (`zhuda-doctor --project consumer`) | PASS | `.../evidence/doctor.log` |
| Browser build | same command (`zhuda-build --project consumer`) | PASS | `.../evidence/web-build.log` |
| Official platform packaging | same command; all 9 registered targets | PASS | `.../evidence/packaging.json`, `consumer/dist/minigames/*` |
| Failure preservation | deliberate syntax and size failures in the same command | PASS | `.../evidence/preserved.json` |
| Engine regression | `npm test` | PASS after the generated bundles are rebuilt; one unrelated timing fixture is environment-sensitive when run in parallel | repository test output |
| Real platform/device runtime | platform host launch, signing, store upload and physical devices | UNAVAILABLE | required consumer/platform reports |

Measured package main artifacts in this run were: ByteDance 2,254,853 bytes,
OPPO 632,223, VIVO 6,273,705, WeChat 2,259,288, Xiaomi 1,267,366, Alipay
2,294,072, Taobao 2,321,293, Bilibili 2,249,467 and Huawei 2,237,708.
These are static outputs from the official CLI; they are not device results. The
consumer manifest was checked to pin the same engine version as the packaged SDK.

## Lifecycle and failure cases

The CLI pins the official version and three-file fingerprint, uses a per-target
lock, builds into a private staging directory, rejects symlinks and browser-only
consumer APIs, verifies the emitted entry/libraries/assets, and publishes only
after all gates pass. Deliberate compilation and package-size failures left the
previous `game.zip` and `consumer-build.json` checksum unchanged. Cancellation
and timeout paths terminate the official process group and leave the prior
generation in place.

## Limits and decision

Host runtime, signing credentials, store submission, real WebGL on each mini-game
host, device DPR/input/audio behavior, subpackages, remote assets, WebGPU and
WASM physics remain unverified or intentionally rejected. Kuaishou has no
registered official 3.4.2 target. Decision: **Implemented for reproducible static
macOS packaging; platform/device acceptance remains deferred.**
