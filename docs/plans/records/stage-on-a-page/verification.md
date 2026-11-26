# Verification record: stage-on-a-page

Task document: [`task.md`](task.md)\
Commit: the one that adds this file, on `unified` after `b23b74ef`\
Date: 2026-11-26

## Environment

- macOS 27.2 on an Apple M4; headless Chrome 158 on the graphics card
  (`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`), WebGL and WebGPU.
- Node 26.13.1, npm; the pinned toolchain.
- Engine: `unified` at `b23b74ef` plus this change. No consumer outside the repository.
- 480 × 300 at device pixel ratio 1 for the page checks. No phone.

## The report, item by item

An outside agent's report on the tagged 2.0.0 (`91d21f79`). "Read" is a claim checked in the
code; "drawn" is one checked by a picture or a number from a real browser.

| Item of the report | Verdict | How it was checked |
| --- | --- | --- |
| 1.1 A page that calls `setCamera` and `prepare` draws every focal length at one angle | **True; closed** | Drawn before the change: 17 mm and 50 mm both gave a camera 50 degrees high (`live-look-before.json`). The three reference games had a line of their own for it. After: 70.44 and 26.99 degrees, WebGL and WebGPU |
| 1.2 A quality governor that reaches level 0 on a scene with bounce light throws | **True; closed** | Drawn before the change: `Film stage: setLook cannot change the bounceLight; mount the scene again`. Read: a colour table without water threw the same way. After: 3, 0, 1, 3 with no error and the first frame again (mean difference 0) |
| 1.2, second part: `Cannot set properties of null` after a view switch | Not an engine defect | Read: a disposed stage throws on every call; the frame callback has to replace its stage in the callback that disposes. Written in the route |
| 2.1 `screenReflections` with the default `grade.antialias` throws `Camera opaque MRT does not support MSAA` | **Not reproduced** | Drawn: `npm run verify:film-reflections` (offline) and the page check through levels 3, 2, 1, 3, 0, 3, on WebGL and WebGPU: no error, the first frame again. Read: LayaAir throws that message when `msaa` is set on a camera whose `opaqueMRT` was set by hand; the engine asks for those pictures through an effect and never sets it. No lint rule was added |
| 3.1 A `point` light with `castsShadow` speckles in a closed room; a wide `spot` does not | **Not reproduced** | Drawn: a closed room with a pillar and a bevelled box, one lamp (`room-point-and-spot.jpg`): the point light's shadows are clean; the spot lights only its cone and leaves the ceiling and upper walls dark, so it is not a replacement. Not written as advice |
| 3.2 Which way `pitchDeg` turns and where an extruded piece stands is easy to get wrong | True; documented | Computed (`axes.mjs`): an extrusion stands from y = 0 to its height and a bevel stays inside that box; +90 pitch lays +Y along +Z, -90 along -Z; +90 yaw turns +Z to +X; +90 roll turns +X to +Y. Now in the doc comments |
| 4.1 `chromeFixture.evaluate` takes only text; `screenshot` returns nothing | True as described; changed | `evaluate` and `waitFor` take a function too; `screenshot` returns the PNG and its file is optional. An example is in `docs/consumer-tooling.md` |
| 4.2 The splash is in the first screenshot | Closed after 2.0.0 already | `whenZhudaSplashGone` (commit `378ff8cd`) is not in the tagged 2.0.0 the report was written on |
| 4.2 A script fails in a folder with Chinese in its name | Not the engine's | No engine script or template uses `new URL(…).pathname`; the example added uses `fileURLToPath` |
| 5 A route for a live viewer | Written | `docs/routes/interactive-film-viewer.md`; what it did not draw is listed there |

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, Doctor, regression | `npm run verify` | PASS: 1091 of 1091 | - |
| Lint | `npm run lint` | PASS | - |
| Format | `npm run format:check` | FAIL on `tests/minigame-toolchain.test.mjs` only, which this change does not touch (as before it); the files of this change are in form | - |
| Reference games | `npm run verify:games` | PASS: nine games; `zhuda-wardrobe`, `zhuda-hunt` and `zhuda-guard` now draw through `prepare` alone | - |
| Prefab library | `npm run verify:prefabs` | PASS: 206 tests, both viewers | - |
| A stage on a page, before the change | `npm run verify:live-look` with the new page checks and the engine as it was | the two defects, as in the table | `local-results/stage-on-a-page/live-look-before.json` |
| A stage on a page, after | `npm run verify:live-look`; `LIVE_LOOK_RENDERER=webgpu npm run verify:live-look` | PASS on both; no page, console or renderer error | `live-look-after-webgl.json`, `live-look-after-webgpu.json` |
| Offline pictures are not changed by `prepare` | `npm run verify:film`, `verify:film-look`, `verify:film-reflector`, `verify:film-remount`, `verify:film-reflections`, `verify:film-bounce`, `verify:film-lut`, `verify:film-water`, `verify:cinematic` | PASS, all nine (each compares pictures or pixels of its own) | - |
| Unit | `node --test tests/bounce-light.test.mjs tests/cinematic-capture.test.mjs tests/chrome-wait.test.mjs` | PASS | - |
| Routes and documents | `node --test tests/implementation-routes.test.mjs tests/docs-index.test.mjs` | PASS: 10 | - |
| Device | - | UNAVAILABLE: no phone was used | - |

## Lifecycle and failure cases

- A capture holds a sample of the lens while it draws: `prepare` leaves the lens alone then
  (`ZhudaPhysicalCameraRig.sampling`; `apply` still throws if called), so a film's samples are
  as before.
- A refused look leaves the stage as it was: an authored change of the bounce light after the
  levels went down and up is still refused with the same message (drawn).
- Quality 0 on a scene with bounce light rebuilds the look without an HDR chain and keeps the
  bounce light; back at 3 the frame is the first frame (drawn).
- A stage mounted three times and disposed three times in the page check leaves no page,
  console or renderer error.

## What changes for a consumer

- A page that set `stage.camera.fieldOfView` itself and called `prepare` now gets the lens's
  angle: set the focal length through `setCamera`.
- `setLook` that drops the scene's colour table, or names it again, is a rebuild and no longer
  an error. Another table than the one loaded is still refused.
- `chromeFixture().screenshot()` returns bytes where it returned nothing.

## Not verified

- A phone or a tablet; touch.
- The outside project's scene: not in this repository. The two items not reproduced stay open
  until a scene that shows them is given.
- A visitor's orbit camera, its limits in a room, and mounting again with `bakeCache`: the
  route describes them from the report and from the public API, no check here draws them.
- The tagged 2.0.0 is unchanged: a consumer pinned to the tag has none of this.
