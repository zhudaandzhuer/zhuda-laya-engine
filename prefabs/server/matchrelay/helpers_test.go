package matchrelay

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"sync"
	"testing"
	"time"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{t: time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func testConfig(clk Clock) Config {
	return Config{
		Service:        "test",
		Stages:         []string{"livingroom", "backyard"},
		Chars:          []string{"zhuda", "zhuer"},
		AllowedOrigins: []string{"https://game.example.com", "http://127.0.0.1:*"},
		Clock:          clk,
		Rand:           rand.NewChaCha8([32]byte{7}),
		Logger:         slog.New(slog.DiscardHandler),
	}
}

// harness drives a Server without sockets: messages go straight to receive,
// replies are read from each session's outgoing queue.
type harness struct {
	t   *testing.T
	s   *Server
	clk *fakeClock
	n   int
}

func newHarness(t *testing.T, edit func(*Config)) *harness {
	t.Helper()
	clk := newFakeClock()
	cfg := testConfig(clk)
	if edit != nil {
		edit(&cfg)
	}
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return &harness{t: t, s: s, clk: clk}
}

// tick moves the clock and runs the timers.
func (h *harness) tick(d time.Duration) {
	h.clk.Advance(d)
	h.s.Tick()
}

type tc struct {
	h    *harness
	sess *session
	name string
}

func (h *harness) conn(region string) *tc {
	h.t.Helper()
	h.n++
	sess, err := h.s.open(fmt.Sprintf("10.0.%d.%d", h.n/250, h.n%250), region)
	if err != nil {
		h.t.Fatal(err)
	}
	return &tc{h: h, sess: sess, name: fmt.Sprintf("c%d", h.n)}
}

// hello opens a connection and says hello with the given player id.
func (h *harness) hello(region, id string) *tc {
	h.t.Helper()
	c := h.conn(region)
	c.send(`{"t":"hello","v":1,"id":%q,"name":"p-%s","char":"zhuda"}`, id, id)
	w := c.expect("welcome")
	if w["region"] != region {
		h.t.Fatalf("welcome region %v, want %s", w["region"], region)
	}
	return c
}

func (c *tc) send(format string, args ...any) {
	c.h.s.receive(c.sess, fmt.Appendf(nil, format, args...))
}

type msg map[string]any

func (m msg) int(key string) int64 {
	v, ok := m[key].(float64)
	if !ok {
		panic(fmt.Sprintf("field %s of %v is not a number", key, m))
	}
	return int64(v)
}

func (m msg) str(key string) string { s, _ := m[key].(string); return s }

// all drains every pending message.
func (c *tc) all() []msg {
	var out []msg
	for {
		select {
		case b := <-c.sess.out:
			var m msg
			if err := json.Unmarshal(b, &m); err != nil {
				c.h.t.Fatalf("%s: bad JSON from server %q: %v", c.name, b, err)
			}
			out = append(out, m)
		default:
			return out
		}
	}
}

// expect returns the next message that is not "queued" or "pong" and checks its type.
func (c *tc) expect(t string) msg {
	c.h.t.Helper()
	for {
		select {
		case b := <-c.sess.out:
			var m msg
			if err := json.Unmarshal(b, &m); err != nil {
				c.h.t.Fatalf("%s: bad JSON %q", c.name, b)
			}
			if m["t"] == "queued" || m["t"] == "pong" {
				continue
			}
			if m["t"] != t {
				c.h.t.Fatalf("%s: got %v, want %s", c.name, m, t)
			}
			return m
		default:
			c.h.t.Fatalf("%s: no message, want %s", c.name, t)
			return nil
		}
	}
}

// expectError checks the next message is an error with this code.
func (c *tc) expectError(code string) msg {
	c.h.t.Helper()
	m := c.expect("error")
	if m["code"] != code {
		c.h.t.Fatalf("%s: error %v, want code %s", c.name, m, code)
	}
	return m
}

// quiet checks there is nothing but "queued"/"pong" pending.
func (c *tc) quiet() {
	c.h.t.Helper()
	for _, m := range c.all() {
		if m["t"] != "queued" && m["t"] != "pong" {
			c.h.t.Fatalf("%s: unexpected %v", c.name, m)
		}
	}
}

func (c *tc) killed() (closeReq, bool) {
	select {
	case k := <-c.sess.kill:
		return k, true
	default:
		return closeReq{}, false
	}
}

// drop simulates a lost connection.
func (c *tc) drop() { c.h.s.peerClosed(c.sess, "test drop") }

// pair queues a and b (same region) and returns them ordered by side with the
// match message each got.
func (h *harness) pair(a, b *tc) ([2]*tc, [2]msg) {
	h.t.Helper()
	a.send(`{"t":"queue","char":"zhuda"}`)
	b.send(`{"t":"queue","char":"zhuer"}`)
	ma, mb := a.expect("match"), b.expect("match")
	if ma.str("match") != mb.str("match") {
		h.t.Fatalf("different matches %v %v", ma, mb)
	}
	if ma.int("side") == 1 {
		return [2]*tc{b, a}, [2]msg{mb, ma}
	}
	return [2]*tc{a, b}, [2]msg{ma, mb}
}

// playing returns two players (index = side) in a started match and its delay.
func (h *harness) playing() ([2]*tc, int64, string) {
	h.t.Helper()
	p, m := h.pair(h.hello("AS", "alice"), h.hello("AS", "bob"))
	id := m[0].str("match")
	for _, c := range p {
		c.send(`{"t":"ready","match":%q}`, id)
	}
	for _, c := range p {
		if g := c.expect("go"); g.str("match") != id {
			h.t.Fatalf("go for %v", g)
		}
	}
	return p, m[0].int("delay"), id
}

// inputs sends frames from..to-1 for this side with b = f%64, 12 ms apart.
func (c *tc) inputs(from, to int64) {
	for f := from; f < to; f++ {
		c.h.clk.Advance(12 * time.Millisecond) // stay under the rate limit
		c.send(`{"t":"in","f":%d,"b":%d}`, f, f%64)
	}
}
