package matchrelay_test

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	"zhudagamecenter/commonprefabs/server/matchrelay"
	"zhudagamecenter/commonprefabs/server/matchrelay/relayclient"
)

const testOrigin = "http://127.0.0.1:5173"

// startServer runs a real server on httptest with the production defaults.
func startServer(t *testing.T, edit func(*matchrelay.Config)) (*matchrelay.Server, string) {
	t.Helper()
	cfg := matchrelay.Config{
		Service:        "it",
		Stages:         []string{"livingroom", "backyard"},
		Chars:          []string{"zhuda", "zhuer"},
		AllowedOrigins: []string{"https://game.example.com", "http://127.0.0.1:*"},
		TickInterval:   50 * time.Millisecond,
		Logger:         slog.New(slog.DiscardHandler),
	}
	if edit != nil {
		edit(&cfg)
	}
	srv, err := matchrelay.New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.Handle("/g/ws", srv.Handler())
	mux.Handle("/g/healthz", srv.HealthHandler())
	hs := httptest.NewServer(mux)
	ctx, cancel := context.WithCancel(context.Background())
	go srv.Run(ctx)
	t.Cleanup(func() {
		cancel()
		srv.CloseAll()
		hs.Close()
	})
	return srv, "ws" + strings.TrimPrefix(hs.URL, "http") + "/g/ws"
}

func dial(t *testing.T, url string, o relayclient.Options) *relayclient.Client {
	t.Helper()
	o.URL = url
	if o.Origin == "" {
		o.Origin = testOrigin
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, _, err := relayclient.Dial(ctx, o)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Drop() })
	return c
}

