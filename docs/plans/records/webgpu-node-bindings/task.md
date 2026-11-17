# Agent task: WebGPU pipeline invalid when a render lacks the reflection probe block its variant reads (issue #8)

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

GitHub issue #8 (zhudaandzhuer/zhuda-laya-engine), filed 2026-11-17 against
`46e7a48`: in a consumer game on WebGPU at look quality 3, after 70–90 s,
`createRenderPipeline` for glTFPBR fails validation ("Binding doesn't exist
in Layout_6 … @group(2) @binding(1) … fragment stage"); every later command
buffer is invalid, the renderer's error list fills to 64 and the frame turns
very dark. WebGL is not affected. The owner asked to fix it.

## What was found

Reproduced here with no game: two glTFPBR spheres with one material, the
second with its reflection probe taken away (`reflectionMode = 0`), on
WebGPU: the same three errors, 64 of them.

LayaAir 3.4.2 compiles a shader variant once per set of defines, and takes
the variant's bind group 2 (the render's own data: `Sprite3D`,
`SkinSprite3D`, `ReflectionProbe`, …) from the uniform maps of the first
render that compiled it (`passdata.nodeCommonMap` / `additionShaderData`).
A render's group-2 layout holds only the maps that render has. A render that
uses the same defines but lacks one of those maps then gets a layout without
a binding the variant declares, and the pipeline is invalid. The reflection
probe block adds no define, so a render without a probe at that moment
(left the scene and came back, `reflectionMode` off, or anything else that
leaves `probReflection` empty) shares the variant of one with it. On WebGL
the block keeps whatever another object bound last; nothing fails.

Which way the game's render lost its probe was not found (the game is not
in this repository); six ways of taking a render out of the scene and back
(in the runtime's tick, a Laya timer, `requestAnimationFrame`, a script's
update or late update, a camera's pre-render) did not trigger it here. The
repro's error names the issue's binding (group 2, binding 1, the glTFPBR
fragment stage) for a non-skinned glTFPBR render without its probe, whose
group 2 is `Sprite3D` then `ReflectionProbe`; a skinned render has
`SkinSprite3D` in between, so the game's failing renders are most likely
non-skinned glTFPBR meshes (bone accessories or cloned props). The fix does
not depend on how they lost the probe.

## Goal

A render whose shader reads the reflection probe block
(`Shader3D._supportReflectionProbe`) and holds none when it is prepared is
given the scene's probe, as LayaAir's own instanced draw does (WebGL and
WebGPU), so its layout has the binding its variant uses.

Tried and dropped: on WebGPU, not drawing any render whose variant lists a
map the render lacks. A variant lists every map of the render that compiled
it, used or not, and WebGPU asks only for the bindings a shader uses: an
Unlit render without a probe shares a variant that lists the probe and
draws correctly. The check skipped it (`verify:basis-textures` on WebGPU),
and LayaAir keeps no record of which bindings a shader uses.

## Invariants

- Vendor files unchanged; patches are adapters installed after `Laya.init`.
- A render with its blocks is untouched; no allocation per draw.
- LayaAir's volume manager still places the best probe when it updates.

## Acceptance checks

1. Unit tests of the adapter with LayaAir-like stand-ins.
2. A draw check on WebGPU and WebGL: the repro scene has 0 renderer errors,
   the probe-less sphere was given the scene's probe and looks as it did.
3. macOS, the Windows host and the vivo V40, both backends; every check of
   the repository on macOS on both backends; `npm run verify`.

## Rollback

Revert the commit; the issue's failure returns.
