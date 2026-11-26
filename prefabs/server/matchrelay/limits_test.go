package matchrelay

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestRateLimitClosesTheConnection(t *testing.T) {
	h := newHarness(t, nil)
	a := h.hello("AS", "a") // hello used one token
	for range 89 {
		a.send(`{"t":"ping","c":1}`)
	}
	if _, k := a.killed(); k {
		t.Fatal("closed within the limit")
	}
	a.all()
	a.send(`{"t":"ping","c":1}`) // 91st message in the same instant
	a.expectError("rate_limited")
	k, ok := a.killed()
	if !ok || k.code != websocket.StatusPolicyViolation {
		t.Fatalf("kill %v %v", k, ok)
	}
	if hl := h.s.Health(); hl.Online != 0 || hl.Totals.RateLimited != 1 {
		t.Fatalf("health %+v", hl)
	}

	// 60 inputs + a ping per second, sustained, stays under the limit.
	b := h.hello("AS", "b")
	for range 10 * 61 {
		h.clk.Advance(time.Second / 61)
		b.send(`{"t":"ping","c":1}`)
		b.all() // read the pongs, or b would be a slow reader
	}
	if _, k := b.killed(); k {
		t.Fatal("61 messages per second were rate limited")
	}
}

func TestIdleAndHelloTimeouts(t *testing.T) {
	h := newHarness(t, nil)
	a := h.hello("EU", "a")
	silent := h.conn("EU") // never says hello
	h.tick(9 * time.Second)
	if _, k := silent.killed(); k {
		t.Fatal("closed before HelloTimeout")
	}
	h.tick(time.Second)
	if k, ok := silent.killed(); !ok || k.reason != "no hello" {
		t.Fatalf("no-hello connection: %v %v", k, ok)
	}
	h.tick(49 * time.Second) // 59 s since a's last message
	if _, k := a.killed(); k {
		t.Fatal("closed before IdleTimeout")
	}
	h.tick(time.Second)
	if k, ok := a.killed(); !ok || k.reason != "idle" {
		t.Fatalf("idle connection: %v %v", k, ok)
	}
}

func TestHelloValidation(t *testing.T) {
	h := newHarness(t, nil)
	for _, c := range []struct{ hello, code string }{
		{`{"t":"hello","v":2,"id":"x","name":"n","char":"zhuda"}`, "version"},
		{`{"t":"hello","id":"x","name":"n","char":"zhuda"}`, "version"},
		{`{"t":"hello","v":1,"id":"","name":"n","char":"zhuda"}`, "bad_message"},
		{`{"t":"hello","v":1,"id":"` + strings.Repeat("x", 41) + `","name":"n","char":"zhuda"}`, "bad_message"},
		{`{"t":"hello","v":1,"id":"a b","name":"n","char":"zhuda"}`, "bad_message"},
		{`{"t":"hello","v":1,"id":"x","name":"n","char":"dragon"}`, "bad_message"},
		{`{"t":"queue"}`, "bad_message"}, // hello first
		{`not json`, "bad_message"},
	} {
		x := h.conn("AS")
		x.send("%s", c.hello)
		x.expectError(c.code)
		if c.hello != `not json` {
			if _, ok := x.killed(); !ok {
				t.Errorf("%s: connection not closed", c.hello)
			}
		}
	}
	// Names: at most 16 characters, control and bidi characters removed, empty → default.
	x := h.conn("AS")
	x.send(`{"t":"hello","v":1,"id":"n1","name":"  豬大‮\u0007的超級無敵長長長長長長長長名字喔  ","char":"zhuer"}`)
	x.expect("welcome")
	y := h.conn("AS")
	y.send(`{"t":"hello","v":1,"id":"n2","name":"​","char":"zhuda"}`)
	y.expect("welcome")
	_, m := h.pair(x, y)
	names := []string{m[0]["you"].(map[string]any)["name"].(string), m[0]["opp"].(map[string]any)["name"].(string)}
	want := map[string]bool{"豬大的超級無敵長長長長長長長長名": true, "Player": true}
	for _, n := range names {
		if !want[n] {
			t.Errorf("name %q", n)
		}
	}
	// Unknown message types are answered, not fatal.
	x.send(`{"t":"dance"}`)
	x.expectError("bad_message")
	x.send(`{"t":"hello","v":1,"id":"n1","char":"zhuda"}`)
	x.expectError("bad_state")
}

