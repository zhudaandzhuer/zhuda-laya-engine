# Route: A portrait dungeon payline slot (Dungeon Spin, 迷宮一閃)

A 572×1024 portrait payline slot in which every round is played as a dungeon adventure: the hero walks a stretch, the winning lines turn into monsters that are cut down, the big-sack treasure monster (巨袋寶箱怪) gives a Bonus pursuit, and a big win counts up; the points are a local trial ledger that books a round first and plays it afterwards. The picture is three large images (one whole background, a monster atlas, a hero action atlas), each made a prefab and checked alone first, and the scene then mounts the same definitions. The buttons are clicked by mouse or touch (Space / Enter also advance). Checked only in desktop headless Chrome (WebGL).

- **Id:** `dungeon-line-slot`
- **Kind:** scene
- **For:** building a portrait payline slot (or any "one button, one round" game) that plays every round as a dungeon fight, with every picture put through the prefab gate first
- **Checked on:** desktop WebGL (Apple M4, ANGLE Metal, headless Chrome 158; 572×1024, 1280×720, 390×844, 1024×1366); no phone
- **Status:** taken apart into shared modules on 2026-11-25 from the original game (removed after it was taken apart); the viewer and the original game are 0 pixels apart in 26 states, the three prefab checks are 0 pixels over 30 cycles, and the Go server's output is the same byte for byte
- **Reference consumer:** this repository: `prefabs/2d/dungeon-spin`, `prefabs/2d/prefab-atlas`, `prefabs/systems/slot-round`, `prefabs/server/dungeon*`, `prefabs/viewer2d/src/presets/dungeon-spin.ts`
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c` (the original game pinned `dd9b5fd`; once prefab acceptance is run again it works with no change to the program)

## When to take this route

- Fits: a one-button round game (a slot, a card draw, a wheel, "one step forward") that wants a story presentation, a portrait phone screen, and art that is a few painted large images plus atlases; that wants trial points, auto advance, speed-up / collect, a details dialog.
- Does not fit:
  - A traditional slot whose reels are seen turning: there are no reels here, and the 5×3 board is only in the "battle result details" (戰果明細).
  - Real probability and RTP: there are only ten fixed scenarios here (`math.ts`); the pay tables are in `2d/dungeon-spin/source/math/` but are not implemented.
  - Server-authoritative online play: Go's `server/dungeonauthority` is only a seam in memory and the front end is not connected to it; take the [go-game-server](go-game-server.md) route.
  - A 3D dungeon: the original game's 3D stone corridor was measured to draw not one pixel, so do not learn 3D from here (take [good-looking-3d-scene](good-looking-3d-scene.md)).
- Read first: [game-2d](game-2d.md) and [visual-content-prefab](visual-content-prefab.md) (pages of this folder), and `prefabs/2d/dungeon-spin/README.md`.

## Tools

- `prefabs/scripts/sync.mjs`: `2d/dungeon-spin` brings `systems/slot-round` and `2d/prefab-atlas`; the images and the `.lh` files go as they are to `public/common/2d/dungeon-spin/assets/`.
- `prefabs/viewer2d/` (the viewer): `?scene=dungeon-spin`, with the URL parameters `fixture`, `bet`, `burst`, `open`, `play`, `auto`, `save=memory`; on `window.__SCENE__`: `state()`, `set()`, `errors()`, `game`, `provenance()`.
- Engine commands: `zhuda-laya-build` (`--candidate`), `zhuda-laya-accept`, `zhuda-laya-doctor` (run in the minimal game `prefabs/2d/dungeon-spin/source/prefab-check/`).
- `prefabs/tools/detplay.mjs` (`VIEWPORT=572x1024`; `HOOK=__DUNGEON_GAME__` when the original game has no `__SCENE__`), `prefabs/tools/pixdiff.py`; the scenario file `prefabs/viewer2d/scenarios/dungeon-spin.json`.
- Go 1.26.5 (`cd prefabs && npm run verify:go`).
- Assets: `template-v2.png`, `creatures-v3.png` and `hero-actions-v4.png` are pictures in a general fantasy style; the original project did not write down where they came from or their licence; the owner agreed to their use as shared assets.

## Steps

1. **Look first.** `cd prefabs/viewer2d && npm run build && npm run view`, then open `?scene=dungeon-spin` and each of its tabs (idle, several lines + SUPER WIN, the big-sack treasure monster, no win, sprint (疾行, the `burst` mode), auto, menu, details, guide); if you do not want to run it, look at `prefabs/2d/dungeon-spin/preview/sheet.jpg`, `atlas-creatures.jpg` and `atlas-hero.jpg`.
2. **Put it in the game.** From a checkout of this repository `node prefabs/scripts/sync.mjs <game dir> 2d/dungeon-spin`, or from the game `node node_modules/zhuda-laya-engine/prefabs/scripts/sync.mjs . 2d/dungeon-spin`; `<game dir>` is the game's client project, for a game of the workspace ZhudaGameCenter `games/<game>/client` (outside this repository). In `zhuda.config.json`: `features: ["core","2d","ui"]` (no `3d`), `"prefabPreview": "src/common/2d/dungeon-spin/prefabs.ts"`, and the three `prefabChecks` copied from `prefabs/2d/dungeon-spin/source/prefab-check/zhuda.config.json` (572×1024 / 572×453 / 572×324, DPR 1, `cycles: 30`), with the reference images copied from its `references/`.
3. **Write the game's own layer.** Copy `prefabs/2d/dungeon-spin/source/prefab-check/src/Main.ts`: `ZhudaEngine.boot({ width: 572, height: 1024, bgColor: '#080f19', scaleMode: 'showall', features })` **with no container**, then move the `canvas` into `#game`; `createAssetProvider()` (by default `./common/2d/dungeon-spin/assets/`) → `new ZhudaPrefabLibrary({ provider, definitions })` → `new DungeonSpin(stage, library).init()` → `ZhudaEngine.flushRenderFrames(4)`. Wrap it in `async function main()`.
4. **Pass the prefab gate.** `npm run build:candidate` → `npm run accept:prefabs` (all three must be `passed`, 0 pixels, 30 cycles) → `npm run build` (the production build accepts only evidence that matches this build).
5. **Change what a round holds.** Which scenario: `game.runtime.configure({ fixture })` (the original game had no interface for changing it and was always `multi`). Real mathematics: give `LocalSession` another `resolve(fixture, bet)` that returns `{ p, b }` in the shape of `math.ts`; the presentation reads `p.awards` (one monster per award, at most 5; `symbol` is the atlas cell, 0–8), `p.attack` (which decides the pose: 迅劍 quick, 蒼刃劍氣 wave, 拔刀一閃 draw, 召喚・萬刃橫掃 magic, 領域斬／破封聖劍 cleave, anything else ready), `p.opportunities` and `b.beats` (the Bonus); the big-win screen comes only when `win ≥ 10×bet`.
6. **Change the art.** Every position was measured by hand against `template-v2.png`: the top bar 0–128, the corridor window (7,128) 558×448, the hero window (7,576) 558×324, the centre of the dialogue line on the parchment y≈796, the bottom bar y=850 (the centre of the big advance orb (490,924), auto (402,904), sprint (406,970), BET − / + (42,982) / (169,982)). A new background means measuring these coordinates again; changing any image means updating `assetManifest` in `prefabs.ts` (size and SHA-256; `tests/dungeon-spin.test.mjs` stops a mismatch), running `accept:prefabs -- --capture` again to make the reference images, having a person look at them, and then `accept:prefabs`. The monster atlas is fixed at 5×2 and the hero's at 3×2 (`gridCellAt`).
7. **The server (if wanted).** `server/dungeonmath`, `dungeonauthority`, `dungeongateway`, and `go run ./dungeonserver` in `prefabs/server/` (127.0.0.1:8790). The front end does not call it at present; to connect it, write an object that implements `SessionPort` and give it to `GameRuntime.attachSession` (never done).
8. **Check.** See "Checks"; when the look has changed, take `prefabs/2d/dungeon-spin/preview/` again.

