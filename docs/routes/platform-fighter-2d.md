# Route: A 2D one-on-one platform fighter, offline and online

A side-view fight between two characters on a stage of one-way platforms, landscape: against the computer,
two people on one keyboard, or online by quick match or room code. The match is a pure-data simulation in
integers, 60 ticks a second, one input byte a side; the computer opponent, the lockstep client, replays and
tests all drive the same `step`. Keys on a desktop, two thumbs on a phone. What follows is what the
reference game recorded in headless Chrome on one Mac; no real phone, and nothing was re-run for this page.

- **Id:** `platform-fighter-2d`
- **Kind:** workflow
- **For:** building a two-player real-time fighting game whose match is identical on two machines: an integer simulation, moves as frame data, a computer opponent, same-keyboard versus, and the client side of lockstep play through a relay with an optional peer link
- **Checked on:** desktop WebGL in headless Chrome on a Mac (1280×720); Chrome's phone emulation with touch (844×390 at DPR 3, 390×844 upright); no real phone, no Safari, no Firefox
- **Status:** recorded in the game's HANDOFF on 2026-11-25 and 2026-11-26: `npm run verify` green (61 Node tests, Doctor HEALTHY); whole matches in headless Chrome against the computer, through an in-page relay and through the Go relay (on the same Mac and on the owner's game server) with every 60-tick hash equal; nobody has played it on a phone
- **Reference consumer:** ZhudaGameCenter `games/zhuda-whirlwind-1` (outside this repository; the workspace is not under version control)
- **Engine version:** zhuda-laya-engine 1.18.0 (LayaAir 3.4.2), pinned at commit `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`. Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 61 of 61 before and after, Go tests ok, the rotate, zoom, swipe-up and controls checks and local relay and peer matches pass, 21 desktop screenshots pixel for pixel as at 1.18.0; the live server and site were not touched

Read [game-rules-first](game-rules-first.md) first. The server is
[online-lockstep-match](online-lockstep-match.md); the phone page is
[mobile-always-landscape](mobile-always-landscape.md) and [mobile-web-fullscreen](mobile-web-fullscreen.md);
none is repeated here.

## When to take this route

- Fits: two sides, real time, a small state and short matches that must come out the same on two machines
  (fighters, duels, versus mini-games), with a few ticks of input delay accepted.
- Does not fit: a result that carries money or rank (the server must decide:
  [go-game-server](go-game-server.md)); more than two players (the relay pairs two); play that must feel
  instant across continents (that needs rollback, which this game lacks); a realistic duel with baked
  in-between frames on one machine ([side-view-duel](side-view-duel.md),
  [pose-atlas-motion](pose-atlas-motion.md)); tile levels ([platformer-2d](platformer-2d.md)).
- Project, pin and 2D basics: [new-game-project](new-game-project.md) and [game-2d](game-2d.md).

## Tools

- zhuda-laya-engine 1.18.0 at the pinned commit (`zhuda-laya-build`, `zhuda-laya-doctor`); Node 24 or newer,
  whose `node --test tests/` runs the `.ts` rules directly; TypeScript 5.9.3; Go 1.26.5 for the relay only.
  No MCP tool was used.
- Headless Chrome through the engine's `packages/compiler/chrome-host.mjs` (`chromeFixture`) and CDP events
  for size, touch and keys; the Chrome version is not in the game's records.
- Prefab modules, copied with `node node_modules/zhuda-engine-prefabs/scripts/sync.mjs . <module…>` and
  never edited in the game: `zhuda-engine-prefabs/input/hold-input`, `zhuda-engine-prefabs/ui/virtual-stick`, `zhuda-engine-prefabs/ui/dom`,
  `zhuda-engine-prefabs/ui/game-menu`, `zhuda-engine-prefabs/ui/settings-form`, `zhuda-engine-prefabs/systems/storage`, `zhuda-engine-prefabs/2d/prefab-atlas`,
  `zhuda-engine-prefabs/ui/page-lock`; the Go package `zhuda-engine-prefabs/server/matchrelay` for the server.
- Python 3 with Pillow, NumPy, SciPy and fontTools for the asset tools (versions not recorded). Art: seven
  sheets from an image model the design notes name `gpt-image-2.6` (prompts in `design/prod-v1.json`); font:
  a subset of Noto Sans CJK TC Bold (SIL Open Font License). Both stay in the game.

## Steps

