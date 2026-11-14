# Agent task: lighting-depth

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP13): three.js lights fall off with the square of the distance (candela at
a metre), a spot light has a `penumbra`, shadows have a `radius` and a
cascade blend (`CSM` with `fade`), and point-light shadows are redrawn only
when asked. LayaAir 3.4.2's lamps are as bright at their middle whatever
their range, a spot is soft over a fixed half of its cone, the sun's soft
shadow has one width, cascades meet at a visible line, and nothing shades
what the shadow map is too coarse to see (the foot of a post, a leaf on the
ground). WP13 asks for these, drawn on both backends, with the cost of
contact shadows on a phone.

## Goal

A lamp post whose light at one, two and four metres is what the square of
the distance says; a spot whose rim is as soft as asked; a sun shadow as
wide as asked, with no line where two cascades meet and with the last
centimetres under a thin thing shaded; and eight lamps whose shadows are
kept up to date at the cost of one a frame.

## Invariants

- LayaAir 3.4.2 vendor files are not modified: the lighting and shadow
  includes are changed as text before `Laya.init`, as point shadows are.
- Every change compiles to LayaAir's own code unless a scene switches its
  define on. A scene that asks for nothing draws as before, bit for bit.
- No uniform is added to the scene's block (its layout would move) and no
  texture to the scene (WebGPU has 16 samplers a stage): values travel in
  the two unused numbers of `u_ShadowParams` and in the unused fourth texel
  of a light's row in the light buffer.
- The redraw schedule has no clock and draws nothing itself: the caller
  says when a frame is and what moved.
- Each owner of a scene define or value has a disposal path that puts the
  scene back.

## Dependencies

- `installLaya342PointShadows` (the same interception of `Shader3D.addInclude`),
  `ZhudaPointShadow`, the film look's `shadows`, `ZhudaSceneLook`.
- LayaAir 3.4.2: `Lighting.glsl`, `ShadowSampler.glsl`, `Camera.glsl`,
  `Scene3D._prepareSceneToRender` and its light buffer, `ShadowCasterPass`.

## Scope

### Engine

- `packages/core/runtime3d/LightingDepth.ts` (new): the patch, the scene
  switches (`ZhudaLightingDepth`), the spot penumbra, the arithmetic of the
  falloff on the CPU.
- `packages/core/runtime3d/PointShadowSchedule.ts` (new): which lamps to
  draw this frame.
- The film look: `shadows.spread`, `shadows.blend`, `shadows.contact`,
  `lightFalloff`; a spot light's `penumbra`; a light's `intensity` up to
  2000 with the square; quality levels.
- `Camera.glsl`: the depth picture's sampler is declared at high precision
  for every shader that includes it (LayaAir's own materials as well).
- `tests/lighting-depth.test.mjs`, `tests/fixtures/lighting-depth.ts`,
  `scripts/verify-lighting-depth.mjs`, `npm run verify:lighting-depth`.
- `docs/lighting-depth.md`.

### Consumer or adapter

A game says which of its lamps moved and how bright each is at a metre.

## Non-goals

- A rectangular area light, a spot-shadow atlas for more than one spot,
  light cookies (the plan's "later").
- Photometric units with an exposure in EV: a light's `intensity` stays a
  multiple of white, here at one metre.
- Contact shadows for lamps; only the sun's light is shaded.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:lighting-depth` on WebGL and with `LIGHTING_RENDERER=webgpu`.
3. The existing draws of lights and shadows still pass on both backends.
4. Contact shadows' cost on a phone.

## Unverified limits

See the verification record.
