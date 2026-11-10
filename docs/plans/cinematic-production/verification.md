# Verification record: cinematic production

Task document: `docs/plans/cinematic-production/task.md`
Commit: working tree before release (recorded in evidence/results.json)
Date: 2026-11-05

## Environment

- OS / browser: macOS Darwin 27.0.0, Headless Chrome 156.0.8078.80
- Node: v24.22.2; npm; FFmpeg/ffprobe installed
- Renderer: real WebGL and real WebGPU Metal adapter (`isFallbackAdapter:false`)
- DPR / viewport: DPR 1, 2 and 3; resize output 3840x2160
- Published SDK: https://game.qianlongxundao.com/apps/zhuda-engine-sdk/releases/d736a66a3dc72499963c6266914056da/

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build / types / Doctor / tests | `PATH=<Node24> npm run verify` | PASS; 254/254 | `/tmp/zhuda-cinema-verify.log` |
| Cinematic consumer | `node scripts/verify-cinematic.mjs` | PASS WebGL + WebGPU | `<external-evidence>` |
| Browser SDK | `node scripts/verify-browser-sdk.mjs` with `SDK_BROWSER_DIR=dist/browser/1.13.0-final` and published URL | PASS; 12 scenarios, zero browser errors | `<external-evidence>` |
| MP4 exporter | `zhuda-film-export ... --fps 24 --audio ...` | PASS; 3840x2160, 24 frames, 24 FPS, 1 sec | `evidence/*-video-probe.json`, `evidence/*-movie.mp4` |
| Failure atomicity | missing ffprobe after a successful export | PASS; previous movie SHA preserved | `results.json` (`failurePreservedPrevious:true`) |
| DPR / resize | CDP DPR 1/2/3 and changed viewport | PASS; fixed output dimensions | `evidence/results.json` |
| Lens / focus / shutter | 32 aperture samples, front/plane/back pixel deltas, moving red subject width | PASS; focus plane ~0.053 px delta; motion width grows | `evidence/results.json`, `motion-pixel-check.json` |
| Offline audio | shared mixer, fades, mute, over-range float WAV, timeout/disposal | PASS | `/tmp/zhuda-cinema-verify.log`, `webgl-score.wav` |

## Lifecycle and failure cases

Native GPU readback and OfflineAudioContext cannot be synchronously cancelled. The
public call rejects promptly, but capture/mixer admission stays held until the
underlying operation drains; targets and graph nodes are released then. Tests
cover timeout, abort, disposal, repeated capture, malformed/duplicate cues, voice
capacity, missing samples, failed encoder/probe and unchanged prior movie.

## Visual / model evidence

The same neutral glTF skin/Morph fixtures and authored lens chart are used in
isolation and final capture. WebGL/WebGPU unlit material color is `[218,124,231]`
for both backends. Focus deltas: front `41.4625`, plane `0.0533`, back `29.9474`.
The images are regression evidence, not customer-art approval.

## Limits and decision

**In progress / desktop verified.** The general movie route is implemented and
reproducible. Scene-linear HDR/EXR, path tracing, production Worklet DSP,
Windows physical GPU, packaged Windows acceptance, iOS/Android devices and XR
remain unverified or outside this task. Slot/Reel/RGS/math/wallet/Factory
products remain consumer scope.