1. **Keep the rules where the engine cannot reach them.** `src/sim/` (rules) and `src/ai/` import nothing
   from the engine or the DOM; `src/net/`, `src/render/`, `src/ui/`, `src/game.ts` and `src/Main.ts` sit
   around them. Tests are `tests/*.mjs` importing `../src/sim/sim.ts`. Check: a test reads both folders and
   fails on `Math.random(`, `Date.now(`, `new Date`, `performance.now(`, `setTimeout(`, `document.`, an
   engine import, or `Math.sin|cos|sqrt|pow|exp|log(`.
2. **State is plain integers** (`src/sim/sim.ts`): `createMatch({ seed, chars, stage })`,
   `step(m, in0, in1, events?)` (one tick; the code and the protocol call it a frame, `f`), `cloneMatch(m)`.
   One pixel is 256 units, speeds are units per tick, times are ticks. A fractional design number becomes an
   integer once, when the table is built (`px(n) = Math.round(n * 256)`); division is `Math.trunc(a / b)`.
   The generator is one uint32 in the state (`m.rng`, `src/sim/rng.ts`). What a replay must draw the same
   (the 6-tick hit flash) is a state field; the rest leaves `step` as `SimEvent`s for picture, HUD and
   sound. Check: "same seed and input log give the same hash sequence" (6,000 ticks); "a copy continues
   identically" (clone and JSON round trip).
3. **Hash every number in a fixed order.** `stateWords(m)`: the match fields, each fighter by
   `FIGHTER_KEYS`, each projectile by `PROJ_KEYS`; `hash(m)` is FNV-1a over each word as four bytes, a
   uint32, taken after f steps for tick f. A state field left out of its key list is never compared.
4. **Make a tick blind to side order.** In `step`: hit stop; control (each side reads the other's
   start-of-tick snapshot); physics and platforms; push apart; projectiles; collect all hits from the same
   positions, then apply them; pulls; round flow. Check: "swapping sides mirrors the fight": 3 pairings × 3
   seeds × 4,000 ticks on a symmetric stage, sides swapped, inputs mirrored, all fields compared.
5. **One input byte a side** (`src/sim/input.ts`): bit0 left, bit1 right, bit2 jump, bit3 down, bit4 attack
   (held), bit5 dash. The simulation finds presses (`inp & ~f.prevIn`, `prevIn` in the state) and ignores
   input outside the fight phase. Keyboard, touch, computer, replay and network produce only this byte.
6. **Movement and one-way platforms** (`physics` in `sim.ts`, `src/sim/stages.ts`). A stage is a list of
   `{x0, x1, y, solid}`, the solid floor first. Px per tick, heavy / light: walk 3.4 / 4.3; dash 10 / 12 for
   16 / 14 ticks; air dash 9 / 10.5; jump 20.6 / 21.6; gravity 0.8 / 0.76; fall cap 17 / 16. Land only while
   falling, when the feet crossed a top this tick (`prevY <= p.y && y >= p.y`) within the platform's x range
   plus 8 px; the highest top crossed wins; a clamp keeps feet above the floor. Down + jump on a one-way
   platform moves 3 px down and ignores that platform for 14 ticks. Dash: the button, or one direction twice
   within 12 ticks; one air dash per airtime. Platform tops are measured: `tools/prepare-maps.py` refines
   hand-marked heights to the drawn edge, sinks the feet 3 to 8 px, writes `src/sim/stage-data.ts` and an
   overlay picture. Check: "every platform of both stages can be reached by both siblings".
7. **Moves are frame data** (`src/sim/chars.ts`): `MoveData { total, cancel, windows[] }`,
   `HitWindow { from, to, box, dmg, stun, kbx, kby, launch, stop }`; boxes relative to feet and facing,
   windows inclusive, one hit each (`hitMask`). A jab: total 22, active 7 to 9, cancel 12, damage 42.
   - Combo: a press from tick 2 of the first or second hit sets `buffer`, the next move starts at `cancel`,
     the third launches; a press during hit stop is kept. Air attack: once per airtime, a fixed dive until
     landing, then 10 / 8 ticks of lag. Dash attack: attack during a ground dash.
   - A hit that does not launch, on a grounded victim: hitstun for `stun` ticks. A launching hit, an
     airborne victim or a KO: launched; a launching hit ends 40 ticks down, 18 getting up, 36 unhittable; at
     most 3 juggle hits. A melee hit freezes both sides for `stop` ticks (5 to 12).
   - Tap or hold: attack held 16 ticks becomes a charge; skill tiers at 34, 64, 94 ticks of hold, capped by
     energy (three segments of 100) that is spent on release. A normal hit gives the attacker damage × 5/8
     and the victim damage / 2. A tier-3 skill cannot be hit for its first 20 ticks. Skills that leave the
     body are entries of `m.proj` (a boomerang that homes back, waves along one platform).
   - Rounds: best of three; 3,600 ticks; 120 of intro without input; at time up `hp × 1000 / maxHp` decides;
     a drawn round gives both a win and 2:2 is a draw (`winner -1`). Check: a test for each move and skill,
     written with `tests/helpers.mjs` (`fight()` places the fighters, `script([[ticks, byte], …])` presses).
