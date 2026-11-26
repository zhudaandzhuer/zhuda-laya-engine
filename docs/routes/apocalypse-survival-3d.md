# Route: A 3D post-apocalyptic survival shooter with a Windows package

One survivor with a carbine in a fenced street block about 40 m across: collect three batteries, hold off infected that grab, shelter in a safehouse, call the extraction. Keyboard and mouse drive it; an authored camera plays the intro and the shelter scenes; a Go service holds the session boundary. Recorded on desktop WebGPU only (headless Chrome and an Electron smoke run on an Apple GPU).

- **Id:** `apocalypse-survival-3d`
- **Kind:** workflow
- **For:** building a single-player 3D survival shooter on WebGPU from heavy GLB/PBR assets, with a prefab gate, particles, voiced story shots, a Go session service and an Electron package for Windows
- **Checked on:** desktop WebGPU (headless Chrome 157 on an Apple GPU through Metal; Electron 45.2.3 smoke run on macOS, Apple M4); desktop Safari measured too slow before a fix and not measured after; no Windows GPU, no WebGL build, no phone
- **Status:** written on 2026-11-26 from the game's records, nothing was run for this page; last recorded `npm run verify` on 2026-11-13: 44 tests, Doctor healthy, 3 Prefab checks with 0 differing pixels; Windows hardware, phones and a person's full play-through are not recorded
- **Reference consumer:** ZhudaGameCenter `games/pigfall-apocalypse` (outside this repository; the workspace is not under version control)
- **Engine version:** zhuda-laya-engine 1.18.0 at `d61f6dbd7ff48f53ba0d253046286b7c25573b6e` (raised on 2026-11-13 from `dd9b5fd`, 1.15.0). Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 44 of 44 with Doctor HEALTHY, the three prefabs accepted at 0 different pixels against the kept baselines (WebGPU, headless Chrome 158), Go tests ok; the Windows package was not rebuilt

Read [new-game-project](new-game-project.md), [game-rules-first](game-rules-first.md) and [visual-content-prefab](visual-content-prefab.md) first.

## When to take this route

A single-player action game in one small 3D arena, built from large generated models, that ships
as a WebGPU web build and as a Windows desktop package, and that was moved in from a prototype
(`prototype-to-center` covers the move itself).

Not this route: one large boss with dodge frames ([hunting-action-3d](hunting-action-3d.md));
hundreds of enemies ([survivors-2d](survivors-2d.md)); a real online match (`go-game-server`,
`online-lockstep-match`: the server here is a seam, not a match); a phone game (no touch controls,
386 MB of assets); a page that must also run on WebGL (`"renderer": "auto"`,
[backend delivery](../backend-delivery.md)).

## Tools

- Engine pinned by commit in `client/package.json`; Node 24 or later; TypeScript 5.9.3; `esbuild`
  0.27.1 for the tests, which arrives with the engine package and is not declared by the game.
  Engine commands: `zhuda-laya-build` (`--candidate`), `zhuda-laya-accept`, `zhuda-laya-doctor`.
