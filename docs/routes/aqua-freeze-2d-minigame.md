# Route: a fluid-freezing puzzle platformer moved from a DOM interface to a WeChat mini game

A portrait 2D puzzle platformer (AquaFreeze, 凝流躍杯): a 120 Hz deterministic particle fluid that
the player catches in a cup, throws, and freezes into ice steps, drawn by custom 2D post-process
shaders (metaballs, a 3 px white outline, a shockwave). It came into the workspace with its
interface in HTML over the canvas; to package it for WeChat the interface was redrawn on the Laya
stage, so one code base now builds the web page and the `wxgame` package. Touch, mouse or keyboard.
Checked in headless Chrome at three window shapes, in the `weixin-minigame-helper` simulator (with
one test-only shim) and by the WeChat developer tools' preview build; no phone run recorded.

- **Id:** `aqua-freeze-2d-minigame`
- **Kind:** workflow
- **For:** Moving a 2D game whose menus, HUD and touch pad are HTML over the engine canvas into a WeChat mini game: the interface drawn on the Laya stage, the stage fitted to tall phones, prefab textures, sound and saving without browser APIs, and the checks that replace DOM selectors.
- **Checked on:** desktop headless Chrome 158 (Apple M4, ANGLE Metal) at 720×1280, 390×844 (touch, DPR 2) and 1280×720; the `weixin-minigame-helper` simulator (390×844, DPR 3); WeChat developer tools preview on the owner's phone in WeChat (played; model and frame rate not recorded)
- **Status:** 2026-11-26: `npm run verify` (build, types, Doctor HEALTHY, 52 tests) and `npm run verify:browser` (ten levels, a recorded 1-1 clear, the 3 px outline, two-finger touch, 60 FPS with P95 16.7–16.8 ms) pass; `npm run build:wx` 2,775,928 bytes under the 4 MB gate, no syntax newer than ES2017; title, play, freeze, level select and level 1-7 seen in the simulator; a preview QR was made by the developer tools; nothing uploaded
- **Reference consumer:** ZhudaGameCenter `games/zhuda-aqua-freeze` (outside this repository): `src/ui/GameUI.ts`, `src/platform/screen.ts`, `src/platform/wx-polyfills.ts`, `src/audio/ToneSynth.ts`, `src/prefabs.ts`, `tools/patch-wx.mjs`, `scripts/verify-browser.mjs`
- **Engine version:** zhuda-laya-engine 2.0.0 (`91d21f79`, LayaAir 3.4.2)

## When to take this route

