# Verification record: instanced-meshes

Task document: `docs/plans/records/instanced-meshes/task.md`\
Commit: the commit that adds this file, on top of `c7d2248`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Adreno 720, Chrome, WebGL 2, driven through its Chrome debugging port.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `c7d2248`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300 for the pictures, 1280
  by 720 (desktop) and 823 by 1749 (phone) for the timings; loopback (the
  phone through `adb reverse`).
- Evidence (outside the repository): `batch2-evidence/instanced-meshes/` in
  the session's notes folder: the three reports, their pictures and logs.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 674 of 674 (9 in `tests/instanced-mesh.test.mjs`) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| Instanced meshes and crowds, WebGL | `npm run verify:instanced-mesh` | PASS |
| Instanced meshes and crowds, WebGPU | `INSTANCED_RENDERER=webgpu npm run verify:instanced-mesh` | PASS |
| The same page and its timing page, phone | served to the phone | drawn and measured (below); no assertion script on the phone |
| Draws that use the lit template, model placements, film scenes, skinned models, WebGL | stylized-shading, grass, live-look, prefab-models, film-variation, film-model, film-scene, film-animation, shadow-updates, shader-warm-up, gltf-intake, physical-surfaces, webgpu, crowd-browser, model-showcase | PASS, 15 of 15 |
| On WebGPU | stylized-shading, grass, live-look, shadow-updates, shader-warm-up, gltf-intake, physical-surfaces, render-scale, webgpu-consumer with the WebGPU switches; `verify:film-webgpu` (20 film checks) | PASS, 9 of 9 and 20 of 20 |

## What is drawn

Nothing is checked in. The check makes a ball, a prop of two meshes each
placed inside its model (`tests/helpers/prop-fixture.mjs`), a lighter
version of it, and a capsule on a chain of 12 and of 30 bones with two
clips (`tests/helpers/toon-fixture.mjs`).

## Results

The same on desktop WebGL, desktop WebGPU and the phone unless given.

- **Five thousand copies in groups are the picture of the same copies as
  nodes.** Balls on a grid, each turned and sized differently, a shadowed
  sun: 24 groups; against the nodes the frame differs by nothing on WebGL
  and on the phone, and by at most 1 of 255 in a pixel on WebGPU. Without
  `castShadow` the picture changes and no group is drawn into the shadow
  map; disposed, the scene is as it was.
- **Draws a frame, as LayaAir counts them** (scene, shadow maps): the groups
  47 and 24; the eye turned away 0 and 0. The same copies as nodes: 10 and 5
  on WebGL (LayaAir batches them itself), 9,024 and 5,000 on WebGPU (each
  casts a shadow and is drawn by itself, see below).
- **Under a holder** moved, turned and scaled the copies are where nodes
  under it are: no difference.
- **A tint for each copy** on a toon material lit by a flat ambient light
  only: `[126, 27, 27]`, `[27, 126, 27]`, `[39, 39, 126]` for tints of
  (1, 0.2, 0.2), (0.2, 1, 0.2), (0.3, 0.3, 1), each within 1 of the colour
  worked out from the tint; the same material without tints is untouched.
  Tints with a stock material are refused.
- **A model prefab of two meshes, 600 placements**, `instanced: true`: no
  difference from the same prefab as nodes (WebGPU: mean 0). With a lighter
  version from 30 m and nothing beyond 55 m, for an eye to one side: as
  nodes 186 copies full, 348 light, 66 not drawn; in groups of 8 m 8 groups
  full, 12 light, 4 not drawn, and the picture is 2.1 of 255 from the
  node-by-node one on average. A model with bones is refused.
- **A baked character is LayaAir's own skinning at a whole frame.** One
  copy against the same model posed by LayaAir's animation at the same
  time, for the bend at 0, 0.5 and 0.9 s and the sway at 0.3 s: no
  difference, on 12 bones and on 30 (which LayaAir cuts into two pieces with
  their own bone numbers), on WebGL, WebGPU and the phone. Baking two clips
  of a second at 30 frames took 1 to 2 ms on the desktop and 4 to 5 ms on
  the phone; the texture is 64 KB for 12 bones and 256 KB for 30.
