# Agent task: audio-hardening

Status: Implemented; headless engine scope verified; browser/device audio deferred
Owner: Codex
Last reviewed: 2026-11-06

## Source requirement

User request: 「去把音效方案補起來，這很重要」, following the review that found
`IframeSoundAdapter` and `src/audio/MinesweeperAudio.ts` each creating or routing
sound independently. The engine must provide one correct audio authority that
agents can use without creating a second `AudioContext`.

## Goal

Make the public iframe audio adapter the single WebAudio mixer for the showcase
and consumer adapters, with deterministic queueing, input validation, bridge
origin checks, voice cancellation, lifecycle cleanup and diagnostics that expose
unavailable or failed audio backends.

## Invariants

- Consumer gameplay remains the owner of when a sound event occurs; the engine
  only renders the requested sound.
- A sound event is submitted once and is mixed through one master/channel gain
  chain. No consumer code creates a second `AudioContext`.
- Pre-gesture work is queued at most once per logical event, expires safely, and
  is flushed once after a successful context resume.
- Muting, channel volume, visibility/blur and disposal affect every active voice.
- Cross-origin bridge commands require an explicit allowed origin or same-origin
  validation; acknowledgements never use a wildcard target.
- Public runtime declarations and the package's `.d.ts` surface stay in sync.
- The engine repository contains no consumer production assets.

## Dependencies

- `packages/core/IframeSoundAdapter.ts`
- `packages/types/zhuda-2d-ui.ts` and `.d.ts`
- `src/audio/MinesweeperAudio.ts`
- Existing commercial audio regression fixture
- `docs/plans/VERIFICATION-TEMPLATE.md`

## Scope

### Engine

- Extend the public audio diagnostics and tone/voice contracts.
- Refactor `IframeSoundAdapter` to own context creation, gain routing, queue,
  active voices, bridge security and disposal.
- Add focused fake-context lifecycle and failure tests.
- Record verification and known real-device limits.

### Consumer or adapter

- Update the engine showcase `MinesweeperAudio` adapter usage only; its game
  rules and assets remain consumer-owned.

## Non-goals

- Decoding or caching consumer audio files, BGM streaming, spatial audio or a
  platform-specific Laya `SoundManager` backend.
- Claiming real WebAudio speaker output or mobile autoplay behavior from Node
  fake-context tests.
- Moving game audio assets into the reusable engine repository.

## Acceptance checks

1. `npm test` covers a fake running AudioContext: pre-unlock queue flushes once,
   duplicate logical IDs are dropped, gain values are applied exactly once,
   active voices can be stopped, and mute/blur/dispose stop or silence them.
2. The same tests reject NaN, Infinity, negative and out-of-range values;
   bridge origins outside the allowlist are ignored; resume rejection leaves
   `unlockedByGesture` false and reports `lastError`.
3. `src/audio/MinesweeperAudio.ts` contains no `AudioContext`, oscillator,
   gain-to-destination or random-noise construction and all sounds submit to
   `IframeSoundAdapter`.
4. `npm run verify`, `git diff --check` and `git status --short` pass from the
   repository root.
5. Real browser/device output remains explicitly reported as unavailable unless
   it is run with an actual audio device.

## Evidence to attach

- Test/build output: `npm run verify` and focused audio test output.
- Browser/WebGL or device report: unavailable in this headless repository run;
  record the limitation in `verification.md`.
- Resource/lifecycle report: fake-context active voice and close counters in the
  audio regression test.
- Screenshots/video/logs: none; audio speaker output requires a consumer/device.

## Unverified limits

- Real iOS/Android autoplay, iframe permission policy, speaker output, latency,
  clipping and hardware context-loss recovery.
- Decoded asset/BGM lifecycle, because this patch intentionally keeps the tone
  primitive as the engine baseline.

## Rollback

Last known good commit: `50b7eb4` (`v1.1.0` prefab release). If an acceptance
check fails, revert the audio-hardening commit; consumers fall back to the
previous adapter behavior while the existing engine release remains usable.
