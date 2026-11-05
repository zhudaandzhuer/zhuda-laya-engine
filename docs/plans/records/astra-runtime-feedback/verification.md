# Verification: Astra runtime feedback / 1.7.0

Task: [task.md](task.md)  
Date: 2026-11-05  
Baseline commit: `4ce9255ae9a8617f70bc9326dcf65efe3061d39d` (1.6.0)  
Implementation: the 1.7.0 implementation commit containing this record; exact
source hashes and baseline are in the external `source-revisions.json`.

Evidence root (abbreviated **E** below):
`/Users/yaowei/Desktop/zhuda-astra-runtime-acceptance-20261105`.
No consumer production assets were copied into the engine. The fixture's plate,
box, WAV and processor are generated neutral regression inputs.

## Environment

macOS 27.0.1 (26A434), Node 26.12.0, npm 11.20.0, TypeScript 5.9.3,
Chrome 156.0.8078.80 headless/WebGL. Viewport 900 × 600; DPR 1/2/3;
render cap 3 or 1.5. Browser scenarios use isolated Chrome profiles to prevent
retained emulation/freeze state from contaminating subsequent cases.
Physical iOS/Android devices and hardware audio capture were unavailable.

## Checks

| Check | Command/procedure | Result | Artifact under E |
| --- | --- | --- | --- |
| Build, strict types, declarations, Doctor, regression | `npm run verify` | PASS, 173 tests, zero declaration diagnostics | `verify.log`, `declaration-audit.json` |
| Installed public package | `npm pack --json --pack-destination E`; `npm install --prefix E/installed --ignore-scripts E/zhuda-laya-engine-1.7.0.tgz` | PASS; version pin 1.7.0 and installed tarball integrity retained | `pack.json`, `install.log`, `installed/package-lock.json` |
| Independent consumer types | `./node_modules/.bin/tsc --noEmit -p E/installed/tsconfig.json` | PASS, strict / skipLibCheck:false | `packed-types.log` |
| Independent public build and Doctor | In `E/installed`: `./node_modules/.bin/zhuda-laya-build` and `./node_modules/.bin/zhuda-laya-doctor` | PASS, zero blockers | `packed-consumer-build.log`, `packed-doctor.log` |
| ESM/CJS and browser exports | Tests in `npm run verify`; browser namespace checked against public exports | PASS | `verify.log` |
| Installed browser CLI | `node E/installed/node_modules/zhuda-laya-engine/packages/compiler/browser-sdk.mjs --out E/installed-browser` | PASS, all eight files byte-identical to checkout build | `installed-browser-build.json`, `packed-browser-parity.json` |
| DPR, input, media, Worklet, driver | `RUNTIME_FIXTURE_DIR=E/runtime-fixture node scripts/verify-runtime-feedback-browser.mjs` | PASS for measured desktop scope | `runtime-browser.log`, `runtime-fixture/evidence/report.json` |
| Publication | ZIP through existing `zhuda-engine-sdk` publishing API; SHA matched | PASS, immutable 1.7.0 release | `publish-response.json`, `browser-sdk-1.7.0.zip` |
| Hosted and cross-origin browser SDK | `node E/verify-hosted.mjs` | PASS; 2D/3D draw, SRI, toggle, 30 cycles, disposal and launch target | `hosted-verification.json`, `hosted-verification.log` |
| Diff integrity | `git diff --check`; `git status --short` | Recorded before handoff | `git-diff-check.log`, `git-status.txt` |
| Physical devices/native media memory/speaker latency | Required device and audio instrumentation unavailable | UNAVAILABLE | This record |

The local tarball installation initially produced a `file:` dependency; Doctor
correctly rejected it. The fixture manifest was then pinned to 1.7.0, retaining
the installed archive/lock integrity. No guard was weakened.

## DPR and Prefab evidence

Preview and Scene import the same `src/prefabs.ts` definition. Neutral plate
source dimensions are x=20, y=20, width=198, height=110. Definition hash:
`f9595e94c9c180a0fe78f191d77550120c6bd47be1752d7f967c324172714199`.
Source hashes and instance provenance are in each report. This is geometry
regression evidence, not approval of game artwork or a game Scene.

