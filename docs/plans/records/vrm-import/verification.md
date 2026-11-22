# Verification record: VRM 1.0 import

Task document: [task](task.md)\
Commit: the one that carries this record, on `27c41b5` (branch
`claude/handover-review-3q105d`)\
Date: 2026-11-23

## Environment

- A Linux cloud container (no GPU): headless Chromium 1243 from Playwright
  (`/opt/pw-browsers/chromium`, `CHROME_BIN`), WebGL through
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`,
  a software rasterizer. WebGPU: no device in this container
  (`Could not get WebGPU device`).
- Node 24.22.3 (`/opt/node24`; the container's default Node 22 is below the
  package's `engines`), npm 11.
- Engine: `27c41b5` plus this change. No consumer.
- 480 by 360 CSS pixels, DPR 1, local HTTP server.

## Checks

| Check                       | Command or procedure                                                                         | Result                                                                                                                               | Artifact                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Build, types, Doctor, tests | `npm run verify`                                                                             | PASS (with the 2D effects merged: see the [2D record](../ready-effects-2d/verification.md) and HANDOFF)                              | console                                                           |
| Lint, format, whitespace    | `npm run lint`, `npm run format:check`, `git diff --check`                                   | PASS                                                                                                                                 | console                                                           |
| VRM unit tests              | `node --test tests/vrm.test.mjs`                                                             | PASS, 11 tests                                                                                                                       | console                                                           |
| VRM draw, WebGL             | `npm run verify:vrm` (new)                                                                   | PASS, 0 failures                                                                                                                     | `$VRM_OUT` (default `/tmp/zhuda-vrm`): `report.json`, 17 pictures |
| VRM draw, WebGPU            | `VRM_RENDERER=webgpu npm run verify:vrm`                                                     | UNAVAILABLE: no WebGPU device in this container                                                                                      | —                                                                 |
| Spring bones, WebGL         | `npm run verify:spring-bones`                                                                | PASS (per-bone settings changed the solver)                                                                                          | `/tmp/zhuda-spring-bones/evidence`                                |
| glTF intake, WebGL          | `npm run verify:gltf-intake`                                                                 | PASS (the model library's new indices and VRM read on every load)                                                                    | console                                                           |
| Toon, WebGL                 | `npm run verify:stylized-shading` with its 1280 by 720 timing step left out (a scratch copy) | PASS for every picture assertion (bands, five bands, soft edge, highlight, rim, both off, outline); the timing step UNAVAILABLE here | console                                                           |
| Real device                 | —                                                                                            | UNAVAILABLE: no phone and no GPU in this container                                                                                   | —                                                                 |

## What the checks measured

**Unit tests** (`tests/vrm.test.mjs`, no browser):

- The generated avatar is read whole, frozen: meta with the specification's
  defaults where silent, 19 humanoid bones, six expressions (five presets and
  a binary custom one) with their binds, gaze ranges, the spring's four
  joints and the head's collider, two MToon materials, three constraints.
- Refusals by name: a VRM 0.x file (`VRM0_UNSUPPORTED` at
  `$.extensions.VRM`), a `specVersion` other than 1.0, a missing required
  bone, a node given to two bones, a bone index out of range, `meta` without
  `licenseUrl`. Warnings that drop one part with its path: a morph bind past
  the mesh's targets, a custom expression with a preset's name, an unknown
  preset, a spring of one joint, a `dragForce` out of range (the default is
  used), a collider without a shape (and the group member that named it), a
  loop of constraints (both left out), a constraint with two kinds, gaze by
  bone without eyes.
- Expression arithmetic against the specification's examples: blend lowers
  blink by the overrider's weight, block takes the mouth to 0, two blends
  stop at 0, weights clamp, a binary overrider acts on its output (0.5 does
  nothing, 0.51 blocks), a lowered binary expression shows nothing, an
  expression's override of its own kind is not counted.
- Gaze: yaw 45° for a point ahead and to the left, pitch 45° below, range
  maps (and the specification's rule for a range of 0), each eye's inner and
  outer range, the four gaze expressions, the turn's axes.
- Springs: `stiffness` 1 on a 0.1 m bone is 10 a second, `dragForce` 0.4 is
  −60 ln 0.6, `gravityPower` 0.05 is 6 m/s²; a bone held level under
  `gravityPower` 0.25 rests within a degree of VRM's tan θ = g / s (14.3°).
  Per-bone settings equal to the chain's run bit for bit as the chain's;
  wrong ones are refused with their index.
- Constraints: rotation copies 30° (15° at weight 0.5) and nothing from a
  source still at a turned rest; roll copies a 40° twist (20° at 0.5) and
  none of a swing; aim turns +Z to the source, also under a turned parent.
- MToon to toon: every plan is a valid toon spec; edge 0.5, softness
  1 − toony; the flat shade colour and the tint (shade ÷ base) of a shade
  texture that is the base texture; the rim's half-strength width; world and
  screen outlines (0.004 of 720 pixels is 2.88); cut-out, blend with depth
  write, queue offset, two sides; matcap and UV animation listed as not
  drawn.

**Draw** (`npm run verify:vrm`, WebGL, SwiftShader): the avatar is made by
`tests/fixtures/vrm-avatar.mjs` (307 KB GLB, written at run time, nothing
committed), loaded through `ZhudaModelLibrary` from `avatar.vrm`, a sun from
the model's left.

| What                                | Measured                                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load                                | toon materials for MToon 0 and 1 in every slot; one spring set; bones by name; one issue (first person not applied)                                                                                       |
| Toon against LayaAir's glTF picture | 49,280 pixels differ                                                                                                                                                                                      |
| Shade colour                        | lit skin `255, 227, 210`, shaded `206, 142, 137` (red against green 1.45 against 1.12); glTF PBR shaded `78, 67, 68` keeps its hue                                                                        |
| Outline                             | 5,440 pixels change when its width goes to 0                                                                                                                                                              |
| `blink`                             | morph weight 1; the pupils' dark pixels 722 to 0; 2,952 pixels change                                                                                                                                     |
| `aa`                                | the mouth's dark pixels 0 to 667                                                                                                                                                                          |
| `happy` with `blink` 1              | blink applied 0 (block), the eyes stay open, `aa` 0.4, the skin's green 227 to 184 (its colour bind on MToon)                                                                                             |
| `angry`                             | 79 red pupil pixels (a colour bind on a plain glTF material, on a copy of its own); `aa` blended to 0                                                                                                     |
| `wink` (binary, 0.8 of blink)       | 0.4 gives 0, 0.6 gives a blink weight of 0.8 and closed lids                                                                                                                                              |
| `surprised`                         | the hair's tiling and offset `1, 1, 0.25, 0`                                                                                                                                                              |
| All off                             | 0 pixels from the first picture                                                                                                                                                                           |
| Gaze by angles (30°)                | left eye 4.000°, right 3.333° (outer 12°, inner 10° at 90°)                                                                                                                                               |
| Gaze at a point                     | yaw 26.565° for atan2(0.5, 1), pitch 0; at 90° the pupils move 2.5 and 1.3 pixels to the picture's right                                                                                                  |
| Rotation constraint                 | the badge turns 30.000° with the head; 0 back at rest                                                                                                                                                     |
| Roll constraint                     | the twist turns 20.000° for the hand's 40° roll (weight 0.5)                                                                                                                                              |
| Aim constraint                      | the pointer's +Z against the way to the hand: 1.0000                                                                                                                                                      |
| Spring bones                        | the tail lags 0.132 m behind a head swaying 0.15 m; no joint inside the head's collider in 480 frames; still after 6 s (energy 0) and back where it hung; the same deltas replay the same tail to the bit |
| Thirty made and let go              | every toon material destroyed, one model instance left (the main one), its toon materials kept                                                                                                            |
| `dispose`                           | the glTF materials back in their slots, the toon material destroyed, the picture that of the glTF model again                                                                                             |

## Defects found on the way

- `ZhudaToonMaterial` copied its spec through `JSON.stringify`: a real
  LayaAir texture in `material.textures` (as `docs/stylized-shading.md`'s
  example has it) threw "Converting circular structure to JSON". The numbers
  are copied and the textures kept as they are.

## Neighbours

- `verify:spring-bones` (WebGL): PASS, the same numbers as its record
  (0.0352 m from the skin, 0.3308 m swing, back within 0.00012 m).
- `verify:gltf-intake` (WebGL): PASS; thirty load-and-release cycles leave
  the resource count where it started (22 before and after).

## Limits and decision

- **No phone and no GPU**: every draw is SwiftShader in a container. No
  frame time was measured; a toon material with a shade colour costs one
  more uniform branch a light, not timed.
- **No WebGPU run** of the VRM check or the toon change: unavailable here.
- **No third-party VRM file** was loaded: the avatar is made by the test.
  Files from VRoid Studio, UniVRM or the Blender add-on (many materials,
  thousands of morph targets, springs with many joints, colliders on scaled
  nodes, KHR_texture_transform, alpha-blended hair) are not checked.
- Spring motion is not UniVRM's frame for frame (it is frame-rate
  independent); `center` is not used; a collider's node scale is not used.
- MToon: matcap, the shading shift texture, rim and outline width textures,
  rim and outline lighting mix and UV animation are not drawn; the shade's
  boundary is a smoothstep where MToon's is linear.
- Texture transform binds were read back as numbers, not compared against a
  picture's shift; LayaAir's V direction for `tilingOffset` was not checked.
- First-person annotations are read and not applied.

Decision: **Implemented within scope** on desktop WebGL (software). Not
Accepted: no device, no WebGPU and no third-party avatar.
