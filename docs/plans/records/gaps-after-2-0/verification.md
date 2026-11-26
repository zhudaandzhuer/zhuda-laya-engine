# Verification: gaps-after-2-0

Run on 2026-11-26 in a cloud container: Linux, Node 24.22.3, no npm registry (dependencies linked
by hand, TypeScript and esbuild not the pinned versions), no graphics card, no phone.

| Check | Result |
| --- | --- |
| `node --test tests/clock-waits-tweens.test.mjs` | 6 pass: a wait on the scaled clock, the unscaled clock and a layer; a cancelled wait resolves false; a tween's steps, its last step of exactly 1, `finish`, `cancel`, a layer; a session with `fixedDeltaSec` gives the same five frames for an even run and for one with a 400 ms hitch; text against the host's own encoder and decoder, bad bytes included; the splash signal, its timeout |
| `node --test tests/walk-and-character.test.mjs` | 4 pass: a grid round a wall with a gap, a pillar, a pond and a kerb; a path through the gap within 8 % of the two straight legs, at most five points after smoothing, the same twice, none through a closed wall or up a cliff, one up a ramp; a capsule that stops a radius from a wall, slides along it, is not carried through a 10 cm wall at 90 m/s, goes round a pillar, climbs 0.3 m stairs and not a 0.5 m ledge, a 30 degree hill and not a 60 degree one, keeps to an island or walks off it, falls 2 m in 27 frames give or take 2, jumps v²/2g; a camera boom stopped by the same box |
| `node --test tests/minigame-toolchain.test.mjs` | 5 pass (one new): the settings' checks and their messages; `game.json` rewritten and nothing else; the bundler lowers optional chaining, nullish and `for await` at `es2017` and not above |
| `node --test tests/gltf-intake.test.mjs` | 19 pass: the shadow switch is exercised inside the model library's test |
| The engine's entry bundled by esbuild at `es2017` | builds (1,308,345 bytes minified against 1,260,611 at `es2020`); at `es2015` it fails on array rest patterns in `FilmScene.ts`, which is why `es2017` is the lowest offered |
| `npm run verify` | build, typecheck, declaration audit and Doctor pass; 1027 tests, 1025 pass. The 2 failures are this container's: "Browser bundler version differs from the exact package pin" (`browser-sdk.test.mjs`, `film-host-timeout.test.mjs`), as before this change |
| `npm run verify:games` | the nine reference games: all ok (build, typecheck, Doctor, tests) |
| `npm run verify:prefabs` | could not run as written: its `npm install` needs the registry (`ENOTFOUND`). With the two dependencies linked by hand: the library's typecheck passes and its 189 tests pass (`node --test tests/*.test.*`). The two viewers were not built |
| `git diff --check` | clean |

## Not verified

- Nothing here was run in a browser, on a graphics card or on a phone. The walk grid, the path
  finder and the character controller are used by no game yet.
- `whenZhudaSplashGone` against a built page: the page's script was changed and read, and the
  function was tested against a stand-in for the page, not against a page.
- `minigame.orientation` and `minigame.syntaxTarget` in a real export: the official LayaAir
  toolchain is not installed here, so `zhuda-laya-minigame` itself did not run. The pieces it
  calls were tested alone.
- `fixedDeltaSec` in a game: tested on a session with a stand-in driver.
- The pinned toolchain, lint and the format check: not available here (the owner's Mac runs them).

## On the owner's Mac (2026-11-26, `473ca3d9` and the correction after it)

Apple M4, macOS 27.2.1, Node 26.13.1, Chrome 158, the pinned toolchain and the official LayaAir
mini-game toolchain; done by the session on the Mac. Notes and files:
[`local-results/after-2.0.0/`](../../../../local-results/after-2.0.0/notes.md). No person, no phone.

| Check | Result |
| --- | --- |
| `npm ci`, `npm run verify`, `npm run lint`, `npm run verify:games`, `npm run verify:prefabs:go` at `473ca3d9` | pass: 1027 of 1027 (the two that fail in the container pass here), nine games, the library's 189, both viewers, Go |
| `npm run format:check` at `473ca3d9` | **failed**: twelve files of this round were not in Prettier's form. Formatted here (spacing and line breaks only); 1027 of 1027 after, generated declarations unchanged |
| The wardrobe on a graphics card | the dark points on the skirts' waistbands and the crop tee's chest are gone (18 pictures, no page error) |
| `whenZhudaSplashGone` on a built page (`prefabs/viewer2d`, real Chrome, three loads) | the node present and `gone` false at first; `completed` at about 2.20 s; the event at about 2.65 s, once, with the node already out; no page error |
| `minigame.orientation` in a real `wxgame` export | `game.json` says `landscape`; a wrong value and a signed target are refused as designed |
| `minigame.syntaxTarget` in a real export, as written at `473ca3d9` | **failed for `es2017`, `es2018` and `es2019`** with `MINIGAME_SOURCE_RACE`, twice each: the bundle was built at the lower target and then compared, character for character, with the gated `app.js`, which is `es2020` |
| The same after the correction | the four targets export; read back with a parser at each year, the newest syntax in the whole package (nine scripts, the LayaAir libraries included) is the target's; a game that keeps a BigInt literal is refused at `es2017` with `MINIGAME_SYNTAX` and exports at `es2020` |
| `npm run verify`, lint, `format:check`, `verify:games` after the correction | pass: 1028 of 1028 (one test added), nine games |

Still not verified: `fixedDeltaSec` in a game page; the walk grid, the path finder and the
character controller in a game; anything in a mini-game host or on a phone. Seen on the way: the
engine's `EffectBudget.ts` holds BigInt literals; a mini-game that uses `ZhudaEffectBudget` would
now be refused below `es2020` instead of exporting a script an ES2017 engine cannot read.

## After the Mac's findings (2026-11-26, the cloud session)

The BigInt literals the Mac saw in `packages/core/effects/EffectBudget.ts` are gone: the 64-bit
values are made with `BigInt(...)` inside `zhudaPassesBusyNs`, which is only reached where the
host has GPU timestamps. A test now lowers every source file under `packages/core` to `es2017`
(204 files) and fails on any the bundler warns about or refuses: run against the file as it was,
it fails with "Big integer literals are not available in the configured target environment". In the container: typecheck passes, the mini-game
and developer-tooling tests pass (21), `npm run verify` 1038 tests with the same two container
failures. Not re-exported through the official toolchain: that is the Mac's to repeat.
