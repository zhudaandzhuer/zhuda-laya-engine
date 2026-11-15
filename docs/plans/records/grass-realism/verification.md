# Verification: grass that does not look like a lawn of plastic

Base commit `0f65925` plus uncommitted changes. macOS (Apple M4), headless Chrome, 2026-11-16.

| Command                                                                                    | Result                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `node --test tests/grass.test.mjs`                                                         | pass, 10                                                                                                                |
| `node scripts/verify-grass.mjs`                                                            | PASS on WebGL (cover near 0.951, far 0.979, wind moves, road bare, nothing left behind)                                 |
| `GRASS_RENDERER=webgpu node scripts/verify-grass.mjs`                                      | PASS on WebGPU (same figures); the first run timed out waiting for the page, the second passed                          |
| Consumer game, four fixed views before and after                                           | pictures compared by eye: varied greens, straw, lighter/darker blades, narrow pointed blades                            |
| Consumer game `cost(3)` (60 frames walking, headless WebGPU, 1280×720), same game settings | this engine 62.5 / 69.7 / 67.7 ms; `0f65925` 53.8 / 60.4 / 66.0 ms: about a tenth more, within a noisy headless measure |

## Not verified

- Phones; real-GPU frame times. Whether the extra cost matters on a phone is
  unknown: the game's governor lowers the render scale first.
