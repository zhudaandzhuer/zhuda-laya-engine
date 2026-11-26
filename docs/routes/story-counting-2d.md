# Route: A voiced visual-novel story around a counting game in a painted field

A 2D web game in two parts: a voiced story played as a visual novel (background, two standing
characters, full-screen event pictures) and an idle counting game on a painted field, where small
animals are herded with a finger or the mouse, counted as they jump a fence, and watched by a giant
character standing behind the horizon. One 1280 by 720 stage serves desktop and phone; a touch
phone held upright turns the whole game 90 degrees. Written from the records of 數豬豬
(`zhuda-counting-pigs`), published on the owner's portals; the game was not run again for this page.

- **Id:** `story-counting-2d`
- **Kind:** workflow
- **For:** building a 2D web game that opens and closes with a voiced visual-novel story and plays as an idle counting or herding game on painted layers, in three languages, packed for several web portals
- **Checked on:** desktop WebGL (Chromium at 1280×720, headless Google Chrome at phone sizes); vivo V40, Android 16, Chrome; no iPhone
- **Status:** from the game's HANDOFF: `npm run verify` passed with 28 tests on 2026-11-18, the turned-upright layout was played by finger on the vivo V40 on 2026-11-18, the giant character has not been seen on a phone; nothing was re-run for this page
- **Reference consumer:** ZhudaGameCenter `games/zhuda-counting-pigs` (outside this repository; the workspace is not under version control)
- **Engine version:** `zhuda-laya-engine` 1.18.0 at commit `693f69bf8604b50c46aff60d54ffbf5f56446857` (LayaAir 3.4.2), pinned in `client/package.json`. Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 28 of 28 with Doctor HEALTHY, `panel-check` 88 of 88 at four screen sizes; not republished, no phone

Read [new-game-project](new-game-project.md), [game-2d](game-2d.md) and
[game-rules-first](game-rules-first.md) first. Paths are inside the game folder; "recorded" means
written in its `HANDOFF.md`, `client/README.md` or `client/reports/`, or in the workspace's `PORTALS.md`.

## When to take this route

- A short voiced story around a long idle loop; art that is generated pictures (painted
  backgrounds, one picture per pose), not rigs; a DOM interface over one Laya 2D stage; web portals.
- Not for a menus-only idle game with summons: [idle-gacha-2d](idle-gacha-2d.md). Not for hundreds
  of moving things: [survivors-2d](survivors-2d.md) (here at most 120 walk at once, a sprite each).
  Rigged characters: [spine-character](spine-character.md); motion from pose pictures: `pose-atlas-motion`.
- A landscape game whose controls are all DOM takes `mobile-always-landscape` for the phone (a
  different way of turning, see step 13), with `mobile-web-fullscreen`. Mini-game hosts:
  [mini-game-build](mini-game-build.md) (this game was never packed for one).

## Tools

- Node 24 or newer (`node --test` imports the game's `.ts` files directly), TypeScript `^5.9.3`.
  `client/zhuda.config.json`: features `core`, `2d`, `ui`; viewport 1280×720 `showall`; `dprCap` 2.
- Prefab modules (`client/common-prefabs.lock.json`, library 0.3.0): `zhuda-engine-prefabs/ui/visual-novel`,
  `zhuda-engine-prefabs/ui/settings-form`, `zhuda-engine-prefabs/ui/dom`, `zhuda-engine-prefabs/systems/i18n`, `zhuda-engine-prefabs/systems/storage`:
  `node node_modules/zhuda-engine-prefabs/scripts/sync.mjs . ui/visual-novel ui/settings-form systems/i18n systems/storage`.
- Pictures: the owner's image-generation command-line tool (`client/art/gen-20261115/*.png.json`
  records tool version 1.5.0, image model `gpt-image-2.6-flare`), prompts in `prompts/`, the owner's
  own character sheets as references. No third-party art and no licence file is recorded; the store
  page declares AI generation (HANDOFF, 2026-11-15). Originals (`assets/`, `client/art/`, about
  130 MB) are not shipped; the packed `client/public/assets/` is 5.5 MB.
- Voices: Qwen3-TTS 1.7B Base (BF16) cloning the owner's two character voices, run locally
  (`prompts/log_voice*.txt`): 43 lines in Chinese, the same 43 in English. Sound effects: 41,
  synthesised by `tools/sfx-lab.html` (`OfflineAudioContext` to WAV).
- Packing: Pillow, macOS `afconvert` and `CFStringTransform` (through `swift`), `zip`. Checks: puppeteer
  from the global npm root driving the system Google Chrome (versions not recorded); a vivo V40 over `adb reverse`.

## Steps

