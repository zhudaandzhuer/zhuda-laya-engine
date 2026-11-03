# Verification record: audio-hardening

Task document: `docs/plans/records/audio-hardening/task.md`  
Commit: `b113197`  
Date: 2026-11-03

## Environment

- OS / browser / device: macOS host; Node test runner; no browser audio device
- Node and package manager: Node 24+; npm
- Engine and consumer commits: engine `b113197`; showcase audio is in this repository
- DPR, viewport and network mode: not applicable to the headless audio checks

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build | `npm run build` (via `npm run verify`) | PASS; SDK and web bundle emitted | `/tmp/zhuda-audio-hardening-verify.log` |
| Types | `npm run typecheck` (via `npm run verify`) | PASS | `/tmp/zhuda-audio-hardening-verify.log` |
| Public consumer types | Temporary strict TypeScript consumer importing `IframeSoundAdapter`, `IframeToneOptions` and diagnostics | PASS | `/tmp/zhuda-audio-hardening-public-types.log` |
| Doctor | `npm run doctor` (via `npm run verify`) | PASS; 0 blocking errors | `/tmp/zhuda-audio-hardening-verify.log` |
| Regression | `npm test` (via `npm run verify`) | PASS; 100/100 tests | `/tmp/zhuda-audio-hardening-verify.log` |
| Focused audio | `node --test tests/audio-hardening.test.mjs` | PASS; 6/6 tests | `/tmp/zhuda-audio-hardening-focused.log` |
| Diff hygiene | `git diff --check` | PASS | `/tmp/zhuda-audio-hardening-diff-check.log` |
| Real WebAudio/device | Run the showcase in a real browser and exercise gesture, iframe bridge, mute, blur and speaker output | UNAVAILABLE; no browser/device capture in this run | none |

## Lifecycle and failure cases

The fake AudioContext fixture covers:

- pre-gesture queueing, duplicate logical IDs, bounded stale expiry and one-time
  flush;
- rejected `resume()` leaving `unlockedByGesture` false with `lastError`;
- closed-context detection, active voice retirement and requiring a fresh unlock;
- master/channel gain changes, voice stop, blur silence and bounded active voices;
- malformed frequency, duration, gain, volume and channel input;
- bridge origin rejection and acknowledgement targeted to the accepted origin;
- `dispose()` removing listeners, stopping voices and closing the owned context.

The showcase source assertion confirms it has no second `AudioContext`, direct
oscillator/buffer destination route or nondeterministic `Math.random()` noise.

## Prefab evidence (visual work)

Not applicable. This task changes audio lifecycle and public types only.

## Limits and decision

Real iOS/Android autoplay, iframe permission policy, speaker output, latency,
clipping and hardware context-loss behavior remain unverified. Consumer-owned
asset decoding, `AudioBuffer` caching, BGM streaming and spatial audio remain
future capabilities under the contract in [`docs/audio.md`](../../audio.md).

Decision: **In progress** for the engine baseline because the headless engine
checks pass but the required real browser/device audio check is unavailable.
