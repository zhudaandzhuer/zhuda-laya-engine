# Deterministic presentation timelines

`ZhudaTimelineSequencer` is a small presentation contract for camera, animation,
effect and audio bindings. It does not own RAF, wall time, gameplay, physics or
network authority. A consumer advances it with the existing
`ZhudaRuntimeSession.layers` delta, or seeks it to a fixed timestamp for a
keyframe capture.

```ts
import { ZhudaTimelineSequencer } from 'zhuda-laya-engine';
const timeline = new ZhudaTimelineSequencer(spec, {
  camera: {set: value => camera.position.x = value as number},
  audio: {cue: id => audio.submit({id: id as string, channel: 'music'})},
});
timeline.update(session.scaledDeltas.presentation);
timeline.seek(1.5); // deterministic presentation seek; events stay silent by default
```

Tracks support numbers, booleans, vectors and string event cues. All key times
are strictly increasing and bounded by the duration. `seek(t, {emitEvents:true})`
explicitly emits cues crossed by the seek; ordinary seeks do not replay audio.
The sequencer is disposed with its scene and does not create another clock.

This is the first cinematic building block. It does not provide a timeline editor,
offline 4K renderer, motion blur, path tracing, FFmpeg or Unreal parity. Use the
[keyframe sequence gate](../packages/ci-gate/verify-sequence.mjs) to record fixed
times and actual renderer/device diagnostics before claiming cinematic support.
