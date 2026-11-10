# Verification record: consumer-public-sdk

Task document: `docs/plans/records/consumer-public-sdk/task.md`  
Implementation commit: `99116a147a0df7a6d66703aa0e0f762a73dbc9f0`  
Date: 2026-11-03  

## Environment

- OS / browser / device: macOS 27.0.1; Chrome 156.0.8078.80 headless with
  SwiftShader fallback; no iOS or Android hardware was available.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: engine `99116a147a0df7a6d66703aa0e0f762a73dbc9f0`;
  consumer `<external-evidence>/consumer` pins the public SDK to
  `99116a147a0df7a6d66703aa0e0f762a73dbc9f0` in `package-lock.json`.
- DPR, viewport and network mode: DPR 1; game browser checks use 572×1024;
  Prefab preview uses 640×360 logical pixels; local HTTP directory provider.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Engine build, types, Doctor and regression | `cd <external-evidence>/Zhuda-LayaAir && npm run verify` | PASS; 115 tests | `/tmp/zhuda-engine-verify-99116a1.log` |
| Consumer build, types, Doctor, unit tests and game gates | `cd <external-evidence>/consumer && npm run verify` | PASS; 95/95 gates and 3/3 unit tests | `/tmp/consumer-verify-99116a1-final.log` |
| Main Scene browser/CDP | `cd <external-evidence>/consumer && node scripts/verify-browser-cdp.mjs` with `npm start` serving `dist/web` on 127.0.0.1:8891 | PASS; boot, 13 probes, six key frames, zero console errors | `/tmp/consumer-browser-cdp-99116a1-final2.log`, `<external-evidence>/01-idle-corridor.png` through `08-small-win-tumble.png` |
| Isolated Prefab browser lifecycle | `cd <external-evidence>/consumer && node scripts/verify-showcase-cdp.mjs` | PASS; all 11 Prefab IDs, navigation teardown, zero errors | `/tmp/consumer-showcase-cdp-99116a1-final3.log` |
| Public SDK Prefab pixel comparison | `node node_modules/zhuda-laya-engine/packages/compiler/prefab-check.mjs --url="http://127.0.0.1:8891/prefab-preview.html?id=ui/control-bar" --baseline=evidence/prefabs/control-bar-baseline.png --output=evidence/prefabs/control-bar-public-sdk-report.json` | PASS; 0 different pixels | `<external-evidence>/control-bar-public-sdk-report.json` and its `.png`/baseline |
| Diff and status | `git diff --check && git status --short` from the engine root | PASS; no source changes after verification | engine checkout |

## Lifecycle and failure cases

The engine regression suite covers timeout, cancellation, stale completion,
malformed Prefab data, shared-lease release and 30 create/dispose cycles. The
consumer unit suite repeats the same public `ZhudaPrefabLibrary` lifecycle and
checks named child patches. The main browser report verifies that the Scene
keeps one live Prefab instance and six ready resource entries, with no pending
loads or console errors. The isolated browser report also navigates away to
exercise `pagehide` disposal.

## Prefab evidence (visual work)

| Prefab ID / child path / state | Source and dependency revisions | Isolated replay command / environment | Reference / actual / diff | Result |
| --- | --- | --- | --- | --- |
| `ui/control-bar` / root / `idle` | `assets/prefabs/ControlBar.lh` SHA-256 `d7f5c71bf26125b70b21b4d0ec58e87ac61d6963fd3d87c01c64e760da90c33a`; texture hashes are recorded in the public report; engine `99116a1` | `node node_modules/zhuda-laya-engine/packages/compiler/prefab-check.mjs ...`; Chrome 156 headless, DPR 1, local provider | `evidence/prefabs/control-bar-baseline.png`, `control-bar-public-sdk-report.json.png`, report diff; identical 799×366 captures, 0 different pixels | PASS |
| `ui/control-bar` / root / `idle` in main Scene | Same Prefab and texture hashes; provider `consumer-logical-directory` | `node scripts/verify-browser-cdp.mjs`; Chrome headless 572×1024 | `evidence/prefabs/control-bar-scene-report.json`, `evidence/01-idle-corridor.png`; same Prefab ID and provenance source hashes | PASS |

The isolated preview and main Scene instantiate the same
`ControlBar.lh` definition. The preview entry remains runnable after
Scene integration. The baseline was refreshed once because the current Chrome
capture clip is 799×366 rather than the previous 800×450; the new baseline and
actual image are byte-identical and the report records both SHA-256 values.

## Limits and decision

- Real iOS/Android rendering, device GPU performance, context-loss behavior on
  hardware and production network/CDN delivery remain unverified.
- The consumer still contains legacy dynamic renderers for components that have
  not yet passed an isolated Prefab gate. The migrated control bar proves the
  workflow for the changed component; it does not claim every renderer is now a
  serialized Prefab.

Decision: **Accepted** for the public SDK migration and verified control-bar
Prefab scope. The remaining dynamic components stay consumer-owned follow-up
work under the Prefab-first gate.
