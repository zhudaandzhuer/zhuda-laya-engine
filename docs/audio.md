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

The current engine baseline is a deterministic tone primitive. There is **no
public AudioBuffer/sample playback ingress, MP3 decoder or BGM streaming API**
in this mixer. A consumer cannot complete original audio migration merely by
decoding files itself: it has no supported way to submit those samples to the
single mixer. This is an engine capability gap, not an instruction to create a
second context, deep-import private nodes, or substitute a tone for an MP3.

`audioContextFactory` supplies the context for this mixer; it is not a pluggable
playback backend. `syncLayaSoundManager` only mirrors settings, not voices or
their resource ownership. Projects needing original sample/BGM parity must
record that gap until a public sample path or complete backend contract ships.
The [follow-up plan](plans/consumer-delivery-followups.md) specifies the proposed
ownership, loading, loop/replacement and acceptance work. It is not an available
runtime API. Spatial audio and device speaker checks also remain unverified.
