# Route: a matchmaking and input-relay server for two-player online matches (lockstep)

Two players each run the same deterministic simulation in their own browser; a Go server
only matches them (quick match by continent, room codes) and relays every frame's input to
the opponent in order, then compares the state hashes and the end frame the two sides
report; the server does not run the game and does not decide who won. It is driven by
WebSocket messages. Checked on one machine (macOS arm64) with fake-clock unit tests, tests
over real WebSockets, Go bots playing each other and two headless Chromes running the
game's client; deployed on a Windows host behind a Cloudflare Tunnel on 2026-11-25
(protocol v1) and 2026-11-26 (v2, with a peer-to-peer direct connection), where two
headless Chromes on one Mac played whole matches through the public server. No real phone
was used, and the direct connection was never tried across two networks.

- **Id:** `online-lockstep-match`
- **Kind:** workflow
- **For:** The server of an online mode for a two-player real-time versus game: a shared protocol, Go matchmaking and input relay (matching by continent, room codes, input delay set from RTT, validation and in-order relay, hash and end comparison, a disconnect grace period, protections), fake-clock tests, a bot smoke run, and going live on a Windows host behind a Cloudflare Tunnel.
- **Checked on:** local Go 1.26.5 (darwin/arm64): `httptest`, and a real server on
  `127.0.0.1` with Go bots; live on a Windows host behind a Cloudflare Tunnel (v1, v2); two
  headless Chromes through the public server (including the direct connection); no real
  phone
- **Status:** Live on the owner's game server since 2026-11-25 (Zhuda Whirlwind 1,
  豬大旋風1). A peer-to-peer direct connection was added that evening (protocol v2,
  step 13): every scenario passed with two headless Chromes on one machine, and **v2 went
  live at 01:15 on 2026-11-26** (two Chromes played over the public network with the direct
  connection, input delay 2 frames, every hash equal; the success rate of the direct
  connection across networks is unknown). On 2026-11-25 it was made into the shared package
  `matchrelay` for ZhudaGameCenter `games/zhuda-whirlwind-1` (outside this repository). On
  2026-11-26 `zhuda-engine-prefabs/server/matchrelay` holds 56 tests (55 test functions and one example;
  45 before protocol v2), among them two real WebSocket clients playing 600 lockstep frames
  with a random 0–40 ms delay on every message; `relayclient` has no test files of its own
  and is driven by those integration tests. `go vet ./...` and `go test ./...` in
  `zhuda-engine-prefabs/server` were run in this repository on 2026-11-26: every package ok (`-race`
  passed on 2026-11-25, in the workspace). On 2026-11-25 a local server with two bots ran
  quick match, room plus rematch, a deliberate desync and the queue timeout.
- **Reference consumer:** `zhuda-engine-prefabs/server/matchrelay` (with `relayclient/`) in this
  repository; the workspace's `games/zhuda-whirlwind-1/server` (`cmd/server`,
  `cmd/botclient`, `internal/standin`, `DEPLOY.md`); the protocol is `design/PROTOCOL.md` in
  the same game.
- **Engine version:** No engine (a server). The browser client it was run with, Zhuda
  Whirlwind 1, pins zhuda-laya-engine `def94aa`; client and server were run together on one
  machine on 2026-11-25 and through the public server on 2026-11-25 and 2026-11-26 (see
  Checks).

## When to take this route

- Fits: a two-player real-time versus game (fighting, sparring, versus mini-games) where
  both sides can run the same **deterministic** simulation (a fixed frame rate, integers,
  seeded random numbers only), each frame's input is tiny (1 byte), the players may be
  anywhere in the world, and there are no accounts.
- Does not fit:
  - The result involves points, money or a ranking, and the server must have the final say:
    take [go-game-server](go-game-server.md). Here the server only compares; when the two
    sides disagree the match is void.
  - The simulation is not deterministic (floating point, `Math.random`, reading the time):
    it will desync. Change the simulation to integers and seeded random numbers first.
  - Three or more players: the package supports 2 only.
  - It must feel responsive across continents too: lockstep stops and waits when an input
    has not arrived; rollback is not done here. WebRTC peer-to-peer exists (step 13,
    optional), but there is no TURN, so two people whose NATs cannot be traversed go through
    the server as before.

## Tools

