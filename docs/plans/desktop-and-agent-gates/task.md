# Agent task: desktop-and-agent-gates

Status: In progress
Owner: engine maintainers
Last reviewed: 2026-11-05

## Source requirement

User request: 「好，依序去直接優化到底」 after the roadmap review in the
attached engine-vendor assessment. The first two shared priorities are Windows
packaged WebGPU acceptance and a generic multi-keyframe Agent gate.

## Goal

Give a Windows consumer a reproducible Electron host for its existing WebGPU
bundle and give all consumers a public, renderer-aware keyframe evidence gate.

## Invariants

- The consumer owns game rules, assets, renderer selection and authoritative
  state. The desktop host only serves the already-built consumer bundle.
- WebGPU is explicit. A WebGL fallback, software adapter or missing renderer
  report fails the WebGPU gate.
- Local resources use a bounded secure `app://` origin; no deep engine import,
  second renderer or hidden CDN is introduced.
- Keyframe evidence remains labelled as evidence. It does not certify pixels,
  hardware or performance unless the consumer supplies those measurements.
- Existing browser, WebGL and default branding behavior remains unchanged.

## Dependencies

- A consumer built by the canonical route with `renderer: "webgpu"` and a
  browser entry that exposes `ZhudaBundle` and its renderer report.
- Electron 36+ on the Windows target for the example host.
- Existing WebGPU browser verifier and runtime renderer diagnostics.

## Scope

### Engine

- `examples/windows-webgpu/` desktop host and instructions.
- `packages/ci-gate/verify-sequence.mjs` and its public contract tests.
- `packages/core/runtime3d/Timeline.ts` deterministic presentation timeline and
  the explicit glTF/KTX2/Meshopt/Draco capability catalog.
- WebGPU and acceptance documentation and this verification record.

### Consumer or adapter

- The host reads `ZHUDA_WEB_ROOT` and `ZHUDA_ENTRY`; no consumer files are
  copied into this repository.

## Non-goals

- Windows hardware acceptance from macOS or GitHub CI.
- Native Laya runtime, Steam integration, signing or installer certification.
- Moving consumer gameplay or physics into Electron/Worker.
- Implementing image codecs, a timeline editor or a Slot rules engine.

## Acceptance checks

1. `npm test -- tests/ci-sequence-gate.test.mjs` passes valid, missing-frame,
   wrong-backend, fallback, non-monotonic and hash-mismatch reports.
2. `npm run verify` passes with public declarations and existing regressions.
3. On Windows, `npm install` and `npm run verify` inside
   `examples/windows-webgpu/` launch the consumer entry with `app://bundle`,
   report the actual WebGPU adapter and fail on fallback/software/error.
4. `node packages/ci-gate/verify-sequence.mjs <report>` reproduces a JSON gate
   with exact expected timestamps and bounded metric assertions.
5. `git diff --check` and documentation link checks pass.

## Evidence to attach

- Unit test output and `npm run verify` log.
- Windows host README and a target-machine JSON report containing OS, Electron,
  Chromium, GPU feature status, adapter and renderer diagnostics.
- Keyframe gate fixture reports and deliberate failure output.

## Unverified limits

- No Windows GPU or packaged EXE can be measured on this macOS host.
- WebView2, Electron versions other than the pinned example, signed installers,
  Steam and physical mobile devices remain unverified.

## Rollback

Last known good commit: `9612be0ab7e01eec0332ff63be02e76904d33f4b`. Remove the
example host and sequence gate without changing the existing WebGPU runtime.
