# three.js gap plan: progress

Plan: `docs/plans/records/threejs-gap-audit/plan.md` (work packages WP0..WP16 from the audit; WP17..WP20 added on request on 2026-11-15, section 6)\
Last updated: 2026-11-15, after WP20 (WP16 to WP19, the phone checks and what the merged packages had left open came before it the same day; batch 2 is done one package at a time, by one agent, without a review agent)

## Handoff (2026-11-15, at the end of the session that did WP16 to WP20)

Read this first when taking the work over.

**State**

- Every package of the plan, WP0 to WP20, is done within the scope its
  record names; the table below has one line for each. Nothing is half
  done: no uncommitted change, no branch other than `main` to merge.
- GitHub `main` was pushed at `49586e0` on 2026-11-15 on the owner's word.
  The commit that adds this section comes after it;
  `git rev-list --count origin/main..main` says whether it has been pushed.
- The main checkout's `dist/sdk` was rebuilt at `a83ed1a`; only documents
  have changed since. A consumer that builds against the main checkout needs
  no rebuild. After any later change to `packages/`, run `npm run build`
  there first.
- No SDK release was cut (the package is still 1.18.0), no pull request, no
  tag. The session's work tree is the branch
  `claude/fable-batch8-review-8b8d41`, equal to `main`; it can be removed.
- Last gates, at `49586e0`: `npm run verify` 795 of 795, `npm run lint`,
  `npm run format:check`, `git diff --check`; every draw check once on each
  backend, WebGL 59 of 59 and WebGPU 46 of 46
  (`character-surfaces/verification.md`).

**Decided, and still in force**

- Only `main`. A push, an SDK release, a pull request or a tag happens on the
  owner's word each time, never on an agent's own.
- A check that fails or cannot be run stays recorded as failing or
  unavailable; no tolerance is widened to pass. The three phone failures
  below are recorded that way.
- Vendor files are not modified; no consumer asset comes into this
  repository; a consumer's own tasks are not tracked here.
- Realism and film work is drawn on WebGPU and verified on both backends.

**Open** (the list under "Next" has the detail)

1. WP19 (spring bones) and WP20 (the frame, `subsurface`, `strands`) were
   never run on a phone. WP20 was drawn with one directional light and no
   shadow: point and spot lights compile but are not measured, and that a
   light's shadow removes the wrapped light is read from the formula.
2. On the vivo V40 three checks fail and are not mended: screen reflections
   on both backends (cause not found), one line of specular anti-aliasing
   on WebGPU, the premise of the dither check on WebGL.
3. Not started: `.hdr` panoramas in film scenes, `--ktx2` in
   `zhuda-laya-lod`, the WebGPU table of `inspectEngineHealth`.
4. Not built, by choice: a blur of the skin's light, a cornea's refraction,
   hair's own shadowing, a soft fringe for hair cards, cloth against itself.

**The exact next step**

Nothing is in progress. When work resumes, the first thing owed is item 1 on
the phone:

```sh
adb forward tcp:9333 localabstract:chrome_devtools_remote   # a blank tab open in the phone's Chrome
ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 npm run verify:lit-surface
ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 LIT_SURFACE_RENDERER=webgpu npm run verify:lit-surface
ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 npm run verify:spring-bones
ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 SPRING_BONES_RENDERER=webgpu npm run verify:spring-bones
```

(`docs/agent-development.md`, "A draw check on a phone"), and its result
written into `character-surfaces/verification.md` and
`cloth-and-spring-bones/verification-spring-bones.md`, pass or fail. Then
item 2's screen reflections, which is the one phone failure a game would
see.

Where to read what was built: `docs/filmic-rendering.md` (the lit hook,
sheen, the frame, skin, strands), `docs/cloth.md`, `docs/spring-bones.md`,
and each package's record under `docs/plans/records/`.

## Where each package stands