- Go 1.26.5; `go vet`, `go test`, `go test -race`, `gofmt`.
- `github.com/coder/websocket` v1.8.15 (2026-06-15, ISC): the **only** external dependency
  of the `zhuda-engine-prefabs/server` module (the standard library has no WebSocket server). Why this
  one: it has no dependencies of its own, a per-message size limit can be set (a larger
  message closes the connection with 1009), it has an API that sends a ping and waits for
  the pong, and it allows concurrent writes; the documentation of
  `golang.org/x/net/websocket` itself recommends a more actively maintained package. The
  reasons are recorded in `zhuda-engine-prefabs/server/README.md`.
- The shared packages `zhuda-engine-prefabs/server/matchrelay` (the server) and `matchrelay/relayclient`
  (a Go client and the lockstep loop). The Go module path is
  `zhudagamecenter/commonprefabs/server`, and it stays that. The game's `server/go.mod`
  requires it and reaches it with a `replace` directive. Until the game is moved to engine
  2.0.0 that directive still points at the workspace's old library folder; after the move
  its target is `zhuda-engine-prefabs/server` in a checkout of this repository, or
  `node_modules/zhuda-engine-prefabs/server` inside the game (the npm package carries
  `zhuda-engine-prefabs/server`).
- The bot: `server/cmd/botclient` in the workspace's `games/zhuda-whirlwind-1`; the Windows
  cross-compile is `build-windows.sh` (`GOOS=windows GOARCH=amd64 CGO_ENABLED=0`).
- Going live used the owner's `zhuda-windows` agent skill (not in this repository): its
  remote PowerShell command and its file-push command, the scheduled task, the Tunnel
  ingress and `windows_public_site.py prepare`. The steps are in the game's
  `server/DEPLOY.md`; they were carried out on 2026-11-25 at 20:31 (v1), and the executable
  was replaced with the v2 build on 2026-11-26 at 01:15 (step 12).

## Steps

1. **Write the protocol first, as the contract between the two sides.** One document that
   spells out: the messages (`hello`, `queue`, `room_create`/`room_join`, `ready`→`go`,
   `in {f,b}`, `hash {f,h}`, `end {f,winner}`, `rematch`, `ping`/`pong`, `opp_left`,
   `desync`, `result`, `error`); the fixed conventions of the simulation (60 frames per
   second, the input bits, the keys of frame f are stamped `f+delay`, the first `delay`
   frames count as nothing pressed, **when an input has not arrived, stop at that frame and
   wait; never guess**, random numbers from `seed` only); the matching rules; the
   protections. A version number `v`; when it changes, both sides change together.
   Reference: `design/PROTOCOL.md` in the workspace's `games/zhuda-whirlwind-1`.
2. **The server is the shared package plus wiring.**
   `matchrelay.New(Config{Service, Stages, Chars, AllowedOrigins})`; mount `Handler()` at
   `<prefix>/ws` and `HealthHandler()` at `<prefix>/healthz`; `go srv.Run(ctx)` runs the
   timers; listen on `127.0.0.1` only. The game's `cmd/server` has nothing but flags
   (`-addr`, `-prefix`, `-origins` to append, `-stages`, `-chars`, `-log-file`,
   `-version`). Check: `cmd/server/main_test.go` requests healthz, gets 403 for a bad
   Origin, and two good Origins can `hello`.
3. **Matching.** `CF-IPCountry` → continent (a table of about 250 countries,
   `ContinentOf`). The queue is worked from whoever has waited longest: first pair with
   the longest-waiting player of the same continent; once **the longer-waiting of the
   two** has waited a full 10 seconds, pair with any continent; the same player `id` is
   never paired with itself (two tabs of one browser); at 20 seconds send `timeout` (the
   game switches to playing the computer); send `queued {waited}` every second. Room
   codes: 4 characters from an alphabet of 32 (without I O 0 1), drawn with crypto/rand;
   `error room_expired` when nobody comes within 5 minutes, `room_full` when it is full,
   `bad_room` when joining your own room. Check: `lobby_test.go` (no pairing at 9.75
   seconds, pairing at 10.00 seconds; `queued` 0..19, 20 messages in all; no timeout at
   19.999 seconds, timeout at 20 seconds).
