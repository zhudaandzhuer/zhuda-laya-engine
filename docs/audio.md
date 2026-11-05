# Audio contract

`IframeSoundAdapter` is the engine's single WebAudio authority for an embedded
consumer. It owns one `AudioContext`, the master/channel gain chain, autoplay
unlock, active voices, lifecycle focus handling and disposal. A consumer submits
logical events with `scheduleTone`, `playSample` or `playStream`; it does not create an `AudioContext`, connect
an oscillator to `destination`, or synthesize the same event through Laya's
`SoundManager`.

```ts
const audio = new IframeSoundAdapter({
  allowedParentOrigins: ['https://shell.example']
});
audio.scheduleTone({
  id: 'ui-confirm', channel: 'ui', startFreq: 720,
  endFreq: 480, durationSec: 0.08, peakGain: 0.15
});
```

Before a user gesture, an event is queued once by its logical `id`, retained for
500 ms by default and flushed once after `unlockAudio` successfully resumes the
context. A rejected resume leaves `unlockedByGesture` false and is reported in
`lastError`. The queue and active voice limits are bounded so an iframe cannot
accumulate an unbounded burst.

Master and channel volume are applied by their gain nodes. `peakGain` is the
voice's local envelope and must not include either volume again. Use
`stop(id)`/`stopAll(channel)` when an owner leaves a panel or scene. Call
`dispose()` when the owner is retired; it removes listeners, stops voices and
closes the context.

Bridge commands are accepted only from `allowedParentOrigins`; when no list is
provided, same-origin messages are accepted. A bridge acknowledgement targets
the accepted origin and never uses `'*'`. A consumer that deliberately mirrors
state to Laya can opt into `syncLayaSoundManager`, but it must choose one
playback backend for each event and must not submit the same sound to both.

## Provider-backed samples

The same mixer now exposes `loadSample`, `playSample` and `unloadSample` for
browser-decodable audio, including original WAV/MP3 assets. Decoding uses the
owned AudioContext. Source bytes come from the existing AssetProvider and its
manifest/integrity policy; the adapter does not fetch loose URLs or create a
second playback backend.

```ts
const audio = new IframeSoundAdapter({ sampleProvider: provider });
await audio.loadSample('audio/theme.mp3', { signal });
// Call unlockAudio from a real pointer/key gesture if not already unlocked.
audio.unlockAudio('pointerdown');
audio.playSample({
  id: 'music-main', sampleId: 'audio/theme.mp3', channel: 'bgm',
  loop: true, peakGain: .5, fadeInSec: .25,
});
// Load the replacement first. Crossfades require capacity for both voices.
await audio.loadSample('audio/battle.mp3');
audio.playSample({
  id: 'music-main', sampleId: 'audio/battle.mp3', channel: 'bgm',
  loop: true, replace: true, crossFadeSec: .25,
});
audio.stop('music-main', .2);
// When the owner no longer needs a sample, unload stops its voices immediately.
audio.unloadSample('audio/theme.mp3');
// At teardown:
audio.dispose();
```

A sample ID is a provider logical asset ID. A playback `id` identifies the event
or voice and is independent of the sample ID. Repeated load callers share cache
work with independent cancellation. The adapter retains one lease per loaded
ID until unload/dispose; the provider itself is borrowed and remains owned by
the caller. Decode cancellation/timeout rejects promptly and discards late
success; WebAudio decoding itself may continue internally.

Defaults: 15-second load/decode deadline, 32 retained/reserved sample IDs and
64 MiB retained decoded PCM. The PCM bound is channels × frames × four bytes,
not a GPU/heap measurement or a cap on the browser decoder's transient memory.
Configure provider byte limits separately. Failed decode/size/integrity loads
release their leases and can be retried.