## Pitfalls

- **Given a `container`, it is no longer show-all.** `ZhudaEngine.boot({ container, scaleMode: 'showall' })` without `designSize`: the stage follows the container's CSS size, and in a 1280×720 window the game sits 1:1 at the top left with its lower half cut off (920,000 pixels away from the original game); adding `designSize` is also 920,000 pixels away from the original game. The original game gives no container, and Laya itself scales the 572×1024 canvas with CSS → boot with no container and move the canvas into the container afterwards: 0 pixels in all four windows.
- **The canvas does not get sharper on a phone.** With no container the canvas is always 572×1024 pixels, scaled with CSS (measured at 390×844 with DPR 3: canvas 572×1024, `scale 0.68`). `dprCap: 1.5` in `zhuda.config.json` has no effect on it. To be sharp it has to use a container + `designSize`, and that way is not verified.
- **It does not build after the engine pin is changed.** `npm run build` reports `evidence/prefab-…json: missing, failed or stale prefab evidence`: the evidence is bound to the build's fingerprint. The program needs no change: `build:candidate` → `accept:prefabs` (on def94aa all three are 0 pixels against the original reference images) → `build`. **Even one comment line added to `Main.ts` makes the evidence stale**; one more unrelated file in `public/` does not (measured on 2026-11-25).
- **The virtual clock had every round refused.** `detplay.mjs`'s `Date.now()` used to carry a fraction (16.67 ms per frame), the ledger's check `Number.isSafeInteger(acceptedAt)` failed and answered "本地回合紀錄不完整" (the local round record is incomplete), and most rounds never started; both sides failed together, so it was 0 pixels all the same. → `Date` in `detplay.mjs` now gives whole milliseconds (as a browser does); **when comparing, always compare `state()` too (points, round count), never the pixels alone**.
- **Clicking the big advance orb makes the comparison unsteady.** It first does `await sound.unlock()` (`AudioContext.resume()`, real time), so the frame on which the round starts differs every time. → Compare with `runtime.advance()`; the buttons' clicks are checked apart (the menu key, BET ±, sprint and ✕ were all checked with `click`).
- **A top-level `await` fails the build.** The engine's build target is ES2020: `Top-level await is not available` → wrap it in `async function main()`.
- **Clicking outside a dialog does not close it.** The mask is a Sprite with only `graphics` and no `size`, so it receives no clicks; a scenario has to click ✕ (menu (492,286), details (497,222), guide (502,222), auto (476,384)). Kept as it was.
- **Auto advance's `timer` must not call back synchronously.** `AutoAdvance`'s `done()` reads the id that `timer()` returns; a synchronous call throws `Cannot access 'timerId' before initialization` and stops auto; use `setTimeout` / `setImmediate`.
- **The front end's scenario table and Go's are not the same.** The front end rounds every award (`multi` 3008×4 = 12032) and Go truncates (3007); Go's `three` has no `symbol` and no `lineIndex`. Each is kept as it was; to change it, change both sides together.

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| Prefab evidence is bound to the built program (one comment line changed in the entry program makes it stale): the shared viewer (stale as soon as any preset changes) cannot hold `prefabChecks` | Every module has a minimal game made of it alone for its prefab checks (`prefabs/2d/dungeon-spin/source/prefab-check/`); the viewer only compares pixel by pixel |
| The engine has no fixed clock for comparing two builds (a `Date` with a fraction harms the save check) | `prefabs/tools/detplay.mjs`, where `Date` is whole milliseconds **After 2.0.0:** `fixedDeltaSec` fixes the session's clock per frame; `Date` and `performance.now()` read by a game are still `detplay.mjs`'s to replace. |