4. **Input delay.** `delay = clamp(ceil(larger RTT ÷ 16.7 ms) + 1, 2, 10)`, computed in
   integer microseconds (`InputDelay`; boundaries 16.7 ms→2, 16.701→3, 150.3→10); when no
   RTT was measured the delay is `Config.DefaultDelay`, which is 6 unless the game sets it
   (the reference game does not). **Use the whole RTT**: an input travels two legs,
   "player → server → opponent", which is about one round trip; on 2026-11-25 it first used
   RTT÷2, and the client measured that every frame was waiting for the opponent: a 60 fps
   match ran at only about 47 fps (the client also added a buffer that sends up to 6 frames
   early, `Lockstep.slack`). The client's `ping {c}` carries only its own time, so the
   server cannot work out an RTT from it; the server therefore sends its own WebSocket ping
   every 2 seconds (a browser answers with a pong by itself), and adds the `rtt` the
   client reports about itself in `ping` (an extension; accepted when it is above 0 and at
   most 10000 ms). What the code does (`delayLocked` in `match.go`, `rtt` in `server.go`):
   a player's RTT is the larger of two medians, each over the last 5 samples, one of the
   server's pings and one of the client's reports; the formula takes the larger of the two
   players' RTTs. When neither player has a sample the delay is `DefaultDelay` (6); when
   only one has, it is the formula's value but never below `DefaultDelay` (6).
5. **Relay and validation.** `in` is accepted only after `go`; `f` must run frame by frame
   without a gap starting at `delay`, and `b` must be an integer 0–63, otherwise the answer
   is `error bad_input` and the input is **not relayed** (the client may send the same
   frame again with a correct value); a side may not lead its opponent by more than 120
   frames; a match over 15 minutes is void. Relaying is putting the message into the send
   queue of the opponent's connection, handled under one lock, so the order is guaranteed.
   An `in`/`hash`/`end` that arrives after the match ended or was dissolved is dropped
   silently. Check: `TestRelayKeepsOrder`, `TestRelayRejectsBadInputs`,
   `TestRelayLeadBound`, `TestLateFrameMessagesAfterOppLeftAreIgnored`.
6. **Hashes and the end; the server does not judge who won.** Every 60 frames both sides
   send `hash` (it must be consecutive, and the input of that frame must already have been
   sent; a negative number from JS `h|0` is converted to the same uint32 before comparing);
   different → `desync {f}` to both sides. `result` only when the `f` and the `winner` of
   both sides' `end` are the same; when they differ, or the opponent has not sent within 10
   seconds → `desync`. A new match starts only when both sides send `rematch` (a new seed,
   a new stage, sides drawn again).
7. **Disconnects and leaving.** A disconnect during a match is held for 10 seconds; after
   that the opponent receives `opp_left`; `cancel` during a match gives `opp_left` at once.
   "No input for 10 seconds counts as leaving" **counts only the side that could send and
   does not**: the timer runs only while `next[me] < next[opponent] + delay`; a side stuck
   waiting for its opponent is not counted, and the count starts again from the moment it
   is unstuck. Otherwise, when the opponent disconnects, the waiting side would be judged
   to have left too. When both sides are not `ready` 30 seconds after `match`, the one that
   is not ready counts as having left. The extension `resume`: `match` carries a `key`
   issued by the server; after reconnecting within 10 seconds of the disconnect,
   `resume {match,key,f}` is answered with `resumed {next,started}` and the opponent's
   inputs from `f` on are sent again (each side keeps the last 1024 frames).
8. **Protections.** The Origin allow-list is checked before the upgrade and the comparison
   includes the scheme (`http://127.0.0.1:*` for any port); not on the list: 403; no Origin
   sent: 403 as well. One message is at most 1 KiB (`SetReadLimit`); a token bucket of 90
   messages per second, and over it the server answers `rate_limited` and closes with 1008;
   closed after 60 seconds without any message, and after 10 seconds without `hello`; 2000
   connections in total, 16 per IP (`CF-Connecting-IP`, kept in memory only); a send queue
   of 256 messages per connection, and a full queue means the peer reads too slowly and is
   closed; 1000 rooms. The log records only the connection number, the continent, the match
   id, the result, the close reason and the first 5 error codes of each connection; it does
   not record the IP, the country, the player id, the nickname or the room code. Nicknames:
   16 characters, with control characters and direction-override characters removed.
