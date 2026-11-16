# Task: the procedural draw check photographed the start splash

Status: Done\
Last reviewed: 2026-11-16

## Source requirement

`docs/plans/records/threejs-gap-audit/progress.md`, handoff of 2026-11-16
("the sky-island branch merged"), open item 3: `npm run verify:procedural`
fails with `relief-v: expected the normal-mapped panel and the geometry
panel` (once on `relief-u`), already on `3b63fee`, `777f04c` and `45f8664`.
It passed in the `specular-aa` and `quality-defaults` records.

## Goal

Find why, and make the check pass on WebGL without weakening what it proves:
that a flat normal-mapped panel shades like real geometry with the same relief
on both texture axes, and is flat without its map.

## Cause

`e71da33` (2026-11-15, "the start splash waits for the page to load before it
leaves", record `splash-hold-until-load`) changed when the splash fades.
Before it, the CSS fade ran on a fixed clock from 1760 ms to 2180 ms, and
`__ZHUDA_SPLASH__.completed` was set at 2180 ms, when the splash was already
invisible. Since it, `completed` is set when the splash is released, and the
420 ms fade starts then; the node is removed at 460 ms. Its own task says so:
`completed` means "gone or going".

`tests/fixtures/procedural-draw.ts` waits for `completed`, draws six frames
and reports ready; `scripts/verify-procedural-draw.mjs` then screenshots the
page (it does not read the canvas). The picture showed the grey LayaAir
tribute splash part-faded over the whole page. `panels()` looks for runs
brighter than 45 on the middle row: the grey lifted the dark background over
45 and the black logo cut the row, so it found one run or three depending on
how far the fade had got. The engine drew the panels exactly as before.

## Change

- `scripts/verify-procedural-draw.mjs`: before each screenshot, wait (10 s at
  most) until `#zhudaLogoSplash` is gone. A timeout fails the check by name.
  `panels()`, its threshold and every assertion are unchanged.
- `tests/engine-splash.test.mjs`: a test that `completed` is set while the
  node is still in the page with `is-complete`, that it is removed 460 ms
  later, and that the CSS fade is shorter than that.
- `docs/agent-development.md`: a check that screenshots the page waits until
  `#zhudaLogoSplash` is gone; one that reads the canvas does not need to.

## Invariants

- The splash's behaviour (hold until load, 2180 ms intro, 420 ms fade) is not
  changed; a game sees no difference.
- The check proves the same thing with the same numbers.

## Non-goals

- Changing what `completed` means in the engine. Most draw checks read the
  canvas (`gl.readPixels`), which the overlay does not reach.
- WebGPU: this check runs on WebGL only.

## Acceptance

See `verification.md`.
