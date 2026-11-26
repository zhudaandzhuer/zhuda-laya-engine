# Route: A game whose rules are tested before it is drawn

The shape all eight games under `games/zhuda-*` share, and what the genre routes beside this file
build on: rules as pure TypeScript with a seed, tests and a bot in Node, a thin view on the
engine, a report on `window` and a recorded run with real input. Take a genre route for what is
particular to a kind of game; this one for what is the same in all of them.

- **Id:** `game-rules-first`
- **Kind:** workflow
- **For:** starting any small game on the engine so that its rules can be tested without a browser and its page can be driven and recorded without a person
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** eight games built this way on 2026-11-25, each with `npm run verify` green and a recorded run; nobody has played any of them (draft)
- **Reference consumer:** this repository: `games/zhuda-jump` (the smallest) and `games/tools/shot.mjs`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

## When to take this route

Take it for any game whose rules can be stated without a screen: a board, a wave, a jump, a tap
against a time. It does not fit a piece that is mostly looked at (take `film-as-data` or
`good-looking-3d-scene`), and it adds nothing to a one-screen toy.

## Tools

- The engine through `zhuda-laya-init`; `zhuda.config.json` with `features` `core,2d,ui` (2D) or
  `core,3d,gltf,postProcess` (3D); `npm run verify` = build, `tsc`, doctor, `node --test test/*.test.ts`.
- Node 24 runs `.ts` tests directly (type stripping): no parameter properties, no enums.
- `games/tools/shot.mjs`: serves `dist/web`, opens it in headless Chromium, waits for
  `window.__GAME__.ready`, runs the project's script with real mouse, key or touch events,
  writes screenshots and `<name>.log.json`.

## Steps

1. **Rules in `src/core/`, no engine import that needs a browser.** State in plain objects, time in
   fixed steps or in seconds passed in, every random choice from one seeded generator kept in the
   state. Engine classes that are pure (`ZhudaActionStateMachine`, `ZhudaInputBuffer`,
   `ZhudaTerrain2D`, `renderZhudaSynth`) import and run in Node as they are.
2. **A move returns what happened** (events, or rounds of a cascade): the view plays that back and
   computes nothing itself.
3. **Tests state the rules as sentences**, and one test plays whole games with a bot. Write two
   bots where balance matters: one that plays well and one that plays carelessly; set numbers so
   the first wins and the second does not (or wins only the first level).
4. **A bot must not know what the rules have not shown yet.** If it searches by copying the state,
   change the copy's seed first (`games/zhuda-match`: without that, scores were twice as high).
5. **The view is one file** (`src/Main.ts`): boot, build the screen, map input to rule calls, draw.
   Steps of the rules run from `context.runtime.layers.sample('world').scaledDeltaTime`; the HUD and
   tweens from the `ui` layer's unscaled time. Pause is `layers.setPaused('world', true)`; a speed
   button multiplies the world delta before stepping (the games here do not use `setTimeScale`).
6. **`window.__GAME__`**: `ready`, `error`, `screen`, a small `state`, and `hot` — the client
   position of every control by name, so a script clicks where a person would.
7. **`?auto=1` runs the bot in the page**; `?seed=`, `?level=`, `?fresh=1` make runs repeatable.
8. **`tools/play.mjs`**: one run with real input that asserts something a player would notice
   (the key moved the pig; a refused swap cost no move), one run of the bot to the end.
   Keep the logs and a contact sheet in `docs/evidence/`.
9. **README with four fixed parts**: what was built, what was checked (with numbers), what was not,
   what the engine lacked. `AGENTS.md` with the few rules that are easy to break.

## Pitfalls

- `ZhudaEngine.boot` calls `onResize` before it returns: guard anything it touches that does not exist yet.
- Stamp input with the event's own time when timing matters, not the frame's.
- A recorded run that only screenshots proves nothing: assert on state.
- Effects `level-up`, `confetti` and `explosion` left a whole 2D scene unbatched in one game
  (3 → 60–90 draws, cause not found); `sparkle`, `hit-spark` and `landing-dust` did not.
- Looking along +Z in the engine's right-handed world, +X is on the screen's left. Project with
  `0.5 + sx * 0.5`, and write an `extrude` outline as `[x, z]`.

## Engine gaps and their workarounds

- No shared helper for "client position of a control" or for a design-size root: each game carries
  `src/ui/kit.ts` (about 160 lines). Copy it from `games/zhuda-match`.
- Doctor reports HEALTHY for a 2D game that ignores the `game-2d` route's prefab-first steps: these
  games draw from code and say so.
- No npm registry in the container these were built in: TypeScript 5.9.3 and esbuild 0.28.2 stood
  in for the pinned versions.

## Checks

- `npm run verify` green; both recorded runs end without `error` and with their assertions met.
- The careless bot loses where it should: a level every bot wins is not a level.

## Not checked

- Any person playing; any phone; any GPU; any sound heard.
- Frame rate: SwiftShader's numbers say nothing about a device.

## Boundaries

This route says how to keep a game checkable. It does not make a game good: feel, pacing, art and
sound were judged by nobody.
