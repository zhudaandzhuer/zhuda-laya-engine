# Verification record: render-gaps

Task document: `docs/plans/records/render-gaps/task.md`  
Commit: see each area  
Date: 2026-11-13

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: `apple metal-3`.
- Node and package manager: Node 26.12.0, npm 11.20.0 (`engines` asks `>=24`).
- Engine and consumer commits: on top of `30110a0`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300 and 640 by 360 as each
  script sets them; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/render-gaps-evidence/`

## Areas

| Area of the task | State | Where |
| --- | --- | --- |
| 1. Camera: automatic exposure, depth of field, motion blur | Built, drawn on WebGL and WebGPU | below |
| 2. Shadows: a carried lamp casts; eight point lights | Built, drawn on WebGL and WebGPU; more than one spot shadow not built | below |
| 3. Reflections of what is off screen | Sky fallback and box projection built, drawn on both backends; off-screen things themselves not built | below |
| 4. Decals, parallax, swept shapes | Decals on a plane and swept shapes built, drawn on both backends; parallax and wrapping decals not built | below |
| 5. Bounce light that updates and leaks less | Built, drawn on both backends; still captured at intervals, not real time | below |
| 6. Clouds; skin, hair and cloth | A cloud layer, clear coat and anisotropy built, drawn on both backends; skin, cloth sheen and hair strands not built | below |

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 504 of 504 (491 after areas 1 and 2, 498 after 3 and 4, 501 after 5) | `EV/gap6/verify.log` |
| Format, lint | `npm run format:check`, `npm run lint` | PASS | `EV/gap12/` |
| Camera effects, WebGL | `npm run verify:camera-effects` | PASS | `EV/gap12/webgl/logs/verify-camera-effects.log` |
| Camera effects, WebGPU | `CAMERA_EFFECTS_RENDERER=webgpu npm run verify:camera-effects` | PASS | `EV/gap12/webgpu/logs/verify-camera-effects.log` |
| Carried lamp's shadow | `npm run verify:film-animation` (step 4b), both backends | PASS | `EV/gap12/*/logs/verify-film-animation.log` |
| Eight lamps' shadows | `npm run verify:film-point-shadow` (eight lamps), both backends | PASS | `EV/gap12/*/logs/verify-film-point-shadow.log` |
| Sky in reflections | `npm run verify:film-reflections` (sky step), both backends | PASS | `EV/gap34/*/logs/verify-film-reflections.log` |
| Box projection | `npm run verify:film-environment` (room step), both backends | PASS | `EV/gap34/*/logs/verify-film-environment.log` |
| Swept kerb | `npm run verify:film-shapes` (sweep step), both backends | PASS | `EV/gap34/*/logs/verify-film-shapes.log` |
| Decals | `npm run verify:film-decals`, both backends | PASS | `EV/gap34/*/logs/verify-film-decals.log` |
| Leak through a thin wall | `npm run verify:film-bounce` (leak step), both backends | PASS | `EV/gap5/*/logs/verify-film-bounce.log` |
| Refresh while running | `npm run verify:camera-effects` (bounce step), both backends | PASS | `EV/gap5/*/logs/verify-camera-effects.log` |
| Clouds | `npm run verify:film-clouds`, both backends | PASS | `EV/gap6/*/logs/verify-film-clouds.log` |
| Clear coat, anisotropy | `npm run verify:film-finishes`, both backends | PASS | `EV/gap6/*/logs/verify-film-finishes.log` |
| Everything else that draws | the other GPU scripts on WebGL and with the WebGPU switches (24 in all); `npm run verify:film-webgpu` (20) | PASS | `EV/gap6/` |

### 1. Camera

`packages/core/runtime3d/CameraEffects.ts`; look options `autoExposure`,
`depthOfField`, `motionBlur`. Drawn through `ZhudaSceneLook` (the path a game
uses) on a scene of unlit stripes: 10 cm wide 3 m away on the left, 1 m wide
40 m away on the right. Sharpness is the root of the mean squared step in
brightness between neighbours along a row. The same numbers on both backends.

| What | Measured |
| --- | --- |
| No effect | near 49.4, far 48.1 |
| Depth of field, 85 mm at f/1.4, focus 3 m | near 49.4, far 8.6 |
| Focus pulled to 40 m in place (`updated`) | near 13.1, far 48.1 |
| Depth of field off again | the first frame, difference 0 |
| Motion blur, camera standing | the first frame, difference 0 |
| The frame in which the camera turns 6.8 degrees | near 4.9, far 6.3 |
| The frames after it | near 40.2, far 40.0 (another view than the first) |
| Turned back and standing | the first frame, difference 0 |
| Mean brightness of a dim scene, without and with automatic exposure | 14.3, 36.3 |
| Of a bright scene, without and with a key of 0.04 | 114.4, 57.5 |
| Bright to dim at one adaptation a second, after 0.1, 0.5, 1.5 and 6 s | 15.1, 20.7, 36.3, 36.3 |
| Ten times all three on and off | no resource left behind (71 before, 66 after) |
| A lens without a focus distance | refused, the look unchanged |

### 2. Shadows

- A point light that `follows` a model may cast: its pictures are drawn from
  where the model has carried it (`FilmStage.ts`). Ground behind a post in
  front of the lamp at 0 s and behind another beside it at 2 s: lit without
  `castsShadow`, under 40 percent of that with it.
- `ZHUDA_POINT_SHADOW_MAX_LIGHTS` is 8. More than four lights default to
  pictures of 256 (the texture is 4096 tall at most). Eight lamps, each with
  a box: the floor behind every box 67 of 255 without shadows, 0 with them.
- More than one shadow-casting spot light: **not built**. LayaAir 3.4.2 draws
  one spot shadow map; a second would need the point-shadow approach for
  spots.

### 3. Reflections

- `screenReflections.sky` (0..1, default 0) and `skyColor`: a reflected ray
  that finds nothing and points upward shows the sky's colour (the look's
  horizon colour unless given). A dark floor under a blue sky, seen along its
  length, blue channel of the floor ahead: 0 without, 138 with `sky: 1`
  (131 on WebGPU), 88 at 0.5; red 119 with a red `skyColor`. It cannot tell
  a roof off screen from open sky: off by default.
- `environment.box` (and `ZhudaEnvironmentProbe.capture({ box })`): LayaAir's
  box projection. The scene's own probe has no node and its position cannot
  be set (the setter reads `owner.transform`), so a second `ReflectionProbe`
  is put on a node at the capture position with the scene probe's settings,
  the room as its bounds (in the node's frame) and `boxProjection` on. A
  mirror floor in a room 8 by 3 by 8 m with a lamp panel on the back wall:
  where the camera's reflected line of sight meets the panel, the floor is
  0, 0, 0 taken as infinitely far and 255, 0, 0 with the box; a scene without
  a box after one with it is as before.
- Things that are off screen are still not reflected: **not built**.

### 4. Surfaces

- `sweep` node and `createZhudaSweepMesh`: a cross-section carried along a
  path, upright, of one width through a corner, open or closed. Unit checks:
  winding, bounds of a straight run, a right-angle corner, a ring and a
  slope, the area of the top. Drawn: a kerb round a corner, its top lit
  alike on both legs (175 and 175 of 255) and differently from its side
  (181); the floor there is 34 without it.
- `decal` node and `ZhudaDecal`: a mark on a plane with a baked outline. On
  a pale floor (164): 6 at the middle of a black mark, 40 on its soft edge,
  164 beside it; 114 at opacity 0.5; a mark in a post's shadow 87 against
  205 out of it; a red line on a wall, the wall above it untouched; the same
  seed the same frame, another seed another; identical after 20 mounts.
- `createSurfaceMaterial({ type: 'pbr', blend: 'alpha' })` no longer throws
  (it set a constant LayaAir 3.4.2 does not have); it is `PBRRenderMode.Fade`.
- Parallax: **not built**. LayaAir's PBR shader has no height input; it
  would need every map of a lit material sampled again at a shifted place
  through the engine's own lit hook.
- Decals projected onto whatever lies under them: **not built** (a forward
  renderer has no surface buffer to project into).

### 5. Bounce light

- `visibility` (`ZhudaProbeVolume`, `bounceLight.visibility`): the capture
  carries the distance along the view in its alpha; a tile of 16 by 16 texels
  a probe holds the mean and the mean squared distance toward each direction
  (`zhudaProbeDistanceTile`), which LayaAir's own shader tests against. A red
  lamp on one side of a wall 0.3 m thick, nothing else lit, probes 1.5 m
  apart with one column 10 cm in front of the wall on the lamp's side: the
  floor behind the wall is 223, 0, 0 without it and 10, 0, 0 with it, on both
  backends. A cube's face toward a sunlit red wall: 164, 32, 42 with it, as
  without.
- `refresh(count)`: a red lamp panel over a white floor, 32 probes. Baked,
  the floor is 54, 0 (red, green); the lamp turned green, it stays 54, 0;
  after the first 8 probes still 54, 0 (those stand elsewhere); after a round
  of all, 0, 61. Resources 41 before and after; a refresh during another
  returns 0; `refresh` before `bake` is refused; disposed, the floor is dark.
- The bake was restructured for this (one capture routine, textures written
  in place): the earlier bounce checks pass unchanged.
- Real-time global illumination: **not built**. A refresh is six scene draws
  a probe and one read-back a batch: seconds for a level, not a frame.

### 6. Clouds and finishes

- `look.clouds` and `ZhudaClouds`: a slab of drifting computed noise followed
  along each view ray. Sky to the right of a tower, mean colour of 0..255:
  clear 0, 45, 158; full cover 227, 226, 225; half cover 151, 160, 197; no
  cover the clear sky (difference under 1). The tower in front is untouched.
  Full cover without the sun: 93 against 227 with it. Five seconds of a wind
  of 60 m/s change the sky by 84 of 255 on average; the same time draws the
  same frame; identical after 12 mounts. One picture was looked at
  (`EV/gap6/webgl/zhuda-film-clouds/broken.png`): separate clouds, lit from
  the sun's side, the tower in front; the layer ends in a straight band
  above the horizon where its reach ends.
- `clearCoat`, `clearCoatRoughness`, `anisotropy` on `createSurfaceMaterial`
  and on a flat film material. A matt ball's brightest value 27 of 255;
  under a clear coat 255 on a spot of 14 pixels. A metal ball's highlight 52
  by 52 pixels; 102 by 39 at anisotropy 0.45, 178 by 85 at 0.9. LayaAir
  ignores the sign of its anisotropy and its rotation tilted the band
  instead of turning it a quarter: the option is 0..1 and no angle.
- Skin (light passing through it), cloth sheen, hair strands: **not built**.
  LayaAir 3.4.2's PBR material has no subsurface term; its sheen lobe is
  filled only by the glTF material path, which this task did not touch.

## Lifecycle and failure cases

- Repeated create and destroy: ten rebuilds of a look with all three camera
  effects leave no resource; the existing remount and live-look checks pass.
- Malformed data: unknown options, values out of range, a lens without focus
  and a look without a grade are refused (`tests/camera-effects.test.mjs`).
- Stale history: `ZhudaMotionBlur.resetHistory`; a film frame never smears
  from the frame before it and adapts its exposure at once.
- Context loss, cancellation: not exercised.

## Prefab evidence (visual work)

Not applicable: no consumer prefab is changed.

## Limits and decision

- Frame-time cost of none of this is measured. Depth of field adds three
  full-screen passes (two at half size), motion blur one with twelve reads,
  automatic exposure three (two of one texel).
- Motion blur is the camera's only; depth of field has no aperture shape and
  can bleed a bright background a little over a sharp edge in front of it.
- A carried lamp's shadow costs six scene draws each time it is drawn again.
- No picture was looked at by a person, except the swept kerb: the scripts
  assert numbers.
- A decal 4 mm off a surface can flicker against it far from the camera
  (depth precision); not measured.
- Phones and mini-game hosts: not drawn.

Not built, with the reason, after all six areas: real-time global
illumination; reflections of things that are off screen; more than one
shadow-casting spot light; motion blur of things that move by themselves;
parallax; decals that wrap round geometry; cloud shadows and weather; skin,
cloth sheen and hair strands. `docs/quality-route.md` lists them.

**In progress.** Every area is built as far as the table above says and
verified on desktop WebGL and WebGPU on one Apple M4. Not Accepted: no phone
or mini-game host has drawn any of it, no frame time is measured, and the
pictures were asserted by numbers, not approved by a person.