- **Five hundred of them**, each at its own point of one of two clips: 16
  groups, 33 and 16 draws a frame; told the same time again no copy
  changes, a frame later 417 do, and telling them takes 0.02 to 0.04 ms;
  the same time gives the same picture; a copy given another clip changes
  alone; the crowd casts shadows.
- **Nine nodes of one mesh and one material each cast a shadow**: 43 in each
  shadow against 193 on the lit floor, on WebGPU as on WebGL.
- **Left behind**: nothing.

### Timings

Median of 40 frames, each drawn to the end. The phone is the measurement;
the desktop numbers are close to what its timer tells apart.

| Scene | Phone, 823 by 1749 (runs) | Desktop WebGL, 1280 by 720 |
| --- | --- | --- |
| floor only | 7.2, 6.8, 10.1 ms | 2.1 to 3.5 ms |
| 5,000 balls as nodes | 33.0, 36.2, 32.6 | 4.9 to 7.3 |
| the same in 24 groups | 17.3, 21.8, 17.8 | 3.1 to 4.0 |
| the groups, eye turned away | 13.4, 9.2, 4.9 | 1.3 to 1.7 |
| 300 characters with a skeleton each | 29.4 | 5.3 |
| the same, baked | 16.3 | 4.2 |

## Found on the way

- **LayaAir's instanced draw command is not a base to build on.** The
  plan named `CommandBuffer.drawMeshInstance`. Tried first: on WebGL it
  drew nothing in the forward pass, on WebGPU it failed validation (the
  target bound as a texture while drawn to). An ordinary renderer whose
  geometry carries the instance buffer goes through every pass as it is.
  On WebGPU that renderer must be set up before it joins the scene, and
  its buffers must hold the lightmap attribute the instanced shader names
  whether or not it is used.
- **On WebGPU LayaAir's batches cast no shadow.** Two or more renderers of
  one mesh and one material are drawn as a batch that is never drawn into
  a shadow map, with the eye still or moving; one renderer alone casts.
  This held for every scene with repeated props on WebGPU. Renderers that
  cast a shadow are now kept out of the batches. The price is a draw a
  renderer: the 5,000 balls as nodes are 14,000 draws a frame there.
- **A node destroyed is not let go of until the next frame.** A crowd
  disposed just before its model was kept a mesh and a material of the
  model alive for good. Group nodes are now destroyed at once.
- **A directive after a brace on the same line is not a directive.** The
  tint's `#ifdef`, placed after the template's closing brace, broke every
  lit-template shader until it began on a line of its own; the draw check
  caught it by collecting compile messages.
- **Seven consumer checks unpacked the engine over what an older run had
  left.** A file an older package shipped (`zhuda-audio.ts`) shadowed the
  declaration the present package ships and failed the strict typecheck of
  `verify:model-showcase` and `verify:webgpu-consumer`. They unpack into a
  clean directory now.

## Deviations and unverified limits

- No build-time baker (the plan's wording): the bake runs at load from the
  model as LayaAir animates it. A model whose clips are long or many is
  baked each time it is loaded; nothing caches the texture.
- One desktop GPU and one phone; no iPhone, no WebGPU on a phone.
- The check's character is a capsule on a chain of bones, one skinned mesh,
  one sub-mesh. A model with several skinned meshes is laid out for
  (`bases`) but was not drawn; an authored character was not baked.
- A crowd's box is its joints' through all clips widened by a quarter of
  the bound mesh: a clip that throws the flesh further is culled early.
- The instanced mode of a film scene was checked as a description only
  (`validateZhudaFilmScene`); the prefab route, which shares the mount, was
  drawn.
- Tints were drawn on the toon material only, not on a physically based
  lit-template material, and not with fog or shadows.
- On WebGL the groups make more draws than LayaAir's own batches (47
  against 10 for 5,000 copies) and still take half the frame on the phone;
  a scene of a few dozen copies was not timed and may not gain.
- The WebGPU cost of keeping shadow casters out of the batches was counted
  in draws, not timed, and no game was run with it.