9. **Timers that can be tested.** Every timer is in `Server.Tick()` and time comes from
   `Config.Clock`. The unit tests use a fake clock and open no socket: they call `receive`
   directly and read the replies from each connection's send queue (`helpers_test.go`), so
   a boundary can be tested to the millisecond.
10. **An integration test over real WebSockets.** Two `relayclient` clients on `httptest`;
    every message gets a random 0–40 ms delay in each direction but is **never reordered**
    (like TCP); first a few pings to self-report the RTT, then queue → match → ready → go →
    600 frames at 60 fps (a hash every 60 frames) → end → result, checking that the inputs
    each side received are, one by one and in the same order, the ones the other side sent.
    Check: `TestIntegrationLockstep600Frames`.
11. **Bot smoke run.** `go run ./cmd/server` plus two `go run ./cmd/botclient` (quick
    match); `-mode create`/`-mode join -code`, `-games 2` (rematch), `-desync-at 100`, and
    one bot alone waiting for the 20-second timeout. The stand-in simulation
    `internal/standin` lets two bots compute the same hash; to make a bot the opponent of a
    real client use `-hash=false -frames 0` (the match ends in `desync` because the
    simulations differ; that is expected).
12. **Going live (done on 2026-11-25 at 20:31 for v1, with the owner's consent).** The
    steps of `DEPLOY.md`, as they were carried out: cross-compile on the Mac → push with the
    skill's file-push command → a trial run with two bots on a neighbouring port → a
    scheduled task (an ordinary user account, at boot, plus a watchdog loop) → add to the
    Tunnel ingress the host name of the owner's game server with `^/games/zhuda-whirlwind/`
    → `127.0.0.1:8796` (placed ahead of an existing rule on that host name) → `prepare` →
    restart the Tunnel (the whole site drops for a moment, about 1.9 seconds that day; ask
    the owner first) → verify at the public URL → `VERSIONING.md`. Two things were learned
    while doing it; they are the second and third pitfalls below. **Replacing the version
    (done on 2026-11-26 at 01:15 for v2):** only the executable is replaced and the
    scheduled task restarted; the Tunnel is not touched. The server goes first and the
    front end after it: a v2 front end is refused by a v1 server (`error version`), while a
    v2 server serves v1 and v2 clients. Before the replacement the public healthz showed 0
    matches and 0 queued, the v1 executable was kept as a backup, and two v2 bots played
    300 frames that agreed on a trial port on the Windows host. To go back, the front end
    must go back to v1 before the server does. The host name, the task name, the tunnel and
    the build stamps are in the game's `server/DEPLOY.md` and `HANDOFF.md` in the
    workspace, not here.
13. **Peer-to-peer direct connection (optional; Zhuda Whirlwind 1 protocol v2,
    2026-11-25).** The server is only a **signalling relay**: when two players who sent
    `hello {v:2, p2p:true}` are put in the same match, `match.p2p`; `rtc {match, d}` (`d`
    is an object) is relayed only to the opponent of the same match, from `match` until the
    end, at most 6 KiB per message (other messages stay at 1 KiB) and at most 40 messages
    per side per match (`rtc_limit`); with `ready.p2p {ok, rtt}`, when both sides are ok
    `go.delay = min(match.delay, InputDelay(larger direct RTT))`, otherwise it is unchanged;
    from `go` on, inputs are validated with the final delay. The client: STUN only
    (Cloudflare, Google), side 0 makes the offer, trickle ICE, a DataChannel `inputs`
    (`negotiated id 0`, `ordered:false`, `maxRetransmits:0`), give up when it is not open
    within 4 seconds, `ready` at the latest 4.5 seconds after `match`; each binary packet
    carries the last 8 frames of input (so a lost packet does not matter) plus ping/pong;
    **every input still goes through the server as before**, each of the opponent's frames
    uses whichever copy arrives first, and when the two copies differ the server's stands
    (a frame not yet simulated is replaced; for one already simulated the direct connection
    is closed and the next hash decides `desync`). The two safeguards that must be added
    are under Pitfalls. The player setting "Peer-to-peer connection (faster; the opponent
    will see your IP)" (「點對點連線」 in the game) is on by default and `?p2p=0` forces it
    off; a side that has it off creates no RTCPeerConnection. v1 clients work as before
    (`Config.Version 2`, `MinVersion 1`). Check: `p2p_test.go`, `p2p_integration_test.go`,
    the game's `tests/p2p.test.mjs` and `tools/p2p-e2e.mjs`.

