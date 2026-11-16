# Verification: foliage wind, kept coverage and crown shade

Base commit `777f04c` plus uncommitted changes. macOS 27, Apple M4, headless
Chrome through the repository's `chromeFixture`, 2026-11-16. The machine was
heavily loaded by other work (load average 80–380).

Evidence, kept outside the repository: `EV` =
`/Users/yaowei/Documents/ZhudaGameCenter/audits/foliage-2026-11-16/`.

| Command                                                                                                                                                 | Result                                                                                                                                                                                                                                                                                       | Artifact                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `node --test tests/foliage.test.mjs`                                                                                                                    | PASS, 6                                                                                                                                                                                                                                                                                      | —                         |
| `npm run verify`                                                                                                                                        | 846 of 848; the two failures were timing under load. `tests/cli-entry.test.mjs` timed out spawning `zhuda-laya-build`; `tests/live-look.test.mjs` failed its "cheap enough for every frame". Both files rerun alone: PASS, 13 of 13, including every npm bin with the new `zhuda-laya-crown` | —                         |
| `npm run lint`, `npm run format:check`, `git diff --check`                                                                                              | PASS                                                                                                                                                                                                                                                                                         | —                         |
| `node scripts/verify-foliage.mjs` (WebGL, `canvas: webgl2`)                                                                                             | PASS                                                                                                                                                                                                                                                                                         | `EV/foliage-webgl/`       |
| `FOLIAGE_RENDERER=webgpu node scripts/verify-foliage.mjs` (`canvas: webgpu`)                                                                            | PASS                                                                                                                                                                                                                                                                                         | `EV/foliage-webgpu/`      |
| `verify-film-water` with these changes, compared pixel for pixel with the frames of `3b63fee` (glTF floor, placements, emission, vertex colours, water) | 14 of 14 identical                                                                                                                                                                                                                                                                           | `EV/film-water-unmarked/` |

## The foliage check

The fixture is cut-out leaf cards (a glTF with a masked picture, 28 % leaf,
LayaAir's glTF shader) on a floor in a low sun.

|                                                                  | WebGL | WebGPU |
| ---------------------------------------------------------------- | ----- | ------ |
| Marked card, leaf pixels changed between 0.4 s and 2.1 s of wind | 3513  | 3513   |
| Its shadow on the floor, pixels changed                          | 3487  | 3487   |
| Unmarked card beside it, leaf and shadow pixels changed          | 0     | 0      |
| Far card (85 m), share of its box that is leaf, coverage kept    | 0.532 | 0.532  |
| The same card without it                                         | 0.072 | 0.072  |

The two backends give the same numbers on this plain, hard-shadowed scene.

Kept coverage is fuller than the picture's own 28 %. Each mip level adds a
quarter of the alpha, so a far crown reads as a full mass instead of the sky
through holes. That is a choice, recorded here.

## In the consumer game (built against this checkout, not published)

- `games/zhuda-spacetime-3d`, high setting, two frames 0.9 s apart: 62,773 of
  921,600 pixels changed, on the crowns and branches. The trunk bases stay still.
- Pictures of the same views without and with the foliage and the crown shade:
  `EV/game-crown-cmp-far.png`, `EV/game-crown-cmp-across.png`.
- Found on the way: the game's check hook `view()` aimed the water's mirror at
  the player while the camera looked elsewhere, so held views showed a black
  river. That is a check artefact in the consumer, fixed there; play is not affected.

## Not verified

- Phones: the extra vertex work of the wind and the coverage arithmetic on
  every leaf pixel are not measured on a device.
- Motion vectors: TAA and motion blur see swaying leaves as still.
- Art direction: wind strength and direction are the game's (it uses 0.8,
  down the river).
