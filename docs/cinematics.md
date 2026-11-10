# Deterministic presentation timelines

Agents that author whole scenes as data use [film scenes](film-scenes.md), which render through the capture described below.

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

## Movie production (1.13.0)

The lower-level recorder above remains a callback coordinator. The following
APIs supply actual scene sampling, pixels, offline audio and movie encoding.
Use the public packed SDK and a `core,2d,3d,gltf,postProcess` consumer. The
[runnable neutral fixture](../examples/cinematic-capture/) and
[verification runner](../scripts/verify-cinematic.mjs) use the same isolated
model/chart definitions in their final scene. Game/seller assets stay outside
the engine. Their own Prefab references and target-device checks still apply.

### Exact model poses

```ts
import {ZhudaModelInspector, ZhudaModelAnimationSampler} from 'zhuda-laya-engine';
const animation = new ZhudaModelInspector(instance).inspect().animations[0];
const pose = new ZhudaModelAnimationSampler(
  instance, animation.path, animation.name, animation.layer);
pose.sample(0.5);       // Absolute clip-local seconds, synchronous.
pose.sample(0);         // Reverse seek is independent of RAF history.
pose.sample(2, true);   // Explicit loop wraps the endpoint.
// pose.dispose() before releasing the model instance.
```

The sampler borrows a model lease and exclusively owns its Animator's speed
until disposal. Select one named override state per Animator; this is not a
blend-tree/cross-fade evaluator. LINEAR, STEP and CUBICSPLINE bone/Morph tracks
use the pinned native evaluator. Times clamp to the clip's end unless `loop`
is explicitly true. Sampling does not call `play`, tick the state machine,
dispatch animation events or emit live sound. Native animated property setters
still run (including Morph dirty callbacks); custom setters must be free of
gameplay side effects. Disposal restores the original speed; the sampled pose
remains until the next native tick.

### Physical lens and deterministic pixels

```ts
import {ZhudaPhysicalCameraRig, ZhudaCinematicCapture} from 'zhuda-laya-engine';
context.runtime.setPaused(true);
const lens = new ZhudaPhysicalCameraRig(camera, {
  focalLengthMm: 50, sensorHeightMm: 24, fStop: 2.8,
  focusDistanceM: 5, shutterAngle: 180, iso: 100,
  referenceEV100: 10, exposureCompensation: 0
});
lens.applyExposure(filmicPipeline, 24); // Optional existing ACES grade.
const capture = new ZhudaCinematicCapture(scene, lens, context.runtime, {
  width: 3840, height: 2160, maxWorkingBytes: 512 * 1024 * 1024,
  timeoutMs: 30000
});
try {
  for (let index = 0; index < 24; index++) {
    const frame = await capture.renderFrame({index, fps: 24, samples: 32,
      signal, sample(seconds) {
        timeline.seek(seconds); // Silent, absolute camera/object values.
        pose.sample(seconds);
      }});
    await saveOpaqueSrgbPng(frame.rgba, frame.width, frame.height, index);
  }
} finally { capture.dispose(); lens.dispose(); }
// Restore the consumer's pause policy after its entire export finishes.
```

`saveOpaqueSrgbPng` is consumer IO, not an SDK function. The example uses
`ImageData` and a 2D canvas only to encode the rendered bytes, never as the 3D
renderer. Output is top-left RGBA8, opaque sRGB. Width/height are explicit output
pixels independent of CSS size or DPR. Inputs are capped at 8192 per axis,
256 samples/frame and the configured CPU working-set estimate. GPU/driver
memory is additional. Call serially and drain each returned frame to storage.

Laya registers newly added meshes on its next native frame, and a capture
freezes the scene, so run `ZhudaEngine.flushRenderFrames(2)` after adding
objects and before the first capture (`ZhudaFilmRenderer` does this);
otherwise a frame can intermittently contain only the clear colour.
The mounted target scene's native update/time are frozen until capture disposal;
its original update, editor-render flag and time are restored. Other scenes and
Stage-level callbacks are not frozen. The existing RuntimeSession must stay
paused. Do not drive simulation with wall timers, RAF waits or `Animator.play`
during capture. The synchronous `sample` callback must completely define the
pose; async callbacks reject. Load all assets before starting. Native pre/post
render callbacks must be deterministic and render-only. Particles, physics,
shader randomness, cuts and external state need explicit consumer sampling;
the capture cannot infer their history. Keep TAA disabled throughout capture.

The camera uses vertical sensor fit, unit world scale and an off-axis thin-lens
approximation. Aperture samples converge at `focusDistanceM`. Deterministic
subpixel jitter and lens-disk samples are independent of frame history. For
multiple samples, the shutter spans `[index/fps, index/fps + shutterAngle/360/fps)`;
sample centers are evenly spaced within it. One sample always uses frame start,
with no aperture/jitter. `aperture:false` or `jitter:false` disables that component.
Choose a zero shutter or clamp samples at cuts to avoid mixing across shots.
Projection, automatic aspect mode and any active lens offset restore on disposal.

