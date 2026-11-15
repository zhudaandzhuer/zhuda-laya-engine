# Verification record: phone-checks

Task document: `docs/plans/records/phone-checks/task.md`\
Commit: the commit that adds this file, on top of `78b0dee`\
Date: 2026-11-15

## Environment

- Phone: vivo V40 (V2348, Android 16), Chrome 156.0.8078.79, device pixel
  ratio 2.625, reached over wireless adb. WebGL: `ANGLE (Qualcomm, Adreno
(TM) 720, OpenGL ES 3.2)`. WebGPU: a hardware adapter, vendor `qualcomm`,
  architecture `adreno-7xx`, 22 features; it has neither
  `float32-filterable` nor `bgra8unorm-storage`.
- This machine (it builds and serves the pages): macOS 27.0.1, Apple M4,
  Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `78b0dee`; no consumer.
- DPR, viewport and network mode: each check's own (it overrides the tab's
  metrics as it does on the desktop: DPR 1 at its own size); the page on this
  machine's loopback through `adb reverse`.
- Evidence (outside the repository): `batch2-evidence/phone-checks/` in the
  session's notes folder: every check's report and pictures on each
  backend, the logs, the adapter's notices, the delivery pages' report and
  screenshots, the probe's output.
- Nothing on the phone was changed. A blank tab was used and left at
  about:blank; the screen was kept on by a wake key every fifteen seconds.

## How

```sh
adb forward tcp:9333 localabstract:chrome_devtools_remote
ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 ZHUDA_PHONE_NOTICES=notices.txt npm run verify:lit-surface
ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 ZHUDA_PHONE_NOTICES=notices.txt LIT_SURFACE_RENDERER=webgpu npm run verify:lit-surface
```

