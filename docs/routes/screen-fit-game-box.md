# Route: a landscape web game that fits any window shape

A landscape web game (engine canvas plus DOM screens on top) that looks right in every window
shape: a desktop window from tall and narrow to 32:9, a tablet, a phone held sideways or upright,
a fold phone. The game lives in one box whose shape stays between 4:3 and 2.5:1; inside that
range the box is the whole window, outside it the box is centred and the room behind the title,
blurred, fills the bars. Driven by mouse, keyboard or touch. Checked in headless Chrome at twelve
window shapes; no real phone.

- **Id:** `screen-fit-game-box`
- **Kind:** workflow
- **For:** Making a landscape web game fit every window and screen shape without cutting off or overflowing anything: the box, the units, the bars, touch coordinates, a check over twelve shapes
- **Checked on:** desktop headless Chrome at twelve window shapes (1280×720 to 2400×675 and 600×900, phone and fold emulation with touch); no real phone
- **Status:** Done on 2026-11-26 in Zhuda Whirlwind 1 (豬大旋風1): `tools/check-fit.mjs` FIT OK on twelve views (the box, every screen's panels inside it, canvas and stage the box's size, the stick on letterboxed fold phones); `npm run verify` 61 of 61; published the same day (front end `20261126T032954126397Z`) and the same check FIT OK against the public page
- **Reference consumer:** ZhudaGameCenter `games/zhuda-whirlwind-1` (outside this repository): `public/game.css` (`#app`, `body::before`, `--u`), `src/ui/rotate.ts` (`toGame`, `gameSize`), `tools/check-fit.mjs`
- **Engine version:** zhuda-laya-engine 2.0.0 (`91d21f79`, LayaAir 3.4.2)

## When to take this route

Any landscape game whose screens are DOM over the engine canvas (`boot({ container, scaleMode:
'full' })`), opened in browsers of unknown shape. Take it together with
[mobile-always-landscape](mobile-always-landscape.md) (an upright phone shows the game turned)
and [mobile-web-fullscreen](mobile-web-fullscreen.md) (no zoom, full screen). For a game drawn
entirely on the canvas at a fixed design size, Laya's own `showall` / `fixedwidth` scale modes are
the simpler answer (see `dungeon-line-slot`, `drop-merge-2d-minigame`). A portrait game needs the
same idea with the numbers turned round; it was not done.

## Tools

None outside the browser. `tools/check-fit.mjs` drives the engine's headless Chrome host
(`packages/compiler/chrome-host.mjs`); `tools/play.mjs` with `VIEW=<w>x<h>[@dpr]` takes single
screenshots.

## Steps

1. **Choose the shape range.** 4:3 (1.33, tablets) to 2.5:1. Every phone held sideways is inside
   it (16:9 = 1.78, iPhone 19.5:9 = 2.17, 20:9 = 2.22, 21:9 = 2.33, a 22:9 flip phone = 2.44), so a
   phone is never letterboxed; a desktop window narrower than 4:3, a fold phone (about 1.2) and a
   32:9 monitor are.
2. **The box in CSS.** One rule, no script:
   ```css
   #app { position: fixed; inset: 0; margin: auto;
          width: min(100vw, 250vh);  width: min(100vw, 250dvh);
          height: min(100vh, 75vw);  height: min(100dvh, 75vw); }
   html.rot #app { /* an upright phone, turned 90° (mobile-always-landscape) */
          left: 50%; top: 50%; right: auto; bottom: auto; margin: 0;
          width: min(100vh, 250vw);  width: min(100dvh, 250vw);
          height: min(100vw, 75vh);  height: min(100vw, 75dvh);
          transform: translate(-50%, -50%) rotate(90deg); }
   ```
   `250` is the 2.5 bound, `75` is 1/(4/3). `inset: 0; margin: auto` centres a sized fixed box
   without a transform, so the unturned box keeps no containing block for fixed children. It stays
   `position: fixed`, which the iPhone swipe-up layer of `ui/page-lock` needs.
3. **Units.** The DOM screens are sized in `rem` with `html { font-size: min(100dvh / 72,
   100vw / 100) }`, so a 100 × 72 rem frame always fits. Inside the range, `min(H/72, W/100)` of
   the box is the same number as of the window (worked out in the comment beside the rule), so the
   font size needs no change. A second unit for art that must keep its picture's proportions:
   `--u: min(100dvh / 72, 100vw / 128)` (`html.rot`: the two swapped), one 128 × 72 picture always
   fits. Set it in `@supports (height: 100dvh)` (see Pitfalls).
