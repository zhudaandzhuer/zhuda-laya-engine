# Audio contract

`IframeSoundAdapter` is the engine's single WebAudio authority for an embedded
consumer. It owns one `AudioContext`, the master/channel gain chain, autoplay
unlock, active voices, lifecycle focus handling and disposal. A consumer submits
logical events with `scheduleTone`; it does not create an `AudioContext`, connect
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

## Provider-backed samples (1.4.0 candidate)

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

Streaming, spatial playback, physical-device codec/speaker/autoplay acceptance
and the complete sample migration matrix remain unverified. The
[verification record](plans/records/consumer-runtime-hardening/verification.md)
labels the measured candidate scope. The broader
[follow-up plan](plans/consumer-delivery-followups.md) still tracks dependency
graphs, vendor declarations and remaining device work.
