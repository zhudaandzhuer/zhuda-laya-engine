# Route: A 3D pole-rescue arcade round on a sea

A one-screen 3D arcade game: a character on a pier holds a long bamboo pole whose tip follows the mouse or a finger over
a sea; pigs bob in the water and raise a hand for about a second; touch one with the tip and it grabs on, carry it over
a raft to score and add time; a 60-second round that always ends. Built as 豬二：打撈吧！ and played end to end by a script
with real mouse and touch events in headless Chrome on a desktop, on WebGPU and WebGL; a phone was emulated only.

- **Id:** `pole-rescue-arcade-3d`
- **Kind:** workflow
- **For:** building a one-screen 3D arcade game where a pointer moves a tool's tip over a water or ground plane, targets can be taken only in a short window and are carried to a goal, on a clock with time bonuses
- **Checked on:** desktop WebGPU and desktop WebGL (headless Chrome 157 on macOS, adapter `apple / metal-3`); a phone's screen and touch emulated; no phone
- **Status:** whole rounds played by a script at 1280×720 (mouse), 844×390 and 390×844 (touch) with 0 renderer errors and 0 page errors, recorded in the game's HANDOFF of 2026-11-18 (runs of 2026-11-17); no person's scores, no phone, no sound heard; nothing was run again for this page (2026-11-26)
- **Reference consumer:** ZhudaGameCenter `games/zhuer-fish-them-out` (outside this repository; the workspace is not under version control)
- **Engine version:** zhuda-laya-engine 1.18.0, pinned at commit `3c15fdc855de5688d082a11556dd36c252005871` (the game's `package.json` and HANDOFF). Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 15 of 15 with Doctor HEALTHY; the play check's three layouts on WebGPU and on WebGL, every round ended with 0 renderer errors and 0 page errors; not republished

Written from the game's source and its records. Results are quoted from those records with their dates; values are those
in the source that the recorded runs played. Read [game-rules-first](game-rules-first.md) and
[good-looking-3d-scene](good-looking-3d-scene.md) first: this page adds what is particular to the genre.

## When to take this route

- One fixed camera over water or ground; the pointer is a tool's tip on a horizontal plane; targets are open for a
  moment, then carried to a goal, on a countdown with bonuses and a streak (fishing, a crane, a rescue).
- Not this route: a camera in the water ([underwater](underwater.md)); a character that walks or fights
  ([hunting-action-3d](hunting-action-3d.md)); things on paths ([tower-defence-3d](tower-defence-3d.md)); a diorama with
  weather ([floating-island](floating-island.md)). A phone game that must be held sideways also takes
  `mobile-always-landscape` and `mobile-web-fullscreen`; this game did not.

## Tools

- The engine as a GitHub dependency pinned to a commit ([new-game-project](new-game-project.md)); `zhuda-laya-build`,
  `zhuda-laya-doctor`; Node 24 or newer (tests import `.ts`); TypeScript 5.9.3.
- Blender 5.2.2 LTS, headless (version from the game's build log), models the place from numbers: `tools/scene.py`
  (shore, pier, raft, pole, swim ring, jellyfish), `tools/gear.py` (five accessories), `tools/icons.py` (portraits).
- The two characters come from outside the game: drawn with an image model, turned into 3D with an image-to-3D tool
  (Hunyuan 3D, per the README; versions not recorded), then rebuilt as game models with 19 clips by `build_character.py`
  in the owner's character workspace (`--tris 9000 --tex 1024` for the pig).
- Sound: `tools/sfx.py` on `tools/sfx_base.py` (numpy, scipy, seeded; the helpers are a copy from the sky-island
  game's); music from the owner's rule-based composing tool; voices from the owner's local text-to-speech tool.
- Headless Chrome through the engine's `chromeFixture`; the system `zip`; `ffmpeg` for store pictures.
- No licence file in the game. Its portal disclosure: pig art, 3D conversion and voices are AI-made; scene, accessories
  and effects are made by code. All of it stays in the consumer.

## Steps

1. **Project.** `zhuda.config.json`: `features: ["core", "3d", "gltf", "postProcess"]`, `renderer: "auto"`,
   `maxPackageBytes: 40000000`. `npm run verify` is build, `tsc --noEmit`, doctor, `node --test`.
2. **Rules with no engine in them** (`src/logic.ts`). A `Round` with `step(dt, aim)` (`dt` capped at 0.1 s; `aim` is a
   point on the water or null) and `drain()`, which returns events (`up`, `hook`, `save`, `early`, `stung`, `end`…). One
   seeded generator. The view draws the swimmers and plays the events back. Check: `tests/logic.test.mjs`.
3. **The grab window.** A swimmer goes `enter` (0.6 s), `under`, `up`, `under`…: `up` lasts its kind's `window`, `under`
   a random time in its kind's range. Six kinds in one table (`KINDS`): plain, up for 1.3 s; small, 0.8 s; chubby, 1.5 s
   and weight 2.2; one in a swim ring, always up but drifting out of the sea; a diver, 1.1 s, six times faster while
   under; a golden one, 0.75 s, gone after 9 s. No button: the nearest swimmer that is `up` within `0.32 + 0.3 × scale`
   metres of the tip, measured on the plane, is hooked. Touching one that is `under` gives `early` (a "wait" hint). The
   first swimmer of a round waits near the raft with its hand up until caught.
4. **Carry to the raft.** A hooked swimmer sits at the tip; the tip rises from 0.45 m to 1.75 m; within 1.25 m of the
   raft's middle it is saved. The tip eases to the aim (rate 16 a second), capped at 9 m/s empty and 3.4 m/s ÷ weight
   when carrying. It may go 0.8 m past the sea's bounds and over the raft, no further.
5. **A clock that ends.** 60 s; a save adds `bonus × max(0.3, 1 − elapsed / 150)` seconds, up to 99. Points are the
   kind's score × the streak (three in a row ×2, five ×3; a streak lapses 3.5 s after the last save); stars at 15, 40
   and 80 points. Waves: five swimmers of two easy kinds; from 18 s seven, three harder kinds and a jellyfish; from 38 s
   eight, the golden one and two jellyfish. A jellyfish at a low tip freezes the pole for 1 s. Check: the balance test
   (a bot re-aiming every 0.25 s saves at least 15, plays past 60 s and ends before 200 s; one at 1.5 s saves fewer).
6. **The place, from numbers.** `tools/scene.py` writes `shore.glb`, `dock.glb` (nodes `dock` and `raft`) and
   `props.glb` (`pole`, 1 m along +Y from its butt; `ring`; `jelly`). Game (x, y, z) is Blender (x, −z, y).
   `src/world.ts` repeats the pier's top (0.55 m), the raft's middle `[−4.3, 0, 3.35]` and four seats in it: the two
   files must agree. Parts the game moves are nodes found by name; the props file stays inactive and its nodes are
   cloned.
7. **Look and frame budget.** `ZhudaSceneLook` ([the same look in a game](../film-scenes.md#the-same-look-in-a-game),
   [quality route](../quality-route.md)): `preset: 'day'`, sun azimuth 140° and elevation 50°,
   `ambientGround: [0.42, 0.36, 0.26]`, shadows `distance: 45, resolution: 2048, cascades: 2`, grade
   `exposure: 1.12, bloom: 0.18, ao: 0.45`, `lightFog.density: 0.0025`, options
   `cameraPasses: { depth: true, opaque: true }`. Level 2 on a desktop, 1 where `(pointer: coarse)` matches; `dprCap` 2
   and 1.5. `ZhudaQualityGovernor({ budgetMs: 1000 / 55, start })` moves the level
   ([hold the frame budget](../quality-route.md#13-hold-the-frame-budget)); `?quality=0..3` fixes it.
8. **Sea.** One `ZhudaWaterSurface` at `[2, 0, −8]`: `size: [80, 56]`, `flow: [0.04, 0.06]`, `color: [0, 0.26, 0.4]`,
   `clarity: 0.3`, `waveMeters: 1.5`, `waves: 0.14`, `reflection: 0.55`, `glow: 0.7`, `foamDepth: 0.14`, `resolution`
   1024 (512 on a phone), `sun` toward `look.towardSun` with colour `[0.05, 0.047, 0.042]`. Each frame `update`,
   `setTime`, `render()` (every other frame below level 2) and `setRipples` with at most four bodies: the tip (`radius`
   0.12, `strength` 0.5) and the nearest swimmers that are up (0.32 × scale, 1.1, with `velocity`)
   ([ripples](../film-scenes.md#nature-many-copies-leaves-and-running-water)).
9. **Camera, wide and tall.** Field of view 36°. Wide: eye `[−0.75, 8.6, 8.75]`, target `[−0.75, −0.2, −0.05]`; a
   narrower wide screen steps back by `clamp((1.75 / aspect)^0.8, 1, 2.2)`. Tall: look out to sea from behind the
   character (target `[2.3, −0.2, 1.15]`, direction `[−1, 1.3, 0]`, distance `3.9 / tan(half the horizontal view)`) over
   a narrower, deeper sea (`SEA_TALL`); a round takes its sea when it starts. On a phone, emulated only: the HANDOFF
   records that an upright one plays but far pigs are small, so the game shows a hint to turn it.
10. **Pigs: one model, a pool of 13.** `ZhudaModelLibrary.instantiate` on a `DirectoryAssetProvider`
    ([asset loading](../asset-loading.md)) with `independentMaterials: true`: the first copy alone, so the file is
    fetched once, then twelve together, each tried again with a growing wait. 13 is eight in the sea, one on the pole
    and four in the raft; with none free the oldest in the raft is taken, behind a puff. The model is 8,990 triangles,
    one mesh, one material, 14 joints, 19 clips, 1 MB; the player's character is 49,996 triangles, 4 MB (GLB headers).
11. **Kinds as data** (`src/looks.ts`): a scale, a tint for `setTint` (0..1 each), one accessory, a swim ring. Each copy
    gets clones of all five accessories as children of the `head` or `spine` bone (`model.find`) at zero offset while
    the model is in its rest pose, since `tools/gear.py` models them in place on the body; a kind shows one. Check:
    `tests/looks.test.mjs` (tints in range, the nodes in `gear.glb`, the bones in the model, a portrait for each kind).
12. **Motion.** Clips through `ZhudaAnimationBlend`, names from `ZhudaModelInspector`
    ([animation control](../animation-control.md)); a change of clip fades with
    `overlay(previous, seconds, weight, ['root'])` (`src/animated.ts`). In the sea a spring pulls the feet to a depth by
    phase (up −0.52 × scale, under −0.93; stiffness 120 when up, 45 otherwise), so coming up overshoots like a jump. On
    the pole the pig is a pendulum pushed by the tip's acceleration. Onto the raft: a 0.45 s hop, 0.9 m high.
13. **The pole.** A 1 m mesh placed each frame 0.35 m behind the grip (the `arm.R` bone, 0.22 m forward), turned from +Y
    toward the tip and scaled `(1.6, length, 1.6)`; the character faces the tip (`src/actors.ts`).
14. **Pointer to the water** (`src/Main.ts`). `pointerdown` and `pointermove` on the canvas (`touch-action: none`,
    pointer capture). Client pixels become stage pixels through the canvas rectangle, then LayaAir's
    `camera.viewportPointToRay`, cut with the plane y = 0.45 (the tip's resting height, not the water), so the tip is
    drawn under the pointer. For `pointerType === 'touch'` the point is taken 64 CSS pixels above the finger.
15. **Feedback and interface.** Eleven emitters on `ZhudaParticleSystem3D` and `ZhudaLayaParticleRenderer3D`, textures
    painted in code (`src/fx.ts`; [particles](../overview.md#particles-and-effects)); on a hook 0.12 s at quarter speed
    and a camera jolt. The rest is DOM over the canvas (`src/hud.ts`): numbers and a "Help!" bubble placed by
    `camera.worldToViewportPoint`, a title over a silent round played by an in-page bot, a how-to card with portraits,
    score, clock, streak bar, hints, pause on blur, results with stars and a best score. Two languages (`?lang=`).
16. **Sound** (`src/sound.ts`, [audio](../audio.md)): one `IframeSoundAdapter` on the model provider
    (`sampleTimeoutMs: 60000`); the sea and the music as streams; 15 effects and 30 voice takes as samples, four at a
    time, those the first catch needs first, each tried again; `unlockAudio` on the first press or key; one line at a
    time for each speaker; mute remembered.
17. **Hook and play check.** `window.__FISH__` gives a script the round, the mode, `project`, `aimAt`, `parade` (one of
    each kind, hand up), `rendererErrors`, `probeFills`, `qualityLog`, `backend`. `tools/play-round.mjs [WxH] [touch]`
    taps the real Start button, then every 60 ms reads the round, projects the nearest raised hand (or the raft) to the
    screen and sends a real mouse or touch move there (a touch 64 px lower), with the game at `?timescale=3`; it saves a
    frame after 45 s of game time and one at the results, prints a report, and exits 1 on a page error, a renderer error
    or no results. `tools/shot.mjs <name> [query] [script] [seconds] [WxH] [mobile]` saves one frame.
18. **Zip.** The build writes `dist/game.zip` and enforces `maxPackageBytes`; `scripts/pack-zip.mjs [portal]` zips
    `dist/web` again and, for a named portal, adds a line setting `window.ZHUDA_PORTAL` (and that portal's SDK tag) to
    `index.html`. Recorded in `dist/consumer-build.json` (file of 2026-11-17): 8,198,792 bytes zipped, 18,255,103
    unpacked, 82 entries. Published on the owner's portals (see `PORTALS.md` in the workspace); the owner decides.

## Pitfalls

- **On WebGPU the picture went dark after 70–90 s, with no page error** (2026-11-17, look level 3). The glTFPBR pipeline
  failed validation (`@group(2) @binding(1)`), every later frame was an invalid command buffer, and only
  `context.renderer.errors` showed it. Before the fix: level 3 fixed, 3 of 4 runs with errors; level 2 fixed, 0 of 4;
  governor-driven, 4 of 9; WebGL, 0 of 5. The first error came at 69–87 s of game time, when all 13 copies were in use
  and raft copies were being re-used. Cause, found on the engine side: a render without the reflection probe's block
  shared a binding layout with one that has it. Fixed by engine commit `ae18ceb7`; the game moved its pin to `3c15fdc`,
  and 11 WebGPU rounds then had no error (HANDOFF). Until then: `renderer: "webgl"`. Play whole rounds, past the point
  where the pool wraps, and read the renderer's errors in the loop.
- **A tint above 1 throws.** `setTint` takes 0..1. Looks became data with a test.
- **A tall screen with the wide camera.** Fixed by a second sea and camera (step 9), not by zoom.
- **Glint on the sea pulled the eye from the pigs.** The water's sun colour went from 2.4 to 0.05 (`?glint=0..1`).
- **Shadows under swimmers** land on the sea bed and read as fish: swimmers, pole and jellyfish cast none.
- **Numbers tuned for the first sea.** After the sea shrank the streak gap went from 4.5 s to 3.5 s and the tip was
  slowed. Re-run the balance test after any change of bounds.
- **From the review of 2026-11-17.** A clock at 0 and a streak badge behind the results card read as a fault: hide them.
  The player's character was too small: drawn 1.3 times larger, camera nearer the pier.
- **Scripts.** Wait 2.5 s after the title for the engine's splash before the first tap; one script evaluated in the page
  must not run long (the store pictures use several short calls).

## Engine gaps and their workarounds

| Gap | Workaround | Plan |
| --- | --- | --- |
| (Closed in 2.0.0) No public entry for the headless Chrome host a consumer's play check needs | Import `zhuda-laya-engine/compiler/chrome-host`; the game's tools still import `packages/compiler/chrome-host.mjs` from the installed package by path | done |
| A `ModelInstance` has no shadow switch (`setTint`, `find`, `dispose` only) | Walk the nodes once, keep the LayaAir renderers, set `castShadow` on each | none yet **After 2.0.0:** `instance.setShadows({ cast, receive })`. |
| No signal that the engine's splash has gone | A fixed wait in every script | none yet **After 2.0.0:** `await whenZhudaSplashGone()`, or `zhuda:splash-gone` on `window`. |
| The build's zip has no per-portal variant | `scripts/pack-zip.mjs` | none yet |

The WebGPU fault above is closed in the pinned commit; `zhudaReflectionProbeFills()` counts how often the fix acts. Keep
it and the renderer's errors in the report when re-checking at 2.0.0.

## Checks

- `npm run verify`: build, types, doctor and 15 tests (8 rules, 4 looks, 3 words). The HANDOFF of 2026-11-18 names it as
  the gate; it does not write down a dated pass line.
- `npm run play-check`: three whole rounds (1280×720 mouse, 844×390 touch, 390×844 touch). Recorded in the HANDOFF of
  2026-11-18: 0 renderer errors and 0 page errors on WebGPU against the published builds
  (`BASE=<url> node tools/play-round.mjs …`; three layouts on one portal, 1280×720 on the other), and 11 WebGPU rounds
  without error after the engine fix. Recorded in the game's issue write-up of 2026-11-17 (HeadlessChrome 157, macOS,
  adapter `apple / metal-3`): on WebGL, all three layouts and 5 rounds without error.
- Frames in `evidence/`, all of 2026-11-17: title, how-to and results screens, play frames, `parade` (the six kinds),
  `phone-landscape`, `phone-portrait`, `round-<size>-mid` and `-end` for the three sizes, and
  `round-1280x720-renderer-error` (the dark frame).

## Not checked

- Any phone: frame rate, touch, a whole round on WebGPU. No frame rate, draw count or memory is recorded anywhere,
  desktop included ([3D acceptance](../3d-acceptance.md)).
- Any person playing: feel, difficulty, the spread of scores (the star lines and the streak rule wait for that); sound
  by ear; the hands on the pole (estimated); accessories in extreme poses.
- Engine 2.0.0, or any commit after `3c15fdc`. Prefab acceptance (`prefabChecks`,
  [prefab workflow](../prefab-workflow.md)) is not set up. Portal SDK hooks are not wired.
- Engine parts that might replace game code and were not tried: `ZhudaCameraCoordinates` (`screenToRay`,
  `worldToScreen`) and `ZhudaPointerInput` ([3D integration](../3d-integration.md)); `ZhudaParticleSystem3D.burst`;
  `zhuda-laya-lod` for the light pig ([model LOD](../model-lod.md), [model pipeline](../model-pipeline.md)); baked
  crowds for the 13 copies ([instanced meshes](../instanced-meshes.md)); the render-scale rungs of `zhudaQualitySteps`.

## Boundaries

- **The game:** the rules and numbers in `src/logic.ts`, the kinds and what they wear, words, voices, store pictures.
- **The prefab library** (`zhuda-engine-prefabs/` in this repository): the game uses no shared module today, but holds copies of
  library files (bytes compared on 2026-11-26): `src/math.ts` is `3d/math.ts`, and the player's character is the
  `zhuer.glb` of `3d/zhuda-characters`, which could gain the 8,990-triangle pig; `tools/sfx_base.py` is a copy of what
  is now `3d/island-sound/source/sfx.py`. Parts that would be modules there: the seaside (shore, pier and raft, with
  `tools/scene.py`, `src/world.ts` and the sea's settings), the pole with its pointer-to-plane and pose code, the
  accessory pack (`gear.glb`, `tools/gear.py`, `src/looks.ts`, the portraits), the swim ring and jellyfish, the sea
  effects (`src/fx.ts`) and the synthesised sounds. Move them by `game-to-prefabs`.
- **The engine:** look, water, model loading, clip mixing, particles, sound, frame budget, build, doctor; and the four
  gaps above.
