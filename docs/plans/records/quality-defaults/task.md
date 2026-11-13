# Agent task: quality-defaults

Status: In progress; desktop WebGL verified on a software GPU only  
Owner: Engine/toolchain  
Last reviewed: 2026-11-13

## Source requirement

The owner asked for a scan of how far scenes built on the engine are from the
look of a current desktop engine, then for the engine to be optimised
"thoroughly", with two aims: better pictures, and a library from which any
coding agent learns, clearly and reliably, the right route to a good-looking
game or scene. The scan was done by drawing scenes on the engine itself; this
task is the first batch of fixes that scan called for.

## Goal

A scene authored the obvious way looks right without tuning, an agent is told
when a valid scene will not, and two defects that showed only from the second
mounted scene on are gone and pinned by a check that draws.

## What the scan found (all reproduced by drawing)

1. **Stale occlusion colour.** LayaAir 3.4.2's `ScalableAO` never writes
   `u_AOColor`. The uniform lives in the material uniform block, whose blocks
   are handed on from released materials with their bytes; unset uniforms keep
   them. From the second mounted scene on, creases glowed in a stale colour
   (2.6 to 2.9 % of the frame turned green in the test scene). Every film
   preview after the first was affected, since each change remounts.
2. **A WebGL error on every in-place update.** `ZhudaLightFog.setLights` and
   `createPrefilteredEnvironment().update` called `setPixelsData` on a texture
   that was already allocated: `GL_INVALID_OPERATION: glTexStorage2D: Texture
   is immutable`, once per call (every `setLight`, every `setLook` with
   `ambientGround`, every mount with light fog).
3. **Fog that drew a black horizon by day.** `lightFog.color` defaulted to one
   dark blue, right for night only. The documented day example had a dark band
   along the horizon.
4. **Light fog undid multisampling.** The fog used one depth per pixel, so an
   edge pixel took the fog of one side only: outlines against the sky kept
   their stair-steps with multisampling on.
5. **No edge smoothing in a frame drawn once.** The look passed
   `temporalAA: false` and nothing else; previews and games had hard edges.
6. **Ground textures blurred a few metres out.** No texture asked for
   anisotropic filtering and LayaAir's default is 1.
7. **A reflector over a `ground` node reflected nothing**, silently: only
   `model` nodes could be hidden from the mirror.
8. **The route an agent is sent down did not reach the features.** The 3D
   scaffold and the first golden example drew a Blinn-Phong cube with no
   shadows; `AGENTS.md`, the consumer route, the 3D integration guide, the
   agent contract and the MCP corpus did not mention the look, the film guide
   or light fog; the validator accepted every one of the traps above without
   a word.

## Invariants

- LayaAir 3.4.2, no second renderer. Each fix is the smallest change at the
  place the defect lives.
- Public runtime code and declarations stay in step (declarations are
  regenerated, never edited).
- A scene that was valid stays valid. Changed defaults are listed below; each
  has an explicit value that restores the previous behaviour.
- Film renders stay deterministic: the same scene draws the same bytes,
  including after other scenes were mounted in between.
- Nothing here claims WebGPU, mobile or mini-game behaviour.

## Scope

### Engine

- `packages/core/runtime3d/Filmic.ts`: occlusion colour written; environment
  updated in place; `msaa` option and `setAntialias`.
- `packages/core/runtime3d/LightFog.ts`: lights replaced in place; attenuation
  averaged over the neighbouring depths.
- `packages/core/runtime3d/Surfaces.ts`, `Assets.ts`: `ZHUDA_DEFAULT_ANISO`,
  `anisoLevel`, `applyZhudaAnisotropy` (applied once per loaded model).
