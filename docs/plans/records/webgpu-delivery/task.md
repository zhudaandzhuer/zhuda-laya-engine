# Agent task: webgpu-delivery

Status: Implemented; macOS verified, Windows hardware acceptance open
Owner: engine maintainers
Last reviewed: 2026-11-05

## Source requirement

User: 「行，去把它走通，支持 webgpu」, following the 1.10.0 audit of
Web/Windows renderer support. Baseline package ships WebGL modules only.

## Goal

An independent consumer and official browser bundle can explicitly select a
real LayaAir WebGPU renderer, report its actual backend, render the same neutral
Prefab definitions, and handle unsupported devices and device loss explicitly.
Windows browser verification is reproducible and hardware evidence is labelled.

## Invariants

- Preserve existing WebGL/default consumer behavior and optional branding.
- Use a pinned upstream LayaAir backend; no surrogate renderer or fake facade.
- Report requested/selected backend and fallback reason separately. A WebGL
  fallback never counts as a passing WebGPU draw.
- No backend switch after partial native initialization without a fresh realm.
- Providers, GPU/resource owners, runtime clock and input authority remain shared.
- Shader/config validation alone is not pixel or device evidence.
- Cancellation/deadline/device loss cannot mount a late initialized runtime.

## Dependencies

LayaAir 3.4.2 upstream sources/artifacts, topology/compiler/browser packaging,
ZhudaEngine/RuntimeSession/RuntimeHost, public declarations, Chrome fixture and
neutral 2D/3D Prefabs, existing shader/PBR/particles/model fixtures.

## Scope

### Engine

Pinned renderer vendor artifacts and provenance, backend selection/diagnostics,
compiler and browser entry, failure/lifecycle handling, public types, regression
fixtures, verification scripts, Windows test entry and documentation.

### Consumer or adapter

Generated independent consumer and raw browser/device media outside the repo:
`/Users/yaowei/Desktop/zhuda-webgpu-acceptance-20261105/`.
Only authored neutral engine fixtures may be checked in.

## Non-goals

Windows native EXE/Steam launcher/signing, universal GPU compatibility claims,
new game rules/art, a second engine backend implementation, or automatic
performance guarantees. Windows browser support and native delivery are distinct.

## Acceptance checks

1. `npm run verify`: strict public types, ESM/CJS exports, topology/build and
   deliberate backend error fixtures; existing WebGL paths remain passing.
2. Independent packed consumer build/Doctor with explicit WebGPU and WebGL.
   Browser records actual GPU adapter/device/backend and successful draw.
3. Prefabs `backend.2d` named Label/Icon and `backend.3d` named Body independently
   replay before Scene composition with identical definitions/hashes. Compare
   deterministic backend frames and document cross-backend visual tolerance.
4. Exercise UI/text, 3D PBR/glTF, custom shader, particles and optional Spine
   through measured fixtures or explicit capability exclusions.
5. DPR/resize/input/focus, missing GPU/adapter, timeout/cancel, resource teardown
   (30 cycles) and actual device loss/rebuild have reproducible evidence.
6. Compiler/browser assets carry SHA and fixed upstream identity; offline-relative
   assets and hosted CSP/SRI are checked. No hidden third-party CDN dependency.
7. Windows test entry records OS/GPU/driver/backend and fails if forced-WebGPU
   falls back. Actual Windows run requires a Windows GPU host; missing host is
   UNAVAILABLE, not emulated into a pass.
8. `git diff --check`, `git status --short`, completed verification record and
   release identity before handoff.

## Evidence to attach

Unit/type/build logs, upstream source/artifact hashes, independent tarball and
consumer, actual renderer reports, isolated PNGs, resource/cancellation/device
loss results, hosted hashes and platform matrix in the external evidence root.

## Unverified limits

Windows GPU host availability must be established. Native EXE and physical
mobile adoption are not certified by macOS/browser or software-adapter tests.

## Rollback

Last good 1.10.0: `ba0ebf2ba08741c2deb078483fc91df22b1e6ff8`.
Default WebGL and previous immutable hosted releases remain available.
