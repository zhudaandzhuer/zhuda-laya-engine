# Verification record: shader-warm-up

Task document: `docs/plans/records/shader-warm-up/task.md`\
Commit: the commit that adds this file, on top of `f43f2cc`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Adreno 720, Chrome 156, WebGL 2, driven through its Chrome debugging port.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `f43f2cc`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300; loopback (the phone
  through `adb reverse`).
- Evidence (outside the repository): `batch2-evidence/shader-warm-up/` in
  the session's notes folder: both reports, the recorded lists, the six
  pictures of each backend, the phone's report.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 636 of 636 (8 new in `tests/shader-warm-up.test.mjs`) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| Warm-up, WebGL | `npm run verify:shader-warm-up` | PASS |
| Warm-up, WebGPU | `WARM_UP_RENDERER=webgpu npm run verify:shader-warm-up` | PASS |
| Warm-up, phone | the check's page served to the phone, run cold, then recording, then warmed up, in one tab | measured (below); no assertion script on the phone |

## What is drawn

One scene (a ground, six balls and six boxes in six materials: plain,
textured with a normal map, glowing, see-through, unlit, clear-coated; a
sun and a lamp) with a look (soft shadows in two splits, fog, bloom, ambient
occlusion, multisampling), mounted in three browsers of their own so that no
run inherits another's compiled programs:

- **record**: the recorder is made after boot; the scene is drawn, then its
  look is taken through levels 2, 1, 0 and back to 3.
- **cold**: the same without anything else.
- **warm**: the scene and its look are made, the scene is kept from being
  drawn, the recorded list is compiled 8 ms a frame, then the same frames.

Every compile LayaAir makes is counted (`ShaderPass.createShaderInstance`).
A frame is timed to the end of the graphics card's work (`finish` and a
one-pixel read on WebGL, `onSubmittedWorkDone` on WebGPU).

## Results

32 variants on both backends (PBR 12, glTFPBR 5, Unlit 3, the sky, eleven of
the post-process chain); the list is valid, has no repeat, holds one entry
for each compile after boot, and the same variants in another order give the
same list.

| | Cold first frame | Warm first frame | Cold to level 1 | Warm | Cold to level 0 | Warm |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop WebGL | 112.0 ms, 27 compiled | 13.5 ms, 0 | 6.0 ms, 1 | 4.9 ms, 0 | 39.1 ms, 4 | 3.6 ms, 0 |
| Desktop WebGPU | 625.4 ms, 27 | 178.3 ms, 0 | 11.3 ms, 1 | 5.3 ms, 0 | 133.1 ms, 4 | 18.8 ms, 0 |
| vivo V40, WebGL 2 | 161.4 ms, 27 | 42.5 ms, 0 | 20.1 ms, 1 | 12.7 ms, 0 | 43.4 ms, 4 | 13.3 ms, 0 |

Steady frames: 5.4 and 5.7 ms (WebGL), 5.3 and 4.3 (WebGPU), 14.6 and 15.5
(phone).

The warm-up itself:

| | Compiled | Compiling | Slices | Wall time | Frames meanwhile | Longest single compile |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop WebGL | 32 | 131 ms | 13 | 190 ms | 12 | 10.7 ms |
| Desktop WebGPU | 32 | 589 ms | 26 | 666 ms | 25 | 175 ms |
| vivo V40 | 32 | 165 ms | 17 | 257 ms | 16 | 10.6 ms |

Asserted on both desktop backends:

- the cold run compiles at its first frame (27) and at changes of level (5),
  and compiles exactly the variants the record run listed;
- the warm-up compiles all 32, nothing is missing or failed, frames went on
  being drawn between its slices;
- after it the first frame, six steady frames and every change of level
  compile nothing, and nothing was compiled outside the warm-up;
- the warmed-up picture equals the cold one at look level 3 and at level 0:
  mean and worst difference 0 of 255 over a 24 by 15 grid of cells, on both
  backends, and the picture is a picture (cells range over more than 60);
- asked again the warm-up compiles nothing (32 cached); a list of the other
  backend and something that is not a list are refused in the report; a
  shader that is not registered is reported missing; a cancelled signal
  rejects with `AbortError`;
- one recorder at a time; stopping gives `Shader3D.debugMode` and LayaAir's
  own collection back;
- no page, console, renderer or GPU error or warning in any of the runs.

## Found while drawing

- **A compile ahead of the first frame is wrong unless it has the scene's
  uniform sets.** LayaAir decides at compile time which uniforms belong to
  the scene from `preDrawUniformMaps` of the render context, which holds the
  scene's and the global sets, and the shadow maps on frames that draw
  shadows. Before a first frame it holds none of them. With LayaAir's own
  list alone: on WebGL the scene's lights, fog and shadows were taken for
  the material's and every lit surface was drawn dark (the unlit ones were
  right; mean difference 34.9 of 255, worst cell 161, in the picture
  comparison that was added for this); on WebGPU eight PBR variants did not
  compile (`'u_ShadowMap' : undeclared identifier`) and the first frame
  then failed with `'Material' : nameless block contains a member that
  already has a name at global scope`. The recorder now keeps the sets with
  each variant and the warm-up puts them in force for its compile.
- **LayaAir lists a node's uniform maps sorted; on WebGPU their order is
  the order of the bindings.** The sky's maps came back as `SkyRenderer,
  Sprite3D`, and every draw of it was invalid (`Buffer bound with size 112
  at group 2, binding 0 is too small ... requires at least 224 bytes`). The
  recorder keeps the node's own order.
- **A scene that is drawn compiles as it goes.** With the scene on the
  stage during the warm-up, 23 of the 32 variants were compiled by the
  frames between the slices, each a long frame. The scene is kept inactive
  until the warm-up is done; the documentation says so.
- **Effects register their shader when first made.** The one-pass edge
  smoothing, which the look uses from level 1, was not registered when the
  warm-up ran; the engine's effects now leave their registration where the
  warm-up can run it.

## Lifecycle and failure cases

Unit-tested on a LayaAir stand-in (`tests/shader-warm-up.test.mjs`):
validation field by field; the order-free, repeat-free list; merging;
the recorder's switches given back; each compile made with the variant's
node maps, attribute locations and scene sets, and the pass and the scene's
sets left as they were; slices by budget with one compile at least in each;
the compile counter in place only while a slice runs; cancellation before
and between slices; a foreign or malformed list refused; a missing shader,
a compile that throws and a 3D variant without its scene sets reported; an
effect registered when its name is met, once.

## Limits and decision

- One desktop GPU and one phone. The phone ran cold, record and warm in one
  tab of a browser that had not compiled this page's shaders before; the
  second mount (record) compiled as slowly as the first, so the browser's
  own cache did not flatter the warm run much, but that was not controlled.
- WebGPU on a phone, other browsers, mini-game hosts: not run.
- On WebGPU the render pipelines are made at the first draw: 178 ms of the
  first frame remain. Not addressed.
- The longest single compile cannot be split: 175 ms on desktop WebGPU (the
  first compile starts the GLSL and WGSL compilers), about 10 ms elsewhere.
- A list recorded on one device was not tried on another. Defines that
  depend on the device (texture formats, shadow filters) would give variants
  the list does not hold; they are compiled at first draw as before.
- The scene is a fixture of six materials. No game's list was recorded; how
  long a real game's warm-up takes is not measured.
- Not built: a draw-everything fallback, a build-time recorder, async or
  off-thread compilation.

Decision: **Implemented within scope**. Not Accepted: no consumer has
recorded and shipped a list.
