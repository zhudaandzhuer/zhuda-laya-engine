# Verification record: developer-tooling

Task document: `docs/plans/records/developer-tooling/task.md`\
Commit: the commit that adds this file, on top of `7a421cc`\
Date: 2026-11-15

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `7a421cc`; no consumer.
- DPR, viewport and network mode: DPR 1, 480 by 300, loopback; the model
  editor at 1280 by 800.
- Evidence (outside the repository): `batch2-evidence/developer-tooling/` in
  the session's notes folder: both reports and their pictures, the editor's
  screenshots, and the sweep's logs.

## Checks

| Check                                     | Exact command or procedure                                                        | Result                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                  | PASS, 727 of 727 (13 in `tests/developer-tooling.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`                        | PASS                                                        |
| Developer tooling, WebGL                  | `npm run verify:developer-tooling` (with the model editor in a browser)           | PASS                                                        |
| Developer tooling, WebGPU                 | `TOOLING_RENDERER=webgpu npm run verify:developer-tooling`                        | PASS                                                        |
| Repeated                                  | the same check five times on each backend after its last change                   | PASS, 10 of 10                                              |
| The older draws, WebGL                    | the 40 film, look, effect and model draws, and the twelve that run on one backend | PASS, 52 of 52                                              |
| The older draws, WebGPU                   | the same 40 with the WebGPU switch                                                | PASS, 40 of 40                                              |

The 40 are the 39 of `records/backend-delivery/verification.md` and
developer-tooling itself; the twelve are that record's eleven and
`verify-backend-delivery`.

## What is drawn

Nothing is checked in but a generated character on twelve bones
(`tests/helpers/toon-fixture.mjs`). A floor, a crate, a sun, a point light,
a spot, a second camera and the character are looked at from one camera
whose numbers the check knows, so that it can say which pixel a point of
the world is. A helper counts as drawn where the pixel nearest its colour,
within two pixels of where a point of it should be, is within 12 of 255 of
that colour.

## Results

The same on WebGL and on WebGPU unless given.

- **A sheet of every helper.** 202 segments for the world's axes, a grid,
  the crate's bounds, the sun's arrows, the point light's reach, the spot's
  cone and the second camera's frustum, as counted beforehand; 11 for the
  character's bones, drawn over everything. Each is within 1 of 255 of its
  colour at the place worked out for it: the three axes, a grid line, an
  edge of the bounds, the sun's shaft, the top of the point light's sphere,
  the rim of the spot's cone on the floor, the top edge of the camera's
  near rectangle, the middle of a bone.
- **They follow.** The crate moved and the sheet updated: its bounds are at
  the new place (1 of 255) and not at the old (125). With the grid removed
  the sheet has 18 segments fewer, the grid's place shows the floor, the
  axes are still there. Disposed, the picture is the first one, pixel for
  pixel.
- **Behind things or over them.** A line through the crate: inside the
  crate's outline it is not seen (156 of 255 from its colour), outside it
  is (0); with `onTop` it is seen inside too (0).
- **The sun's cascades.** No segments while the scene draws no shadow. With
  soft shadows over 12 units in two cascades: two spheres, centres
  (4.64, 3.98, 6.95) and (1.17, 1.37, 1.74), radii 2.56 and 7.39, the
  nearer one first; the crate is inside the far one (0.31 of its radius
  from its centre).
- **The statistics panel.** Shown, it changes 71,400 pixels of the game's
  own picture; hidden, the picture is as before; shown again and hidden
  twice, the same.
- **A shader that does not compile.** One entry in
  `context.renderer.errors` on each backend, the log and four numbered
  lines with the failing one third. WebGL: `ERROR: 0:84: 'notDeclared' :
undeclared identifier`, lines 82 to 85; the pass is skipped and nothing
  throws. WebGPU: `ERROR: :198: …`, lines 196 to 199; LayaAir's draw throws
  on the buffer the shader never made.
- **The profiler.** Ten more boxes, each with a material of its own: 10
  more draws and 120 more triangles (WebGL 1 draw and 2 triangles before,
  WebGPU 1 and 1: LayaAir's own last copy to the screen). After `dispose()`
  the browser's own methods are back (`[native code]`).
- **GPU time**, median of 40 frames, the scene and the scene under 500
  sheets of glass that fill the view, over the runs made: WebGL's timer
  0.26 to 1.57 ms and 1.94 to 3.02 ms; WebGPU's timestamps 0.07 to 0.52 ms
  and 3.87 to 9.04 ms. Every one of the 40 frames came back with a time.
- **The gizmo.** Its handles are drawn over the crate in their colours
  (1 of 255); the one under the pointer is yellow. A drag from the middle
  of a handle to a point one handle's length (1.941 units) further along
  it moves the crate 1.941 along x, y and z in turn and not at all along
  the other two. A pointer down away from the handles is refused. A drag
  from where the ring about Y crosses +X to where it crosses -Z turns the
  crate a quarter turn about Y (0, 0.707, 0, 0.707). The scale handle of Y
  pulled to one and a half times its length: scale (1, 1.5, 1); `cancel()`:
  (1, 1, 1). Disposed, the picture is the first one.
- **Nothing left behind** by the helpers, the profiler or the gizmo. The
  panel leaves LayaAir's text atlas (1024 by 1024); on WebGPU the frame the
  broken shader threw in leaves LayaAir's frame target.
- **The model editor** (WebGL, a real browser, the pointer through the
  browser's own input). A drag of 100 by 40 pixels on the empty part of the
  view turns it 35° and tilts it 14°; the wheel moves the camera away by
  1.08. With **Move** on, the x handle under the pointer is the one that
  lights up; a drag along it moves the model's root 0.396 units, one
  handle's length, along x and not along y or z, the view does not turn
  meanwhile, and the readout shows the new number. **Reset transform** puts
  it back. No page error.

## Found on the way

- The model editor never kept its camera: its drag to turn and its wheel
  to zoom did nothing, and the distance it worked out for a loaded model
  was never used. It keeps the camera now, orbits the middle of the stage,
  and frames a model by the size it has on the stage.
- LayaAir makes a material for each line sprite and leaves it when the
  sprite is destroyed. `ZhudaDebugDraw` destroys it.
- LayaAir does warn about a failed WebGL compile, in the console and
  without the source; the plan's "silent" was wrong. What was missing was
  the source lines and a place a program can read.
- The sun's shadow map cannot be shown as a picture on either backend (a
  comparison texture). What it covers is shown instead.
- A drag measured by where the pointer's ray passes closest to the axis
  moves a node less than the pointer moved when the pointer is beside the
  axis (2.02 for 2.5 in the first unit test). It is measured in the plane
  that holds the axis and faces the viewer.
- A one-pixel green line looks white in a picture scaled for viewing; the
  pixels are green. Helper colours are checked by number.

## Unverified limits

- One desktop GPU and one browser; no phone.
- GPU time was compared between a light and a heavy frame, not against
  another instrument. The two backends' numbers are different measurements
  and were not expected to agree.
- The WebGL timer was available here; the path where it is not is
  unit-tested only.
- The gizmo was dragged along straight handles and a quarter of a ring, in
  one view. Local space, snapping and an orthographic camera are unit-tested
  only.
- The model editor was driven on one generated model.
- Helpers under an HDR chain (their colours go through the tone curve) were
  not drawn.

## Two things the check did by the clock (2026-11-15, with the glTF follow-up)

Running the check among others for the glTF follow-up, it failed twice in a
row and then passed three times alone. Both causes were in the check, not
in what it checks:

- The character was held still with `animator.speed = 0` after several
  frames had been drawn. LayaAir moves an animation on by the clock, so the
  pose it froze in depended on how long the page had taken to get there;
  on a slower run it bent across the world's z axis and hid the pixel the
  check reads ("axisZ ... off by 141"). It is held at the first frame of
  its clip now, before anything is drawn.
- 500 sheets of glass were not always enough for the GPU-time comparison:
  one WebGL run gave 1.57 ms without them and 2.04 ms with (the difference
  has to be over 0.5 ms). The load is 1,500 sheets now. Five runs on each
  backend afterwards: WebGL 0.28 to 1.30 ms and 3.60 to 4.14 ms; WebGPU
  0.07 to 0.13 ms and 6.68 to 8.45 ms. The figures for 500 sheets in the
  results above are as they were measured then.
