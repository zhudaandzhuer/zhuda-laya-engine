# Agent task: ready 2D effects and a 2D route

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-22

## Source requirement

The handoff of 2026-11-23 (`HANDOFF.md`, "Current priorities", item 1, in the
owner's order): "A dedicated 2D workflow route and ready 2D effect presets. The
route index already directs a new 2D game or UI through `new-game-project` and
`visual-content-prefab` ... it does not yet have a dedicated end-to-end 2D
workflow. The 2D effects system has descriptors and renderers, but no ready
presets." The owner answered the review of that handoff on 2026-11-22 with
"全部開始做" (start all of it).

## Goal

An agent building a 2D game takes one route for the whole game and places a
ready 2D effect by name, as it already can in 3D.

## Change

- **Twenty 2D effects as data** (`packages/core/effects/EffectPresets2D.ts`,
  `ZHUDA_EFFECT_PRESETS_2D`, `ZHUDA_EFFECT_PRESET_IDS_2D`,
  `validateZhudaEffectPreset2D`): bursts coin-burst, level-up, hit-spark,
  explosion, smoke-puff, confetti, landing-dust, click-ripple; loops sparkle,
  torch, campfire, magic-aura, heal, rain, snow, falling-leaves, petals,
  bubbles, embers, sparkle-trail. Each is a `ParticleEffectSpec` in pixels and
  seconds on canvas axes with a kind, `sizePixels`, `origin` and `seconds`, on
  the eleven built-in sprites (`EffectSprites.ts`, no file shipped).
- **A player** (`Effect2D.ts`, `ZhudaEffect2D`): one Sprite under the parent
  and one per emitter in the preset's order; the sprites baked once as
  premultiplied sRGB 2D textures; `update`, `seek` (120 Hz from the start),
  `restart`, `stop`, `setPosition`, `render(opacity)`, `dispose`;
  `scaleZhudaEffect2D`. It runs on `ZhudaParticleSystem` and
  `ZhudaLayaParticleRenderer` as they are.
- **A draw check** `npm run verify:effects-2d` (`scripts/verify-effects-2d.mjs`,
  `tests/fixtures/effects-2d.ts`) on the `2d` browser profile, WebGL.
- **A route** `docs/routes/game-2d.md` (workflow): scaffold, layout, time,
  input, prefabs, Spine, tile maps, effects, audio, build and claim; listed in
  the route index, `README.md`, `AGENTS.md` and the scaffold's agent text.
- Guides: `packages/core/effects/README.md` ("Ready effects (2D)") and
  `packages/core/particles/README.md` (presets are no longer only the
  application's; the first real draw of the 2D renderer).

## Invariants

- No second particle system, no new texture loader, nothing binary added.
- Time is given by the caller (`update`) or asked for (`seek`); no timer.
- An effect owns its sprites and textures and releases them in `dispose`; the
  parent is never destroyed; a failed construction releases what it made.
- The existing 2D renderer, descriptor validation and 3D presets are unchanged.

## Dependencies

- `ZhudaParticleSystem`, `ZhudaLayaParticleRenderer`, `validateParticleEffect`
  (packages/core/particles), `bakeZhudaEffectSprite` (packages/core/effects).
- LayaAir 3.4.2 `Texture2D` and `Texture` (core), 2D `Graphics.drawTriangles`.

## Scope

### Engine

- `packages/core/effects/` (two new files, README), `packages/core/index.ts`,
  `packages/types/` (generated and index), `packages/core/particles/README.md`,
  `tests/`, `scripts/verify-effects-2d.mjs`, `package.json`, `docs/routes/`,
  `README.md`, `AGENTS.md`, `packages/compiler/zhuda-init.mjs` (text only).

### Consumer or adapter

- None changed. A game uses the public exports; its own effects, pictures and
  devices stay in its repository.

## Non-goals

- WebGPU (`2d-webgpu`) draws, phones, frame-rate measurements.
- Lit 2D particles, flipbooks, collisions with tiles, a 2D effect editor.
- A 2D game built along the whole route (each step is checked on its own).
- An MCP tool for the presets: the 3D presets have none outside the film
  scene's `effect` node, and the 2D ones are read from the public exports.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `node --test tests/effect-presets-2d.test.mjs`: every preset valid, on
   built-in sprites, at most 1,000 particles, none dropped over its seconds plus
   six, bursts over by their seconds, loops alive then, deterministic, scaled;
   the player's ownership, order, seek and refusals.
3. `npm run build` then `npm run verify:effects-2d` on WebGL: every preset
   drawn, the same bytes at the same time, loops moving, bursts gone, the trail,
   the alpha probe, thirty cycles with no resource left.
4. Neighbour: `RIBBON_RENDERERS=webgl npm run verify:ribbon-growth`.
5. Route audit and MCP: `tests/implementation-routes.test.mjs` (in `npm test`).

## Evidence to attach

- Test/build output: the commands above, in [verification](verification.md).
- Browser/WebGL report: `report.json`, `sheet.png` and the screenshots in the
  evidence folder named there (outside the repository).
- Resource/lifecycle report: the thirty-cycle numbers in the verification.

## Unverified limits

See the [verification](verification.md).

## Rollback

`27c41b5` is the last commit without these. The presets and player, the draw
check and the route are additive; reverting the commit removes them with no
other behaviour changed.
