# Route: full screen and zoom prevention for a phone web game

A web game opened in a phone browser or in WeChat: neither a double tap nor two fingers
zoom the page; on Android one tap enters native full screen (the address bar and the
system bars are hidden); in an iPhone browser (Safari and the like, not WeChat) the player
swipes once on first entry so that Safari collapses its address bar. The whole strategy is
practice taken from a production H5 platform (not in this repository), made into the
component `prefabs/ui/page-lock`. Zoom prevention and the swipe-up layer were checked in
headless Chrome emulating phones; real phones have not been tried yet.

- **Id:** `mobile-web-fullscreen`
- **Kind:** workflow
- **For:** Any web game to be played in a phone browser or inside WeChat: no page zoom from a double tap or two fingers, full screen on Android, and the iPhone's limits and what to do about them.
- **Checked on:** headless Chrome emulating upright 390×844 and sideways 844×390 touch
  phones (zoom prevention); the same emulating the UAs of iPhone Safari, iPhone WeChat and
  Android (the swipe-up layer); neither full screen nor the iPhone on a real device
- **Status:** Done on 2026-11-26 in Zhuda Whirlwind 1 (豬大旋風1) (a player reported that a
  double tap on a phone zoomed the page): the `touch-action` of `<html>` went from `auto`
  to `none`, and `visualViewport.scale` is still 1 after a double tap and after two
  fingers; 5 tests of the shared component; published at 02:10, and the public URL was
  measured in the same way. The iPhone swipe-up layer (`iosSwipeUp`) was added the same
  day: emulating iPhone Safari upright and sideways, the layer blocks taps, a finger
  swiping up scrolls the page past the threshold and the layer gets out of the way, the
  game does not move, the Start game button (「開始遊戲」) can be pressed and nothing
  zooms; emulating WeChat and Android it does not appear; 10 tests of the shared
  component; published at 02:31, and the public URL was measured in the same way. Both
  were published to the owner's portals (see `PORTALS.md` in the workspace, which holds
  the two publication ids). No real phone was tried.
- **Reference consumer:** `prefabs/ui/page-lock/page-lock.ts`
  (`prefabs/tests/page-lock.test.mjs`) in this repository; ZhudaGameCenter
  `games/zhuda-whirlwind-1` (outside this repository): `src/Main.ts` (the `lockPage`
  call), `public/index.html` (the viewport), `public/game.css` (`.cp-menu-panel`, and
  `#app` fixed), `tools/check-zoom.mjs`, `tools/check-swipe-up.mjs`.
- **Engine version:** zhuda-laya-engine `def94aa` (LayaAir 3.4.2)

## When to take this route

- Fits: every web game that will be opened in a phone browser, in WeChat or on the mobile
  site of itch.io (landscape and portrait games alike). **Add it when a new game is
  started; do not wait for a player to report it.**
- A landscape game that must become landscape on a phone held upright: take
  [mobile-always-landscape](mobile-always-landscape.md) as well (the two are used
  together).
- Does not fit: a WeChat mini-game (it is not a web page and the platform handles this
  itself; see [mini-game-build](mini-game-build.md)); a page for desktop only.

## Tools

- The component `prefabs/ui/page-lock`: `node prefabs/scripts/sync.mjs <game dir> ui/page-lock`
  from a checkout of this repository, or from a game
  `node node_modules/zhuda-laya-engine/prefabs/scripts/sync.mjs . ui/page-lock`.
- The check: the game's `tools/check-zoom.mjs` (headless Chrome;
  `Input.synthesizeTapGesture` for the double tap, `Input.synthesizePinchGesture` for two
  fingers).

## Steps

The game named is the workspace's `games/zhuda-whirlwind-1`.