- `packages/core/shaders/ReflectiveSurface.ts`: `clipBelowPlane`, default true.
- `packages/core/film/FilmScene.ts`, `LookQuality.ts`, `LiveLook.ts`,
  `FilmStage.ts`: `grade.antialias`; `lightFog.color` default from the look
  (each preset's measured `horizon`); material `size` up to 2048; a mistyped
  field names the one that was meant.
- `packages/core/film/FilmLint.ts`, `FrameMetrics.ts` (new): advice for a
  valid scene; numbers for a drawn frame.
- `packages/core/runtime3d/CinematicCapture.ts`: the timeout message says how
  long and what to change.
- `packages/compiler/chrome-host.mjs`, `packages/mcp-server/film-host.mjs`:
  WebGL errors of the page are recorded (`glErrors`, `takeGlErrors()`).
- `packages/mcp-server`: `advice` in `film_scene_create`, `_apply`, `_get`;
  `metrics`, `newHues`, `glErrors` in previews; `film_scene_lint`;
  `get_quality_route` (`quality-route.mjs`); one guardrail and three golden
  examples.
- `packages/compiler/zhuda-init.mjs`: the 3D scaffold is on the route and
  ships `AGENTS.md` and `.mcp.json`; `agent-contract.mjs` requires
  `docs/quality-route.md`.
- `scripts/verify-film-remount.mjs`, `scripts/verify-quality-route.mjs` (new);
  `scripts/verify-film-reflector.mjs` (a floor or ground under the mirror no
  longer blocks it).
- Documents: `docs/quality-route.md` (new), `docs/film-scenes.md`,
  `docs/filmic-rendering.md`, `AGENTS.md`, `README.md`,
  `docs/consumer-route.md`, `docs/3d-integration.md`,
  `docs/agent-development.md`.

### Consumer or adapter

None. A consumer picks the changes up with the next pinned version.

## Changed behaviour a consumer will see

| Change                                                        | To get the previous behaviour                |
| ------------------------------------------------------------- | -------------------------------------------- |
| A look with `grade` multisamples its HDR target               | `grade: { antialias: 'none' }`               |
| `lightFog.color` left out: the sky near the horizon           | `color: [0.02, 0.03, 0.05]`                  |
| What lies below a reflector no longer shows in its mirror     | `clipBelowPlane: false` (the class)          |
| Mipmapped surface and model textures: anisotropic filtering 8 | `anisoLevel: 1` (`createSurfaceTexture`)     |
| Quality level 1 also drops multisampling                      | none; level 2 keeps it                       |
| `zhuda-laya-init` (3D): `postProcess` feature, a look, PBR    | none; edit the generated `src/Main.ts`       |
| A scene with no `look`: the day preset                        | `look: {}`                                   |
| Graded stills and video: samples averaged before tone mapping | none in a film scene; grain is applied once  |
| `ambient` beside `ambientGround`, `ambientGround`, `lightFog.color`, water `color`, lamp halos: display values | `zhudaEncodeColor(old)` draws what `old` drew |
| `Zhuda3D.createMaterial` and prefab materials without `type`: PBR | `type: 'blinn-phong'`, or a `shininess` |
| One `ZhudaPointShadow` per scene holds up to four lamps          | none                                         |
| Day, dawn, dusk, overcast presets: sky and ground light, brighter | `ambient: [old], ambientGround: false`       |
| `screenReflections`: softer (half size, blurred)                 | none; a `reflector` for a mirror-sharp floor |

Multisampling costs GPU time. The quality governor drops it at level 1, but a
game that pins level 3 on a weak GPU should measure before taking this version.

## Second batch (same task)

- **Scene-linear accumulation.** With a grade, the samples of a still or a
  video frame are drawn scene-linear into a half-float target with tone
  mapping and lens finish off, averaged, and the average is drawn through
  tone mapping and lens finish once (`ZhudaFilmicPipeline.linearChain()`,
  `CinematicFrameRequest.linear`, `accumulation: 'scene-linear'`). Without a
  grade, and for callers that do not pass the chain, the earlier
  display-linear averaging stays.
- **Screen reflections.** `look.screenReflections` (`ZhudaScreenReflections`):
  reflections of what is on screen on every surface, by Fresnel, in the HDR
  chain before fog. Quality level 2 halves the steps, level 1 switches it off.
- **A scene with no `look` at all** is drawn with the day preset
  (`ZHUDA_FILM_ABSENT_LOOK`); `look: {}` stays the bare look.
- **What reaches the grade stays inside its lookup table.** A red lamp of
  `emission` 6 drew grey-green and at 8 lost its red. Cause: `emission` is
  decoded like a colour, so 6 is 74 in the scene and 8 is 147, and the log
  encoding of LayaAir's `ColorGradEffect` table ends at 58.85 after exposure;
  beyond it the lookup reads outside the table. One pass in front of the grade
  scales such a colour down to 56 with its hue kept (`ZHUDA_GRADE_TABLE_MAX`).
- **Variation.** `"variation": 0.5` on a recipe material lays slow changes of
  brightness, several tiles wide, over the surface (`bakeZhudaVariation`, the
  material's detail map), so a large floor does not show its tiles as a grid.
  The advice rule `texture.repeats` asks for it.
- **Colour values, measured and documented, not changed.** Surface, light and
  ambient colours and `emission` are display values that LayaAir decodes (0.5
  gives 21 % of the light), intensities are linear, and two places are
  scene-linear instead: `ambient` once `ambientGround` is given (the same
  numbers then give 2.3 times the sky light) and `lightFog.color`. The
  documents and messages said "linear RGB" throughout; they now say what was
  measured (`docs/film-scenes.md`, "Colour values"). Making the two exceptions
  agree with the rest would darken every scene that uses them: an owner
  decision.

## Fourth batch (same task)

- **Shadows from a point light.** `"castsShadow": true` on one point light of
  a film scene, and `ZhudaPointShadow` for games. The lamp's surroundings are
  drawn six times into one texture; LayaAir's own point-light function
  (`Lighting.glsl`, patched before `Laya.init` by
  `installLaya342PointShadows`, which `ZhudaEngine.boot` calls) asks it
  whether a surface is farther from the lamp than what the picture holds.
  Drawn once, and again when the light's `range` or something that moves
  with time changes.
- **A regression met on the way and pinned.** The first version passed the
  light's position and settings as two vectors in the scene's uniform map.
  Every shader that did not declare them then disagreed with LayaAir about
  the layout of the scene's uniform block, and all point and spot lights of
  the night example went dark, while a scene with a single lamp still drew
  correctly. The values now travel in a two-texel texture (samplers are not
  in the block), and `verify:quality-route` asserts that the lamps and the
  spot light of the night example change the frame.

## Fifth batch (same task)

- **Round and raised shapes.** `createZhudaLatheMesh` (a body of revolution
  from an outline of `[radius, height]` pairs, smooth except at corners
  sharper than 30 degrees) and `createZhudaExtrudeMesh` (a flat outline,
  concave or not, raised to a height, its top filled by ear clipping), and
  the film nodes `lathe` and `extrude` that use them. Until now a film scene
  without props could hold boxes only.

## Sixth batch (same task)

- **One meaning for colours.** Every colour of a look, a material and a node
  is a display value, decoded the way LayaAir decodes its own colours
  (`packages/core/film/ColorValues.ts`). Until now five were read as light
  instead: `ambient` beside `ambientGround`, `ambientGround`,
  `lightFog.color`, a water node's `color`, and the glow of lamps in the
  fog (and the sun's colour in beams and on water). The preset `horizon`
  colours (the fog's default) are now stored as the display values of what
  was measured, so a scene without a fog colour draws as before. The route
  examples and the documented game example were carried over with
  `zhudaEncodeColor` and draw as before, except that lamp halos now take the
  lamps' own colour. Texture recipe colours stay light, as their type
  `ZhudaLinearColor` says.
- **Point shadows: soft edges and up to four lamps.** The edge is filtered
  between texels over `softness` texels (2). The first filtered version made
  the far floor shade itself in stripes where the light grazes it; the lookup
  now moves out along the surface normal by a texel and a half and toward the
  lamp by as much as the filter reaches on a surface that steep. One
  `ZhudaPointShadow` holds up to four lamps (`lights`, `render(..., light)`,
  `clear(light)`); a film scene may give `castsShadow` to four point lights.
- **`Zhuda3D.createMaterial` is physically based by default.** A `shininess`
  without a `type` still gives Blinn-Phong (only Blinn-Phong has one), so
  code written for the old default with a shininess, like the game's
  `Minesweeper3DView`, is unchanged. Prefab materials follow the same rule.

## Seventh batch (same task)

- **Bounce light, captured at mount.** `ZhudaProbeVolume` (and
  `look.bounceLight` in a film scene): probes on a grid capture their
  surroundings, their nine ambient colours become the octahedral irradiance
  pictures LayaAir's own `VolumetricGI` reads, and every pixel of a
  physically based material is lit from the eight probes around it instead
  of the ambient light. One bounce, captured once; not real-time.
- Three things LayaAir does, found by drawing and handled: it reads a GI
  volume only where the scene's ambient light is a picture (a flat ambient
  colour is given an even picture of the same colour while the volume
  lasts); nine colours projected straight from a captured cube have X the
  other way round from LayaAir's ambient (a red wall on -X lights a face
  turned to -X red only when they are evaluated at X mirrored); and a probe
  inside a solid sees out through the solid's back faces. Such probes
  are switched off through LayaAir's own visibility test (their distance
  pictures say everything is right at them). The solids are the props'
  colliders and the bounds of boxes and shapes.
- The environment probe's projection to nine colours and its face-to-cube
  conversion are exported (`zhudaAmbientSH`, `zhudaCubeFromFaces`,
  `ZHUDA_CUBE_VIEWS`) and shared; its results are unchanged.
- The probes are drawn eight at a time into one picture, six tiles each, and
  read back once (`batch`); the nine colours agree with reading every face
  back on its own. On the software GPU this is no faster (drawing dominates:
  32 s for the day example); fewer read-backs are meant for real GPUs, where
  each one waits for the GPU, and that was not measured.
- Not added to the route examples: on the day yard the shaded sides only
  turn a little bluer (sky from above), while the mount takes 29 s instead
  of 5.5 s with 112 probes on the software GPU.

## Eighth batch (same task)

- **Brighter presets, by the owner's decision.** The day, dawn, dusk and
  overcast presets give sky light from above and ground light from below in
  place of one dim flat colour: their old `ambient` values as the light they
  gave when `ambientGround` read them as light (day `[0.62, 0.64, 0.7]`,
  about a third of the sun's light on the ground), and a darker, warmer
  ground. Shadowed sides read instead of falling to black at dusk. Night
  keeps its flat, dim ambient. `ambientGround: false` opts out.
- **Screen reflections in three passes.** The rays are marched in screen
  space, evenly between where they start and where they leave the picture or
  reach their distance (the steps used to grow with distance, so a small
  bright thing was skipped by most pixels), at half size; the result is
  blurred across and down, weighted by depth, and added to the scene. A ray
  that passes behind a thin thing no longer counts as a hit. A lamp's
  reflection on the ground went from a scattered line of single bright
  pixels to two or three soft spots.
- **Where the reflection change came from.** The working tree held this
  change to `ScreenReflections.ts` at the start of the batch, made between
  the delivery of the seventh batch and this one by an attempt that was not
  delivered. It was reviewed against LayaAir's own post-process API
  (`blitScreenTriangle`, `indirectTarget`, `deferredReleaseTextures`, as in
  its bloom and ambient occlusion), given a unit test of one frame's passes,
  drawn, measured and verified before it was kept.

## Non-goals

- Shadows from more than four point lights, real-time global illumination
  (bounce light is captured once), occlusion between probes beyond the
  switched-off ones (light leaks through a wall thinner than the spacing),
  models as solids for the probes,
  more probes with box projection, decals, parallax, shapes swept along a
  path, WebGPU compute passes: not in this task. Nothing here could be
  verified on WebGPU.
- Scene-wide changes to the presets' ambient light. Measured here, the day
  preset's `ambient` (0.34) is a tenth of the light, a dim fill for a sunny
  day; the route's day example asks for `[0.62, 0.63, 0.67]` instead.
  Raising the presets would brighten every scene built on them: an owner
  decision.

## Acceptance checks

1. `npm run verify:film-remount` passes; with the occlusion colour line
   removed it fails on "mount 2 draws the frame of mount 1"; with the light
   fog change alone reverted it fails on the WebGL-error assertion.
2. `npm run verify:quality-route` passes: both example scenes draw with no
   advice, no metrics flag and no WebGL error; shadows and the reflection over
   a `ground` node are in the frame.
3. `npm run verify:film-reflector`, `verify:film-look`, `verify:film-fog`,
   `verify:film-environment`, `verify:film-water`, `verify:film`,
   `verify:film-model`, `verify:film-animation`, `verify:procedural` pass.
4. `npm run verify:film-highlights` and `npm run verify:film-reflections`
   pass.
5. `npm test`: the new suites pass (`look-defaults`, `film-lint`,
   `quality-route`, `screen-reflections`, `variation`); no test that passed
   before fails. `npm run verify:film-variation` passes.
6. `npm run verify` on the pinned toolchain (Node 24, the lockfile's
   TypeScript, esbuild and prettier).
7. The same draws on the owner's GPU, and `npm run verify:film-webgpu`.

## Evidence to attach

- Test/build output: `verification.md`.
- Browser/WebGL report: `verification.md` (software GPU).
- Resource/lifecycle report: the remount check (five mounts, byte-identical).

## Unverified limits

- Checks 6 and 7 were not run: see `verification.md`. Until they are, this is
  not Accepted.
- `prettier` and `eslint` were not available: run `npm run format` and
  `npm run lint` once.
- WebGPU: the light fog and the screen reflections read `u_Viewport`; texels
  are replaced with `setSubPixelsData`; the HDR target is multisampled; the
  scene-linear path reads a half-float target and uploads a float texture.
  All untested there.
- Screen reflections were drawn on a software GPU only; their cost was not
  measured. Small bright things reflect as broken streaks in a frame drawn
  once.
- The frame-time cost of multisampling was not measured on any real GPU.
- The `horizon` colours were measured on a software GPU from the presets as
  they are; a preset whose atmosphere is overridden keeps the preset's value.

## Rollback

The last known good state is the source this batch started from (package
version 1.18.0, unreleased). Every change is independent of the others except
the advice and metrics, which the MCP replies and the route build on; revert
`Filmic.ts` and `LightFog.ts` last, since `verify:film-remount` pins them.
