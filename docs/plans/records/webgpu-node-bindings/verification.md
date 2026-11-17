# Verification record: issue #8, a render without its reflection probe block

Task document: `docs/plans/records/webgpu-node-bindings/task.md`\
Commit: `ae18ceb` (the scene's probe for a render that reads the block and
holds none); base `cfbee49`\
Date: 2026-11-17

## The repro

Two glTFPBR spheres with one material; the second's probe taken away
(`reflectionMode = 0`, `probReflection = null`). LayaAir keeps the variant
the first compiled, whose group 2 is `Sprite3D` then `ReflectionProbe`; the
second's layout has `Sprite3D` alone.

| Run (Apple M4, Chrome, WebGPU)        | Renderer errors                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base                                  | 64 (the cap): "Binding doesn't exist in Layout_8 … @group(2) @binding(1) … fragment stage ([ShaderModule "glTFPBR"])", then "Invalid RenderPipeline" and "Invalid CommandBuffer", as in the issue |
| With the probe given in the prototype | 0; the sphere given the scene's probe once                                                                                                                                                        |
| `ae18ceb`                             | 0                                                                                                                                                                                                 |

What was tried to find the game's way in, without a trigger: taking a
sphere out of the scene and back every frame in the runtime's tick, a Laya
timer, `requestAnimationFrame`, a script's `onUpdate` and `onLateUpdate`,
and a camera's `onPreRender` (0 errors in each, base commit).

## `verify:node-bindings`

The repro as a check: no renderer error, the sphere given the scene's probe
(`zhudaReflectionProbeFills`), and its picture the same as with its own
probe (mean luminance of its side of the frame).

| GPU, backend                                  | Result                                      |
| --------------------------------------------- | ------------------------------------------- |
| Apple M4, WebGPU                              | PASS: 109.53 → 109.53, given once, 0 errors |
| Apple M4, WebGL                               | PASS: 109.53 → 109.53, given once, 0 errors |
| Intel UHD 770, WebGPU (Windows host, desktop) | PASS: 109.53 → 109.53                       |
| Intel UHD 770, WebGL (ANGLE D3D11)            | PASS                                        |
| Adreno 720, WebGPU (vivo V40)                 | PASS: 109.58 → 109.58                       |
| Adreno 720, WebGL                             | PASS: 109.57 → 109.57                       |

## Other checks after the change

| Where                                  | Checks                                                                                                                      | Result                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Windows host, Intel, WebGPU and WebGL  | node-bindings, physical-surfaces, lit-surface, specular-aa, gltf-instancing, animation-control, film-webgpu, model-showcase | 16 of 16 PASS                                              |
| vivo V40, WebGPU and WebGL             | node-bindings, physical-surfaces, lit-surface, gltf-instancing, animation-control, specular-aa                              | 12 of 12 PASS                                              |
| macOS, every `verify:*` check, WebGPU  | 73 (all but `browser-sdk`, which builds its own release folder), `ZHUDA_FILM_RENDERER=webgpu`                               | 71 PASS; `foliage` and `webgpu-churn` once each, see below |
| macOS, every `verify:*` check, default | the same 73 on each check's default backend (WebGL for the draw checks)                                                     | 72 PASS; `quality-governor`, see below                     |
| `npm run verify`, lint, format         |                                                                                                                             | PASS 929 of 929                                            |

The three that did not pass in the sweep, each run again alone:

| Check                     | In the sweep                                                      | Alone                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `foliage`, WebGPU         | far card coverage 0.077 against 0.072 (it is 0.53 when it passes) | PASS twice with the fix, PASS twice at the base (`cfbee49`)                                                                    |
| `webgpu-churn`, WebGPU    | stopped after 1 500 3D cycles, ended by the 15-minute limit       | PASS (3D alone, 82 s; 2D and 3D, 159 s): heap 2D 0.101, 3D 0.331 KiB a cycle (0.093, 0.338 before the change)                  |
| `quality-governor`, WebGL | "fast frames climb back to the top"                               | FAIL 3 of 3 with the fix and 3 of 3 at the base, run straight after with the machine in use: frame-time driven, not the change |

## Dropped on the way

A second guard, on WebGPU, not drawing a render whose variant lists a map
the render lacks (and saying so), was built and tested (unit tests, the
draw check with a skinned render missing `SkinSprite3D`, Windows and the
V40 on `3026f29`). The macOS sweep then showed it skipping an Unlit render
in `verify:basis-textures` that draws correctly: a variant lists every map
of the render that compiled it, used or not, and WebGPU needs only the
bindings a shader uses. It was taken out before the commit was kept.

## Limits

- The game of the issue was not run (it is not in this repository); that
  its renders lost the probe block is concluded from the binding the error
  names, not observed. `zhudaReflectionProbeFills()` above 0 in the game
  would show the fill at work there.
- A render missing another render-level block (`SkinSprite3D`,
  `MorphTarget`, `VolumetricGIProbe`) would still fail as before; none is
  known to happen.
- RTX not selected on the Windows host; one phone.

Decision: **Implemented within scope**.
