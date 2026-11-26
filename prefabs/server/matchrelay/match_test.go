package matchrelay

import (
	"testing"
	"time"
)

func TestInputDelay(t *testing.T) {
	ms := time.Millisecond
	for _, c := range []struct {
		rtt  time.Duration
		want int
	}{
		{0, 2},                          // ceil(0)+1 = 1 → clamped to 2
		{16 * ms, 2},                    // 16/16.7 → 1, +1
		{16700 * time.Microsecond, 2},   // exactly one frame
		{16701 * time.Microsecond, 3},   // a hair over → 2, +1
		{100 * ms, 7},                   // 5.99 → 6, +1
		{150 * ms, 10},                  // 8.98 → 9, +1
		{150300 * time.Microsecond, 10}, // 9.0 → 9, +1
		{150301 * time.Microsecond, 10}, // 10, +1 → clamped to 10
		{2 * time.Second, 10},
	} {
		if got := InputDelay(c.rtt, 60, 2, 10); got != c.want {
			t.Errorf("InputDelay(%v) = %d, want %d", c.rtt, got, c.want)
		}
	}
}

func TestMatchDelayFromMeasuredRTT(t *testing.T) {
	cases := []struct {
		name   string
		a, b   []time.Duration // server-measured samples
		cliB   string          // client-reported rtt in a ping (extension)
		expect int64
	}{
		{"unmeasured", nil, nil, "", 6},
		{"both fast", []time.Duration{10 * time.Millisecond}, []time.Duration{20 * time.Millisecond}, "", 3},
		{"one side only, fast", []time.Duration{10 * time.Millisecond}, nil, "", 6},
		{"one side only, slow", []time.Duration{250 * time.Millisecond}, nil, "", 10},
		{"median of samples", []time.Duration{900 * time.Millisecond, 90 * time.Millisecond, 100 * time.Millisecond}, []time.Duration{10 * time.Millisecond}, "", 7},
		{"client report raises it", []time.Duration{10 * time.Millisecond}, []time.Duration{10 * time.Millisecond}, "150", 10},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := newHarness(t, nil)
			a, b := h.hello("AS", "a"), h.hello("AS", "b")
			for _, d := range c.a {
				h.s.recordRTT(a.sess, d)
			}
			for _, d := range c.b {
				h.s.recordRTT(b.sess, d)
			}
			if c.cliB != "" {
				b.send(`{"t":"ping","c":5,"rtt":%s}`, c.cliB)
			}
			_, m := h.pair(a, b)
			if got := m[0].int("delay"); got != c.expect {
				t.Fatalf("delay %d, want %d", got, c.expect)
			}
		})
	}
}

func TestReadyThenGo(t *testing.T) {
	h := newHarness(t, nil)
	p, m := h.pair(h.hello("AS", "a"), h.hello("AS", "b"))
	id := m[0].str("match")
	p[0].send(`{"t":"ready","match":"wrong"}`)
	p[0].expectError("bad_state")
	p[0].send(`{"t":"in","f":4,"b":1}`)
	p[0].expectError("bad_state") // inputs before go
	p[0].send(`{"t":"ready","match":%q}`, id)
	p[0].quiet()
	p[1].quiet()
	p[1].send(`{"t":"ready","match":%q}`, id)
	p[0].expect("go")
	p[1].expect("go")
}

func TestRelayKeepsOrder(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	p[0].inputs(delay, delay+50)
	p[1].inputs(delay, delay+50)
	for side, c := range p {
		got := c.all()
		if len(got) != 50 {
			t.Fatalf("side %d got %d messages", side, len(got))
		}
		for i, m := range got {
			if m["t"] != "in" || m.int("f") != delay+int64(i) || m.int("b") != (delay+int64(i))%64 {
				t.Fatalf("side %d message %d = %v", side, i, m)
			}
		}
	}
}

