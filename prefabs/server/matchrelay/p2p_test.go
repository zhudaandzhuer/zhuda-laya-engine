package matchrelay

import (
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// v2 is a server that speaks v1 and v2 (the direct-path extension).
func v2(c *Config) { c.Version, c.MinVersion = 2, 1 }

// helloP2P opens a connection and says hello v2, with or without "p2p": true.
func (h *harness) helloP2P(region, id string, p2p bool) *tc {
	h.t.Helper()
	c := h.conn(region)
	c.send(`{"t":"hello","v":2,"id":%q,"name":"p-%s","char":"zhuda","p2p":%t}`, id, id, p2p)
	if w := c.expect("welcome"); w.int("v") != 2 {
		h.t.Fatalf("welcome %v", w)
	}
	return c
}

// directMatch pairs two p2p clients; returns them by side, the match id and the match messages.
func (h *harness) directMatch(a, b string) ([2]*tc, string, [2]msg) {
	h.t.Helper()
	p, m := h.pair(h.helloP2P("AS", a, true), h.helloP2P("AS", b, true))
	if m[0]["p2p"] != true || m[1]["p2p"] != true {
		h.t.Fatalf("match without p2p: %v", m)
	}
	return p, m[0].str("match"), m
}

func TestRTCForwardedOnlyToTheOpponentOfTheSameMatch(t *testing.T) {
	h := newHarness(t, v2)
	p, id, _ := h.directMatch("a", "b")
	q, id2, _ := h.directMatch("c", "d")
	p[0].send(`{"t":"rtc","match":%q,"d":{ "sdp" : {"type":"offer","sdp":"v=0\r\n"} }}`, id)
	got := p[1].expect("rtc")
	if got.str("match") != id {
		t.Fatalf("rtc %v", got)
	}
	sdp := got["d"].(map[string]any)["sdp"].(map[string]any)
	if sdp["type"] != "offer" || sdp["sdp"] != "v=0\r\n" {
		t.Fatalf("payload changed: %v", got)
	}
	p[0].quiet() // nothing back to the sender
	q[0].quiet()
	q[1].quiet()
	// the other way round, and the other match stays separate
	p[1].send(`{"t":"rtc","match":%q,"d":{"ice":{"candidate":"candidate:1 1 udp 1 1.2.3.4 5 typ host","sdpMid":"0","sdpMLineIndex":0}}}`, id)
	if m := p[0].expect("rtc"); m["d"].(map[string]any)["ice"] == nil {
		t.Fatalf("rtc %v", m)
	}
	q[1].send(`{"t":"rtc","match":%q,"d":{"x":1}}`, id2)
	q[0].expect("rtc")
	p[0].quiet()
	p[1].quiet()
	// a match id that is not yours is refused and goes nowhere
	p[0].send(`{"t":"rtc","match":%q,"d":{"x":1}}`, id2)
	p[0].expectError("bad_state")
	for _, c := range []*tc{p[1], q[0], q[1]} {
		c.quiet()
	}
	if hl := h.s.Health(); hl.Totals.Signals != 3 {
		t.Fatalf("signals %d", hl.Totals.Signals)
	}
}

func TestRTCOnlyFromMatchUntilTheEnd(t *testing.T) {
	h := newHarness(t, v2)
	a, b := h.helloP2P("AS", "a", true), h.helloP2P("AS", "b", true)
	// before any match: lobby, then queued
	a.send(`{"t":"rtc","match":"x","d":{"x":1}}`)
	a.expectError("bad_state")
	a.send(`{"t":"queue"}`)
	a.send(`{"t":"rtc","match":"x","d":{"x":1}}`)
	a.expectError("bad_state")
	// from match (before go) it is forwarded
	b.send(`{"t":"queue"}`)
	ma := a.expect("match")
	b.expect("match")
	id := ma.str("match")
	a.send(`{"t":"rtc","match":%q,"d":{"n":1}}`, id)
	b.expect("rtc")
	p := [2]*tc{a, b}
	if ma.int("side") == 1 {
		p = [2]*tc{b, a}
	}
	for _, c := range p {
		c.send(`{"t":"ready","match":%q}`, id)
	}
	p[0].expect("go")
	p[1].expect("go")
	// during play
	p[1].send(`{"t":"rtc","match":%q,"d":{"n":2}}`, id)
	p[0].expect("rtc")
	delay := ma.int("delay")
	play(p, delay, 70)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"end","f":60,"winner":0}`)
	p[1].send(`{"t":"end","f":60,"winner":0}`)
	p[0].expect("result")
	p[1].expect("result")
	// after the end: not forwarded (late candidates are dropped quietly)
	p[0].send(`{"t":"rtc","match":%q,"d":{"n":3}}`, id)
	p[0].quiet()
	p[1].quiet()
	// after the opponent left (match dissolved): refused
	p[1].send(`{"t":"queue"}`)
	p[0].expect("opp_left")
	p[0].send(`{"t":"rtc","match":%q,"d":{"n":4}}`, id)
	p[0].expectError("bad_state")
	p[1].quiet()
}

func TestRTCNeedsBothPlayersToOfferP2P(t *testing.T) {
	for _, c := range []struct {
		name string
		b    func(h *harness) *tc
	}{
		{"one says p2p false", func(h *harness) *tc { return h.helloP2P("AS", "b", false) }},
		{"opponent is v1", func(h *harness) *tc { return h.hello("AS", "b") }},
	} {
		t.Run(c.name, func(t *testing.T) {
			h := newHarness(t, v2)
			p, m := h.pair(h.helloP2P("AS", "a", true), c.b(h))
			for _, x := range m {
				if _, has := x["p2p"]; has {
					t.Fatalf("match has p2p: %v", x)
				}
			}
			for _, x := range p {
				x.send(`{"t":"rtc","match":%q,"d":{"x":1}}`, m[0].str("match"))
				x.expectError("bad_state")
			}
			// ready with a direct path is ignored: go keeps the match delay
			for _, x := range p {
				x.send(`{"t":"ready","match":%q,"p2p":{"ok":true,"rtt":1}}`, m[0].str("match"))
			}
			for _, x := range p {
				if g := x.expect("go"); g.int("delay") != m[0].int("delay") {
					t.Fatalf("go %v, match delay %d", g, m[0].int("delay"))
				}
			}
		})
	}
}

func TestRTCPayloadMustBeAnObject(t *testing.T) {
	h := newHarness(t, v2)
	p, id, _ := h.directMatch("a", "b")
	for _, d := range []string{``, `,"d":"offer"`, `,"d":[1]`, `,"d":5`, `,"d":null`} {
		p[0].send(`{"t":"rtc","match":%q%s}`, id, d)
		p[0].expectError("bad_message")
	}
	p[1].quiet()
}

func TestRTCCountCapPerSidePerMatch(t *testing.T) {
	h := newHarness(t, v2)
	p, id, _ := h.directMatch("a", "b")
	for i := range 40 {
		h.clk.Advance(20 * time.Millisecond) // stay inside the message rate
		p[0].send(`{"t":"rtc","match":%q,"d":{"i":%d}}`, id, i)
	}
	if got := p[1].all(); len(got) != 40 {
		t.Fatalf("forwarded %d of 40", len(got))
	}
	p[0].send(`{"t":"rtc","match":%q,"d":{"i":40}}`, id)
	p[0].expectError("rtc_limit")
	p[1].quiet()
	if _, closed := p[0].killed(); closed {
		t.Fatal("rtc_limit closed the connection")
	}
	// the other side has its own 40, and the match goes on
	h.clk.Advance(time.Second)
	p[1].send(`{"t":"rtc","match":%q,"d":{"i":0}}`, id)
	p[0].expect("rtc")
}

func TestRTCSizeCapInsideTheServer(t *testing.T) {
	h := newHarness(t, v2)
	p, id, _ := h.directMatch("a", "b")
	big := `{"t":"rtc","match":"` + id + `","d":{"sdp":"` + strings.Repeat("s", 5000) + `"}}`
	p[0].send("%s", big)
	if m := p[1].expect("rtc"); len(m["d"].(map[string]any)["sdp"].(string)) != 5000 {
		t.Fatal("big rtc cut")
	}
	// any other message over MaxMessageBytes still closes with 1009
	p[1].send(`{"t":"ping","c":1,"pad":"%s"}`, strings.Repeat("x", 1100))
	if k, ok := p[1].killed(); !ok || k.code != websocket.StatusMessageTooBig {
		t.Fatalf("kill %v %v", k, ok)
	}
}

func TestGoDelayFromTheDirectPath(t *testing.T) {
	ms := time.Millisecond
	cases := []struct {
		name         string
		ready0       string // ready's p2p field of side 0 and 1 ("" = none)
		ready1       string
		wantDirect   bool
		relay, final int64
	}{
		{"both ok: larger direct RTT", `{"ok":true,"rtt":12.5}`, `{"ok":true,"rtt":30}`, true, 10, 3},
		{"both ok, tiny RTT: the minimum", `{"ok":true,"rtt":0}`, `{"ok":true,"rtt":0.4}`, true, 10, 2},
		{"only one ok", `{"ok":true,"rtt":10}`, `{"ok":false}`, false, 10, 10},
		{"one without p2p", `{"ok":true,"rtt":10}`, ``, false, 10, 10},
		{"bad report: string ok", `{"ok":"yes","rtt":10}`, `{"ok":true,"rtt":10}`, false, 10, 10},
		{"bad report: no rtt", `{"ok":true}`, `{"ok":true,"rtt":10}`, false, 10, 10},
		{"bad report: negative rtt", `{"ok":true,"rtt":-1}`, `{"ok":true,"rtt":10}`, false, 10, 10},
		{"bad report: not an object", `true`, `{"ok":true,"rtt":10}`, false, 10, 10},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := newHarness(t, v2)
			a, b := h.helloP2P("AS", "a", true), h.helloP2P("AS", "b", true)
			h.s.recordRTT(a.sess, 250*ms) // the relay path is slow
			h.s.recordRTT(b.sess, 200*ms)
			p, m := h.pair(a, b)
			id := m[0].str("match")
			if m[0].int("delay") != c.relay || m[1].int("delay") != c.relay {
				t.Fatalf("match delay %v", m)
			}
			for side, r := range []string{c.ready0, c.ready1} {
				if r == "" {
					p[side].send(`{"t":"ready","match":%q}`, id)
				} else {
					p[side].send(`{"t":"ready","match":%q,"p2p":%s}`, id, r)
				}
			}
			for _, x := range p {
				if g := x.expect("go"); g.int("delay") != c.final {
					t.Fatalf("go %v, want delay %d", g, c.final)
				}
			}
			if d := h.s.Health().Totals.Direct; (d == 1) != c.wantDirect {
				t.Fatalf("direct count %d", d)
			}
			// inputs are validated against the final delay
			if c.final != c.relay {
				p[0].send(`{"t":"in","f":%d,"b":1}`, c.relay)
				p[0].expectError("bad_input")
			}
			p[0].send(`{"t":"in","f":%d,"b":1}`, c.final-1)
			p[0].expectError("bad_input")
			p[0].inputs(c.final, c.final+30)
			p[1].inputs(c.final, c.final+30)
			for side, x := range p {
				got := x.all()
				if len(got) != 30 || got[0].int("f") != c.final {
					t.Fatalf("side %d got %d inputs from %v", side, len(got), got[0])
				}
			}
			// the delay of a resume is the final one too
			p[1].drop()
			y := h.helloP2P("AS", "b", true)
			y.send(`{"t":"resume","match":%q,"key":%q,"f":0}`, id, m[1].str("key"))
			if r := y.expect("resumed"); r.int("next") != c.final+30 {
				t.Fatalf("resumed %v", r)
			}
			if got := y.all(); len(got) != 30 || got[0].int("f") != c.final {
				t.Fatalf("replayed %d inputs", len(got))
			}
		})
	}
}

func TestGoDelayNeverAboveTheMatchDelay(t *testing.T) {
	h := newHarness(t, v2)
	p, id, m := h.directMatch("a", "b") // RTT unmeasured: delay 6
	if m[0].int("delay") != 6 {
		t.Fatalf("match %v", m[0])
	}
	p[0].send(`{"t":"ready","match":%q,"p2p":{"ok":true,"rtt":400}}`, id)
	p[1].send(`{"t":"ready","match":%q,"p2p":{"ok":true,"rtt":20}}`, id)
	for _, x := range p {
		if g := x.expect("go"); g.int("delay") != 6 {
			t.Fatalf("go %v", g)
		}
	}
}

func TestV1ClientsAreServedAsBefore(t *testing.T) {
	h := newHarness(t, v2)
	a, b := h.hello("AS", "a"), h.hello("AS", "b") // hello v1, no p2p (welcome v checked below)
	h.s.recordRTT(a.sess, 40*time.Millisecond)
	h.s.recordRTT(b.sess, 30*time.Millisecond)
	p, m := h.pair(a, b)
	for _, x := range m {
		if _, has := x["p2p"]; has {
			t.Fatalf("v1 match message has p2p: %v", x)
		}
		if x.int("delay") != 4 || len(x.str("key")) != 32 {
			t.Fatalf("match %v", x)
		}
	}
	id := m[0].str("match")
	for _, x := range p {
		x.send(`{"t":"ready","match":%q}`, id)
	}
	for _, x := range p {
		if g := x.expect("go"); g.str("match") != id || g.int("delay") != 4 {
			t.Fatalf("go %v", g)
		}
	}
	play(p, 4, 130)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"hash","f":60,"h":7}`)
	p[1].send(`{"t":"hash","f":60,"h":7}`)
	p[0].send(`{"t":"end","f":120,"winner":1}`)
	p[1].send(`{"t":"end","f":120,"winner":1}`)
	p[0].expect("result")
	p[1].expect("result")
	if hl := h.s.Health(); hl.V != 2 || hl.Totals.BadMessages != 0 || hl.Totals.Direct != 0 {
		t.Fatalf("health %+v", hl)
	}
	// welcome echoes the client's version; versions outside 1–2 are refused
	x := h.conn("AS")
	x.send(`{"t":"hello","v":1,"id":"old","name":"n","char":"zhuda"}`)
	if w := x.expect("welcome"); w.int("v") != 1 {
		t.Fatalf("welcome %v", w)
	}
	for _, v := range []string{"0", "3"} {
		y := h.conn("AS")
		y.send(`{"t":"hello","v":%s,"id":"new","name":"n","char":"zhuda"}`, v)
		if e := y.expectError("version"); !strings.Contains(e.str("msg"), "v1-v2") {
			t.Fatalf("version error %v", e)
		}
	}
}
