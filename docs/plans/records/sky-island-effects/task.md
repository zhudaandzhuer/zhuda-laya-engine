# Task: what a floating-island toy needed from the engine

Status: Implemented within scope; desktop WebGL and WebGPU drawn in the consumer
Owner: engine
Last reviewed: 2026-11-16

## Source requirement

The user (2026-11-16) showed a three.js toy someone made with GPT ("Grass
Paint": a small floating island with a windmill cottage, a pond, a tree,
dense grass, rain) and asked for the same kind of scene on this engine, with
Zhuda (the pig) as the character, who can be picked up and shows it, and
"as many effects as possible, the scene is small". The consumer is
`games/zhuda-sky-island` (outside this repository). Building it found three
things the engine could not do; each is fixed here rather than worked round
in the game.

## Goal

1. Grass that a body presses down: the pig's feet part the blades, and a hard
   landing flattens a ring for a moment.
2. A layer of cloud below the eye: the sea of cloud under a floating island.
3. A look's light fog that can be kept near the scene, so that far things (that
   sea, stars, rain in front of the sky) are not fogged away.

## Design

- `ZhudaGrassField.setBenders([{ position, radius }])`, at most
  `ZHUDA_GRASS_MAX_BENDERS` (4): four `vec4` uniforms read by the vertex hook
  (`zhudaGrassBend`, a GLSL helper before `zhudaVertex`). Within a third of the
  radius the blades lie almost flat away from the body; the push fades to the
  radius and as the body rises 0.15..0.7 m above the blade's foot. The foot never
  moves. `zhudaGrassBend` (TypeScript) is the same arithmetic;
  `validateZhudaGrassBenders` names each wrong field.
- `ZhudaClouds` / `look.clouds.baseMeters`: -20000..20000 (was 50..20000). The
  ray-slab span was already symmetric in the ray's height; only the check
  forbade it. Below the eye the slab is entered from its top.
- `look.lightFog.maxDistance` (1..100000, default 600): passed through to
  `ZhudaLightFog`, which already had it. The fog is laid by each pixel's depth;
  particles have none of their own, so in front of the sky they took the sky's
  full fog.

## Invariants

- Defaults draw what they drew: no benders (all four radii 0), cloud bases
  above 50 m unchanged, `maxDistance` 600 as before.
- No new pass, texture or allocation per frame for the grass.

## Non-goals

- Grass pushed by every mesh in the scene (a game names up to four bodies).
- Rain as an engine feature (the consumer draws it with the engine's 3D particles).
- Fixing the light fog for particles in general (they still take the fog of what
  lies behind them; `maxDistance` bounds it).

## Acceptance checks

1. `node --test tests/grass.test.mjs tests/clouds-and-finishes.test.mjs tests/film-scene.test.mjs tests/light-fog.test.mjs tests/quality-route.test.mjs` pass.
2. `npm run verify` passes.
3. In the consumer (`games/zhuda-sky-island`, built with
   `ZHUDA_ENGINE_ROOT=<this worktree>`), headless Chrome on WebGPU and WebGL:
   the pig's footprint in the grass, a cloud sea below the island seen from a
   low camera, stars at night and rain streaks in rain (evidence in that
   project's `evidence/`).

## Unverified limits

- No phone has drawn any of the three.
- Frame cost not measured; the cloud sea costs what a cloud layer costs.