func TestOriginRejectedOverHTTP(t *testing.T) {
	srv, url := startServer(t, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, origin := range []string{"https://evil.example", "http://game.example.com", ""} {
		_, resp, err := relayclient.Dial(ctx, relayclient.Options{URL: url, Origin: origin})
		if err == nil || resp == nil || resp.StatusCode != http.StatusForbidden {
			code := 0
			if resp != nil {
				code = resp.StatusCode
			}
			t.Fatalf("origin %q: err %v status %d, want 403", origin, err, code)
		}
	}
	c := dial(t, url, relayclient.Options{Origin: "https://game.example.com"})
	if err := c.Hello("p1", "n", "zhuda"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Expect(ctx, "welcome"); err != nil {
		t.Fatal(err)
	}
	if got := srv.Health().Totals.Rejected; got != 3 {
		t.Fatalf("rejected %d", got)
	}
}

func TestSizeLimitOverWebSocket(t *testing.T) {
	_, url := startServer(t, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c := dial(t, url, relayclient.Options{Header: http.Header{"Cf-Ipcountry": {"FR"}}})
	c.Hello("p1", "n", "zhuda")
	w, err := c.Expect(ctx, "welcome")
	if err != nil || w.Region != "EU" {
		t.Fatalf("welcome %+v %v", w, err)
	}
	// Exactly 1024 bytes is fine.
	ok := `{"t":"ping","c":1,"pad":"` + strings.Repeat("x", 1024-len(`{"t":"ping","c":1,"pad":""}`)) + `"}`
	if len(ok) != 1024 {
		t.Fatal(len(ok))
	}
	c.SendRaw([]byte(ok))
	if m, err := c.Recv(ctx); err != nil || m.T != "pong" {
		t.Fatalf("%+v %v", m, err)
	}
	c.SendRaw([]byte(ok[:len(ok)-2] + `x"}`)) // 1025 bytes
	select {
	case <-c.Done():
	case <-ctx.Done():
		t.Fatal("not closed")
	}
	if st := c.CloseStatus(); st != websocket.StatusMessageTooBig {
		t.Fatalf("close status %v, want 1009", st)
	}
}

func TestRateLimitOverWebSocket(t *testing.T) {
	_, url := startServer(t, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c := dial(t, url, relayclient.Options{})
	c.Hello("p1", "n", "zhuda")
	for range 120 {
		c.Send(map[string]any{"t": "ping", "c": 1})
	}
	var codes []string
	for {
		m, err := c.Recv(ctx)
		if err != nil {
			break
		}
		if m.T == "error" {
			codes = append(codes, m.Code)
		}
	}
	if !slices.Contains(codes, "rate_limited") || c.CloseStatus() != websocket.StatusPolicyViolation {
		t.Fatalf("errors %v close %v", codes, c.CloseStatus())
	}
}

// standIn is a trivial deterministic "simulation": both sides fold the same
// input pairs into the same state, so their hashes and winners agree.
type standIn struct {
	state uint32
	rng   *rand.Rand
	last  int
}

func (g *standIn) Input(int) byte { return byte(g.rng.IntN(64)) }
func (g *standIn) Step(f int, in [2]byte) {
	g.state = (g.state^uint32(f)*0x9e3779b1^uint32(in[0])<<8^uint32(in[1])<<16)*0x85ebca6b + 0xc2b2ae35
}
func (g *standIn) Hash() uint32 { return g.state }
func (g *standIn) Over(f int) (bool, int) {
	if f < g.last {
		return false, 0
	}
	return true, int(g.state%3) - 1
}

// TestIntegrationLockstep600Frames: two real WebSocket clients, each with a
// random 0–40 ms delay on every message in each direction (order kept),
// queue → match → ready → go → 600 frames of lockstep at 60 fps with a hash
// every 60 frames → end → result. Each side must receive exactly the other's
// inputs, in order.
func TestIntegrationLockstep600Frames(t *testing.T) {
	if testing.Short() {
		t.Skip("10 s real-time test")
	}
	srv, url := startServer(t, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	type out struct {
		res relayclient.Result
		err error
	}
	var clients [2]*relayclient.Client
	var matches [2]relayclient.Msg
	for i := range 2 {
		var mu sync.Mutex
		rng := rand.New(rand.NewPCG(uint64(i), 99))
		clients[i] = dial(t, url, relayclient.Options{
			Header: http.Header{"Cf-Ipcountry": {"TW"}},
			Latency: func() time.Duration {
				mu.Lock()
				defer mu.Unlock()
				return time.Duration(rng.IntN(40_000)) * time.Microsecond
			},
		})
		clients[i].Hello(fmt.Sprintf("player-%d", i), fmt.Sprintf("P%d", i), []string{"zhuda", "zhuer"}[i])
		if _, err := clients[i].Expect(ctx, "welcome"); err != nil {
			t.Fatal(err)
		}
		rtt, err := clients[i].MeasureRTT(ctx, 5, true)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("client %d warm-up RTT %v", i, rtt.Round(time.Millisecond))
		clients[i].Send(map[string]any{"t": "queue"})
	}
	for i := range 2 {
		m, err := clients[i].Expect(ctx, "match")
		if err != nil {
			t.Fatal(err)
		}
		matches[i] = m
	}
	if matches[0].Match != matches[1].Match || matches[0].Seed != matches[1].Seed || matches[0].Side == matches[1].Side {
		t.Fatalf("matches differ: %+v / %+v", matches[0], matches[1])
	}
	results := make(chan out, 2)
	for i := range 2 {
		go func() {
			g := &standIn{state: matches[i].Seed, rng: rand.New(rand.NewPCG(uint64(i)+10, 1)), last: 599}
			res, err := clients[i].Play(ctx, matches[i], g, relayclient.PlayOptions{FrameRate: 60, ReportRTT: true, Record: true})
			results <- out{res, err}
		}()
	}
	var rs [2]relayclient.Result
	for range 2 {
		o := <-results
		if o.err != nil {
			t.Fatal(o.err)
		}
		rs[o.res.Side] = o.res
	}
	for side, r := range rs {
		if r.Outcome != "result" || r.Frames != 600 || len(r.Errors) > 0 {
			t.Fatalf("side %d: %+v", side, r)
		}
		opp := rs[1-side]
		if !slices.Equal(r.Received, opp.Sent) {
			t.Fatalf("side %d received %d inputs, opponent sent %d; first difference at %d", side, len(r.Received), len(opp.Sent), firstDiff(r.Received, opp.Sent))
		}
		d := int64(r.Delay)
		if len(r.Sent) != 600 || r.Sent[0].F != d || r.Sent[599].F != 599+d {
			t.Fatalf("side %d sent frames %d..%d (%d)", side, r.Sent[0].F, r.Sent[len(r.Sent)-1].F, len(r.Sent))
		}
	}
	if rs[0].Winner != rs[1].Winner {
		t.Fatal("winners differ")
	}
	h := srv.Health()
	if h.Totals.Results != 1 || h.Totals.Desyncs != 0 || h.Totals.RateLimited != 0 || h.Totals.BadMessages != 0 {
		t.Fatalf("health %+v", h)
	}
	t.Logf("match %s stage %s delay %d: 600 frames each, inputs relayed %d+%d in order, frames that waited %d/%d (total wait %v/%v), elapsed %v/%v, client RTT %v/%v, winner %d",
		rs[0].Match, rs[0].Stage, rs[0].Delay, len(rs[0].Received), len(rs[1].Received), rs[0].Stalls, rs[1].Stalls,
		rs[0].Waited.Round(time.Millisecond), rs[1].Waited.Round(time.Millisecond),
		rs[0].Elapsed.Round(time.Millisecond), rs[1].Elapsed.Round(time.Millisecond), rs[0].RTT.Round(time.Millisecond), rs[1].RTT.Round(time.Millisecond), rs[0].Winner)
	b, _ := json.Marshal(h)
	t.Logf("healthz %s", b)
}

func firstDiff(a, b []relayclient.Input) int {
	for i := range min(len(a), len(b)) {
		if a[i] != b[i] {
			return i
		}
	}
	return min(len(a), len(b))
}

// TestIntegrationDesyncDetected: through a room, a client whose simulation
// diverges from the first frame is caught by the hash at frame 60.
func TestIntegrationDesyncDetected(t *testing.T) {
	_, url := startServer(t, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	var cs [2]*relayclient.Client
	var ms [2]relayclient.Msg
	for i := range 2 {
		cs[i] = dial(t, url, relayclient.Options{})
		cs[i].Hello(fmt.Sprintf("d%d", i), "n", "zhuda")
		cs[i].Expect(ctx, "welcome")
	}
	cs[0].Send(map[string]any{"t": "room_create"})
	room, err := cs[0].Expect(ctx, "room")
	if err != nil {
		t.Fatal(err)
	}
	cs[1].Send(map[string]any{"t": "room_join", "code": room.Code})
	for i := range 2 {
		if ms[i], err = cs[i].Expect(ctx, "match"); err != nil {
			t.Fatal(err)
		}
	}
	results := make(chan relayclient.Result, 2)
	for i := range 2 {
		go func() {
			g := &standIn{state: ms[i].Seed + uint32(i), rng: rand.New(rand.NewPCG(1, uint64(i))), last: 599}
			r, _ := cs[i].Play(ctx, ms[i], g, relayclient.PlayOptions{FrameRate: 60})
			results <- r
		}()
	}
	for range 2 {
		if r := <-results; r.Outcome != "desync" || r.DesyncAt != 60 {
			t.Fatalf("%+v", r)
		}
	}
}