`playSample` requires a loaded sample and returns whether the event was accepted
or queued, not whether the speaker was heard. Before unlock, it shares the same
bounded, expiring logical-ID queue as tones. `stopAll(channel)` now clears that
channel's queued events as well as active voices. Unload cancels that sample's
loads, queue entries and active voices before releasing PCM.

All offsets, loop points and fades use seconds. Non-loop duration is clamped to
the remaining sample; loops run until stopped unless `durationSec` is supplied.
`loopStartSec < loopEndSec <= sample duration`; `offsetSec` must lie inside the
sample. Finite playback permits `fadeInSec` and `fadeOutSec`; indefinite loops
fade out through `stop(id, seconds)` or replacement. Fades are bounded to 60
seconds and use AudioContext time, not gameplay timers.

A duplicate active sample voice ID is rejected unless `replace:true`. Replacement
starts a new voice before stopping the old one; if voice capacity is exhausted,
it fails and preserves the old voice. Crossfade overlap counts as two voices
until the old source ends. Distinct one-shot IDs may play the same sample at
once. There is no persistent replay/epoch ledger here; consumers should use the
existing event gate for replay deduplication.

Blur/hidden suspends the one context and mutes the master; resume continues the
same source position if permitted. It does not reconstruct a stream or guarantee
mobile autoplay. `peakGain` remains voice-local; channel/master gains apply once.
Sources and voice gains disconnect on end, stop, failure and disposal.

Streaming desktop evidence and the backend extension are documented below.
Spatial playback, physical-device codec/speaker/autoplay acceptance and the
complete sample migration matrix remain unverified. The
[verification record](plans/records/consumer-runtime-hardening/verification.md)
labels the measured candidate scope. The broader
[follow-up plan](plans/consumer-delivery-followups.md) still tracks dependency
graphs, vendor declarations and remaining device work.

## Streaming BGM (1.7.0)

`loadStream` / `playStream` / `unloadStream` use an optional
`AssetProvider.openStream` lease. Each voice owns a media element connected to
**the existing AudioContext, voice/channel/master gains**. The element's volume
is one; never connect another player or context for the same event.

```ts
const streams = new DirectoryAssetProvider({
  baseUrl: '/audio/', streamMode: 'native',
  // This delivery policy has no whole-file SHA requirement.
});
const audio = new IframeSoundAdapter({
  sampleProvider: assets, streamProvider: streams,
  maxActiveVoices: 24, voiceOverflow: 'fifo', protectedChannels: ['bgm'],
  maxDecodedSampleBytes: 64 * 1024 * 1024,
  maxRetainedStreamBytes: 32 * 1024 * 1024,
});
await audio.loadStream('theme.mp3', {signal});
// Call unlockAudio from the existing real user-gesture handler.
audio.playStream({id:'music', streamId:'theme.mp3', loop:true, fadeInSec:.2});
await audio.loadStream('battle.mp3', {signal});
audio.playStream({id:'music', streamId:'battle.mp3', loop:true,
  replace:true, crossFadeSec:.3});
// Unload the previous stream after its fade completes; unloading stops immediately.
audio.stop('music', .2);
// At owner teardown:
audio.unloadStream('theme.mp3');
audio.unloadStream('battle.mp3');
audio.dispose();
streams.dispose();
```

Two provider modes make the integrity tradeoff explicit:

| Mode | Data retained | Integrity |
| --- | --- | --- |
| `verified-blob` (default) | Complete encoded bytes in a leased Blob URL, no full PCM decode by the adapter | Existing byte bound and manifest SHA checks |
| `native` (opt-in) | Browser-managed range/buffer/decoder data; adapter lease reports zero retained bytes | Transport only; rejects a manifest entry requiring full-file SHA |

Native `loadStream` resolves an address lease, not network/media readiness.
Playback failures and the 15-second startup deadline are reported through
`onVoiceEvent` and `lastError`. A replacement retires the previous voice only
after the new element's play promise succeeds. Cancellation, stale results,
unload and disposal release the lease, media source, listeners and source URL.
Blur/hidden pauses the element as well as suspending the shared context; resume
continues its position when the browser allows it. All crossfade/stop envelopes
use audio time. `playStream` supports offset, loop, fade-in and replacement;
custom loop segments and finite-duration envelopes remain sample features.

