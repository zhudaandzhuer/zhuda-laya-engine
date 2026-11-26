# Task: a sample voice's position by the audio clock

- Id: `audio-sample-clock`
- Asked by: the consumer verification repository (VerifyZhuda, `games/zhuda-beat`, a rhythm game)
- Base: `225ac16` (round-9-consumer-fixes on `def94aa`, v1.18.0)

## Why

`IframeSoundAdapter` owns the only `AudioContext` and hides it. A consumer that must stay with
the music (a rhythm game, lip sync to a voice line, a cut timed to a track) had no time to read:
`playSample` returns a boolean, and nothing says when the voice started or where it is. The
consumer keeps time by `performance.now()` instead, which runs on while the adapter suspends the
context on blur or a hidden page; the two then disagree and the consumer has to pause and restart
the sample by hand.

## Change

- `IframeSoundAdapter.getSamplePositionSec(id)`: start offset plus context time since the voice
  started; wrapped inside a loop; `null` when no sample voice of that ID is playing.
- `IframeSoundAdapter.getOutputLatencySec()`: the host's `outputLatency`, else `baseLatency`, else 0.
- `docs/audio.md`: "Keeping time with a sample".
- `packages/types/IframeSoundAdapter.d.ts`: the two declarations, written by hand to match (see verification).

## Not in this change

- No "start at a context time" option on `playSample`: starting at an offset and reading the
  position back covers the cases met so far.
- Streams (`playStream`) get no position: `HTMLMediaElement.currentTime` is there but was not needed or tested.
- The synth's limits (10 s, 16 layers per recipe) stay: a consumer mixes a long piece itself from
  `renderZhudaSynth` and `encodeZhudaWav` (the rhythm game does, in about 0.1 s).
