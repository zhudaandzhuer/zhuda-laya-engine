# Route: a landscape game on a phone held upright (no "turn your phone" prompt)

A landscape game on a phone held upright does not show "please turn your phone sideways":
the whole game (the canvas and the DOM interface) is turned 90° with CSS so that it fills
the screen, and the player simply turns the phone and plays; when the phone turns the page
by itself (auto-rotate is on) nothing is turned. The controls are DOM touch controls (a
virtual stick, buttons). Checked in headless Chrome emulating a 390×844 DPR 3 touch phone,
an 844×390 phone held sideways and a 1280×720 desktop.

- **Id:** `mobile-always-landscape`
- **Kind:** workflow
- **For:** A landscape web game that is landscape the moment it opens on a phone held upright (above all in WeChat and other in-app browsers that do not rotate the page), with no turn-your-phone prompt.
- **Checked on:** headless Chrome emulating an upright 390×844 DPR 3 touch phone, a
  sideways 844×390 phone and a 1280×720 desktop; no real phone
- **Status:** Done on 2026-11-26 in Zhuda Whirlwind 1 (豬大旋風1): held upright, the
  canvas and the stage are 844×390, the prompt is not shown, and pushing the stick towards
  the game's right moves the character to the right; held sideways and on the desktop the
  canvas is unchanged.
- **Reference consumer:** ZhudaGameCenter `games/zhuda-whirlwind-1` (outside this
  repository): `src/ui/rotate.ts`, `public/game.css` (`html.rot`), `src/Main.ts`,
  `src/ui/input.ts`, `tools/check-rotate.mjs`; `prefabs/ui/virtual-stick` (`toLocal`,
  `bounds`) in this repository.
- **Engine version:** zhuda-laya-engine `def94aa` (LayaAir 3.4.2)

## When to take this route

- Fits: a landscape 2D game with a fixed design size (for example 1280×720,
  `scaleMode 'full'`) whose controls are all DOM (touch buttons, a stick), to be run in a
  phone's web browser or an in-app browser.
- Does not fit: a game that relies on Laya's own mouse or touch events to click things
  inside the canvas (Laya's coordinate conversion after the turn was not verified; see Not
  checked below); a portrait game (the turn the other way has not been done); a mini-game
  platform (use the platform's `deviceOrientation` setting, see
  [mini-game-build](mini-game-build.md)).

## Tools

- Headless Chrome (this repository's `packages/compiler/chrome-host.mjs`):
  `Emulation.setDeviceMetricsOverride` with 390×844, `deviceScaleFactor 3`, `mobile true`;
  `Emulation.setTouchEmulationEnabled`; `Input.dispatchTouchEvent` to push the stick.
- The check script: `tools/check-rotate.mjs` in the workspace's `games/zhuda-whirlwind-1`
  (screenshots go to `design/build-shots/portrait-*.png`).

## Steps

The files named are in the workspace's `games/zhuda-whirlwind-1`.

1. **Decide whether to turn.** Turn when
   `matchMedia('(orientation: portrait) and (pointer: coarse)')` matches; `?rotate=0` turns
   it off (for checks). Add `rot` to `<html>` before the engine boots, and apply it again
   when the orientation changes. File: `src/ui/rotate.ts` (`rotated()`, `applyRotation()`,
   `onRotationChange()`).
2. **CSS turns the whole `#app` 90° clockwise.**
   `html.rot #app{position:fixed;left:50%;top:50%;width:100vh;width:100dvh;height:100vw;transform:translate(-50%,-50%) rotate(90deg)}`;
   an interface sized in rem computes its font size from the "turned width and height"
   (`html.rot{font-size:min(calc(100vw/72),calc(100vh/100))}`, which is the original with
   vw and vh swapped). The old turn-your-phone prompt is removed altogether
   (`#rotate{display:none !important}`). File: `public/game.css`.
3. **Make the engine open the canvas at the turned size.** The engine sizes the canvas
   from the container's `getBoundingClientRect()`; a turned container measures upright on
   the screen, so the canvas covers only half of it. Before `boot`, call
   `measureUnturned(container)`: while turned, the container reports its own layout size
   (`clientWidth`/`clientHeight`, landscape). Check: the `clientWidth×clientHeight` of
   `#game canvas` and `Laya.stage.width×height` are both 844×390.
4. **Lay out again when the orientation changes.**
   `onRotationChange(() => requestAnimationFrame(() => context.resize()))`; as soon as the
   orientation changes, clear the touch state (`touch.clear()`), so that a button a finger
   is still holding does not stick.
5. **Convert touch coordinates to game coordinates.** After a 90° clockwise turn the
   game's x runs down the screen and its y runs leftwards from the right edge of the
   screen: `toGame(cx, cy) = { x: cy, y: innerWidth - cx }`, and the game's size is
   `{ width: innerHeight, height: innerWidth }`. Since 2026-11-26 Whirlwind keeps its box between
   4:3 and 2.5:1 and may centre it with bars, so both count from the box instead
   (`#app.getBoundingClientRect()`: `{ x: cy − box.top, y: box.right − cx }`, size
   `#app.clientWidth × clientHeight`): [screen-fit-game-box](screen-fit-game-box.md). The virtual stick takes
   `createVirtualStick({ …, toLocal: toGame, bounds: gameSize })`; buttons are DOM elements,
   and the browser handles their turned hit areas by itself, with no conversion. Check:
   dragging 90 px downwards from the screen point (W−300, 140) makes P1's x grow (measured
   652 → 1159).