1. **Story and numbers as data before code.** `DESIGN.md` holds the one rule, the shop and the
   layer goals; `story/story.json` holds speakers, scenes and the in-game lines. A line is
   `{id, who, text}` plus optional `bg`, `cg`, `show` (expression per speaker, `null` clears), `sfx`,
   `bgm`, `fx`; the `id` is also the voice file name. `design/build_v2.py` builds one HTML design
   page with the prologue playable.
2. **Rules as pure TypeScript.** `client/src/logic.ts` and `battle.ts`: a `World` with its own
   seeded random number and `step(world, dt, herd)` returning events (rolled, jumped, counted,
   layer up); the view only draws it. `client/tests/sim.mjs` is a bot that plays a whole night.
   Check: `npm test`. This is [game-rules-first](game-rules-first.md).
3. **Boot one fixed stage.** `ZhudaEngine.boot({ container: '#game', designSize: { width: 1280,
   height: 720 }, scaleMode: 'showall', screenMode: 'horizontal', dprCap: 2, backgroundPolicy:
   'continue', onResume })`, then `context.runtime.start(cb)` with the step capped at 0.1 s
   ([runtime sizing](../platform-adapters.md#runtime-sizing-drivers-and-recovery-170)). `onResume`
   pays the time away like offline time. File: `client/src/Main.ts`.
4. **One 16:9 box for canvas and DOM.** `#game` and `.layer16` are both `min(100vw,177.78dvh)` by
   `min(56.25vw,100dvh)` (with `vh` fallbacks), centred; the DOM layer is `container-type:
   inline-size` and every size in it is `cqw`, so the interface scales with the stage. Panels live
   in `#panels` outside the box and scroll. File: `client/public/index.html`; the engine's
   [layout](../layout-and-media.md) helpers were not used.
5. **The story player.** `createVisualNovel({ host, speakers, image: { bg, cg, sprite }, t, labels,
   voice, stopVoice, sfx, bgm, blip })`, then `await vn.play(scene.lines)`; `vn.relabel()` on a
   language change. The game passes key-to-URL functions and its audio; the module holds no
   content. In-game lines reuse the ids: `say(id)` shows a subtitle and plays the voice.
6. **Pictures.** A job is `(file, aspect, transparent, references, prompt)` in `prompts/jobs_*.py`;
   `run_jobs.py` runs three at a time and skips files that exist. One shared style sentence; every
   background says "no characters, lower 60% flat simple ground, horizon about 40%"; field sprites
   are side views facing right on transparency; a new sprite takes the character sheet and an
   accepted sprite as references. Game sizes (`client/scripts/pack_assets.py`): backgrounds 1600×900,
   standing characters 640×860, animals 240, icons 160, props 420. Then all 71 pictures to WebP:
   9.36 MB to 2.43 MB, the zip 12.2 MB to 5.3 MB (recorded 2026-11-15).
7. **Voices and sound.** Lines come from the story file (`story/voice-script*.json`); each take is
   checked by speech recognition and speaker similarity (`assets/voice/voice-report.json`); a line
   the model keeps misreading is reworded or respelled. Narration is not voiced. AAC `.m4a`, voices
   at 64 kb/s, effects at 96. `client/src/audio.ts`: one `AudioContext`, three buses (music 0.35,
   effects 0.7, voice 1.0) into a compressor; six loads at a time, a failed load retried on the next
   play, the title waiting at most 6 s. A new game should start from the [audio contract](../audio.md).
8. **The field, back to front** (`client/src/field.ts`): two background sprites (cross-fade between
   layers), the giant, the ground cut (step 9), ambient effects, ground decals, mud pits, shadows,
   sky, one y-sorted container (`zOrder = round(y)`, +60 while jumping), a few foreground particles,
   effect text. Each of the six layers has its own map in `LAYOUTS` (pits, fence slope, rocks, zones).
   Light is canvas-gradient pictures blended `lighter` (`light.ts`, `ambient.ts`).
9. **The giant behind the horizon.** The front-facing character (640×853, feet at y 833) is drawn
   at scale 0.48, x 1130, feet 150 px below the horizon; over it the ground part of the same
   background is drawn again, cut with `Laya.Texture.create` at `HORIZON = [312, 318, 328, 312,
   316, 304]` (stage y, measured per layer on his side). The copy matches the picture under it, so
   the cut shows only across him. In a raid he leaps out (0.55 s) and lands at normal size on a free
   spot chosen by `sidePosts(world)` in `logic.ts`. Check: `node scripts/giant-check.mjs <url> <dir>`.
10. **Pointer.** Stage coordinates come from browser pointer events and the canvas's
    `getBoundingClientRect()`, not from `Laya.stage.mouseX`. A mouse button held, a 160 ms long
    press or a 10 px drag brings out the herding stick; a mouse that only hovers moves nothing.
11. **Languages.** Source strings are Traditional Chinese and are the keys. `createI18n({
    storageKey, langs, tables, detect })` gives `t`, `tf('{n}')`, `translatePage()` for `data-i18n`
    elements, and `onLang`, on which every built panel is rebuilt. English is written by hand
    (`src/locales/en.ts`); Simplified is generated from the same keys plus a short fix list.
    English text plays `voice-en/`. Numbers are formatted per language and rounded down.
    Check: `tests/i18n.test.mjs`.
12. **Saving.** `localStorage` through a guarded `store`, written every 10 s, on `pagehide` and when
    hidden. The last save that loaded is kept under a backup key; `navigator.storage.persist()` at
    boot. A save code (deflate-raw, base64url) moves progress between sites. On the title
    "continue" is the main button and starting over asks twice. Time away pays coins at half rate
    for at most 8 hours and never moves the count; 120 s without input sends everyone to bed.
    Check: the fixture test in `tests/logic.test.mjs`, then `scripts/live-save.mjs`.
13. **A phone held upright.** When `(pointer: coarse)` matches and the window is taller than wide,
    `html.rot` is set before boot. `#game` becomes an upright box and Laya turns the canvas in it
    (`screenMode: 'horizontal'`); `.layer16`, `#panels`, the loading screen and the backdrop turn
    90° clockwise in CSS with `vw` and `vh` swapped. Turned, stage x is `(clientY − top) / height ×
    1280` and y is `(right − clientX) / width × 720`; the inverse places DOM things that follow
    stage points. Portrait panel rules apply under `html:not(.rot)`; a setting switches back to the
    upright strip. Recorded: at 390×844 the game grows from 390×220 to 693×390. Check: `scripts/rot-check.mjs`.
14. **Pack per portal.** `node scripts/pack-zip.mjs [portal]` zips `dist/web`; a portal build is the
    same files plus `window.ZHUDA_PORTAL` and, where the portal has one, its SDK tag; `src/portal.ts`
    does nothing without a portal. The plain zip (itch.io) starts in English with the story first;
    a portal build follows the browser language and reaches the field in one click. CrazyGames:
    saves through the SDK's data module, gameplay start and stop around every panel.
    GameDistribution: an ad before Start or Continue and at breaks, the game paused and the
    `AudioContext` suspended; no ad within 2.5 s lets the player through, 90 s at most.
15. **Release.** `npm run verify`; leave a save on the live release; publish; continue that save on
    the new release (`scripts/live-save.mjs`); record it in `PORTALS.md`. Ask the owner first.

## Pitfalls

- **A portrait phone showed a 390×220 strip, and a panel could not be closed** (a player in an
  in-app browser, 2026-11-17). Panels sat inside the 16:9 box with `overflow: hidden`. Fix: panels
  outside the box, a sticky close control, backdrop click and Esc; then step 13.
- **A returning player lost her night** (2026-11-16): most likely the page was reloaded and the top
  button started over. Fix: step 12, and a test that loads every earlier save (`tests/fixtures/`).
- **A portal refused the game twice on "overall quality"** (2026-11-15, 2026-11-16). The first
  minute had one animal, 3 counted in 60 s, a text-only tutorial and a whole shop greyed out. Six
  animals at the start, a hand showing the gesture and shop items appearing one by one (15 counted
  in 33 s afterwards) did not change the verdict.
- **Characters that face the player or stand on the animals.** A fixed `zOrder` of 2000 drew him
  over the herd. Several rounds over two days: standing higher, side poses, then step 9.
- **The top line.** A growing number covered a button and labels wrapped on a phone. Fix: a
  three-column grid, the count shown once, nothing wraps; checked at three sizes in three languages.
- **Seen only on the phone** (2026-11-15): an animal herded to the bottom edge froze (its target
  was off the ground: clamp it); a panel sized in `px` overflowed (`cqw`, a maximum height and
  scrolling); `100vh` was taller than the visible page in landscape Chrome (`dvh`).
- **The rule area and the picture disagree.** Animals stood on painted mud and did not roll: set
  the rule ellipse from the wet part of the picture and pivot the picture on that centre.
- **Rule bugs that reached the screen**: an item that trapped the herd and one that slowed the night
  (found by the bot's night without each item), animals pinned by a current faster than they walk
  (each fix has a test: nothing stands still for 6 s on any layer). One seed is not a pacing test:
  an unrelated change moved seed 11 to 28.6 min, outside the bound; the test now averages three.
- **`python3 -m http.server` drops requests** when many pictures load at once: broken pictures in
  local runs only. Use a server with a longer queue.
- **`pack_assets.py` is behind the game**: it writes PNG and JPEG while the game loads WebP; the six
  side poses were trimmed and converted by hand (440 and 380 px tall, drawn at 0.5, foot anchors in
  `POSE` in `field.ts`). The WebP converter is not recorded.
- `boot` with `width` and `height` alone sized the stage to the window: pass `designSize`. `dprCap`
  3 on a DPR 3 phone draws 2.25 times the pixels of 2. At 693f69b the scaffold pinned TypeScript
  5.6.3 while the engine's types needed 5.7; this repository's init writes the engine's own version.

## Engine gaps and their workarounds

| Gap (as met at 693f69b; no plan item is recorded for any)                          | Workaround in the game                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| No helper for a landscape stage on an upright phone (DOM layers, pointer mapping)   | `html.rot` CSS and `toStage` / `toScreen` in `Main.ts`              |
| `Laya.stage.mouseX` followed a real mouse only, not touch (`ZhudaPointerInput` was not tried) | Browser pointer events mapped through the canvas rectangle |
| No portal layer: ad SDKs, a portal's save store, gameplay start and stop            | `src/portal.ts`, `scripts/pack-zip.mjs`                             |
| No story player and no DOM interface kit in the SDK                                 | `zhuda-engine-prefabs/ui/visual-novel`; the game's own page in `cqw`             |
| No build step that resizes or re-encodes pictures and sound                         | `pack_assets.py`, then WebP by hand                                 |
| The [audio contract](../audio.md), `AssetProvider` ([asset loading](../asset-loading.md)), the layered clock and the prefab gate ([prefab workflow](../prefab-workflow.md)) were not used; the records do not say why | The game's `audio.ts`, `Laya.loader.load`, `setTimeout` for interface timers |

## Checks

- `npm run verify` in `client/` (build, strict types, Doctor, `node --test`): 28 tests passed,
  recorded 2026-11-18; `dist/consumer-build.json` of that build says level `engine-backed-static`,
  renderer `webgl`, 217 zip entries, 5.47 MB.
- The bot (`tests/sim.mjs`): twelve seeds averaged a 36.6 minute night (2026-11-18).
- With `dist/web` served: `panel-check.mjs` (eight window sizes; every panel closes by its control,
  Esc and the backdrop) recorded as all passing on 2026-11-17 and 18; `rot-check.mjs` (390×844 and
  360×780 touch, the upright setting, a 600×900 desktop window: canvas and DOM box equal, a dot on
  an animal, the stick under the finger, panels close, no page error) recorded with screenshots on
  2026-11-18; `scene-check`, `giant-check` and `raid-check` take screenshots (`client/reports/`).
- Frame time, 2026-11-15, a desktop browser at DPR 2, `stage.render` per frame: 6.1 ms mean (9.3
  max) on layer 1, 7.6 (14.3) on layer 5, 7.0 (13.7) in a raid; about 277 display nodes.
- vivo V40, Chrome: on 2026-11-15 a portal build was played by finger from loading to buying; on
  2026-11-18 the turned layout (loading, story, field, dragging, panels, the setting both ways)
  passed, the settings card taller than the screen but scrollable (`client/reports/2026-11-18-v40/`).
- Release: `live-save.mjs` on the owner's site and `itch-check.mjs` on itch.io after each publish,
  last recorded 2026-11-18.

## Not checked

- Anything at engine 2.0.0 or any commit after 693f69b, including whether `screenMode:
  'horizontal'` still turns the canvas (`mobile-always-landscape`, at a later commit, chose not to
  use it). WebGPU. Any mini-game host.
- iPhone and Safari; the in-app browser the player reports came from; frame time on any phone;
  120 animals on a phone. The giant on a phone or turned, his dozing at bed time, the second
  character's leap frames (listed as unverified in the HANDOFF).
- A real ad: the GameDistribution build only loaded the SDK locally with no ad (SDK 1.43.63). The
  CrazyGames build is not live.
- A person playing a whole night: every pacing number is the bot's. Three voice lines are flagged
  for a human ear. A true portrait layout was not built.
- The prefab gate (`npm run accept:prefabs`) was never run, so no "prefab-qualified" claim
  ([claim levels](../consumer-route.md#claim-levels)).

## Boundaries

- The game owns its rules and numbers, story, pictures, voices, sounds, layer maps, the `HORIZON`
  values, its page and its portal glue. None of it is copied into this repository.
- The prefab library owns the story player, the settings form, the language and storage modules.
  The portal layer, the save code, the turning CSS with its pointer mapping and the light pictures
  are candidates to move there (`game-to-prefabs`); they are still in the game.
- The engine owns boot, sizing, the runtime loop, the background policy, the build and the Doctor.
  `npm run verify` proves no pixel: every visual claim above is a recorded browser or phone run
  kept in the game. Publishing and submitting to a portal are the owner's decision each time.