## Checks

```bash
cd prefabs && npm run verify && npm run verify:go
cd viewer2d && node ../scripts/sync.mjs . && npm run verify
# From the repository root: the original game (a copy with only its pin changed and prefab acceptance run again) against the viewer, same scenario:
VIEWPORT=572x1024 HOOK=__DUNGEON_GAME__ node prefabs/tools/detplay.mjs <original game>/client/dist/web prefabs/viewer2d/scenarios/dungeon-spin.json "" A
VIEWPORT=572x1024 node prefabs/tools/detplay.mjs prefabs/viewer2d/dist/web prefabs/viewer2d/scenarios/dungeon-spin.json "scene=dungeon-spin" B
python3 prefabs/tools/pixdiff.py A B
```

Measured on 2026-11-25: 26 pictures at 0 pixels (the original game against itself and the viewer against itself are 0 too; the two builds really are different: the hashes of `app.js` differ, and the original game also loads `laya.d3.js` and `laya.webgl_3D.js`); the idle screen at 0 pixels in the four windows; `errors()` and the page errors empty; the final points and round counts the same on both sides. `source/prefab-check`: the three `prefabChecks` pass, 0 pixels, 30 cycles, with the definition hashes and the source SHA-256 the same as in the original game's evidence. The library's tests: 105 (new: `slot-round` 9, `dungeon-spin` 8, `prefab-atlas` 2); Go: `dungeongateway/original_test.go` is the same as the original server's output byte for byte over 316 lines; the original `GameRuntime` / `LocalSession` and `systems/slot-round`, given the same script, give events and saves that are the same byte for byte.

## Not checked

- Not on a phone, not packaged as a mini game; touch only as synthetic mouse events; the 360 ms long press and Space / Enter were not tested in a browser.
- The sound (20 synthesised effects) was only verified not to raise an error; no one has listened to it.
- WebGPU was not run; only WebGL on the Apple M4 (the original game's scene acceptance of 11-06 was on SwiftShader).
- There is no real probability, RTP or random board; the Go server is not connected to the front end and has no authentication, persistence or rate limiting.
- The container + `designSize` way to a sharp canvas is not verified.

## Boundaries

- The game: the scenarios or the mathematics (`resolve`), the lines of dialogue, the replaced art and its coordinates, the release settings, the device evidence, the server's deployment.
- The prefab library (`prefabs/`): `2d/dungeon-spin` (screen, presentation, interface, the three images), `systems/slot-round` (round state machine and ledger), `2d/prefab-atlas`, `server/dungeon*`, and the previews, the mathematics tables and the minimal game for the prefab checks.
- The engine: rendering, the prefab library and gate, `AssetProvider`, the build and the Doctor. Engine problems found while taking a game apart are recorded under "Engine gaps and their workarounds"; do not patch them quietly inside a module.
