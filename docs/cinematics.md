# Deterministic presentation timelines

`ZhudaTimelineSequencer` binds number, boolean, vector and string event tracks to
consumer presentation. It borrows the existing runtime time source:

```ts
import { ZhudaTimelineSequencer } from 'zhuda-laya-engine';
const timeline = new ZhudaTimelineSequencer(spec, bindings);
context.runtime.start(() => {
  timeline.update(context.runtime.layers.scaledDeltas.get('presentation') ?? 0);
});
timeline.seek(1.5); // Silent seek; does not replay audio cues.
```

Define the `presentation` layer on the existing layered clock. Track IDs are
unique, value tracks have unique targets, vector dimensions match, and values
are finite. Step sampling changes at the exact key time. The sequencer snapshots
and freezes its specification; editing the authored arrays cannot change a run.
Event cues are dispatched in declared track order over `(previousTime, time]`;
`t=0` cues are not automatic. `seek(t,{emitEvents:true})` emits only forward
crossings. Reset/rewind is silent. Dispose the sequencer with its scene.

`ZhudaOfflineFrameRecorder` supplies `advance(frame,signal)` and
`capture(frame,signal)` callbacks at `t = index / fps`. A 1-second sequence at
24 FPS contains 25 samples including both endpoints; a video encoder may omit
the last endpoint. `durationSeconds * fps` must be integral, and `maxFrames`
bounds retained metadata. Use `frame.deltaSeconds` (zero on the first frame)
when advancing an existing fixed-step simulation; use `timeline.seek(frame.time)`
for stateless presentation. Pause live gameplay updates before manual capture.

Callbacks are awaited serially and have a `stepTimeoutMs` deadline (15000 ms by
default). Abort/dispose interrupts waiting even if a callback stalls. A callback
must honor the supplied signal before mutating its scene or writing files; the
recorder cannot undo external side effects of noncooperative code. It retains
metadata only. The caller captures actual pixels, drains GPU work, saves files
and owns any encoder/audio synchronisation. It provides no temporal accumulation,
physical camera, motion blur, video encoding or offline 4K quality guarantee.

## Sequence evidence

```sh
zhuda-sequence-check report.json --times 0,0.5,1 --backend webgpu --max frameMs=16.67
```

The JSON report has `schemaVersion:1`, `requestedBackend`, `selectedBackend`,
`status:'ready'`, `errors:[]`, `expectedTimes` and `frames`. WebGPU evidence also
requires `fallbackReason:null` and `isFallbackAdapter:false`. Every frame has
`time`, `ready:true`, `imagePath`, `imageSha256` and optional numeric `metrics`.
Paths resolve below `--root` (by default the report's directory); symlinks cannot
escape it. Optional `referenceSha256` requests byte equality with that digest.
Invalid expected times, tolerances, budgets, missing metrics or hashes fail.

Without `--reference`, the result explicitly reports `scope:'evidence-integrity'` and
`visualComparison:'not-performed'`. It verifies file hashes and assertions; it
cannot prove that a consumer's timestamp, metric or screenshot describes an
actual draw. Use independent browser capture, reviewed references and the
[Prefab workflow](prefab-workflow.md) for visual acceptance. Do not substitute
self-reported metrics for GPU measurements.

For PNG regression against an independently reviewed reference:

```sh
zhuda-sequence-check actual.json --times 0,0.5,1 --backend webgpu \
  --reference approved/reference.json --max-diff-pixels 0 --channel-tolerance 2
```

The reference uses the same report schema and contains an explicit
`approval: { reviewedBy: "reviewer identity", reviewedAt: "2026-11-05T00:00:00Z" }`.
Capture alone is not approval. Keep reference approval outside the capture
step; this metadata is not authenticated identity or a signature. Relative
reference paths resolve below the reference report's directory. Both reports
must pass integrity, timestamp and renderer checks before comparison runs.

This mode reports `scope:'png-pixel-regression'` and per-frame dimensions and
different-pixel counts. It compares all RGBA channels, allowing a difference of
2 per channel by default; a pixel fails when any channel exceeds that tolerance.
The default permitted different-pixel count is zero. It checks PNG CRCs and
rejects dimensions that differ or exceed 16,777,216 pixels; individual image
files are limited to 64 MiB. Programmatic callers can set `maxPixels` and
`maxImageBytes`. These limits bound image input and do not represent GPU memory
budgets. Pixel regression does not establish artistic quality or device parity.

The independent [verification runner](../scripts/verify-next-round.mjs) packs
the SDK, builds a public consumer and captures the same neutral Meshopt model
and camera track on WebGL and WebGPU. It verifies repeated sequence captures,
rejects a deliberately substituted camera frame and runs the installed CLI.
Its reference is an authored neutral engine regression, not approval of consumer
artwork. Reports distinguish those real draws from metadata-only unit fixtures.
