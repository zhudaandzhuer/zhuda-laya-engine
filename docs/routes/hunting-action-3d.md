# Route: A 3D hunting action game

One hunter against one large monster in an arena: read the wind-up, roll through, hit a part until it breaks, carve, craft. Moves are engine action frame specs, the arena is a film scene, both actors are rigged models from the engine's library.

- **Id:** `hunting-action-3d`
- **Kind:** workflow
- **For:** building third-person melee action with telegraphed monster attacks, dodge frames, part breaks and a crafting loop
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** three quests built on 2026-11-25; two kinds of bot (one that reads wind-ups, one that mashes) × three monsters × eight seeds for balance; the first quest recorded in the browser, quests 2–3 not (draft)
- **Reference consumer:** this repository, `games/zhuda-hunt`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

Real-time melee where timing windows matter and the opponent is one big animated model. Not for
crowds (see `survivors-2d`) and not for co-op: nothing here is networked.

## Tools

- `ZhudaActionStateMachine` + `validateActionFrameSpec`, `ZhudaInputBuffer`, runtime layers
  and timers (`world` paused for hit-stop), `loadZhudaFilmScene` with `ZhudaFilmAssets`,
  `ZhudaModelLibrary.instantiate`, `ZhudaModelInspector` (`play`, `crossFade`, `setAnimationSpeed`),
  `ZhudaEffect3D`, synth recipes through `IframeSoundAdapter`.
- HUD in the page's DOM (`public/index.html`), not in the 3D stage.

## Steps

1. Write every move of hunter and monster as an action frame spec (start-up, active, recovery,
   cancel windows, invulnerable frames for the roll) and validate the specs in a test.
2. Run both state machines in `src/core/` at a fixed step; positions on a flat plane; hits are
   circle/arc tests in that plane against named parts (head, tail, body) with their own health.
3. Buttons go into `ZhudaInputBuffer`; the state machine consumes them when a cancel window opens.
4. The monster picks an attack by distance and angle, shows a wind-up long enough to read, then
   commits to a direction: it does not track during the active frames.
5. Arena = film scene data (terrain or box ground, rocks, light, a little grass). Load it, then
   instantiate the two models and drive clips from the rules' state names with `crossFade`.
6. Hit-stop: `layers.setPaused('world', true)` on a heavy hit, and
   `timers.scheduleOnce(seconds, resume, { channel: 'unscaled' })` to let go; the HUD stays on `ui`.
7. Camera behind the hunter, eased; markers and health bars are DOM elements placed by projecting
   world points.
8. Balance with bots over seeds before touching the page: one that reads the wind-up, rolls and
   aims at a part; one that mashes attack.

## Pitfalls

- A test that hits a roaming monster misses when it turns: hold it in a known state in the test.
- Projection: `0.5 + sx * 0.5` across the screen (right-handed world), not `0.5 − …`.
- `grass` out to 34 m made the arena 310 draws; at `distanceM: 20` it is 202.
- Synth wave names are `sine`, `square`, `saw`, `triangle` (`sawtooth` fails validation).
- The reference game stands on a thin `extrude` slab because `ground` had no height when it was
  written; `ground` now takes `y`.

## Engine gaps and their workarounds

- The reference game projects world points by hand and sets a clip's speed from its length: it was
  written before `stage.worldToScreen` and `durationSeconds` on `play` / `crossFade`. Use those in new work.
- `lintZhudaFilmScene` reports `grass.draws` when a scene's grass would be more than about 150
  meshes and names a `distanceM` that stays under; grass itself is no cheaper.

## Checks

- Specs validate; a roll timed on the strike passes through it and standing still is hit (test);
  parts break, broken legs trip it, blunt blows to the head stun it, only a blade cuts the tail (test).
- Bots: the one that reads wind-ups clears each quest with the gear before it; the masher clears none.
- Draw calls of the arena with both actors, read from `ZhudaRuntimeProfiler`.

## Not checked

- Feel of any timing by a person. Quests 2–3 in a browser. Poses of clips against their hit frames
  (frame data was written from clip lengths, not from looking).

## Boundaries

Single player, one weapon type, flat arenas, no lock-on camera, no mounts or traps.
