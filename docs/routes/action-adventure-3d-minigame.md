# Route: A 3D action adventure as a WeChat mini-game

A landscape, third-person action adventure for the WeChat mini-game host ("末日僵尸觉醒 之 猪大修行"): a hub, a village, one dungeon at
rising difficulty with a three-bar boss, voiced scenes, two playable characters with cloth, and a package cut into subpackages.
Rules are TypeScript tested in Node; the view is LayaAir through the engine. Touch, or keyboard and mouse. Checked in headless
desktop Chrome, and in the host on an iPhone 14, a vivo V40 and WeChat's cloud test between 2026-11-19 and 2026-11-21.

- **Id:** `action-adventure-3d-minigame`
- **Kind:** workflow
- **For:** building a landscape 3D action adventure (bosses as data, story scenes, rigged characters with cloth, touch controls)
  that ships as a WeChat mini-game inside the host's package limits
- **Checked on:** WeChat mini-game host (WebGL) on an iPhone 14, a vivo V40 and a cloud test of 10 phones, 2026-11-19 to
  2026-11-21; desktop WebGL (headless Chrome) since; no phone after 2026-11-21
- **Status:** from the game's HANDOFF: `npm run verify` passed with 125 of 125 tests on 2026-11-26; version 12.0.1 (about 29 MB)
  was uploaded and sent to review on 2026-11-21; what came later (village, second character, cloth skirt) was seen only in desktop
  Chrome, and the tree measured 37.1 MB on 2026-11-25, over the host's 30 MB, so it has not been packaged again
