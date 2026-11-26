# Route: A 3D tower defence on a path

Enemies walk a fixed path through a film-scene landscape, towers on fixed pads shoot them, waves grow, towers upgrade; ×2 speed; pads and health bars are DOM markers over the 3D view.

- **Id:** `tower-defence-3d`
- **Kind:** workflow
- **For:** building a top-down-ish 3D game where many pooled models move along a path and the HUD is tied to world positions
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** twelve waves, three towers × three levels, four enemy kinds built on 2026-11-25; a planned build wins and each single-tower build loses; the bot's twelve waves and a run with real clicks recorded against this repository's engine (draft)
- **Reference consumer:** this repository, `games/zhuda-guard`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

A fixed camera over a 3D place, things moving on known lines, interaction by tapping marked spots.

## Tools

- Film scene data (`terrain` / `extrude` / `box` / `light`), `loadZhudaFilmScene`,
  `ZhudaModelLibrary.instantiate` (pooled), `Zhuda3D.createPrimitiveMesh` / `createMaterial` for
  towers and shots, the runtime's `world` layer time, `ZhudaRuntimeProfiler`.

## Steps

1. Path = list of `[x, z]` points; an enemy is a distance along it. Pads are fixed points.
   Towers pick the enemy furthest along within range. All of it in `src/core/td.ts`.
2. Give at least one enemy a trait that one tower answers (armour that only fire gets through),
   so a single-tower build loses.
3. `tools/balance.ts`: a staged plan must win; each mono-tower plan must lose. Run it on every
   number change.
4. Scene: ground and road from data. The road is an `extrude` whose outline is `[x, z]` pairs.
5. Pool enemy models: instantiate a handful per kind once, show and hide.
6. Markers: each frame, `stage.worldToScreen(point, { width, height })` for each pad and each
   enemy's head, and place DOM elements there.
   Camera here: eye `[0, 47, −45]`, target `[0, 0, 0]`, focal 28.
7. ×2 multiplies the `world` layer's delta before the rules step (more fixed steps per frame);
   build and upgrade menus are DOM and do not depend on it.

## Pitfalls

- **Mirrored twice here**: the road outline written as `[x, −z]`, and markers projected by hand
  with `0.5 − sx * 0.5`. Looking along +Z, +X is screen-left. Use `stage.worldToScreen`, and check
  one known corner by eye before anything else.
- Grass on this 72 × 42 m field: 45 draws without, 525 with. It is off unless `?grass=1`.
- A last wave that is "more of everything" is unreadable; one boss with escorts balanced better.

## Engine gaps and their workarounds

- Grass over a whole field is not affordable; the film lint's `grass.draws` advice names a
  `distanceM` that keeps it under its limit, and the game leaves grass off.
- No path-follow or pool helper: plain code.

## Checks

- Balance script: plan wins, three mono builds lose. Draw calls with a full wave.
- Frames where every pad marker sits on its stone and the road runs under the enemies
  (`docs/evidence/hands.jpg`, `bot.jpg`); the bot's twelve waves end in a win.

## Not checked

- Tapping pads on a phone.

## Boundaries

Fixed pads, one map, no hero unit, no free tower placement or mazing.
