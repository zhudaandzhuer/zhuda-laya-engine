# Task: the default splash is a tribute to LayaAir

Status: Implemented; drawn in desktop Chrome at phone and desktop sizes.

## Source requirement

The owner asked that every game start with the LayaAir boot picture (the mark
and "Powered by LayaAir Engine") in place of the 豬大 × LayaAir one, as a
tribute to the engine this one is built on, and that it stay replaceable.

## Change

- `assets/branding/layaair-tribute-mark.svg`: the mark, 640 px, two tones.
- `ZHUDA_ENGINE_SPLASH` (`packages/compiler/branding.mjs`): one record naming
  the default picture and words. `branding.mode: 'engine'` (the default) shows
  it on plain grey with a white progress bar; `'custom'` and `'none'` are
  unchanged, as are the reserved `#zhudaLogoSplash` node, the 2.18 s duration
  and `window.__ZHUDA_SPLASH__`.
- The compiler entries (`consumer-build`, `browser-sdk`, `zhuda-build`,
  `zhuda-minigame`) read the new file.

## Provenance of the picture

No official file was at hand. The mark was redrawn by image generation from
the owner's screenshot of a LayaAir build's own boot screen, cropped to its
bounds and reduced to black, white and transparency. The mark belongs to
Layabox. Replace the file with an official one when available: nothing else
needs to change.

## Invariants

- Visual branding does not replace attribution: `zhuda-notices` is unchanged.
- A project that sets `branding` keeps exactly what it had.

## Non-goals

Removing `assets/branding/zhuda-layaair-mark.svg`; a new branding mode.

## Behaviour change to note

Every build without a `branding` setting shows the new splash. A released
Browser SDK is immutable: the hosted 1.17.0 keeps the old splash until the
next version is released.

## Acceptance evidence

See [verification](verification.md).
