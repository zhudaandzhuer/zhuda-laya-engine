# Route: a walled town walked in third person, with people to approach

A third-person exploration game: the player lands at a ferry, wades or swims a river, goes in at the south gate and
walks the streets of an old town where four gate guards, one named character and ten townspeople stand to be looked at
and talked with. Five houses can be entered, a day passes in twelve minutes, two skirts move as cloth, and three picture
settings hold a frame budget. Keyboard and mouse, or a touch stick and drags. Checked by scripted runs in headless
Chrome on a desktop and by frame rate on one phone.

- **Id:** `third-person-town-3d`
- **Kind:** scene
- **For:** A town or village walked on foot from behind the player: the place as a model prefab made from a film scene, walking rules with steps, slopes and water, a camera that stays out of walls, standing people to inspect and talk with, a passing day, picture settings for a phone.
- **Checked on:** desktop headless Chrome (`renderer: "auto"`; the records do not name the backend chosen); vivo V40, Chrome, WebGPU (frame rate only); no iPhone
- **Status:** the game's HANDOFF records `npm run verify` (61 unit tests) and twelve browser checks passing on 2026-11-20, not all in one run; V40 frame rates on 2026-11-16, 11-19 and 11-20; the published build is older and has no townspeople.
- **Reference consumer:** ZhudaGameCenter `games/zhuda-spacetime-3d` (outside this repository; its own git repository, never pushed).
- **Engine version:** zhuda-laya-engine 1.18.0 at commit `0a003e945e52e780493da21749fb66c5b8e19537` (the game's `package.json`, pinned 2026-11-20). Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 61 of 61 before and after with Doctor HEALTHY; the twelve browser checks all passed in one round on WebGPU (headless Chrome); the package is 164,669,023 bytes of the 165,000,000 allowed; one all-black frame was seen once and not again in 228 further pictures, cause not found.

Written on 2026-11-26 from the game's source, its `HANDOFF.md` (last updated 2026-11-20), `docs/history/` and
`evidence/`; nothing was run for this page. A `scene` route: one kind of scene built end to end by one consumer. Paths
are relative to the game (豬大時空3D).

## When to take this route

A place tens to a few hundred metres across that is walked, not seen whole: a town, a village, a harbour, a temple yard,
with houses to go into, people who stand where a data file puts them, and light that follows the hour; best when the
place already exists as a film scene or a set of models. Take [new-game-project](new-game-project.md),
[good-looking-3d-scene](good-looking-3d-scene.md) and [visual-content-prefab](visual-content-prefab.md) first.

Not this route: a diorama seen whole ([floating-island](floating-island.md)); kilometres of terrain
([outdoor-landscape](outdoor-landscape.md)); a film ([film-as-data](film-as-data.md)); fighting as the core
([hunting-action-3d](hunting-action-3d.md); this game's three fighting callings are left out here; their rules are
`prefabs/systems/pig-combat`); a crowd that walks ([crowd runtime](../crowd-runtime.md): here all fifteen stand still).

## Tools

- Engine 1.18.0 pinned by commit; features `core, 2d, 3d, ui, gltf, postProcess`; `renderer: "auto"`;
  `maxPackageBytes: 165000000`. Node `>=24` (`package.json`), TypeScript 5.9.3. Engine tools: the consumer build, the
  Doctor, `zhuda-laya-lod`, `zhuda-laya-crown`, the headless Chrome host, the MCP server.
- Blender run headless (`blender -b --factory-startup -P <script>`); the game records Blender 5.2, with the VRM add-on
  for VRoid files and Cycles for baking. Python 3 with Pillow and NumPy; ffmpeg; adb for the phone (`tools/phone/`).
- VRoid Studio for the townspeople's bodies, faces and hair, exported as VRM 1.0 (`art/characters/base/`). An image
  model the records call "image 2.6" for face skins, fabric tiles, painted clothes and portraits (scripts in
  `art/**/gen*.sh`). Tripo (online) made the two companions' statues; ask the owner before a paid service.
- The town, the land and the rigged pig come from the sibling film project `films/ancient-city` in the workspace
  (Blender scripts; its record names the plants and rocks as Poly Haven, CC0). The world tools read that folder.
- `public/assets` (145 MB) and `art/` (474 MB) are committed in the game; `ultra-pack/` (691 MB, the film-quality
  models), `dist/` and `node_modules/` are not.

## Steps

1. **A project on the consumer route, content apart from code.** [Consumer route](../consumer-route.md). Names, texts,
   standing places and looks are data in `content/`; tools turn them into `src/generated/` and `public/assets/`; no
   generated file is edited by hand. Check: `npm run verify`.
2. **The place: a film scene turned into a model prefab.** `zhudaPrefabFromFilmScene(scene, id)`
   ([model prefabs](../consumer-tooling.md#model-prefabs)) in `tools/world/make-prefab.mjs` writes
   `src/generated/river-town.prefab.ts` (56 nodes, 2371 copies, states `full`, `wild`, `ground`) and the hashed asset
   manifest, and lists what it leaves to the Scene (look, water, lights); a second definition names the film-quality
   pack. `src/prefabs.ts` gives preview and Scene one provider and `libraryOptions = { timeoutMs: 150_000 }`.
3. **The town cut up and thinned by distance.** Meshes a street long are cut into 16 m squares with `splitGlb`
   ([a model that is one mesh a street long](../model-lod.md#a-model-that-is-one-mesh-a-street-long)); houses get
   `cullMeters: 220`, street props and lanterns 120, paving `castShadow: false`. The two big trees get two lighter
   versions from `simplifyGlb` (15% of the triangles from 22 m, 5% from 55 m) and
   [shaded crowns](../model-lod.md#shading-a-trees-crown); ferns and weeds stop at 70 m, rocks at 90, shrubs at 110.
   Each frame: `instance.updateLod(eye, tier.lodReach)`
   ([levels of detail in a model prefab](../consumer-tooling.md#levels-of-detail-in-a-model-prefab)).
4. **What the film scene did not have.** `tools/world/scenery.py`, `yamen.py` and `place-scenery.mjs` add packed earth
   under the whole town, the yamen that ends the main street (colour pictures 1024 px, 32% and 45% of the triangles) and
   the far bank: jetty, moored boat, tea pavilion, shrine, stepping stones, lantern posts. They also write
   `src/generated/scenery.ts`: platforms to stand on, things in the way, places to look at.
5. **One source for where the player may stand.** `src/generated/walk-data.ts`: a height grid of 360 by 640 half-metre
   cells read through `ZhudaHeightfield` ([3D acceptance](../3d-acceptance.md)), 258 blocking footprints, five houses
   (plinth, floor, ceiling, walls, front, lamp), the water level, the start, the gate and 100 lanterns.
   `tools/world/make-colliders.mjs` measures the rest from the models and the prefab's placements: circles for trunks
   and rocks, boxes for stalls and furniture, platforms for plinths and stairs. Every position in content is metres from
   the gate's centre (`walk.gate`), x east and z north.
6. **Walking as rules without the engine.** `src/actors/player.ts` (`stepPlayer`, `WalkWorld`): radius 0.35 m, walk 1.9
   and run 5 m/s, 10 m/s² to change speed, 540° a second to turn; a step of at most 0.25 m; a slope of at most 1.1
   judged 0.35 m ahead, except on built platforms where each step is judged alone; a blocked move slides along x, then
   z. Water deeper than 0.62 m floats it (swim 1.25, hard 2.1 m/s); wading slows with depth. Check:
   `tests/player.test.mjs`, then `tools/checks/walk.mjs` with real keys.
7. **The character's gait.** `ZhudaAnimationBlend` ([mixing clips](../animation-control.md#mixing-clips)) mixes Walk and
   Run by speed at the same share of their round (1.25 m and 2.1 m of ground a round), lays Idle over them in 0.15 s and
   blends to Swim in 0.35 s. `tools/characters/pig-clips.py` adds Run and Swim to the film's rig.
8. **The camera, kept out of walls, and input.** `ZhudaCameraRig` in `orbit` mode, 2.2 to 17 m, with
   `collision: { queries, radius: 0.2, clearance: 0.12 }`; the game registers one entity with `ZhudaSceneQueries` whose
   `raycast` tests the walls and ceilings of the enterable houses as boxes (`src/world/camera-walls.ts`;
   [3D integration](../3d-integration.md)). Two views: behind and above (pitch 0.55 rad, 6.4 m, the default) and close
   behind (0.22 rad, 5.2 m). It looks 1.05 m above the feet, follows them eased and never dips under the water.
   `src/core/input.ts`: an axis relative to the camera's yaw, discrete actions through `ZhudaInputBuffer`, a fixed stick
   at the lower left (past 85% it runs); every other drag turns the view.
9. **The look, the river, grass and wind.** `ZhudaSceneLook` with `cameraPasses: { depth: true, opaque: true }`
   ([the same look in a game](../film-scenes.md#the-same-look-in-a-game); the [quality route](../quality-route.md) for
   the order). Morning: sun azimuth 118°, elevation 20°, intensity 2.3; shadows 60 m, 4096, four cascades; fog 40–420 m;
   bloom 0.3, AO 0.55; light fog 0.006 with shafts of strength 0.8 in 40 steps. `ZhudaWaterSurface` with `setRipples`
   for the swimming body. `ZhudaGrassField` ([grass](../grass.md)) with a `grows` test that keeps blades off paving and
   plinths: 700 a square metre to 48 m on high, none on low. `zhudaMarkFoliage` and `ZhudaFoliageWind`.
10. **Day and night as pure rules.** `src/world/daylight.ts`: eleven keyframes over 24 hours and a weather (mist,
    overcast) give sun, sky, ambient, fog, exposure and a `night` share; a day is 720 s. The Scene calls `look.setLook`
    with the same keys each time ([changing the look while it runs](../film-scenes.md#changing-the-look-while-it-runs)).
    Windows and lanterns follow with `instance.setEmission(node, 0.04 + 0.96 * night)`
    ([a model's glow](../consumer-tooling.md#a-models-glow-while-the-game-runs)); eight point lights are moved to the
    lanterns nearest the player every 20 frames; the hand lantern has a `ZhudaPointShadow` (256 px, every third frame,
    not on low: [point-light shadows](../lighting-depth.md#point-light-shadows-on-a-schedule)).
11. **People as content.** `content/characters/<id>/character.json` holds name, text, lines, portrait, model and where
    the figure stands; `order.json` says who is in town; `tools/characters/townsfolk.py` writes
    `src/generated/townsfolk.ts`. The Scene stands each on the ground, plays its one clip `Idle` out of step with the
    others, makes it a post of 0.3 m in the walk world and redraws its materials with `ZhudaToonMaterial`
    ([toon material](../stylized-shading.md#toon-material); ramp `edges [0.5]`, `levels [0.8, 1]`, `softness 0.5`, no
    outline). The four guards are copies of one model with one clip.
12. **The townspeople's models, and how many are drawn.** Face and hair are chosen in VRoid Studio first;
    `tools/characters/npc-build.py` takes the modern clothes off the VRM, builds period clothes round the body from
    `look.json` (robe, sleeves, skirt, sash, props, pose) and bakes them into one mesh, one material and one 2048 px
    picture (twenty to thirty draws become one; 2 to 3 MB a figure after `tools/build/glb-jpeg.py`). `npc-lite.py` makes
    the copy for phones: 150 bones to 21, 24,000 to 48,000 triangles to 6000, one 448 px picture, six materials. On low
    a figure is posed within 10 m every third frame, hidden beyond 20 m, casts no shadow and is its light copy; on high
    all are drawn, and posed within 70 m. See [model-from-dcc](model-from-dcc.md),
    [model pipeline](../model-pipeline.md), [VRM](../vrm.md) and, without VRoid,
    [rigged-phone-character](rigged-phone-character.md).
13. **Approaching and inspecting.** `src/world/places.ts`: 35 places (things, houses, guards, people), each with a
    reach; the nearest in reach gets a button drawn beside it. `src/systems/interaction/session.ts` (no engine, no DOM)
    has two kinds: `examine` (the text at once) and `talk` (lines typed out one by one). `shots.ts` gives the camera: a
    close look at 38°, a wide one at 52° for a gate or a street, a conversation from beside the player through a 30°
    lens; 0.7 s to blend in and out. `src/ui/dialogue.ts` draws film bars, a portrait and a name plate in DOM. Check:
    `tests/interaction.test.mjs`, `tools/checks/talk.mjs`.
14. **Cloth on two figures.** A figure built with `skirt_sim` keeps its skirt as its own mesh, measured in
    `cloth.generated.json`. Near the player `src/systems/cloth/skirt.ts` hangs a `createZhudaClothTube` of 40 by 16
    particles from the waist ([cloth](../cloth.md)), with capsules for legs and hips, a ground plane, the game's presets
    and wind (values after a LayaAir cloth plugin, none of its code), in the figure's own material; it runs unseen until
    settled, then replaces the still one. `nearby.ts`: two at most, from 9 m in to 11.5 m out; none on low.
15. **A summoned companion (built, checked, removed on 2026-11-19 at the owner's word).** A statue without bones got a
    22-bone skeleton and clips in Blender (`tools/characters/summon-build.py`, kept). Its rules
    (`src/systems/summon/follower.ts`, in the game's git history) stood it behind the player, moved it with
    `stepPlayer`, stepped it sideways when blocked and brought it back from 14 m; its check last reported that morning.
16. **The interface is DOM over the canvas** (`src/ui/hud.ts`), sized by the view's height over 750: a clock and weather
    bar, pace, view and music buttons, the picture-setting panel. `src/core/screen.ts` is the phone's screen:
    [mobile-always-landscape](mobile-always-landscape.md), [mobile-web-fullscreen](mobile-web-fullscreen.md).
17. **Picture settings and the frame budget.** `src/core/quality.ts`: low (look level 0, pixel ratio 1, one hard 1024
    cascade to 22 m, the mirror 256 px every fourth frame and not at all inside the walls, scenery distances times 0.3),
    high (level 3, ratio up to 2, 4096 in four cascades to 60 m) and ultra (the film pack). A `ZhudaQualityGovernor`
    with `budgetMs: 1000 / 60` walks a ladder with `look.setStep`: render scale first (1, 0.85, 0.7; on low down to
    0.5), then, on high, look level 2 at 0.7 and 0.6, never lower
    ([hold the frame budget](../quality-route.md#13-hold-the-frame-budget)).
18. **Warm up behind the loading picture.** `zhudaWarmUpByDrawing`
    ([warm up by drawing](../shader-warm-up.md#warm-up-by-drawing)) from six eyes along the way in; hidden figures are
    shown for it, and `beforeView` fills the grass, updates the levels of detail and the look and draws the river's
    mirror. A start that fails on WebGPU reloads once on WebGL with `retryZhudaBackend` ([WebGPU](../webgpu.md)).
19. **A hook, and one check a feature.** `window.__RIVER_TOWN__` gives scripts the state and the controls (`walkFrom`,
    `advance`, `view`, `setHour`, `freeze`, `rendererErrors`); the address takes `?tier=`, `?hour=`, `?clock=0` and
    `?off=<part,…>`. Each file in `tools/checks/` serves `dist/web` on loopback, opens it with `chromeFixture`, waits
    for `ready`, drives it with real key and pointer events or fixed steps, asserts, and leaves pictures and a JSON
    report in `evidence/`. `npm run checks` runs them in a row and stops at the first failure.

## Pitfalls

- **11 to 12 frames a second on the phone, whatever the resolution** (V40, 2026-11-16). The game's clock moves the sun,
  so the light shafts' depth picture from the sun redrew the whole scene almost every frame (about 40 ms). Fixed in the
  engine (`f21d10e`: redrawn when the sun has turned 0.5°): 22 to 24.
- **The people are the cost of a street.** Each figure was 12 to 17 meshes on about 150 bones, drawn again for shadows
  and the mirror. Bake the clothes into one mesh, make light copies, pose and draw by distance (step 12).
- **Stumbles of 0.3 to 2.6 s walking in right after loading** (V40, low, 2026-11-20). First draws compile shaders and
  make pipelines; one of 469 ms was the river's mirror pass. Step 18 brought the longest frame to 117 ms. The warm-up
  leaves the grass at its last eye: plant it again round the player.
- **A fight dropped frames because of DOM, not 3D** (V40, 2026-11-19). Damage numbers, a combo count and a health bar
  restyled each frame; pooled elements moved by transform and opacity, with `contain`, cured it.
- **The water vanished when the governor reached look level 0.** The rebuilt look reset the camera's depth and opaque
  passes; `cameraPasses` (engine `0f65925`) keeps them. The ladder now stops at level 2.
- **Bare sky-coloured ground, lanterns hanging in the air, walking through barrels.** The conversion kept what the
  film's shots showed: no ground under the back lanes, no yamen, walk data that knew only houses and walls (steps 4 and
  5). Measure stairs on the original model, not the reduced one. Before the town was cut into squares its shadows cost
  22 of 24 ms on a phone (2026-11-14).
- **A check that teleports proves less than one that walks.** Three dummies stood in a fenced corner the player could
  not reach because the gate was taken to be at z 88.3 when `walk.gate` is z 72, and the check placed the player beside
  them; it now walks to each. Checks that wait on real time failed under machine load: `freeze(true)`, then `advance`.
- **Toon materials.** Shader names must begin with `Zhuda`; a live texture in the spec threw "circular structure" (set
  `albedoTexture` on the built material); keep each source material's sidedness; an outline at 70 to 85% render scale is
  a black staircase and drew dots at the mouth, so none is drawn.
- **Faces before portraits.** Portraits painted from untouched VRoid presets, with the 3D then pulled toward them
  offline, cost three rounds. Design the face in VRoid, dress and bake, then paint the portrait. Export with "delete
  transparent meshes" off, or the body under the clothes is missing.
- **Smaller ones.** Scanned plants came with JPEG colour and no alpha (`tools/world/foliage-alpha.py` keys it;
  `npm run prefab` undoes that). Sun shadows drawn every third frame darkened the walking character every third frame.
- **The package limit was raised five times in under a week** (110 to 165 MB) and is full: the light copies had to
  shrink to fit. Decide the budget for people before making them.

## Engine gaps and their workarounds

| Gap | Workaround | Plan |
| --- | --- | --- |
| No public entry for the prefab check, `splitGlb`, `simplifyGlb`, `shadeCrownGlb`, or `zhudaPrefabFromFilmScene` in Node (the Chrome host has one since 2.0.0: `zhuda-laya-engine/compiler/chrome-host`) | Imported by path under `node_modules/zhuda-laya-engine/packages/`; `make-prefab.mjs` names an engine checkout by an absolute path, to be changed before reuse | none yet |
| No character controller, nothing that measures colliders from models; the camera collides only with what the game registers as queries | The game's `stepPlayer`, `make-colliders.mjs` and boxes for five houses; conversation shots avoid nothing | none yet **After 2.0.0:** `ZhudaCharacterController` and `zhudaSolidQueryProvider` ([walking](../walking.md)) for a world given as a ground function and boxes and cylinders; measuring them from models is still the game's. |
| Thousands of renderers culled in JavaScript each frame (3718 to 3941 here, most of them scatter outside the walls); 50 to 54 FPS for the first 20 s on the V40 | Not done: `instanced: true` on the scatter nodes ([instanced placements](../instanced-meshes.md#a-models-placements-instanced)), then compare pictures | game work |
| About 40 s after loading a phone still uploads textures; fights ran at 48 to 50 FPS; drawing ahead did not help | none | none yet |
| `zhuda-laya-lod` does not merge parts, materials or bones of a skinned figure | Blender (`npc-lite.py`) | none yet |
| `ZhudaSceneLook` has no call for a game's own lamps | LayaAir `PointLightCom` set by the game | none yet |
| Cloth is a mesh in world space with no bone chains or self-collision; pins do not follow bones by themselves | Skirts only, on figures that stand still | none yet |
| The grass field has a cost of about 5 ms that density does not change (desktop, 2560 by 1440, per the history file) | No grass on low | none yet |

## Checks

All from the game's records; evidence files are dated 2026-11-20, headless Chrome on the owner's Mac.

- `npm run verify`: build, typecheck, Doctor, `node --test`. Last recorded 2026-11-20: HEALTHY, 61 tests (walking,
  camera ray and daylight 12; interaction 8; cloth 5; fighting 36); the package was 164.57 MB of 165 that afternoon.
- `npm run checks`, twelve files; the last record has eleven passing in one round and `lock` alone. `walk`: 2 s of
  walking covers 3.6 m, a run reaches 5 m/s, a wall stops it, it floats 0.62 m deep, swims across and climbs out.
  `town`: in at the gate and up the street. `houses`: all five entered. `day`: eight pictures; night under 45% of noon's
  brightness, 503,537 blades of grass, no device errors. `hud`: desktop and phone size; all 35 cards open and close.
  `townsfolk` and `zhiwei`: eleven figures can be looked at and stop the player 0.65 m off; 5.2 ms a frame drawn back to
  back on high. `talk`: eleven conversations to the last line. `cloth`: 640 particles each, none inside the body, sway 8
  and 21.5 cm. `screen`: turn hint, fullscreen asked for, the swipe gate. `combat`, `lock`: the fighting.
- vivo V40, Chrome, WebGPU (`tools/phone/fps.mjs`). 2026-11-16, the published build at the former middle setting: 21 to
  25 FPS at 60% scale, loaded in 37.6 s. 2026-11-19 and 11-20, low, long after loading: 59 to 60 standing, walking and
  running; high: 15.7 FPS; with the warm-up the worst second running in went from 5 to 45 FPS.

## Not checked

- Anything on engine 2.0.0. Which backend the desktop checks drew with. All twelve checks in one run.
- An iPhone with any of this (a WebGPU start failed on one on 2026-11-15; the WebGL retry was not tried on the device).
  On the V40: real fullscreen, touch feel, cloth, conversations. The 50 FPS stretch after loading is not solved.
- The isolated prefab check (`npm run check`): the game holds no reference pictures and no record of a run. The world
  generators since the folders were reordered on 2026-11-18 (syntax only, per the HANDOFF).
- Sound by ear; the texts and lines (an agent wrote them; the owner has not reviewed them); eight of the ten
  townspeople, still made in the older order; the cost of a skirt in the game.
- Publishing this build (the owner's portals: see `PORTALS.md` in the workspace; it needs the owner's yes).

## Boundaries

The engine draws and runs the look, water, grass, foliage wind, the model prefab with its levels, culling and glow, the
height grid, the camera rig and queries, clip blending, toon materials, the cloth solver, the frame budget and the
warm-up. The game owns the place and its data, the rules of walking, of the day and of interaction, the people and their
texts, the interface, the picture settings, its tools and its checks.

For the prefab library (`prefabs/`): `prefabs/systems/cloth` and `prefabs/systems/pig-combat` already came from this
game, which still uses its own copies. Candidates, set against `prefabs/3d/`: the walker and camera (`island-walker`
asks a world only "how high" and "may I stand", its camera avoids given spheres, and it has no steps, slopes, colliders,
run or swim: `stepPlayer` and `camera-walls.ts` are the fuller set); the day (`day-look.ts` returns a whole look with
rain and storm for two islands; `daylight.ts` has dark nights lit by lamps and mist at dawn, and could be a third
setting); the picture settings (`quality-tiers.ts` has look, pixel ratio, grass and particles; a town adds shadows,
mirror, people and cloth); the pig (`zhuda-characters` has the film's watchman; this one adds Run, Swim and the guard);
and, new, the town with its walk data and colliders, the five houses, the eleven people with light copies and portraits,
interaction (beside `ui/dialog`, `ui/visual-novel`) and the skirt. Take [game-to-prefabs](game-to-prefabs.md) first.
