# Route: A pay-anywhere cascade slot (client and authoritative server)

A slot game in which eight or more of one symbol anywhere on the board pay and are removed, new symbols drop in from above and the board is judged again, multiplier orbs multiply the total win, and scatter symbols lead into free games. In the browser it is fully playable with the shared round state machine, the cascade mathematics, and a board and control bar drawn in code (local save, seeded rounds); when the same screen is connected to the Go authoritative server, the server opens the round, takes the bet and pays out, and the mathematics on the two sides is one algorithm: same seed, same result. Driven by the mouse (touch was not tested); checked only in desktop headless Chrome (WebGL) and against a local Go server, not on a phone.

- **Id:** `cascade-slot`
- **Kind:** scene
- **For:** building a slot with pay-anywhere awards, cascades, multipliers and free games (or a reel game of the same kind, where the board is refilled after symbols are removed), as a client and a Go authoritative server, with a theme of your own
- **Checked on:** desktop WebGL (Apple M4, headless Chrome, 1280×720, virtual clock); local Go 1.26.5 (darwin/arm64); no phone
- **Status:** taken on 2026-11-25 out of an earlier cascade slot game in the workspace (removed after it was taken apart; its theme and art were not kept): the mathematics is the same as the original game's round for round (Go 111,010 rounds; TS 86,000 rounds plus 40,000 sets of bonus rows), the simulator report is the same number for number, the TS engine and the Go engine give the same digest over 90 rounds, ten viewer screens were checked against the ledger, and the client ran 30 rounds in a row against the real server with the accounts agreeing
- **Reference consumer:** this repository: `zhuda-engine-prefabs/viewer2d/src/presets/cascade-slot.ts` (the whole client), `zhuda-engine-prefabs/2d/cascade-math`, `zhuda-engine-prefabs/2d/slot-client`, `zhuda-engine-prefabs/2d/slot-ui`, `zhuda-engine-prefabs/systems/slot-round`; `zhuda-engine-prefabs/server/cmd/slotserver` and `zhuda-engine-prefabs/server/cmd/slotsim` (the server and the simulator)
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`

## When to take this route

- Fits: a board of cells, awards judged by how many of one symbol there are (not by lines), winning cells removed and the board refilled by dropping, multipliers, free games, buy / ante; local trial points or an authoritative server.
- Does not fit:
  - Payline or ways awards, or a reel-stop presentation: the award judging and the drop are yours to write, but `systems/slot-round` (round state machine, ledger, auto play), `2d/slot-client`, and the control bar, dialogs, clock and sound bridge of `2d/slot-ui` are used as they are.
  - Only a server: read [go-game-server](go-game-server.md).
  - A game whose mathematics is still being designed: run your own `Config` through `server/slotsim` first, and build the screen once the numbers are settled.
- Read first: the routes [new-game-project](new-game-project.md) and [game-2d](game-2d.md) (project, size, time, input, prefabs, audio), and `zhuda-engine-prefabs/README.md`. This route covers only the slot layer.

## Tools

- `zhuda-engine-prefabs/scripts/sync.mjs`: from a checkout of this repository `node zhuda-engine-prefabs/scripts/sync.mjs <game dir> 2d/slot-ui 2d/cascade-math`, or from a game `node node_modules/zhuda-engine-prefabs/scripts/sync.mjs . 2d/slot-ui 2d/cascade-math` (`2d/slot-client` and `systems/slot-round` come along). `<game dir>` is the game's client project; for a game of the workspace that is ZhudaGameCenter `games/<game>/client` (outside this repository).
- `zhuda-engine-prefabs/viewer2d` (the viewer): `?scene=cascade-slot` (`&round=seed:168`, `&round=seed:22:buy`, `&turbo=1`, `&autoplay=10`, `&dialog=buy|auto|receipt`); `scenarios/cascade-slot*.json`.
- `zhuda-engine-prefabs/server`: `go run ./cmd/slotsim -n 1000000 -seed 1` (simulation), `SLOT_JWT_SECRET=… SLOT_DEV=1 go run ./cmd/slotserver` (local server). Go 1.26.5, standard library only. Go commands run in `zhuda-engine-prefabs/server/`.
- `zhuda-engine-prefabs/tools/detplay.mjs` (screenshots under a virtual clock; the fraction in its `Date.now()` was fixed on 2026-11-25), `zhuda-engine-prefabs/tools/pixdiff.py`.
- Engine: `ZhudaEngine.boot({ features: ['core', '2d', 'ui'] })`, `context.runtime.start(dt)`, `IframeSoundAdapter`.

## Steps

1. **Settle the mathematics first, one copy for both sides.** Write the game's numbers as one configuration: Go's `slotmath.Config` and TS's `CascadeConfig` have exactly the same fields (the JSON names), and the reel strips are laid out by `BuildStrip(counts, seed)` / `buildStrip` from "how many of each symbol", so both sides lay out the same strip. The template is `slotmath.ExampleConfig()` / `exampleConfig()` (neutral: 6×5, three tiers at 8 / 11 / 14, 12 free games from 4 gold rings, multipliers ×2–×100, capped at 5000×). Check: run `go run ./cmd/slotsim -n 1000000` with three or more seeds and read the RTP, the hit rate and the trigger rate; the example configuration measured 92.98% / 94.44% / 91.67%.
2. **The engines on the two sides agree.** After changing numbers or the algorithm on the Go side, `SLOTMATH_UPDATE_PARITY=1 go test ./slotmath -run Parity` rewrites `testdata/parity.json`, and `tests/cascade-math.test.mjs` computes the SHA-256 of the same 90 rounds with the TS engine; all must be the same (make one of these for your own configuration in the same way).
3. **Local trial: seeded rounds and a ledger.** `LocalSession({ resolve: createSeedResolver(cfg), saveKey, rules, bets })`; the key of every round is `seed:<n>` (`:buy`, `:ante`). The ledger stores only the key and the bet and, on loading, computes every round again to check the accounts, so `resolve` must give "same key, same round", which a seeded round does. `GameRuntime({ beforeRound: () => ({ fixture: seedKey(next++) }) })` gives every round, manual or automatic, a new seed.
4. **The screen: a state machine and a presentation player.** `GameRuntime<CascadeSnapshot>({ presentation: new CascadeStepPlayer({ board, celebration, hud, sound, wait: clock.wait }) , fsm: true })`. The player keeps the original game's order and pace: the drop 700 ms (turbo 90), each wave highlight → remove → refill, 240 ms between waves, a 360 ms pause before the multiplier and then "base × m = win" is played, a pause of 380 (60) ms on no win, coins 80 (45) ms, free games played spin by spin (280 / 50 ms between spins), and last the total win; an ordinary round plays the big-win screen only when the win is ≥ 10 times the bet (never in turbo). The big button's five states (spin / fast-forward / collect / stop / wait) are decided by `state.primary`, and `ControlBar.updateAction()` draws what it says.
5. **Time follows the game loop.** Every wait and tween uses `FrameClock`, `context.runtime.start((dt) => clock.update(Math.min(dt, 0.1)))` (dt is in seconds). Fast-forward = `clock.speed = 4` (`onAccelerate`). Do not schedule the presentation with `setTimeout` (the rule of [game-2d](game-2d.md); screenshots under the virtual clock depend on it too).
6. **Sound goes through the engine.** `new SlotSoundBridge(new IframeSoundAdapter({ voiceOverflow: 'fifo', maxActiveVoices: 24 }))`, and the first pointerdown calls `unlock()`; with recordings, `adapter.loadSample()` and then `markLoaded()`; without, the placeholder cues made of scheduled tones are used.
7. **Showing the balance.** The ledger books the round before the presentation, so `session.points` already holds this round's win before it is played: during the presentation show `last.pointsAfter − last.win`, and show `points` again after `operation.finished` (this is what the viewer does).
8. **Connect the server.** Build the server by [go-game-server](go-game-server.md) (or use `slotgateway` as it is). The client replaces `LocalSession` with `RemoteSession({ client: new RemoteSlotClient({ baseUrl, token }), cols, rows })` and nothing else changes; the chosen fixture `'buy'` / `'ante'` is the buy / the ante. The round JSON is converted with `toResolvedRound()`; `p.mainWin + b.total === totalWin`.
9. **Change the theme.** Symbols: your own `SymbolPainter` (or images, or Spine) passed to `CascadeBoard`; panels and text: options; finished art goes through [visual-content-prefab](visual-content-prefab.md). The mathematics, the ledger and the state machine are not touched.
10. **Screenshots and checking.** The viewer preset sets `window.__SCENE__` (`state()` gives the round count, the balance, the phase and a trace) and sets `ready` only once the LayaAir splash screen at the engine's start, about 5 seconds, has passed (the viewer uses `clock.time > 5.5`). When `detplay.mjs` takes screenshots, **read state() for every picture**: which round it is and whether the balance is right, not only the pixels.

## Pitfalls

- **The original game's local mode had no random rounds at all.** The client cycled through 14 fixed scripted rounds; randomness existed only in a pipeline that was never connected to the screen; and the server was yet another mathematics (the client: every bet ×9 lines, scores ÷10; the server: the single bet as the unit, and real cascades). → One algorithm in two languages (`CascadeEngine` = `slotmath`), held together by the digest test; scripted rounds are for show only (`fixture-pipeline.ts`).
- **The original game's free games were made up by the presentation layer.** The player improvised the boards of 15 spins from `b.total` to make the number come out, with no relation to the real mathematics. → The server round carries every spin (`freeSpins`), and the player plays the real ones spin by spin.
- **An engine that uses crypto/rand cannot be replayed or compared.** → Randomness is always injected (the `RNG` interface); for the comparison, only `pkg/crypto` in the copy of the original project was replaced, by the same generator with a seed that can be set.
- **Go's map iteration order differs every time.** The original server's `orbMultipliers` were collected from a map, so the same round came out in a different order twice. → Multipliers are sorted by cell and carry the cell's position (`orbs: [{cell, value}]`), so the screen knows which orb is which multiplier.
- **The original server's `stepIndex` repeated numbers** (a win step used "which wave", a drop step used its position). → Always the position; the wave number goes separately in `cascade`.
- **Ante charges 25% more but the mathematics did not change** (a comment in the original code says there will be more scatter symbols; the program did not do it). → The example likewise changes only the price and says so; to really raise the probability, ante needs another set of reel strips.
- **The state of the JS Mulberry32 grows into a floating-point number.** The original client's `a += 0x6d2b79f5` does not wrap round, and after about 4.9 million calls it differs from the 32-bit version. → Wrap with `>>> 0` (the first 4.9 million results are the same).
- **`executeSync` running async plug-ins** finishes synchronously only when every plug-in has done its work before it does `await next()`; a plug-in that awaits something else part-way "has returned but has not finished computing". The mathematics plug-ins are written to this rule.
- **Auto advance could only replay the same round.** The original state machine cannot `configure()` during auto. → The `beforeRound` option of `systems/slot-round`.
- **A big win's timer closed the next big win.** The previous one's "pause a moment, then close" arrived after the next had started. → `Celebration` gives every `play()` a serial number, and an old timer leaves the new one alone.
- **Half of the 95 items of the original game's gate were string searches or `assert(true)`** (the "10,000 chaos tests", for example, did nothing at all). → Only the checks that really run were carried over (mathematics, ledger, locale); the rest do not count.
- **The virtual clock's `Date.now()` has a fraction** (1000/60 ms per frame), and the ledger's `Number.isSafeInteger` rejects that round; both builds break in the same way, so the pixels still differ by 0. → Use the fixed `detplay.mjs` (whole milliseconds), and check `state()`.
- **After the original game was re-pinned to def94aa only two gate items differed**: `npm run build`, `typecheck`, `doctor` (HEALTHY) and the 3 unit tests all pass; the gate is 93 / 95, and the two failing items check whether the screenshot files in `evidence/` are there (the copy did not bring its evidence); with the original evidence attached it is 95 / 95. Headless Chrome (572×1024, virtual clock) starts, can open a round (multi, wins 13,000) and has no page errors; but 24 seconds later that round was still not marked "presented" (presumably the real-time WebM / audio never ends under the virtual clock; not investigated).

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| A 2D start shows a LayaAir splash screen for about 5 seconds | The ready signal (`__SCENE__.ready`), the screenshots and the automatic round start all wait until `FrameClock` has passed 5.5 seconds **After 2.0.0:** `await whenZhudaSplashGone()` or the page's `zhuda:splash-gone` event says when it is out of the page. |
| There are per-frame timers (`runtime.timers`), but no tweens and no "wait this long" Promise that follow the run-time clock | `2d/slot-ui/frame-clock.ts` (`wait`, `tween`, `speed`, `finishAll`), with `update(dt)` every frame **After 2.0.0:** `runtime.timers.wait(seconds)` and `runtime.timers.tween({ duration, update, ease })` follow the session's clock; `finishAll` and a speed of their own remain the module's. |
| No general slot-machine components (the engine should not have them) | They are all in the prefab library (`zhuda-engine-prefabs/`): this route's modules |

## Checks

```bash
cd prefabs
npm run verify                                  # types (against the engine: def94aa when checked) + node tests (cascade-math, slot-client, slot-ui, slot-round options and the save gate among them)
npm run verify:go                               # go vet, go test (the parity digest, the HTTP tests and Example among them)
cd server && go run ./cmd/slotsim -n 1000000 -seed 1   # put your own configuration in place of ExampleConfig
cd ../viewer2d && node ../scripts/sync.mjs . && npm run verify
node ../tools/detplay.mjs dist/web scenarios/cascade-slot.json "scene=cascade-slot" <output folder>
```

Results of 2026-11-25: the library's 109 node tests and all six Go packages pass; the viewer's verify passes in full (Doctor HEALTHY); three scenarios, ten pictures, `rendererErrors` and `pageErrors` empty, balance 100,000 → 100,194 (seed 168) / 100,805 (buy, seed 22) / 100,033 (auto, 10 rounds); the client (`RemoteSession` + `GameRuntime` + the player) ran 30 rounds in a row against `cmd/slotserver`, 3 buys among them: the client's balance = the server's balance = start − 2,670 + 458, and for every round the amount in the replay asked of the server was the same.

## Not checked

- Not on a phone, not played with fingers, no frame rate measured; only WebGL in desktop headless Chrome.
- The cue sounds were only confirmed to be sent into `IframeSoundAdapter` (`played`); no one has listened to them; there are no real recordings.
- The example configuration's RTP is measured, not tuned and not certified; any use with real money needs its own mathematics, its own simulation and testing by a third party.
- The client against the server ran only locally, on one machine, in development mode; cross-origin, disconnection, resending and several tabs at once were not tested.
- The original game's portrait 572×1024 layout was not rebuilt (the control bar is a landscape one, 1280 wide).
- After the original game was re-pinned to def94aa, the presentation running to its end, the big win, the free games, the WebM effects and the sound were not checked one by one (only seen: a round can be opened, the picture is normal, there are no errors).

## Boundaries

- The game: the theme, the symbol pictures, the text, its own `Config` numbers and simulation report, the layout, the release; the server's deployment (secrets, TLS, persistence, the operator's wallet).
- The prefab library (`zhuda-engine-prefabs/`): the round state machine and the ledger (`systems/slot-round`), the cascade mathematics and its example (`2d/cascade-math`, `server/slotmath`), the rest of the client (`2d/slot-client`), the screen drawn in code (`2d/slot-ui`), the server packages (`server/`), the viewer preset.
- The engine: 2D drawing, the run-time clock, the audio authority, the prefab flow. What taking a game apart shows the engine should add is written under "Engine gaps and their workarounds" above.
