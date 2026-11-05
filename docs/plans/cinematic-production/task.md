# Agent task: deterministic cinematic production

Status: In progress
Owner: engine maintainers
Last reviewed: 2026-11-05

## Source requirement

User: 「老虎機那個別管他，這種特歸遊戲需求不應該在引擎repo裡面，
其他你還沒做的要先做，電影那塊是很重要」.
The previous 1.12.0 recorder supplied callbacks and evidence checks, but no
native animation sampling, physical lens, offline soundtrack or movie producer.

## Goal

A public consumer can sample a scene at an exact time, render deterministic
physical-lens/shutter samples, export a bounded PNG sequence and soundtrack,
and produce a playable video through an official CLI. Repeating a timestamp
must not depend on RAF speed or replay game events.

## Invariants

- Use the existing TimelineSequencer, runtime pause, provider/model leases,
  pinned Laya evaluator and IframeSoundAdapter. No game authority or Slot kit.
- Sampling is silent: no Animator state transitions, animation events or live audio are synthesized by seeking an animation.
- Offline audio is an explicit export owned by the existing mixer, never a
  second live playback path. Gain/mute and source IDs have one authority.
- Capture has pixel/sample/frame/time budgets, abort/timeout/disposal, exclusive
  camera ownership and restoration. Failed export preserves prior artifacts.
- Label display-linear accumulation versus scene-linear HDR accurately. No
  claim of path tracing, ACEScg or renderer fidelity from configuration checks.

## Dependencies

- Existing provider models, native WebAnimatorEvaluator/Applier, Camera and
  RenderTexture.getDataAsync; vendor bridge stays version-pinned.
- Existing physical render backend, FilmicPipeline, Timeline and PNG validator.
- OfflineAudioContext, optional installed FFmpeg/ffprobe for video production.

## Scope

### Engine

- Public physical camera, synchronous model animation sampler and cinematic
  capture, offline soundtrack contract on IframeSoundAdapter, video export CLI.
- Public types, MCP discovery, neutral fixtures, documentation and evidence.
- Document Slot-specific products as outside the engine roadmap. Preserve the
  reusable branding/theme/result APIs already used by consumers.

### Consumer or adapter

- Independent packed consumer outside the repo. Authored neutral glTF bone/morph
  fixture and procedural lens chart; same definitions in isolated capture and
  final movie. No game production content enters this repo.

## Non-goals

- Slot rules, reel kits, math/RGS/wallet/certification or Factory products.
- Claiming real-time 4K performance from an offline capture or Windows/mobile
  acceptance from a macOS run.
- Moving simulation to Workers or implementing XR as a side effect of capture.
  Those and the remaining asset/GPU tasks retain separate acceptance boundaries.

The real renderer fixture additionally reproduced a native glTF unlit color
mutation/equality bug on WebGPU. Repair it in the owned resource adapter and
require a WebGL/WebGPU pixel-color comparison.

## Acceptance checks

1. Exact animation sampling at start/interior/end, reverse seek and repeated
   time, including actual bones/morph; no event dispatch; release ownership.
2. Lens/FOV/focus/shutter math and restored camera state. Isolated focus-plane,
   foreground/background and moving subject fixtures show actual pixel effects.
3. One mixer: exact sample positions, loop/offset/fade, volume/mute, bounded
   offline audio, abort/deadline and disposal. No duplicate live voices.
4. Real packed consumer WebGL/WebGPU capture, deterministic PNG replay,
   30 create/dispose cycles, failure paths and a short 3840x2160 output.
5. Export CLI validates all frames/audio before encoding; deliberate failures
   preserve the previous file. ffprobe checks frame count/rate/dimensions/audio.
6. `npm run verify`, strict consumer declarations, ESM/CJS, `git diff --check`.

## Evidence to attach

- External consumer/source inventory and reports under `/tmp/zhuda-cinema/`.
- Isolated images, movie, soundtrack, ffprobe metadata, resource snapshots.
- Verification record listing exact commands, revision and device limits.

## Unverified limits

Windows hardware, physical mobile/XR devices and production cinematic assets
need their own runs. Shader-driven nondeterministic effects require explicit
consumer samplers and cannot be inferred from native time.

## Rollback

Baseline `14afb68`. Existing timeline/provider/WebGL route remains available;
an unsupported capture backend or encoder fails explicitly.
