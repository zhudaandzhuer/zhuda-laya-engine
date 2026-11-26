# Route: A Go authoritative server for a game (mathematics, wallet, JWT, API, replay, simulation)

The result of a round-based game (a slot, a reel game, a draw) is decided by the server: the client sends "how much to bet", and the server locks the player, takes the bet, runs the mathematics with its own random numbers, pays out, stores the whole round for replay, and returns the round's steps for the client to play back. A separate simulator measures the RTP of the mathematics. Go standard library only; checked on the local machine (macOS arm64) by unit tests, HTTP tests and one connection from a real client; never deployed.

- **Id:** `go-game-server`
- **Kind:** workflow
- **For:** building a Go authoritative server for a game: mathematics whose randomness can be replaced, a wallet seam, JWT identity, an HTTP API, replay, an RTP simulator, and a round format and tests shared with the client
- **Checked on:** local Go 1.26.5 (darwin/arm64), `httptest` and a real server on `127.0.0.1`; no deployment, no TLS, no operator wallet
- **Status:** on 2026-11-25 the server of an earlier cascade slot game in the workspace (removed after it was taken apart; its theme and art were not kept) was taken apart into shared packages (the same as the original server round for round, and the simulator report the same number for number), and the general steps were worked out against the server of the original Dungeon Spin game (removed after it was taken apart); the TS client ran 30 rounds in a row against the real server with the accounts agreeing
- **Reference consumer:** this repository: `zhuda-engine-prefabs/server/` (`slotmath`, `slotsim`, `slotgateway`, `wallet`, `authjwt`, `replay`, `cmd/slotserver`, `cmd/slotsim`); a second example was the server of the original Dungeon Spin game (fixed-round mathematics and a single-lock authority service; now that it is taken apart, see the dungeon packages of `zhuda-engine-prefabs/server`)
- **Engine version:** no engine is used (a server); the client side was checked on zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`

## When to take this route

- Fits: the result involves points or money, cheating must be prevented, rounds must be auditable by replay, and several clients (web page, mini game, app) must share one set of rules.
- Does not fit:
  - Purely single-player play with trial points: the client's `systems/slot-round` `LocalSession` (books first and plays afterwards, computes every round again on loading) is enough, see [cascade-slot](cascade-slot.md).
  - Real-time multiplayer and state synchronisation: this is "one request, one round", with no connection state.
- A slot-type game uses the packages of `zhuda-engine-prefabs/server` as they are; another game builds its own mathematics package to the structure below, and copies the way the wallet, the JWT, the replay and the API are written.

## Tools

- Go 1.26.5 (installed on the local machine), standard library only; `go vet ./...`, `go test ./...`, `gofmt`.
- The shared packages: `zhuda-engine-prefabs/server` (one Go module, `zhudagamecenter/commonprefabs/server`; `sync.mjs` does not copy it). In the game's `server/go.mod`:
  ```go
  require zhudagamecenter/commonprefabs/server v0.0.0
  replace zhudagamecenter/commonprefabs/server => <path to a checkout of zhuda-engine-prefabs>/server
  ```
- Checks: `cd prefabs && npm run verify:go`; simulation: `go run ./cmd/slotsim -n 1000000 -seed 1`; local server: `SLOT_JWT_SECRET=… SLOT_DEV=1 go run ./cmd/slotserver`; `curl`. Go commands run in `zhuda-engine-prefabs/server/`.
- Client: `RemoteSlotClient`, `RemoteSession` and `toResolvedRound()` of `2d/slot-client`.

## Steps

1. **Project structure.** In the game, `server/` (for a game of the workspace, ZhudaGameCenter `games/<game>/server/`, outside this repository): its own `go.mod`, `cmd/server/main.go` (the wiring), `cmd/simulator/main.go`, `internal/<game>math` (or the shared packages as they are). Both reference servers are divided this way: mathematics (pure functions), authority / wallet, gateway (HTTP), storage (replay).
2. **The mathematics is a pure function, "configuration + randomness + request → the whole round".** Randomness is injected through an interface (`slotmath.RNG`): in production `CryptoRNG` (crypto/rand); for simulation, tests and replay, `Mulberry32` with a seed that can be set. All money is in whole units; the order of the draws is fixed (do not let map iteration order affect the result or the output). Return every step of the round (the first board, every wave, every drop, the cap); the client only plays, it does not compute. Check: two runs with the same seed give the same JSON (`TestSpinIsReplayableAndConsistent`).
3. **Configuration apart from the program.** All of the game's numbers (board, pay tiers, reel strips, weights, free games, ante / buy prices, cap, labels) go in one `Config`, and `Validate()` stops a bad configuration first. If the client computes too (local trial), it uses the same numbers and the same algorithm (`2d/cascade-math`).
4. **The order for money: lock → take the bet → open the round → pay out → store the round → respond.** Both ways were checked:
   - A seamless wallet (`wallet`, when connecting an operator): every transaction has an id, and a resend returns the balance of that time without taking or adding twice; one "spinning" lock per player (429 when it is held); when opening the round fails, `Rollback(the bet's transaction id)` refunds the bet (only one recorded bet, and only once).
   - A single-lock authority service (dungeon-spin's `authority`, when the points are the game's own): inside one lock, "read the balance → compute the round → change the balance and the sequence number → store the round" is done in one go; when the balance is not enough the sequence number does not advance.
5. **Identity: JWT, never `?userId=`.** `authjwt.Sign/Verify` (HS256, `sub`, `op`, `cur`, `exp`), with the secret coming from an environment variable or a secret store. The guest path and the path that issues tokens are opened only in development (`slotgateway.Options{AllowGuest, IssueTokens}`; `cmd/slotserver` uses `SLOT_DEV=1`).
6. **HTTP API.** `GET /api/health`, `GET /api/user/balance`, `POST /api/spin`, `GET /api/replay?id=`. Every response is JSON (errors too), the GET paths refuse other methods, the request body is limited to 1 MiB (`http.MaxBytesReader`), CORS answers only origins on the allow-list, and by default it listens only on `127.0.0.1` (the default of dungeon-spin's `HOST`; `cmd/slotserver` does the same). Status codes: 401 identity, 402 not enough balance, 429 the same player is spinning, 400 the request or the bet amount, 500 the round failed (the bet was refunded).
7. **Replay.** Store the whole round (`replay.NewStore[T](limit)`) and read it back by the round id; the in-memory version must be given a limit. In production, put persistent storage in its place.
8. **Simulator and RTP.** `slotsim.Run`: RTP (base game / free games, 95% confidence interval), hit rate, volatility, the highest single round and multiplier, the cap, cascade depth, each symbol, the free-game trigger rate. At least 1 million rounds and three or more seeds; the report states the interval, not just one number.
9. **The contract with the client.** The type of the round JSON exists once on each side (Go `slotmath.Round`, TS `server-round.ts`); the client turns it into screen data with `toResolvedRound()`, and `RemoteSession` lets the same `GameRuntime` have its rounds opened by the server. If the client has the same engine too: a Go test writes the SHA-256 of a batch of rounds of the example configuration into `testdata/parity.json` (`SLOTMATH_UPDATE_PARITY=1`), and a node test reads it and compares the TS engine.
10. **Tests.** Mathematics: tier boundaries, award judging, drops, multipliers, the cap, determinism, Validate. Wallet: idempotency, nothing recorded when the balance is not enough, 50 goroutines at once, refund, lock. JWT: round trip, expiry, changed content, bad format. Gateway (`httptest`): health, bet → replay → balance consistent, no token, another secret, bet amount, bad JSON, CORS, 429 for the same player, and a failed round refunding the bet and releasing the lock. `Example()` has the README's example compiled and its output checked. Last, run a stretch with the real executable and a real client (see "Checks").
11. **Proving equivalence when an old server is taken apart.** Copy the original server in the workspace and replace only its source of randomness with the same generator, with a seed that can be set (in the earlier cascade slot game it was `pkg/crypto/rng.go`), and make the original tables into the new package's `Config`; because an `internal/` package cannot be imported from an outside module, the comparison program goes **inside the copy** (`cmd/equiv`, with `replace` in `go.mod` pointing to the shared packages), compares round by round, and at the end compares the next random number left on each side (to confirm that the same amount was used). The simulator report is compared number by number, line by line (leaving out the line with the elapsed time).

## Pitfalls

- **In the original server anyone could use someone else's wallet.** With no token it accepted `?userId=`, the JWT secret was written into `main.go`, CORS was always `*`, and it listened on every network interface. → Made into options that are off by default; development mode has to be stated explicitly.
- **The bet was taken and not refunded when the round failed.** In the original flow, if opening the round panicked after the bet was taken, the money was gone; a pay-out error was ignored. → `Rollback` after `recover`, and a failed pay-out answers 500.
- **The wallet's starting-balance parameter was not used** (`NewSeamlessWalletManager(initial)` always gave 100000); **`Rollback` could refund any amount**. → Corrected, with tests added.
- **crypto/rand makes results impossible to replay and a simulation impossible to reproduce.** → Inject the randomness; the simulator's `-seed`.
- **Go's map iteration order differs on every run** (the original list of multipliers was collected from a map, so the same round's output order changed). → Sort by position.
- **Step numbers repeated** (a win step used the wave number, the others their position). → Always the position; the wave number goes in a field of its own.
- **100,000 rounds do not measure RTP accurately.** For the original configuration the 95% interval at 100,000 rounds is about ±8 percentage points, and three seeds of 1 million rounds gave 89.34% to 96.14% (96.5% was claimed). → At least 1 million rounds, several seeds, and write the interval.
- **Ante charges more but the mathematics did not change** (the comment says there will be more scatter symbols). → The price and the probability must change together; measure with the simulator's `-ante`.
- **The cap comparison for free games is written in two ways**: a single spin uses ">", the whole run of free games uses "≥" (so in the original code; kept). To change it, change both sides (Go and TS) together and write parity again.
- **An `internal/` package cannot be imported by another module**, so the comparison program can only go into a copy of the original project.
- **dungeon-spin's mathematics multiplies a floating-point number by a ratio and then converts to an integer** (`int64(float64(x) * scale)`); an amount can be a little off because of the truncation. The shared slot mathematics is integers throughout: `bet × percentage / 100`, rounded down.

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| The server does not go through the engine; the engine has no contract for "round JSON and the client's presentation" | The contract is kept in the prefab library (`zhuda-engine-prefabs/`): Go `slotmath.Round` + TS `2d/slot-client/server-round.ts`, held together by the parity digest test |

## Checks

```bash
cd prefabs
npm run verify:go                                   # go vet + go test (six packages, parity, Example)
npm run verify                                      # node tests, the TS engine against parity and RemoteSession among them
cd server && go run ./cmd/slotsim -n 1000000 -seed 1
go build -o /tmp/slotserver ./cmd/slotserver && SLOT_JWT_SECRET=dev SLOT_DEV=1 PORT=18088 /tmp/slotserver &
curl -s http://127.0.0.1:18088/api/health
curl -s 'http://127.0.0.1:18088/api/auth/token?userId=p1'                                   # development mode only
curl -s -X POST -H "Authorization: Bearer <token>" -d '{"betAmount":10}' http://127.0.0.1:18088/api/spin
```

Results of 2026-11-25: the tests of all six packages pass; the same as the original server round for round (5,000 seeds × 5 kinds of request = 111,010 rounds; with the cap changed to 50×, another 60,785 rounds, 1,548 of them capped); the original simulator and the shared simulator at `-n 100000` with two seeds: the report's 41 lines and 104 numbers are the same; the TS client (`RemoteSession` + `GameRuntime` + the presentation player) ran 30 rounds in a row against `cmd/slotserver`, 3 buys among them: the client's balance = the server's balance = start − bets + wins, and every round's replay amount was the same.

## Not checked

- No deployment: TLS, a reverse proxy, rate limiting, logs, monitoring and persistence (the wallet and the replay are both in memory) were neither built nor tested.
- It has never been connected to an operator's wallet API; `wallet` is only an in-memory version of the same set of methods.
- No third-party certification of the RNG or the mathematics (GLI or the like); the original project's README said "compliant with GLI-19" with no evidence of any kind, and that was not carried over.
- Load: only the simulator's throughput was measured (about 350,000 rounds per second, on the local machine); HTTP concurrency was not measured.
- A client resending after a disconnection, and idempotency of the same request (at present the round id is used as the transaction id, so a resend opens a new round), are not handled.

## Boundaries

- The game: its own mathematics configuration and simulation report, the wiring of `cmd/server` and the deployment settings, the secrets, the integration with an operator.
- The prefab library (`zhuda-engine-prefabs/server`): the general packages (mathematics engine, simulator, gateway, wallet seam, JWT, replay) and their tests; the client's counterpart in `2d/slot-client`.
- The engine: not involved.
