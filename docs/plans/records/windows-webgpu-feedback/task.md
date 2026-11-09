# Agent task: windows-webgpu-feedback

Status: Implemented within scope; Windows hardware evidence pending  
Owner: Engine compiler, model inspection and desktop acceptance tooling  
Last reviewed: 2026-11-06

## Source requirement

Windows consumer report for the pinned 3.4.2 SDK: PBR/reflection binding may
change when visible objects change; GLB loading is sensitive to many small
meshes; the Prefab browser harness can stall during cleanup; packaged offline
startup must use the secure Electron origin; Blender-to-Laya axis guidance is
unclear. The report does not prove a WebGPU backend defect.

## Goal

Make the engine-owned acceptance path diagnosable and repeatable, expose model
source complexity before native allocation, and document the DCC coordinate
contract. Preserve explicit unverified status for Windows hardware and any
reflection binding issue without a minimal reproducer.

## Invariants

- WebGPU uses the existing Laya 3.4.2 backend and never silently falls back.
- Consumer assets, scene rules and model workarounds stay outside this repo.
- Prefab checks record requested versus measured viewport/DPR and preserve the
  last accepted output on failure.
- Model summaries are preflight metadata; they do not certify GPU performance.
- Browser processes and temporary profiles are released on macOS, Linux and
  Windows even when the checker fails.

## Scope

### Engine

Cross-platform Chrome/Edge discovery and process-tree cleanup in the Prefab
checker, bounded configurable browser readiness timeout with failure phase,
model inventory complexity summary, Blender/glTF/Laya pipeline documentation,
and focused regression tests.

### Consumer or adapter

The Windows agent must retain its Electron development/installed reports and,
for a suspected ReflectionProbe problem, a two-model minimal fixture. No game
model or vendor patch is copied into this repository.

## Non-goals

No claim of Windows hardware acceptance, no automatic mesh merge, no reflection
probe rewrite without a reproducer, no Unreal parity claim and no ordinary
`file://` offline packaging route.

## Acceptance checks

1. `npm run verify`, `git diff --check` and a strict generated declaration audit.
2. Model inventory reports deterministic source counts for a small fixture.
3. Prefab config accepts/rejects bounded `browserTimeoutMs` and browser failure
   reports include phase/path while cleanup is bounded.
4. Windows Electron remains on `app://bundle`, with `selected: webgpu`,
   `WebGPURenderEngine`, ready state, no fallback and complete GPU report.
5. Windows hardware and ReflectionProbe reproduction remain explicitly
   `UNAVAILABLE` until real evidence exists.