and so for each check (`docs/agent-development.md`, "A draw check on a
phone"). The checks are not changed: their Chrome is the phone's.

## Checks on this machine

| Check                                     | Exact command or procedure                                 | Result                                                |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                           | PASS, 785 of 785 (4 in `tests/phone-chrome.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check` | PASS                                                  |
| The switch, unset                         | `npm run verify:lit-surface`, `npm run verify:cloth`       | PASS: seven draws as before (see below)               |

With `ZHUDA_PHONE_CHROME` unset, on this machine: `verify-lit-surface` and
`verify-cloth` on WebGL and on WebGPU, `verify-developer-tooling` (two
browsers, one after the other), `verify-prefab-editor-responsive` (a browser
with options) and `verify-backend-delivery` (a browser a case) pass. The
last printed its PASS the first time and did not exit (its esbuild service
was still attached; another session was running a check of its own on the
machine); stopped by hand after four minutes and run again, it passed and
exited in 106 seconds. The full sweep of the older draws was not run again
for this change: the switch is one line that hands the same headless Chrome
back when the variable is not set.

## The ten checks on the phone

Each as it came. PASS and FAIL are the check's own words on the phone.

| Check                      | For       | WebGL    | WebGPU   | On the phone                                                                                                                                        |
| -------------------------- | --------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify-cloth`             | WP18      | PASS     | PASS     | the desktop's numbers and bytes; 7.5 ms a frame for 1,681 particles and 3.1 ms for the skirt on either backend                                      |
| `verify-lit-surface`       | WP7, WP17 | PASS     | PASS     | sheer cloth alpha 0.295 in the middle and 0.522 at the edge on WebGL, 0.291 and 0.522 on WebGPU; the highlight moved 45.6 and 57.4 px               |
| `verify-dither`            | WP2       | **FAIL** | PASS     | WebGL: no bands without dither on a plain camera (0.051), so its premise fails; an HDR chain 0.204 to 0.050. WebGPU: 0.200 to 0.046, 0.204 to 0.049 |
| `verify-gltf-instancing`   | WP4       | PASS     | PASS     | twelve copies as by hand; Meshopt in two workers to the same bytes (about 4 ms here, 1 ms there)                                                    |
| `verify-gpu-depth`         | WP16      | **FAIL** | **FAIL** | reflections: the glTF material 94.3 against the PBR one 84.1 (limit 6). Everything else as on the desktop; compute runs on WebGPU                   |
| `verify-physical-surfaces` | WP7       | PASS     | PASS     |                                                                                                                                                     |
| `verify-gltf-intake`       | WP4       | PASS     | PASS     | WebP and AVIF decode on the phone                                                                                                                   |
| `verify-animation-control` | WP10      | PASS     | PASS     | a pose from two clips on twelve bones in 0.014 ms (WebGL), 0.010 ms (WebGPU)                                                                        |
| `verify-developer-tooling` | WP15      | PASS     | PASS     | WebGL: GPU time unavailable (no `EXT_disjoint_timer_query_webgl2`), said so. WebGPU: 0.20 to 16.6 ms under glass                                    |
| `verify-specular-aa`       | WP2       | PASS     | **FAIL** | WebGPU: a normal map at no strength changes a pixel by 2.8 of 255 (limit 1; 0 on the desktop, 0.9 on the phone's WebGL)                             |

Eight of ten on each backend. The WebGPU ten were run twice (once before
the switch was in the repository, by the same fixture from outside it):
the same verdicts and numbers. Before LayaAir's two adapter notices were
kept apart, every WebGPU check stopped at its "no shader or GPU warnings"
line with those two lines and judged nothing else.

## Backend delivery (WP12) in the phone's Chrome

The pages `verify-backend-delivery` builds, opened in the phone's Chrome by
a script outside the repository (the check itself starts a browser for each
case and makes it lie about its adapter).

| Page                                     | Backend taken              | Ready  | Notes                                                        |
| ---------------------------------------- | -------------------------- | ------ | ------------------------------------------------------------ |
| `example-2d-auto.html`                   | WebGPU, no fallback reason | 2.95 s | probe 14 ms; thirty cycles, the same counts before and after |
| `example-3d-auto.html`                   | WebGPU                     | 2.98 s | probe 17 ms; thirty cycles, the same counts                  |
| `example-3d-gltf-auto.html`              | WebGPU                     | 2.76 s | probe 27 ms; thirty cycles                                   |
| `example-3d-auto.html?prefer=webgl`      | WebGL, not a fallback      | 2.48 s | the adapter is not asked for                                 |
| `example-3d-gltf-auto.html?prefer=webgl` | WebGL                      | 2.51 s |                                                              |

On every auto page the loader's facts are `secure: true, api: true,
adapter: 'hardware'`, the native engine is `WebGPURenderEngine`, only the
WebGPU bundle is asked for, and no error is reported.

| Compilers                         | From    | Fetched | Compilers      | Ready  |
| --------------------------------- | ------- | ------- | -------------- | ------ |
| In the bundle                     | inline  | 0       | 0.53 to 0.59 s | 2.88 s |
| A release with them beside it     | network | 2       | 0.27 s         | 2.63 s |
| Another release, the same browser | cache   | 0       | 0.06 s         | 2.54 s |

## What the phone showed

### Its driver dithers what is written into an sRGB picture (WebGL)

A probe outside the repository: a ramp of ten steps of eight bits across
512 pixels, drawn by plain WebGL 2 into three places, counted along a row
(about ten changes is ten bands; hundreds is dither).

| Written into     | Adreno 720, GL's dither as it comes | Adreno 720, `gl.disable(gl.DITHER)` | Apple M4, either |
| ---------------- | ----------------------------------- | ----------------------------------- | ---------------- |
| An RGBA8 picture | 10                                  | 10                                  | 10               |
| An sRGB8 picture | **243** (and 63 down a column)      | 11                                  | 11               |
| The canvas       | 10                                  | 10                                  | 10               |

A plain camera draws its materials into an sRGB eight-bit picture: on this
phone under WebGL that picture is dithered by the driver, and there are no
bands for the engine's dither to remove (a block of pixels is 0.051 of a
step off the ramp without it, 0.045 with it, and a pixel further off:
`'materials'` there adds grain and nothing else). `verify-dither` first
asserts that there are bands without dither, and stops there. Through an
HDR chain (rounded at the canvas, which the driver leaves alone) and on
WebGPU the bands are there and the engine's dither removes them as on the
desktop. The check was not changed.

### Screen reflections are not the desktop's

`verify-gpu-depth`, the mean of a patch of each of three plates (rough PBR,
smooth PBR, a glTF material as rough as the first), of 255:

| Reflections                  | Apple M4 (WebGL)    | vivo V40 (WebGL)    | vivo V40 (WebGPU)   |
| ---------------------------- | ------------------- | ------------------- | ------------------- |
| Without the surface pictures | 127.7, 129.3, 127.7 | 146.9, 152.8, 142.1 | 146.8, 152.8, 142.1 |
| With them                    | 92.8, 159.7, 94.7   | 84.1, 149.7, 94.3   | 84.1, 149.7, 94.2   |
| With them, wet               | 171.4, 173.5, 174.6 | 156.0, 162.8, 174.1 | 156.0, 162.8, 174.1 |

What WP16 added holds on the phone: with the surface pictures the smooth
plate reflects 66 more than the rough one, the glTF material is read (it
was not, before), and switching them on and off while it runs gives the
same pictures. What fails is the check's "the glTF material is read as the
PBR one" (10.2 apart, limit 6), and it would fail next at "wet, rough is as
smooth as smooth" (6.8, limit 6). The phone's two backends agree with each
other to a tenth and differ from the desktop's without the surface pictures
too, so it is the reflection pass itself that the phone draws differently,
plate by plate. The pictures show fine diagonal noise where the desktop
shows level stripes. **The cause was not found.**

### A normal map at no strength is not quite nothing (WebGPU)

`verify-specular-aa` on the phone's WebGPU: with a normal map whose strength
is zero, one or more pixels differ by 2.8 of 255 from the picture without
the map (no difference on average). The limit is 1; the desktop gives 0 and
the phone's WebGL 0.9. Everything before that line passed. Not looked into.

### What its WebGPU adapter does not have

LayaAir says at start, on every page: `float32-filterable` and
`bgra8unorm-storage` are not supported by the adapter. Nothing the ten
checks draw failed for it. What reads a 32-bit float texture with
filtering (none of these ten does) was not drawn on the phone.

### Compute

On the phone's WebGPU a million particles step in 14.4 ms on the GPU and in
80.6 ms by the same step in JavaScript (1.65 ms and 24.5 ms on the desktop).
On its WebGL the pass runs its JavaScript step, as on the desktop.

## Lifecycle and failure cases

- Unit (`tests/phone-chrome.test.mjs`): a tab that is not blank and not
  this machine's is never chosen; the fixture refuses, in words, when the
  endpoint is not named, when nothing answers there, and when the phone has
  no blank tab (it lists the tabs once and attaches to none); only an http
  address of this machine's loopback is given a way back; only a line that
  says what the adapter does not have is a notice.
- On the phone, every check's own "nothing left behind" held where it has
  one.

## Prefab evidence (visual work)

Not applicable: engine fixtures only.

## Limits and decision

- One phone, one run of each check on each backend (the WebGPU ten twice).
- Three checks fail on the phone and stay failed: `verify-dither` on WebGL
  (its premise), `verify-gpu-depth` on both backends (a tolerance on
  reflections), `verify-specular-aa` on WebGPU (one line). None was
  changed, and nothing was mended.
- The backend delivery check itself was not run on the phone; its pages
  were.
- The older packages' checks (films, looks, effects, grass, crowds) were
  not run through the switch, and never on the phone's WebGPU.
- No other phone, no iOS.

**Recorded.** The switch is accepted (unit tests, twenty runs on a phone).
The packages' phone results are what the table says: WP4, WP7, WP10, WP12,
WP15, WP17 and WP18 pass on the phone on both backends; WP2 and WP16 each
have a check that fails there.