4. **The bars.** `body::before { position: fixed; inset: 0; background: url(<room>) center /
   cover; filter: blur(1.4rem) saturate(1.15) brightness(0.93); transform: scale(1.1) }` and a
   `box-shadow` on `#app`: outside the box the player sees the title's room, soft. Painted under
   `#app` by order; no z-index.
5. **The canvas.** Nothing to change: `boot({ container: #game })` with `scaleMode: 'full'` sizes
   the canvas from the container, which is inside the box. Check: `#game canvas` client size and
   `Laya.stage.width×height` equal the box's `clientWidth×clientHeight` in every view.
6. **Touch coordinates from the box corner.** A finger's `clientX/Y` is counted from the
   window; subtract the box. `toGame(cx, cy)`: `box = #app.getBoundingClientRect()`; unturned
   `{ x: cx − box.left, y: cy − box.top }`, turned `{ x: cy − box.top, y: box.right − cx }`;
   `gameSize()` is `{ width: #app.clientWidth, height: #app.clientHeight }` (layout size, never
   turned). `createVirtualStick({ …, toLocal: toGame, bounds: gameSize })`. DOM buttons need
   nothing. Check: on a letterboxed fold phone, sideways and upright, pushing the stick toward the
   game's right walks the fighter right (P1's x after one second: 840×720 652 → 910, 720×840
   turned 652 → 906, 390×844 turned 652 → 906).
7. **Make every panel fit 100 × 72 rem.** The narrowest box (4:3) is exactly 100 rem wide.
   Whirlwind's stage select had two 48 rem cards (112 rem with padding) and ran off the right edge
   of every box under 1.53:1; cards of 40 rem fit.
8. **Art made for 16:9 is not a background.** A flat key art with `background-size: cover`
   crops the characters at 4:3 and at 21:9 (the reported bug). Split it into layers placed in
   `--u` instead: [key-art-to-animated-title](key-art-to-animated-title.md).
9. **Check every shape.** `node tools/check-fit.mjs` (twelve views; `VIEWS=a,b` for a few;
   `URL=` for a published page). It asserts the box shape and centring, that the title's parts,
   the menus' panels and the result screen stay inside the box, that the start button and the logo
   leave the title's prize uncovered, the canvas size, the stick on the letterboxed touch views and
   no page errors; screenshots `fit-<view>-<screen>.png`. Look at them as well.

## Pitfalls

- **The bug report was a cropped title, the bigger fault was elsewhere.** A 788×883 desktop
  window cropped both pigs off the cover-sized key art, but the screenshots over six shapes also
  showed the stage-select panel running off the right edge at 4:3 and in every taller window,
  and the fight shown as a narrow vertical strip with tiny fighters in a portrait window. Take a
  screenshot of every screen at every shape before changing anything.
- **A custom property declared twice does not fall back.** `--u: min(…vh…); --u: min(…dvh…);`
  keeps the second even where `dvh` is unknown (custom properties are not checked when parsed),
  and every `calc(var(--u) …)` then fails. Ordinary properties fall back this way
  (`width: …vh; width: …dvh`); a custom property needs `@supports (height: 100dvh) { … }`.
- **The touch mapping assumed the box is the window.** The stick's `toGame` used
  `innerWidth`; with bars it would be off by the bar's width. Count from
  `#app.getBoundingClientRect()` (step 6).

## Engine gaps and their workarounds

None. The engine sizes the canvas from its container; the box is the container's parent and is
pure CSS.

## Checks

- `node tools/check-fit.mjs` → `FIT OK (12 views)` on 2026-11-26 (local build). Views:
  1280×720, 1440×900, 1024×768, 788×883, 600×900, 1720×720, 2400×675; touch 844×390 and 390×844
  (turned) at DPR 3, 1180×820, 840×720 and 720×840 (turned) at DPR 2.
- The phone checks of the neighbouring routes still pass: `tools/check-rotate.mjs` (upright
  390×844: canvas and stage 844×390, the stick walks right), `tools/check-zoom.mjs` (NO ZOOM),
  `tools/check-swipe-up.mjs` (SWIPE-UP OK), `tools/check-controls.mjs`.

## Not checked

- A real phone, tablet or fold phone; Safari and WeChat's own WebViews (container units are not
  used; `dvh`, `min()` and `inset` need iOS 15.4+ / Chrome 108+, older ones use the `vh` lines).
- A window resized while a fight runs (the engine re-measures on `resize`; not watched).
- Portrait games.

## Boundaries

The box, its numbers, the bars and the touch mapping are the consumer's CSS and a few lines of
its input code; they hold no game content and could become a prefab module if a second game
takes them. The engine keeps sizing the canvas from the container.
