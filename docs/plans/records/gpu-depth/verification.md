# Verification record: gpu-depth

Task document: `docs/plans/records/gpu-depth/task.md`\
Commit: the commit that adds this file, on top of `9a47fcd`\
Date: 2026-11-15

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9a47fcd`; no consumer.
- DPR, viewport and network mode: DPR 1, 320 by 200, loopback.
- Evidence (outside the repository): `batch2-evidence/gpu-depth/` in the
  session's notes folder: both reports and their pictures, and the sweep's
  logs.

## Checks

| Check                                     | Exact command or procedure                                                                                | Result                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                                          | PASS, 738 of 738 (10 in `tests/gpu-depth.test.mjs`; one test of the game-services follow-up was already in the tree) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`                                                | PASS                                                                                                                 |
| GPU depth, WebGL                          | `npm run verify:gpu-depth`                                                                                | PASS                                                                                                                 |
| GPU depth, WebGPU                         | `GPU_DEPTH_RENDERER=webgpu npm run verify:gpu-depth`                                                      | PASS                                                                                                                 |
| Repeated                                  | the same check four times on each backend: in the sweep, twice alone, once after the last change          | PASS, 8 of 8                                                                                                         |
| The older draws, WebGL                    | the 41 film, look, effect and model draws, and the twelve that run on one backend                         | PASS, 53 of 53                                                                                                       |
| The older draws, WebGPU                   | the same 41 with the WebGPU switch                                                                        | PASS, 41 of 41                                                                                                       |
| After the last change                     | `verify-gpu-depth`, `verify-film-reflections`, `verify-live-look`, `verify-quality-route` on each backend | PASS, 8 of 8                                                                                                         |

The 41 are the 40 of `records/developer-tooling/verification.md` and
gpu-depth itself; the twelve are that record's. The last change came after
the sweep: the one-pixel picture screen reflections keep for a camera
without surface pictures is made only when `surfaces` is asked for (three
unit tests of the reflections showed that it was made for everyone). The
four draws that use screen reflections were run again on both backends.

## What is drawn

Nothing is checked in. Four pages in one fixture, each on WebGL and on
WebGPU:

- **Particles.** 20,000 particles under gravity that bounce off a floor,
  stepped by a `ZhudaComputePass` and drawn as boxes by
  `ZhudaComputedInstances` from the buffer the step writes.
- **Uniforms.** A row of unlit squares, each a `ZhudaShaderMaterial` whose
  colour is what one kind of uniform holds, read back as pixels; a strip of
  the hash, and strips of the noises.
- **Reflections.** A bright wall over three strips of floor: a rough PBR
  material, a smooth one, and a rough one drawn with the shader glTF models
  use. The mirrored patch on each is read.
- **Motion.** A striped box crossing the view four pixels a frame under
  LayaAir's temporal anti-aliasing, against the same frames drawn without
  it.

## Results

The same on WebGL and on WebGPU unless given.

- **Where compute runs.** WebGPU: `zhudaComputeSupported()` is true, a pass
  says `webgpu`, and a pass without a JavaScript step is made. WebGL: false,
  `cpu`, and the pass without a step refuses with `COMPUTE_UNAVAILABLE`.
- **The step is the same arithmetic.** After 60 steps of 20,000 particles,
  read back and compared with the same step run in plain JavaScript beside
  it: the worst difference of any number is 0.000018 on WebGPU and 0 on
  WebGL; no particle's matrix is at another place than its state.
- **The draw reads the pass's buffer.** Nothing is lit before the first
  step; 13,891 pixels are after it, the same count on both backends; 60
  steps more change 10,849 of them, with no read back between; after
  `dispose()` nothing is lit.
- **Counts and part of a buffer.** A `uint` buffer comes back as a
  `Uint32Array` with every element as the step left it (the last is 1693);
  a dispatch of ten indices changes those ten and leaves the rest.
- **What a step costs** (a run of each backend alone, the dispatch and, on
  WebGPU, until the queue is done; the same step in JavaScript beside it):

  | Particles | WebGPU, the call | WebGPU, done | JavaScript on the WebGPU page | The pass on WebGL (JavaScript) |
  | --------: | ---------------: | -----------: | ----------------------------: | -----------------------------: |
  |    20,000 |          0.01 ms | 0.11 to 0.12 |                  0.63 to 0.65 |                   0.60 to 0.68 |
  |   200,000 |     0.01 to 0.02 | 0.42 to 0.56 |                  5.41 to 5.51 |                   5.87 to 5.92 |
  | 1,000,000 |          0.01 ms | 2.22 to 2.48 |                  26.5 to 27.9 |                   29.2 to 29.6 |

  Two runs of each backend with nothing else running. In the sweep, with
  the other backend's checks running beside, the GPU took 0.34, 0.77 and
  2.95 ms.

- **Uniforms**, read as pixels against what was set (of 1):
  `int` 3 chooses the third branch (0, 1, 0); a `mat4` times a vector
  (0.694, 0.198, 0.397) for (0.7, 0.2, 0.4); the third of four `vec4`
  (0.198, 0.497, 0.791) for (0.2, 0.5, 0.8); three `float` (0.896, 0.296,
  0.591) for (0.9, 0.3, 0.6); the second of three `vec3` (0.246, 0.497,
  0.745) for (0.25, 0.5, 0.75); a cube map read along +X, its red face
  (1, 0, 0). An array set again while its shader runs is drawn with the
  new numbers: (0.896, 0.1, 0.397) for (0.9, 0.1, 0.4).
