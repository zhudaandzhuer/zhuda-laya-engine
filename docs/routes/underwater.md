# Route: a scene under water

A film or a game whose camera is in water: a sea floor with a wreck and rocks,
the view fading blue-green with distance, caustics on the floor, sunbeams through
the water, the surface seen from below with the sky in its window. Driven by data
(a film scene, or a game's `ZhudaSceneLook`); the camera is the scene's or the
game's. Checked by drawing on a desktop with WebGL and WebGPU only.

- **Status:** checked on desktop WebGL and WebGPU (Apple M4, Chrome 157 headless),
  2026-11-17; not on a phone.
- **Reference consumer:** the engine's own example scene,
  [`tests/fixtures/film/underwater.json`](../../tests/fixtures/film/underwater.json),
  and its fly-through,
  [`tests/fixtures/flythrough/underwater.json`](../../tests/fixtures/flythrough/underwater.json).
  No consumer game has been built on it yet.
- **Engine version:** 1.18.0, `claude/fervent-lovelace-44d9db` at the commit that
  adds this route (on top of `3a594cb`).

## When to take this route

A camera that stays in (or dives into) a body of water whose floor and contents you
build: a sea, a lake bed, a flooded room, a cave pool. The water is a medium the view
passes through and a surface seen from below.

Not this route: a river or a pond seen from above (use `type: "water"` nodes,
[film scenes](../film-scenes.md#nature-many-copies-leaves-and-running-water)); a
camera that crosses the surface often and must see both sides at once (the surface
from above is not matched to the one from below); caves seen from inside as
rock (authored meshes, or [isosurfaces](../procedural-assets.md#shapes-as-distances-and-a-hand)).

## Tools

None outside the engine. The example is procedural: starter props and boxes with
recipe materials.

## Steps

1. **A look with a grade and `underwater`.** `look.underwater` needs `grade`
   (the water is part of the HDR chain). Start from the example: `surfaceY: 7`,
   `extinction: [0.42, 0.11, 0.075]` (red goes first), `caustics: { strength: 1.2,
   waveMeters: 2.5 }`. Check: `npm run verify:film-underwater` style, a preview
   under water is blue-green, and `measureZhudaFrame` raises no flag
   ([film scenes, Under water](../film-scenes.md#under-water)).
2. **A floor the caustics can land on.** Lit PBR surfaces below `surfaceY`
   (ground, boxes, props) take the caustics and the sun dimmed by the water; put
   the floor 4 to 10 m down, where the waves focus light into lines. Check: the
   floor shows a moving net (two previews at different `time` differ).
3. **Sunbeams.** `lightFog` with `shafts` (the example: density 0.03, falloff 20,
   shafts strength 1.6 over 40 m). The surface seen from below is left out of the
   beams' depth picture, so it does not shade them; the water then dims and tints
   them. Check: beams fan down from the surface in a view across the floor.
4. **The surface from below.** On by default (`surface`). Look up: the sky and the
   sun inside the window, the water's own colour beyond 48.6° from overhead. Check:
   a pose pitched up shows both.
5. **Time.** A film's shot time moves the waves (stills, videos and previews at a
   `time`). A game's `ZhudaSceneLook.update(eye, target, fov, aspect,
   frameSeconds)` moves them with the frame time it is given.
6. **Cost.** Run the fly-through with your budget, with and without water:
   `npm run verify:flythrough -- your.flythrough.json` on each backend
   ([fly-through](../flythrough.md)).

## Pitfalls

- **Red is gone near the floor.** At the default extinction (0.45 a metre, about
  clear ocean) the sunlight reaching a floor 7 m down has lost almost all its red,
  and the view loses the rest within a few metres: the near floor reads 0 in red.
  That is the medium, not a bug. For warmer water, lower the red extinction
  (0.2 to 0.3).
- **Caustics that do not move in a still.** The waves follow shot time; LayaAir's
  own `u_Time` in a capture is only the time inside a frame's samples. A still at
  one `time` shows one pattern; give a different `time` for another.
- **A look at level 0 has no water.** The medium needs the HDR chain, which level 0
  drops; level 1 drops only the caustics. A phone that falls to level 0 shows the
  scene dry: give that level a `fog` of the water's colour as a stand-in.
- **Looking up, the window is most of the frame.** With a wide lens pointed
  straight up almost everything is inside 48.6°: the edge of the window shows only
  when the camera is pitched about 50° up.

## Engine gaps and their workarounds

| Gap | Workaround | Plan |
| --- | --- | --- |
| No surface seen from above that matches the one from below | Keep the camera on one side of the surface, or cut when it crosses | none yet |
| Lamps under water are not dimmed on their way to a surface (only the sun is) | Lower a lamp's intensity or range by hand | none yet |
| No water at look level 0 | A `fog` of the water's colour at that level | none yet |

## Checks

- `npm run verify:film-underwater` (and with `ZHUDA_FILM_RENDERER=webgpu`): the view
  dimmed per channel and bluer far off, caustics with spread and motion, the window
  brighter than the reflected surface, nothing changed above the surface, no WebGL
  error. Both pass (record `docs/plans/records/underwater-look/`).
- `npm run verify:flythrough -- tests/fixtures/flythrough/underwater.json` (6 s, 180
  frames, 960 by 540; GPU time per frame, two runs each):

  | Backend | With water: GPU average, p99 | Same scene without water |
  | --- | --- | --- |
  | WebGL (timer query) | 6.76 to 6.85 ms, 10.4 to 10.9 ms | 6.61 to 6.72 ms, 9.3 ms |
  | WebGPU (timestamps) | 4.15 to 4.16 ms, 5.2 to 5.4 ms | 4.06 ms, 5.0 to 5.2 ms |

  The water costs about 0.1 to 0.2 ms a frame on this desktop. CPU time under
  1.1 ms on both. Evidence:
  `/Users/yaowei/Documents/ZhudaGameCenter/audits/underwater-route-2026-11-17/`.

## Not checked

- Any phone; the cost of the caustics on a phone GPU.
- A game built on `ZhudaSceneLook` with water (it shares the film stage's code,
  which is drawn).
- `ZhudaLitSurface` materials under water.
- A blind critic's review of the example (the fly-through writes its brief; none
  was run).

## Boundaries

The engine draws the water: the medium, the light under it and the surface from
below. Swimming, breath, buoyancy, currents that push the player, and what the game
does when the camera crosses the surface are the consumer's.