`physicalCameraMetrics` exposes vertical FOV, aperture radius, exposure duration,
EV100 and multiplier. `referenceEV100` calibrates the authored scene; ISO/f-stop
are not a measured photometric light meter. Exposure uses the existing Filmic
pipeline's gain. Aperture/shutter accumulation happens **after tone mapping**:
sRGB samples are decoded to display-linear values, averaged and encoded back.
This is SDR supersampling; it is not scene-linear HDR, ACEScg, EXR, path tracing
or a real-time 4K performance claim. High-intensity highlight energy clipped by
tone mapping cannot be recovered by adding more samples.

Abort/deadline/dispose rejects the caller promptly. Native GPU readback cannot
always cancel: its target and scene admission remain retained until the pending
read settles. A cancelled capture rejects another render while draining; dispose
is idempotent and releases the target after that work finishes. A noncooperative
native driver cannot be made to free synchronously. Recreate a lost renderer
through the existing runtime host; do not reuse its targets.

### Soundtrack through the same mixer

```ts
await audio.loadSample('score/music.wav'); // Existing AssetProvider/cache.
const mix = await audio.renderOffline({durationSec: 1, sampleRate: 48000,
  channels: 2, signal, timeoutMs: 30000,
  cues: [{id: 'opening', sampleId: 'score/music.wav', channel: 'bgm',
    atSec: 0, durationSec: 1, offsetSec: 0, loop: true,
    fadeInSec: 0.05, fadeOutSec: 0.1, peakGain: 0.8}]
});
await saveBytes('soundtrack.wav', mix.wav);
```

The adapter snapshots its already decoded sample references, master/channel
gains, explicit user mute and voice limit. Gain is applied once. Offline export
ignores browser focus auto-mute (a hidden tab must not silently erase its movie
score), and emits no live voice/event. It uses one explicit `OfflineAudioContext`
render job owned by the existing mixer, not another live `AudioContext`.

Cues have unique IDs, exact start/duration, optional source offset/loop bounds and
linear fades. Overlap above the mixer's voice limit fails before rendering;
offline export never silently steals a score cue. Source samples must be loaded;
streaming URLs, procedural live tones and custom Worklet processing are not
implicitly exported. Declare or bake those sounds as samples. `durationSec *
sampleRate` must be integral, mono/stereo output is bounded by `maxOutputBytes`
(default 256 MiB; PCM + WAV estimate, excluding borrowed sources/native overhead).

Float32 WAV preserves values outside ±1 and reports `peak`/`overRangeSamples`.
Set authored gains before lossy encoding; no hidden limiter is added. Cancellation
rejects promptly, but native offline rendering drains before another job is
admitted. Dispose aborts the caller and releases graph nodes after that drain.
The CPU encoding is bounded but is not a hard real-time scheduler guarantee.

### Verified MP4 export

Install FFmpeg and ffprobe on the export host, then run the installed SDK bin:

```sh
zhuda-film-export sequence.json --fps 24 --output movie.mp4 --audio soundtrack.wav
```

Use the sequence schema above, with exactly `frameCount` PNGs at `i/fps` for
`i=0..frameCount-1`. A one-second 24 FPS movie has 24 frames, excluding its end
sample; the older recorder's 25th endpoint is for comparisons only. Frame images
must be opaque sRGB, have identical even dimensions, pass CRC/hash/path checks
and remain within byte/pixel/frame limits. Audio must be mono/stereo PCM16/24/32
or float32 WAV with duration `frameCount/fps` (one sample tolerance).

The CLI stages copies of verified input, calls FFmpeg without a shell, checks
the encoded result with ffprobe, then atomically replaces `movie.mp4`. Invalid
input, cancellation, timeout, missing encoder or failed probing leaves the last
successful file intact. Temporary files are removed. SIGINT/SIGTERM interrupts
the encoder. Defaults: 5-minute deadline, 86,400 frames, 4 GiB total input and
16,777,216 pixels/frame. Programmatic `exportFilm` can set those budgets; CLI
supports `--timeout-ms`, `--ffmpeg` and `--ffprobe`.

Output is H.264/AAC, YUV420 limited-range with BT.709 primaries/matrix and an
explicit sRGB transfer tag, preserving the captured SDR transfer function.
This is a delivery file, not a lossless/HDR/alpha master. Keep the PNG sequence
and float soundtrack. FFmpeg is an external optional dependency; no codec
binary is bundled or silently downloaded. Windows executable paths are accepted,
but real Windows hardware/packaged capture remains a separate acceptance run.
