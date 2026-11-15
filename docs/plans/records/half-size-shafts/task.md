# Task: light shafts marched at half size; the iPhone blur trap in the sound adapter; the starter's TypeScript

## Source requirement

User (2026-11-16), passing on a suggestion: march the volumetric light at half
or quarter resolution and bring it up with a depth-aware blur, to win back
frame time at high quality. And: add background music to a consumer game,
which brought two more engine faults to light.

## Changes (engine)

1. `ZhudaLightFog`, `shafts.scale` (0.25..1, default 0.5): the beams are
   marched in a pooled half-size target (`ZhudaLightShaftsMarch`, the fog's own
   shader data, alpha holding the pixel's depth), smoothed twice by a
   depth-weighted seven-tap blur (`ZhudaLightShaftsBlur`), and read back in the
   fog pass from the four nearest texels weighted by distance and depth
   likeness (`ZHUDA_SHAFTS_LOW`). `scale: 1` keeps the old single pass. The
   film schema takes `lightFog.shafts.scale` and resolves it to 0.5; changing
   it rebuilds the look like `steps`.
2. `IframeSoundAdapter`: on a touch-only device a window `blur` no longer
   suspends the context; `pointerdown`/`keydown` on a visible page end a blur's
   silence everywhere. Same fault and same rule as the runtime's
   (`look-rebuild-and-phone-pause`).
3. `zhuda-init`: a new project's `typescript` is the engine's own version
   (from its `package.json`, 5.9.3 now). It was 5.6.3, which cannot read the
   engine's declarations (`Float32Array<ArrayBuffer>`), so every new project's
   `npm run verify` stopped at typecheck.

## Non-goals

- The fog pass's edge smoothing and the closed-form fog are unchanged.
- Device autoplay acceptance of streamed music.