8. **The computer opponent is one more input source** (`src/ai/cpu.ts`): `cpuInput(brain, match)` once a
   tick before `step`; it reads the match and its own generator (`createCpu(side, level, seed)`) and returns
   an input byte. Easy / normal / hard decide every 16 / 9 / 4 ticks, attack in range 45 / 70 / 88% of the
   time, continue a combo 25 / 70 / 95%, use a skill 25 / 55 / 80% (top tier 1 / 3 / 3) and jump a
   projectile 0 / 45 / 85%. Opponent above: walk under a platform within `jump² / (2 × gravity)` minus 24 px
   and jump; below: down + jump or walk off. Check: "a CPU against CPU match is deterministic". Recorded: in
   60 computer matches the heavy fighter at hard level won about 62% (HANDOFF, 2026-11-25).
9. **The loop and two players on one keyboard** (`src/Main.ts`, `src/game.ts`, `src/ui/input.ts`). Boot with
   `designSize` 1280×720, `scaleMode: 'full'`, `dprCap: 2` ([platform adapters](../platform-adapters.md));
   `context.runtime.start((dt) => game.update(Math.min(dt, 0.1), …))`. Offline: an accumulator with
   `STEP = 1/60`, at most 6 steps a drawn frame, `alpha = acc / STEP`; each step feeds its events to
   picture, HUD and sound and adds its two bytes to the replay log. Keys by `event.code`: A D W Space S J K
   for the first player; arrows, Numpad1 or comma, Numpad2 or period for the second; with one person both
   sets drive the first. A press is latched until the next sample, so one shorter than a tick is not lost.
10. **Draw from state, never into it** (`src/render/arena.ts`). A key pose per state (`poseOf`), flipped by
    facing. Effects are spawned from step events and aged once per tick, so a frozen or replayed tick looks
    the same. Between ticks only positions are interpolated by `alpha`, not across more than 200 px (a round
    reset). The camera is plain arithmetic (`src/render/camera.ts`): zoom up to 1.5, 118 design px free at
    the top, 150 at the bottom under thumbs. Pictures come from five prefabs through `ZhudaPrefabLibrary`
    and `mountAtlasPrefab` ([prefab workflow](../prefab-workflow.md)); HUD and menus are DOM.
11. **Touch and sound.** `TouchInput` (`src/ui/input.ts`): `createHoldInput` binds attack, jump and dash,
    one finger a control; `createVirtualStick({ reach: 54, size: 132 })` floats, left or right beyond ±0.32,
    down beyond 0.55; a tap is a combo hit, a hold charges, letting go fires. Sound (`src/audio.ts`): one
    `IframeSoundAdapter`, `unlockAudio` on the first gesture ([audio](../audio.md)), 18 samples baked by
    `renderZhudaSynthWav` ([procedural assets](../procedural-assets.md)). Check: `tools/check-controls.mjs`.
12. **Put the socket and the clock behind interfaces** (`src/net/transport.ts`): `Transport` (a WebSocket,
    or the in-memory relay of `src/net/loopback.ts`) and `Scheduler` (real timers, or `ManualScheduler`), so
    Node tests run whole online matches on a virtual clock with latency, jitter, drops and freezes.
13. **Lockstep** (`Lockstep.tick`, `src/net/lockstep.ts`). The input pressed at tick f is sent as
    `in {f + delay, b}`, one message a tick without gaps from `delay` on; earlier ticks use no input. When
    the opponent's byte for the current tick is missing the match does not step and nothing is guessed;
    local input is still produced on the clock for at most `slack` = 6 more ticks. After a step that reaches
    a multiple of 60, `hash {f, h}`; at the end `end {f, winner}`, once. The delay is the relay's:
    `clamp(ceil(RTT / 16.7 ms) + 1, 2, 10)`, 6 when unmeasured. In the game loop a refused tick keeps its
    time and at most 8 steps run a drawn frame. A pause online stops nothing: local input becomes 0.
