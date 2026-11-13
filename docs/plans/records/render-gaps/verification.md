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
| 3. Reflections of what is off screen | Not started | |
| 4. Decals, parallax, swept shapes | Not started | |
| 5. Bounce light that updates and leaks less | Not started | |
| 6. Clouds; skin, hair and cloth | Not started | |

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 491 of 491 | `EV/gap12/verify.log` |
| Format, lint | `npm run format:check`, `npm run lint` | PASS | `EV/gap12/` |
| Camera effects, WebGL | `npm run verify:camera-effects` | PASS | `EV/gap12/webgl/logs/verify-camera-effects.log` |
| Camera effects, WebGPU | `CAMERA_EFFECTS_RENDERER=webgpu npm run verify:camera-effects` | PASS | `EV/gap12/webgpu/logs/verify-camera-effects.log` |
| Carried lamp's shadow | `npm run verify:film-animation` (step 4b), both backends | PASS | `EV/gap12/*/logs/verify-film-animation.log` |
| Eight lamps' shadows | `npm run verify:film-point-shadow` (eight lamps), both backends | PASS | `EV/gap12/*/logs/verify-film-point-shadow.log` |
| Everything else that draws | the other 18 GPU scripts on WebGL and with the WebGPU switches; `npm run verify:film-webgpu` | PASS | `EV/gap12/` |

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
- No picture was looked at by a person: the scripts assert numbers.
- Phones and mini-game hosts: not drawn.

**In progress.** Areas 1 and 2 are built and verified on desktop WebGL and
WebGPU; areas 3 to 6 are not started.