func TestPingPong(t *testing.T) {
	h := newHarness(t, nil)
	a := h.conn("SA")
	a.send(`{"t":"ping","c":12345.678}`) // allowed before hello
	got := a.all()
	if len(got) != 1 || got[0]["t"] != "pong" || got[0]["c"] != 12345.678 || got[0].int("s") != h.clk.Now().UnixMilli() {
		t.Fatalf("pong %v", got)
	}
	a.send(`{"t":"ping","c":"<script>"}`)
	if got := a.all(); got[0]["c"] != 0.0 {
		t.Fatalf("non-numeric c echoed: %v", got)
	}
}

func TestConnectionLimits(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.MaxConnections = 3; c.MaxConnsPerIP = 2 })
	if _, err := h.s.open("1.1.1.1", "AS"); err != nil {
		t.Fatal(err)
	}
	if _, err := h.s.open("1.1.1.1", "AS"); err != nil {
		t.Fatal(err)
	}
	if _, err := h.s.open("1.1.1.1", "AS"); err == nil {
		t.Fatal("third connection from one IP accepted")
	}
	c, err := h.s.open("2.2.2.2", "AS")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := h.s.open("3.3.3.3", "AS"); err == nil {
		t.Fatal("connection over MaxConnections accepted")
	}
	h.s.peerClosed(c, "bye")
	if _, err := h.s.open("3.3.3.3", "AS"); err != nil {
		t.Fatal("slot not freed")
	}
}

func TestSlowReaderIsDropped(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.SendBuffer = 8 })
	p, delay, _ := h.playing()
	p[0].inputs(delay, delay+9) // side 1 never reads its queue
	if _, ok := p[1].killed(); !ok {
		t.Fatal("slow reader not closed")
	}
	h.tick(10 * time.Second)
	p[0].all()
	if h.s.Health().Matches != 0 {
		t.Fatal("match kept after slow reader's grace")
	}
}

func TestOriginAllowed(t *testing.T) {
	pats := []string{"https://game.qianlongxundao.com", "http://127.0.0.1:*", "http://localhost:*"}
	for origin, want := range map[string]bool{
		"https://game.qianlongxundao.com":       true,
		"HTTPS://GAME.QIANLONGXUNDAO.COM":       true,
		"http://game.qianlongxundao.com":        false, // scheme matters
		"https://game.qianlongxundao.com:8443":  false,
		"https://game.qianlongxundao.com.evil":  false,
		"https://evil.com":                      false,
		"http://127.0.0.1:5173":                 true,
		"http://127.0.0.1":                      true,
		"http://127.0.0.1:":                     false,
		"http://127.0.0.1:5173.evil.com":        false,
		"http://127.0.0.1.evil.com":             false,
		"https://127.0.0.1:5173":                false,
		"http://localhost:8080":                 true,
		"null":                                  false,
		"":                                      false,
		"http://localhost:99999999":             false,
		"https://game.qianlongxundao.com/path":  false,
		"https://xgame.qianlongxundao.com":      false,
		"http://localhost:8080@evil.com":        false,
		"http://127.0.0.1:80/../../evil":        false,
		"https://game.qianlongxundao.com:*":     false,
		"https://sub.game.qianlongxundao.com":   false,
		"https://game.qianlongxundao.com.":      false,
		" https://game.qianlongxundao.com ":     true,
		"https://game.qianlongxundao.co":        false,
		"https://game.qianlongxundao.com:443":   false,
		"https://game.qianlongxundao.com:":      false,
		"http://[::1]:3000":                     false,
		"https://game.qianlongxundao.com\x00":   false,
		"https://game.qianlongxundao.com#x":     false,
		"https://game.qianlongxundao.com?x":     false,
		"https://game.qianlongxundao.com/":      false,
		"https://game.qianlongxundao.com\nhost": false,
	} {
		if got := OriginAllowed(pats, origin); got != want {
			t.Errorf("OriginAllowed(%q) = %v, want %v", origin, got, want)
		}
	}
}

