# Verification: water ripples from moving bodies

Base commit `3b63fee` plus uncommitted changes. macOS 27, Apple M4, headless
Chrome through the repository's `chromeFixture`, 2026-11-16.

- WebGL: `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.
- WebGPU: adapter `apple` / `metal-3`.
- Evidence, kept outside the repository: `EV` =
  `<workspace>/audits/water-ripples-2026-11-16/`.

| Command                                                                                                                                   | Result                                      | Artifact                            |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| `node --test tests/water-surface.test.mjs`                                                                                                | PASS, 7 (4 new)                             | —                                   |
| `node --test tests/film-scene.test.mjs`                                                                                                   | PASS, 25 (1 new: film `ripples` validation) | —                                   |
| `npm run build && node scripts/verify-film-water.mjs` (WebGL)                                                                             | PASS; see the numbers below                 | `EV/film-water-webgl/`              |
| `ZHUDA_FILM_RENDERER=webgpu node scripts/verify-film-water.mjs`                                                                           | PASS; see the numbers below                 | `EV/film-water-webgpu/`             |
| Frames without ripples against the engine before the change: `verify-film-water` run in a worktree of `3b63fee`, compared pixel for pixel | 14 of 14 identical                          | `EV/film-water-before-3b63fee/`     |
| `node scripts/measure-water-ripples.mjs` (WebGL) and `WATER_RIPPLES_RENDERER=webgpu node scripts/measure-water-ripples.mjs`               | see "GPU cost"                              | `EV/cost-webgl/`, `EV/cost-webgpu/` |
| `npm run verify`, `npm run lint`, `git diff --check`                                                                                      | see the bottom of this record               | —                                   |

## The ripple checks (new section 3b of `verify-film-water`)

The scene is calm water with refraction 0.8 over the sand, beside the lamp.
Each number is the mean change in summed RGB, per sample patch, against the
same frame without ripples.

|                                                   | WebGL | WebGPU |
| ------------------------------------------------- | ----- | ------ |
| Still body, 0.6–2.2 m round it                    | 8.02  | 8.03   |
| Still body, 8 m away                              | 0     | 0      |
| Moving body (1.5 m/s), on the wake arms behind it | 36.08 | 36.04  |
| Moving body, 2.5 m ahead of it                    | 4.27  | 4.58   |

An empty list gives the calm frame exactly. Pictures:
`ripple-calm.png`, `ripple-still.png` and `ripple-wake.png` in each folder.

## GPU cost

`tests/fixtures/water-ripples-cost.ts`:

- 1280×720, DPR 1, water over the whole view, waves 0.3, refraction 0.6.
- 7 interleaved rounds of 120 frames, after a warm-up round; the GPU is
  waited for before and after each round. The figures are medians, in ms per frame.

|        | none | one still body | four moving bodies |
| ------ | ---- | -------------- | ------------------ |
| WebGL  | 4.37 | 4.83 (+0.46)   | 5.75 (+1.38)       |
| WebGPU | 3.87 | 4.11 (+0.24)   | 5.27 (+1.40)       |

The spread between rounds is about ±0.5 ms, so one still body is within it.
Four moving bodies (one of them 1.2 m wide and moving at 2.2 m/s) add about
1.4 ms on both backends.

## Not verified

- Phones: no device was used. A phone GPU is several times slower than the
  M4, so four moving bodies over water filling the screen may cost several ms.
- In the consumer game: it still pins `414d07a` and does not call `setRipples` yet.
- Art: the amplitudes and froth were judged on the fixtures' pictures, not in a shot.

## Gates

- `npm run verify`: PASS, 842 of 842 tests (837 at `414d07a`).
- `npm run lint`: PASS.
- `npm run format:check`: PASS.
- `git diff --check`: PASS.
