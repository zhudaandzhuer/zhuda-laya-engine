# Task: a look rebuild keeps the water; a phone does not stay paused

## Source requirement

User reports from a consumer 3D game (2026-11-16):

1. On a desktop browser, at any picture setting, the river and the clouds show
   for a moment and then vanish.
2. On an iPhone 14 (Safari, and the WeChat web view), the character appears but
   cannot move for a long time; the FPS readout does not appear; the HUD still
   answers taps. At times this lasts minutes.

## Causes

1. `ZhudaSceneLook.setQuality` (and a `setLook` that rebuilds) releases the
   look, which puts the camera back as it was before the look was built. A
   pass another part turned on after the look — the game's water surface
   turns on the depth picture and the opaque pass — is lost, so the water
   draws nothing. The quality governor lowers the level a few seconds after
   start, which is the "for a moment". `FilmStage` already turned them on again
   after a rebuild; `ZhudaSceneLook` did not. (The clouds going at level 0 is
   the level's own choice.)
2. `ZhudaRuntimeSession` pauses on `window` `blur` and resumes on `focus`.
   iOS sends `blur` when the address bar, keyboard or a system sheet takes
   focus and often never sends `focus` back, so the runtime stays paused on a
   visible page. Seen on the iPhone: the game clock stood still for over ten
   minutes after the address bar was opened and closed; tapping the view did
   not resume it.

## Change (engine)

- `ZhudaSceneLookOptions.cameraPasses: { depth?, opaque? }`: the look turns
  these on after every build and rebuild, after its own chain recorded the
  camera, and leaves them as found when released or disposed.
- Runtime: on a touch-only device (`(pointer: coarse)` and not
  `(pointer: fine)`) a window `blur` does not pause; `visibilitychange` and
  `pagehide` still do. On every device a `pointerdown` or `keydown` on a
  visible page resumes a background pause (a manual pause stays).

## Invariants

- A look without `cameraPasses` behaves as before (no extra depth picture at a
  low level, nothing left behind after dispose).
- Desktop windows still pause on blur; hidden pages still pause everywhere.

## Non-goals

- Why the iPhone's first start sometimes waits (not reproduced yet).
- Consumer assets (the game's foliage alpha) stay in the consumer.
