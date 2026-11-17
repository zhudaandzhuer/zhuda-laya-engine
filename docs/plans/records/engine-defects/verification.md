# Verification record: the engine defects left open on 2026-11-17

Task document: `docs/plans/records/engine-defects/task.md`\
Commits: `c7ab3d1` (lit surface), `3c94aa9` (health table), `2097bc4`
(WebGPU batch marks), `da5ea8f` (WP23, WP22), `1e0190f` (browser checks),
`77e3664` (developer-tooling check), `95aee18` and `065b9fe` (WebGL batch
marks and instance buffers); base `ffb2147`\
Date: 2026-11-17

## Environment

- macOS, Apple M4, Chrome 157 headless, WebGL (ANGLE Metal) and WebGPU.
- The Windows host: Intel UHD 770, Chrome, ANGLE Direct3D 11 and WebGPU
  (gen-12lp), desktop session through a scheduled task.
- An iPhone 14, iOS 27.2.1, Safari 27.2, WebGPU, over the LAN (HTTPS with a
  certificate made for the run).
- A vivo V40 (Adreno 720, Chrome 157 on Android 16, WebGPU and WebGL), over
  USB on 2026-11-18, at `1197e20`.

## 1. Lit surfaces of one name with other starting values

| Check                                                                                                    | Result        |
| -------------------------------------------------------------------------------------------------------- | ------------- |
| `tests/lit-surface.test.mjs`: two materials of one name, vec3 values red and blue: one shader, both kept | PASS          |
| The same name with a vec4 in place of a vec3                                                             | still refused |

## 2. WP22: a sun with its shadow beside a brighter rim light

`verify:node-bindings`: a floor and a box, a sun at 1.8 casting a hard
shadow; then a rim light at 3.6 that casts none. The shadow is the mean
darkening over the frame against the same frame with the sun's shadow off.

| Run (macOS)                             | Sun alone: shadow, main light | With the rim: shadow, main light |
| --------------------------------------- | ----------------------------- | -------------------------------- |
| Without the adapter, WebGL              | 0.948, the sun                | **0**, the rim                   |
| Without the adapter, WebGPU             | 0.948, the sun                | **0**, the rim                   |
| `da5ea8f`, WebGL and WebGPU             | 0.948, the sun                | 0.566, the sun                   |
| Windows host, `1e0190f`, WebGL / WebGPU | 0.943 / 0.948, the sun        | 0.565 / 0.567, the sun           |

The shadow is smaller beside the rim because the rim lights the shadowed
floor too. `tests/shadow-light.test.mjs` checks the choice against LayaAir's
queue: the brightest that casts a shadow; the brightest when none does; the
queue's own length; installed once.

## 3. WP23: a program that does not compile, on WebGPU

`verify:node-bindings`: a lit surface whose hook uses an undeclared name,
beside a good sphere; frames counted for one second.