6. **Font subset.** When newly added text (for example a "°" in a comment or in the
   interface) will be displayed, run `tools/subset-font.py` again, otherwise the font test
   fails.
7. **Zoom prevention and full screen.** That is another route,
   [mobile-web-fullscreen](mobile-web-fullscreen.md) (`prefabs/ui/page-lock`); a phone web
   game takes both.

## Pitfalls

- **With the CSS turn alone the canvas covers only the top half**: the engine's `resize()`
  reads the container's `getBoundingClientRect()`, which is in screen coordinates (390×844
  after the turn), so the canvas is made upright and squeezed into the turned `#app`. Fix:
  `measureUnturned` in step 3. Letting Laya turn the canvas itself with `boot`'s
  `screenMode: 'horizontal'` was considered, but the engine switches
  `screenAdaptationEnabled` off and writes the canvas's CSS size itself; the two ways of
  turning would fight, so it was not used.
- **The stick is 90° off**: the default stick computes its displacement from
  `clientX/clientY`; after the turn, pushing towards "the game's right" (down the screen)
  becomes a crouch. Fix: step 5.
- **Both a "turn your phone" prompt and "pause the offline match while upright" are
  present**: the old way showed the prompt and paused when the phone was held upright;
  with forced landscape both must go, and only the clearing of touches on an orientation
  change stays.

## Engine gaps and their workarounds

- None open. When the route was checked (engine `def94aa`), `boot`/`resize()` had no way to
  state the canvas's layout size and only measured the container's box on the screen, so the game
  overrides the container's `getBoundingClientRect` (`measureUnturned` in `src/ui/rotate.ts`).
  Since 2.0.0 `boot({ layoutSize: () => ({ width, height }) })` gives the engine the layout size
  ([platform adapters](../platform-adapters.md)); a game on 2.0.0 passes the turned stage's size
  there and drops the override. The reference game still carries the override: checked with it,
  not with the option.

## Checks

- `node tools/check-rotate.mjs` (in the game's folder) prints `layout.rot true`,
  `canvas [844,390]`, `stage [844,390]`, `rotatePromptShown false`,
  `p1After.x > p1Before.x`, `errors []`; look at `design/build-shots/portrait-01-title.png`
  (the title screen turned 90° as a whole and filling the screen) and
  `portrait-03-stick-right.png` (health bars, timer, stick and buttons all in their turned
  places).
- Held sideways at 844×390 and on the desktop at 1280×720: `rot false`, no transform on
  `#app`, and the canvas is the size of the window (measured on 2026-11-26 with a one-off
  script).
- `npm run verify` in the game (build, types, Doctor, tests); `npm run verify` of the
  prefab library in `prefabs/` (`tests/virtual-stick-local.test.mjs`: the turned
  conversion, and the default behaviour unchanged).

## Not checked

- No real phone (iPhone Safari, Android Chrome, WeChat's in-app browser) was tried; only
  the emulation in headless Chrome.
- The changes of `100dvh` caused by a notch, rounded corners or the browser's address bar
  collapsing were not measured.
- Turning the phone in mid-game (upright → sideways → upright) relies only on the `change`
  event of `matchMedia`; the whole sequence was not emulated.
- Laya's own canvas clicks (`stage.on(MOUSE_DOWN)` and the like) were not verified in the
  turned coordinates; this route assumes every control is DOM.
- The turn is always clockwise; the direction is not chosen from the way the phone is
  really held (turned left or turned right).

## Boundaries

- The game: `rotate.ts`, the CSS of `html.rot`, the call of `measureUnturned`. Which
  element is turned and how the font size is computed differ with each game's layout.
- The prefab library (`prefabs/`): the virtual stick's `toLocal`/`bounds` options
  (`prefabs/ui/virtual-stick`). When a second game needs the turn, take `rotate.ts` out
  into a component under `prefabs/ui/`.
- The engine: an option for the canvas's layout size (see the engine gap above).