1. **Read the platform differences first (the whole strategy).**

   | Platform                               | Zoom prevention                                                                                                                                                                             | Full screen                                                                                             | Production practice                                                                                                                                                                                                                                                                                                                                     | Here (`ui/page-lock`)                                                                                                                                                                                                                                  |
   | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Android Chrome                         | `user-scalable=no` in the viewport is enough                                                                                                                                                | `documentElement.requestFullscreen({ navigationUI: 'hide' })`, which must be called inside a user's tap | A hint layer covers the page before full screen (translucent and blurred, an animated image, a line of text, an × in the top right corner). Tapping the hint enters full screen; pressing × stops the hint for this page; leaving full screen brings the hint back; on a failure it sets `Laya.stage.fullScreenEnabled = true` and shows the hint again | No hint: any touch tap (`pointerup`, not a mouse) asks for full screen. `fullscreenWhen` lets the game decide when the switch is allowed (not during a match); after two refusals it stops asking                                                      |
   | Android WeChat (XWeb, a Chromium core) | As Android Chrome                                                                                                                                                                           | As above, but whether WeChat allows it was not verified                                                 | As above                                                                                                                                                                                                                                                                                                                                                | As above; it stops after two refusals                                                                                                                                                                                                                  |
   | iPhone Safari                          | **Ignores `user-scalable=no` (since iOS 10)**; it needs `touch-action: none`/`manipulation` (which blocks the double tap since iOS 13) and blocking `gesturestart/change/end` (two fingers) | The iPhone has no full-screen API for web pages (the iPad has one)                                      | "Swipe up": a transparent layer 200dvh tall makes the page scrollable, the game is fixed on the screen, and an animated swipe-up image is shown in the middle. When the player swipes up and the page really scrolls, Safari collapses the address bar (details in step 5)                                                                              | The same (`iosSwipeUp`): the arrows are drawn with CSS and the text is given by the game; when the game is turned 90° the text turns with it and the arrows still point to the top of the screen; the page's `touch-action` is `pan-y` (still no zoom) |
   | iPhone WeChat (WKWebView)              | As iPhone Safari                                                                                                                                                                            | None; WeChat's own bar is at the top and a swipe does not collapse it                                   | No swipe-up (skipped when the page is in an iframe or the UA contains `closeSwipe`)                                                                                                                                                                                                                                                                     | Zoom prevention only                                                                                                                                                                                                                                   |
   | Desktop                                | Ctrl + wheel (a trackpad pinch) zooms                                                                                                                                                       | No automatic full screen                                                                                | `preventDefault` on Ctrl + wheel                                                                                                                                                                                                                                                                                                                        | The same; a mouse click does not ask for full screen                                                                                                                                                                                                   |

2. **Lock the page as soon as it opens.** The game's `Main.ts` calls this before the
   engine boots:

   ```ts
   import { lockPage } from './common/ui/page-lock/page-lock.ts';
   let fighting = () => false;
   lockPage({ fullscreenWhen: () => !fighting(), signal: lifetime.signal });
   // once the game object has been built:
   fighting = () => game.screen === 'fight';
   ```

   What it does:
   - the viewport becomes
     `width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no`,
     and other keys (`viewport-fit=cover`) are kept;
   - `<html>` and `<body>` get `touch-action: none` and `overscroll-behavior: none`;
   - `gesturestart`/`gesturechange`/`gestureend`, a `touchmove` with two or more fingers,
     and Ctrl + wheel all get `preventDefault`, with listeners registered
     `{ passive: false, capture: true }`;
   - on a touch device that is not iOS, a touch tap asks for full screen;
   - `dispose()`, or aborting `signal`, restores everything.

3. **Write the locked viewport straight into `index.html`** (so that the page cannot be
   zoomed before the JS runs either):
   `<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />`.
   The LayaAir runtime also changes the viewport to a similar value, but the iPhone
   ignores it.
4. **A panel that scrolls sets its own `touch-action: pan-x pan-y`** (for example
   `.cp-menu-panel` of `ui/game-menu`). WebKit works `touch-action` out afresh at a scroll
   container: without it the value goes back to `auto` and a double tap inside zooms again;
   with `none` the panel cannot scroll.