func TestRelayRejectsBadInputs(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	a, b := p[0], p[1]
	for _, bad := range []string{
		`{"t":"in","f":%d,"b":64}`,  // byte out of range
		`{"t":"in","f":%d,"b":-1}`,  // negative
		`{"t":"in","f":%d}`,         // missing b
		`{"t":"in","b":1,"x":%d}`,   // missing f
		`{"t":"in","f":%d,"b":1.5}`, // not an integer → bad JSON for the field
	} {
		a.send(bad, delay)
		m := a.expect("error")
		if m["code"] != "bad_input" && m["code"] != "bad_message" {
			t.Fatalf("%s → %v", bad, m)
		}
	}
	a.send(`{"t":"in","f":%d,"b":1}`, delay-1) // before delay
	a.expectError("bad_input")
	a.send(`{"t":"in","f":%d,"b":1}`, delay+1) // gap
	a.expectError("bad_input")
	b.quiet() // nothing relayed so far

	a.send(`{"t":"in","f":%d,"b":5}`, delay)
	a.send(`{"t":"in","f":%d,"b":6}`, delay) // duplicate (even with another byte)
	a.expectError("bad_input")
	a.send(`{"t":"in","f":%d,"b":7}`, delay+2) // gap again
	a.expectError("bad_input")
	a.send(`{"t":"in","f":%d,"b":8}`, delay+1)
	got := b.all()
	if len(got) != 2 || got[0].int("f") != delay || got[0].int("b") != 5 || got[1].int("f") != delay+1 || got[1].int("b") != 8 {
		t.Fatalf("relayed %v", got)
	}
}

func TestRelayLeadBound(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.MaxLeadFrames = 10 })
	p, delay, _ := h.playing()
	p[0].inputs(delay, delay+10) // opponent is still at delay: 10 frames of lead allowed
	p[0].send(`{"t":"in","f":%d,"b":0}`, delay+10)
	p[0].expectError("bad_input")
	p[1].inputs(delay, delay+1)
	p[0].all()
	p[0].send(`{"t":"in","f":%d,"b":0}`, delay+10)
	p[0].quiet()
	if got := p[1].all(); len(got) != 11 || got[10].int("f") != delay+10 {
		t.Fatalf("side 1 got %v", got)
	}
}

// play sends n frames of inputs from both sides, interleaved.
func play(p [2]*tc, from, to int64) {
	for f := from; f < to; f++ {
		p[0].inputs(f, f+1)
		p[1].inputs(f, f+1)
	}
}

func TestHashMatchAndDesync(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 130)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"hash","f":60,"h":123456}`)
	p[1].send(`{"t":"hash","f":60,"h":123456}`)
	p[0].quiet()
	p[1].quiet()
	p[1].send(`{"t":"hash","f":120,"h":1}`)
	p[0].send(`{"t":"hash","f":120,"h":2}`)
	for _, c := range p {
		if d := c.expect("desync"); d.int("f") != 120 {
			t.Fatalf("desync %v", d)
		}
	}
	// The match is over: later inputs are dropped quietly, rematch is possible.
	p[0].inputs(130, 131)
	p[1].quiet()
	if hl := h.s.Health(); hl.Matches != 0 || hl.Totals.Desyncs != 1 {
		t.Fatalf("health %+v", hl)
	}
}

func TestHashValidation(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 70)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"hash","f":59,"h":1}`)
	p[0].expectError("bad_input") // not a multiple of 60
	p[0].send(`{"t":"hash","f":120,"h":1}`)
	p[0].expectError("bad_input") // skips 60 (and has no input for 120)
	p[0].send(`{"t":"hash","f":60,"h":4294967296}`)
	p[0].expectError("bad_input") // not a uint32
	// A signed 32-bit hash (JS h|0) equals its unsigned form.
	p[0].send(`{"t":"hash","f":60,"h":-1}`)
	p[1].send(`{"t":"hash","f":60,"h":4294967295}`)
	p[0].quiet()
	p[1].quiet()
}