| Where                        | Frames in a second | The other sphere | Errors                                                                                                                          |
| ---------------------------- | ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| WebGPU, before               | not counted        | —                | LayaAir throws `TypeError` (`spirv.buffer` of null) out of the frame (the plan's finding; `verify:developer-tooling` caught it) |
| macOS WebGPU, `da5ea8f`      | 60                 | 120.4            | the compiler's message, then the engine's note, once                                                                            |
| macOS WebGL                  | 60                 | 120.4            | the compiler's message                                                                                                          |
| Windows host, WebGPU / WebGL | 59 / 61            | 120.36           | as on macOS                                                                                                                     |
| iPhone 14, WebGPU            | 60                 | 120.37           | as on macOS (Safari's own text: `null is not an object`)                                                                        |

`verify:developer-tooling` had counted on the throw: it expected one error
and allowed one resource left behind on WebGPU. It now expects the note, no
throw and nothing left behind on either backend (`77e3664`), PASS on macOS
and the Windows host, both backends.

## 4. Batch marks (MEM-01's open part)

`verify:webgpu-churn` has a `batch` kind: one scene that stays, each cycle
three boxes with a new mesh and a new material, drawn, destroyed.

| Run                       | Marks / buffer states                                                  | Heap a cycle    | Result |
| ------------------------- | ---------------------------------------------------------------------- | --------------- | ------ |
| macOS WebGPU, before      | `OneBatchMark` 800 → 2600 over 900 cycles                              | 10.7 KiB        | FAIL   |
| macOS WebGPU, `2097bc4`   | `OneBatchMark` between 1 and 52                                        | 0.93 KiB        | PASS   |
| Windows WebGPU, `1e0190f` | between 2 and 34                                                       | 0.88 KiB        | PASS   |
| Windows WebGL, `1e0190f`  | a material and two shader data a cycle kept                            | 6.23 KiB        | FAIL   |
| macOS WebGL, `95aee18`    | 5 to 15 buffer states; 4 materials alive after a GC (the last cycles') | 0.41 KiB        | PASS   |
| macOS WebGL, `065b9fe`    | no material or shader data kept                                        | 0.40 KiB        | PASS   |
| Windows WebGL, `065b9fe`  | no growth                                                              | 0.39 KiB        | PASS   |
| Windows WebGPU, `065b9fe` | `OneBatchMark` 0.001 a cycle                                           | under the bound | PASS   |

The 2D and 3D kinds stayed as they were (2D 0.07, 3D 0.34 KiB a cycle on
macOS WebGL). `tests/render-cache-bounds.test.mjs` checks both sweeps: a mark
that holds nothing (WebGPU) or drew only destroyed renders (WebGL) is let go,
one in use stays, a destroyed geometry's instance buffers go and a live
one's stay.

### One pixel on Direct3D 11

With `95aee18` the WebGL sweep destroyed a dead geometry's instance buffers
inside LayaAir's batch pass. On the Windows host `verify:instanced-mesh`
(WebGL, a baked crowd copy against LayaAir's skinning, bit for bit) then
differed by 1/255 at one pixel in some runs:

| Build on the Windows host (Intel UHD 770, Direct3D 11)                                                                     | Runs | Differed |
| -------------------------------------------------------------------------------------------------------------------------- | ---- | -------- |
| `1e0190f`, before the WebGL sweep                                                                                          | 19   | 0        |
| `95aee18`, buffers destroyed inside the batch pass                                                                         | 26   | 2        |
| `95aee18` without the instance buffers' sweep (marks still swept; one build)                                               | 8    | 0        |
| `95aee18` with neither sweep                                                                                               | 4    | 0        |
| `065b9fe`: buffers leave the table at once, destroyed at the next frame's start (24 of the runs as its patch on `95aee18`) | 25   | 0        |

macOS never differed. The numbers do not tell the deletion inside the pass
from Direct3D 11's own 1/255 in a session's first frames (QA-01): two in
twenty-six is not far from none in nineteen. The destruction was moved to
the start of the next frame, outside the drawing of any pass.

## 5. The health table

`tests/disclosure-contracts.test.mjs`: a WebGPU page counts three modules
(core and two render modules), five with the shader compiler's two files,
and one when `WebGPURenderDeviceFactory` is absent.

## 6. The reports

**Strands turned white.** Rebuilt here from body-lab's code (read, not
changed): 180 straight ribbons 1.1 mm wide and one sheet over a half
cylinder in front of a head, the volume's normal, base colour
0.05 × 0.7, a sun from the front at 1.5, ambient 0.25; mean luminance over
the hair (0..255).

| `strands`                            | Before | After `c7ab3d1` |
| ------------------------------------ | ------ | --------------- |
| none                                 | 32.6   | 32.6            |
| strength 0.1, colour 0.4, 0.32, 0.26 | 57.5   | 38.3            |
| strength 0.5, the same colour        | 61.3   | 52.9            |
| strength 1, the same colour          | 65.5   | 65.5            |
| strength 0.1, colour black           | 35.1   | 35.1            |

The same on WebGL and WebGPU; the sheet within 2 of the ribbons (after the
change 32.9, 38.9, 54.4, 67.8, 35.5). `verify:lit-surface`
now checks the bands at strength 0.5 and 0.1 (peaks 0.75, 0.63, 0.51 and
0.15, 0.13, 0.10 for colour 0.5, 0.25, 0, as 0.5 and 0.1 times one plus the
colour), PASS on macOS and the Windows host, both backends.

**The iPhone's `Unable to finish`.** Pages served from this Mac to the
iPhone's Safari, each posting its result back:

| Page                                                                                 | Result on the iPhone                                                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `node-bindings` (issue #8, WP23, WP22)                                               | every value as on macOS (109.51, 60 frames, 0.948 / 0.566)                                                |
| `lit-surface`                                                                        | 558 values within 0.02 (or 5 %) of macOS's but three, which were the check reading a stale canvas (below) |
| The two scenes of the quality route, 640 × 360 and 1280 × 720                        | drawn, no renderer error                                                                                  |
| 36 film scenes (water, fog, clouds, bounce light, screen reflections, point shadows) | drawn, no renderer error; mean luminance within 0.14 of macOS WebGPU in every scene                       |

No `GPUCommandEncoder.finish` error. The three `lit-surface` values were
the side view of the disc under a plate, read straight after the check had
copied the canvas once for its evidence; Safari gave the previous frame,
and without that copy the values equal macOS's. The game of the report was
not run here.

**QA-01.** Not taken further (one pixel, 1/255, in the first frames of some
sessions on Direct3D 11; the check compares settled frames).

## 7. Check tools

| Check                                 | Result                                       |
| ------------------------------------- | -------------------------------------------- |
| `verify:browser-sdk`, no folder given | PASS, 6 scenarios, built into a fresh folder |
| `verify:branding`                     | PASS, 18 scenarios                           |
| `verify:webgpu`                       | PASS, real WebGPU `3d-gltf-webgpu`           |

## Other checks after the change

| Where                                              | Checks                                                                                                                                                                                 | Result                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| macOS, every `verify:*` check, WebGPU              | 74, `ZHUDA_FILM_RENDERER=webgpu`; 52 at `1e0190f` and 22 at `95aee18` (the run was cut by a restart)                                                                                   | 73 PASS; `developer-tooling` see 3   |
| macOS, every `verify:*` check, default             | the same 74 on each check's default backend (WebGL for the draw checks), at `95aee18`                                                                                                  | 74 PASS                              |
| macOS, WebGL, at `065b9fe`                         | webgpu-churn, instanced-mesh, gltf-instancing, foliage, grass, film-variation, node-bindings, developer-tooling, crowd                                                                 | 9 PASS                               |
| Windows host, at `1e0190f`                         | node-bindings, lit-surface, physical-surfaces, specular-aa, gltf-instancing, lighting-depth, film-webgpu, webgpu-churn, on WebGPU and WebGL                                            | 15 of 16; WebGL `webgpu-churn` see 4 |
| Windows host, at `065b9fe`                         | webgpu-churn, node-bindings, lit-surface, developer-tooling, instanced-mesh, lighting-depth on both backends; gltf-instancing, crowd, foliage, physical-surfaces, specular-aa on WebGL | 17 of 17 PASS                        |
| `npm run verify`, lint, format, `git diff --check` | at `065b9fe`                                                                                                                                                                           | PASS, 935 of 935, Doctor HEALTHY     |

One Windows run is not counted: the first start of the `1e0190f` batch was
started twice by mistake, and the second copy rebuilt the checkout under the
first copy's `node-bindings` run, which failed; both were stopped and the
batch run once.

## The vivo V40 (2026-11-18, `1197e20`)

| Check                                           | WebGPU (Adreno 7xx)                               | WebGL (ANGLE GLES 3.2)                |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| `node-bindings`: the probe (issue #8)           | 109.58 → 109.58, 0 errors                         | 109.57 → 109.57, 0 errors             |
| `node-bindings`: WP23                           | 58 frames a second go on, the other sphere 120.43 | 60 frames, 120.41                     |
| `node-bindings`: WP22, sun alone / with rim     | 0.943 / 0.567, the sun the main light             | 0.945 / 0.567                         |
| `lit-surface` (the strand bands with strength)  | PASS                                              | PASS                                  |
| `physical-surfaces`                             | PASS                                              | PASS                                  |
| `gltf-instancing`                               | PASS                                              | PASS                                  |
| `instanced-mesh`                                | PASS                                              | PASS, mean 0, worst 0 against nodes   |
| `developer-tooling` (WP23's note, nothing left) | PASS                                              | PASS                                  |
| `webgpu-churn`, 3D and batch, short settings    | **FAIL on the heap alone**, see below             | PASS: 3D 1.35, batch 1.39 KiB a cycle |

The churn check was run with a warm-up of 150 cycles and 4 blocks to save
time (the defaults are 300 and 6). On WebGPU no object grew (batch marks 1
or 28, shader data 34 to 47, 15 materials at every sample), and the heap
rose 0.87, 0.29, 0.46 and 0.09 MiB over the four blocks of 300 cycles: 1.99
KiB a cycle by the check's rule, over its bound of 1.5, and falling. The
phone's earlier runs with the defaults read 0.28 (WebGPU) and 0.38 (WebGL)
for the 3D kind (`windows-acceptance/mem-01-verification.md`); these short
ones read 1.40 and 1.35, so the short settings are not a fair run on the
phone. The run with the defaults was started and lost 218 s in, when the
phone's connection dropped (`CDP timeout`, then no device).

## Limits

- **The batch kind's heap on the V40's WebGPU is not settled**: the short
  run failed on the heap alone and the run with the defaults was cut off by
  the phone's connection. Its objects did not grow.
- LayaAir's single-light mode (multi-lighting off) takes the first
  directional light as the main light; WP22 does not change it.
- A WebGL mark that a render out of sight still names is let go after 600
  passes and made anew; a render added later with the same material and
  mesh may then draw in a group of its own until LayaAir gives both one
  mark again.
- The one pixel on Direct3D 11 above: its cause is not established.
- The iPhone's `Unable to finish` and QA-01's first frames are not
  explained; body-lab and the iPhone game were not run.
- RTX not selected on the Windows host (Chrome takes the Intel adapter).

Decision: **Implemented within scope**; the V40's WebGPU churn run with the
default settings is open.
