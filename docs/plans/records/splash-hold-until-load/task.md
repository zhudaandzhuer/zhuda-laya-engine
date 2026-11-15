# Task: the start splash waits for the page

## Source requirement

User report (2026-11-15, a consumer game on a phone over a slow link): after
the LayaAir splash, the whole screen stays the page's background colour for a
while before the game's progress bar appears, and looks frozen.

## Cause

`runBrandSplash` and the splash CSS released the splash on a fixed clock
(2180 ms; CSS exit animation at 1760 ms) whatever the page was doing. A
consumer page with several megabytes of start-up scripts was still downloading
them when the splash left, so nothing but the background was drawn until the
game's own code ran.

## Change (engine, `packages/compiler/branding.mjs`)

- The splash stays at least 2180 ms **and** until the window `load` event (all
  start-up scripts have run). The exit animation runs on `.is-complete`, which
  the script sets; no fixed CSS delay.
- Past 2180 ms with the page still loading it carries `is-waiting` and the bar
  loops (a still bar under reduced motion).
- `__ZHUDA_SPLASH__` gains `loaded`. A page without the splash node now reports
  `completed: true` instead of never completing.

## Invariants

- `mode: 'none'` completes at once. Branding schema unchanged.
- The splash never advances game time; it only holds the boot UI.
- `__ZHUDA_SPLASH__.completed` still means the splash is gone or going.

## Non-goals

- A game's own loading screen (after the scripts run) stays the game's.
- Real phone acceptance of this change.

## Evidence

See `verification.md`.