func TestEndAgreesGivesResult(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 110)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"end","f":100,"winner":1}`)
	p[0].quiet()
	p[1].send(`{"t":"end","f":100,"winner":1}`)
	for _, c := range p {
		if r := c.expect("result"); r.int("winner") != 1 {
			t.Fatalf("result %v", r)
		}
	}
	if hl := h.s.Health(); hl.Totals.Results != 1 || hl.Matches != 0 {
		t.Fatalf("health %+v", hl)
	}
}

func TestEndMismatch(t *testing.T) {
	for _, c := range []struct {
		name   string
		a, b   string
		wantAt int64
	}{
		{"winner differs", `{"t":"end","f":100,"winner":0}`, `{"t":"end","f":100,"winner":1}`, 100},
		{"frame differs", `{"t":"end","f":100,"winner":-1}`, `{"t":"end","f":90,"winner":-1}`, 90},
	} {
		t.Run(c.name, func(t *testing.T) {
			h := newHarness(t, nil)
			p, delay, _ := h.playing()
			play(p, delay, 110)
			p[0].all()
			p[1].all()
			p[0].send("%s", c.a)
			p[1].send("%s", c.b)
			for _, x := range p {
				if d := x.expect("desync"); d.int("f") != c.wantAt {
					t.Fatalf("desync %v", d)
				}
			}
		})
	}
	t.Run("other side never ends", func(t *testing.T) {
		h := newHarness(t, nil)
		p, delay, _ := h.playing()
		play(p, delay, 110)
		p[0].all()
		p[1].all()
		p[0].send(`{"t":"end","f":100,"winner":0}`)
		h.tick(9 * time.Second)
		p[1].send(`{"t":"ping","c":1}`)
		p[0].send(`{"t":"ping","c":1}`)
		p[0].quiet()
		p[1].quiet()
		h.tick(time.Second)
		for _, x := range p {
			if d := x.expect("desync"); d.int("f") != 100 {
				t.Fatalf("desync %v", d)
			}
		}
	})
	t.Run("bad end", func(t *testing.T) {
		h := newHarness(t, nil)
		p, delay, _ := h.playing()
		play(p, delay, 20)
		p[0].all()
		p[0].send(`{"t":"end","f":100,"winner":0}`) // no input sent for frame 100 yet
		p[0].expectError("bad_input")
		p[0].send(`{"t":"end","f":10,"winner":2}`)
		p[0].expectError("bad_input")
	})
}

func TestDisconnectGraceThenOppLeft(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 30)
	p[1].all()
	p[0].drop()
	h.tick(9900 * time.Millisecond)
	p[1].quiet()
	h.tick(100 * time.Millisecond)
	p[1].expect("opp_left")
	if hl := h.s.Health(); hl.Matches != 0 || hl.Totals.OppLeft != 1 || hl.Online != 1 {
		t.Fatalf("health %+v", hl)
	}
	// The winner is back in the lobby and can queue again.
	p[1].send(`{"t":"queue"}`)
	p[1].quiet()
}

func TestCancelInMatchIsImmediateOppLeft(t *testing.T) {
	h := newHarness(t, nil)
	p, _, _ := h.playing()
	p[1].send(`{"t":"cancel"}`)
	p[0].expect("opp_left")
	p[1].quiet()
}

func TestInputSilenceCountsOnlyThePlayerWhoCouldSend(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 40)
	// Side 1 runs ahead until lockstep blocks it (delay frames), then side 0 goes silent.
	p[1].inputs(40, 40+delay)
	p[0].all()
	p[1].all()
	for range 9 {
		h.tick(time.Second)
		p[1].send(`{"t":"ping","c":1}`) // alive, but blocked: not silence
		p[0].send(`{"t":"ping","c":1}`) // alive, could send, sends nothing
	}
	p[0].quiet()
	p[1].quiet()
	h.tick(time.Second)
	p[0].expectError("idle")
	p[1].expect("opp_left")
}

func TestReadyTimeout(t *testing.T) {
	h := newHarness(t, nil)
	p, m := h.pair(h.hello("AS", "a"), h.hello("AS", "b"))
	p[0].send(`{"t":"ready","match":%q}`, m[0].str("match"))
	for range 2 {
		h.tick(14 * time.Second)
		p[0].send(`{"t":"ping","c":1}`)
		p[1].send(`{"t":"ping","c":1}`)
	}
	p[0].quiet()
	h.tick(2 * time.Second) // 30 s
	p[1].expectError("ready_timeout")
	p[0].expect("opp_left")
}

func TestRematch(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, id := h.playing()
	play(p, delay, 70)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"rematch"}`)
	p[0].expectError("bad_state") // not over yet
	p[0].send(`{"t":"end","f":60,"winner":0}`)
	p[1].send(`{"t":"end","f":60,"winner":0}`)
	p[0].expect("result")
	p[1].expect("result")
	p[0].send(`{"t":"rematch"}`)
	p[0].quiet()
	p[1].quiet()
	p[1].send(`{"t":"rematch"}`)
	m0, m1 := p[0].expect("match"), p[1].expect("match")
	newID := m0.str("match")
	if newID == id || m1.str("match") != newID {
		t.Fatalf("rematch ids %q %q (old %q)", newID, m1.str("match"), id)
	}
	if m0.int("side")+m1.int("side") != 1 {
		t.Fatal("sides")
	}
	for _, c := range p {
		c.send(`{"t":"ready","match":%q}`, newID)
	}
	p[0].expect("go")
	p[1].expect("go")
	if hl := h.s.Health(); hl.Totals.Matches != 2 || hl.Totals.Results != 1 {
		t.Fatalf("health %+v", hl)
	}
}

