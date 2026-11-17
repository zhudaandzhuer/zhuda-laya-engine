# Agent task: the engine defects left open on 2026-11-17

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

The owner asked to fix every defect left open in the engine ("先把缺陷都修完畢",
2026-11-17), after a review of the records listed:

1. A `ZhudaLitSurfaceMaterial` with the name of another, the same uniform
   types and other starting values was refused as a different contract
   (`fable-batch-review/verification.md`, known defect).
2. WP22: a directional light brighter than the look's sun took its shadow
   (`threejs-gap-audit/plan.md`, section 7).
3. WP23: on WebGPU a program that did not compile stopped all drawing
   (the same plan).
4. MEM-01, left open: LayaAir's WebGPU `_batchOpaqueMarks` grows with every
   material and mesh a staying scene ever batched
   (`windows-acceptance/mem-01-verification.md`).
5. `inspectEngineHealth` counted modules against the WebGL table on a WebGPU
   page (`topology-globals-and-guardrail/verification.md`).
6. Reports not reproduced here: `strands` turned hair ribbons white at any
   strength (films/body-lab, 2026-11-15); an iPhone's Safari failed at start
   on WebGPU with `GPUCommandEncoder.finish: Unable to finish.` (a consumer
   game, 2026-11-15); QA-01's first frames 1/255 off on Direct3D 11.
7. Check tools: the WebGPU churn check's defaults too short to show a slow
   leak; `verify:browser-sdk`, `verify:branding` and `verify:webgpu` read a
   stale `dist/browser/<version>` after any change to the bundles.

## Goal

Each defect fixed in the engine, or, for a report that cannot be reproduced,
the attempt recorded with what was run. Vendor files stay unchanged: LayaAir
is changed only by adapters installed after `Laya.init` or in `Renderer.ts`.

## What was found and done

| #   | Cause                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Change                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The shader's contract held the uniforms' starting values as well as their types.                                                                                                                                                                                                                                                                                                                                                                          | The contract is the types; each material already writes its own values.                                                                                                                                                                                                                                                            |
| 2   | `LightQueue.getBrightestLight` picks the greatest `_intensity` as the main light: the one with the shadow, whose direction and colour the sky's sun takes. The same for the point and spot queues.                                                                                                                                                                                                                                                        | `installLaya342ShadowLightFirst`: the brightest light that casts a shadow, else the brightest.                                                                                                                                                                                                                                     |
| 3   | LayaAir's `WebGPUShaderInstance._create` throws an uncaught `TypeError` (`fragmentSpvRes.spirv.buffer` of null) when the GLSL does not compile; the throw leaves the engine's loop.                                                                                                                                                                                                                                                                       | An adapter in `Renderer.ts` catches it, leaves the instance incomplete (LayaAir does not draw an incomplete one) and says it once per shader in `renderer.errors`.                                                                                                                                                                 |
| 4   | Each batch mark keeps an instanced element, its geometry and a render node until the scene goes.                                                                                                                                                                                                                                                                                                                                                          | Every 60 frames a batch agent's marks that hold nothing are freed and forgotten; LayaAir makes one anew if it is wanted.                                                                                                                                                                                                           |
| 4b  | Found by the new batch kind of the churn check, run on WebGL for the first time (Windows host): LayaAir's WebGL batch agent keeps the same kind of marks, each with instanced elements holding the material's shader data and a render, and `WebGLInstanceRenderElement3D` keeps a buffer state with an 80 KiB instance buffer for every geometry it drew instanced; both until the scene goes (a material, two shader data and 6.2 KiB of heap a cycle). | `installLaya342WebGLBatchMarkSweep`: every 30 batch passes a mark whose renders and geometry are destroyed (and not drawn in the last 8 passes), or not drawn for 600, is let go; the instance buffers of a destroyed geometry leave LayaAir's table and are destroyed when the next frame starts, as LayaAir does with the scene. |
| 5   | `inspectEngineHealth` read the WebGL module table only.                                                                                                                                                                                                                                                                                                                                                                                                   | It reads the table of the page's backend (`zhudaRendererModules`, public).                                                                                                                                                                                                                                                         |
| 6a  | Reproduced with body-lab's ribbons and sheet (jet-black hair, front light): the wide band is `color` times each light wherever the strands run square to the half vector, which on straight hair is everywhere; `strength` scaled only the narrow band.                                                                                                                                                                                                   | `strength` scales both bands.                                                                                                                                                                                                                                                                                                      |
| 6b  | Not reproduced on an iPhone 14 (iOS 27.2.1, Safari 27.2) with every engine page tried.                                                                                                                                                                                                                                                                                                                                                                    | None; the advice in `docs/webgpu.md` (`renderer: "auto"` and `retryZhudaBackend`) stays.                                                                                                                                                                                                                                           |
| 6c  | Not looked into further: one pixel, 1/255, in the first frames of some sessions on Direct3D 11; nothing is seen and the check already compares settled frames.                                                                                                                                                                                                                                                                                            | None.                                                                                                                                                                                                                                                                                                                              |
| 7   | Churn: 3 blocks and a short warm-up hid a 1 KiB-a-cycle leak in noise. Browser checks: the builder refuses (rightly) to overwrite a release folder that differs.                                                                                                                                                                                                                                                                                          | Churn runs 2D, 3D and the new batch kind with 6 blocks and 300 warm-up cycles by default. The three browser checks build this source into a fresh folder unless given one (`SDK_BROWSER_DIR`, `WEBGPU_BROWSER_DIR`) (`scripts/lib/browser-release.mjs`).                                                                           |

## Invariants

- Vendor files unchanged; every patch is installed once per prototype and
  restored with the runtime where LayaAir's own method is replaced.
- A scene with one shadow-casting directional light, or none, chooses its
  main light as before.
- A program that compiles is drawn as before; nothing is allocated per draw.
- A batch mark in use is never freed. On WebGL a mark that a render out of
  sight still names keeps working: its elements are made anew when drawn.

## Acceptance checks

1. Unit tests: the contract (`lit-surface.test.mjs`), the light choice with
   LayaAir's queue (`shadow-light.test.mjs`), the failed program
   (`webgpu.test.mjs`), the sweep (`render-cache-bounds.test.mjs`), the
   health table (`disclosure-contracts.test.mjs`).
2. Real draws, WebGL and WebGPU: `verify:node-bindings` (WP22 and WP23
   cases), `verify:lit-surface` (both strand bands with strength),
   `verify:webgpu-churn` (the batch kind's marks and heap, on both backends).
3. macOS, every `verify:*` check on both backends; the Windows host and the
   vivo V40 on the checks that cover the changes; the iPhone 14 for 6b.
4. `npm run verify`, lint, format, `git diff --check`.

## Non-goals

- The consumer games themselves (body-lab's hair, the iPhone game) were not
  run; their owners decide whether to turn `strands` back on or try WebGPU
  again on iOS.
- A light's shadow for a second directional light: LayaAir draws one.

## Rollback

Revert the commits; each defect returns as described above.
