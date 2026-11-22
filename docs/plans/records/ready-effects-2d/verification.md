# Verification record: ready 2D effects and a 2D route

Task document: [task](task.md)\
Commit: the one that carries this record, on `27c41b5`\
Date: 2026-11-22

## Environment

- A Linux container (Linux 6.18), headless Chromium 153 (Chrome for Testing)
  with WebGL by SwiftShader: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
  (Subzero) (0x0000C0DE)), SwiftShader driver)`. A software rasterizer, not a
  GPU. No WebGPU device: a WebGPU page there fails with `Could not get WebGPU
  device` (seen with `verify:ribbon-growth` the same day).
- Node 24.22.3 (`/opt/node24`), npm 11.19.1; `CHROME_BIN=/opt/pw-browsers/chromium`.
- Engine 1.18.0 on `27c41b5`; no consumer.
- 400 by 300 CSS pixels at DPR 1, served from 127.0.0.1.

## Checks

| Check                         | Exact command or procedure                                                              | Result                           | Artifact                                  |
| ----------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| Build, types, Doctor, tests   | `npm run verify`                                                                        | PASS (974 tests)                 | console                                   |
| Lint, format, whitespace      | `npm run lint`, `npm run format:check`, `git diff --check`                              | PASS                             | console                                   |
| Unit tests of the presets     | `node --test tests/effect-presets-2d.test.mjs` (in `npm test`)                          | PASS (6 tests)                   | console                                   |
| Routes                        | `tests/implementation-routes.test.mjs` (in `npm test`): `game-2d` listed, header, eight sections, MCP `list_routes` | PASS          | console                                   |
| Real WebGL draw               | `npm run build`, then `npm run verify:effects-2d`                                      | PASS                             | `report.json`, `sheet.png`, 82 screenshots |
| Real WebGPU draw              | the `2d-webgpu` profile                                                                 | UNAVAILABLE (no WebGPU device)   | none                                      |
| Neighbour                     | `RIBBON_RENDERERS=webgl npm run verify:ribbon-growth`                                   | PASS (4 steps, no failure)       | `report.json`                             |
| Phone                         | none                                                                                    | UNAVAILABLE (no phone attached)  | none                                      |

The evidence folder of the draw check was the session's scratch folder
(`EFFECTS2D_OUT`); it is not in this repository and does not outlive the
container. Running the command again writes the same files.

## What the draw check measured

Every preset was opened in a 400 by 300 view, fitted by its `sizePixels` and
placed by its `origin`, and asked for a time with `seek`: a burst at 0.12 s,
a loop at its `seconds`. A pixel counts as changed when a channel moves by
more than 6 of 255 against the empty view.

| Preset         | Pixels it draws | A quarter second on, pixels that differ | A burst under way | The same time twice | A burst at its seconds |
| -------------- | --------------- | --------------------------------------- | ----------------- | ------------------- | ---------------------- |
| coin-burst     | 1,241           | 3,105                                   | 2,373 at 0.48 s   | same bytes          | 0 alive, 0 pixels      |
| sparkle        | 139             | 223                                     |                   | same bytes          |                        |
| level-up       | 2,212           | 7,785                                   | 11,063 at 0.54 s  | same bytes          | 0 alive, 0 pixels      |
| hit-spark      | 3,504           | 3,504                                   | 3,321 at 0.18 s   | same bytes          | 0 alive, 0 pixels      |
| explosion      | 19,952          | 20,921                                  | 14,254 at 0.66 s  | same bytes          | 0 alive, 0 pixels      |
| smoke-puff     | 1,174           | 2,058                                   | 2,671 at 0.48 s   | same bytes          | 0 alive, 0 pixels      |
| torch          | 1,366           | 1,550                                   |                   | same bytes          |                        |
| campfire       | 12,562          | 11,210                                  |                   | same bytes          |                        |
| magic-aura     | 1,448           | 2,727                                   |                   | same bytes          |                        |
| heal           | 1,270           | 2,375                                   |                   | same bytes          |                        |
| confetti       | 637             | 2,289                                   | 2,066 at 0.90 s   | same bytes          | 0 alive, 0 pixels      |
| rain           | 5,711           | 10,978                                  |                   | same bytes          |                        |
| snow           | 3,701           | 6,895                                   |                   | same bytes          |                        |
| falling-leaves | 1,402           | 2,633                                   |                   | same bytes          |                        |
| petals         | 1,003           | 1,946                                   |                   | same bytes          |                        |
| bubbles        | 1,749           | 3,540                                   |                   | same bytes          |                        |
| landing-dust   | 1,271           | 2,741                                   | 2,754 at 0.36 s   | same bytes          | 0 alive, 0 pixels      |
| click-ripple   | 600             | 2,968                                   | 1,388 at 0.21 s   | same bytes          | 0 alive, 0 pixels      |
| sparkle-trail  | 50 (still)      | 60                                      |                   | same bytes          |                        |
| embers         | 385             | 756                                     |                   | same bytes          |                        |

- **The trail.** `sparkle-trail` standing still has 4 particles and draws 50
  pixels; moved along an arc by forty frames of `update(1/60)` it has 63 and
  draws 1,741; the same moves again give the same bytes.
- **The sprites' alpha.** One soft white particle 200 pixels across over black:
  its centre is 255, half way out (where the sprite's alpha is 0.531) 134, and
  the quad's corner 0, with both `alpha` and `additive` blending.
- **Release.** Thirty explosions made, stepped, drawn and released: the holder
  has no child and LayaAir's resource table holds 13 resources before and 13
  after.
- No page error and no console error.

## A defect found and fixed on the way

The first draw used textures made premultiplied but marked as plain data:
the probe's half-way pixel was 191 instead of 135, for both blends. LayaAir
draws 2D in light and encodes the result for the screen (191 is 0.531
encoded), so a picture's bytes show as they are only when the picture is
marked sRGB, as LayaAir's own loaded 2D pictures are (premultiplied, sRGB).
`ZhudaEffect2D` makes its textures that way now; the probe reads 134. The
check failed once more on the way because the browser bundle was built from a
`dist/sdk` older than the fix: `npm run build` comes before the check (said
in the route and the effects README).

## Lifecycle and failure cases

- A failed construction releases what was made (unit test: unknown preset, bad
  seed, sprite size, scale, position, a parent that is not a node, an emitter
  on a picture that is not built in, Laya not booted; nothing is added to the
  parent and no texture is made).
- `dispose` destroys its sprites and textures, never the parent; calls after
  it do nothing (unit test and the thirty cycles above).
- `seek` back in time restarts from the seed; a negative time is nothing.
- `update` takes the caller's delta; each emitter catches up at most a quarter
  of a second at once (the particle system's own bound).

## Prefab evidence (visual work)

| Prefab ID / child path / state | Source and dependency revisions | Isolated replay command / environment | Reference / actual / diff | Result |
| --- | --- | --- | --- | --- |
| none: engine presets, not a consumer prefab | `27c41b5` and this commit | `npm run verify:effects-2d`, the environment above | no reference picture; the checks above are self-consistency and the probe's arithmetic | PASS within that scope |

A game that shows a preset puts it in its own prefab or scene check.

## Limits and decision

- No WebGPU draw (`2d-webgpu`); no phone; no GPU at all (SwiftShader); no
  frame time measured.
- The presets were looked at as stills on black, once, by the agent that made
  them; none was judged in motion by a person, nor over a light background
  (additive presets vanish on white, by nature).
- Colour and alpha over life are drawn in twelve bands (the renderer's
  default): steps can show on a large slow particle.
- The route `game-2d` joins steps each checked on its own; no game was built
  along all of it.
- Only the `2d` browser profile was drawn; a consumer build with the scaffold's
  features is checked statically by `npm run verify`, not drawn here.

Decision: **Implemented within scope.** The device, WebGPU and in-game checks
above are missing, so it is not Accepted.
