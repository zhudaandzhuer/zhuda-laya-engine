# Route: A survivors-like with hundreds of enemies

The hero attacks by itself, enemies pour in, experience gems give a choice of three upgrades, weapons evolve, a run lasts five minutes. Everything on the field is one sprite redrawn each frame from one atlas.

- **Id:** `survivors-2d`
- **Kind:** workflow
- **For:** building a 2D game with hundreds of moving things on screen at a steady draw count
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** five weapons and eight enemy kinds built on 2026-11-25; 400+ enemies in 3 draw calls; a bot wins about half its runs (23 of 40 seeds on one machine; a seed is not the same run on another); one batching problem left unsolved (draft)
- **Reference consumer:** this repository, `games/zhuda-swarm`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

Many small things, simple collisions, no per-object UI. The drawing method here (step 3) is the
point; use it for bullets, crowds and particles of any 2D game.

## Tools

- Engine 2D; `Laya.Texture.createFromTexture` for atlas frames; `graphics.drawTexture`;
  `ZhudaRuntimeProfiler` for draw calls; `tools/make-atlas.py`; `tools/draws.mjs`.

## Steps

1. Rules at a fixed step in plain arrays; a uniform grid for "who is near": no engine physics.
2. One atlas for everything on the field.
3. **One sprite; clear its graphics and `drawTexture` every thing, every frame**, sorted by layer.
   Do not make a sprite per enemy.
4. Level-up pauses `world` (`setPaused`) and shows three choices on the `ui` layer.
5. Spawn by a budget over time, not by a list; cap the live count.
6. Tune with two bots: one that kites (should win 4–7 of 8 runs), one that stands still (should
   live past 45 s and die before 150 s).
7. Measure draw calls in a recorded run at the busiest minute, and again after any change to effects.

## Pitfalls

- **After `level-up`, `confetti` or `explosion` effects ran, the scene went from 3 draws to 60–90
  and stayed there.** An isolated project with the same effects stays at 1–3; the cause is not
  found (open; listed in `HANDOFF.md`). The game maps
  those to `sparkle` and `hit-spark`. Re-measure if you use any other preset.
- Text drawn per enemy (damage numbers) breaks batching: pool a few, or draw digits from the atlas.

## Engine gaps and their workarounds

- No sprite-batch or particle-field helper: step 3 is the workaround.
- The batching drop above.

## Checks

- Draw calls with 400+ enemies: 3. Bot win rate inside the band. Standing-still survival inside its band.

## Not checked

- Frame time on any device: SwiftShader cannot say whether 400 `drawTexture` calls fit a phone's CPU.

## Boundaries

One arena, one hero, no meta-progression, no bosses with patterns.