14. **The session and what ends it** (`NetClient`, `src/net/client.ts`). `hello`; three pings before
    queueing, then one every 2 s carrying the measured round trip; quick match or room code; on `match`
    build the `Lockstep`, show the opponent for 1.6 s, send `ready`; start on `go`.
    - Desync: the relay compares hashes and sends `desync {f}`; the match stops and is void. `opp_left`:
      this side wins. Queue `timeout` (20 s at the relay) or no relay: offer the computer.
    - Lost socket: reconnect every 700 ms for 9 s: `hello`, `resume {match, key, f}` with f the first
      opponent tick not yet relayed; on `resumed {next}` resend own inputs from `next`, recent hashes, and
      `end` if the match ended meanwhile; nothing else goes out before `resumed`. Failing that, or on
      `error idle`: void.
    - The result screen waits for the relay's verdict. Relay sends are paced: 60 at once, 80 a second.
15. **The peer link and its fallback** (`src/net/direct.ts`, `src/net/webrtc.ts`). A WebRTC DataChannel
    (negotiated id 0, unordered, no retransmits, STUN only), signalled through the relay; side 0 offers;
    given up when not open 4 s after `match`. `ready` reports the median of five pongs, at most 4.5 s after
    `match`; `go.delay` replaces the delay (`retime`). Each packet repeats the last 8 inputs:
    `[1][last tick, u32 LE][n][n bytes]`. Every input still goes through the relay; the first copy to arrive
    is used; when two differ the relay's wins, the link closes and the next hash decides. The match never
    runs more than `leadCap` = 90 ticks past the relay. When the link dies mid-match every input is sent
    `ahead = match.delay − go.delay` ticks earlier. A setting (default on) and `?p2p=0` switch it off: the
    opponent's browser sees this player's address.