- **The common functions.** Triplanar weights for a tilted normal (0.014,
  0.162, 0.815) for the JavaScript (0.01, 0.163, 0.827); a texture laid on
  by them (1, 0.497, 0) for (1, 0.502, 0). The hash over 256 cells: mean
  0.533, from 0 to 1, each cell within 0.0288 of `zhudaHash2D` for the
  same cell. The noises are smooth: the largest step between neighbouring
  pixels is 0.0108 (`zhudaNoise(vec2)`), 0.01 (`zhudaFbm`) and 0.0206
  (`zhudaNoise(vec3)`) of a range of 0.55, 0.36 and 0.79.
- **Reflections**, mean of the mirrored patch (0..255), WebGL then WebGPU:

  |                          |     Rough PBR |    Smooth PBR | Rough, glTF shader |
  | ------------------------ | ------------: | ------------: | -----------------: |
  | no reflections           |       13 / 13 |   27.4 / 27.4 |            13 / 13 |
  | alike                    | 127.7 / 127.8 | 129.3 / 129.3 |      127.7 / 127.8 |
  | `surfaces`               |   92.8 / 91.8 |   159.7 / 156 |        94.7 / 93.7 |
  | `surfaces`, `wetness: 1` | 171.4 / 169.6 | 173.5 / 169.7 |      174.6 / 172.9 |

  The rough strip reflects less than alike and the smooth one more; the
  glTF strip follows the rough PBR one (before
  `installLaya342SurfaceBuffer` its shader wrote nothing and it reflected
  like "alike"); with
  `wetness: 1` the three are within 4 of each other. `setReflections`
  from alike to `surfaces` and back on a running pipeline gives the same
  numbers as pipelines made that way.

- **Motion.** Mean difference of the box's pixels from the same frame
  without temporal anti-aliasing (0..255): 62.16 untracked, 0 tracked,
  62.16 untracked again after `remove()`, 0 standing still. Behind the box
  nothing trails either way (0).
- **Nothing left behind** by the compute pass and its draw, or by the
  uniform materials. A pipeline with `surfaces` leaves two render textures
  after it is disposed: LayaAir's camera keeps its group of surface
  pictures (normal and surface) for the next camera that asks.
  `ZhudaObjectMotion` leaves nothing more.
- No shader error, console error or GPU warning on either backend.

Pictures looked at: `particles.png` (a cloud of small boxes over the
floor), `uniforms.png` (the row of squares in their colours, the grey
strips of noise without seams), `reflections-alike.png` and
`reflections-surfaces.png` (the wall mirrored evenly, then dim on the rough
strips and bright on the smooth one), `motion-untracked.png` and
`motion-tracked.png` (the box's stripes smeared, then sharp).

## Found on the way

- LayaAir decides `#ifdef NAME` itself, from its own defines, before the
  GLSL compiler sees a `#define NAME` in the source: a shader cannot switch
  a block of itself on that way. `#if defined(NAME)` is left to the
  compiler and does see it. The two kinds of reflection are two shader
  texts made from one template.
- LayaAir's `DeviceBuffer.destroy()` destroys a storage buffer that is
  also a vertex buffer twice and throws. `ZhudaComputePass` destroys the
  vertex side only, which releases the one GPU buffer.
- The shader glTF models are drawn with never wrote LayaAir's surface
  pictures: anything of LayaAir's that reads them (its own screen-space
  reflections included) saw a glTF model as nothing. It writes them now.
- The surface pictures work on WebGL as on WebGPU; the plan had them as
  WebGPU-only.
- A matrix that cannot be inverted (a node scaled to nothing) made the
  motion arithmetic throw; such a node is written as standing still.

## Unverified limits

- One desktop GPU and one browser; **no phone**: compute on a phone's
  WebGPU, and what two more pictures in the opaque pass cost a phone, were
  not measured.
- Compute was run with `float`, `vec4` and `uint` buffers and `float`,
  `vec4` and `int` uniforms, one pass at a time. Two passes sharing a
  buffer, a pass larger than a million indices, and a lost device were not
  run.
- The step's cost was timed on one page; the two backends' "JavaScript"
  columns are the same code and differ by the run.
- `textureCube` was drawn with one colour a face, without mipmaps; a cube
  map loaded from files was not. `texture3D` and texture arrays are not
  offered.
- The hash agrees with JavaScript to 0.03 on this GPU; another GPU's
  rounding was not seen. 9 of 10,000 neighbouring cells of the JavaScript
  hash are within 0.001 of each other.
- Reflections by surface were drawn on flat strips. A normal map bending a
  reflection is what the surface picture holds but was not measured;
  metals, and a material that writes nothing among ones that do, were not
  drawn. Reflections do not blur with roughness.
- Motion: one box, one speed, a camera that stands still. A skinned mesh
  gets its node's motion (unit-tested, not drawn); instanced copies get
  none; a moving camera with moving things was not drawn.
- A film scene with `"surfaces": true` is validated and unit-tested; no
  film was rendered with it.