func TestConfigValidate(t *testing.T) {
	ok := testConfig(newFakeClock())
	if err := ok.Validate(); err != nil {
		t.Fatal(err)
	}
	for name, edit := range map[string]func(*Config){
		"three players": func(c *Config) { c.PlayersPerMatch = 3 },
		"no stages":     func(c *Config) { c.Stages = nil },
		"no origins":    func(c *Config) { c.AllowedOrigins = nil },
		"star origin":   func(c *Config) { c.AllowedOrigins = []string{"*"} },
		"bad delays":    func(c *Config) { c.MinDelay, c.MaxDelay = 5, 3 },
		"rate too low":  func(c *Config) { c.MaxMessagesPerSecond = 30 },
	} {
		c := testConfig(newFakeClock())
		edit(&c)
		if c.Validate() == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestHealthHandler(t *testing.T) {
	h := newHarness(t, nil)
	a := h.hello("AS", "a")
	a.send(`{"t":"queue"}`)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("Origin", "https://game.example.com")
	h.s.HealthHandler().ServeHTTP(rec, req)
	if rec.Code != 200 || rec.Header().Get("Access-Control-Allow-Origin") != "https://game.example.com" {
		t.Fatalf("%d %v", rec.Code, rec.Header())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	for k, v := range map[string]any{"ok": true, "service": "test", "v": 1.0, "online": 1.0, "queued": 1.0, "matches": 0.0} {
		if body[k] != v {
			t.Errorf("healthz %s = %v, want %v (%s)", k, body[k], v, rec.Body)
		}
	}
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("Origin", "https://evil.example")
	h.s.HealthHandler().ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("CORS for a foreign origin")
	}
	rec = httptest.NewRecorder()
	h.s.HealthHandler().ServeHTTP(rec, httptest.NewRequest("POST", "/healthz", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST → %d", rec.Code)
	}
}

func TestContinentOf(t *testing.T) {
	for cc, want := range map[string]string{"TW": "AS", "jp": "AS", "DE": "EU", "RU": "EU", "US": "NA", "MX": "NA",
		"BR": "SA", "AU": "OC", "NZ": "OC", "ZA": "AF", "EG": "AF", "TR": "AS", "XX": "??", "T1": "??", "": "??", "AQ": "??"} {
		if got := ContinentOf(cc); got != want {
			t.Errorf("ContinentOf(%q) = %s, want %s", cc, got, want)
		}
	}
	n := 0
	for range countryContinent {
		n++
	}
	if n < 240 {
		t.Fatalf("only %d countries mapped", n)
	}
}

// A larger MaxBurstMessages lets a stalled stream arrive at once (e.g. a TCP
// retransmission) while the sustained rate stays MaxMessagesPerSecond.
func TestBurstAllowance(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.MaxBurstMessages = 240 })
	a := h.hello("AS", "a") // hello used one token
	for range 239 {
		a.send(`{"t":"ping","c":1}`)
		a.all()
	}
	if _, k := a.killed(); k {
		t.Fatal("closed within the burst")
	}
	a.send(`{"t":"ping","c":1}`) // 241st in the same instant
	a.expectError("rate_limited")
	if _, ok := a.killed(); !ok {
		t.Fatal("not closed past the burst")
	}
	// refilled at 90 per second, not faster: after 1 s, 90 more fit and the 91st does not
	b := h.hello("AS", "b")
	for range 239 {
		b.send(`{"t":"ping","c":1}`)
		b.all()
	}
	h.clk.Advance(time.Second)
	for range 90 {
		b.send(`{"t":"ping","c":1}`)
		b.all()
	}
	if _, k := b.killed(); k {
		t.Fatal("closed within the refill")
	}
	b.send(`{"t":"ping","c":1}`)
	b.expectError("rate_limited")
}