| Selection/environment | Comparison reference | Actual result | Evidence |
| --- | --- | --- | --- |
| `plate` / child `plate` / `idle`, official preview DPR 1/2/3 | Exact authored width 198 CSS px, x=20 relative to canvas | 198 / 198 / 198; anchor unchanged | `runtime-fixture/evidence/preview-dpr-*.png`, report previews |
| Same definition, Scene with container at (30,50), DPR 1/2/3 | Width 198, screen anchor (50,70) | 198 / 198 / 198, all at (50,70) | `dpr-*-cap-3.png`, report measurements |
| Device DPR 3, render cap 1.5 | Same geometry, at most one backing-pixel raster tolerance | Solid-color width 197.333 CSS px, antialiased edge within 0.667 px; input and projection exact | `dpr-3-cap-1.5.png` |
| Fixed 320×180 design in 640×360 container | Scale two: width396, anchor(70,90) | Exact match | `dpr-2-cap-3-fixed.png` |
| Resize to 500×300; clipping; input | Correct stage dimensions, 3D center ray/projection, outside-clip clicks rejected | PASS; two pointer roles clear on touchCancel | Report resized/touched; `clip-*.png` |

Baseline 1.6.0 measured **198 / 99 / 66**. The checker now rejects that stage
transform even when CSS/backing canvas sizes are correct. Consumers must remove
DPR compensation, rebuild and review new visual evidence. The fixture's DOM
pointer adapter is enabled only for its own multi-pointer phase: its intentional
`preventDefault` must not suppress the separate Laya mouse compatibility test.

## Audio and lifecycle

- Samples/streams/tones share one context and gain authority. FIFO/priority tests
  exceed 24 events, preserve protected BGM, check order and reserve replacement
  slots until fade completion; hard voice capacity never grows during retirement.
- Streaming uses a generated 120-second, stereo 44.1 kHz WAV: 21,168,044 encoded
  bytes; a full float PCM decode would retain 42,336,000 bytes. Native mode
  reports **zero adapter-retained PCM/encoded bytes** and uses browser range
  requests. This is not a zero-memory claim.
- Chrome JS heap: 10,271,401 bytes before, 10,512,139 while playing,
  11,461,636 after the 30-cycle test without forced GC. Native media/decoder
  memory is excluded. This is not a memory-leak or device-memory acceptance.
- Browser tests cover loop, replacement, focus suspend/resume and 30 stream
  load/play/unload cycles. End state: zero active voices, pending stream loads,
  retained streams and sample PCM. Unit tests cover abort, deadline, late lease,
  play rejection, failed replacement, timeout, SHA enforcement, Blob revocation,
  independent encoded/PCM budgets, backend failure and closed context.
- Worklet reference progresses while the main thread is blocked for 250 ms;
  maximum observed gap between **active playback** processor frames is zero.
  Construction before the first sample is excluded from playback-gap measurement.
  Node and port ownership returns to zero. This proves the extension integration
  and measured processor continuity, not hardware output latency or a production
  DSP mixer. Reference processor supports only its documented test subset.

## Clock and failure boundaries

The Worker wakes the same runtime/layers/timer authority; foreground uses RAF.
Desktop test observed ticks 235→238 in background and 240 after a short browser
freeze/resume. Deterministic tests simulate 600/1000-second gaps, bounded recovery,
manual pause, duplicate timestamps, paused layers, old-generation callbacks and
Worker termination. No unbounded suspended interval is replayed. Browser/OS
freezing and long mobile background operation remain outside measured support.

## Declaration repair and migration

506 → **0 diagnostics**, with full library checking in the main verification
command, independent consumer and browser type fixture. Repairs were matched
to official LayaAir 3.4.2 sources and the platform declarations; see
[vendor repair provenance](../../../../packages/types/vendor/REPAIRS.md).
No replacement `any`, empty declarations or blanket suppression were introduced
to hide these diagnostics. Existing upstream dynamic APIs remain upstream types.

Default audio overflow stays reject; background stays pause/discard. Streaming,
FIFO/priority and Worker behavior are opt-in. Worklet remains an extension
contract. Native streaming refuses whole-file SHA-required entries; use the
verified Blob route when that integrity requirement must hold. Hosted game CSP
can disallow Worker/Worklet/Blob media; this release does not relax it.

## Decision and remaining limits

**Implemented; desktop verified. Physical-device/SOP acceptance remains In
progress.** Original game MP3/BGM timing and the reported 41.28 MB asset were not
used; neutral WAV does not establish all MP3/AAC codecs. iOS gesture recovery,
Android suspension, native decoder peak memory, hardware speaker glitches/latency,
long OS sealing, production DSP and complete consumer SOP remain unverified.
No game-art or full-game acceptance is implied.

Release: `e69ecb8850e43d172389f96ab0a9430e`; 1.7.0 templates are in
`examples/browser-sdk/`. Prior 1.6.0 release URLs remain unchanged. Consumers can
roll back their version pin and fixed SDK URL; do not overwrite immutable files.