16. **URL switches and the hook** (`src/Main.ts`): `window.__SCENE__` has `ready`, `state()`, `set({…})`,
    `errors()`, `replay()`. `?bot=hard,normal&seed=&stage=&chars=&at=&freeze=1` (computers; jump to a tick
    and stop); `?showcase=<id>` (a scripted moment frozen on its tick, for stills); `?replay=<code>`;
    `?net=loopback` (an in-page relay with 40 ms and 25 ms jitter); `?online=queue|create&char=`, `?id=`,
    `?autoplay=hard` (online at once, the computer pressing this page's buttons); `?server=`, `?p2p=0`,
    `?rotate=0`, `?screen=`, `?touch=1|0`, `?debug=1` (hit boxes).
17. **Play whole matches in tests.** Node: 50 soak matches of random input and computers (over 100,000
    ticks: integers, bounds, an end); an online match over the in-memory relay, its inputs replayed offline
    to the same hash; the peer link killed at many ticks; pages frozen 1 to 9 s. Chrome: see Checks.

## Pitfalls

- **A reconnect storm left one page playing for ever** (2026-11-25, the costliest: 50 minutes in the
  HANDOFF). Seen: on a busy machine the relay cut a socket for `rate limited`, five `resume`s were each cut
  again within 0.2 s, and one page waited for ever. Cause: the resend after `resumed` was over 100 messages
  at once against a relay bucket of 90, and `error idle` was not handled. Fix: pace all sending, end the
  match on `error idle`, and give the in-memory relay the same rate limit, or no Node test can see it.
- **A test tool looked like a game bug** (45 minutes). A latency proxy that gave each TCP chunk its own
  timer now and then swapped two WebSocket frames; the relay refused the gap and voided the match 10 s
  later. Fix: one queue and one timer per direction. More of this kind is in `online-lockstep-match`.
- **Every tick waited: about 47 ticks a second instead of 60** (in-page relay, 40 ms + 25 ms jitter,
  2026-11-25). An input travels player, relay, opponent. Fix: `slack`, and a relay delay from the full round
  trip.
- **After the peer link died, every tick waited first:** the delay had been sized for the link. `slack`
  alone settles at "just in time"; `ahead` restores the relay's delay.
- **A hidden page stops its frame loop.** Under 10 s the match survives (7 s busy, frozen and minimised were
  run; Chrome closes a frozen page's WebSocket when it thaws, which the resume covers); past 10 s that side
  counts as gone.
- Smaller ones: a headless page has no gesture, so whole-match runs ask for sounds that never load (the
  touch check loads them); feet on the drawn outline look like hovering (sink them a few px); a camera
  showing the whole stage needs picture beyond the map (padded 320 px above, 170 below); the font is a
  subset, so new text needs `tools/subset-font.py` again or a test fails; the entry is bundled as a script,
  so no top-level `await`; a test loop killed from outside left two Chromes running for 49 minutes.
- Known, unfixed: after a resume the client resends hashes the relay has (it answers `bad_input`).

## Engine gaps and their workarounds

- No integer, per-tick action or input-buffer contract: `ZhudaActionStateMachine` and `ZhudaInputBuffer`
  ([combat runtime](../combat-runtime.md)) advance by seconds. The game did not try them inside a lockstep
  simulation; it keeps its own frame tables and a one-bit buffer in the state.
- No collision for one-way platforms (`ZhudaTerrain2D` knows blocked or not per cell): a platform list.
- No lockstep, relay client or peer link in the engine or the prefab library: `src/net/` is the game's.
- Closed in 2.0.0: the headless Chrome fixture is the package export
  `zhuda-laya-engine/compiler/chrome-host`. The game's tools still import the file by path.
- Doctor reports HEALTHY although the five prefabs have no `prefabChecks`.
- The canvas size of a turned container and the page lock: see the two mobile routes.
- None of the above has an engine plan item yet.

## Checks

All from the game folder; results are the last ones in its HANDOFF, in headless Chrome on the owner's Mac.

| Command | What it measured | Last recorded |
| --- | --- | --- |
| `npm run verify` | build, `tsc`, Doctor, `node --test tests/` | 2026-11-26: 61 tests pass, Doctor HEALTHY |
| `node tools/play.mjs tools/scenarios/<name>.json ""` (`VIEW=phone` for 844×390) | screenshots: screens, six skills on two stages, a fight, the phone layout | 2026-11-25: pictures and a contact sheet in `design/build-shots/` |
| `node tools/check-controls.mjs` | real touch and key events: two thumbs, charge, a third finger on pause, two players | 2026-11-25: 15 of 15 |
| `node tools/browser-matches.mjs` | two whole matches in real time in one page | 2026-11-25: computers 3,166 ticks in 52 s, no error; in-page relay 3,296 ticks in 58 s at delay 5, 53 hashes equal |
| `node tools/online-e2e.mjs` | two Chromes through the Go relay: a quick match, then a room code with a dropped socket | 2026-11-26, relay only, local: 4,688 ticks, 76 hashes equal; 3,413 ticks, one resume, 55 equal. Owner's game server with the peer link: 2,936 and 3,338 ticks, hashes equal, delay 2 |
| `node tools/p2p-e2e.mjs a,…,h` | the peer link behind a proxy adding 60 ms each way: on, off, killed, socket drop, busy 3 s and 7 s, frozen 7 s, minimised 7 s | 2026-11-26: eight matches of 2,365 to 5,694 ticks at 52.4 to 60 ticks a second on a loaded machine; delay 2 with the link, 9 or 10 without; no hash differed |

Also recorded on 2026-11-25, relay only through the owner's game server (see the game's `server/DEPLOY.md`):
a round trip of 270 to 340 ms gave delay 10 and 53 to 55 ticks a second, hashes equal. The game is published
on the owner's portals (see `PORTALS.md` in the workspace).

## Not checked

- Any real phone: touch feel, frame time, sound unlock, Safari, WeChat. No sound was heard by anyone. The
  Chrome version and whether a GPU drew are not in the records.
- The same hashes on another JavaScript engine or processor: every run was Chrome or Node on one Mac.
- The peer link across two networks: both Chromes were on one Mac and met by host candidates. No TURN.
- Rollback (the state is plain data with `cloneMatch`, so it can be added). Resume after a page reload.
  Keeping an online match ticking in a hidden page (`ZhudaWorkerFrameDriver` was not tried).
- Prefab checks: no `prefabChecks`, no baselines, no `zhuda-laya-accept` evidence.
- Balance and feel by people. Frame rate and draw count on a device. WebGPU. Engine 2.0.0.

## Boundaries

- The game: the rules and tables, stages, the computer opponent, art, screens, the protocol document, and
  for now `src/net/`, `src/ui/rotate.ts` and the test tools, which belong in the prefab library before a
  second game.
- The prefab library: the eight modules under Tools and `zhuda-engine-prefabs/server/matchrelay`.
- The engine: boot and sizing, the frame loop, the prefab library class, the audio adapter, the synthesiser,
  build, Doctor and the headless fixture. Nothing in the engine knows about a match.
