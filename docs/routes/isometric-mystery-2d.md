# Route: An isometric 2D mystery walked with a torch

A ten-minute investigation game on the Laya 2D stage: the player walks a three-level street seen from one fixed
isometric angle, points a torch that relights the picture every frame, questions people, collects clues, breaks an
alibi and names the culprit. Street, light, rain and effect sounds come from recipes at load, the characters from
illustrated action sheets in one atlas, the case from plain data. Keys and mouse, or a virtual stick. The reference
game ("豬大 - 雨夜殺人事件") records runs on desktop Chromium (WebGL) and one Android phone; this page re-ran nothing.

- **Id:** `isometric-mystery-2d`
- **Kind:** workflow
- **For:** building a short isometric 2D investigation game: a baked multi-level map, a torch that relights it every frame, illustrated characters from one atlas, and clues, dialogue, a collection book and an accusation held as data
- **Checked on:** desktop WebGL (Chromium, DPR 2; headless Chrome); vivo V40 (Android 16, Chrome, portrait); no iOS, no WebGPU
- **Status:** from the game's HANDOFF, not re-run here: `npm run verify` 33/33 with Doctor HEALTHY on 2026-11-20; the whole case played in desktop Chromium WebGL in three languages on 2026-11-12 and on a vivo V40 at 60 FPS on 2026-11-20
- **Reference consumer:** ZhudaGameCenter `games/zhuda-rainy-night-murder` (outside this repository; the workspace is not under version control)
- **Engine version:** `zhuda-laya-engine` 1.18.0 at `d61f6dbd7ff48f53ba0d253046286b7c25573b6e` (the game's `client/package.json`, `client/zhuda.config.json` and HANDOFF). Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 33 of 33 before and after with Doctor HEALTHY, Go tests ok, the Node playthrough ok; the Laya picture was not looked at in a browser

Read [new-game-project](new-game-project.md), [game-2d](game-2d.md) and [game-rules-first](game-rules-first.md) first:
this page adds what this kind of game needs. Paths are relative to the game.

## When to take this route

- A story walked on foot through one place seen from one fixed angle: the place does not change, so its picture, depth
  and normals are made once at load, and only a few things move (people, light, weather). Illustrated characters with
  a front and a back view and a two-frame walk; mostly talk and choices; one player; state in the browser.
- Not for a map of square tiles ([platformer-2d](platformer-2d.md)); hundreds of moving things
  ([survivors-2d](survivors-2d.md)); a camera that turns or real 3D light
  ([good-looking-3d-scene](good-looking-3d-scene.md)); rigged characters ([spine-character](spine-character.md)) or
  many poses per character (`pose-atlas-motion`); talk with no walking (the prefab `prefabs/ui/visual-novel`); a
  server that judges or keeps saves (`go-game-server`).

## Tools

- Engine: the pin above, `features: ['core', '2d']`, `zhuda-laya-build`, `zhuda-laya-doctor`
  ([consumer route](../consumer-route.md)). Node 24 or newer, TypeScript 5.9.3. Go 1.23 (`server/go.mod`), standard
  library only. Python 3 with Pillow, numpy, scipy; `ffmpeg` (no versions recorded).
- Pictures, as the HANDOFF records them: an image-generation tool ("codex-imagegen", model `gpt-image-2-codex`), one
  1536 x 1024 transparent sheet per character, the lead from the owner's reference drawing and the others styled after
  the lead's sheet; prompts in `client/art/characters/prompts/`. Voices: a local text-to-speech model (Qwen3-TTS).
  Both are generated content, which a store asks to be disclosed. No licence file; sources stay in `client/art/`.
- Shared prefab modules ([prefab library](../../prefabs/README.md)), copied into `client/src/common/` and
  `client/public/common/` and never edited there:
  `node node_modules/zhuda-laya-engine/prefabs/scripts/sync.mjs . ui/virtual-stick ui/dom ui/dialog ui/toast ui/collection-book input/move-input systems/storage systems/i18n`
- Engine API from the public entry only, re-exported by one file, `client/src/zhuda.ts`; the guides are
  [procedural assets](../procedural-assets.md) and [asset loading](../asset-loading.md) (`DirectoryAssetProvider`).

## Steps

1. **Move the prototype onto the engine** (`prototype-to-center`; the prototype was a
   [single-html-page](single-html-page.md)). Sources move to `client/src/` unchanged, entry `Main.ts`; in
   `client/public/index.html` the inline scripts become `<!-- ZHUDA_LIBS -->` and `<!-- ZHUDA_ENTRY -->`;
   `zhuda.config.json` gets `features: ['core','2d']`, `dprCap: 3`, viewport 1280 x 720 `scaleMode: 'full'`;
   `zhuda-laya-build` replaces the prototype's build ([required shape](../consumer-route.md#required-shape)). One code
   change: `globalThis.ZhudaBundle` exists only in the single-file SDK, so `client/src/present.ts` falls back to
   `webgl`, `['core','2d']` and `ENGINE_VERSION`. Check: Doctor HEALTHY; `tests/engine-pin.test.mjs`.
2. **Boot as modules.** `bootZhudaModules` in `client/src/Main.ts`: `content`, `bake`, `story`, `nav`, `audio` (stub:
   silent), `characters` (stub: none), `game`; a stub keeps the case playable when sound or the atlas fails, and
   errors go to `window.__errors`. `parseZhudaRunParams` and `createZhudaRandom(seed).fork('district')` give the same
   street every run ([module boot contract](../procedural-assets.md#module-boot-contract)).
3. **Build the place from props, in metres.** `client/src/world.ts`: a 32 m block on three levels (court 0, alley and
   terraces 3.2 m, deck and gallery 6.4 m) and six `stairs` props, through `ZhudaPropRegistry` and
   `mergeZhudaPlacedProps` ([props](../procedural-assets.md#props)). Colliders carry the meaning: `floor:asphalt`,
   `floor:tile`, `floor:grate` are floors, `solid` blocks. `client/src/content.ts`: twelve recipes baked at
   `size: 128` by `bakeZhudaTextureSet`.
4. **Bake the picture once, on the CPU.** `bakeScene` in `client/src/engine.ts` is the game's own rasteriser, not an
   engine renderer: screen x = (x - z)·S + ox, screen y = (x + z)·S/2 - y·H + oy, S = 34 px per metre, H = 1.2247·S,
   depth = 0.6124·(x + z) + 0.5·y. Passes: raster, ambient and corner shade, the street's lights, wet-ground
   reflections, ink lines, glow, tone map. Output: a 2000 x 1500 picture plus per-pixel depth, height, floor wetness,
   unlit albedo, normal and edge class, which the later steps read. Typed arrays only: Node bakes the same picture.
5. **Make the walkable height map.** `buildNav(colliders, 32, 0.2)` in `client/src/nav.ts`: 0.2 m cells; floor
   colliders give height and surface; a solid blocks cells within 0.22 m where it stands 0.25 m to 1.5 m above the
   floor; a step between cells is at most 0.36 m; a cell walled on three sides is sealed. Junk piles block only if
   `allReachable` still reaches every person and clue.
6. **Move.** Screen to ground: mx = sx + 2·sy, mz = 2·sy - sx; 3.3 m/s walking, 5.4 m/s running, in sub-steps of at
   most 0.06 m; a blocked step slides on one axis, then bends the heading by 0.55, 1.05 and 1.57 rad either way
   (`walk` in `client/src/game.ts`); four facings. `moveVector` (`prefabs/input/move-input`) sums the keys and the
   stick (`createVirtualStick`, `prefabs/ui/virtual-stick`); buttons use `press()` (`prefabs/ui/dom`), so two fingers
   work at once. `game.walkTo(id)` follows `nav.findPath`, aiming 0.35 m ahead, re-planning up to three times.
7. **Draw in this order.** `client/src/present.ts` boots with `renderer: 'webgl'`, `dprCap: 3`,
   `preserveDrawingBuffer: true`, `backgroundPolicy: 'continue'`, `maxFrameDeltaSec: 0.05`
   ([runtime sizing](../platform-adapters.md#runtime-sizing-drivers-and-recovery-170)) and loops on
   `context.runtime.start`. One `world` sprite, scaled by the zoom and moved by the camera, holds by `zOrder`: baked
   picture 0, splashes 1, neon cut-outs 2, glows 3, torch patch 4, ground shadows 5, people behind the player 10, the
   player 20, an occluder patch 30, people in front 40, steam 50; over the stage: mist, two rain layers, lightning.
   Occlusion comes from the baked depth: the 224 x 168 occluder patch re-draws baked pixels more than 0.32 in front of
   the player, and every other person's buffer is re-written each frame without its hidden pixels. Rain and mist are
   256 x 256 tiles made in code and slid by whole tiles; textures are premultiplied (a clear pixel carries no colour).
   Zoom = max(clamp(cssWidth / 760, 0.72, 1.5), cssWidth / 2000, cssHeight / 1500).
8. **Torch.** `castLight` in `client/src/game.ts`: reach 9.5 m, cone from 13° (full) to 30° (none) off the axis, hand
   1.0 m up. A 448 x 320 patch, worked out at half size: world position from the baked height, distance fall-off,
   facing from the baked normal, five jittered shadow samples against the baked depth; softened, multiplied into the
   baked albedo, uploaded with `setPixelsData`, drawn additive. It follows the walking direction; a moving mouse takes
   over until a move key or the stick is touched (`createPointerAim`). A `needsLight` clue appears when the beam
   reaches it (level above 0.08 at chest height) or within 1.5 m with the torch on.
9. **Check the picture, keep a fallback.** At frame 12 `Main.ts` compares a 24 x 14 brightness grid read back from the
   Laya canvas with the same grid from the game's software compositor; it passes at correlation above 0.6 and
   brightness ratio 0.6 to 1.6, otherwise the game switches to a Canvas 2D presenter and shows why (`?renderer=canvas`
   forces it). Recorded 2026-11-12, desktop Chromium, WebGL, DPR 2, engine 1.17.0: correlation 0.897, ratio 1.156.
10. **Sound.** `client/src/audio.ts`: ten `ZhudaSynthRecipe`s at 22050 Hz (hum, steps per floor surface, blips,
    chimes, thunder) through `renderZhudaSynthWav` behind `ProceduralAssetProvider` ids
    ([sound recipes](../procedural-assets.md#sound-recipes)). The rain bed is a seeded 24 s stereo loop from
    `client/scripts/make-rain.py`, loaded by `DirectoryAssetProvider` with its SHA-256 under `unlisted: 'reject'`.
    Voice clips (AAC 56 kbit/s, -18 LUFS) load when a talk opens; ambience drops to 45 % under one. The game plays
    through its own audio context: see Not checked.
11. **Characters: action sheets into one atlas.** A sheet is a 2 x 3 grid: three-quarter front walk A, walk B,
    standing; the same from the back. `client/scripts/pack-characters.py` finds the six poses (alpha cut 96), scales
    by the standing front pose to the in-game height (58 world pixels for the pig, 54 a child, 62 to 72 adults, 86 to
    94 under an open umbrella), anchors on the median column of the lower two thirds, feet on the bottom row, and
    writes `client/assets/characters.png` at 3 atlas pixels per world pixel (13 characters, 1188 x 2901, 2.38 MB) with
    its cells and SHA-256 in `client/src/characterArt.ts`. `client/src/characters.ts` mirrors the frames into four
    facings: 3x for Laya (drawn at 1/3), 1x hard-alpha for the fallback and occlusion. One look per passer-by.
12. **The case as data.** `client/src/story.ts` imports nothing from the engine: `THINGS` (14 people and spots: id,
    kind, name, button verb, x, z, `needsLight`), `CLUES` (9: name, note, a `hint` for the optional ones) and
    `createStory()`: `interact(id)` and `choose(choiceId, optionId)` return `{ lines, gained, choice?, end? }`; also
    `objective()`, `targets()`, `available(id)`, `snapshot()`, `restore()`. The accusation is two chained choices: who
    (four names), then which found clue breaks the alibi; a wrong answer gives the reason and can be retried. Five of
    the nine clues close the case; the other four stay findable after the ending.
13. **Talk, tags, book, films.** `createDialog`, `createChoiceBox` (`prefabs/ui/dialog`) and `createToast`
    (`prefabs/ui/toast`); during a talk the controls hide and a tap anywhere else carries it on. Name tags are DOM
    elements placed each frame with `projectX`/`projectY` times the zoom; tapping one, or the "Go" button, walks
    there. `createCollectionBook` (`prefabs/ui/collection-book`): people (8 x 3 pages) and clues (9), opened by
    conditions in `client/src/cast.ts`; a locked entry says where to look. Four films (`client/src/cutscene.ts`) are a
    muted DOM `<video>` with the game's voices and subtitles; one that cannot start in 10 s is shown as talk.
14. **Languages.** Traditional Chinese source strings are the keys everywhere, voices included. `createI18n`
    (`prefabs/systems/i18n`): tables for Simplified Chinese and English, `detect`, `compound` rules.
    `client/art/i18n/translations.py` → `client/scripts/build-locales.py` → `client/src/locales/*.ts`; the build
    refuses a missing, extra or duplicate string, unequal `{slots}` and Traditional characters in Simplified text.
15. **Saving.** `client/src/save.ts` over `prefabs/systems/storage`: `<game>.save` =
    `{ v: 1, story, x, z, torch, seconds, at }`, written after each exchange, every 5 s and when the page hides;
    `<game>.cast` (book pages) survives a fresh start. Continue restores the story, then `game.place(x, z)`.
16. **Go host.** `server/cmd/zhuda-rainy-night-murder-server/main.go` (41 lines): `GET /healthz`, and `GET /` serving
    `client/dist/web` with `Cache-Control: no-cache` on `127.0.0.1:8893`; it will not start without a built client. No
    game state: a server that must hold state takes `go-game-server`.
17. **Web release.** In `client/`: `npm run verify`, then `node scripts/pack-zip.mjs` → `client/dist/game.zip` (index
    at the root, relative paths, nothing loaded from outside; `maxPackageBytes` 45 000 000 since the films), for the
    owner's portals (see `PORTALS.md` in the workspace): an HTML5 game store page and the owner's own game site.
    `pack-zip.mjs gamedistribution` writes a second zip for an ad-funded distributor (a flag and the SDK tag, ads at
    three breaks only, `client/src/portal.ts`). Store settings and the checklist after an engine update are in the
    game's `RELEASE_ITCH.md`. Ask the owner before any upload.

## Pitfalls

- **Walking on its own stalled where stairs meet a deck** (from a phone: "cannot get upstairs"; two rounds, 2026-11-13
  and 2026-11-20). Causes: `walk` bent the heading only to about 60°, so in a corner it never slid sideways;
  `findPath` let a diagonal cross a cell more than one step from its ends; the straight-run test checked its two side
  lines separately, so a run could hug the edge between a deck and the stairs below. Fixes: bend to 90°; diagonals
  only over cells within one step; side lines on the centre line's floor; follow the run, re-plan up to three times.
  Recorded 2026-11-20: 540 walks (60 random starts x 9 goals), none stuck; regression `stairs-to-deck`.
- **Players did not know where to go or whether they had finished.** With floating markers removed only a small hint
  line showed the way; players who closed the case at 6 of 9 clues thought three had failed to trigger; with several
  things in reach the big button took the nearest, not the wanted one. Fixes: the "Go" button and tappable name tags;
  `hint` lines for missed clues on the end screen; the objective's target wins (regression `burner beside Bo`).
- **Block figures on a phone over the LAN; nothing from `file://`.** A plain-HTTP LAN address has no Web Crypto, so
  the SHA-256 check fails and the stubs take over: use `adb reverse` with `http://localhost`, or HTTPS. From `file://`
  the browser blocks `fetch` altogether, so the zip cannot be sold as a download without a desktop wrapper.
- **A store CDN cached a 404.** An upload took up to about 9 minutes to unpack; a file requested before that was
  cached as missing. Probe only with a random query string; keep the upload named `game.zip` so it replaces the old.
- **Fallback renderer after loading in a hidden tab.** The frame-12 read-back saw an uncomposed canvas (ratio 0.138);
  reloading in front passed. Waiting until the page is visible was suggested, not done.
- **Rain that tires the ear.** Flat pink noise between 900 Hz and 7 kHz. The computed loop moved the spectral centroid
  from 2790 Hz to 640 Hz, about 10 dB quieter. It stays a WAV: AAC starts with silence, a gap at every wrap.
- **The torch ignored the keys.** Once the mouse had moved, its aim was held for 4 s and outranked walking. Fix: a
  move key or the stick releases the aim; dragging the stick with a mouse is not aiming.
- **The opening splash changed with the engine.** From 1.17.0 to 1.18.0 the only visible change was the default
  splash; the owner kept it. Look at the first screen after every engine update.

## Engine gaps and their workarounds

No engine plan item is recorded for any of these.

| Gap                                                                                              | Workaround in the game                                                                          |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| No 2D scene with height: nothing projects, depth-sorts or occludes sprites against level scenery | Own CPU rasteriser with depth, height and normal planes; `zOrder` bands and an occluder patch   |
| No light over a 2D picture that knows its depth and normals                                      | The torch is computed on the CPU each frame into one 448 x 320 additive texture                 |
| No walk map or path finding from prop colliders                                                  | `client/src/nav.ts`: height grid, grid search, straight-run test **After 2.0.0:** `createZhudaWalkGrid`, `findZhudaPath` and `zhudaWalkLineClear` ([walking](../walking.md)); the game still uses its own. |
| A verified `DirectoryAssetProvider` load needs a secure context                                  | Test on `localhost` or HTTPS; every verified asset has a procedural or silent stand-in          |
| Node has no WebGL, so the automated playthrough draws only the Canvas fallback                   | The Laya picture is checked in a browser through `window.__stats()` and the `window.__ui` hooks |

## Checks

- `cd client && npm run verify`: build, `tsc --noEmit`, Doctor, `node --test`. Last recorded 2026-11-20 on engine
  1.18.0: 33/33, Doctor HEALTHY. What the files in `client/tests/` measure:
  - `engine-pin`: the pin is one exact commit and equals the config, the installed package and the shown version.
    `playthrough`: `scripts/smoke.mjs` plays the built `dist/web/app.js` in Node on a stand-in DOM (Canvas fallback):
    all 14 people and spots reachable and walked to; `stairs-to-deck`; `burner beside Bo`; 9 clues; a wrong name does
    not finish; the ending; no console error.
  - `character-art`, `rain`, `voice`, `cutscenes`: files match the sizes and SHA-256 verified at load; every line has
    a clip in both languages; the rain loop wraps without a jump. `i18n`, `book`: every visible string is translated;
    clue and cast order match the atlases. `portal`: the plain zip loads nothing from outside; three ad calls only.
- `cd server && go test ./... && go vet ./...`: last recorded passing on 2026-11-12.
- Desktop Chromium, WebGL, 2026-11-12, engine 1.18.0: the case solved 9/9 in each of three languages, picture check
  passed, no errors, 60 fps, layout held at 375 px wide. Headless Chrome, 2026-11-13: 20 screens the same before and
  after moving to the shared prefab modules (1280 x 720 Chinese, 390 x 844 English).
- vivo V40 (Android 16, Chrome, portrait), 2026-11-20: the whole case at 60 FPS (stick, "Go", torch, save and
  continue, English, accusation, films); the published HTTPS builds opened with no errors. Evidence:
  `client/reports/2026-11-20-v40/`.

## Not checked

- Engine 2.0.0: nothing was re-run; this page was written from the game's files and records. iOS, any phone in
  landscape, WebGPU (the game asks for `webgl` only), Firefox and Safari on a desktop.
- Syncing the modules from this repository's `prefabs/` (the lock records the game centre's library 0.2.0). The prefab
  evidence gate ([visual-content-prefab](visual-content-prefab.md)): none, so the claim is "built with" only.
- Sound through `IframeSoundAdapter`: the game opens its own `AudioContext` (kept from the prototype), which the
  [audio contract](../audio.md) says not to do; Doctor at 1.18.0 reported HEALTHY all the same. A new game should play
  the same provider ids through the adapter; no record covers that path.
- Bake time, load time, memory and frame time under load on the phone (only "60 FPS" is recorded); the English voices
  by ear; how the walking feels; films in landscape and on a desktop.
- The Go host deployed or under load (the published copies are static hosts); real ads (the distributor's review was
  pending on 2026-11-20). Known left-over: a notice shown before a language switch stays in the old language.

## Boundaries

The game owns the case, the street's layout and props, the texture and sound recipes, its rasteriser, torch and walk
map, the sheets, packers and atlas, voices, translations, the page, portal packaging and its device evidence. The
prefab library owns the eight modules: change them in `prefabs/` and sync, never in the game's copies. The engine owns
the runtime session and Laya 2D stage, the procedural kit, the asset providers, the build and the Doctor. The
rasteriser, torch and walk map are the next things to lift out; until then a new game copies the idea, not the files.
