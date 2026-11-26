# Verification: audio-sample-clock

Checked on 2026-11-25 in a container with no npm registry: Node 24, TypeScript 5.9.3 in place of
the pinned 6.x, esbuild 0.28.2 in place of the pinned 0.27.1, no eslint.

| Check                                                             | Result                                                                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test tests/audio-*.test.mjs tests/offline-audio.test.mjs` | 36 run, 36 pass (one new: position from offset and context time, still while time stands, `null` before unlock / after stop / for another ID, loop wrap, latency from the context) |
| `tsc --noEmit -p .` (5.9.3)                                       | no errors                                                                                                                                                                          |
| `prettier --check` on the four touched files (3.8.1)              | clean                                                                                                                                                                              |

## Not checked

- `npm ci && npm run verify` with the pinned toolchain, eslint. `packages/types/IframeSoundAdapter.d.ts`
  was edited by hand; `npm run types:generate` run afterwards with TypeScript 5.9.3 reported
  0 files updated, so the hand edit is what the generator writes.
- A speaker. The test uses the suite's fake context; later, in the unified repository,
  `games/zhuda-beat` read the position 1,315 times over a song in headless Chromium's audio context
  and it stayed within 10.2 ms of the page clock (`games/zhuda-beat/docs/evidence/keys.log.json`). Whether `currentTime` really stands
  still on every host while suspended is the Web Audio contract, not something measured here.
- A sample backend (`prepareSampleBackend`) voice: the position is computed from the same context
  times, but no backend was run.