`streamProvider` defaults to `sampleProvider`. `maxSamples` bounds each of the
sample and stream collections; pending loads reserve IDs. Retained encoded
stream bytes have their own `maxRetainedStreamBytes` budget (default 64 MiB).
`decodedSampleBytes` is owned PCM, and `retainedStreamBytes` is encoded lease
ownership. Neither is a measurement of total browser/native decoder memory.
CORS, media codecs, user gestures and page CSP still apply.

## Voice capacity and retirement

`voiceOverflow` defaults to `reject`. `fifo` retires the oldest eligible voice;
`priority` chooses the lowest priority, then the oldest, and rejects an incoming
voice below every eligible priority. `priority` defaults to zero. A voice marked
`protected:true` or in `protectedChannels` (default `['bgm']`) is never evicted.
Explicit stop/unload still stops protected voices.

The limit includes fading and crossfading voices. Retirement fades for
`retireFadeSec` (default 5 ms), reserves its replacement and starts that
replacement only after the old voice ends. The queue is bounded by
`maxPendingQueue`; it is not extra voice capacity. Crossfades need one free or
reclaimable slot and never steal their own old voice. Leave capacity for BGM
switches when choosing a limit. A stream waiting for playback also owns a slot.
A suspended audio clock delays retirement and admissions together.

`onVoiceEvent` reports `started`, `rejected`, `retiring`, `ended` and asynchronous
stream `failed` events. Monitor `pendingAdmissions`, `retiredVoices` and
`droppedVoices`; a true submission result can mean queued, not audible.
Stop/unload/disposal cancel the corresponding pending admissions.

## Sample backend extension and AudioWorklet

`prepareSampleBackend(backend, {signal})` installs one `IframeSampleBackend`
on an idle adapter. The backend receives the **owned** context, borrowed
provider and cancellation signal. `createVoice` returns an unconnected output,
`start`, `stop`, `onended` and `disconnect`. It must implement sample timing and
loop options, stop reliably, signal completion, and release nodes/ports on every
exit. The adapter keeps the logical events, queue, capacity, gain envelope and
focus authority. A backend must never connect directly to destination or apply
channel/master gain again. Tones and streams keep their existing source types
inside the same mixer.

Preparation has the sample deadline, abort and stale-disposal guards. Failure
rejects explicitly; the caller can keep native playback or retry with a fresh
backend instance. Unexpected context closure after installation requires
adapter disposal and recreation; it cannot reuse nodes from an old context.

The neutral reference in `tests/fixtures/runtime-feedback.ts` and
`tests/fixtures/runtime-worklet.js` demonstrates provider-loaded Worklet code,
module URL cleanup, channel routing, message completion and node/port disposal.
It is an acceptance fixture, **not a production DSP mixer or a complete sample
backend** (its single-channel loop subset is deliberate). The Chrome check
measures processor progress during a 250 ms main-thread block. Hardware output
latency, glitch-free speakers, mobile autoplay and full SOP compliance remain
unverified. Unsupported Worklet/module/CSP environments must handle preparation
failure explicitly. See the [1.7.0 verification record](plans/records/astra-runtime-feedback/verification.md).

## Offline movie soundtrack (1.13.0)

`IframeSoundAdapter.renderOffline` renders explicit timestamped cues from the
same loaded sample cache and gain/mute policy into bounded float32 WAV. No live
voice is emitted. It supports source offsets, loop regions, linear fades and
fails if overlapping cues exceed the existing voice cap. Native offline jobs
retain admission until they drain after cancellation. Streaming/custom Worklet
DSP is not automatically baked. See [movie audio and export](cinematics.md#soundtrack-through-the-same-mixer).