## Pitfalls

- **From Taiwan, Cloudflare went by way of the United States (measured when going live,
  2026-11-25).** The Mac was in Taiwan (`loc=TW`), `cdn-cgi/trace` showed the node `SJC`
  (San Jose), and the server is on a Windows host in Taiwan → a round trip of 268–337 ms,
  `delay` capped at 10 frames, and two real browsers through the public server ran at only
  53–55 frames per second (every hash still agreed). → Before going live run
  `curl https://<domain>/cdn-cgi/trace` and read `colo`; for low latency inside one region,
  do WebRTC peer-to-peer or rollback.
- **The game site's Tunnel may have two cloudflared processes at once.** On 2026-11-25 one
  of them was an orphan whose parent process was gone; both had read the old configuration,
  so restarting only one leaves half of the requests not knowing the new route. → Stop the
  scheduled task, end **every** cloudflared that uses that configuration file (match the
  path of the configuration file on the command line; do not touch the SSH control channel
  or other Tunnels), start the scheduled task at once and wait for `/ready`: the measured
  interruption was about 1.9 seconds.
- **PowerShell 5.1 treats a child process's stderr as an error.** Running a program that
  writes its progress to stderr (the bot) directly inside the skill's remote PowerShell
  command aborts the whole script, and the background processes are taken down with it. →
  Use `Start-Process … -RedirectStandardOutput a.json -RedirectStandardError a.err -PassThru`
  and then `WaitForExit`.
