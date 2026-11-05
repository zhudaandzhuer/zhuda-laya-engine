# Verification: desktop-and-agent-gates

Task: [task.md](task.md). Date: 2026-11-05. Baseline:
`9612be0ab7e01eec0332ff63be02e76904d33f4b`.

## Checks

| Check | Exact command | Result | Evidence |
| --- | --- | --- | --- |
| Focused sequence, timeline and model capability tests | `node --test tests/ci-sequence-gate.test.mjs tests/timeline.test.mjs tests/model-showcase.test.mjs` | PASS, 14 tests | terminal output |
| Full build, declarations, Doctor and regressions | `npm run verify` | PASS, 222 tests, zero declaration diagnostics | `/tmp/zhuda-next-round-verify.log` |
| Example host dependency lock | `npm install --ignore-scripts` in `examples/windows-webgpu` | PASS; Electron 36.9.5 lock recorded | `examples/windows-webgpu/package-lock.json` |
| Host syntax | `node --check examples/windows-webgpu/main.mjs` | PASS | terminal output |
| Keyframe CLI help | `node packages/ci-gate/verify-sequence.mjs --help` | PASS | terminal output |
| Documentation and whitespace | `git diff --check`; local Markdown target check | PASS | terminal output |

The sequence gate accepted a deterministic WebGPU report at `t=0,1.5,3`, and
rejected fallback/WebGL, non-monotonic time, missing images, path traversal,
metric overrun and SHA tampering. The timeline test covers linear sampling,
fixed updates, one-shot event cues, reset and disposal. The model catalog test
keeps KTX2/Basis, Meshopt and Draco explicitly unsupported.

## Windows acceptance

`examples/windows-webgpu` is a reproducible Electron host using an `app://bundle`
origin. The host has not been run on a Windows GPU in this environment. The
target-machine procedure is:

```powershell
cd examples/windows-webgpu
npm ci
$env:ZHUDA_WEB_ROOT = "C:\path\to\consumer\dist\web"
$env:ZHUDA_ENTRY = "index.html"
$env:ZHUDA_WINDOWS_WEBGPU_OUT = "$PWD\evidence"
npm run verify
npm run package
```

The resulting `report.json` must contain a ready `WebGPURenderEngine`, a
non-fallback adapter, no renderer errors and the Windows/Electron/Chromium/GPU
identity. This is still **UNAVAILABLE** until a Windows GPU agent attaches that
report. WebView2, signed installers, Steam, native Laya runtime and mobile are
also unverified.

## Decision

**Implemented; desktop preparation verified. Windows hardware acceptance remains
UNAVAILABLE.** The next asset-format step must add a pinned decoder and real
target-device evidence before changing the explicit unsupported catalog.