5. **The swipe-up layer for iPhone browsers (`iosSwipeUp`).**
   - The game's root element is `position: fixed` in the CSS (Zhuda Whirlwind 1:
     `#app { position: fixed; left: 0; top: 0 }`; the `html.rot #app` that is turned 90°
     needs `right: auto; bottom: auto` added), and only then does the game stay still when
     the page scrolls. When it is not set, the component adds it with inline styles.
   - The call:
     `lockPage({ …, iosSwipeUp: { game: el('app'), label: '順著箭頭滑一下，全螢幕開玩', labelTurn: () => (rotated() ? 90 : 0) } })`
     (the label reads "swipe along the arrows to play in full screen"). **Do not write
     "up" in the text**: when the game is turned 90°, the top of the screen is the
     player's left.
   - It appears only in the top-level page of an iPhone browser, once per load. The test:
     the UA has `iPhone`/`iPod` and also `Safari/`; it does not contain `MicroMessenger`,
     `Line/`, `FBAN`, `FBAV`, `Instagram` or `closeSwipe`; the page is not an app added to
     the home screen; it is not inside an iframe.
   - What the component does:
     - it adds a `#cp-swipe-up` to `body`: an element in normal flow with `height: 200dvh`
       (with `200vh`/`200svh` as fallbacks), `touch-action: pan-y` and `z-index` 50, which
       blocks taps;
     - inside it are a fixed dark scrim (`rgba(20,10,4,.6)`), three CSS arrows pointing up
       (animated) and a pill of text;
     - `<html>` gets `data-cp-swipe-up`, with an `!important` rule that opens the
       `overflow` of `<html>`/`<body>`;
     - the `touch-action` of `<html>`/`<body>` becomes `pan-y` (not `none`, or the page
       could not scroll); `scrollTop = 0`.
   - When it is complete: on a `scroll` event, only when the page has really scrolled
     `min(80, max(24, floor(maximum scroll / 4)))` or more (`swipeUpThreshold`). **Do not
     go by the distance the finger moved**: locking the scroll too early leaves iOS unable
     to collapse the address bar. When the maximum scroll is less than 24 it ends on the
     next frame.
   - After completion the layer stays in the page, changed to `z-index: -1` and
     `pointer-events: none`, with the scrim hidden. `pan-y` and `overflow` are both kept,
     so the address bar can still be swiped back out later.
   - LayaAir's canvas click coordinates are offset after the page scrolls: the correction
     is to adjust the `tx/ty` of `stage._canvasTransform` by the touch event's
     `pageY − clientY` (taken from production practice; not checked here). The controls
     here are all DOM and do not need it; add it only when Laya's own canvas clicks are
     used.
6. **Confirm.** In the game's folder run `node tools/check-zoom.mjs`: after a double tap
   and after two fingers spreading, upright and sideways, `visualViewport.scale` must be 1
   and the `touchAction` of `<html>` must be `none`. Then run
   `node tools/check-swipe-up.mjs` (it emulates by UA iPhone Safari upright and sideways,
   iPhone WeChat and Android); it must end by printing `SWIPE-UP OK`, and it saves
   screenshots as `design/build-shots/swipe-*.png`. To compare with the live version:
   `URL=<URL of the public release> node tools/check-zoom.mjs`. Full screen and the iPhone
   must be looked at on real phones (see Checks).

## Pitfalls

- **At boot LayaAir sets the inline `overflow` of `<body>` back to `hidden`** (the first
  version of the swipe-up layer ran into it):
  - The inline `overflow: visible` that the component set before the engine booted was
    overwritten. While `<html>` is visible, the `hidden` of `<body>` is passed on to the
    whole viewport, and a finger cannot scroll the page. A `scrollTo` from code still
    scrolls it, so the unit tests do not catch this.
  - Fix: put an attribute on `<html>` and pair it with an `overflow: visible !important`
    rule.
  - How to confirm: `getComputedStyle(document.body).overflow` must be `visible`, and a
    touch scroll (`Input.synthesizeScrollGesture` with `gestureSourceType: 'touch'`) must
    really scroll the page.
- **Only the iPhone zooms, and headless Chrome cannot reproduce it** (reported by a player
  on 2026-11-26):
  - Cause: the LayaAir runtime had already changed the viewport to `user-scalable=no`, so
    Android and Chrome never zoomed; the iPhone ignores that setting and obeys only
    `touch-action`. At the time only the canvas and the touch buttons had
    `touch-action: none`, so a tap on the menu or the HUD zoomed.
  - How to tell: read `getComputedStyle(document.documentElement).touchAction`; when it is
    `auto` the page is affected.
  - Fix: steps 2 to 4.
- **Touch emulation on a Mac is taken for an iPad**: headless Chrome with touch emulation
  on has `navigator.platform === 'MacIntel'` together with `maxTouchPoints > 1`, which is
  exactly the test for iPadOS, so full screen is not asked for. To test the Android
  behaviour, set an Android UA and `platform: 'Linux armv8l'` with
  `Emulation.setUserAgentOverride`.
- **Headless Chrome never grants full screen**:
  - Even `requestFullscreen` called through `Runtime.evaluate` with `userGesture: true`
    answers `not granted` (`fullscreenerror`).
  - For a synthesised tap, `navigator.userActivation.isActive` is false at `pointerup`.
  - So full screen can only be confirmed on a real device.