- **One identity is never matched with itself.** In a local test two windows used the same
  `?id=`: quick match waited until the timeout, and a room code answered `bad_room` ("this
  is your own room"). → Use different `?id=` values in tests; the client must turn "your
  own room" into words a player understands.
- **The protocol's `ping {c}` cannot give the RTT the server needs.** It carries only the
  client's time; the server has no round trip of its own. → The server sends its own
  WebSocket ping; the client reports its own `rtt` (an extension).
- **The server's WebSocket ping measures only the network part.** The integration test adds
  its 0–40 ms delay inside the client program, so the RTT the server measured was almost 0
  and `delay` was set to 2: 600 frames took 11.4 seconds (10.0 seconds would be ideal) and
  about 480 frames had to wait for an input; after a few pings that self-report `rtt`,
  `delay` became 3 and the run took 10.13 seconds. Whether the Cloudflare leg passes a ping
  on unchanged in production is not known yet either, so the self-reported `rtt` stays.
- **"No input for 10 seconds means left", done to the letter, makes both sides lose as soon
  as the opponent disconnects.** The waiting side receives no input and cannot send its own
  next frame either (lockstep is stuck), so after 10 seconds it is judged to have left as
  well. → Count only "could send and did not"; the time spent stuck is not counted, and the
  timer starts again when the side is unstuck.
- **After the opponent left, an `in`/`hash` still on its way was answered with
  `bad_state`.** In the smoke run healthz showed `badMessages` 1; the cause was that one
  bot closed its connection first, the match was dissolved, and only then did an input the
  other bot had just sent arrive. → An `in`/`hash`/`end` with no match is dropped silently;
  a test was added.
- **Order-preserving delay injection pushes the delay towards its upper limit.** Each
  message's delay is `max(when the previous one is due, now + random)`; with one message
  every 16.7 ms the real delay is mostly near 40 ms rather than the 20 ms average. With
  `delay 3` there were still 340–400 frames that "waited", but most of them got their input
  within the same frame's 16.7 ms, and the 600 frames took only 0.13 seconds longer. → The
  total elapsed time is a truer measure than the number of frames that waited.
- **Sending too many messages in the same instant in a test hits the rate limit**: the fake
  clock does not move, so the token bucket does not refill. → The tests' `inputs()` moves
  the fake clock on by 12 ms per message.
- **A test that does not read the replies is closed as "reading too slowly"**: it keeps
  sending pings without reading the pongs, the send queue (256) fills, and what the server
  closes is a slow reader, not a rate-limit offender. → Tests read while they send.
- **`SetReadLimit(1024)` of `coder/websocket`**: exactly 1024 bytes is accepted, 1025 is
  closed with 1009 (`TestSizeLimitOverWebSocket`).
- **An old server still holds the port during the smoke run**: `pkill -f "<path>/wsrv"` does
  not kill a process that was started as `./wsrv`; the new server exits at once with
  `bind: address already in use`, and the bots are in fact connected to the old version. →
  Read the new server's start-up log first, or run `lsof -iTCP:<port>`.
- **Two tabs of one browser cannot test a match**: the anonymous `id` is stored in
  localStorage and is the same in both tabs, so by the rules they are not matched (a room
  answers `bad_room` too). → Use a private window, another browser, or a bot as the
  opponent.
- **(Direct connection) The direct connection outruns the server and the server refuses the
  inputs.** When the WebSocket is down (one's own or the opponent's) but the direct
  connection still works, both sides go on simulating over the direct connection, and the
  inputs a side sends through the server soon lead the opponent by more than 120 frames →
  `bad_input`, not relayed → from then on every frame is "a gap in the numbering" and the
  whole match is broken. → The simulation runs at most to "the opponent's last frame
  delivered by the server + 90 frames" (`Lockstep.leadCap`); `resume.f` must be "the first
  frame the server has not delivered yet", not the one received over the direct connection,
  otherwise the server's resend skips those frames and the relay path never joins up again.
- **(Direct connection) The direct connection finishes the match during a disconnect and
  the `end` goes missing.** An `end` sent while the WebSocket was down is lost, and the
  server judges `desync` 10 seconds later. → After `resumed`, send `end` again as well (the
  server ignores it when it has already received one).
- **(Direct connection) When the direct connection drops in mid-match, a delay that is too
  small makes every frame wait.** `go.delay` was set from the direct connection (2–3
  frames); with only the relay left, inputs do not arrive in time. Relying only on the
  slack of "send one more frame while waiting", the input lead settles at "just in time":
  in the local e2e, after the direct connection was cut, every frame waited a little first
  (about once per frame; still 59.9 frames per second, but with no margin). → When the
  direct connection closes, every input from then on is sent a fixed
  `match.delay − go.delay` frames further ahead (`Lockstep.ahead`), which is the input delay
  of a relay-only match; after the change it waited 7 times at the switch and 0 times after
  it.
- **(Direct connection) On one machine you cannot see whether the delay switched.** The
  local relay's RTT is under 1 ms, so `match.delay` is 2 already. → The e2e puts an
  order-preserving delay proxy in front of the server (60 ms in each direction → a relay
  RTT of about 123 ms, `match.delay 9`), and only then does the direct connection's
  `go.delay 2` show.
- **(Direct connection) Two headless Chromes on the same Mac always connect.** They use
  host candidates (mDNS names): that proves the mechanism of the signalling, the
  DataChannel, the merging and the delay switch; it does not prove NAT traversal. Without
  TURN, symmetric NATs and some mobile networks will never connect (after 4 seconds the
  match goes through the server as before).
- **(Direct connection) Resending too much after a reconnect gets `rate_limited` and turns
  into a reconnect storm.** The direct connection keeps running while the WebSocket is down
  (up to 90 frames); after the reconnect the inputs and hashes to resend come to more than
  100 messages, and the server's token bucket holds 90 → disconnected with `rate_limited`
  → reconnect, resend, disconnected again (the e2e log shows 5 `resume`s in one match, each
  cut off within 0.2 seconds; under high load one side even hangs). Also, when the machine
  is very busy or the network stalls, messages reach the server in one burst and hit 90
  too. → The client rate-limits every message it sends to the server (60 at once, 80 per
  second, queued in order); the server's token bucket capacity is set separately
  (`MaxBurstMessages`; the game uses 240) while the sustained rate stays 90; the loopback
  test server is rate-limited in the same way, so that tests can catch it; when the server
  answers `error idle` the client must end the match, or it stays at "waiting for the
  opponent" for ever.
- **(Test tool) A home-made delay proxy can swap the order of WebSocket messages.** The
  delay proxy the e2e puts in front of the server at first gave every TCP segment its own
  `setTimeout(due − Date.now())`; Node's timers use a cached loop clock, and two segments
  scheduled in the same turn are now and then reversed (4 times in 6000 segments in a
  stress run), which happened to swap two WebSocket messages → the server received frame
  169 before 168, refused it as a gap by the rules, then refused every frame after it → 10
  seconds later it judged that side `idle` and the whole match was void. It looked like
  "the reconnect failed after a 3-second freeze", but the freeze had not even happened
  yet. → The delay proxy has one first-in-first-out queue and one timer per direction,
  releases only in order, and checks for reordering itself (`latencyProxy` in
  `tools/p2p-e2e.mjs`). A real WebSocket is one TCP stream and is not reordered.
- **Local port 8796 may be an old server.** On the evening of 2026-11-25 a v1
  `go run ./cmd/server` left from earlier was still holding 8796; the e2e used it as it
  was and tested the old version. → Read `v` in healthz first; `tools/p2p-e2e.mjs` changes
  the port with `RELAY_PORT` and stops when the server is not v2.

## Engine gaps and their workarounds

None. (The server does not go through the engine; the client's lockstep loop is the
game's own code, and this route did not look for engine gaps in it.)

## Checks

```sh
# in this repository (npm run verify:go in zhuda-engine-prefabs/ runs the same go vet and go test)
cd zhuda-engine-prefabs/server && go vet ./... && go test ./...             # matchrelay: 56 tests on 2026-11-26; the 600-frame integration test takes about 11 s
go test -race -count=1 ./matchrelay/...
# in the workspace, outside this repository
cd <workspace>/games/zhuda-whirlwind-1/server && go vet ./... && go test ./...
go run ./cmd/server -log text &
curl -s http://127.0.0.1:8796/games/zhuda-whirlwind/healthz
go run ./cmd/botclient -name A & go run ./cmd/botclient -name B -inputs script; wait
./build-windows.sh && file dist/*.exe                          # PE32+ x86-64
# the game's client against the server: two headless Chromes, relay only by default
cd .. && node tools/online-e2e.mjs
# direct connection (v2): the game's node tests and two headless Chromes
# (a 60 ms delay proxy in front of the server; RELAY_PORT changes the port)
node --test tests/p2p.test.mjs && node tools/p2p-e2e.mjs a,b,c,d
# the same client through the public server, with the direct connection
E2E_SERVER=<origin of the public server> E2E_P2P=1 E2E_BASE=<URL of the public release> node tools/online-e2e.mjs
```

Results in this repository, 2026-11-26:

- `go vet ./...` and `go test ./...` in `zhuda-engine-prefabs/server`: every package that has tests is
  ok. `matchrelay` lists 55 test functions and one `Example` (`go test -list`);
  `relayclient` has no test files and is driven by `integration_test.go` and
  `p2p_integration_test.go`. `-race` was not part of that run.

Results of 2026-11-25, in the workspace (the browser and public-server figures are from the
game's `HANDOFF.md`):

- All 45 tests of `matchrelay` as it was before protocol v2 (including the `Example`) pass,
  and all pass under `-race`; all 5 tests of the game's module pass; `npm run verify:go`
  passes. Late that evening, with protocol v2 and the rate-limit fix, `matchrelay` had 56
  tests, and `npm run verify:go` and `-race` passed.
- The 600-frame integration test: the two clients' warm-up RTTs were 42 and 60 ms →
  `delay 3`; 600 frames on each side, and the 600 + 600 inputs received are, one by one and
  in the same order, the ones the other side sent; about 10.1 seconds (10 seconds at
  60 fps); on the server 0 errors, 0 rate limits, 1 `result`.
- A local server with bots: quick match, 600 frames, `result` (on both sides `inputsSent` =
  the other's `inputsReceived` = 600, `framesWaited` 0, 10.0 seconds); a room (a code typed
  in lower case joins too) plus a rematch, `result` for both matches, the continents AS/EU
  correct; `-desync-at 100` → `desync` at frame 120 on both sides, exit code 3; one bot
  alone timed out after 20.2 seconds, exit code 2; a bot without hashes as the opponent →
  `desync` 10 seconds after the other side's `end`. The log holds no IP, id or nickname.
- The game's client against a local server (`tools/online-e2e.mjs`: two headless Chromes,
  each with its own `?id=`, playing by `?autoplay=`): a quick match of 4443 frames in 77
  seconds, 72 hashes all equal, the same winner on both sides; a room-code match of 3169
  frames in 56 seconds, 50 hashes all equal, in which B's socket was cut in mid-match and
  `resume` carried the match to its end. Server counters: 2 matches, 2 results, 0 desyncs,
  1 resumed.
- Through the public server, v1, after going live at 20:31 (the Mac → Cloudflare → the
  Windows host, two headless Chromes): a quick match of 3,206 frames and a room-code match
  of 7,999 frames with a resume; 51 + 131 hashes all equal, 0 desync. The round trip was
  268–337 ms (the first pitfall), so `delay` was capped at 10 and the game ran at about
  53–55 frames per second.

Results of 2026-11-26, in the workspace (from the game's `HANDOFF.md`):

- The direct-connection scenarios a to h of `tools/p2p-e2e.mjs` (00:00–00:45; two headless
  Chromes, a local v2 server behind the 60 ms delay proxy): every hash equal in every
  scenario, and on the server 0 `rate_limited`, 0 `desync`, 0 `opp_left`; with the direct
  connection on, `go.delay` 2 against `match.delay` 9; the delay proxy passed 78,190
  segments with none out of order.
- Through the public server, v2, after the replacement at 01:15: the public healthz
  reports `"v":2`; the public e2e command above (two headless Chromes on one Mac, opening
  the public page) played a quick match of 2,759 frames and a room-code match of 3,223
  frames with one resume, both over the direct connection: `delay` 2 (through the server
  with v1 it had been 10), 44 + 51 hashes all equal, 0 desync, 0 opponent left, 0 rate
  limits.
- The same public run after two later front-end releases (the server unchanged): at 02:10,
  2,936 + 3,338 frames with a resume, every hash equal, `delay` 2; at 02:31, 3,288 + 2,523
  frames with a resume, every hash equal.

## Not checked

- No real phone in any recorded check, and WebRTC was not tried on a phone, in Safari or
  in Firefox (desktop headless Chrome only). The recorded matches were played by
  `?autoplay=`, not by a person. A player's report of 2026-11-26 says the connection was
  good on a phone; nothing was measured.
- The success rate of the direct connection across networks: the two Chromes were on the
  same Mac and connected by host candidates, which proves the mechanism and not NAT
  traversal, and there is no TURN. The figures from production (healthz `totals.direct` ÷
  `totals.matches`, the `p2p` field of the `go` lines in the log) have not been read yet.
- In production, whether `CF-IPCountry` and `CF-Connecting-IP` reach the server (so:
  matching by continent and the per-IP limit on the live server), and whether Cloudflare
  passes a WebSocket ping on unchanged. The deployment plan checks the first with two bots
  through the public server (`region` should read `AS`); the workspace records hold no
  result of that run, and the record kept on the Windows host was not read for this route.
  The game's `server/README.md` still lists the second as unverified.
- That the scheduled task starts the server at boot and that the watchdog loop restarts it
  after it exits: both were set up as `DEPLOY.md` describes; no test of either is recorded.
- Two players on different continents, and real latency between continents (the 268–337 ms
  measured was Taiwan to Taiwan by way of San Jose).
- No load test (at most 2 real connections at once); how the single global lock behaves
  with many connections is unknown.
- Protection against cheating goes only as far as "the two sides must agree": there are no
  accounts and no ranking; a modified client can press anything, but cannot change the
  result the other side computes.
- Open and not fixed (recorded on 2026-11-26): after a resume the client sends again hashes
  the server already has; the server answers `bad_input` ("next hash is for frame …") and
  skips them, the match goes on, and `badMessages` in healthz grows. The fix noted there:
  after a resume send only the hashes newer than the frame in the server's reply.

## Boundaries

- The game: the protocol document (frame rate, input bits, stage names, character names),
  the wiring and defaults of `cmd/server` (port, path, Origin, stages, characters), the bot
  and its stand-in simulation, `DEPLOY.md`, the scheduled task and the routing in
  production.
- The prefab library (`zhuda-engine-prefabs/server`): `matchrelay` (matching, rooms, delay, relay and
  validation, hash and end comparison, disconnects, protections, healthz), `relayclient`
  (the Go client and the lockstep loop), their tests, the one external dependency.
- The engine: not involved.