- Electron 45.2.3 (Chromium 156) and `@electron/packager` 20.3.0. Go 1.23, standard library only.
- Models: image-to-3D with Pixal3D on the owner's machine (MIT licence text in
  `client/public/licenses/`) and two character files the owner supplied, reduced and rigged in
  headless Blender (5.2 in the game's record) by `client/scripts/prepare-*.py`; source and target
  hashes and triangle counts are in `client/source/`. No licence is recorded for the models.
- Sound: effects synthesised by `client/scripts/create-audio.py`, later filtered; seven voice
  lines from the owner's local text-to-speech; a sting composed locally; the score is a
  third-party track under CC BY 4.0, credited in the game's credits (`client/src/menu-panels.ts`).
- `node_modules/`, `dist/`, `release/`, `temp/` are ignored; evidence goes to `client/temp/`.

## Steps

1. **Split the prototype.** `client/` imports only the engine's public root; `server/` is Go.
   `MIGRATION_INVENTORY.md` lists what moved and what was left out on purpose.
2. **Configure.** `client/zhuda.config.json`: features `core, 2d, 3d, ui, gltf, postProcess`,
   `"renderer": "webgpu"`, `"maxPackageBytes": 500000000` (the default limit is 50 MB),
   `prefabPreview` and three `prefabChecks`. Boot in `client/src/Main.ts` with `dprCap`, `signal`,
   `bootTimeoutMs: 30000`, `clearInput`, `onContextLost` ([consumer route](../consumer-route.md),
   [WebGPU](../webgpu.md)). Check: `npm run doctor`.
3. **Rules in plain TypeScript.** `client/src/rules.ts`: one `Save` object, a seeded generator,
   `update(dt, input)` returning events. Moves are `ZhudaActionFrameSpec` at 60 frames a second on
   `ZhudaActionStateMachine` ([combat runtime](../combat-runtime.md)): shot 9 frames (fires on 1),
   reload 72 (loaded on 60), stock swing 20 (lands on 6), escape shove 36 (lands on 17). Win:
   three batteries, then 3 s within 1.55 m of the radio. Check: `npm test`.
4. **One layout for feet, bullets and the camera.** `client/src/layout.ts`: boxes on the ground
   with an optional yaw; `pushOut` moves first, then pushes the circle out of what it overlaps, so
   bodies slide along walls; `raySolid` wraps the engine's `rayBox`
   ([3D integration](../3d-integration.md)). `python3 scripts/make-colliders.py` fits one turned
   box per placed model from its GLB vertices into `src/colliders-generated.ts`; `?colliders`
   outlines them. Check: `tests/colliders.test.mjs` fails when a model moved without a re-run.
5. **Provider and manifest.** `npm run assets:manifest` writes each asset's bytes and SHA-256 to
   `src/asset-manifest.ts`. Previews, scene and sound share one `DirectoryAssetProvider` factory
   in `src/prefabs.ts`, `maxBytes: 60000000` for a 56.7 MB model ([asset loading](../asset-loading.md)).
6. **Prefab gate for built geometry.** Shelter, supply case and radio are `Prefab3DDefinition`
   trees of boxes (`src/shelter.ts`, `src/prefabs.ts`), checked at 640 by 480, DPR 1, 30 cycles.
   Order: `npm run build:candidate`, `npm run accept:prefabs -- --capture`, look at the pictures,
   `npm run accept:prefabs`, `npm run build` ([prefab workflow](../prefab-workflow.md)); from 1.18
   the release build refuses stale evidence, so repeat it after every source change. The scene
   mounts the same definitions through `ZhudaPrefabLibrary` (`src/world.ts`).
7. **GLB through the model library.** `src/scene-assets.ts` holds recipes (id, file, position,
   rotation, scale) for `ZhudaModelLibrary.instantiate` with `independentMaterials: true`. Each is
   seen alone first: `?preview=asset&id=<recipe>`, `?preview=character&character=zombie`,
   `?preview=effects`. Budgets used: props 18,000 to 36,000 triangles with 2048 px textures;
   asset-pack pieces 24,000 to 50,000 with 1024 px; survivor 120,000, infected 40,000
   ([model pipeline](../model-pipeline.md), [model-from-dcc](model-from-dcc.md)).
8. **Characters.** `src/characters.ts`: `ZhudaModelInspector` finds the animation root and the
   `Muzzle` and `Aim` nodes; cross-fades of 0.13 s keep the phase between walk and run clips; an
   upper-body override layer masked to spine and head plays the recoil
   ([animation control](../animation-control.md)). Ten infected are loaded up front.
9. **Look.** `src/game.ts`: sun with `SoftLow` shadows, 768 px over 22 m (`SoftHigh` at 2048 px
   only under `?capture`); `ZhudaFilmicPipeline` at exposure 1.16, contrast 1.08, saturation 0.75,
   bloom 0.06, with ambient occlusion and temporal anti-aliasing only under `?capture`;
   `createPrefilteredEnvironment` from `environment/evening.f32`; ground and walls on
   `ZhudaLitSurfaceMaterial`; puddles on a 192 by 108 `ZhudaPlanarReflection` updated every twelfth
   frame ([filmic rendering](../filmic-rendering.md), [good-looking-3d-scene](good-looking-3d-scene.md)).
10. **Time and input.** Rules step on `runtime.layers.sample('world').scaledDeltaTime`, the HUD on
    the `ui` layer; `world, player, enemy, vfx` pause outside play. Reload and interact go through
    a `ZhudaInputBuffer` (0.18 s). Keys clear on blur, `pagehide`, hidden page and pause.
11. **Controls the player accepted** (`src/action-controls.ts`, `src/shoulder-camera.ts`):
    direction keys are directions on screen; the survivor turns at 21 rad/s to where he walks;
    fire goes straight ahead and snaps to the nearest infected within 0.56 rad and 18 m; the
    camera is fixed 6 m behind and 8.5 m up, looks 1.2 m ahead, field of view 52, and never turns.
12. **Authored camera.** `src/director.ts` picks a shot (eye, target, field of view) by rule
    status: three intro shots that hand back to the live camera by 8.5 s, a cut at 2.7 s when
    entering the shelter, a slow push while resting. Shots blend in yaw, pitch and distance; a cut
    calls `film.resetHistory()`; the first pointer input ends the intro pose. Subtitles and voice
    share `src/lines.ts`. `ZhudaTimelineSequencer` ([cinematics](../cinematics.md)) was not used.
13. **Particles.** `src/effects.ts`: six `ParticleEmitterSpec3D` (muzzle, smoke, sparks, dust,
    debris, casing; 24 to 128 particles, seed 42, `rate: 0` and `burst`) on `ZhudaParticleSystem3D`
    with `ZhudaLayaParticleRenderer3D` ([particles](../../packages/core/particles/README.md));
    textures painted in code; tracers are 32 quads on two `ZhudaDynamicMesh`.
14. **Sound.** One `IframeSoundAdapter` on the same provider, 20 voices, overflow `fifo`; 13
    samples (the score among them) and 7 voice lines loaded with `loadSample` before the title;
    channels `bgm` (score, looped, `peakGain: 0.33`), `sfx` and `ui` (voice, one id with
    `replace`); `unlockAudio` on the first press ([audio](../audio.md)).
15. **Menus from the prefab library.** `prefabs/ui/game-menu`, `prefabs/ui/settings-form` and
    `prefabs/ui/dom` (library 0.2.0 in `client/common-prefabs.lock.json`), copied with
    `node node_modules/zhuda-laya-engine/prefabs/scripts/sync.mjs . ui/game-menu ui/settings-form`.
    Colours are the `--cp-menu-*` variables in `client/public/main-menu.css`; never edit the copies.
16. **Loading and fallbacks.** World and survivor load together; the close-up model loads on the
    loading screen; twelve frames behind the title draw it and every infected (`?nowarm` skips).
    Safari renders at scale 1 (`?dpr=N` overrides). In play, a median frame over 40 ms across 180
    frames turns shadows off once. Device loss: the rules snapshot goes to `sessionStorage` and the
    page reloads. No WebGL fallback: a failed boot shows an error. Checks read `pigfall.report()`.
17. **Windows package.** `npm run package:win` (`client/scripts/package.mjs`) packs `electron/`
    and `dist/web` for win32 x64 with asar. `client/electron/main.cjs` serves the build from a
    privileged `pigfall://app` scheme with a content security policy that allows
    `'wasm-unsafe-eval'`, cancels requests to any other scheme, forces the high-performance GPU
    and grants only pointer lock. `scripts/check-package.mjs` compares packed files with the build
    by SHA-256. Acceptance entry: `npm run accept:windows` starts the packed program with
    `--acceptance`: `electron/qa/verify-webgpu.mjs`, then `game-acceptance.mjs` with real input.
18. **Go service.** `server/internal/session`: an in-memory `Store` behind a mutex; HTTP on port
    8788: `GET /healthz`, `POST /api/v1/sessions`, `GET` and `POST /api/v1/sessions/{id}` with
    `{"kind":"move|shoot|pickup|pause|reset"}`. It is the authority for session id, status,
    position (a move is clamped to 1 per axis), health, ammunition, collected flags and revision.
    The client does not call it yet; all play rules run in the client.
19. **Size.** Recorded on 2026-11-13: ZIP 388,281,766 bytes, 424,562,315 unpacked, 88 entries. By
    file size on 2026-11-26: props 180 MB, models 95 MB, environment 90 MB, sound 24 MB.

## Pitfalls

- **Controls and camera were redone round after round on 2026-11-13.** The player said moving
  stuck and aiming was wrong; measured, the page held 60 frames a second (p99 16.8 ms), so it was
  design. Shoulder camera with crosshair, free cursor, then pointer lock were all rejected; step
  11 is what stayed. Measure first, then let a person play before tuning further.
- **Models could be walked through, then bodies stuck on corners.** Only some props had
  hand-written boxes, blocking was tested per axis, the arena edge was invisible. Fix: step 4 and
  a visible fence. A sweep (a point every 2 m, eight directions) found the worst boxes.
- **Left and right were mirrored.** The camera's right was taken as +X; looking along +Z the
  screen's right is -X. Three places changed (move vector, shoulder side, mouse turn).
- **Z-up exports stood as 2 m walls.** `cracked-floor.glb` and `weed-clump.glb` needed 90 degrees
  about X. `boundary-fence.glb` only looked the same: its origin is at mid-height (lift 1.25 m).
- **Retina drew a quarter of the canvas.** The engine applied the CSS scale twice before 1.18.0
  (commit `391db93`). Headless checks at DPR 1 missed it: run them at DPR 2 as well.
- **The intro froze 2.6 s.** A 56 MB close-up model loaded when the camera first came near. After
  step 16 the longest intro frame was 67 to 83 ms in three runs.
- **He kept walking after the keys were released.** Rules normalised any input above zero to full
  speed and the eased input never reached zero. Speed now follows input size; under 5% is 0.
- **Infected flickered and jumped.** Models were bound to enemies by list index, and rules set
  positions directly in three places. Bind by id; walk to the place at a speed.
- **A drone through the whole run.** A second `playSample` with `replace` on the music channel
  swapped the score for a synthetic ambience. Footsteps (-15.9 LUFS, now -29) beat the gunshots.
- **Pointer lock refused without a word.** Browsers reject, fire `pointerlockerror`, or do
  nothing. Not locked 0.5 s after asking means fall back to the cursor and say so.
- **Safari.** About 80 s to load and one frame in 15 s at 2814 by 1758; Chrome on the same
  machine held 60. Render scale 1 for Safari; the result was not measured.
- **A grab could hold the player until death,** and the stock swing was slower than the grab.
  A grab now ends by itself in 1.8 s; the swing has its own fast spec and a 0.9 s cooldown.
- **Smaller ones.** A turn of exactly half a circle shook until `turnToward` kept its last side.
  Temporal anti-aliasing smeared moving bodies. `.modal-copy button` painted the shared menu's
  buttons (use `>`). Automated screenshots tripped the quality drop until its window was widened.

## Engine gaps and their workarounds

- No footprint colliders from a GLB and no circle-against-turned-box push-out: the game's
  `make-colliders.py` and `layout.ts`. No plan item known.
- No follow or overhead camera rig with a boom (`src/shoulder-camera.ts` on `ZhudaSceneQueries`)
  and no static merge of a prefab tree (`src/static-batch.ts` merges by material).
- No desktop packaging command: the game carries its own Electron host and checks. The engine's
  example host ([packaged Windows application](../webgpu.md#packaged-windows-application)) existed
  at the pin and was not used; this route did not compare the two.
- From the prototype's pin, not re-tested: normalised vertex colours in a GLB were not accepted
  (`scripts/normalize-gltf-colors.py` rewrites them as floats); the browser fixture raced Chrome's
  profile folder on Windows (`scripts/windows-browser-compat.mjs` retries, kills the process tree).
- Arrived after the pin, so unused by the game; use in new work: [shader warm-up](../shader-warm-up.md)
  for step 16's hand-drawn frames; `"renderer": "auto"` with `retryZhudaBackend` for a page that
  only fails; `zhuda-laya-lod` ([model levels of detail](../model-lod.md)) for the close-up swap.
- Unexplained: once at load `laya.webgpu_3D.js` threw on `Render3DModuleDataFactory` of undefined
  (a reload cleared it); a hidden tab logs `RenderTextureMRT dimensions must be positive integers`.

## Checks

- From the game's records, each with its date. `cd client && npm run verify` (release build with
  the Prefab and size gates, `tsc --noEmit`, Doctor, `node --test`): 44 of 44 tests, Doctor
  healthy, 2026-11-13 (HANDOFF, twelfth round).
- `npm run accept:prefabs`: 3 prefabs, 0 differing pixels, 30 mount cycles each; Chrome
  157.0.8103.39, WebGPU, Apple adapter on Metal 3, not a fallback adapter; files of 2026-11-13.
- Headless Chrome on WebGPU, 2026-11-13: title, settings, start, intro, pause and back to title
  with no renderer or console error; 6 s of walking and firing at 60 frames a second at DPR 1
  and 2; at DPR 2 the canvas is 780 by 880 with no extra transform.
- Electron on macOS (Apple M4), 2026-11-08, at the earlier pin: `--smoke` passed with WebGPU
  ready on a hardware adapter; in a separate run a mouse drag turned the camera (yaw 0 to 0.72).
  The full synthetic route did not pass: the scripted player died; recorded as unavailable.
- `npm run package:win`, 2026-11-08, earlier pin: 73 files, asar 422,370,625 bytes. Its report's
  `engine` field was hard-coded then; the script now reads `package.json`.
- `cd server && go test ./...` passes (HANDOFF, 2026-11-13); `go test -race` and `go vet` pass
  (verification report, 2026-11-08).

## Not checked

- Windows: hardware WebGPU, the packed program and `npm run accept:windows` were not run after
  the move; the prototype's earlier Windows delivery was left behind with its results.
- Phones and touch. WebGL. Safari after the scale change. Pointer-lock feel in a real browser.
- A person playing to extraction after the control changes; difficulty (the record says easy);
  loot and the double on screen (rules are tested, pictures were not looked at); sound by ear.
- `electron/qa/main-menu.mjs` still expects the earlier menu. The package and the Electron runs
  were not repeated after the upgrade to 1.18.0. Nothing was run at 2.0.0.
- The client against the server; more than one player; persistence; GPU time. Publishing: on
  none of the owner's portals (see `PORTALS.md` in the workspace). Open picture defects:
  untextured far buildings, floating debris in the intro, seams in the ground plates.

## Boundaries

The game keeps its rules, layout, recipes, assets and their provenance, story lines, voice, shots,
Electron host with its checks, and the Go session service. The prefab library holds the menus
(`prefabs/ui/*`); the game's HANDOFF names the supply case, radio and shelter as next to move
there (`game-to-prefabs`). The engine owns boot, libraries, provider, particles, sound, the filmic
pipeline, action frame data and the build gates; it takes no game rules and none of its assets.