- **For two fingers block only `touchmove`, not `touchstart`**: the production practice
  blocks both.
  - In a fighting game it is common to hold the stick with one thumb and tap a button with
    another finger; cancelling the second finger's `touchstart` cancels the `click` of
    that tap with it.
  - The controls here (`press` of `ui/dom`, the stick, hold buttons) all listen to pointer
    events. Pointer events are sent before touch events and are not affected.
- **Do not switch to full screen during a match**: the switch changes the size of the
  screen, and the stick and the buttons move to other places under the thumbs, so
  `fullscreenWhen` blocks it.

## Engine gaps and their workarounds

- The engine's `boot` has no "phone page lock" option (viewport, `touch-action`, gestures,
  full screen). Workaround: every game syncs `ui/page-lock`. When the engine adds it,
  switch to the engine's option.
- LayaAir changes the viewport by itself, but the iPhone ignores that value. When the
  engine adds the option it must deal with `touch-action` as well.

## Checks

- `npm run verify` of the prefab library in `prefabs/` (it includes the 10 tests of
  `tests/page-lock.test.mjs`):
  - the viewport keys that lock zoom, and the other keys kept;
  - gestures, two fingers and Ctrl + wheel are blocked, one finger is not;
  - a touch tap asks for full screen, with `navigationUI: 'hide'`; a mouse, a match in
    progress and an iPhone do not; it asks again after full screen is left; it stops after
    two refusals;
  - `dispose` restores everything;
  - the swipe-up layer: the threshold formula; still waiting at a scroll of 79 and
    complete only at 80; after completion it gets out of the way but stays in the page; a
    game that is already fixed is not touched; the text turns and the arrows do not; with
    nowhere to scroll it ends at once; it does not appear in WeChat.
- The game's `node tools/check-swipe-up.mjs`; the result on 2026-11-26 was `SWIPE-UP OK`:
  - iPhone Safari upright: the layer blocks the Start game button; after the swipe up the
    page had scrolled to 506 px, the layer got out of the way and `#app` was still at
    (0,0); the Start game button could be pressed and the screen did not zoom.
  - iPhone Safari sideways: scrolled to 235 px, otherwise as upright.
  - iPhone WeChat and Android: no swipe-up layer, `touch-action: none`.
- The game's `node tools/check-zoom.mjs`: `NO ZOOM` both upright and sideways, and
  `touchAction` is `none` (2026-11-26: the live version `auto`, the new version `none`).
- Real phones (after publishing; the owner's `zhuda-mobile` agent skill (not in this
  repository) can operate a vivo V40 and an iPhone 14, or ask the owner to try):
  - iPhone WeChat and Safari: double-tap the menu and the HUD quickly and spread two
    fingers; the screen does not get bigger;
  - iPhone Safari: on first entry the swipe-up layer is shown, after one swipe along the
    arrows the address bar collapses and the game can be pressed as usual; in WeChat the
    layer does not appear;
  - Android Chrome and WeChat: one tap on the title screen and the address bar and the
    system bars disappear; a tap during a match does not switch.

## Not checked

- That a double tap and two fingers no longer zoom on a real iPhone: the Mac used has no
  complete Xcode and so no iOS simulator. Confirmed only: `touch-action` went from `auto`
  to `none`, and Chrome does not zoom.
- Whether a real Android phone and WeChat's XWeb really enter full screen, and whether
  WeChat allows full screen for a web page.
- That iPhone Safari really collapses the address bar (headless Chrome has no Safari
  toolbar; it can only confirm that the page really scrolls past the threshold); what the
  game looks like when `100dvh` grows after the collapse and the layout is redone.
- Whether to prompt again after the address bar has been swiped back out in mid-game (by
  scrolling back down to the top): at present the layer does not appear again (once per
  load, a rule taken from production practice; not checked here).
- Full screen when the game is inside an iframe (an itch.io embed): the iframe needs
  `allow="fullscreen"`; not tried.

## Boundaries

- The prefab library (`prefabs/`): `ui/page-lock` (zoom prevention, Android full screen,
  the iPhone swipe-up layer).
- The game:
  - the call of `lockPage` and the condition in `fullscreenWhen` (when the switch is not
    allowed);
  - the viewport in `index.html`;
  - the `touch-action` of its own scrolling panels.
- The engine: see the engine gaps above.