func TestLeavingAfterResultTellsTheOther(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 70)
	p[0].all()
	p[1].all()
	p[0].send(`{"t":"end","f":60,"winner":-1}`)
	p[1].send(`{"t":"end","f":60,"winner":-1}`)
	p[0].expect("result")
	p[1].expect("result")
	p[0].send(`{"t":"rematch"}`)
	p[1].send(`{"t":"queue"}`) // goes looking for someone else instead
	p[0].expect("opp_left")
	p[0].send(`{"t":"rematch"}`)
	p[0].expectError("bad_state")
}

func TestResumeAfterDisconnect(t *testing.T) {
	h := newHarness(t, nil)
	p, m := h.pair(h.hello("AS", "a"), h.hello("AS", "b"))
	id := m[0].str("match")
	for _, c := range p {
		c.send(`{"t":"ready","match":%q}`, id)
	}
	p[0].expect("go")
	p[1].expect("go")
	delay := m[0].int("delay")
	play(p, delay, 20)
	p[1].inputs(20, 23) // side 1 runs a little ahead
	p[0].all()
	p[1].all()
	p[0].drop()

	// Wrong key.
	x := h.hello("AS", "a")
	x.send(`{"t":"resume","match":%q,"key":"00000000000000000000000000000000","f":10}`, id)
	x.expectError("resume_failed")

	h.tick(5 * time.Second)
	// Side 0 comes back: it had the opponent's inputs up to frame 17.
	x.send(`{"t":"resume","match":%q,"key":%q,"f":18}`, id, m[0].str("key"))
	r := x.expect("resumed")
	if r.int("next") != 20 || r.int("side") != 0 || r["started"] != true {
		t.Fatalf("resumed %v", r)
	}
	var fs []int64
	for _, in := range x.all() {
		fs = append(fs, in.int("f"))
	}
	if len(fs) != 5 || fs[0] != 18 || fs[4] != 22 {
		t.Fatalf("replayed frames %v, want 18..22", fs)
	}
	// Relay continues both ways; the grace timer no longer runs.
	x.inputs(20, 22)
	if got := p[1].all(); len(got) != 2 || got[0].int("f") != 20 {
		t.Fatalf("after resume side 1 got %v", got)
	}
	p[1].inputs(23, 24)
	if got := x.all(); len(got) != 1 || got[0].int("f") != 23 {
		t.Fatalf("after resume side 0 got %v", got)
	}
	h.tick(6 * time.Second)
	p[1].quiet()
	if h.s.Health().Totals.Resumed != 1 {
		t.Fatal("resume not counted")
	}
}

func TestLateFrameMessagesAfterOppLeftAreIgnored(t *testing.T) {
	h := newHarness(t, nil)
	p, delay, _ := h.playing()
	play(p, delay, 70)
	p[0].all()
	p[1].send(`{"t":"cancel"}`)
	p[0].expect("opp_left")
	p[0].inputs(70, 72) // were already on the wire
	p[0].send(`{"t":"hash","f":60,"h":1}`)
	p[0].send(`{"t":"end","f":65,"winner":0}`)
	p[0].quiet()
	if n := h.s.Health().Totals.BadMessages; n != 0 {
		t.Fatalf("%d errors", n)
	}
}