| Package                                                                                                                                                                                                                                                      | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Record                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| WP0 housekeeping                                                                                                                                                                                                                                             | Merged, reviewed, review points closed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `topology-globals-and-guardrail` |
| WP14 small game services                                                                                                                                                                                                                                     | Merged, reviewed; the five minor review points closed on 2026-11-15 (a `CurvePath` is now sampled evenly by length: LayaAir walks a spline by its control points)                                                                                                                                                                                                                                                                                                                                                                                     | `game-services`                  |
| WP1 shadow maps every few frames or on request, render scale, FSR 1                                                                                                                                                                                          | Merged, reviewed, one review round applied; measured on a vivo V40; no game uses it yet                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `frame-cost`                     |
| WP2 specular anti-aliasing                                                                                                                                                                                                                                   | Merged, reviewed, reworked after review; **off until a scene asks**. On 2026-11-15: the eight-bit dither (`setZhudaDither`, `grade.dither`), and the two-to-four texel case measured under a temporal anti-aliasing, where the patch is the nearer picture On a vivo V40 (2026-11-15): specular AA passes on WebGL and fails one line on WebGPU (a map at no strength changes a pixel by 2.8 of 255); dither passes on WebGPU and through an HDR chain, and on WebGL a plain camera has no bands to begin with (the driver dithers its sRGB picture). | `specular-aa`                    |
| WP4 glTF intake (quantized, KHR meshopt, WebP/AVIF, lights, cameras)                                                                                                                                                                                         | Merged, reviewed, one review round applied; `EXT_mesh_gpu_instancing`, the second set of texture coordinates for occlusion and emission, and Meshopt in workers done on 2026-11-15, which also found that a model mounted as clones left its meshes and textures behind On a vivo V40 (2026-11-15): intake and the copies, second set and workers pass on WebGL and WebGPU.                                                                                                                                                                           | `gltf-intake`                    |
| WP7 physical surfaces in code (sheen, thin film, glass, turned highlights)                                                                                                                                                                                   | Merged, reviewed, one review round applied (six textures a material at most, said and drawn at the limit); `ZhudaLitSurface` alpha, normal and the cut by chance done on 2026-11-15, which also found that `material.blend` had never taken effect on a lit surface On a vivo V40 (2026-11-15): physical surfaces and the lit surface's hook pass on WebGL and WebGPU.                                                                                                                                                                                | `physical-surfaces`              |
| WP3 shader warm-up                                                                                                                                                                                                                                           | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `shader-warm-up`                 |
| WP5 KTX 2 / Basis textures                                                                                                                                                                                                                                   | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; no encoder shipped and no encoder's output drawn (the check makes its own one-colour UASTC files)                                                                                                                                                                                                                                                                                                                                                                                  | `basis-textures`                 |
| WP6 HDR panoramas and the studio room                                                                                                                                                                                                                        | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; not wired into film scenes, no GPU prefilter                                                                                                                                                                                                                                                                                                                                                                                                                                       | `hdr-environment`                |
| WP8 toon material, matcap, normal view, selection outline                                                                                                                                                                                                    | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; no outline normals for hard-edged meshes, the outline is not in the depth texture                                                                                                                                                                                                                                                                                                                                                                                                  | `stylized-shading`               |
| WP9 instanced meshes and baked crowds                                                                                                                                                                                                                        | Merged; desktop WebGL and WebGPU verified, measured on a vivo V40; the bake runs at load (no build-time baker), no blending in a crowd                                                                                                                                                                                                                                                                                                                                                                                                                | `instanced-meshes`               |
| WP10 animation control (blend, overlay, cross-fade, IK)                                                                                                                                                                                                      | Merged; desktop WebGL and WebGPU verified; the engine's own IK solvers, not LayaAir's module On a vivo V40 (2026-11-15): passes on WebGL and WebGPU.                                                                                                                                                                                                                                                                                                                                                                                                  | `animation-control`              |
| WP11 post quality (AgX and neutral curves, `.cube` table, SMAA, occlusion by horizons, lens flare, grade and bloom values)                                                                                                                                   | Merged; desktop WebGL and WebGPU verified; the same page on the phone; the flare is the engine's own, not a wrapper                                                                                                                                                                                                                                                                                                                                                                                                                                   | `post-quality/`                  |
| WP13 lighting depth (falloff by the square, a spot's penumbra, wider and blended sun shadows, contact shadows, a schedule for point-light shadows)                                                                                                           | Merged; desktop WebGL and WebGPU verified; the same page and a timing page on the phone; off until a scene asks; no game's lamps were renumbered for the square                                                                                                                                                                                                                                                                                                                                                                                       | `lighting-depth/`                |
| WP12 backend delivery (a loader that asks the browser and loads one backend, `"renderer": "auto"`, compilers fetched once for an origin, sizes)                                                                                                              | Merged; desktop WebGL and WebGPU verified; on a vivo V40 (2026-11-15) its Chrome gives a hardware WebGPU adapter and the loader takes it on all three example pages (ready in 2.8 to 3.0 s; compilers 0.06 s from the cache); no SDK release holds the loader yet; `ui` can leave the 3D bundles for 25 KB gzipped and was left in                                                                                                                                                                                                                    | `backend-delivery/`              |
| WP15 developer tooling (helper lines, the statistics panel, draws and GPU time on WebGPU, WebGL shader excerpts, a transform gizmo, also in the model editor)                                                                                                | Merged; desktop WebGL and WebGPU verified; the sun's shadow map is shown as what it covers, not as a picture; no gizmo in the film host On a vivo V40 (2026-11-15): passes on WebGL (GPU time unavailable there, and said) and WebGPU.                                                                                                                                                                                                                                                                                                                | `developer-tooling/`             |
| WP16 GPU depth (a compute pass and copies drawn from its buffer, integer, matrix, array and cube-map uniforms, a common GLSL library, reflections by each surface's normal and roughness, a moving thing's velocity under temporal anti-aliasing)            | Merged; desktop WebGL and WebGPU verified; on a vivo V40 (2026-11-15) compute runs on its WebGPU (a million particles in 14 ms, 81 ms in JavaScript) and the rest is as on the desktop, **but the check fails on both backends on a tolerance of its reflections** (screen reflections are not the desktop's there; cause not found); compute is WebGPU only (the same step in JavaScript elsewhere); no `texture3D`, no velocity for instanced copies or bones                                                                                       | `gpu-depth/`                     |
| WP17 what a lit surface's hook is given (asked for on 2026-11-15; A1 to A5, B1: the view direction and the mesh's normal, a colour a vertex from a `ZhudaDynamicMesh`, sheen on a lit surface, `material.blend`, alpha, the normal, the cut by chance)       | Merged; desktop WebGL and WebGPU verified, gates G1 to G3 drawn on both; the same check passes on a vivo V40 on WebGL and WebGPU; alpha, the normal, the cut by chance and the blend were already in `befc96b`; a `physical` surface still has no hook (thin film, glass, coat and turned highlights stay without one)                                                                                                                                                                                                                                | `lit-hook-inputs/`               |
| WP18 cloth (C1: particles and distance constraints, a fixed step on a layer of the engine's clock, pins, bodies given as balls, rods, floors and tables of radius by height and angle, a point taken by a hand and let go; `ZhudaCloth`, `ZhudaClothSolver`) | Merged; desktop WebGL and WebGPU verified, gate G5 drawn on both (the same bytes and the same picture twice; thirty made and destroyed; a pause and a five-second delta; no particle inside a body in any frame); the same page on a vivo V40 with the same bytes (7.1 ms a frame for 1,681 particles, 3.0 ms for a skirt of 576); no self-collision, no tearing; a free cloth over small supports stretches about a tenth                                                                                                                            | `cloth-and-spring-bones/`        |
| WP19 spring bones (C2: chains of a model's bones that lag, swing and settle, on WP18's fixed step and bodies; `ZhudaSpringBones`, `ZhudaSpringBoneSolver`)                                                                                                   | Merged; desktop WebGL and WebGPU verified, gate G5 drawn on both (the same joints and picture twice; thirty made and destroyed; a pause and a five-second delta; no joint inside a body in any frame, every bone its own length); drawn on chains of plain nodes, not on a skinned mesh; **no phone**                                                                                                                                                                                                                                                 | `cloth-and-spring-bones/`        |
| WP20 skin, eyes and hair (C3)                                                                                                                                                                                                                                | Done 2026-11-15 in its cheap forms: the surface's frame in the lit hook (an eye's iris under its cornea is a recipe on it), `subsurface` (a wrap and light through thin parts), `strands` (two Kajiya-Kay bands); drawn against their formulas on WebGL and WebGPU. Not built: a blur of the skin's light, refraction, hair's own shadowing, a soft fringe for hair cards. No phone run                                                                                                                                                               | `character-surfaces/`            |

Each merged package's own record lists what it did not do; those lists are
the open work, not this table.

## How batch 1 was checked

- Each package was built in its own worktree by one agent, reviewed
  adversarially by a second (which wrote its own probes), and fixed by a
  third. The fixes were not reviewed a second time by an agent: at the merge
  each package's own checks, which now hold the reviewers' failing cases,
  were run again on the merged tree.
- Merged tree (`5f85f26`): `npm run verify` 628 of 628, lint, format and
  `git diff --check` pass. Sixteen real-draw checks on WebGL and on WebGPU
  (Apple M4), 32 of 32: the five new ones (`verify:gltf-intake`,
  `verify:physical-surfaces`, `verify:shadow-updates`, `verify:render-scale`,
  `verify:specular-aa`) and eleven older ones the merges touch.
- The consumer game `films/river-town-prefab`, built against the merged
  engine: its day pictures and its six prefab checks pass, unchanged (none
  of the new features changes a default).
- One phone (vivo V40), for WP1 and WP2: `records/frame-cost/verification.md`.

## What the phone said, in short

At 0.67 of the canvas with FSR the game's look level 2 costs 28 to 38 ms a
frame instead of 39 to 51, level 1 18 to 28 instead of 24 to 38; shadow
maps every third frame save 0.3 to 2.9 ms. The phone still does not hold 60
frames a second above look level 0. Whether a phone should aim at 30 with
the level 2 look or at 60 with the level 0 look is the game owner's choice;
the engine has both levers and a ladder (`zhudaQualitySteps`) for either.

## How WP3, WP5, WP6, WP8 to WP13, WP15 and WP16 were checked

One agent wrote, drew and recorded each; there was no second agent to
review them. Each has unit tests, a real-draw check on WebGL and WebGPU with
pictures that were looked at, the same page on the vivo V40, the full gates,
and a rerun of the older draws its change touches. What each could not
check is in its own record. WP12 and WP16 have no phone run (the phone was
not reachable).

## Next

Every package of the audit's plan (WP0 to WP16) has been built, and what
WP14, WP7, WP4 and WP2 left open at their merge was closed on 2026-11-15,
each in its own record (`game-services`, `physical-surfaces`,
`gltf-intake`, `specular-aa`).

Asked for on 2026-11-15 and placed after them (plan, section 6):

1. WP17, what a lit surface's hook is given: done the same day, gates G1
   to G3 drawn on WebGL and WebGPU (`lit-hook-inputs/`).
2. WP18, cloth: done the same day, gate G5 drawn on WebGL and WebGPU
   (`cloth-and-spring-bones/verification-cloth.md`, `docs/cloth.md`).
3. WP19, spring bones: done the same day, gate G5 drawn on WebGL and WebGPU
   (`cloth-and-spring-bones/verification-spring-bones.md`, `docs/spring-bones.md`).
4. WP20, skin, eyes and hair: done the same day in its cheap forms, drawn on
   WebGL and WebGPU (`character-surfaces/`, `docs/filmic-rendering.md`).

Gate G4 of that request (the study redone without workarounds) is the
consumer's own and is not tracked here.

Still open, by choice or for want of a device:

- On the phone (`phone-checks/`, 2026-11-15): three checks fail there and
  are not mended. Screen reflections are not the desktop's on either
  backend (`verify-gpu-depth` stops at a tolerance; the cause is not
  found); a normal map at no strength changes a pixel by 2.8 of 255 on
  WebGPU (`verify-specular-aa`); and `verify-dither` asserts bands that the
  phone's driver has already dithered away on WebGL (the check's premise,
  not the engine's dither).
- The older packages' checks (films, looks, effects, grass, crowds) were
  never run on the phone's WebGPU; no other phone, no iOS.
- `.hdr` panoramas in film scenes and `--ktx2` in `zhuda-laya-lod`: named
  as options when WP5 and WP6 were merged, not started.
- What each record lists under "not verified, not built".
- `inspectEngineHealth` counts loaded modules against the WebGL table only.
- WP19 and WP20 on a phone; WP20 under a point light, a spot light and a
  light with a shadow (`character-surfaces/task.md`, unverified limits).

## Found while closing what the merged packages left open

- **`material.blend` never took effect on a lit surface**
  (`ZhudaLitSurfaceMaterial`, `ZhudaToonMaterial`): LayaAir clears a
  material's defines and render state when it is given another shader. A
  lit surface asked to be a cut-out, blended or additive was drawn opaque.
  It is put back after the shader now. Anything that calls
  `setShaderName` on a material it has already set up has the same trap.
- **A model mounted as clones (`placements` without `instanced`) left its
  meshes, materials and textures behind** when mount and model were let go
  of in one go, as a prefab does: LayaAir destroys a node's components on
  the next frame, after the library has destroyed the model, and what is
  still held then is never destroyed. The clones are destroyed at once
  now. A game that changes scenes often was leaking GPU memory this way.
- `mountZhudaModel` was named in the documentation and not exported.
- LayaAir's `CurvePath` walks a spline by its control points, not by
  length, and its `length` for a spline is the chords between them.
- A camera without an HDR chain is rounded to eight bits as each material
  is written (LayaAir's built-in target, in the sRGB curve) and again at
  the copy to the canvas (a power of 2.2). Its first few steps are two to
  six steps of the screen each: the darkest tones of a scene without a
  look are coarse. A look does not have this.
- LayaAir hands a camera's depth pictures back to its pool at the next
  frame it draws, not when the camera is destroyed.
- The include that holds `outputTransform` is read by two of LayaAir's
  vertex programs: nothing added to it may name the pixel.
- Two checks went by the clock: `verify-developer-tooling` froze its
  character wherever the animation had got to, and timed the GPU against
  a load light enough to overlap the noise. Both failed once in a dozen
  runs and are fixed in the check.

## Found on the phone on 2026-11-15

- The draw checks can take a phone's Chrome for their browser
  (`ZHUDA_PHONE_CHROME`, `docs/agent-development.md`): the verdict is then
  the check's own, on the phone, instead of numbers read off a page by hand.
- The vivo V40's Chrome gives a hardware WebGPU adapter without
  `float32-filterable` and `bgra8unorm-storage`. LayaAir says so at start,
  and every check took those two lines for GPU warnings and stopped before
  judging a pixel: they are kept apart (`ZHUDA_PHONE_NOTICES`).
- Its driver dithers what is written into an sRGB eight-bit picture when
  GL's dither is on, as it is by default (and not an RGBA8 picture, nor the
  canvas). A plain camera's picture is such a one.
- A tab that is not the one shown draws no frames: a check's tab is brought
  to the front.
- The cloth gives the same bytes on the phone as on the desktop and in node.

## Found while doing WP18

- A solver that passes a pull from particle to particle a round at a time
  leaves a heavy cloth stretched like rubber where it hangs (0.37 at the
  pins of a sheet hung by two corners). What mends it is not more rounds:
  a limit on each particle's distance from its pin, spans along each thread
  four, eight and sixteen particles apart, the constraints gone over one
  way and then the other, and smaller steps.
- A body given as a table of radii must be grown and left square to its
  surface. Pushed straight out from the axis, a cloth on a shoulder is
  thrown sideways and never rests, and its margin above a shallow shoulder
  is a third of what was asked.
- Friction as a share of the sliding taken away each step lets a cloth
  creep off any slope. Friction as a grip (how hard a particle was pressed
  in, times a number) holds it on a slope less steep than that number.
- Single precision leaves a particle put on a surface a hair inside it:
  without a tolerance every body is asked again and again for nothing.
- The solver gives the same bytes in node, on WebGL and on WebGPU: it is
  plain arithmetic on typed arrays and reads no clock.

## Found while doing WP17, beyond WP17

- LayaAir gives the pass that writes a light's shadow a view and a
  projection and no eye: `u_CameraPos` is not set there. A hook that worked
  out a view direction from it in that pass got the direction to the
  world's origin. The hook's `viewDirection` is read from the pass's own
  view there (toward the light), and the guide no longer says the light's
  position can be read.
- Two crossing sheets that are laid out alike draw alike under the cut by
  chance (the chance comes from where a point is on its own mesh): the
  lower sheet then shows on fewer pixels than a quarter. Meshes that differ
  do not have this; it was the check's own arrangement.
- LayaAir sorts blended things by where their middles are. Two blended
  sheets through each other are wrong on one side whichever is made first
  (drawn and measured as the contrast to the cut by chance).
- LayaAir's own physically based flow leaves a surface's sheen unset even
  when `SHEEN` is defined (only its glTF flow sets it): the lit surface's
  sheen goes through a flow of its own that is LayaAir's with those three
  lines added.

## Found while doing WP16, beyond WP16

- LayaAir decides `#ifdef NAME` itself, from its own defines, before the
  GLSL compiler sees a `#define NAME` written in the source: a shader
  cannot switch a block of itself on that way (it compiles, and the block
  is simply absent). `#if defined(NAME)` is left to the compiler. Two
  variants of an engine shader are two shader texts under two names.
- LayaAir's `DeviceBuffer.destroy()` destroys a storage buffer that is
  also a vertex buffer twice and throws. Destroy its vertex side only.
- The shader glTF models are drawn with never wrote LayaAir's surface
  pictures (normal, roughness): to anything that reads them a glTF model
  was not there. `ZhudaEngine.boot` teaches it to, with LayaAir's own code.
- LayaAir's surface pictures and its velocity picture work on WebGL as on
  WebGPU. Only compute is WebGPU's alone.
- LayaAir's velocity picture holds the camera's motion only: under its
  temporal anti-aliasing anything that moves by itself smears (62 of 255
  on a striped box at four pixels a frame). `ZhudaObjectMotion` writes
  where each tracked node was the frame before.
- A camera that asked for the surface pictures keeps LayaAir's group of
  two render textures after the effect is gone; they are pooled as a group
  and not in the pool the engine's leak checks count.

## Found while doing WP15, beyond WP15

- The model editor (`zhuda-model-editor`) never kept its camera: its drag
  to turn the view and its wheel to zoom did nothing since it was written,
  and nothing checked it in a browser. It orbits and zooms now, and the
  draw check drives it with the browser's own pointer.
- LayaAir leaves the material of a line sprite behind when the sprite is
  destroyed. Anything that makes a `PixelLineSprite3D` has to destroy its
  material itself.
- A frame that throws on WebGPU (a shader that failed) leaves LayaAir's
  frame target unreturned; `showZhudaStats` makes LayaAir's text atlas,
  which LayaAir keeps. Neither was changed.
- Two lines drawn within a pixel of each other at nearly the same depth
  (the world's axes on two lines of a grid) win by turns from run to run.
  A check that samples one of them has to keep them apart.
- GPU times of a light frame vary from run to run by more than the frame
  itself (0.26 to 1.57 ms by WebGL's timer for the same scene). A check
  has to compare against a load that is several milliseconds, not a ratio.

## Found while doing WP12, beyond WP12

- The Doctor's check of a built page's library order looked at script tags
  only. A page that loads its libraries another way passed with nothing
  looked at; it now reads both orders out of an auto page's loader call.
- `verify-webgpu`, `verify-browser-sdk` and `verify-branding-browser` read
  `dist/browser/<version>` as it lies, and the builder refuses to overwrite
  a folder that differs. After a change to the bundles that folder has to
  be removed and built again before they mean anything.
- LayaAir swallows the error its adapter request throws and rejects with
  "Could not get WebGPU device"; the engine's `WEBGPU_ADAPTER` code never
  reaches a page. On WebGL `nativeEngine` is a minified class name (`Le`).
  Neither was changed.
- Carrying the WebGPU compilers as text in the bundle costs about 0.2 s of
  decoding at every start on the desktop; the same compilers as files are
  22 % fewer gzipped bytes. The browser SDK's default was left as it is
  (one file, one integrity value); `--wasm external` is the other way.

## Found while doing WP13, beyond WP13

- LayaAir changes the vector of its shadow strengths in place and puts the
  same object back. On WebGPU a vector put back as the same object uploads
  nothing. LayaAir gets away with it only because the first write happens
  to come before the first draw; anything that makes that vector earlier
  leaves the sun's shadows without strength on WebGPU. A scene with a
  `ZhudaLightingDepth` hands LayaAir a copy. The same holds for any vector
  of LayaAir's the engine reads, changes and sets: set a new one.
- A soft shadow edge made wider by stretching LayaAir's nine-read filter
  over more texels shows steps. Sixteen reads on a disc turned in every
  pixel do not; that is what `shadowSpread` above 1 is.
- `flat` is a word GLSL keeps for itself. A shader that names a variable so
  fails to compile and LayaAir skips the pass without a word in the log.
- The helper most draw checks read a patch of pixels with takes the nearest
  pixel number to a point, which is half a pixel off on average. The
  lighting check reads the pixel the point falls in; the older checks were
  left as they are (their limits were set with it).
- The sweep of the older draws found what the package's own check did not:
  a look disposed after its scene was destroyed threw, because LayaAir had
  taken the scene's values away. An owner that puts something on a scene
  has to go quietly when the scene went first; `verify-render-scale` holds
  that case for every part of a look.
- On the phone all four switches together cost about 10 ms where the parts
  add up to about 4. Not looked into.

## Found while doing WP11, beyond WP11

- LayaAir's own ambient occlusion (`ScalableAO`, the engine's default at
  0.65) darkens open ground by 16 % and the sky by 13 %, and costs 17 to
  20 ms a frame on the phone (it has the scene drawn once more for
  normals). `aoMethod: 'gtao'` leaves both as they are for 6 to 9 ms. The
  default was not changed: looks in use would change. A game should try it.
- One of LayaAir's shader-data objects drawn with one shader, then another,
  then the first again, draws the first with stale values (the first run
  of the curves showed ACES as no curve at all). Each shader keeps its own
  material or shader data here; nothing swaps a shader on one of LayaAir's.
- LayaAir lays a bloom dirt picture over the frame wrongly when the two
  have the same shape (it keeps the cover of whatever was there before).
  The pipeline sets the cover for that case.
- LayaAir's `CUSTOMLUT` path does not compile and its `LensFlareEffect`
  draws through walls and multiplies its elements' values each time one is
  set. Neither is used.
- The depth picture is read at high precision in every effect of the engine
  now (the item carried from WP8). The whole post-quality page gave the
  desktop's results on the phone; the older effects were not drawn on the
  phone again after the change.

## Found while doing WP9, beyond WP9

- On WebGPU LayaAir never draws its batches of identical renderers into a
  shadow map: repeated props cast no shadow there, in every scene so far.
  Shadow casters are kept out of the batches now and are a draw each. A
  game with many placements that cast should mark them `instanced: true`;
  none was run to see what the change costs it.

## Found while doing WP8, beyond WP8

- `ZhudaFilmicPipeline`'s `finishEffects` ran before the grade since they
  were introduced (LayaAir keeps its colour grade last). Fixed with WP8;
  edge smoothing and the lens finish now work on the graded picture, and
  the lens finish in the screen's colours. Films and games with grain or
  edge smoothing look a little different; none was rendered again.
- A phone reads the depth texture at low precision (LayaAir asks for high
  precision in numbers, not in texture reads). The selection mask reads it
  at high precision now. Still at the default: light fog, depth of field,
  screen reflections, point shadows, probe volumes, the water's depth fade
  and the clouds. To do with WP11, which adds another reader of depth.
- A pass of LayaAir's that fails to compile is skipped, and nothing
  reached the console as an error. A draw check should collect shader
  compile messages, as `verify:stylized-shading` does.

## Open from before the audit

- `inspectEngineHealth` counts loaded modules against the WebGL table only.