- **Reference consumer:** ZhudaGameCenter `games/zhuda-dao` (outside this repository; the workspace is not under version control)
- **Engine version:** zhuda-laya-engine 1.18.0 at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c` (the game's `package.json`; its
  `README.md` still names the earlier pin `a5dfc6b…`: trust `package.json`). Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 125 of 125 before and after, `roll-check` 7 of 7 and `aim-check` 8 of 8 on the web build; the mini-game package was not rebuilt (the game's own code of 2026-11-25 is refused by the mini-game build for a browser API, and its main package is over the limit: neither comes from the engine)

## When to take this route

Real-time 3D action for a mini-game host, where package size, fill rate and memory on a phone shape the design as much as the
rules do. Read [new-game-project](new-game-project.md), [game-rules-first](game-rules-first.md),
[mini-game-build](mini-game-build.md) and [good-looking-3d-scene](good-looking-3d-scene.md) first.

Not for one large monster with frame-data moves ([hunting-action-3d](hunting-action-3d.md)), a 2D game ([game-2d](game-2d.md)),
realistic layered clothing ([layered-cloth-on-body](layered-cloth-on-body.md)) or a character made from nothing
([rigged-phone-character](rigged-phone-character.md), [model-from-dcc](model-from-dcc.md)). Nothing here is networked
(`online-lockstep-match`); for the mobile web rather than a host, see `mobile-always-landscape`.

## Tools

- Engine pin as above. Node 24 or later, TypeScript 5.9.3, `@gltf-transform/*` ^4.1.1, `meshoptimizer` ^0.22.0, `sharp` ^0.34.4;
  LayaAir 3.4.2 command line through `zhuda-laya-minigame` ([mini-game packaging](../minigame-packaging.md)).
- WeChat developer tools by its command line (`preview`, `upload`; version not recorded) and the owner's `wxgame` helper (`lower`,
  `subpack`, `check-pkg`) from the workspace's WeChat skill: not part of the game or the engine.
- Blender, headless (5.2 with the VRM add-on is named once), Cycles for baking. Pictures come from an image model the records call
  gpt-image-2.6, meshes from an image-to-3D tool they call Pixal3D (preset `balanced`). The second character is a VRoid avatar
  whose own VRM meta states its licence: read it before any reuse.
- Voice and music from the owner's local skills; sounds are CC0 recordings (`art/sfx-candidates/SOURCES.tsv`); the brush font is
  Ma Shan Zheng (SIL OFL 1.1). `art/` (3.6 GB of sources) never ships; `public/assets/` (34 MB) is what a package is cut from.

## Steps

### Project, build, package

1. **Configure and boot.** `zhuda.config.json`: `renderer: "webgl"`, features `core, 3d, gltf, postProcess`, viewport 1334 × 750
   `fixedheight`; `ZhudaEngine.boot({ …, dprCap: 2 })` in `src/Main.ts`. `enableHighPerformanceMode` and
   `enableHighPerformanceModePlus` under `minigame.targets.wxgame` reach `game.json` (seen 2026-11-21).
2. **Read files through the host.** `src/assets.ts PlatformAssetProvider` ([asset loading](../asset-loading.md)) reads with
   `wx.getFileSystemManager().readFile` in the host and `fetch` in a browser; give it to `new ZhudaModelLibrary({ provider })`.
   Import `src/polyfills.ts` first.
3. **One folder per subpackage** under `public/assets/`: `ui-main` (the font; main package), `sub` (scenery, UI art, sounds),
   `hero`, `zhuer`, `mobs`, `allies`, `bosses`, `dragon`, `drift`, `bgm1`, `bgm2`, `voice`, `sticker`.
   `platform.ts loadSubpackage` loads `sub` and `hero` under the boot screen, monsters in the background, the rest when wanted.
   Nothing is downloaded: every asset rides in the package.
4. **Build, lower, cut, measure.**
   ```sh
   npm run build:minigame -- --platform wxgame
   wxgame lower dist/minigames/wxgame/game --appid <app id> --name zhuda-dao --orientation landscape   # syntax for the host
   for p in sub hero mobs allies bosses dragon bgm1 bgm2 voice drift sticker zhuer; do
     wxgame subpack dist/minigames/wxgame/game assets/$p --name $p; done   # then the helper's check-pkg
   ```
   The host's limits in the records: main package 4096 KB, each subpackage 4 MB, 30720 KB in all. The server counts the main
   package about 4% above the local files (3,788,152 bytes were 3,939,619 there, 2026-11-19): keep `check-pkg`'s main `bytes`
   under about 4,000,000. `maxMainPackageBytes` is 30 MB because the engine's gate runs before the cut. `subpack` reports "main
   still over" part-way: no `set -e`.
5. **Preview on a phone**: the developer tools' `preview --project <dir> --qr-format image --qr-output <png>` in the background
   with no timeout; `upload` under `timeout 1200`. Record the sizes the server prints.

### Characters

6. **Monsters and bosses from pictures.** Picture → image-to-3D → `tools/slim-model.mjs` (`RATIO` 0.25–0.3 with 1024 px textures;
   0.1 with 512 px read as faceted lumps) → `blender -b -P tools/blender-bake-rig.py -- <high> <low> <out> <kind>` (bakes a normal
   map and AO from high to low; fits a skeleton by shape: `serpent`, `quadruped`, `golem`, `robed`; its own nearest-two-bones
   weights; clips Idle, a move, Attack, Hit, Die) → `tools/quantize-model.mjs` (`KHR_mesh_quantization`, about half the download).
   See [model pipeline](../model-pipeline.md).
7. **The hero's robe on spring bones.** `tools/blender-robe.py` builds the robe on the body and adds 26 cloth bones no clip
   drives; `DROP_ANIM='^(skirt|sash|sleeve)\.' node tools/quantize-model.mjs` drops the keys Blender writes for them.
   `src/cloth.ts ClothSwing` runs `ZhudaSpringBones` ([spring bones](../spring-bones.md)) after `anim.update`: skirt stiffness 9 /
   drag 5, sash 4 / 2.5, sleeves 7 / 4, sphere colliders on legs and belly; `reset()` when the model jumps more than 1.5 m.
8. **A VRM avatar as a playable character.** `bash tools/zhuer-build.sh <source.vrm>` (about a minute): `blender-zhuer-rig.py`
   (40,600 → 17,000 triangles), `blender-zhuer-clips.py` (29 clips keyed in code; `--analyze` and `tools/zhuer-clipcheck.py`
   measure jerks and limbs inside the body), `quantize-model.mjs`, then `tools/zhuer-vrm.mjs` writes `VRMC_vrm` and
   `VRMC_springBone` back by bone name, so `new ZhudaVrm(model, { mtoon: false })` applies them ([VRM](../vrm.md)). VRoid's
   springs suit a standing avatar: retuned in `TUNE` (twin tails gravity 0.25, drag 0.5; skirt flaps stiffness 4.4, drag 0.6,
   gravity 0.3). Drawn with `ZhudaToonMaterial` (`src/toon-hero.ts`, [stylized shading](../stylized-shading.md)): lit as the world
   is, her skin was plaster grey.
9. **A skirt as cloth.** `src/skirt-cloth.ts`: `createZhudaClothTube` and `ZhudaCloth` ([cloth](../cloth.md)), 40 × 13 particles
   in the skirt's measured profile, waistband sewn to hips, spine and chest, kind of cloth from `zhuda-engine-prefabs/systems/cloth-presets`.
   `SKIRT_TUNE`: feels 0.2 of her motion and 0.45 of her turning, strays 2 cm (waist) to 17 cm (hem) from its skinned shape,
   backstop 0.5–1.2 cm, bend `1e-5`, gravity 8, step 1/240 s. Check: `node tools/zhuer-skirt.mjs <url> <dir>` (longest stretch
   39%, nothing over 1 cm inside the body, 2026-11-25).
10. **Fewer triangles at the low setting.** `node tools/make-lod.mjs` writes `<model>.lod.bin` (meshoptimizer
    `simplifyWithAttributes`, error limit 5%: hero 57,874 → 20,255 triangles); `src/lod.ts` writes that list over the mesh's own.
    For levels by distance use `zhuda-laya-lod` ([model LOD](../model-lod.md)).
11. **Clips.** `src/animated.ts` on `ZhudaAnimationBlend` ([animation control](../animation-control.md)): 0.1 s cross-fades into
    attacks, gaits swapped in step and played at the feet's measured ground speed, `STANDS_IN` for clips a model lacks.

### Rules, bosses, story

12. **Rules first, shared rules synced.**
    `node node_modules/zhuda-engine-prefabs/scripts/sync.mjs . systems/pig-combat systems/cloth-presets` copies them to
    `src/common/systems/`. `src/combat.ts` (no LayaAir, seeded randomness) builds on `pig-combat`'s `JOBS`, `pressAttack`,
    `stepCombat`, `REACH` and `struck`: `createBattle(…)`, then `step(battle, dt)` returns `BattleEvent[]`. The view decides
    nothing: `Main.ts` steps the battle each frame and turns events into `vfx.ts` effects and sounds; `actors.ts` draws each
    `Enemy` from a pool of rigged copies and stretches its Attack clip to the wind-up. What only this game wants is changed on its
    in-memory `JOBS` at load, never in the synced file. The engine's [combat runtime](../combat-runtime.md) is not used.
13. **Enemies, bosses and stages as tables** in `combat.ts`: `STATS`, `BARS` and `PHASES` (three health bars, each a way of
    fighting: damage 0.8 / 1.0 / 1.3, pause after a blow 1.6 / 1.0 / 0.6), `tierAt` (realms scaling life and damage), `ELITE`,
    `AFFIX`, `KING`; arenas and walkable land in `world.ts`. Every enemy attack is a ground shape (circle, line, cone) filling
    over its wind-up; `fairWindup(shape)` keeps each at least 0.25 s of reaction plus the walk out at 5 m/s, and a test checks
    every move. Balance with scripted players in `tests/` first.
14. **Story as data.** `story.ts LINES` (id, speaker, text, emotion) and `SCENES`; the voice batch is generated from `LINES` and
    shipped as 40 kbit/s mono mp3, `public/assets/voice/<id>.mp3`. `staging.ts STAGED` directs a boss scene beat by beat: a camera
    for each line (`close`, `over`, `low`, `two`, `wide`), a clip, a head gesture on the `head` bone, cues at a share of the line.
    `sound.ts` ducks music to 28% under a line ([audio](../audio.md)).

### Scene, camera, touch

15. **World.** `ZhudaTerrain3D` ([terrain](../terrain-shader.md)), `ZhudaInstancedMesh` for trees
    ([instanced meshes](../instanced-meshes.md)), one `ZhudaSceneLook` a scene with `quality`, `scale`, and `cameraPasses` only
    where there is water ([quality route](../quality-route.md)). Build only the land the stage uses and close it with rising
    ground and trees, not an unseen wall.
16. **Camera.** `ZhudaCameraRig` ([3D integration](../3d-integration.md)) in `orbit` mode (2.5–12 m), lowest pitch 13°, the sight
    line kept above `World.heightAt`; pulled to 0.45 m before the first blocker (`World.cameraClear`: trunks, pillars, monsters,
    roofs), in at once and out slowly.
17. **Touch in landscape** (`Main.ts`, `skill-bar.ts`). A fixed stick bottom-left (safe-area left + 170, bottom − 170 design px,
    radius 86; a press within 150 px walks); a drag anywhere else turns the camera. Four round skill buttons bottom-right (radius
    64 under the thumb, 50 for the rest). A tap casts where the player aims: stick direction or facing, the nearest enemy within
    60° either side and 12 m, else 2 m ahead. Hold and drag opens an aim wheel of 230 px centred on the finger (dead zone 16 px,
    reach `u^1.6`, a cancel zone). A press in the last 0.3 s of a cooldown is kept. Close buttons keep 72 design px clear of the
    host's capsule (`platform.ts clearOfCapsule`).

### Performance, memory, saving, host

18. **Quality levels** (`settings.ts`). Low, the host's default: look 0, `renderScale` 0.7, 1024 shadow map, no particles in
    fights, LOD, blob shadows. High: look 2, full scale. `platform.ts setFrameRate` (`wx.setPreferredFramesPerSecond`): 30 outside
    fights, 60 in fights and while loading (at low, 30 again if a 4 s mean is under 42).
19. **Loading.** Build the scene in steps under an opaque screen with `camera.enableRender = false`, yield a frame only when 45 ms
    have passed, then switch things on in batches while shaders compile ([shader warm-up](../shader-warm-up.md)).
20. **Between scenes.** `src/resources.ts`: `markBaseline()` once the title is up, `sweepScene()` after `scene.destroy(true)`;
    anything cached across scenes sets `lock = true`.
21. **Saving.** One JSON under a versioned key through `platform.ts loadJson` / `saveJson` (`wx.setStorageSync` or
    `localStorage`), `skills.ts migrate()` on every load, the place saved every 10 s and on hide.
22. **Host manners** (`platform.ts`). `onHide` / `onShow` release the stick and keys; music is restarted when an ad closes, an
    audio interruption ends, and on show; a rewarded video only from a button that says so, shown only when one has loaded. A
    diagnostics line (five taps on the settings title, or `?debug`) shows load timings, safe area, capsule, and whether iOS
    high-performance mode is on. Test hooks are installed only outside the host.

## Pitfalls

- **Every quantized model failed on the iPhone** (the hero was missing, 2026-11-19). The engine's GLB intake turns
  `KHR_mesh_quantization` back into floats with `TextEncoder`, which WeChat iOS lacks; `src/polyfills.ts` supplies it and
  `TextDecoder`. Reproduce in Chrome by deleting `TextEncoder` before boot. Print load failures on screen.
- **Main package over the limit on the server, under it locally.** A full upload took 5–10 minutes and the tool's upload process
  ends after exactly 10. Probe with a copy whose subpackage folders hold only `game.js`. Keep the font in the main package.
- **Killed for memory on the fourth dungeon visit** (iPhone, 2026-11-20). Destroying a `Scene3D` leaves its meshes, materials and
  textures: about 580 a visit. Step 20. Also `renderer.materials` clones on every read (use `sharedMaterials`), and an unlocked
  mesh cache swept away broke the way back to the village.
- **16–28 fps on a vivo V40 at low** (2026-11-20): fill rate, not script (about 0.3 ms a frame) nor shadows. `renderScale` 0.7
  fixed it; LOD triangles and blob shadows came after a mid-range Android phone showed 22 fps.
- **12–15 s to enter the dungeon on the V40.** The time went to waiting for frames (99 under a 30 fps cap) with the 3D scene drawn
  behind an opaque screen. With step 19 the V40 showed 2.3 s. Earlier, a portal check ran `enterWorld` three times over.
- **Effects that never showed.** Particles were simulated and never drawn (`renderer.render(camera)` was not called).
  `UnlitMaterial.albedoIntensity` takes effect only when `albedoColor` is next set, so 32 fades did nothing (`vfx.ts liven()`). A
  particle mesh kept its first draw count until the engine's `025dc21`; the game's own line for it in `fx.ts` can go.
- **HUD and markers misplaced on phones.** WeChat iOS gives a landscape game's `safeArea`, and at times its window size, in
  portrait coordinates (`platform.ts safeArea()` turns them). LayaAir's `worldToViewportPoint` divides by `stage.clientScaleX`:
  health bars sat at two thirds of their place. Project with `camera.projectionViewMatrix`, or the engine's `stage.worldToScreen`.
- **The brush font silently replaced on phones.** The host's canvas takes one family name, not a list and not one with a space,
  while `wx.loadFont` reports success (`tools/font-rename.py`). The font is subset to the characters used: re-subset for new text.
- **Rigging.** IK hinge signs reversed turned each thigh half round its length and put skirt flaps between the legs; a collider
  enclosing a spring's root never lets it settle; springs too stiff buzz (`tools/zhuer-springs.mjs` measures it); a root scaled
  1.25 needs its collider offsets and radii scaled too; `prune()` stripped UVs from untextured parts and they were not drawn; a
  LOD index list must be reversed as LayaAir's glTF loader reverses its own.
- **Image-to-3D output.** Meshes are not closed (heat weights fail); the unseen back is invented (`--keep-front` cuts it off);
  buildings came out crooked and were rebuilt in code (`src/village-build.ts`).
- **Two clocks.** The runtime pauses when the page loses focus ([platform adapters](../platform-adapters.md)), but LayaAir's own
  `Animator` on cloned models plays on: set its speed to 0. A page started in a hidden pane has a 2 × 2 canvas and its shadows
  stay broken: wait for 64 × 64.
- **Tool traps.** `auto-preview` hangs; repeated previews from one folder end in `compile_start` error 10 (copy the build
  elsewhere); a screenshot stalls the page clock; saves are per origin, so serve `dist/web` on another port than the player's.

## Engine gaps and their workarounds

No engine plan item is named for any of these in the game's records.

| Gap | Workaround in the game |
| --- | --- |
| GLB intake needs `TextDecoder` and `TextEncoder` (`packages/core/runtime3d/GltfIntake.ts`), absent on WeChat iOS | `src/polyfills.ts` **After 2.0.0:** the engine reads and writes that text itself where the host has neither (`zhudaUtf8Decode`, `zhudaUtf8Encode`); the polyfill is no longer needed for it. |
| `zhuda-laya-minigame` has no subpackage cut, orientation or syntax lowering; its size gate sees the whole output | the owner's `wxgame` helper; gate raised to 30 MB **After 2.0.0:** `minigame.syntaxTarget` (down to `es2017`) and `minigame.orientation` (written to `game.json`; refused for the signed quick-game targets). Subpackages and a size gate per package are still open. |
| `DirectoryAssetProvider` is refused in a mini-game build | `src/assets.ts` |
| No host bridge: safe area, capsule, frame rate, storage, ads, audio resume | `src/platform.ts` |
| Nothing releases what a destroyed scene leaves | `src/resources.ts` |
| No level of detail by quality setting on one mesh | `tools/make-lod.mjs`, `src/lod.ts` (private `_setIndexRange`, `_updateRenderParams`) |
| `ZhudaAnimationBlend` takes at most 32 clips a model | `STANDS_IN` in `src/animated.ts` |
| Compressed textures did not fit: ASTC grew the package about 5 MB; Basis ([basis textures](../basis-textures.md)) needs WASM, off in this build | smaller JPEG and PNG (`tools/glb-shrink-texture.py`) |
| WeChat's engine plugin: the build refuses dropped pinned libraries, and WeChat had no LayaAir 3.4.2 plugin (2026-11-21) | not used; patch kept in `tools/patches/` |

## Checks

All from the game's HANDOFF; none was re-run for this page.

- `npm run verify` (build, `tsc --noEmit`, Doctor, `node --test`): 125 of 125 tests on 2026-11-26. No pixel is measured.
- In-game checks, headless, `node tools/<name>.mjs <url> <dir>`: `roll-check` 7 of 7 (2026-11-26); `aim-check` 8 of 8,
  `enchant-check` 7 of 7, `sprint-check`, `zhuer-skirt` (2026-11-25); `zhuer-check`, `training-check` (2026-11-24, after the
  engine upgrade); `village-reach` (2026-11-22). Some were edited later and not run again; `battle-check.mjs`, a bot playing the
  whole loop, last passed on 2026-11-21 and is out of date.
- Memory, `node tools/mem-report.mjs <url> <dir> low` (its own estimate, as `Resource.gpuMemory` leaves out most textures;
  2026-11-21, desktop Chrome): textures about 148 MB (82 MB inside models), script heap 95–129 MB.
- In the host: iPhone 14, low, 2026-11-19: menu 55 fps, hub 57–59, dungeon 55–57; high: 21–23 in the dungeon. vivo V40, low,
  2026-11-21: dungeon entry 2.3 s, fights 29–34 fps under a 30 cap; high: 12–22.
- WeChat cloud test of 12.0.1 (2026-11-21; 2 iPhones, 8 Android phones): no failed device, no script error; start 2.2–6.9 s;
  28 fps average under the 30 cap; Android memory 730–1146 MB on average, peak 1296 MB; 78–141 draw calls. Report under `art/qa/`.
- Sizes from the server (2026-11-21): main 3955 KB of 4096, all 29063 KB of 30720. On 2026-11-22 it refused a main of 4103 KB.

## Not checked

- On a phone, anything after 2026-11-21: the village, the second character, VRM springs (93 bones), the cloth skirt (1.25 ms a
  frame on the development Mac only), sprint, roll, and low at a 60 fps target with LOD.
- The present tree as a package: 37.1 MB with a 12.9 MB `sub` folder (2026-11-25). It must be split and slimmed.
- The outcome of the review of 12.0.1, any release, and whether iOS high-performance mode was switched on in the account's backend
  (the `game.json` flags alone do not do it).
- Remote (downloaded) assets, compressed textures in a package, WebGPU, any host but WeChat, engine 2.0.0; the second and third
  bosses and the ending in play (their art is parked in `art/later/`); timings as felt by other players.

## Boundaries

- **Game:** its rules above the shared ones (`combat.ts`, `skills.ts`), story and staging tables, world, UI, `platform.ts`, the
  asset tools under `tools/` (some hold paths of the machine they were written on: pass paths explicitly) and all art.
- **Prefab library:** `zhuda-engine-prefabs/systems/pig-combat` (rounds, reach, hits) and `zhuda-engine-prefabs/systems/cloth-presets` (kinds of cloth,
  wind). Change them there and sync; `sync.mjs . --check` says whether a copy has drifted.
- **Engine:** boot, scene look, model library, clip blending, spring bones, cloth, VRM, toon material, terrain, instancing and the
  mini-game build. The game imports only the package's public entries (Doctor checks it).
- **Owner:** the account, app id, ad units, review and release; each is asked first. Where the game is published is recorded in
  the owner's portals (see `PORTALS.md` in the workspace).
