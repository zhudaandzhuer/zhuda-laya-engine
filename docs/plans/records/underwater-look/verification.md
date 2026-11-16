# Verification record: underwater-look (AG1)

Task document: `docs/plans/records/underwater-look/task.md`\
Commit: the commit that adds this file, on top of `b945c03`\
Date: 2026-11-17

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the film host. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`.
  WebGPU: apple / metal-3 (ready), not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `b945c03`; no consumer.
- DPR, viewport and network mode: DPR 1, 480 by 270, loopback.
- Evidence (outside the repository): `EV` =
  `/Users/yaowei/Documents/ZhudaGameCenter/audits/underwater-look-2026-11-17/`:
  `film-underwater-webgl/`, `film-underwater-webgpu/` (pictures and
  reports), the run logs, the WebGL sweep logs, `verify-ag1.log`.

## Checks

| Check                                     | Exact command or procedure                                               | Result                | Artifact                     |
| ----------------------------------------- | ------------------------------------------------------------------------ | --------------------- | ---------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                         | PASS, 919 of 919      | `EV/verify-ag1.log`          |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check`               | PASS                  | —                            |
| Unit tests                                | `node --test tests/underwater.test.mjs`                                  | PASS, 8               | —                            |
| Under water, WebGPU                       | `ZHUDA_FILM_RENDERER=webgpu npm run verify:film-underwater`              | PASS                  | `EV/film-underwater-webgpu/` |
| Under water, WebGL                        | `npm run verify:film-underwater`                                         | PASS                  | `EV/film-underwater-webgl/`  |
| The 20 film draws, WebGPU                 | `npm run verify:film-webgpu`                                             | PASS, 20 of 20        | —                            |
| The 20 film draws, WebGL                  | each script of `verify-film-webgpu.mjs` without the switch               | PASS, 20 of 20        | `EV/sweep-ag1-*.log`         |
| Foliage (the scene's uniforms)            | `node scripts/verify-foliage.mjs`, and with `FOLIAGE_RENDERER=webgpu`    | PASS on both          | —                            |
| No change without water                   | `verify:film-remount` with and without `installLaya342Underwater`, WebGL | frames byte-identical | —                            |

## What the draw shows (WebGL and WebGPU gave the same numbers to a tenth)

The example scene (`tests/fixtures/film/underwater.json`): a sand floor
7 m below the surface, a container wreck, rocks and barriers, a day sun at
62°, light fog with shafts.

| Measure (mean 8-bit RGB of the region)   | With water                  | Without water       |
| ---------------------------------------- | --------------------------- | ------------------- |
| Near the eye (bottom fifth of the frame) | 0, 98.3, 107.2              | 161.8, 154.8, 135.6 |
| Far off (top quarter)                    | 0, 75.6, 124.2              | 177.2, 193.0, 208.5 |
| `measureZhudaFrame`: strong hues, flags  | cyan 31 %, azure 35 %; none | —                   |

| Caustics (floor, lower half of a view along it) |                                 |
| ----------------------------------------------- | ------------------------------- |
| Spread of luminance with them, without          | 14.12, 9.78                     |
| Pixels changed between shot times 0 and 0.6 s   | 65 828 (WebGPU), 65 785 (WebGL) |

| Looking up, 50° above level              |                    |
| ---------------------------------------- | ------------------ |
| The window (top band)                    | 55.8, 167.3, 189.3 |
| Total reflection beyond it (bottom band) | 0, 103.3, 148.7    |

Above the surface (a variant whose water lies below everything): 0 pixels
differ from the scene without water.

## Found on the way

- The first run's caustics did not move: LayaAir's `u_Time` is the time
  within a capture (frame index / fps), not the shot time a preview or a
  still asks for. The water now takes its own time (`setTime`), from the
  stage's `setTime` and from `ZhudaSceneLook.update`'s frame time.
- A first looking-up pose had almost the whole frame inside the window;
  the check now pitches the camera so both the window and the reflected
  surface are in view.

## Limits and decision

- No phone run (requested from the owner's session); the caustics' cost per
  lit pixel is not measured.
- The red channel reaches 0 near the floor at the default extinction (0.45
  a metre, about clear ocean); a scene that wants warmer near colours sets
  a lower red extinction.
- `ZhudaSceneLook` under water and `ZhudaLitSurface` materials are not
  drawn.

Decision: **Implemented**, accepted for desktop WebGL and WebGPU; phone
acceptance open.
