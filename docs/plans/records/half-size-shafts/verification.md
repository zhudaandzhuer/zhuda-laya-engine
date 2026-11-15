# Verification: half-size shafts, sound adapter on phones, starter TypeScript

Base commit `1ae8d7b` plus uncommitted changes. macOS (Apple M4, under heavy
background load), headless Chrome, 2026-11-16.

| Command                                                                  | Result                                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test tests/light-fog.test.mjs tests/film-scene.test.mjs`         | pass; `scale` validated (0.25..1) and resolved to 0.5 in both schemas                                                                                         |
| `node scripts/verify-film-fog.mjs`                                       | pass on WebGL with the default half-size beams (shadowed fog dark, lit fog above and past the wall, open fog lit)                                             |
| `ZHUDA_FILM_RENDERER=webgpu node scripts/verify-film-fog.mjs`            | pass on WebGPU                                                                                                                                                |
| `verify-film-look`, `verify-quality-route` on both backends              | pass                                                                                                                                                          |
| `node --test tests/audio-hardening.test.mjs` (+ samples, streams)        | pass; the two new tests (input ends a blur's silence; touch-only ignores blur, hiding still silences) fail without the adapter change                         |
| `node --test tests/consumer-route.test.mjs`                              | pass; the starter's TypeScript equals the engine's                                                                                                            |
| Consumer game, misty morning toward the sun, `shaftScale` 1 / 0.5 / 0.25 | mean absolute pixel difference against 1: 0.21 and 0.22 (of 255); no halo over trunks or leaves on crops                                                      |
| Consumer game, GPU-waited frame time, toward the sun (2560×1440)         | shafts about 2.5 ms at scale 1, about 0.8 ms at 0.5                                                                                                           |
| Consumer game, GPU-waited, interleaved, pig-follow view, level 2         | fog with shafts about 1 ms of a 53–65 ms frame; grass about 8–10 ms, water about 4.6, shadows about 2.4, clouds about 0.9 (the biggest parts are not the fog) |

## Not verified

- Phones: the beams' cost there, the music's autoplay on iPhone Safari and
  WeChat.