- Fits: a 2D game (or a 2D game's interface) built for the browser with HTML buttons, panels and
  `pointer` events over the canvas, that must also run as a WeChat mini game; any game whose
  prefabs carry textures and must load inside a mini game.
- Does not fit: a new game (start DOM-free: [new-game-project](new-game-project.md),
  [drop-merge-2d-minigame](drop-merge-2d-minigame.md)); a 3D mini game
  ([raft-brawl-3d-minigame](raft-brawl-3d-minigame.md),
  [action-adventure-3d-minigame](action-adventure-3d-minigame.md)); a browser-only game, which can
  keep its DOM interface ([mobile-web-fullscreen](mobile-web-fullscreen.md)).
- Packaging itself is [mini-game-build](mini-game-build.md); bringing the project into the
  workspace is [prototype-to-center](prototype-to-center.md).

## Tools

- Engine pinned as in the header; `features: ["core","2d","ui"]`, `renderer: "webgl"`;
  `zhuda-laya-build`, `zhuda-laya-doctor`, `zhuda-laya-minigame` with LayaAir 3.4.2 at
  `~/.layaair/3.4.2`.
- Prefab module `systems/minigame-host` (host bridge, polyfills, `PlatformAssetProvider`), copied
  with `npx zhuda-prefabs-sync . systems/minigame-host`.
- Node 26.13.1, TypeScript 5.9.3, esbuild 0.27.1 (through the engine), Playwright core 1.62.1 with
  the installed Google Chrome (`CHROME_BIN`, found by the script on macOS and Windows).
- WeChat developer tools (Stable, arm64) and its command line through the owner's
  `zhuda-wechat-game` skill (`check-pkg`, `preview`); the `weixin-minigame-helper` MCP server for a
  simulator in the browser.

## Steps

1. **Find every browser API first.** Build once with `npm run build:wx`: the mini-game tool audits
   each reachable source and refuses `DirectoryAssetProvider`, `IframeSoundAdapter`,
   `document.*`, `window.addEventListener`/`localStorage`, and a `container` in `boot`
   (`[MINIGAME_BROWSER_API]`, with file and line). A runtime branch does not help: the audit is
   static, so the browser-only code must leave the entry's import graph, for the web build too.
2. **Boot without a container, the stage shaped to the screen.** `ZhudaEngine.boot({ designSize:
{ width: 720, height: H }, scaleMode: 'showall', dprCap: isWeChat ? 2 : 3, onResize })` where
   `H = clamp(round(720 × windowHeight / windowWidth), 1280, 1720)` (`src/platform/screen.ts`;
   WeChat: `wx.getSystemInfoSync().windowWidth/Height`). A 390×844 phone gets 720×1558 and fills
   the screen; a desktop window gets 720×1280, letterboxed at the sides. The 720×1280 world is the
   prefab root moved down by `worldY = (H − 1280) / 2`; the HUD lives in the top bar, the touch
   pad in the bottom bar. The runtime aligns the stage top-left, so centre it with
   `Laya.stage.offset` (CSS pixels) from `onResize`, and call `context.resize()` once after
   `boot` returns: the first `onResize` runs inside `boot`, before the context exists. Check: the
   canvas rectangle is centred and `720 × H` scaled (`assertStageFrame` in the consumer's script).
3. **Draw the interface on the stage.** `src/ui/GameUI.ts`: one `Button` class (a `Laya.Sprite`
   with `drawRoundRect` and `Laya.Text`, a stage-space rectangle, a style) for every former HTML
   button; screens are sprites toggled by `visible`. The old CSS sizes became design pixels at
   about 1.8 × (CSS pixels on a 390-wide phone), so a 44 px touch target is 80 design pixels.
   Hit tests are the game's own (topmost visible button containing the point).
4. **Input from the stage, finger by finger.** `Laya.InputManager.multiTouchEnabled = true`;
   `stage.on(MOUSE_DOWN/MOUSE_UP)` with `event.touchId` and `event.touchPos` (stage coordinates).
   A held control is owned by its `touchId` until that finger lifts, wherever it slides (as pointer
   capture did); taps fire on release inside the same button. Keys: `stage.on(KEY_DOWN/KEY_UP)`,
   `event.nativeEvent.code`, `preventDefault` for game keys; right button `RIGHT_MOUSE_DOWN`.
   Clear held input on `Laya.Event.BLUR` and through `boot({ clearInput })`.
   4a. **Touch controls as the owner asked after the first phone run (2026-11-26): a floating
   joystick and two round buttons.** Left/right/jump buttons were "hard to use". Now: a press on
   the empty lower-left (left half, below 45% of the stage and the HUD) grabs a joystick whose
   base (radius 112) moves under the finger; x beyond ±0.28 of the radius walks, up beyond 0.45
   jumps and releases below 0.3 (hysteresis; holding up keeps the variable jump high); it follows
   `MOUSE_MOVE` of its own `touchId` and lets go on that finger's `MOUSE_UP`. Right side: freeze
   (radius 84, bottom-right) and toss (radius 64, up and left of it), circular hit tests at 1.12
   × radius. The check drives the stick with `page.mouse` drags and CDP touch moves.
5. **Prefab textures in WeChat.** `ZhudaPrefabLibrary` decodes a texture as
   `URL.createObjectURL(new Blob([bytes]))`, records `crypto.subtle.digest('SHA-256')` and hashes
   definitions through `new TextEncoder()`; WeChat on iOS has none of these. A UTF-8
   `TextEncoder` is installed wherever one is missing. `src/platform/wx-polyfills.ts`, imported first, installs under
   `wx` only: a byte-backed `Blob` (always, even where a native one exists), `createObjectURL`
   that returns the **package path** when the bytes are a package file the provider just read
   (`rememberPackageFile`, called by a `PlatformAssetProvider` subclass in `src/prefabs.ts`) and
   otherwise writes `USER_DATA_PATH/…png` with `writeFileSync`, a JavaScript SHA-256, and
   `DOMException`. Check: `tests/wx-polyfills.test.mjs` (SHA-256 against Node's at the 55/56/63/
   64/65-byte padding edges and 1 MB; a fake `wx` in a child process).
6. **Sound without the browser mixer.** `src/audio/ToneSynth.ts` repeats the envelope of
   `IframeSoundAdapter.scheduleTone`: oscillator from `startFreq` to `endFreq` exponentially, gain
   from `peakGain` to 0.0008 exponentially, through one gain of master 0.85 × sfx 0.9; the context
   is `AudioContext` in a browser and `wx.createWebAudioContext()` in WeChat, created and resumed
   on the first touch or key. Mute is saved with `saveNumber`.
7. **Saving.** `loadNumber`/`saveNumber` from the host bridge; the cleared levels became one
   bitmask number (`aquafreeze.chapter1.clearedMask`).
8. **Package.** `npm run build:wx` = `zhuda-laya-minigame --platform wxgame && node
tools/patch-wx.mjs`: every `.js` lowered to ES2017 with esbuild, `project.config.json` (`es6`,
   `enhance`, `minified`, `postcss` on, `urlCheck` off, AppID from `WX_APPID` or the config, the
   project name), `game.json` `deviceOrientation: portrait`, and a 4 MB main-package check.
9. **Replace the DOM checks.** The game reports its buttons in stage coordinates
   (`__AQUAFREEZE__.ui.buttons`, `panels`, `texts`, `cleared`) and `stageHeight`, `worldOffsetY`;
   the browser script maps them through the canvas rectangle and presses them with
   `page.mouse`, `page.touchscreen` and CDP `Input.dispatchTouchEvent` (two fingers). Layout checks
   (inside the stage, no overlap, text fits, at least 80×72) replace `elementFromPoint`; pixel
   checks keep their 720×1280 world mapping by using the world rectangle instead of the canvas.

## Pitfalls

- **The first phone run showed the boot logo, then only the stage colour.** WeChat on iOS has no
  `TextEncoder`, and `ZhudaPrefabLibrary.instantiate` hashes the definition with
  `new TextEncoder()`; no game had used the prefab library in a mini game before. The simulator
  never showed it because it runs in a browser. Reproduced in a simulator copy whose shim also
  removes `TextEncoder` (`TypeError: TextEncoder is not a constructor` right after the library
  step); a UTF-8 `TextEncoder` in `src/platform/wx-polyfills.ts`, installed only when missing,
  fixed that copy. Emulate the host's gaps before trusting a simulator: the owner's
  `zhuda-wechat-game` notes list what WeChat on iOS lacks (`TextDecoder`, `TextEncoder`, `Blob`,
  `URL.createObjectURL`, `crypto.subtle`).
- **Show boot errors on the device.** With no console on the phone a failed `main()` is a blank
  screen. `src/platform/boot-report.ts` records each boot step and shows the first error with
  `wx.showModal` (and on the stage), with the steps reached and what each polyfill did.
- **The helper simulator cannot run any engine game as it is.** `weixin-minigame-helper` runs the
  package in a browser sandbox where `globalThis` is not the game's `window`; the engine reads
  `globalThis.Laya` and stops with `Cannot read properties of undefined (reading 'LayaGL')`. The
  owner's 猪大合一合 package, uploaded to WeChat before, fails the same way, so it is the simulator.
  Test with a copy of the package whose `game.js` requires a shim before `js/index.js` that
  defines getters `globalThis.Laya`/`wx` → `window.Laya`/`wx`; never ship the shim.
- **A native `Blob` in the simulator broke the first polyfill.** It kept the browser `Blob`, whose
  bytes cannot be read synchronously (`l.bytes.slice is not a function`). Replace `Blob` whenever
  `wx` exists.
- **The simulator refuses images from `wxfile://`** (its CSP allows `wxvfs:` and `data:`); real
  WeChat accepts `USER_DATA_PATH` files. Returning the package path for package files avoids the
  temporary file in both.
- **The first tap in the simulator can be lost**: focus moving into its iframe sends a blur,
  which clears held input and latched presses on purpose. A second tap works.
- **A full-width victory card covered the win.** At phone sizes the card spans the world; place it
  low when the player finished in the upper part of the world and high otherwise.
- **On a 9:16 window the pad covers the bottom of the world** (no spare bar): the drain-shaft pixel
  check collapses the pad for its screenshot.
- **`setScreenSize` honours `stage.offset` but the runtime's first resize runs inside `boot`.**
  Without the extra `context.resize()` the desktop stage stayed at the left edge.

## Engine gaps and their workarounds

| Gap                                                                                                                                               | Workaround                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ZhudaPrefabLibrary` needs `TextEncoder`, `Blob`, `URL.createObjectURL`, `crypto.subtle` and `DOMException`, which a WeChat mini game (iOS) lacks | `src/platform/wx-polyfills.ts` (step 5); a candidate for `zhuda-engine-prefabs/systems/minigame-host/polyfills.ts` |
| No accepted mini-game audio backend (`IframeSoundAdapter` is refused)                                                                             | `src/audio/ToneSynth.ts` (step 6)                                                                     |
| `zhuda-laya-minigame` at 2.0.0 has no syntax target and no orientation (both added after `91d21f79`)                                              | `tools/patch-wx.mjs` (step 8)                                                                         |
| No Laya-drawn interface module in the prefab library (`ui/*` modules are DOM)                                                                     | `src/ui/GameUI.ts`                                                                                    |
| No helper that maps a game's stage-space buttons to page coordinates for a browser check                                                          | the consumer's `button()` and `geometry()` in `scripts/verify-browser.mjs`                            |

## Checks

```sh
cd <workspace>/games/zhuda-aqua-freeze
npm run verify           # 2026-11-26: Doctor HEALTHY, 52 tests
npm run verify:browser   # 2026-11-26: ten levels, 1-1 clear in 1369–1373 steps, outline 3 px, 60 FPS P95 16.7–16.8 ms
npm run build:wx         # 2026-11-26: 23 files, 2,775,928 bytes, limit 4,194,304
```

The skill's `check-pkg` reported 2.61 MB, AppID set, no modern syntax; its `preview` made a QR in
34.5 s. Simulator screenshots: the consumer's `evidence/wechat-sim-2026-11-26/`.

## Not checked

- Anything measured on the phone: the owner played the fixed preview (the first build showed only the stage colour) and asked for the joystick; the joystick build's preview was made, its result is not recorded. Not checked either: the developer tools'
  own simulator, and any frame rate, memory or load time in a host.
- Sound in a host: `wx.createWebAudioContext()` and its `OscillatorNode` were not heard.
- Saving, the capsule inset and the bottom safe area on a real WeChat client; Android.
- The prefab gates of [prototype-to-center](prototype-to-center.md) (`prefabChecks`,
  `accept:prefabs`): the game declares `prefabPreview` only.
- In 4 runs of the browser script one failed at "the cup's water below the rim while filling"
  (fill 6, no cup-water pixels in that frame); not investigated.

## Boundaries

- Game: levels, simulation, shaders, art, `GameUI.ts`, the polyfills and the tone synth until the
  library takes them, its evidence and its AppID.
- Prefab library: the host bridge it copies; candidates for it: the WeChat polyfills, the tone
  synth, a stage-drawn button and screen set.
- Engine: boot, sizing, the build, the Doctor, the mini-game tool and its audit.
